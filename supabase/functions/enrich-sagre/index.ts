// =============================================================================
// enrich-sagre — Data Enrichment Edge Function
// Runs three sequential passes:
//   1. Geocoding pass: pending_geocode -> pending_llm (or geocode_failed)
//   2. LLM enrichment pass: pending_llm | geocode_failed -> enriched
//   3. Image pass: enriched with null image_url -> Unsplash (primary) + Pexels (fallback)
// Deploy to Supabase Dashboard (no Supabase CLI per project pattern)
// =============================================================================

import { GoogleGenAI } from "npm:@google/genai@1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const GEOCODE_LIMIT = 15;   // max rows to geocode per loop iteration (was 30 — reduced to leave more time for LLM)
const LLM_LIMIT = 200;      // max sagre to enrich per loop iteration (25 batches of 8)
const SLEEP_MS = 1100;      // 1.1s between Nominatim calls (policy: 1 req/sec)
const VENETO_VIEWBOX = "10.62,44.79,13.10,46.68"; // Nominatim viewbox: lon_min,lat_min,lon_max,lat_max
const TIME_BUDGET_MS = 120_000; // 120s time budget (leaves 30s margin — free tier timeout appears to be ≥150s)

// Pass 3: Image assignment — Unsplash (primary) + Pexels (fallback)
const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
const UNSPLASH_LIMIT = 200;     // max sagre to process per run (batch strategy uses ~9-10 API calls total)
const UNSPLASH_SLEEP_MS = 2000;  // 2s between calls (courtesy + safety margin)
const UNSPLASH_PER_PAGE = 30;    // max results per Unsplash API call (API max is 30)
const PEXELS_PER_PAGE = 30;      // max results per Pexels API call

// Inline copy of TAG_QUERIES from src/lib/unsplash.ts
// Edge Functions cannot import from the Next.js src/ directory.
const TAG_QUERIES: Record<string, string> = {
  "Pesce": "fresh seafood platter Mediterranean",
  "Carne": "grilled meat outdoor Italian barbecue",
  "Vino": "wine glass pouring vineyard sunset",
  "Formaggi": "Italian cheese board rustic",
  "Funghi": "porcini mushroom Italian dish",
  "Radicchio": "radicchio red chicory Italian salad",
  "Dolci": "Italian pastry dessert table",
  "Pane": "Italian focaccia flatbread rustic",
  "Verdura": "fresh vegetables Italian garden market",
  "Prodotti Tipici": "Italian cheese salami board rustic",
  "Zucca": "pumpkin soup autumn Italian dish",
  "Gnocchi": "Italian gnocchi potato pasta dish",
};
const DEFAULT_UNSPLASH_QUERY = "Italian grilled sausage polenta rustic";

// =============================================================================
// Geocoding helpers (copied verbatim from src/lib/enrichment/geocode.ts)
// Deno Edge Functions cannot import from the Next.js src/ directory.
// =============================================================================

// Italy bounding box — coordinates outside this range are invalid geocode results
const ITALY_BOUNDS = { lat: { min: 36.0, max: 47.5 }, lon: { min: 6.0, max: 19.0 } };

// Veneto province names as returned by Nominatim addressdetails (county/province/state_district)
// Used to filter out non-Veneto sagre after geocoding
const VENETO_PROVINCES = [
  "belluno", "padova", "rovigo", "treviso", "venezia", "verona", "vicenza",
  // Nominatim sometimes returns the full form
  "provincia di belluno", "provincia di padova", "provincia di rovigo",
  "provincia di treviso", "provincia di venezia", "provincia di verona",
  "provincia di vicenza",
];

function isVenetoProvince(province: string | null): boolean {
  if (!province) return false;
  return VENETO_PROVINCES.includes(province.toLowerCase().trim());
}

// Province code normalization -- inline copy from src/lib/enrichment/geocode.ts
const PROVINCE_CODE_MAP: Record<string, string> = {
  "belluno": "BL", "provincia di belluno": "BL",
  "padova": "PD", "provincia di padova": "PD",
  "rovigo": "RO", "provincia di rovigo": "RO",
  "treviso": "TV", "provincia di treviso": "TV",
  "venezia": "VE", "provincia di venezia": "VE",
  "verona": "VR", "provincia di verona": "VR",
  "vicenza": "VI", "provincia di vicenza": "VI",
};

function normalizeProvinceCode(province: string | null): string | null {
  if (!province) return null;
  return PROVINCE_CODE_MAP[province.toLowerCase().trim()] ?? null;
}

/**
 * Normalize location_text for better Nominatim geocoding results.
 * Handles: province codes, region prefixes, extra whitespace, common noise.
 */
function normalizeLocationText(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  // Remove province codes: "(VR)", "- VR", ", VR"
  s = s.replace(/\s*\([A-Z]{2}\)\s*/g, "");
  s = s.replace(/\s*[-,]\s*[A-Z]{2}\s*$/g, "");
  // Remove region prefixes: "Veneto ", "Veneto - ", etc.
  s = s.replace(/^(Veneto|Lombardia|Piemonte|Emilia[\s-]?Romagna|Trentino|Friuli[\s-]?Venezia[\s-]?Giulia)\s*[-:,]?\s*/i, "");
  // Remove "Provincia di " prefix
  s = s.replace(/^Provincia\s+di\s+/i, "");
  // Collapse multiple spaces
  s = s.replace(/\s+/g, " ").trim();
  // Append ", Veneto" for Nominatim disambiguation if the result is a bare city name
  if (s && !s.includes(",")) {
    s = s + ", Veneto";
  }
  return s;
}

// Keep cleanCityName as alias for compatibility
function cleanCityName(raw: string): string {
  return normalizeLocationText(raw);
}

/**
 * Validate that a coordinate pair falls within Italy's bounding box.
 * Catches bad geocode results that land outside Italy (Nominatim ambiguity).
 */
function isValidItalyCoord(lat: number, lon: number): boolean {
  return (
    lat >= ITALY_BOUNDS.lat.min &&
    lat <= ITALY_BOUNDS.lat.max &&
    lon >= ITALY_BOUNDS.lon.min &&
    lon <= ITALY_BOUNDS.lon.max
  );
}

// =============================================================================
// LLM enrichment helpers (copied verbatim from src/lib/enrichment/llm.ts)
// Deno Edge Functions cannot import from the Next.js src/ directory.
// =============================================================================

