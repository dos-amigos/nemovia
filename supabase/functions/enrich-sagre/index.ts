// =============================================================================
// enrich-sagre — Data Enrichment Edge Function
// Runs three sequential passes:
//   1. Geocoding pass: pending_geocode -> pending_llm (or geocode_failed)
//   2. LLM enrichment pass: pending_llm | geocode_failed -> enriched
//   3. Unsplash image pass: enriched with null image_url -> assigns Unsplash fallback
// Deploy to Supabase Dashboard (no Supabase CLI per project pattern)
// =============================================================================

import { GoogleGenAI } from "npm:@google/genai@1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const GEOCODE_LIMIT = 30;   // max rows to geocode per invocation (fits 50s timeout: 30s geocoding + 15s LLM + 5s overhead)
const LLM_LIMIT = 200;      // max sagre to enrich per invocation (25 batches of 8)
const SLEEP_MS = 1100;      // 1.1s between Nominatim calls (policy: 1 req/sec)
const VENETO_VIEWBOX = "10.62,44.79,13.10,46.68"; // Nominatim viewbox: lon_min,lat_min,lon_max,lat_max

// Pass 3: Unsplash image assignment (batch-by-tag strategy)
const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
const UNSPLASH_LIMIT = 200;     // max sagre to process per run (batch strategy uses ~9-10 API calls total)
const UNSPLASH_SLEEP_MS = 2000;  // 2s between calls (courtesy + safety margin)
const UNSPLASH_PER_PAGE = 30;    // max results per Unsplash API call (API max is 30)

// Inline copy of TAG_QUERIES from src/lib/unsplash.ts
// Edge Functions cannot import from the Next.js src/ directory.
const TAG_QUERIES: Record<string, string> = {
  "Pesce": "italian seafood festival",
  "Carne": "italian meat grill festival",
  "Vino": "italian wine festival",
  "Formaggi": "italian cheese market",
  "Funghi": "mushroom food festival",
  "Radicchio": "italian vegetable market",
  "Dolci": "italian dessert pastry",
  "Pane": "italian focaccia bread bakery",
  "Verdura": "italian vegetable market garden",
  "Prodotti Tipici": "italian food market",
};
const DEFAULT_UNSPLASH_QUERY = "italian sagra food festival";

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

const FOOD_TAGS = ["Pesce", "Carne", "Vino", "Formaggi", "Funghi", "Radicchio", "Dolci", "Pane", "Verdura", "Prodotti Tipici"] as const;
const FEATURE_TAGS = ["Gratis", "Musica", "Artigianato", "Bambini", "Tradizionale", "Giostre"] as const;
type FoodTag = typeof FOOD_TAGS[number];
type FeatureTag = typeof FEATURE_TAGS[number];
const BATCH_SIZE = 8;
const MAX_DESC_CHARS = 250;

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
 * Build the Italian-language Gemini prompt for a batch of events.
 * Includes is_sagra classification instruction (DQ-07/DQ-08).
 */
