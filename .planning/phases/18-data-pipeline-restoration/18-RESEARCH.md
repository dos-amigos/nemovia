# Phase 18: Data Pipeline Restoration - Research

**Researched:** 2026-03-10
**Domain:** Supabase Edge Functions, Cheerio web scraping, Nominatim geocoding, PostgreSQL data quality
**Confidence:** HIGH

## Summary

Phase 18 addresses the critical blocker for all v1.4 work: the event count collapse from 735 active sagre to ~26. This research identifies the root causes, prescribes specific fixes, and documents the exact code locations and patterns needed by the planner.

The event count drop has three contributing factors that compound: (1) aggressive heuristic filters introduced in v1.3 (migration 008) that retroactively deactivated legitimate sagre using overly broad keyword matching (e.g., `\yfiera\y` catches "Sagra e Fiera del Radicchio", `\ymercato\y` catches "Sagra del Mercato Antico"), (2) the daily expire cron job correctly deactivating past events while scrapers may not be replenishing with enough future events, and (3) potential scraper source websites changing their HTML structure causing silent failures (0 events found logged as "success"). The fix requires calibrating filters, auditing scraper health via `scrape_logs` and `scraper_sources`, adding Nominatim bounding box parameters for Veneto gating, normalizing province codes to 2-letter format, and adding a heuristic `isNonSagraTitle()` pre-filter to the scrape pipeline.

**Primary recommendation:** Start with diagnostic queries against production database to determine exact root cause breakdown, then fix filters and scrapers in order of impact.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Event count restored to 100+ active sagre | Scraper health audit via `scrape_logs`, filter calibration via SQL retroactive re-activation, potential new source (itinerarinelgusto.it with 150 events) |
| DATA-02 | No events outside Veneto in results | Nominatim `viewbox` + `bounded=1` parameter in enrich-sagre, tighter province gating in `isVenetoProvince()` |
| DATA-03 | Non-sagre events filtered out (passeggiata, carnevale, concerto, mostra, antiquariato) | New `isNonSagraTitle()` heuristic in scrape-sagre + retroactive SQL cleanup, complements existing LLM `is_sagra` classification |
| DATA-04 | City names always display with provincia in parentheses (e.g., "Zugliano (VI)") | Province code normalization: SQL migration to convert Nominatim names to 2-letter codes, update display logic in SagraCard/FeaturedSagraCard/SagraDetail/MapMarkerPopup |
| SCRAPE-02 | Investigate and add new scraper sources if needed | itinerarinelgusto.it identified as strong candidate (150 Veneto sagre, structured HTML, pagination); venetosagre.it uses jQuery dynamic loading (harder); paesiinfesta.com too limited (Friuli-focused) |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cheerio | 1.x (npm:cheerio@1) | HTML parsing in Edge Function | Already used, Deno-compatible via npm: prefix |
| @supabase/supabase-js | 2.x | Database client in Edge Functions | Already used, service_role access |
| @google/genai | 1.x | LLM classification (is_sagra) | Already used in enrich-sagre |
| pg_trgm | - | Fuzzy dedup matching | Already enabled, extensions schema |
| PostGIS | - | Spatial queries and Veneto gating | Already enabled, extensions schema |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg_cron | - | Scheduled scrape/enrich/expire | Already configured, may need schedule adjustment |

### No New Dependencies Required
This phase requires zero new npm packages. All work is done within existing Edge Functions, SQL migrations, and TypeScript source modifications.

## Architecture Patterns

### Current Data Pipeline Flow
```
scrape-sagre Edge Function (pg_cron 2x/day)
  -> fetch HTML from scraper_sources (5 sources)
  -> Cheerio parse -> extractRawEvent()
  -> isNoiseTitle() filter (reject noise)
  -> normalizeRawEvent()
  -> isCalendarDateRange() filter
  -> isExcessiveDuration() filter (>7 days)
  -> isPastYearEvent() filter
  -> upsertEvent() with find_duplicate_sagra() dedup
  -> log to scrape_logs

enrich-sagre Edge Function (pg_cron 2x/day, 30min offset)
  -> Pass 1: Geocoding (pending_geocode -> pending_llm)
     -> normalizeLocationText() -> Nominatim search
     -> isValidItalyCoord() check
     -> isVenetoProvince() check -> deactivate non-Veneto
  -> Pass 2: LLM enrichment (pending_llm -> enriched)
     -> Gemini batch classification (is_sagra)
     -> Deactivate classified_non_sagra
     -> Assign food_tags, feature_tags, enhanced_description

expire-sagre-daily (pg_cron 1x/day at 01:00)
  -> Deactivate past events
```

