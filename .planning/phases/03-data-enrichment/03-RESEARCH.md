# Phase 3: Data Enrichment - Research

**Researched:** 2026-03-04
**Domain:** Nominatim geocoding + Gemini 2.5 Flash LLM enrichment + Supabase Edge Function pipeline
**Confidence:** HIGH (all critical claims verified against official docs and primary sources)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-03 | Geocoding automatico citta -> coordinate GPS via Nominatim (rate limit 1 req/sec) | Nominatim Search API confirmed: `q` + `countrycodes=it` + `format=json` returns `lat`/`lon`; 1 req/sec hard limit; must use custom User-Agent |
| PIPE-07 | LLM auto-tagging con Gemini 2.5 Flash: assegna food_tags e feature_tags a ogni sagra | `@google/genai` SDK confirmed: `responseMimeType: "application/json"` + `responseSchema` enforces typed array output; model ID `gemini-2.5-flash` |
| PIPE-08 | LLM arricchimento descrizioni: genera testo coinvolgente max 250 char per sagra | Same Gemini call as PIPE-07 — combine tags + description in one structured response per batch |
| PIPE-09 | Batching LLM: 5-10 eventi per prompt per rispettare limite 250 RPD free tier | 250 RPD confirmed (10 RPM). Batching 5-10 sagre/prompt keeps daily usage under budget: 100 sagre = 20 calls |
</phase_requirements>

---

## Summary

Phase 3 adds two enrichment layers to the existing scraping pipeline: GPS coordinates from Nominatim geocoding and LLM-generated tags + descriptions from Gemini 2.5 Flash. The scraper already inserts sagre with `status = 'pending_geocode'` — this phase processes that queue.

The architecture mirrors Phase 2: a new Supabase Edge Function `enrich-sagre` runs on a pg_cron schedule (2x/day matching the scraper cadence), queries for unenriched rows, geocodes each city name via Nominatim at exactly 1 req/sec, then batches 5-10 sagre per Gemini API call for tagging and description generation.

**Primary recommendation:** Build one Edge Function `enrich-sagre` with two sequential passes — geocoding first (rate-limited at 1 req/sec), then LLM enrichment (batched 5-10 per call). Use `status` column as the work queue: `pending_geocode` → `pending_llm` → `enriched`. This provides resilience: if the function is interrupted mid-run, the next scheduled invocation picks up where it left off.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | `npm:@google/genai@latest` | Gemini API calls in Deno Edge Function | Official Google JS SDK, replaces deprecated `@google/generative-ai`; confirmed working in Deno with `npm:` prefix |
| Nominatim public API | N/A (HTTP, no client library) | Forward geocoding city name → lat/lon | OSM Foundation-operated, free, no API key required, sufficient for 1 req/sec enrichment volume |
| `@supabase/supabase-js` | `npm:@supabase/supabase-js@2` | Supabase DB queries from Edge Function | Already in use in Phase 2 Edge Function |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Deno built-in `fetch` | N/A | HTTP calls to Nominatim | Already used in Phase 2 pattern; no extra dependency needed |
| `EdgeRuntime.waitUntil` | Deno Edge Runtime API | Fire-and-forget async work after 200 response | Same pattern used in Phase 2 `scrape-sagre` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nominatim public | OpenCage, Google Maps | Nominatim is free with no key; alternatives cost money or require billing setup |
| `@google/genai` native schema | Zod + `zod-to-json-schema` | Zod adds type safety but adds a dependency; Deno-native schema objects work without Zod and match the inline-type pattern already established in Phase 2 |
| Status column queue | Separate enrichment_queue table | Status column already exists in schema (`status TEXT DEFAULT 'pending_geocode'`) — use what's there |