function buildEnrichmentPrompt(batch: SagraForLLM[]): string {
  return `Sei un esperto di sagre italiane e gastronomia veneta. Per ogni evento nella lista JSON, genera:
1. is_sagra: true se l'evento e una sagra, festa del cibo, o fiera gastronomica. false se e antiquariato, mostra, mercato generico, concerto, evento sportivo, o altro evento non gastronomico. Se l'evento ha una componente gastronomica significativa (cibo, degustazione, prodotti tipici), classificalo come sagra anche se ha altri elementi (musica, artigianato).
2. food_tags: array con i tag alimentari pertinenti (max 3) scelti SOLO da: ${FOOD_TAGS.join(", ")}
   ATTENZIONE alla gastronomia veneta:
   - "Pinza" e "Pinzin" veneti sono FOCACCE/PANE, NON dolci! Usa tag "Pane".
   - "Polenta" va in "Prodotti Tipici" o "Carne" se servita con carne.
   - "Baccalà" e "Stoccafisso" vanno in "Pesce".
   - "Asparago", "Radicchio", "Broccolo", "Carciofo", "Fagiolo" vanno in "Verdura".
   - "Zucca" ha il suo tag dedicato "Zucca" (NON "Verdura").
   - USA "Verdura" SOLO se il nome contiene un ortaggio specifico (asparago, radicchio, bisi, broccolo, carciofo, fagiolo, funghi). NON classificare come "Verdura" sagre generiche stagionali (es. "Festa di Primavera", "Sagra Paesana") — usa "Prodotti Tipici".
   - "Gnocchi" vanno in "Prodotti Tipici".
   - Se il cibo principale non rientra chiaramente in nessuna categoria specifica, usa "Prodotti Tipici".
3. feature_tags: array con i tag caratteristici (max 2) scelti SOLO da: ${FEATURE_TAGS.join(", ")}
   - "Giostre": usa SOLO per sagre/fiere grandi con luna park, giostre, attrazioni da fiera (es. Antica Fiera del Tresto, Antica Fiera del Soco). NON per sagre piccole o normali.
4. enhanced_description: descrizione coinvolgente in italiano, max ${MAX_DESC_CHARS} caratteri, che menzioni il cibo principale e l'atmosfera
5. unsplash_query: 2-3 parole IN INGLESE per cercare una BELLA foto su Unsplash. Deve evocare il CIBO/TEMA dell'evento in modo appetitoso e fotogenico. REGOLE IMPORTANTI:
   - VINO: usa "wine glass pouring", "red wine chalice vineyard", "wine tasting sunset". MAI bottiglie, MAI etichette, MAI cantine industriali.
   - OLIO: usa "olive oil pouring golden", "fresh olives harvest", "Italian olive grove". MAI macchinari, MAI depositi, MAI fabbriche.
   - CARNE: usa "grilled meat outdoor", "barbecue Italian festival". MAI carne cruda, MAI macelleria.
   - PINZA/FOCACCIA: usa "focaccia bread Italian rustic". MAI torte, MAI dolci.
   - GENERALE: cerca foto con luce calda, ambientazione rustica/all'aperto, piatti serviti. MAI foto industriali, MAI stock generici, MAI "italian sagra".
   Esempi: "pumpkin soup autumn" per Sagra della Zucca, "grilled sausage festival" per Sagra della Salsiccia.

EVENTI:
${JSON.stringify(batch)}

Rispondi con un array JSON, un oggetto per ogni evento con: id, is_sagra, food_tags, feature_tags, enhanced_description, unsplash_query.`;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// =============================================================================
// Type definitions
// =============================================================================

interface SagraForGeocode {
  id: string;
  location_text: string;
}

interface SagraForLLM {
  id: string;
  title: string;
  location_text: string;
  description: string | null;
}

interface EnrichmentResult {
  id: string;
  is_sagra: boolean;
  food_tags: string[];
  feature_tags: string[];
  enhanced_description: string;
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
    .select("id, location_text")
    .eq("status", "pending_geocode")
    .eq("is_active", true)
    .limit(GEOCODE_LIMIT)
    .order("created_at", { ascending: true });

  if (!rows?.length) return { geocoded, failed };

  for (const sagra of rows as SagraForGeocode[]) {
    const city = cleanCityName(sagra.location_text ?? "");
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
            const province = normalizeProvinceCode(addr.county ?? addr.province ?? addr.state_district ?? null);

            if (isVenetoProvince(province)) {
              // Veneto sagra — geocode and continue to LLM enrichment
              await supabase.from("sagre").update({
                location: `SRID=4326;POINT(${lon} ${lat})`,  // PostGIS WKT: LON LAT order
                province: province,
                status: "pending_llm",
                updated_at: new Date().toISOString(),
              }).eq("id", sagra.id);
              geocoded++;
            } else {
              // Non-Veneto sagra — deactivate it
              console.log(`Non-Veneto sagra deactivated: ${sagra.id} (province: ${province})`);
              await supabase.from("sagre").update({
                location: `SRID=4326;POINT(${lon} ${lat})`,
                province: province,
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
  ai: GoogleGenAI
): Promise<{ enriched: number; classified: number }> {
  let enriched = 0;
  let classified = 0; // non-sagra events deactivated

  // Enrich both successfully geocoded sagre AND geocode-failed ones (tags/description are independent of GPS)
  const { data: rows } = await supabase
    .from("sagre")
    .select("id, title, location_text, description")
    .in("status", ["pending_llm", "geocode_failed"])
    .eq("is_active", true)
    .limit(LLM_LIMIT)
    .order("created_at", { ascending: true });

  if (!rows?.length) return { enriched, classified };

  const batches = chunkBatch(rows as SagraForLLM[], BATCH_SIZE);

  for (const batch of batches) {
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
                food_tags: { type: "ARRAY", items: { type: "STRING" } },
                feature_tags: { type: "ARRAY", items: { type: "STRING" } },
                enhanced_description: { type: "STRING" },
                unsplash_query: { type: "STRING" },
              },
              required: ["id", "is_sagra", "food_tags", "feature_tags", "enhanced_description", "unsplash_query"],
            },
          },
        },
      });

      const raw = JSON.parse(response.text) as EnrichmentResult[];

      // Hardcoded blocklist: events that are NOT sagre regardless of LLM classification
      const BLOCKLIST_TITLES = ["vinitaly"];

      // Write each enriched event back to DB
      for (const result of raw) {
        // Check hardcoded blocklist FIRST (case-insensitive title match)
        const matchedSagra = batch.find((s: { id: string }) => s.id === result.id);
        const titleLower = (matchedSagra?.title ?? "").toLowerCase();
        const isBlocklisted = BLOCKLIST_TITLES.some((b: string) => titleLower.includes(b));

        // Check is_sagra classification FIRST — deactivate non-sagre
        if (result.is_sagra === false || isBlocklisted) {
          await supabase.from("sagre").update({
            is_active: false,
            status: "classified_non_sagra",
            updated_at: new Date().toISOString(),
          }).eq("id", result.id);
          classified++;
          console.log(`Non-sagra classified and deactivated: ${result.id}`);
          continue;
        }

        // Sagra (is_sagra === true or undefined for safety) — enrich as usual
        const food_tags = validateTags(result.food_tags ?? [], FOOD_TAGS).slice(0, 3);
        const feature_tags = validateTags(result.feature_tags ?? [], FEATURE_TAGS).slice(0, 2);
        const enhanced_description = truncateDescription(result.enhanced_description ?? "");
        const unsplash_query = (result.unsplash_query ?? "").slice(0, 60) || null;

        await supabase.from("sagre").update({
          food_tags,
          feature_tags,
          enhanced_description,
          unsplash_query,
          status: "enriched",
          updated_at: new Date().toISOString(),
        }).eq("id", result.id);

        enriched++;
      }
    } catch (err) {
      console.error("LLM batch enrichment error:", err);
      // Continue with next batch — partial enrichment is acceptable
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
    .select("id, food_tags, image_url, unsplash_query")
    .is("image_url", null)
    .eq("is_active", true)
    .eq("status", "enriched")
    .order("created_at", { ascending: true })
    .limit(UNSPLASH_LIMIT);

  // Query 2: sagre with non-null image_url that may be low-quality
  // We fetch ALL enriched sagre with images and filter client-side for bad URLs,
  // since Supabase doesn't support regex filtering
  const { data: imageRows } = await supabase
    .from("sagre")
    .select("id, food_tags, image_url, unsplash_query")
    .not("image_url", "is", null)
    .eq("is_active", true)
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
  // Priority: LLM-generated unsplash_query > TAG_QUERIES by food tag > default
  const queryGroups = new Map<string, SagraForUnsplash[]>();
  for (const sagra of sagre) {
    let queryKey: string;
    if (sagra.unsplash_query) {
      // Use Gemini-generated query (most specific)
      queryKey = sagra.unsplash_query.trim().toLowerCase();
    } else {
      // Fallback: use TAG_QUERIES mapping
      const firstTag = sagra.food_tags?.[0];
      queryKey = (firstTag && TAG_QUERIES[firstTag]) ? TAG_QUERIES[firstTag] : DEFAULT_UNSPLASH_QUERY;
    }
    const group = queryGroups.get(queryKey) ?? [];
    group.push(sagra);
    queryGroups.set(queryKey, group);
  }

  console.log(`Unsplash pass: ${queryGroups.size} unique query groups to fetch`);

  // Step 2: For each unique query, fetch photos once and distribute to all matching sagre
  // Photo cache: reuse across queries to avoid re-fetching
  const photoCache = new Map<string, UnsplashPhoto[]>();

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
          console.log(`No Unsplash results for query: ${query}`);
          await sleep(UNSPLASH_SLEEP_MS);
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
        console.error(`Unsplash fetch error for tag ${tagKey}:`, err);
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

  console.log(`Unsplash pass complete: ${assigned} images assigned`);
  return assigned;
}