### Recommended Fix Order
```
1. DIAGNOSE  -> Query scrape_logs, scraper_sources, sagre counts
2. CALIBRATE -> Fix overly aggressive retroactive filters (re-activate false positives)
3. HARDEN    -> Add isNonSagraTitle() pre-filter to scrape pipeline
4. GATE      -> Add Nominatim viewbox+bounded=1 for Veneto
5. NORMALIZE -> Province code migration (Nominatim names -> 2-letter codes)
6. DISPLAY   -> Update all components to show "City (XX)" format
7. EXPAND    -> Add itinerarinelgusto.it source if count still < 100
```

### File Modification Map
```
supabase/functions/scrape-sagre/index.ts    # Add isNonSagraTitle(), new source support
supabase/functions/enrich-sagre/index.ts    # Add viewbox+bounded=1 to Nominatim call
src/lib/scraper/filters.ts                  # Add isNonSagraTitle() canonical implementation
src/lib/scraper/__tests__/filters.test.ts   # Tests for isNonSagraTitle()
src/lib/enrichment/geocode.ts               # Add VENETO_VIEWBOX constant
src/lib/constants/veneto.ts                 # Add PROVINCE_CODE_MAP
src/components/sagra/SagraCard.tsx           # Province display already works
src/components/home/FeaturedSagraCard.tsx    # MISSING province display - must add
src/components/map/MapMarkerPopup.tsx        # Province display already works
src/components/detail/SagraDetail.tsx        # Province display already works
supabase/migrations/009_*.sql               # Province normalization + filter recalibration
```

### Pattern: Inline Copy for Edge Functions
The project has an established pattern where pure functions in `src/lib/` are copied inline into Edge Functions because Deno cannot import from `src/`. Any new filter function must be:
1. Implemented canonically in `src/lib/scraper/filters.ts`
2. Unit tested in `src/lib/scraper/__tests__/filters.test.ts`
3. Copied verbatim into `supabase/functions/scrape-sagre/index.ts`

### Anti-Patterns to Avoid
- **Do NOT add new npm dependencies for this phase** -- all fixes use existing libraries
- **Do NOT modify the find_duplicate_sagra RPC** -- it was carefully tuned in v1.3 with pg_trgm similarity thresholds
- **Do NOT change the scraper pagination logic** -- the current page-by-page with politeness delay is correct
- **Do NOT use Nominatim viewbox for autocomplete** -- Nominatim explicitly forbids autocomplete usage (Phase 22 concern, not this phase)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Province code lookup | Manual if/else mapping | SQL CASE WHEN with VENETO_PROVINCES constant | 14 variants (7 provinces x 2 formats) need consistent mapping |
| Veneto geographic filtering | Custom lat/lng range check | Nominatim `viewbox` + `bounded=1` params | Nominatim does this natively, more accurate than bounding box |
| Non-sagra classification | Regex-only approach | Heuristic pre-filter + LLM is_sagra classification | LLM already handles this well for enriched events; heuristic catches obvious cases earlier |
| Scraper health monitoring | Custom dashboard | SQL queries against scrape_logs + scraper_sources | Tables already have all needed fields (consecutive_failures, events_found, etc.) |

**Key insight:** The existing pipeline architecture is sound. The problem is filter calibration and scraper health, not architectural flaws. Fixes are targeted adjustments, not rewrites.

## Common Pitfalls