**Installation (Deno Edge Function — no install needed, use `npm:` prefix in imports):**
```typescript
// In supabase/functions/enrich-sagre/index.ts
import { GoogleGenAI } from "npm:@google/genai@1";
import { createClient } from "npm:@supabase/supabase-js@2";
```

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/
├── functions/
│   ├── scrape-sagre/       # Phase 2 (existing)
│   │   └── index.ts
│   └── enrich-sagre/       # Phase 3 (new)
│       ├── index.ts        # Entry point + orchestrator
│       └── deno.json       # {"imports": {}} (same pattern as scrape-sagre)
├── migrations/
│   ├── 001_foundation.sql
│   ├── 002_scraping_pipeline.sql
│   └── 003_enrichment.sql  # Phase 3: status enum values, enrich_logs table, pg_cron schedules
```

### Pattern 1: Status-Column Work Queue

**What:** Use the existing `status` column as a lightweight work queue with three states.

**When to use:** When rows need multi-step processing that may be interrupted across invocations.

**State machine:**
```
[inserted by scraper] → status = 'pending_geocode'
[after geocoding]     → status = 'pending_llm'
[after LLM tagging]   → status = 'enriched'
[geocode failed]      → status = 'geocode_failed'  (skip to LLM with NULL coords)
```

**Query pattern:**
```typescript
// Source: established pattern from 001_foundation.sql + Phase 2 Edge Function
const { data: toGeocode } = await supabase
  .from("sagre")
  .select("id, location_text, province")
  .eq("status", "pending_geocode")
  .eq("is_active", true)
  .limit(200)  // cap per run to stay within Edge Function 50s timeout
  .order("created_at", { ascending: true });
```

### Pattern 2: Nominatim Geocoding with Rate Limiting

**What:** Forward-geocode `location_text` (city name) to lat/lon coordinates using Nominatim.

**When to use:** For every sagra with `status = 'pending_geocode'` and a non-empty `location_text`.

**Exact API endpoint:**
```
GET https://nominatim.openstreetmap.org/search
  ?q={city_name}
  &countrycodes=it
  &format=json
  &limit=1
```

**Required User-Agent** (from Nominatim usage policy — stock User-Agents forbidden):
```
Nemovia/1.0 (+https://nemovia.it)
```

**Rate limit enforcement:** 1 request per second hard limit. Use `await sleep(1000)` between calls.

**Example:**
```typescript
// Source: Nominatim official docs + Operations Policy
async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const params = new URLSearchParams({
    q: city,
    countrycodes: "it",
    format: "json",
    limit: "1",
  });
  const resp = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "User-Agent": "Nemovia/1.0 (+https://nemovia.it)",
        "Accept-Language": "it",
      },
    }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}
```

**Inserting coordinates into PostGIS geography column** (lon first, then lat):
```typescript
// Source: Supabase PostGIS docs — longitude comes first in ST_Point
await supabase.from("sagre").update({
  location: `${coords.lon} ${coords.lat}`,   // "LON LAT" space-separated string
  province: derivedProvince,
  status: "pending_llm",
  updated_at: new Date().toISOString(),
}).eq("id", sagra.id);
```

### Pattern 3: Batched LLM Tagging + Description

**What:** Send 5-10 sagre per Gemini API call to get `food_tags`, `feature_tags`, and `enhanced_description` for each.

**When to use:** After geocoding pass; query `status = 'pending_llm'`.

**Model:** `gemini-2.5-flash` (confirmed model ID for Google AI Studio free tier)

**Free tier budget math:**
- 250 RPD limit
- Batching 8 sagre/call → 31 calls to enrich 250 sagre
- 2x/day schedule → 62 calls/day max
- Leaves ~188 RPD headroom for retries/testing

**SDK initialization in Deno:**
```typescript
// Source: @google/genai npm page + js-genai GitHub README
import { GoogleGenAI } from "npm:@google/genai@1";

const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });
```

**Structured output schema (inline, no Zod dependency):**
```typescript
// Source: Google AI structured output docs (ai.google.dev/gemini-api/docs/structured-output)
const enrichmentSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      food_tags: {
        type: "ARRAY",
        items: { type: "STRING", enum: ["Pesce", "Carne", "Vino", "Formaggi", "Funghi", "Radicchio", "Dolci", "Prodotti Tipici"] },
      },
      feature_tags: {
        type: "ARRAY",
        items: { type: "STRING", enum: ["Gratis", "Musica", "Artigianato", "Bambini", "Tradizionale"] },
      },
      enhanced_description: { type: "STRING" },
    },
    required: ["id", "food_tags", "feature_tags", "enhanced_description"],
  },
};

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: promptText,
  config: {
    responseMimeType: "application/json",
    responseSchema: enrichmentSchema,
  },
});

