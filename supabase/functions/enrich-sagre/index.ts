// =============================================================================
// enrich-sagre — Phase 3: Data Enrichment Edge Function
// Runs two sequential passes:
//   1. Geocoding pass: pending_geocode → pending_llm (or geocode_failed)
//   2. LLM enrichment pass: pending_llm | geocode_failed → enriched
// Deploy to Supabase Dashboard (no Supabase CLI per project pattern)
// =============================================================================

import { GoogleGenAI } from "npm:@google/genai@1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const GEOCODE_LIMIT = 30;   // max rows to geocode per invocation (fits 50s timeout: 30s geocoding + 15s LLM + 5s overhead)
const LLM_LIMIT = 200;      // max sagre to enrich per invocation (25 batches of 8)
const SLEEP_MS = 1100;      // 1.1s between Nominatim calls (policy: 1 req/sec)

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

const FOOD_TAGS = ["Pesce", "Carne", "Vino", "Formaggi", "Funghi", "Radicchio", "Dolci", "Prodotti Tipici"] as const;
const FEATURE_TAGS = ["Gratis", "Musica", "Artigianato", "Bambini", "Tradizionale"] as const;
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
  return `Sei un esperto di sagre italiane. Per ogni evento nella lista JSON, genera:
1. is_sagra: true se l'evento e una sagra, festa del cibo, o fiera gastronomica. false se e antiquariato, mostra, mercato generico, concerto, evento sportivo, o altro evento non gastronomico. Se l'evento ha una componente gastronomica significativa (cibo, degustazione, prodotti tipici), classificalo come sagra anche se ha altri elementi (musica, artigianato).
2. food_tags: array con i tag alimentari pertinenti (max 3) scelti SOLO da: ${FOOD_TAGS.join(", ")}
3. feature_tags: array con i tag caratteristici (max 2) scelti SOLO da: ${FEATURE_TAGS.join(", ")}
4. enhanced_description: descrizione coinvolgente in italiano, max ${MAX_DESC_CHARS} caratteri, che menzioni il cibo principale e l'atmosfera

EVENTI:
${JSON.stringify(batch)}

Rispondi con un array JSON, un oggetto per ogni evento con: id, is_sagra, food_tags, feature_tags, enhanced_description.`;
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
            const province = addr.county ?? addr.province ?? addr.state_district ?? null;

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
              },
              required: ["id", "is_sagra", "food_tags", "feature_tags", "enhanced_description"],
            },
          },
        },
      });

      const raw = JSON.parse(response.text) as EnrichmentResult[];

      // Write each enriched event back to DB
      for (const result of raw) {
        // Check is_sagra classification FIRST — deactivate non-sagre
        if (result.is_sagra === false) {
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

        await supabase.from("sagre").update({
          food_tags,
          feature_tags,
          enhanced_description,
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
  let errorMessage: string | null = null;

  try {
    // Pass 1: Geocoding — status: pending_geocode → pending_llm (or geocode_failed)
    const geocodeResult = await runGeocodePass(supabase);
    geocoded = geocodeResult.geocoded;
    geocodeFailed = geocodeResult.failed;

    // Pass 2: LLM enrichment — status: pending_llm | geocode_failed → enriched (or classified_non_sagra)
    const llmResult = await runLLMPass(supabase, ai);
    llmEnriched = llmResult.enriched;
    llmClassified = llmResult.classified;
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

  console.log(`Enrichment complete: geocoded=${geocoded}, geocode_failed=${geocodeFailed}, llm_enriched=${llmEnriched}, classified_non_sagra=${llmClassified}, error=${errorMessage}`);
}