### Pitfall 1: Overly Broad Keyword Filters Killing Legitimate Sagre
**What goes wrong:** Migration 008 retroactively deactivated events matching keywords like `fiera`, `mercato`, `mercatino`, `concerto`, `spettacolo` using word-boundary `\y` matches. This catches legitimate sagre that contain these words: "Sagra e Fiera del Radicchio", "Sagra del Mercato Antico", "Festa con Concerto".
**Why it happens:** Keyword filtering applied without considering that sagre often include non-food activities (music, markets, fairs) as secondary features.
**How to avoid:** The new `isNonSagraTitle()` must be smarter -- only reject titles where the non-sagra keyword is the PRIMARY subject (no "sagra", "festa", "gastronomica" also present). Use a whitelist check: if title contains "sagra" or "festa" or food-related keywords, do NOT reject even if it also contains "mercato" or "concerto".
**Warning signs:** Active event count drops below previous level after applying new filters. Always run DRY-RUN queries first.

### Pitfall 2: Retroactive Filter Re-activation Creating Duplicates
**What goes wrong:** Re-activating previously deactivated events without checking for duplicates can create duplicate active entries if a scraper re-inserted the same event.
**Why it happens:** The dedup RPC `find_duplicate_sagra` only checks against `is_active = true` records. If the original was deactivated, a new copy may have been inserted.
**How to avoid:** Before bulk re-activation, run dedup check. Re-activate older records, keep newer ones deactivated if both exist. Use the `created_at` field to determine which is the original.
**Warning signs:** Province count totals seem too high after re-activation.

### Pitfall 3: Nominatim Rate Limiting During Bulk Geocoding
**What goes wrong:** If many events need re-geocoding after filter changes, the 1 req/sec rate limit means 30 events take 33+ seconds (current GEOCODE_LIMIT is 30).
**Why it happens:** Nominatim usage policy strictly enforces 1 request per second. The Edge Function has a 60-second timeout.
**How to avoid:** Keep GEOCODE_LIMIT at 30. If more events need geocoding, they will be processed across multiple cron runs (2x/day). Do not increase the limit.
**Warning signs:** Edge Function timeouts in Supabase logs.

### Pitfall 4: Province Code Normalization Missing Edge Cases
**What goes wrong:** Nominatim returns province in different formats: "Padova", "padova", "Provincia di Padova", "provincia di padova". A naive normalization misses some.
**Why it happens:** Nominatim has no standardized province field -- it uses the `county`, `province`, or `state_district` from addressdetails, each with different formatting.
**How to avoid:** The SQL migration should use case-insensitive matching and handle both "Name" and "Provincia di Name" forms. Map all 14 known variants to 7 two-letter codes.
**Warning signs:** Some sagre display full province name instead of code after migration.

### Pitfall 5: New Scraper Source Breaking Edge Function Timeout
**What goes wrong:** Adding a new source like itinerarinelgusto.it with 10 pages of results means 10 HTTP requests with 1.5s delays = 15+ seconds just for pagination, plus Cheerio parsing and DB operations.
**Why it happens:** The scraper runs sequentially through all sources. Current 5 sources with max_pages 1-10 already use significant time.
**How to avoid:** Set max_pages conservatively for new sources (start with 3, increase later). The Edge Function uses fire-and-forget with `EdgeRuntime.waitUntil()` so the HTTP timeout is less critical, but Supabase has a wall clock limit on Edge Functions.
**Warning signs:** Scraper runs timing out or not completing all sources.

## Code Examples