const enriched = JSON.parse(response.text) as EnrichmentResult[];
```

**Prompt structure for Italian food events:**
```
Sei un esperto di sagre italiane. Per ogni sagra nella lista JSON, genera:
1. food_tags: array con i tag alimentari pertinenti (max 3) scelti SOLO da: Pesce, Carne, Vino, Formaggi, Funghi, Radicchio, Dolci, Prodotti Tipici
2. feature_tags: array con i tag caratteristici (max 2) scelti SOLO da: Gratis, Musica, Artigianato, Bambini, Tradizionale
3. enhanced_description: descrizione coinvolgente in italiano, max 250 caratteri

SAGRE: {JSON array of {id, title, location_text, description}}

Rispondi con un array JSON, un oggetto per ogni sagra, con id, food_tags, feature_tags, enhanced_description.
```

### Pattern 4: pg_cron Schedule for Enrichment

**What:** Trigger `enrich-sagre` Edge Function via `net.http_post()` on the same pattern as Phase 2's scraper.

**Schedule:** Twice daily, offset from scraper by 30 minutes to let scraped data land first:
```sql
-- Source: Phase 2 002_scraping_pipeline.sql pattern
SELECT cron.schedule(
  'enrich-sagre-morning',
  '30 6 * * *',   -- 30 min after scrape-sagre-morning (0 6 * * *)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/enrich-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);
```

### Anti-Patterns to Avoid

- **Parallel Nominatim requests:** Nominatim policy forbids multi-threaded/parallel requests. Always single-thread with sequential 1-second delays.
- **Geocoding every run:** Once a sagra has coordinates, never re-geocode it. The status column prevents this — only query `status = 'pending_geocode'`.
- **One LLM call per sagra:** At 250 RPD limit, calling Gemini once per sagra exhausts the quota after 250 enrichments total for the day. Always batch.
- **Hardcoded GEMINI_API_KEY in function code:** Store in Supabase Vault as a secret, not in code. Read via `Deno.env.get("GEMINI_API_KEY")`.
- **Trusting LLM output without validation:** Gemini structured output guarantees JSON syntax but not semantic correctness. Validate tag values against the allowed enum list before writing to DB.
- **Location string "lon lat" vs "lat lon":** PostGIS `ST_Point(x, y)` is longitude-first. Supabase JS client accepts space-separated string as `"LON LAT"` — not `"LAT LON"`. Getting this backwards produces correct-looking but wrong coordinates.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON from LLM | Custom regex/parser on free-form text | `responseSchema` in `@google/genai` | Gemini enforces schema at model level — no parsing needed |
| Rate limiting for Nominatim | Custom token bucket, sleep-with-retry | Simple `await sleep(1000)` between sequential calls | Nominatim only needs 1 req/sec; a simple delay is sufficient and correct |
| City → coordinates cache | In-memory Map or external KV | Supabase: query `location_text` for existing non-null coordinates first | Multiple sagre from same city are common in Veneto — skip geocode if we've seen the city |
| Status queue management | Separate enrichment_queue table | Existing `status` column on `sagre` table | Schema already has `status TEXT DEFAULT 'pending_geocode'` from Phase 1 |

**Key insight:** The database schema was designed with this phase in mind. `enhanced_description`, `food_tags`, `feature_tags`, `location` (geography), and `status` columns all already exist — this phase only populates them, it does not alter the schema.

---

## Common Pitfalls

### Pitfall 1: Nominatim Returns Wrong City (Veneto Province vs. City)
**What goes wrong:** `location_text` from scrapers may contain "Verona (VR)" or "Verona VR" rather than bare "Verona". Nominatim handles this gracefully for bare names but returns ambiguous results for parenthetical province codes.
**Why it happens:** Scraper CSS selectors extract raw text; Phase 2 does minimal normalization of `location_text`.
**How to avoid:** Strip parenthetical province codes before geocoding: `city.replace(/\s*\([A-Z]{2}\)\s*/, "").trim()`.
**Warning signs:** Coordinates landing outside Italy (lat < 36 or > 48, lon < 6 or > 19) indicate a bad geocode.

### Pitfall 2: Gemini Returns Tags Outside Allowed Enum
**What goes wrong:** Even with `responseSchema` specifying an enum, the model occasionally returns synonyms or Italian variants not in the list (e.g., "Vino Bianco" instead of "Vino").
**Why it happens:** Structured output guarantees JSON structure but the enum constraint enforcement is best-effort, not strict at inference time.
**How to avoid:** Post-process: filter `food_tags` and `feature_tags` arrays to only include values matching the known enum list before writing to DB.
**Warning signs:** Tags appear in DB that don't match the defined set (Pesce, Carne, Vino, Formaggi, Funghi, Radicchio, Dolci, Prodotti Tipici, Gratis, Musica, Artigianato, Bambini, Tradizionale).

### Pitfall 3: Edge Function Timeout with Large Pending Queue
**What goes wrong:** Supabase Edge Functions have a 50-second wall clock timeout. If hundreds of sagre are pending geocode (1 req/sec each), the function times out mid-run.
**Why it happens:** First run after Phase 2 may have 100-500 pending sagre; geocoding them all sequentially takes 100-500 seconds.
**How to avoid:** Cap the processing batch per invocation at a safe ceiling. At 1 req/sec geocoding: 30-35 rows per invocation fits within 50s (allows ~15s overhead for DB queries + LLM calls). Run will catch up over multiple cron invocations since status-queue picks up where it left off.
**Warning signs:** Edge Function logs show "Function timed out" or partial enrichment runs.

### Pitfall 4: 250 RPD Exhaustion
**What goes wrong:** Gemini free tier has 250 RPD (requests per day). Misconfigured batching (batch size = 1) exhausts this in 250 sagre enriched.
**Why it happens:** Copy-paste errors, testing with batch size 1, or running enrichment too aggressively.
**How to avoid:** Enforce `BATCH_SIZE` constant = 8. Add guard: if daily calls would exceed ~200, skip LLM phase and log a warning.
**Warning signs:** HTTP 429 responses from Gemini API (`quota exceeded`).

### Pitfall 5: Stale City Cache Serving Wrong Coordinates
**What goes wrong:** Two sagre have the same `location_text` (e.g., "Venezia") but one includes a district that shifts coordinates.
**Why it happens:** Cache-by-city-string optimization may group distinct locations.
**How to avoid:** Keep city cache simple: normalize city string as cache key, same logic as `normalizeText()` from Phase 2. Accept minor inaccuracy for rare edge cases; coordinates are used for map pins, not GPS navigation.

---

## Code Examples

### Complete Nominatim geocode + PostGIS insert pattern

```typescript
// Source: Nominatim Search API docs + Supabase PostGIS docs