// =============================================================================
// Entry point — fire-and-forget pattern: return 200 immediately
// =============================================================================

Deno.serve(async (_req) => {
  const startedAt = Date.now();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });

  // Fire-and-forget: return 200 immediately, work continues in background
  EdgeRuntime.waitUntil(runEnrichmentPipeline(supabase, ai, startedAt));

  return new Response(
    JSON.stringify({ status: "started", timestamp: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

async function runEnrichmentPipeline(
  supabase: SupabaseClient,
  ai: GoogleGenAI,
  startedAt: number
) {
  let geocoded = 0;
  let geocodeFailed = 0;
  let llmEnriched = 0;
  let llmClassified = 0; // non-sagra events deactivated
  let unsplashAssigned = 0;
  let errorMessage: string | null = null;

  try {
    // Pass 1: Geocoding — status: pending_geocode -> pending_llm (or geocode_failed)
    const geocodeResult = await runGeocodePass(supabase);
    geocoded = geocodeResult.geocoded;
    geocodeFailed = geocodeResult.failed;

    // Pass 2: LLM enrichment — status: pending_llm | geocode_failed -> enriched (or classified_non_sagra)
    const llmResult = await runLLMPass(supabase, ai);
    llmEnriched = llmResult.enriched;
    llmClassified = llmResult.classified;

    // Pass 3: Unsplash image assignment — enriched with null image_url -> image assigned
    const unsplashResult = await runUnsplashPass(supabase);
    unsplashAssigned = unsplashResult;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Enrichment pipeline error:", errorMessage);
  }

  // Log run to enrich_logs
  await supabase.from("enrich_logs").insert({
    geocoded_count: geocoded,
    geocode_failed: geocodeFailed,
    llm_count: llmEnriched,
    skipped_count: llmClassified, // repurpose skipped_count for classified non-sagre
    error_message: errorMessage,
    duration_ms: Date.now() - startedAt,
    completed_at: new Date().toISOString(),
  });

  console.log(`Enrichment complete: geocoded=${geocoded}, geocode_failed=${geocodeFailed}, llm_enriched=${llmEnriched}, classified_non_sagra=${llmClassified}, unsplash_assigned=${unsplashAssigned}, error=${errorMessage}`);
}