### Diagnostic Queries (Run in Supabase SQL Editor)
```sql
-- Source: Project database schema analysis

-- 1. Check scraper health: which sources are active, when last scraped
SELECT name, is_active, consecutive_failures, last_scraped_at,
       EXTRACT(EPOCH FROM (NOW() - last_scraped_at))/3600 AS hours_since_scrape
FROM scraper_sources ORDER BY name;

-- 2. Check recent scrape results: are scrapers finding events?
SELECT source_name, status, events_found, events_inserted, events_merged,
       error_message, duration_ms, completed_at
FROM scrape_logs
ORDER BY completed_at DESC LIMIT 20;

-- 3. Active event count breakdown by status
SELECT status, is_active, COUNT(*) FROM sagre GROUP BY status, is_active ORDER BY count DESC;

-- 4. Active events by source
SELECT unnest(sources) AS source, COUNT(*)
FROM sagre WHERE is_active = true
GROUP BY source ORDER BY count DESC;

-- 5. Events deactivated by migration 008 keyword filters (potential false positives)
SELECT title, location_text, province, sources, updated_at
FROM sagre
WHERE is_active = false
  AND (
    lower(title) ~ '\y(mostra|mostre)\y'
    OR lower(title) ~ '\yantiquariato\y'
    OR lower(title) ~ '\y(mercato|mercatino|mercatini)\y'
    OR lower(title) ~ '\yfiera\y'
    OR lower(title) ~ '\yrassegna\y'
    OR lower(title) ~ '\yconcerto\y'
    OR lower(title) ~ '\yspettacolo\y'
  )
  AND (
    lower(title) ~ '\ysagra\y'
    OR lower(title) ~ '\yfesta\y'
    OR lower(title) ~ '\ygastronomic'
  )
ORDER BY title;

-- 6. Non-Veneto events that slipped through
SELECT title, location_text, province
FROM sagre
WHERE is_active = true
  AND province IS NOT NULL
  AND lower(trim(province)) NOT IN (
    'belluno', 'padova', 'rovigo', 'treviso', 'venezia', 'verona', 'vicenza',
    'provincia di belluno', 'provincia di padova', 'provincia di rovigo',
    'provincia di treviso', 'provincia di venezia', 'provincia di verona',
    'provincia di vicenza'
  );

-- 7. Events with province that need code normalization
SELECT DISTINCT province, COUNT(*)
FROM sagre WHERE province IS NOT NULL
GROUP BY province ORDER BY province;
```

### isNonSagraTitle() Heuristic Filter
```typescript
// Source: Design based on existing isNoiseTitle() pattern in src/lib/scraper/filters.ts
// and analysis of migration 008 keyword filter false positives

/**
 * Detect event titles that are clearly NOT sagre.
 * Returns `true` if the title should be REJECTED as a non-sagra event.
 *
 * IMPORTANT: Only reject when the non-sagra keyword is the PRIMARY subject.
 * If title also contains "sagra", "festa", "gastronomic*", or food keywords,
 * do NOT reject -- it's likely a sagra with secondary activities.
 *
 * This is a pre-filter at scrape time. The LLM is_sagra classification
 * in enrich-sagre provides the authoritative second pass.
 */
export function isNonSagraTitle(title: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();

  // Whitelist: if title contains sagra/festa/food keywords, never reject
  const sagraIndicators = /\b(sagra|sagre|festa|feste|gastronomic|enogastronomic|degustazion|polenta|baccal[aà]|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)/i;
  if (sagraIndicators.test(t)) return false;

  // Non-sagra event types (only match when NO sagra indicators)
  const nonSagraPatterns = [
    /\b(passeggiata|camminata|marcia|trekking)\b/,
    /\b(carnevale|carnevali)\b/,
    /\b(concerto|concerti|recital)\b/,
    /\b(mostra|mostre|esposizione|esposizioni)\b/,
    /\b(antiquariato|collezionismo)\b/,
    /\b(teatro|teatrale|commedia|spettacolo)\b/,
    /\b(maratona|corsa|gara\s+(?:ciclistica|podistica))\b/,
    /\b(convegno|conferenza|seminario)\b/,
    /\b(cinema|cineforum|proiezione)\b/,
    /\b(yoga|fitness|pilates)\b/,
    /\b(mercato|mercatino|mercatini)\b/,  // standalone markets without food
  ];

  return nonSagraPatterns.some((pattern) => pattern.test(t));
}
```

### Nominatim Viewbox Parameter for Veneto
```typescript
// Source: Nominatim API docs (https://nominatim.org/release-docs/latest/api/Search/)
// Veneto approximate bounding box from OpenStreetMap relation 43648

// Veneto bounding box: SW corner to NE corner
// Format for Nominatim viewbox: lon1,lat1,lon2,lat2 (any two opposite corners)
const VENETO_VIEWBOX = "10.62,44.79,13.10,46.68";

// In the geocoding request:
const params = new URLSearchParams({
  q: city,
  countrycodes: "it",
  format: "json",
  limit: "1",
  addressdetails: "1",
  viewbox: VENETO_VIEWBOX,
  bounded: "1",
});
```