const FOOD_TAGS = ["Pesce", "Carne", "Vino", "Formaggi", "Funghi", "Radicchio", "Zucca", "Dolci", "Pane", "Verdura", "Prodotti Tipici"] as const;
const FEATURE_TAGS = ["Gratis", "Musica", "Artigianato", "Bambini", "Tradizionale", "Giostre"] as const;
type FoodTag = typeof FOOD_TAGS[number];
type FeatureTag = typeof FEATURE_TAGS[number];
const BATCH_SIZE = 8;
const MAX_DESC_CHARS = 500;

/**
 * Filter an array of tag strings to only those present in the allowed enum.
 * Gemini structured output guarantees JSON syntax but not strict enum compliance.
 */
function validateTags<T extends string>(tags: string[], allowedTags: readonly T[]): T[] {
  return tags.filter((t): t is T => (allowedTags as readonly string[]).includes(t));
}

/**
 * Truncate a description to MAX_DESC_CHARS characters.
 */
function truncateDescription(text: string): string {
  return text.slice(0, MAX_DESC_CHARS);
}

/**
 * Split an array into chunks of at most `size` items.
 */
function chunkBatch<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Build the comprehensive Gemini prompt for a batch of events.
 * Does EVERYTHING in one pass: classify, clean title, create description,
 * extract city/dates, assign tags, generate image query, confidence score.
 */
function buildEnrichmentPrompt(batch: SagraForLLM[]): string {
  return `Sei un esperto di sagre italiane e gastronomia veneta. Per ogni evento nella lista JSON, analizza TUTTI i campi (title, location_text, description) e genera:

1. **is_sagra**: true SOLO se è UN SINGOLO evento specifico (sagra/festa del cibo/fiera gastronomica) con nome proprio, luogo preciso e data.
   false se:
   - Antiquariato, mostra, concerto puro, evento sportivo, mercato generico senza cibo
   - Articoli/pagine che ELENCANO più eventi ("Le sagre di agosto a Padova", "Eventi enogastronomici di aprile", "Sagre ed Eventi Veneto")
   - Calendari, guide, roundup, "cosa fare questo weekend", "le migliori sagre di..."
   - Titoli con PLURALE generico: "Sagre e feste", "Fiere e festival", "Eventi enogastronomici"
   REGOLA CHIAVE: una vera sagra ha UN nome specifico ("Sagra della Zucca", "Festa del Baccalà"), NON un titolo che descrive una categoria di eventi.

2. **confidence**: numero 0-100. Quanto sei sicuro che questa sia una vera sagra specifica con dati corretti.
   - 90-100: sagra vera, titolo chiaro, date presenti, luogo preciso
   - 70-89: probabilmente sagra, qualche dato mancante
   - 50-69: dubbio, potrebbe essere sagra o no
   - 0-49: probabilmente NON è una sagra o dati troppo vaghi

3. **clean_title**: titolo PULITO e CORTO. Regole:
   - Rimuovi date, luoghi, info ripetitive dal titolo. "Sagra di San Giacomo il 17 agosto con polenta e baccalà in provincia di Venezia" → "Sagra di San Giacomo"
   - "Sagra della Zucca di Tribano 2026" → "Sagra della Zucca"
   - "Festa del Radicchio - Creazzo (VI) - 15-17 marzo" → "Festa del Radicchio"
   - Se il titolo è già pulito ("Sagra della Zucca"), lascialo così
   - Usa maiuscole corrette in italiano
   - Max 80 caratteri

4. **city**: il COMUNE/PAESE dove si svolge la sagra. Estrailo da titolo ("...a Tribano", "...di Creazzo", "– Caorle") o da location_text. NON usare il nome della provincia (Padova, Verona ecc.) se nel titolo c'è un paese specifico.

5. **province_code**: codice provincia 2 lettere (BL/PD/RO/TV/VE/VI/VR) o null se non in Veneto.

6. **start_date**: data inizio in formato YYYY-MM-DD. Estraila da titolo, description, o qualsiasi campo. Anno corrente = 2026 se non specificato. null se non determinabile.

7. **end_date**: data fine YYYY-MM-DD. Se evento di un solo giorno = uguale a start_date. null se non determinabile.

8. **food_tags**: array tag alimentari (max 3) SOLO da: ${FOOD_TAGS.join(", ")}
   Regole gastronomia veneta:
   - Pinza/Pinzin = "Pane" (NON dolci, è focaccia veneta)
   - Baccalà/Stoccafisso = "Pesce"
   - Asparago/Radicchio/Broccolo/Carciofo/Fagiolo/Bisi/Funghi = "Verdura"
   - Zucca = "Zucca" (tag dedicato, NON Verdura)
   - Gnocchi = "Prodotti Tipici"
   - Polenta = "Prodotti Tipici" (o "Carne" se con carne)
   - Se non chiaro = "Prodotti Tipici"
   NOTA: se la sagra è vegetariana (zucca, asparagi, radicchio, verdure) aggiungi ANCHE "Verdura" come secondo tag.

9. **feature_tags**: array (max 2) SOLO da: ${FEATURE_TAGS.join(", ")}
   - "Giostre" SOLO per grandi fiere con luna park

10. **description**: descrizione in italiano, SEMPRE presente, max 300 caratteri, coinvolgente e informativa.
    - Se c'è description originale: RIFORMULALA in italiano corretto e coinvolgente
    - Se non c'è description: CREANE una credibile. Es: "Vieni a gustare polenta e baccalà alla sagra di Salzano godendoti la fine dell'estate"
    - Menziona il cibo principale, l'atmosfera, il luogo
    - Se c'è un menu nella description, riportalo come elenco breve
    - MAI lasciare vuota!

11. **unsplash_query**: 2-4 parole IN INGLESE per cercare FOTO DI CIBO.
    REGOLA: estrai il SOGGETTO ALIMENTARE dal titolo e traduci in inglese.
    Esempi: "Sagra del Pesce" → "fresh seafood platter", "Festa della Zucca" → "pumpkin soup autumn", "Festa della Bufala" → "buffalo mozzarella fresh Italian", "Sagra del Baccalà" → "salt cod Italian dish"
    VIETATO: "festival", "party", "celebration", "market", "outdoor", "village". OGNI query DEVE avere un ALIMENTO SPECIFICO.

EVENTI:
${JSON.stringify(batch)}

Rispondi con array JSON: [{id, is_sagra, confidence, clean_title, city, province_code, start_date, end_date, food_tags, feature_tags, description, unsplash_query}]`;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// =============================================================================
// Type definitions
// =============================================================================

interface SagraForGeocode {
  id: string;
  title: string;
  location_text: string;
}

// Province capitals — if location_text is one of these, title might have a better city
const PROVINCE_CAPITALS = new Set([
  "belluno", "padova", "rovigo", "treviso", "venezia", "vicenza", "verona",
]);

/**
 * Extract the actual town/city from the sagra title.
 * Italian patterns:
 *   "Sagra del Radicchio a Creazzo"  → "Creazzo"
 *   "Festa della Zucca di Tribano"   → "Tribano"
 *   "Sagra del Pesce – Caorle"       → "Caorle"
 *   "Festa delle Ciliegie a Zovon di Vò" → "Zovon di Vò"
 */
function extractCityFromTitle(title: string): string | null {
  // Pattern 1: "... a CityName" (most reliable — "a" = "at/in")
  const patternA = title.match(
    /\ba\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|delle|dei|d['']\s*|in|al|sul|sopra|sotto)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i
  );
  if (patternA) return patternA[1].trim();

  // Pattern 2: "... – CityName" or "... - CityName" at end
  const patternDash = title.match(
    /\s*[–—-]\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|delle|dei|d['']\s*)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/
  );
  if (patternDash) return patternDash[1].trim();

  // Pattern 3: last "di CityName" at end of title
  const patternDi = title.match(
    /\bdi\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:di|del|della|d['']\s*)\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*$/i
  );
  if (patternDi) {
    const candidate = patternDi[1].trim();
    if (!/^(San\s|Santa\s|Santo\s|S\.\s)/i.test(candidate) || candidate.split(/\s+/).length > 2) {
      return candidate;
    }
  }

  return null;
}