// Sleep helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// City name cleanup before geocoding
function cleanCityName(raw: string): string {
  return raw
    .replace(/\s*\([A-Z]{2}\)\s*/g, "")  // remove "(VR)" style province codes
    .replace(/\s*-\s*[A-Z]{2}$/, "")      // remove " - VR" suffix
    .trim();
}

// Validate coordinate is within Italy bounding box
function isValidItalyCoord(lat: number, lon: number): boolean {
  return lat >= 36.0 && lat <= 47.5 && lon >= 6.0 && lon <= 19.0;
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const cleaned = cleanCityName(city);
  const params = new URLSearchParams({
    q: cleaned,
    countrycodes: "it",
    format: "json",
    limit: "1",
  });

  const resp = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "User-Agent": "Nemovia/1.0 (+https://nemovia.it)",
        "Accept-Language": "it",
      },
    }
  );

  if (!resp.ok) return null;
  const results = await resp.json();
  if (!results.length) return null;

  const lat = parseFloat(results[0].lat);
  const lon = parseFloat(results[0].lon);
  if (!isValidItalyCoord(lat, lon)) return null;

  return { lat, lon };
}

// Write geocode result to Supabase — note "LON LAT" order for PostGIS
async function writeGeocode(
  supabase: SupabaseClient,
  id: string,
  coords: { lat: number; lon: number } | null
) {
  await supabase.from("sagre").update({
    location:   coords ? `${coords.lon} ${coords.lat}` : null,
    status:     coords ? "pending_llm" : "geocode_failed",
    updated_at: new Date().toISOString(),
  }).eq("id", id);
}
```

### Complete Gemini batch enrichment pattern

```typescript
// Source: @google/genai official docs + Google AI structured output docs

const FOOD_TAGS = ["Pesce", "Carne", "Vino", "Formaggi", "Funghi", "Radicchio", "Dolci", "Prodotti Tipici"] as const;
const FEATURE_TAGS = ["Gratis", "Musica", "Artigianato", "Bambini", "Tradizionale"] as const;
const BATCH_SIZE = 8;
const MAX_DESC_CHARS = 250;