### Province Code Normalization SQL Migration
```sql
-- Source: Analysis of existing province field values in sagre table
-- and VENETO_PROVINCES constant in src/lib/constants/veneto.ts

-- Create a mapping function for Nominatim province names -> 2-letter codes
CREATE OR REPLACE FUNCTION public.normalize_province_code(raw_province TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE lower(trim(raw_province))
    WHEN 'belluno'               THEN 'BL'
    WHEN 'provincia di belluno'  THEN 'BL'
    WHEN 'padova'                THEN 'PD'
    WHEN 'provincia di padova'   THEN 'PD'
    WHEN 'rovigo'                THEN 'RO'
    WHEN 'provincia di rovigo'   THEN 'RO'
    WHEN 'treviso'               THEN 'TV'
    WHEN 'provincia di treviso'  THEN 'TV'
    WHEN 'venezia'               THEN 'VE'
    WHEN 'provincia di venezia'  THEN 'VE'
    WHEN 'verona'                THEN 'VR'
    WHEN 'provincia di verona'   THEN 'VR'
    WHEN 'vicenza'               THEN 'VI'
    WHEN 'provincia di vicenza'  THEN 'VI'
    ELSE NULL  -- non-Veneto or unrecognized
  END;
$$;

-- Retroactively normalize all existing province values
UPDATE public.sagre
SET province = normalize_province_code(province),
    updated_at = NOW()
WHERE province IS NOT NULL
  AND province NOT IN ('BL', 'PD', 'RO', 'TV', 'VE', 'VR', 'VI');

-- Update enrich-sagre to normalize at geocode time:
-- After extracting province from Nominatim, normalize immediately:
-- province: normalizeProvinceCode(addr.county ?? addr.province ?? addr.state_district ?? null)
```

### Province Code Normalization in TypeScript
```typescript
// Source: src/lib/constants/veneto.ts VENETO_PROVINCES constant

const PROVINCE_CODE_MAP: Record<string, string> = {
  "belluno": "BL", "provincia di belluno": "BL",
  "padova": "PD", "provincia di padova": "PD",
  "rovigo": "RO", "provincia di rovigo": "RO",
  "treviso": "TV", "provincia di treviso": "TV",
  "venezia": "VE", "provincia di venezia": "VE",
  "verona": "VR", "provincia di verona": "VR",
  "vicenza": "VI", "provincia di vicenza": "VI",
};

/**
 * Convert Nominatim province name to 2-letter Italian province code.
 * Returns null for non-Veneto or unrecognized provinces.
 */
export function normalizeProvinceCode(province: string | null): string | null {
  if (!province) return null;
  return PROVINCE_CODE_MAP[province.toLowerCase().trim()] ?? null;
}
```

### New Scraper Source: itinerarinelgusto.it
```typescript
// Source: WebFetch analysis of https://www.itinerarinelgusto.it/sagre-e-feste/veneto
// Note: selectors need verification with browser DevTools before deployment

// scraper_sources INSERT for itinerarinelgusto.it
INSERT INTO public.scraper_sources (
  name, display_name, base_url,
  selector_item, selector_title, selector_start_date,
  selector_city, selector_url, selector_image,
  url_pattern, max_pages, is_active
) VALUES (
  'itinerarinelgusto', 'Itinerari nel Gusto',
  'https://www.itinerarinelgusto.it/sagre-e-feste/veneto',
  '.row.post.pad',         -- event card container (needs DevTools verification)
  'h2 a, h3 a',            -- title with link
  NULL,                     -- dates extracted from text content
  NULL,                     -- city extracted from text (parseCityFromText fallback)
  'a',                      -- event detail URL
  'img',                    -- event image
  '?sagre-e-feste_pg_from={n}',  -- pagination: 0, 15, 30, 45...
  5,                        -- 5 pages x 15 events = 75 events
  true
);
-- Note: url_pattern needs custom handling since {n} would be 0,15,30 not 1,2,3
-- May need source-specific pagination logic in buildPageUrl()
```