/**
 * If location_text is a generic province capital, try to extract a more
 * specific city from the title. Prevents all sagre being geocoded to province center.
 */
function refineCityFromTitle(locationText: string, title: string): string {
  const locLower = locationText.toLowerCase().trim();
  if (!PROVINCE_CAPITALS.has(locLower)) return locationText;

  const cityFromTitle = extractCityFromTitle(title);
  if (cityFromTitle && cityFromTitle.toLowerCase() !== locLower) {
    console.log(`[geocode] Refined city: "${locationText}" → "${cityFromTitle}" (from title: "${title}")`);
    return cityFromTitle;
  }
  return locationText;
}

interface SagraForLLM {
  id: string;
  title: string;
  location_text: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface EnrichmentResult {
  id: string;
  is_sagra: boolean;
  confidence: number;
  clean_title: string;
  city?: string;
  province_code?: string;
  start_date?: string;
  end_date?: string;
  food_tags: string[];
  feature_tags: string[];
  description: string;
  unsplash_query?: string;
}

// =============================================================================
// Pass 1: Geocoding — status: pending_geocode → pending_llm (or geocode_failed)
// =============================================================================

async function runGeocodePass(
  supabase: SupabaseClient
): Promise<{ geocoded: number; failed: number }> {
  let geocoded = 0;
  let failed = 0;

  const { data: rows } = await supabase
    .from("sagre")
    .select("id, title, location_text")
    .eq("status", "pending_geocode")
    .limit(GEOCODE_LIMIT)
    .order("created_at", { ascending: true });

  if (!rows?.length) return { geocoded, failed };

  for (const sagra of rows as SagraForGeocode[]) {
    // CRITICAL: if location_text is a province capital, extract actual town from title
    const refinedLocation = refineCityFromTitle(sagra.location_text ?? "", sagra.title ?? "");
    const city = cleanCityName(refinedLocation);
    if (!city) {
      // Cannot geocode — move to LLM pass anyway
      await supabase.from("sagre").update({
        status: "geocode_failed",
        updated_at: new Date().toISOString(),
      }).eq("id", sagra.id);
      failed++;
      continue;
    }

    const params = new URLSearchParams({
      q: city,
      countrycodes: "it",
      format: "json",
      limit: "1",
      addressdetails: "1",
      viewbox: VENETO_VIEWBOX,
      bounded: "1",
    });

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            "User-Agent": "Nemovia/1.0 (+https://nemovia.it)",
            "Accept-Language": "it",
          },
        }
      );

      if (resp.ok) {
        const results = await resp.json();
        if (results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);

          if (isValidItalyCoord(lat, lon)) {
            // Extract province from addressdetails if available
            const addr = results[0].address ?? {};
            const rawProvince = addr.county ?? addr.province ?? addr.state_district ?? null;
            const province = normalizeProvinceCode(rawProvince);

            // normalizeProvinceCode only maps Veneto provinces,
            // so non-null result = definitely Veneto
            if (province) {
              // Veneto sagra — geocode and continue to LLM enrichment
              const updateData: Record<string, unknown> = {
                location: `SRID=4326;POINT(${lon} ${lat})`,  // PostGIS WKT: LON LAT order
                province: province,
                status: "pending_llm",
                updated_at: new Date().toISOString(),
              };
              // Also update location_text if we refined it from title
              if (refinedLocation !== (sagra.location_text ?? "")) {
                updateData.location_text = refinedLocation;
              }
              await supabase.from("sagre").update(updateData).eq("id", sagra.id);
              geocoded++;
            } else {
              // Non-Veneto sagra — deactivate it
              console.log(`Non-Veneto sagra deactivated: ${sagra.id} (raw province: ${rawProvince})`);
              await supabase.from("sagre").update({
                location: `SRID=4326;POINT(${lon} ${lat})`,
                province: rawProvince,
                is_active: false,
                status: "geocode_failed",
                updated_at: new Date().toISOString(),
              }).eq("id", sagra.id);
              failed++;
            }
          } else {
            // Coordinates outside Italy bounding box — treat as failed
            await supabase.from("sagre").update({
              status: "geocode_failed",
              updated_at: new Date().toISOString(),
            }).eq("id", sagra.id);
            failed++;
          }
        } else {
          // Nominatim returned no results
          await supabase.from("sagre").update({
            status: "geocode_failed",
            updated_at: new Date().toISOString(),
          }).eq("id", sagra.id);
          failed++;
        }
      } else {
        // HTTP error from Nominatim — skip this sagra for now (retry next run)
        console.error(`Nominatim HTTP ${resp.status} for city: ${city}`);
      }
    } catch (err) {
      console.error(`Geocode fetch error for ${city}:`, err);
    }

    // Rate limit: 1 req/sec as required by Nominatim usage policy
    await sleep(SLEEP_MS);
  }

  return { geocoded, failed };
}

// =============================================================================
// Pass 2: LLM enrichment — status: pending_llm | geocode_failed → enriched
// =============================================================================