interface EnrichmentResult {
  id: string;
  food_tags: string[];
  feature_tags: string[];
  enhanced_description: string;
}

async function enrichBatch(
  ai: GoogleGenAI,
  batch: Array<{ id: string; title: string; location_text: string; description: string | null }>
): Promise<EnrichmentResult[]> {
  const prompt = `Sei un esperto di sagre italiane. Per ogni sagra nella lista JSON, genera:
1. food_tags: array con i tag alimentari pertinenti (max 3) scelti SOLO da: ${FOOD_TAGS.join(", ")}
2. feature_tags: array con i tag caratteristici (max 2) scelti SOLO da: ${FEATURE_TAGS.join(", ")}
3. enhanced_description: descrizione coinvolgente in italiano, max ${MAX_DESC_CHARS} caratteri, che menzioni il cibo principale e l'atmosfera

SAGRE:
${JSON.stringify(batch)}

Rispondi con un array JSON, un oggetto per ogni sagra con: id, food_tags, feature_tags, enhanced_description.`;

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
            food_tags: { type: "ARRAY", items: { type: "STRING" } },
            feature_tags: { type: "ARRAY", items: { type: "STRING" } },
            enhanced_description: { type: "STRING" },
          },
          required: ["id", "food_tags", "feature_tags", "enhanced_description"],
        },
      },
    },
  });

  const raw = JSON.parse(response.text) as EnrichmentResult[];

  // Validate and sanitize tag values against allowed enums
  return raw.map(r => ({
    id: r.id,
    food_tags: r.food_tags.filter(t => FOOD_TAGS.includes(t as typeof FOOD_TAGS[number])).slice(0, 3),
    feature_tags: r.feature_tags.filter(t => FEATURE_TAGS.includes(t as typeof FEATURE_TAGS[number])).slice(0, 2),
    enhanced_description: r.enhanced_description.slice(0, MAX_DESC_CHARS),
  }));
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` SDK | `@google/genai` SDK | Dec 2024 - early 2025 | Old package deprecated; new package has `ai.models.generateContent()` not `model.generateContent()` |
| `responseFormat: "json"` | `responseMimeType: "application/json"` + `responseSchema` | 2024-2025 | Schema now enforced at model level; no more JSON parsing failures |
| Free tier 2000 RPD | 250 RPD (post Dec 2025 change) | December 2025 | Confirmed in project STATE.md; batching is non-optional |
| Nominatim: no User-Agent | Nominatim: custom User-Agent required | Policy always existed; enforcement tightened | App must send custom User-Agent or gets 403 |

**Deprecated/outdated:**
- `@google/generative-ai`: Deprecated as of early 2025. Do not use. Use `@google/genai`.
- `model.generateContent()` pattern from old SDK: Now `ai.models.generateContent()`.
- Passing `GEMINI_API_KEY` as `apiKey` was renamed — confirm with current SDK docs; `new GoogleGenAI({ apiKey: "..." })` is current.

---

## Open Questions

1. **GEMINI_API_KEY secret management in Supabase**
   - What we know: Phase 2 uses Vault secrets for `project_url` and `anon_key`
   - What's unclear: Whether `GEMINI_API_KEY` should go in Vault (available to pg_cron) or as a Supabase Edge Function environment secret (available to Deno.env, not to SQL)
   - Recommendation: GEMINI_API_KEY is only needed inside the Edge Function (Deno), not in SQL — store as Edge Function secret via Supabase Dashboard → Functions → Secrets, not in Vault. This is cleaner than Vault for app-tier secrets.

2. **Province extraction from geocoded city**
   - What we know: The `sagre` table has a `province` column; scraper sources don't always provide it
   - What's unclear: Whether to derive province from Nominatim's `address.county` or `address.state_district` response fields
   - Recommendation: Include `addressdetails=1` in Nominatim query; map Nominatim `address.county` or `address.province` to the `province` column. If unavailable, leave NULL (Phase 4 discovery UI can group by province using `location_text` as fallback).

3. **`geocode_failed` sagre in LLM pass**
   - What we know: Some city names may not resolve (e.g., very small hamlets)
   - What's unclear: Whether to skip LLM enrichment for failed geocodes or enrich them anyway (tags/description are independent of coordinates)
   - Recommendation: Enrich anyway — tags and description have value even without GPS. Status sequence: `geocode_failed` → `enriched` (with NULL coordinates).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 |
| Config file | `/vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-03 | `cleanCityName()` strips province codes correctly | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/geocode.test.ts` | ❌ Wave 0 |
| PIPE-03 | `isValidItalyCoord()` rejects out-of-bounds coordinates | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/geocode.test.ts` | ❌ Wave 0 |
| PIPE-07 | Tag validation filter removes out-of-enum values | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/llm.test.ts` | ❌ Wave 0 |
| PIPE-08 | `enhanced_description` truncated to 250 chars | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/llm.test.ts` | ❌ Wave 0 |
| PIPE-09 | Batch chunking produces correct chunk sizes (5-10) | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/llm.test.ts` | ❌ Wave 0 |

**Notes on test scope:**
- Nominatim HTTP calls and Gemini API calls are NOT unit-tested (live APIs with rate limits)
- Helper functions (`cleanCityName`, `isValidItalyCoord`, tag validation, description truncation, batch chunking) are pure functions testable without network calls
- Integration testing is handled by manual trigger of the Edge Function from Supabase Dashboard

### Sampling Rate
- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** All enrichment helper tests green + manual Edge Function smoke test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/enrichment/__tests__/geocode.test.ts` — covers PIPE-03 city cleanup + coordinate validation
- [ ] `src/lib/enrichment/__tests__/llm.test.ts` — covers PIPE-07, PIPE-08, PIPE-09 tag filtering + batch chunking
- [ ] `src/lib/enrichment/geocode.ts` — exportable pure functions from Edge Function logic (so they can be tested)
- [ ] `src/lib/enrichment/llm.ts` — exportable pure functions (tag validation, chunk, truncate)