### Filter Re-calibration: Re-activate False Positives
```sql
-- Source: Analysis of migration 008_retroactive_cleanup.sql keyword patterns

-- DRY RUN FIRST: Count how many would be re-activated
SELECT COUNT(*), 'sagra+fiera/mercato false positives' AS category
FROM sagre
WHERE is_active = false
  AND (
    lower(title) ~ '\y(mercato|mercatino|mercatini|fiera)\y'
  )
  AND (
    lower(title) ~ '\ysagra\y'
    OR lower(title) ~ '\yfesta\y'
    OR lower(title) ~ '\ygastronomic'
  )
  AND start_date >= CURRENT_DATE;  -- only re-activate future events

-- If count is reasonable, re-activate:
UPDATE public.sagre
SET is_active = true, updated_at = NOW()
WHERE is_active = false
  AND (
    lower(title) ~ '\y(mercato|mercatino|mercatini|fiera)\y'
  )
  AND (
    lower(title) ~ '\ysagra\y'
    OR lower(title) ~ '\yfesta\y'
    OR lower(title) ~ '\ygastronomic'
  )
  AND start_date >= CURRENT_DATE
  AND province IS NOT NULL
  AND lower(trim(province)) IN (
    'belluno', 'padova', 'rovigo', 'treviso', 'venezia', 'verona', 'vicenza',
    'provincia di belluno', 'provincia di padova', 'provincia di rovigo',
    'provincia di treviso', 'provincia di venezia', 'provincia di verona',
    'provincia di vicenza'
  );
```

## State of the Art

| Old Approach (v1.3) | Current Approach (v1.4) | When Changed | Impact |
|---------------------|------------------------|--------------|--------|
| Broad keyword rejection (migration 008) | Whitelist-aware `isNonSagraTitle()` | Phase 18 | Recovers legitimate sagre containing "mercato", "fiera", "concerto" |
| Nominatim without geographic bounds | `viewbox` + `bounded=1` for Veneto | Phase 18 | Prevents geocoding of non-Veneto cities with same name |
| Province stored as Nominatim raw text | 2-letter province codes (BL, PD, etc.) | Phase 18 | Consistent display "Zugliano (VI)" across all components |
| LLM-only non-sagra classification | Heuristic pre-filter + LLM classification | Phase 18 | Catches obvious non-sagre before wasting LLM quota |

**Current filter pipeline gaps:**
- `isNoiseTitle()` -- catches noise/spam but NOT non-sagra event types
- `isCalendarDateRange()` -- catches calendar spam
- `isExcessiveDuration()` -- catches unreasonable durations
- `isPastYearEvent()` -- catches old events
- `isNonSagraTitle()` -- **MISSING** -- needed for passeggiata, carnevale, concerto, etc.
- LLM `is_sagra` -- catches everything but only runs AFTER geocoding (wastes Nominatim calls)

## Open Questions

1. **Exact root cause breakdown of event count collapse**
   - What we know: Count dropped from 735 to ~26. Migration 008 keyword filters were aggressive. Expire cron deactivates past events daily.
   - What's unclear: How many events were killed by keyword filters vs. expired naturally vs. scraper failures? Exact breakdown requires running diagnostic queries against production.
   - Recommendation: First plan task must be diagnostic queries. The planner should make all subsequent tasks conditional on diagnostic findings.

2. **itinerarinelgusto.it pagination URL pattern compatibility**
   - What we know: Pages use `?sagre-e-feste_pg_from=15` (offset-based, not page-number-based). Current `buildPageUrl()` uses `{n}` as page number (1, 2, 3...).
   - What's unclear: Whether offset-based pagination can be adapted with current url_pattern or needs custom logic.
   - Recommendation: Use custom source-specific pagination in `buildPageUrl()` or calculate offset: `(page - 1) * 15`. The `url_pattern` could be `?sagre-e-feste_pg_from={n}` with `buildPageUrl` passing `(page-1)*15` instead of `page`.