async function runLLMPass(
  supabase: SupabaseClient,
  ai: GoogleGenAI,
  startedAt?: number
): Promise<{ enriched: number; classified: number }> {
  let enriched = 0;
  let classified = 0; // non-sagra events deactivated

  // Time budget: leave 20s margin for image pass + logging + self-chain
  const hasTime = () => !startedAt || (Date.now() - startedAt) < (TIME_BUDGET_MS - 20_000);

  // Enrich both successfully geocoded sagre AND geocode-failed ones (tags/description are independent of GPS)
  const { data: rows } = await supabase
    .from("sagre")
    .select("id, title, location_text, description, start_date, end_date")
    .in("status", ["pending_llm", "geocode_failed"])
    .limit(LLM_LIMIT)
    .order("created_at", { ascending: true });

  if (!rows?.length) return { enriched, classified };

  const batches = chunkBatch(rows as SagraForLLM[], BATCH_SIZE);

  let retries = 0;
  for (let i = 0; i < batches.length; i++) {
    // Stop if time budget nearly exhausted
    if (!hasTime()) {
      console.log(`LLM pass: time budget reached after ${i}/${batches.length} batches (${enriched} enriched, ${classified} classified)`);
      break;
    }

    const batch = batches[i];

    // Rate limit: 15 RPM on Gemini free tier → wait 4.5s between calls
    if (i > 0) await sleep(4500);

    try {
      const prompt = buildEnrichmentPrompt(batch);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                is_sagra: { type: "BOOLEAN" },
                confidence: { type: "INTEGER" },
                clean_title: { type: "STRING" },
                city: { type: "STRING" },
                province_code: { type: "STRING" },
                start_date: { type: "STRING" },
                end_date: { type: "STRING" },
                food_tags: { type: "ARRAY", items: { type: "STRING" } },
                feature_tags: { type: "ARRAY", items: { type: "STRING" } },
                description: { type: "STRING" },
                unsplash_query: { type: "STRING" },
              },
              required: ["id", "is_sagra", "confidence", "clean_title", "food_tags", "feature_tags", "description", "unsplash_query"],
            },
          },
        },
      });

      const raw = JSON.parse(response.text) as EnrichmentResult[];

      // Blocklist: events that are NOT sagre regardless of LLM classification
      const BLOCKLIST_TITLES = ["vinitaly", "wine&food", "prowein"];
      // Pattern blocklist: aggregator/article titles
      const BLOCKLIST_PATTERNS = [
        /\b(sagre|eventi|feste|fiere)\s+(ed?|e|del|in|nel)\s+(eventi|sagre|feste|veneto|italia)/i,
        /\beventi\s+enogastronomic/i,
        /\b(le\s+sagre|le\s+feste|gli\s+eventi)\s+(di|del|da|più)\b/i,
        /\b(cosa\s+fare|dove\s+andare)\b/i,
      ];

      // Write each enriched event back to DB
      for (const result of raw) {
        const matchedSagra = batch.find((s: { id: string }) => s.id === result.id);
        const titleLower = (matchedSagra?.title ?? "").toLowerCase();
        const isBlocklisted = BLOCKLIST_TITLES.some((b: string) => titleLower.includes(b))
          || BLOCKLIST_PATTERNS.some((p: RegExp) => p.test(titleLower));

        const confidence = typeof result.confidence === "number" ? Math.min(100, Math.max(0, result.confidence)) : 50;

        // NOT a sagra, or blocklisted, or confidence too low → discard
        if (result.is_sagra === false || isBlocklisted || confidence < 30) {
          await supabase.from("sagre").update({
            is_active: false,
            status: "classified_non_sagra",
            confidence,
            review_status: "discarded",
            updated_at: new Date().toISOString(),
          }).eq("id", result.id);
          classified++;
          console.log(`Discarded: ${matchedSagra?.title} (confidence=${confidence}, is_sagra=${result.is_sagra})`);
          continue;
        }

        // Valid sagra — enrich with all Gemini data
        const food_tags = validateTags(result.food_tags ?? [], FOOD_TAGS).slice(0, 3);
        const feature_tags = validateTags(result.feature_tags ?? [], FEATURE_TAGS).slice(0, 2);
        const description = (result.description ?? "").slice(0, 500) || null;
        const unsplash_query = (result.unsplash_query ?? "").slice(0, 60) || null;
        const clean_title = (result.clean_title ?? "").slice(0, 100) || matchedSagra?.title || "";

        // Determine if this sagra has enough data to be active
        const hasDate = !!(result.start_date || matchedSagra?.start_date);
        const isHighConfidence = confidence >= 70;

        // Review status: auto_approved if high confidence + has date, else needs_review
        let review_status: string;
        if (isHighConfidence && hasDate) {
          review_status = "auto_approved";
        } else {
          review_status = "needs_review";
        }

        const updateData: Record<string, unknown> = {
          title: clean_title,
          food_tags,
          feature_tags,
          enhanced_description: description,
          source_description: description, // Also set source_description for detail page
          unsplash_query,
          confidence,
          review_status,
          is_active: review_status === "auto_approved",
          status: "enriched",
          updated_at: new Date().toISOString(),
        };

        // Update city if Gemini found a more specific one
        if (result.city && result.city.length > 2) {
          updateData.location_text = result.city;
        }

        // Update province if Gemini detected it
        if (result.province_code && /^(BL|PD|RO|TV|VE|VI|VR)$/i.test(result.province_code)) {
          updateData.province = result.province_code.toUpperCase();
        }

        // Update dates if Gemini extracted them and sagra didn't have them
        if (result.start_date && /^\d{4}-\d{2}-\d{2}$/.test(result.start_date)) {
          if (!matchedSagra?.start_date) {
            updateData.start_date = result.start_date;
          }
        }
        if (result.end_date && /^\d{4}-\d{2}-\d{2}$/.test(result.end_date)) {
          if (!matchedSagra?.end_date) {
            updateData.end_date = result.end_date;
          }
        }

        await supabase.from("sagre").update(updateData).eq("id", result.id);
        enriched++;
        console.log(`Enriched: "${clean_title}" conf=${confidence} review=${review_status}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("LLM batch enrichment error:", errMsg);

      // If rate limited (429), wait 60s and retry (max 3 retries)
      if ((errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("exceeded")) && retries < 3) {
        retries++;
        console.log(`Rate limited by Gemini (retry ${retries}/3), waiting 60s...`);
        await sleep(60_000);
        i--; // retry same batch
        continue;
      }
      // Other errors: skip batch, continue
    }
  }

  return { enriched, classified };
}

// =============================================================================
// Pass 3: Unsplash image assignment — batch-by-tag strategy
// Instead of 1 API call per sagra (N calls), groups sagre by food tag and
// fetches photos once per tag (~9-10 calls), then distributes from the pool.
// This allows assigning images to 100-200+ sagre using only ~10 API calls,
// well within the 50 req/hr demo tier limit.
// =============================================================================

interface SagraForUnsplash {
  id: string;
  title: string;
  food_tags: string[] | null;
  image_url: string | null;
  unsplash_query: string | null;
}

// =============================================================================
// Low-quality image URL detection — inline copy of isLowQualityUrl()
// from src/lib/fallback-images.ts (Edge Functions cannot import from src/)
// =============================================================================

const BAD_IMAGE_PATTERNS: RegExp[] = [
  // Tracking pixels and spacer GIFs
  /spacer\.(gif|png)/i,
  /pixel\.(gif|png)/i,
  /1x1\.(gif|png|jpg)/i,
  /blank\.(gif|png|jpg)/i,
  /transparent\.(gif|png)/i,

  // Common placeholder / default image filenames
  /no[-_]?image/i,
  /no[-_]?photo/i,
  /no[-_]?pic/i,
  /default[-_]?(image|img|photo|thumb)/i,
  /placeholder/i,
  /coming[-_]?soon/i,
  /image[-_]?not[-_]?found/i,
  /missing[-_]?(image|photo)/i,

  // Site logos and branding (not event photos)
  /\blogo[-_]?(sito|site|header|footer|main)?\b.*\.(png|jpg|svg|gif|webp)$/i,
  /\bfavicon\b/i,
  /\bicon[-_]?\d*\.(png|ico|svg)/i,

  // WordPress placeholder patterns
  /wp-content\/plugins\/.*placeholder/i,
  /woocommerce-placeholder/i,

  // Data URIs
  /^data:image/i,

  // Very small dimension indicators in URL
  /[?&]w=([1-9]\d?|1[0-4]\d|150)(&|$)/,
  /[?&]h=([1-9]\d?|1[0-4]\d|150)(&|$)/,
  /-(\d{1,2}|1[0-4]\d|150)x(\d{1,2}|1[0-4]\d|150)\.\w+$/,
];

function isLowQualityUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

// Italian food word → English Unsplash query (for title-based fallback in Pass 3)
const ITALIAN_FOOD_TRANSLATIONS: Record<string, string> = {
  "radicchio": "radicchio red chicory Italian",
  "asparago": "fresh green asparagus dish",
  "asparagi": "fresh green asparagus dish",
  "zucca": "pumpkin soup autumn harvest",
  "zucche": "pumpkin soup autumn harvest",
  "fagiolo": "Italian bean soup rustic",
  "fagioli": "Italian bean soup rustic",
  "funghi": "porcini mushroom Italian dish",
  "fungo": "porcini mushroom Italian dish",
  "pesce": "fresh seafood platter Mediterranean",
  "baccalà": "salt cod Italian dish",
  "stoccafisso": "salt cod Italian dish",
  "vino": "wine glass vineyard sunset",
  "olio": "olive oil pouring bread",
  "polenta": "Italian polenta mountain dish",
  "gnocchi": "Italian gnocchi potato pasta",
  "gnocco": "Italian gnocchi potato pasta",
  "salsiccia": "Italian sausage grilled outdoor",
  "carne": "grilled meat outdoor Italian barbecue",
  "dolci": "Italian pastry dessert table",
  "formaggio": "Italian cheese board rustic",
  "formaggi": "Italian cheese board rustic",
  "pinza": "Italian focaccia flatbread rustic",
  "riso": "Italian risotto rice dish",
  "birra": "craft beer outdoor festival",
  "oca": "roasted goose Italian dish",
  "anatra": "roasted duck Italian dish",
  "castagne": "roasted chestnuts autumn",
  "castagna": "roasted chestnuts autumn",
  "mele": "fresh apples harvest autumn",
  "mela": "fresh apples harvest autumn",
  "ciliegia": "fresh cherries harvest",
  "ciliegie": "fresh cherries harvest",
  "fragola": "fresh strawberries Italian",
  "fragole": "fresh strawberries Italian",
  "tartufo": "Italian truffle dish",
  "prosciutto": "Italian prosciutto ham cutting",
  "salame": "Italian salami cured meat",
  "pane": "Italian bread rustic bakery",
  "pasta": "fresh Italian pasta homemade",
  "pizza": "Italian pizza wood oven",
  "trippa": "Italian tripe stew",
  "lumache": "Italian snail dish",
  "rane": "fried frog legs Italian",
  "broccolo": "broccoli Italian dish",
  "broccoli": "broccoli Italian dish",
  "carciofo": "Italian artichoke dish",
  "carciofi": "Italian artichoke dish",
  "bisi": "Italian peas risotto spring",
  "piselli": "Italian peas dish",
  "primavera": "spring countryside Italian village",
  "pasqua": "Easter spring flowers Italian",
  "salute": "Italian autumn harvest festival",
};

/**
 * Build an Unsplash query from the sagra title when unsplash_query is NULL.
 * Extracts the food keyword from "Sagra del/della X" or "Festa del/della X".
 * Falls back to TAG_QUERIES if no keyword is recognized.
 */
function buildQueryFromTitle(title: string, foodTags: string[] | null): string {
  // Try to extract the subject from title patterns
  const match = title.match(
    /(?:sagra|festa|fiera|rassegna)\s+d(?:el|ella|elle|ei|egli|ell'|i\s)\s*(.+)/i
  );

  if (match) {
    const subject = match[1].trim().toLowerCase()
      .replace(/\s*[&"'].*/i, "") // strip trailing junk
      .replace(/\s+e\s+.*/i, ""); // strip "e qualcosa"

    // Check each word in the subject against translations
    const words = subject.split(/\s+/);
    for (const word of words) {
      const clean = word.replace(/[^a-zàèéìòù]/gi, "");
      if (ITALIAN_FOOD_TRANSLATIONS[clean]) {
        return ITALIAN_FOOD_TRANSLATIONS[clean];
      }
    }

    // If we extracted a subject but couldn't translate, use it directly
    // (Unsplash often understands Italian food words)
    if (subject.length >= 3 && subject.length <= 30) {
      return `${subject} Italian food`;
    }
  }

  // Fallback: use TAG_QUERIES mapping by first food tag
  const firstTag = foodTags?.[0];
  if (firstTag && TAG_QUERIES[firstTag]) return TAG_QUERIES[firstTag];

  // Last resort: use title itself as search
  const shortTitle = title.slice(0, 30).trim();
  return `${shortTitle} Italian festival`;
}

interface UnsplashPhoto {
  urls: { raw: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

/**
 * Fetch photos from Unsplash for a given query string.
 * Returns the photo array and whether the rate limit is critically low.
 */
async function fetchUnsplashPhotos(
  query: string,
  perPage: number = UNSPLASH_PER_PAGE
): Promise<{ photos: UnsplashPhoto[]; rateLimitLow: boolean; error: boolean }> {
  const params = new URLSearchParams({
    query,
    orientation: "landscape",
    per_page: String(perPage),
    content_filter: "high",
  });

  const resp = await fetch(
    `https://api.unsplash.com/search/photos?${params}`,
    {
      headers: {
        "Authorization": `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
    }
  );

  if (!resp.ok) {
    console.error(`Unsplash API error: HTTP ${resp.status} for query: ${query}`);
    return { photos: [], rateLimitLow: resp.status === 403, error: true };
  }

  const remaining = parseInt(resp.headers.get("X-Ratelimit-Remaining") ?? "50", 10);
  const rateLimitLow = remaining < 5;
  if (rateLimitLow) {
    console.log(`Unsplash rate limit low (${remaining} remaining) after query: ${query}`);
  }

  const data = await resp.json();
  return { photos: (data.results ?? []) as UnsplashPhoto[], rateLimitLow, error: false };
}

// =============================================================================
// Pexels Image API — fallback when Unsplash returns 0 results
// =============================================================================

interface PexelsPhoto {
  src: { large2x: string; large: string; medium: string };
  photographer: string;
  photographer_url: string;
}

/**
 * Fetch photos from Pexels for a given query string.
 * Used as fallback when Unsplash returns 0 results for a query.
 * Pexels free tier: 200 req/hr (4x more than Unsplash).
 */
async function fetchPexelsPhotos(
  query: string,
  perPage: number = PEXELS_PER_PAGE
): Promise<{ photos: PexelsPhoto[]; rateLimitLow: boolean; error: boolean }> {
  if (!PEXELS_API_KEY) {
    return { photos: [], rateLimitLow: false, error: true };
  }

  const params = new URLSearchParams({
    query,
    orientation: "landscape",
    per_page: String(perPage),
  });

  const resp = await fetch(
    `https://api.pexels.com/v1/search?${params}`,
    { headers: { Authorization: PEXELS_API_KEY } }
  );

  if (!resp.ok) {
    console.error(`Pexels API error: HTTP ${resp.status} for query: ${query}`);
    return { photos: [], rateLimitLow: resp.status === 429, error: true };
  }

  const remaining = parseInt(resp.headers.get("X-Ratelimit-Remaining") ?? "200", 10);
  const rateLimitLow = remaining < 10;
  if (rateLimitLow) {
    console.log(`Pexels rate limit low (${remaining} remaining) after query: ${query}`);
  }

  const data = await resp.json();
  return { photos: (data.photos ?? []) as PexelsPhoto[], rateLimitLow, error: false };
}

/**
 * Convert a Pexels photo to the same image_url/image_credit format used by Unsplash.
 * Uses large (940px) for good quality without being too heavy.
 */
function pickPexelsPhotoForSagra(photos: PexelsPhoto[], sagraId: string): { imageUrl: string; imageCredit: string } {
  // Use same hash-based picking as Unsplash for deterministic variety
  let hash = 0;
  for (let i = 0; i < sagraId.length; i++) {
    hash = ((hash << 5) - hash + sagraId.charCodeAt(i)) | 0;
  }
  const picked = photos[Math.abs(hash) % photos.length];
  return {
    imageUrl: picked.src.large,  // 940px wide
    imageCredit: `${picked.photographer}|${picked.photographer_url}?utm_source=nemovia&utm_medium=referral`,
  };
}

/**
 * Pick a photo from a pool, using a hash of the sagra ID for deterministic variety.
 * Returns a different photo for each sagra even when they share the same tag.
 */
function pickPhotoForSagra(photos: UnsplashPhoto[], sagraId: string): UnsplashPhoto {
  // Simple hash for deterministic distribution across the pool
  let hash = 0;
  for (let i = 0; i < sagraId.length; i++) {
    hash = ((hash << 5) - hash + sagraId.charCodeAt(i)) | 0;
  }
  return photos[Math.abs(hash) % photos.length];
}

async function runUnsplashPass(
  supabase: SupabaseClient
): Promise<number> {
  // Graceful skip when UNSPLASH_ACCESS_KEY is not configured
  if (!UNSPLASH_ACCESS_KEY) {
    console.log("UNSPLASH_ACCESS_KEY not set, skipping Unsplash pass");
    return 0;
  }

  let assigned = 0;

  // Fetch all enriched sagre without images (up to UNSPLASH_LIMIT)
  // Query 1: sagre with NULL image_url
  const { data: nullRows } = await supabase
    .from("sagre")
    .select("id, title, food_tags, image_url, unsplash_query")
    .is("image_url", null)
    .eq("status", "enriched")
    .eq("review_status", "auto_approved")
    .order("created_at", { ascending: true })
    .limit(UNSPLASH_LIMIT);

  // Query 2: sagre with non-null image_url that may be low-quality
  // We fetch ALL enriched sagre with images and filter client-side for bad URLs,
  // since Supabase doesn't support regex filtering
  const { data: imageRows } = await supabase
    .from("sagre")
    .select("id, title, food_tags, image_url, unsplash_query")
    .not("image_url", "is", null)
    .eq("review_status", "auto_approved")
    .eq("status", "enriched")
    .order("created_at", { ascending: true })
    .limit(UNSPLASH_LIMIT);

  // Filter imageRows for low-quality URLs only (skip Unsplash URLs — those are already good)
  const lowQualityRows = (imageRows ?? []).filter((row: SagraForUnsplash) => {
    // Never replace Unsplash images (they're the fallback source!)
    if (row.image_url && row.image_url.includes("images.unsplash.com")) return false;
    return isLowQualityUrl(row.image_url);
  });

  const allRows = [...(nullRows ?? []), ...lowQualityRows].slice(0, UNSPLASH_LIMIT);

  if (!allRows.length) return 0;

  const sagre = allRows as SagraForUnsplash[];
  console.log(`Unsplash pass: ${sagre.length} sagre need images (${(nullRows ?? []).length} null, ${lowQualityRows.length} low-quality)`);

  // Step 1: Group sagre by Unsplash search query
  // Priority: LLM-generated unsplash_query > title-based query > TAG_QUERIES > default
  const queryGroups = new Map<string, SagraForUnsplash[]>();
  for (const sagra of sagre) {
    let queryKey: string;
    if (sagra.unsplash_query) {
      // Use Gemini-generated query (most specific)
      queryKey = sagra.unsplash_query.trim().toLowerCase();
    } else {
      // Fallback: build query from title (extracts food keyword → English translation)
      queryKey = buildQueryFromTitle(sagra.title, sagra.food_tags);
    }
    const group = queryGroups.get(queryKey) ?? [];
    group.push(sagra);
    queryGroups.set(queryKey, group);
  }

  console.log(`Unsplash pass: ${queryGroups.size} unique query groups to fetch`);

  // Step 2: For each unique query, fetch photos once and distribute to all matching sagre
  // Photo cache: reuse across queries to avoid re-fetching
  const photoCache = new Map<string, UnsplashPhoto[]>();
  // Track sagre where Gemini query returned 0 results — retry with buildQueryFromTitle()
  const retryWithTitleQuery: SagraForUnsplash[] = [];
  let rateLimitExhausted = false;

  for (const [queryKey, groupSagre] of queryGroups) {
    const query = queryKey;

    // Check if we already have photos for this query (e.g. multiple tags mapping to same query)
    let photos = photoCache.get(query);
    if (!photos) {
      try {
        const result = await fetchUnsplashPhotos(query);

        if (result.error && result.rateLimitLow) {
          // Rate limited — stop the entire pass
          console.log("Unsplash rate limit hit, stopping pass");
          rateLimitExhausted = true;
          break;
        }

        if (result.error) {
          // Non-rate-limit error — skip this tag group, try next
          await sleep(UNSPLASH_SLEEP_MS);
          continue;
        }

        photos = result.photos;
        photoCache.set(query, photos);

        if (photos.length === 0) {
          console.log(`No Unsplash results for query: ${query}, trying Pexels...`);
          // Try Pexels as fallback before queuing for title-based retry
          const pexelsResult = await fetchPexelsPhotos(query);
          await sleep(UNSPLASH_SLEEP_MS);
          if (!pexelsResult.error && pexelsResult.photos.length > 0) {
            // Pexels found results — assign directly
            console.log(`Pexels found ${pexelsResult.photos.length} photos for query: ${query}`);
            for (const sagra of groupSagre) {
              const { imageUrl, imageCredit } = pickPexelsPhotoForSagra(pexelsResult.photos, sagra.id);
              await supabase.from("sagre").update({
                image_url: imageUrl,
                image_credit: imageCredit,
                updated_at: new Date().toISOString(),
              }).eq("id", sagra.id);
              assigned++;
            }
            console.log(`Pexels: assigned ${groupSagre.length} images for query: ${query}`);
            continue;
          }
          // Both Unsplash and Pexels returned 0 — queue for title-based fallback retry
          retryWithTitleQuery.push(...groupSagre.filter(s => s.unsplash_query));
          continue;
        }

        // Track whether we should stop after this group
        const shouldStopAfterGroup = result.rateLimitLow;
        if (shouldStopAfterGroup) {
          console.log("Rate limit low — will assign photos for this group then stop");
        }

        // Courtesy delay between API calls
        await sleep(UNSPLASH_SLEEP_MS);
      } catch (err) {
        console.error(`Unsplash fetch error for query ${query}:`, err);
        await sleep(UNSPLASH_SLEEP_MS);
        continue;
      }
    }

    if (!photos || photos.length === 0) continue;

    // Step 3: Assign a photo to each sagra in this group (no additional API calls)
    for (const sagra of groupSagre) {
      const photo = pickPhotoForSagra(photos, sagra.id);

      const imageUrl = `${photo.urls.raw}&w=800&h=500&fit=crop&q=80`;
      const imageCredit = `${photo.user.name}|${photo.user.links.html}?utm_source=nemovia&utm_medium=referral`;

      await supabase.from("sagre").update({
        image_url: imageUrl,
        image_credit: imageCredit,
        updated_at: new Date().toISOString(),
      }).eq("id", sagra.id);

      assigned++;

      // Fire download tracking (Unsplash API requirement) — fire and forget
      fetch(`${photo.links.download_location}?client_id=${UNSPLASH_ACCESS_KEY}`).catch(() => {});
    }

    console.log(`Assigned ${groupSagre.length} images for query: ${queryKey}`);
  }

  // =========================================================================
  // RETRY PHASE: sagre where Gemini query returned 0 results
  // Fall back to buildQueryFromTitle() which extracts food keywords from title
  // =========================================================================
  if (retryWithTitleQuery.length > 0 && !rateLimitExhausted) {
    const retryGroups = new Map<string, SagraForUnsplash[]>();
    for (const sagra of retryWithTitleQuery) {
      const fbQuery = buildQueryFromTitle(sagra.title, sagra.food_tags).toLowerCase();
      // Skip if the fallback query is the same as the failed Gemini query
      if (fbQuery === (sagra.unsplash_query ?? "").trim().toLowerCase()) continue;
      const group = retryGroups.get(fbQuery) ?? [];
      group.push(sagra);
      retryGroups.set(fbQuery, group);
    }

    if (retryGroups.size > 0) {
      console.log(`Retry phase: ${retryWithTitleQuery.length} sagre → ${retryGroups.size} title-based fallback queries`);

      for (const [queryKey, groupSagre] of retryGroups) {
        let photos = photoCache.get(queryKey);
        if (!photos) {
          try {
            const result = await fetchUnsplashPhotos(queryKey);

            if (result.error && result.rateLimitLow) {
              console.log("Unsplash rate limit hit during retry, stopping");
              break;
            }
            if (result.error) {
              await sleep(UNSPLASH_SLEEP_MS);
              continue;
            }

            photos = result.photos;
            photoCache.set(queryKey, photos);

            if (photos.length === 0) {
              console.log(`No Unsplash results for fallback query: ${queryKey}, trying Pexels...`);
              const pexelsResult = await fetchPexelsPhotos(queryKey);
              await sleep(UNSPLASH_SLEEP_MS);
              if (!pexelsResult.error && pexelsResult.photos.length > 0) {
                console.log(`Pexels found ${pexelsResult.photos.length} photos for retry query: ${queryKey}`);
                for (const sagra of groupSagre) {
                  const { imageUrl, imageCredit } = pickPexelsPhotoForSagra(pexelsResult.photos, sagra.id);
                  await supabase.from("sagre").update({
                    image_url: imageUrl,
                    image_credit: imageCredit,
                    updated_at: new Date().toISOString(),
                  }).eq("id", sagra.id);
                  assigned++;
                }
                console.log(`Pexels retry: assigned ${groupSagre.length} images for query: ${queryKey}`);
                continue;
              }
              continue;
            }

            if (result.rateLimitLow) {
              console.log("Rate limit low — will assign for this retry group then stop");
            }

            await sleep(UNSPLASH_SLEEP_MS);
          } catch (err) {
            console.error(`Unsplash fetch error for fallback query ${queryKey}:`, err);
            await sleep(UNSPLASH_SLEEP_MS);
            continue;
          }
        }

        if (!photos || photos.length === 0) continue;

        for (const sagra of groupSagre) {
          const photo = pickPhotoForSagra(photos, sagra.id);
          const imageUrl = `${photo.urls.raw}&w=800&h=500&fit=crop&q=80`;
          const imageCredit = `${photo.user.name}|${photo.user.links.html}?utm_source=nemovia&utm_medium=referral`;

          await supabase.from("sagre").update({
            image_url: imageUrl,
            image_credit: imageCredit,
            updated_at: new Date().toISOString(),
          }).eq("id", sagra.id);

          assigned++;
          fetch(`${photo.links.download_location}?client_id=${UNSPLASH_ACCESS_KEY}`).catch(() => {});
        }

        console.log(`Retry: assigned ${groupSagre.length} images for fallback query: ${queryKey}`);
      }
    }
  }

  console.log(`Unsplash pass complete: ${assigned} images assigned`);
  return assigned;
}

// =============================================================================
// Entry point — fire-and-forget pattern: return 200 immediately
// =============================================================================

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const resetMode = url.searchParams.get("reset"); // "all" | "images" | null
  const loopMode = url.searchParams.get("loop") === "true"; // self-chaining mode

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });

  // Handle reset modes BEFORE starting the pipeline
  if (resetMode === "all") {
    const { count } = await supabase
      .from("sagre")
      .update({ status: "pending_llm", updated_at: new Date().toISOString() })
      .eq("status", "enriched")
      .eq("is_active", true)
      .select("id", { count: "exact", head: true });
    console.log(`Reset ${count ?? 0} sagre to pending_llm for re-enrichment`);
  } else if (resetMode === "images") {
    const { count } = await supabase
      .from("sagre")
      .update({ image_url: null, image_credit: null, updated_at: new Date().toISOString() })
      .eq("is_active", true)
      .eq("status", "enriched")
      .like("image_url", "%images.unsplash.com%")
      .select("id", { count: "exact", head: true });
    console.log(`Reset ${count ?? 0} Unsplash images for re-assignment`);
  }

  // Fire-and-forget: return 200 immediately, work continues in background
  EdgeRuntime.waitUntil(runEnrichmentPipeline(supabase, ai, startedAt, loopMode));

  return new Response(
    JSON.stringify({ status: "started", reset: resetMode, loop: loopMode, timestamp: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

async function runEnrichmentPipeline(
  supabase: SupabaseClient,
  ai: GoogleGenAI,
  startedAt: number,
  loopMode: boolean = false,
) {
  let geocoded = 0;
  let geocodeFailed = 0;
  let llmEnriched = 0;
  let llmClassified = 0;
  let unsplashAssigned = 0;
  let errorMessage: string | null = null;
  let loops = 0;

  const elapsed = () => Date.now() - startedAt;
  const hasTimeBudget = () => elapsed() < TIME_BUDGET_MS;

  try {
    // LOOP until no more work or time budget exceeded
    while (hasTimeBudget()) {
      loops++;
      let didWork = false;

      // Pass 1: Geocoding (rate-limited by Nominatim, ~33s per 30 rows)
      if (hasTimeBudget()) {
        const r = await runGeocodePass(supabase);
        geocoded += r.geocoded;
        geocodeFailed += r.failed;
        if (r.geocoded + r.failed > 0) didWork = true;
      }

      // Pass 2: LLM enrichment (processes up to 200 per iteration)
      if (hasTimeBudget()) {
        const r = await runLLMPass(supabase, ai, startedAt);
        llmEnriched += r.enriched;
        llmClassified += r.classified;
        if (r.enriched + r.classified > 0) didWork = true;
      }

      // Pass 3: Image assignment (Unsplash primary + Pexels fallback)
      if (hasTimeBudget()) {
        const r = await runUnsplashPass(supabase);
        unsplashAssigned += r;
        if (r > 0) didWork = true;
      }

      // If no pass did any work, all queues are empty → done
      if (!didWork) {
        console.log(`All queues empty after ${loops} loop(s), stopping`);
        break;
      }

      console.log(`Loop ${loops} complete (${elapsed()}ms elapsed): geo=${geocoded}, llm=${llmEnriched}, img=${unsplashAssigned}`);
    }

    if (!hasTimeBudget()) {
      console.log(`Time budget exhausted after ${loops} loop(s) (${elapsed()}ms). Remaining work will be picked up by next cron invocation.`);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Enrichment pipeline error:", errorMessage);
  }

  // Log run to enrich_logs
  await supabase.from("enrich_logs").insert({
    geocoded_count: geocoded,
    geocode_failed: geocodeFailed,
    llm_count: llmEnriched,
    skipped_count: llmClassified,
    error_message: errorMessage,
    duration_ms: elapsed(),
    completed_at: new Date().toISOString(),
  });

  console.log(`Enrichment complete (${loops} loops, ${elapsed()}ms): geocoded=${geocoded}, geocode_failed=${geocodeFailed}, llm_enriched=${llmEnriched}, classified_non_sagra=${llmClassified}, unsplash_assigned=${unsplashAssigned}`);

  // Self-chaining: if loop mode enabled and there's still pending work, trigger another run
  if (loopMode && !errorMessage) {
    const { count: pendingGeo } = await supabase
      .from("sagre").select("id", { count: "exact", head: true }).eq("status", "pending_geocode");
    const { count: pendingLlm } = await supabase
      .from("sagre").select("id", { count: "exact", head: true }).in("status", ["pending_llm", "geocode_failed"]);
    const { count: pendingImg } = await supabase
      .from("sagre").select("id", { count: "exact", head: true }).eq("status", "enriched").is("image_url", null);

    const totalPending = (pendingGeo ?? 0) + (pendingLlm ?? 0) + (pendingImg ?? 0);
    console.log(`Loop mode: ${totalPending} pending (geo=${pendingGeo ?? 0}, llm=${pendingLlm ?? 0}, img=${pendingImg ?? 0})`);

    if (totalPending > 0) {
      // Wait 10s before self-triggering to avoid rate-limit issues
      await new Promise((r) => setTimeout(r, 10_000));

      const selfUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/enrich-sagre?loop=true`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      console.log(`Self-chaining: triggering next run (${totalPending} items remaining)...`);
      try {
        await fetch(selfUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
        });
        console.log("Self-chain trigger sent successfully");
      } catch (chainErr) {
        console.error("Self-chain trigger failed:", chainErr);
      }
    } else {
      console.log("Loop mode: all queues empty, chain complete!");
    }
  }
}