**Note on test architecture:** The Phase 2 pattern (inline code in Edge Function) makes unit testing hard because functions aren't exported. Phase 3 should adopt a hybrid: keep the Edge Function `index.ts` as thin orchestrator, extract pure business logic into `src/lib/enrichment/` (testable in Vitest), and import in the Edge Function via inline-copy pattern (same as Phase 2 did with normalize/date-parser logic).

---

## Sources

### Primary (HIGH confidence)
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) — rate limits (1 req/sec), User-Agent requirements
- [Nominatim Search API docs](https://nominatim.org/release-docs/latest/api/Search/) — endpoint format, `countrycodes=it`, `lat`/`lon` response fields
- [Gemini 2.5 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) — confirmed model ID `gemini-2.5-flash`, structured output support
- [Google AI Structured Output docs](https://ai.google.dev/gemini-api/docs/structured-output) — `responseMimeType`, `responseSchema` usage in `@google/genai`
- [Supabase PostGIS docs](https://supabase.com/docs/guides/database/extensions/postgis) — "LON LAT" space-separated string insert, longitude-first order
- Project `001_foundation.sql` — schema confirms all target columns exist (`location`, `food_tags`, `feature_tags`, `enhanced_description`, `status`)
- Project `002_scraping_pipeline.sql` + `supabase/functions/scrape-sagre/index.ts` — Edge Function patterns for Deno, Vault secrets, `EdgeRuntime.waitUntil`, `net.http_post` pg_cron

### Secondary (MEDIUM confidence)
- [aifreeapi.com rate limits](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits) — 250 RPD for Gemini 2.5 Flash (cross-confirmed with project STATE.md decision log)
- [@google/genai npm search results](https://github.com/googleapis/js-genai) — `npm:@google/genai@1` confirmed as correct Deno import prefix pattern

### Tertiary (LOW confidence — flag for validation)
- Province extraction from Nominatim `addressdetails=1` — approach not tested against live Italian addresses; may need adjustment based on actual Nominatim response structure for Veneto localities

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@google/genai` and Nominatim are confirmed in official docs; Deno `npm:` prefix confirmed in Supabase Edge Function patterns
- Architecture: HIGH — status-column queue pattern directly supported by existing schema; pg_cron pattern is direct copy of Phase 2
- Pitfalls: HIGH for lon/lat order and rate limits; MEDIUM for province extraction details

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days) — Gemini free tier limits may change (already changed Dec 2025 per STATE.md); verify RPD before planning sprint