3. **itinerarinelgusto.it exact CSS selectors**
   - What we know: Page uses card-based layout with images from `cdn.itinerarinelgusto.it`. WebFetch analysis suggests `.row.post.pad` containers.
   - What's unclear: Exact working selectors require browser DevTools inspection of live page.
   - Recommendation: Plan task should include DevTools verification step before coding the scraper. Start with max_pages=1 for testing.

4. **Province display in FeaturedSagraCard**
   - What we know: `FeaturedSagraCard.tsx` displays `sagra.location_text` but does NOT include province. `SagraCard.tsx` shows `{sagra.province && \` (\${sagra.province})\`}`. Requirement DATA-04 says "every sagra's location displays with provincia".
   - What's unclear: Nothing -- this is a clear bug/gap.
   - Recommendation: Add province display to FeaturedSagraCard matching the SagraCard pattern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vitest.config.ts` or `vite.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/scraper/__tests__/filters.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | 100+ active sagre | manual | SQL query: `SELECT count(*) FROM sagre WHERE is_active = true` | N/A (database) |
| DATA-02 | No non-Veneto events | unit + SQL | `npx vitest run src/lib/enrichment/__tests__/geocode.test.ts` + SQL verification | Exists (geocode.test.ts) |
| DATA-03 | Non-sagre filtered | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts` | Exists (needs isNonSagraTitle tests) |
| DATA-04 | Province codes normalized | unit + SQL | Test normalizeProvinceCode() function + SQL verification | Wave 0 (new test needed) |
| SCRAPE-02 | New sources investigated | manual | SQL: `SELECT * FROM scrape_logs WHERE source_name = 'itinerarinelgusto' ORDER BY completed_at DESC LIMIT 5` | N/A (database) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/scraper/__tests__/filters.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + SQL verification queries confirm counts

### Wave 0 Gaps
- [ ] `src/lib/scraper/__tests__/filters.test.ts` -- add `isNonSagraTitle()` test cases
- [ ] `src/lib/enrichment/__tests__/geocode.test.ts` -- add `normalizeProvinceCode()` test cases
- [ ] No new framework install needed -- Vitest already configured

## Sources

### Primary (HIGH confidence)
- **Project codebase** -- `supabase/functions/scrape-sagre/index.ts` (715 lines), `supabase/functions/enrich-sagre/index.ts` (427 lines), `src/lib/scraper/filters.ts`, all 8 SQL migrations
- **Nominatim API docs** -- viewbox + bounded parameters: [Search API](https://nominatim.org/release-docs/latest/api/Search/) -- `viewbox=lon1,lat1,lon2,lat2` with `bounded=1` restricts results to area
- **OpenStreetMap** -- Veneto region relation 43648, approximate bbox: lon 10.62-13.10, lat 44.79-46.68

### Secondary (MEDIUM confidence)
- **itinerarinelgusto.it** -- [Sagre e Feste in Veneto](https://www.itinerarinelgusto.it/sagre-e-feste/veneto) -- 150 events, paginated at 15/page, structured card layout. Selectors verified via WebFetch but need DevTools confirmation.
- **venetosagre.it** -- [Home](http://www.venetosagre.it/) -- Uses jQuery dynamic loading, harder to scrape with Cheerio (LOW priority as source)
- **paesiinfesta.com** -- [Home](https://paesiinfesta.com/) -- Only 4 events visible, focused on Friuli/Eastern Veneto (NOT recommended as source)

### Tertiary (LOW confidence)
- **Veneto bounding box coordinates** -- Approximate values derived from city coordinate ranges (latlong.info) and general geographic knowledge. Should be verified with a bounding box tool before production use.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all modifications within existing patterns
- Architecture: HIGH -- fix order is clear, all code locations identified, established patterns reused
- Pitfalls: HIGH -- identified from actual codebase analysis of migration 008 false positives
- New scraper source: MEDIUM -- itinerarinelgusto.it structure analyzed via WebFetch, needs DevTools confirmation

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, scraper source HTML may change without notice)
