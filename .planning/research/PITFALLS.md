# Domain Pitfalls

**Domain:** Italian food festival (sagre) aggregator with web scraping + LLM enrichment
**Project:** Nemovia
**Researched:** 2026-03-04

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or project failure.

---

### Pitfall 1: Silent Scraping Breakage (Config-Driven Selector Rot)

**What goes wrong:** CSS selectors stored in DB stop matching after a source site redesigns, changes class names, or A/B tests new layouts. Because the scraper is config-driven and runs on a cron, it silently returns zero events or partial data. No error is thrown -- Cheerio finds no matches and returns empty arrays. The database quietly fills with stale data while new events are missed for days or weeks before anyone notices.

**Why it happens:** Italian sagre portals (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly) are low-budget websites maintained by small teams. They redesign without warning, often during the high season (May-September) when they receive the most traffic. Config-driven selectors create a false sense of stability -- "it's just config, easy to update" -- but without monitoring, breakage is invisible.

**Consequences:**
- Users see outdated or missing events, destroying trust immediately
- Database fills with stale entries while real events go uncaptured
- During peak sagra season (summer), a week of missed scraping means hundreds of lost events
- Debugging which source broke and when requires log archaeology

**Warning signs:**
- Event count per source drops below historical average
- Scrape job completes in suspiciously short time (no data to process)
- Timestamps show no new events from a specific source for 48+ hours
- Users report missing events they know exist

**Prevention:**
1. **Health metrics per source:** After each scrape run, record events_found count per source. Alert when count drops below a configurable threshold (e.g., 50% of 7-day rolling average)
2. **Structural fingerprinting:** Hash the DOM structure of key pages during scraper setup. Compare on each run. If structure changes >20%, flag the source for manual review before silently using stale selectors
3. **Zero-result alerting:** Any scrape that returns 0 events from a source that previously had data MUST trigger an alert (Discord webhook, email), not silently succeed
4. **Scraper status dashboard:** A simple admin page showing last_scrape_at, events_found, and health status per source

**Detection:** Build into Phase 1 (scraping infrastructure). This is not optional -- without it, you are flying blind.

**Phase:** Phase 1 (Scraping Pipeline). Must be built alongside the scraper, not retrofitted.

---

### Pitfall 2: Italian Date Parsing Chaos

**What goes wrong:** Italian sagre sites express dates in wildly inconsistent natural language: "dal 5 al 12 luglio", "5-12/07/2026", "venerdi 5, sabato 6 e domenica 7 luglio", "tutti i weekend di luglio", "ogni venerdi e sabato dal 3 al 25 agosto", or even just "Estate 2026". Some events list multi-day ranges, others list individual days within a range, and some are recurring weekly events within a date span. Parsing these into structured start_date/end_date fields fails for edge cases.

**Why it happens:** There is no standard date format across Italian event portals. Each site uses different conventions. Some mix Italian month names with numeric dates. Some express recurring schedules (every Friday) that do not map cleanly to a simple date range. The "dal X al Y" pattern is common but not universal.

**Consequences:**
- Events show wrong dates, causing users to visit expired sagre
- Multi-day events appear as single-day or vice versa
- Recurring weekly events within a date range (e.g., "every Friday in July") are impossible to represent as a simple start/end pair
- Date sorting and "this weekend" filters produce wrong results
- LLM enrichment may hallucinate dates when the original text is ambiguous

**Warning signs:**
- Events with end_date before start_date
- Clusters of events all on the same day (likely parsing defaulted to a single date)
- User reports of "sagra already finished" or "sagra not started yet"
- Events with null dates despite source clearly listing them

**Prevention:**
1. **Use Gemini for date extraction:** Rather than building a regex-based parser, include date extraction in the LLM enrichment prompt. Gemini 2.5 Flash handles Italian date expressions well. Send the raw scraped text and ask for structured JSON with start_date, end_date, and optional recurrence_pattern
2. **Validate parsed dates:** Any event with end_date < start_date, or dates more than 6 months in the past/future, should be flagged for review
3. **Store raw text alongside parsed dates:** Keep the original date string in raw_date_text so it can be re-parsed if the extraction logic improves
4. **Handle recurrence explicitly:** Add a recurrence field to the schema (e.g., "weekends_only", "friday_saturday", "daily") rather than trying to expand recurring events into individual date rows

**Phase:** Phase 1 (Data Model) and Phase 2 (LLM Enrichment). Date extraction should be part of the enrichment prompt, not a separate regex-based system.

---

### Pitfall 3: Gemini 2.5 Flash Free Tier Quota Exhaustion

**What goes wrong:** The Gemini 2.5 Flash free tier allows ~250 RPD (requests per day) and 10 RPM (requests per minute). With 5+ sources scraping potentially 50-200 events each per run, two enrichment runs per day (as planned in PROJECT.md) could easily consume 200-400+ requests. This exceeds the daily quota. Google also reduced these limits without warning in December 2025, and may do so again. When limits are hit, the API returns 429 errors and enrichment silently fails.

**Why it happens:** The project plans to use Gemini for both auto-tagging (food categories) and description enrichment. Each event requires at least one API call, possibly two (tagging + description). With 5+ sources each scraping ~100 events, that is 500-1000 requests per enrichment cycle. Even batching events into groups (5-10 per prompt), you are looking at 50-200 requests per cycle, and with 2 cycles per day, 100-400 RPD.

**Consequences:**
- Events appear without tags or enriched descriptions -- degraded UX
- Partial enrichment: some events enriched, others not, creating inconsistent data
- Google may further reduce free tier limits without notice (happened December 2025)
- 429 errors may cause the entire cron job to fail if not handled with retry logic
- No batch API on free tier -- cannot process asynchronously at scale

**Warning signs:**
- 429 error responses in enrichment logs
- Increasing percentage of events with null tags or default descriptions
- Enrichment cron job completing much faster than expected (skipping due to rate limits)
- API usage approaching 200 RPD in monitoring

**Prevention:**
1. **Batch events in prompts:** Send 5-10 events per API call in structured JSON. Ask Gemini to return tagged/enriched data for all events in one response. This reduces 500 individual calls to 50-100
2. **Enrich only new/changed events:** Track a content hash per event. Only call the LLM when the scraped content has actually changed. Most events do not change between scrape runs
3. **Implement exponential backoff with jitter:** On 429 errors, back off exponentially (1s, 2s, 4s, 8s...) with random jitter. Do not retry immediately
4. **Budget tracking:** Track daily API usage in a counter table. Stop enrichment when approaching 80% of daily quota. Process remaining events in the next cycle
5. **Graceful degradation:** Events without LLM enrichment should still display with raw scraped data. Never block event display on enrichment completion
6. **Prepare for paid tier:** Design the integration so switching to Tier 1 ($0 but billing-enabled, 2000 RPD) is a config change, not a rewrite

**Phase:** Phase 2 (LLM Enrichment). Rate limiting and batching must be designed from day one.

---

### Pitfall 4: Duplicate Events Across Sources

**What goes wrong:** The same sagra appears on 3-4 different source websites with slightly different names, dates, or descriptions. "Sagra del Baccala' alla Vicentina - Sandrigo" on one site becomes "Festa del Baccala - Sandrigo (VI)" on another and "SAGRA DEL BACCALA' DI SANDRIGO" on a third. Without deduplication, users see the same event 3-4 times with inconsistent information, destroying the core value proposition of "one unified view."

**Why it happens:** No canonical event ID exists across Italian sagre portals. Event names are written in different styles (uppercase, with/without accents, with/without location). Dates may differ by a day due to preview/setup days being included on one source but not another. Location names vary (Sandrigo vs Sandrigo (VI) vs Sandrigo, Vicenza).

**Consequences:**
- Users see duplicates everywhere -- the app feels broken and untrustworthy
- Search results are cluttered with redundant entries
- Map shows multiple markers at the same location for the same event
- Picking the "best" version of conflicting data requires a merge strategy
- Database grows unnecessarily large

**Warning signs:**
- Multiple events at the same geocoded location within the same date range
- Event names with high Levenshtein similarity in the same area
- User complaints about duplicate listings

**Prevention:**
1. **Composite dedup key:** Generate a normalized key from: lowercase(event_name) + city_name + month_year. Strip accents, articles (del, della, di), and punctuation before comparison
2. **Fuzzy matching:** Use string similarity (Dice coefficient or Jaro-Winkler) on event names + exact match on city + overlapping date range. Threshold of 0.8 similarity = likely duplicate
3. **Proximity-based dedup:** Events within 1km of each other, with overlapping dates, and name similarity >0.7 = candidate duplicates
4. **Source priority:** Rank sources by data quality. When duplicates are found, prefer the source with the most complete data (has description, has image, has price info). Store source_urls as an array so all original sources are credited
5. **Dedup as a pipeline stage:** Run deduplication AFTER scraping but BEFORE user-facing data is updated. Use a staging table, not direct upsert

**Phase:** Phase 1 (Data Pipeline). Design the dedup strategy with the data model. Retrofitting dedup on a polluted database is extremely painful.

---

### Pitfall 5: Nominatim Geocoding Failures for Small Towns

**What goes wrong:** Nominatim's public API has a strict 1 request/second rate limit and, more critically for this project, struggles with small Italian town names that are ambiguous, have frazioni (hamlets/sub-localities), or use dialectal spellings. "Montecchio Maggiore" might geocode to the wrong Montecchio. "Torri di Quartesolo" might return the municipality centroid instead of the actual event location. "Contrada San Pietro, Rosà" returns nothing because Nominatim does not know the contrada.

**Why it happens:** Italian administrative geography is deeply hierarchical: regione > provincia > comune > frazione > contrada/localita. Sagre often happen in frazioni or specific locations within a comune. Nominatim's OpenStreetMap data for Italian micro-localities is incomplete. Additionally, the 1 req/sec rate limit means geocoding 500 events takes 8+ minutes -- and the Nominatim usage policy explicitly discourages bulk geocoding from apps.

**Consequences:**
- Events placed in wrong locations on the map (neighboring town, wrong province)
- Events with no coordinates at all, excluded from map and proximity search
- "Vicino a me" (near me) feature returns wrong results
- Nominatim may block your IP for violating usage policy
- PostGIS spatial queries return incorrect results based on bad coordinates

**Warning signs:**
- Events geocoded to province capitals instead of small towns
- Events with coordinates outside the Veneto bounding box
- Cluster of events all at the same generic coordinates
- Nominatim returning HTTP 429 or empty results
- Events at sea or in neighboring countries

**Prevention:**
1. **Cache geocoding results aggressively:** Most sagre happen in the same towns year after year. Build a city_name -> coordinates lookup table. Only call Nominatim for genuinely new locations. This also respects Nominatim's caching policy
2. **Seed the geocoding cache:** Pre-populate with all ~581 comuni in Veneto from ISTAT data (freely available). Include major frazioni. This eliminates 90%+ of Nominatim calls
3. **Structured geocoding queries:** Use Nominatim's structured query params (city, state, country) rather than free-text search. Always include "Veneto, Italy" as context. This dramatically improves accuracy for small towns
4. **Bounding box constraint:** Restrict Nominatim results to the Veneto bounding box (viewbox param + bounded=1): lat 44.7-46.7, lon 10.6-13.1. Prevents geocoding to a same-named town in Sicily
5. **Manual override table:** Allow admin correction of geocoded coordinates. Some locations will always need manual placement
6. **Respect the rate limit:** Use a queue with 1100ms delay between requests. Never parallelize Nominatim calls

**Phase:** Phase 1 (Data Model -- seed cache) and Phase 2 (Geocoding Pipeline). Seeding the cache should happen before the first scrape.

---

## Moderate Pitfalls

---

### Pitfall 6: Leaflet + Next.js App Router SSR Hydration Mismatch

**What goes wrong:** Leaflet requires the `window` object, which does not exist during server-side rendering in Next.js. Using `dynamic(() => import('...'), { ssr: false })` solves the initial crash but introduces hydration mismatches and layout shifts. MarkerCluster adds another layer of SSR-incompatible code. Custom marker icons using `L.Icon()` also break during SSR because they reference browser APIs.

**Why it happens:** Leaflet was designed for browser-only usage. React-leaflet wraps it but cannot make it SSR-compatible. Next.js 14 App Router aggressively server-renders components. The combination produces a multi-layered SSR incompatibility.

**Prevention:**
1. **Isolate all map code in a single client component tree:** Create a `MapContainer.tsx` with `"use client"` directive. Import ALL Leaflet-related code (MapContainer, TileLayer, Marker, MarkerClusterGroup, icon setup) inside this file. Never import Leaflet types or code in server components
2. **Use next/dynamic with ssr: false at the page level:** Import the MapContainer component with `dynamic(() => import('./MapContainer'), { ssr: false, loading: () => <MapSkeleton /> })`. Provide a skeleton/placeholder that matches the final map dimensions to prevent layout shift
3. **Marker icons:** Define custom icons inside a useEffect or in a module that is only imported client-side. Do NOT use `new L.Icon()` at module scope
4. **MarkerCluster:** Use `next-leaflet-cluster` or `react-leaflet-cluster` -- both are designed for this exact compatibility issue. Import them inside the client component, never at page level
5. **Test with SSR explicitly:** Run `next build && next start` (not just `next dev`) to catch SSR issues that dev mode hides

**Phase:** Phase 3 (Map UI). Plan the component boundary from the start; do not sprinkle Leaflet imports across multiple files.

---

### Pitfall 7: Vercel Cron + Function Timeout for Scraping

**What goes wrong:** Scraping 5+ websites sequentially in a single Vercel serverless function may exceed the execution time limit. With Fluid Compute enabled (default on Vercel since late 2025), the Hobby plan gets 300 seconds (5 minutes). This sounds generous, but scraping 5 sites with retry logic, rate-limited Nominatim geocoding, and LLM enrichment in a single function can easily take longer.

**Why it happens:** The project plans "scraping 2x/giorno, enrichment 2x/giorno" via Vercel cron. If scraping and enrichment are coupled in one function, the combined time for fetch + parse + geocode + LLM calls for hundreds of events will exceed 5 minutes. Additionally, Vercel Hobby cron jobs can only run at minimum every hour (not every 30 minutes).

**Prevention:**
1. **Separate scraping, geocoding, and enrichment into independent cron jobs:** `scrape` (fetches and parses HTML), `geocode` (processes un-geocoded events), `enrich` (processes un-enriched events). Each should complete in under 2 minutes
2. **Scrape one source per invocation:** Instead of one cron that scrapes all 5 sources, have the cron trigger a function that processes sources sequentially but with a timeout check. If nearing the limit, stop and let the next invocation continue
3. **Use a "process N items" pattern:** Each cron invocation processes a batch of N items (e.g., geocode 50 new locations, enrich 20 new events) rather than trying to process everything
4. **Set maxDuration explicitly:** In your API route, export `const maxDuration = 300` to use the full 5 minutes available on Hobby with Fluid Compute
5. **Chain functions via fetch:** If one pipeline stage needs to trigger another, use internal `fetch()` calls to separate API routes rather than running everything in one function

**Phase:** Phase 1 (Infrastructure). Pipeline architecture must be designed as separate stages from the start.

---

### Pitfall 8: Character Encoding Corruption (Italian Accents)

**What goes wrong:** Italian text contains frequent accented characters (a, e, e, i, o, u) and occasional special characters (typographic quotes, em dashes). Some source websites serve content as ISO-8859-1 or Windows-1252 rather than UTF-8. Cheerio may misinterpret the encoding, producing garbled text like "SagrA del BaccalA " instead of "Sagra del Baccala".

**Why it happens:** Older Italian websites (common in the sagre ecosystem) may not declare charset in HTTP headers or HTML meta tags, or may declare charset inconsistently. Cheerio defaults to UTF-8 but does not auto-detect encoding. The fetch response may arrive as a raw buffer that needs manual decoding.

**Prevention:**
1. **Detect encoding before parsing:** Check the `Content-Type` header for charset. If absent, check the `<meta charset>` tag in the raw HTML buffer. Fall back to heuristic detection using `chardet` or `jschardet`
2. **Use iconv-lite for conversion:** Convert the response buffer to UTF-8 using `iconv-lite` before passing to Cheerio: `iconv.decode(buffer, detectedEncoding)`
3. **Validate output:** After parsing, scan extracted text for common garbled patterns (sequences of `Ã`, `Â`, `Â°`, etc.). Flag these for encoding review
4. **Fetch as buffer, not string:** Use `response.arrayBuffer()` instead of `response.text()` when fetching, so you control the decoding step

**Phase:** Phase 1 (Scraping). Must be handled in the HTTP fetch layer before any parsing.

---

### Pitfall 9: PostGIS Spatial Index Missing or Misconfigured

**What goes wrong:** Spatial queries (find_nearby_sagre RPC, bounding box searches for map view) run slowly or time out because the geometry column lacks a proper spatial index. On Supabase free tier with shared compute, an unindexed spatial query on even a few thousand rows can take seconds instead of milliseconds.

**Why it happens:** Enabling PostGIS extension does not automatically create spatial indexes on your tables. Developers store coordinates as separate lat/lng float columns instead of using PostGIS geometry/geography types, then wonder why `ST_DWithin` is slow. Or they create a geometry column but forget the `CREATE INDEX ... USING GIST(geom)` step.

**Prevention:**
1. **Use geography type, not separate lat/lng columns:** Store location as `geography(Point, 4326)`. This allows all PostGIS spatial operators and enables GiST indexing
2. **Create the spatial index in migration:** `CREATE INDEX idx_sagre_location ON sagre USING GIST(location);` -- this must be in the initial migration, not added later
3. **Use `ST_DWithin` for radius queries:** It uses the spatial index. Avoid `ST_Distance < X` without ORDER BY which does a full table scan
4. **Test with explain analyze:** On Supabase dashboard SQL editor, run `EXPLAIN ANALYZE` on your spatial queries to verify the index is being used
5. **RPC function for proximity:** Create a Supabase RPC function `find_nearby_sagre(lat, lng, radius_meters)` that uses `ST_DWithin` internally. Call this from the client rather than constructing raw PostGIS queries

**Phase:** Phase 1 (Database Schema). Spatial index must be part of the initial table creation migration.

---

### Pitfall 10: Supabase Free Tier Project Pausing

**What goes wrong:** Supabase pauses free tier projects after 7 days of inactivity. When a paused project receives a request, it needs 1-2 minutes to cold-start. During this time, the app is completely unresponsive. If the project goes through a period with no real user traffic (e.g., winter off-season for sagre), it will be paused and the first user in spring gets a broken experience.

**Why it happens:** Supabase reclaims compute resources from inactive free projects. The cron jobs (scraping, enrichment) count as activity, but if cron jobs fail or are misconfigured, the project may become "inactive" from Supabase's perspective.

**Prevention:**
1. **Cron jobs are your keepalive:** The planned 2x/day scraping cron will keep Supabase active. Ensure at least one cron hits the Supabase database daily, even if there are no events to scrape
2. **Fallback keepalive:** Set up a simple GitHub Actions workflow (5 lines of YAML) that pings the Supabase REST API every 3 days as insurance
3. **Handle cold starts gracefully:** If the first request after a pause times out, the app should show a "loading" state rather than an error page. Implement retry logic on the frontend for initial data fetches

**Phase:** Phase 1 (Infrastructure). Set up keepalive mechanism alongside the first cron job deployment.

---

## Minor Pitfalls

---

### Pitfall 11: SEO Metadata from LLM-Generated Content

**What goes wrong:** Using LLM-generated descriptions as SEO meta descriptions or OG titles may produce inconsistent quality. Some descriptions may be too generic ("Una bellissima sagra con tanti piatti tipici"), others may hallucinate details not in the source data, and some may be truncated awkwardly for OG image text.

**Prevention:**
1. Constrain LLM descriptions to max 250 characters (already planned) and validate they contain the event name and location
2. Use original scraped event name + city for title/OG title, not LLM-generated text
3. Generate OG images with structured templates (event name, date, city) rather than free-form LLM text

**Phase:** Phase 3 (SEO). Low risk but easy to get wrong aesthetically.

---

### Pitfall 12: Leaflet CSS Not Loading

**What goes wrong:** Leaflet's default CSS (`leaflet/dist/leaflet.css`) is not imported or is imported in the wrong place, causing the map to render with broken tiles (stacked, wrong position) and invisible controls. This is a very common first-time Leaflet mistake.

**Prevention:**
1. Import `leaflet/dist/leaflet.css` in the root layout or in the map client component
2. Also import MarkerCluster CSS if using clustering: `react-leaflet-cluster/lib/assets/MarkerCluster.css` and `MarkerCluster.Default.css`
3. Verify visually in the first map implementation -- broken CSS is immediately visible

**Phase:** Phase 3 (Map UI). Takes 5 minutes to fix but can waste hours debugging if not recognized.

---

### Pitfall 13: Over-Engineering the UI Component Stack

**What goes wrong:** The project plans Shadcn/UI + Magic UI + Framer Motion + ReactBits. Combining 4 animation/UI libraries increases bundle size, creates conflicting animation systems, and makes debugging visual issues harder. Components from different libraries may have incompatible styling assumptions.

**Prevention:**
1. Start with Shadcn/UI only for Phase 1-2. It is the foundation and provides everything needed for functional UI
2. Add Framer Motion for specific, targeted animations (page transitions, card reveals) in a later polish phase
3. Evaluate Magic UI and ReactBits -- pick one for "premium" effects, not both. These libraries often overlap in functionality
4. Monitor bundle size with `@next/bundle-analyzer`. Set a budget (e.g., <200KB first load JS)

**Phase:** Phase 3 (UI Polish). Do not install all four libraries on day one.

---

### Pitfall 14: GDPR and Italian Privacy Law (Garante)

**What goes wrong:** While scraping publicly available event data (not personal data) is generally low-risk under GDPR, the Italian Garante (data protection authority) has been particularly aggressive about web scraping enforcement. If any scraped page contains organizer names, phone numbers, or email addresses, and these are stored/displayed, this constitutes personal data processing under GDPR.

**Prevention:**
1. **Scrape only event data:** Titles, dates, locations, descriptions, food types. Do NOT scrape or store organizer personal contact details (phone numbers, personal emails)
2. **Strip personal data in pipeline:** If organizer info appears in scraped text, strip it before storage or ask the LLM to remove personal details during enrichment
3. **Link to source:** Instead of reproducing full content, link to the original event page. This respects both copyright and privacy
4. **robots.txt compliance:** Check and respect robots.txt on each source site. Document compliance

**Phase:** Phase 1 (Scraping Pipeline). Define what fields to extract and what to exclude from the start.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Phase 1: Data Model | Separate lat/lng columns instead of PostGIS geometry | Use `geography(Point, 4326)` from day one, create GiST index |
| Phase 1: Scraping Pipeline | Silent breakage, no monitoring | Build health metrics and zero-result alerting into the first scraper |
| Phase 1: Scraping Pipeline | Encoding corruption of Italian accents | Detect encoding before Cheerio parsing, use iconv-lite |
| Phase 1: Data Pipeline | Duplicate events across sources | Design dedup key and fuzzy matching before populating prod data |
| Phase 2: Geocoding | Nominatim failures for small towns, rate limit violations | Seed cache with ISTAT comuni data, use structured queries with bounding box |
| Phase 2: LLM Enrichment | Gemini free tier quota exhaustion | Batch 5-10 events per prompt, only enrich changed events, track daily usage |
| Phase 2: LLM Enrichment | Italian date parsing failures | Delegate date extraction to Gemini prompt, validate output |
| Phase 3: Map UI | Leaflet SSR crash / hydration mismatch | Isolate all Leaflet code in one `"use client"` component, use `dynamic({ ssr: false })` |
| Phase 3: Map UI | Missing Leaflet CSS, broken tile rendering | Import leaflet CSS in root layout or map component |
| Phase 3: UI Polish | Over-engineered component stack, bundle bloat | Start with Shadcn/UI only, add animation libraries incrementally |
| Infrastructure | Vercel cron timeout exceeding 5min | Separate scrape/geocode/enrich into independent functions |
| Infrastructure | Supabase project pausing in off-season | Cron jobs serve as keepalive; add GitHub Actions fallback |
| Legal | GDPR personal data in scraped content | Scrape only event data, strip personal info, respect robots.txt |

---

## Sources

### Scraping Fragility
- [Web Scraping in 2025: What Worked, What Broke, What's Next](https://oxylabs.io/blog/web-scraping-in-2025-what-worked-what-broke-whats-next) - MEDIUM confidence
- [The Problem With XPath, CSS Selectors, and Keeping Your Scraper Alive](https://extractdata.substack.com/p/why-xpath-css-selectors-break-scrapers) - MEDIUM confidence
- [Cheerio encoding issues](https://webscraping.ai/faq/cheerio/how-do-you-handle-encoding-issues-with-cheerio) - HIGH confidence (matches official Cheerio behavior)

### Gemini Rate Limits
- [Gemini API Rate Limits - Official](https://ai.google.dev/gemini-api/docs/rate-limits) - HIGH confidence (official docs)
- [Gemini API Free Tier Rate Limits 2026](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits) - MEDIUM confidence (third-party but verified against official)
- [Gemini has slashed free API limits](https://www.howtogeek.com/gemini-slashed-free-api-limits-what-to-use-instead/) - HIGH confidence (widely reported December 2025 changes)

### Nominatim
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) - HIGH confidence (official OSM Foundation)
- [Best geocoding providers for Italy](https://coordable.co/blog/country-analysis/best-geocoding-providers-italy/) - MEDIUM confidence

### Leaflet + Next.js
- [react-leaflet SSR issue #1152](https://github.com/PaulLeCam/react-leaflet/issues/1152) - HIGH confidence (official repo)
- [React Leaflet on Next.js 15 App Router](https://xxlsteve.net/blog/react-leaflet-on-next-15/) - MEDIUM confidence
- [next-leaflet-cluster](https://github.com/fachryansyah/next-leaflet-cluster) - MEDIUM confidence

### Vercel
- [Vercel Function Duration Docs](https://vercel.com/docs/functions/configuring-functions/duration) - HIGH confidence (official, confirms 300s Hobby with Fluid Compute)
- [Vercel Cron Jobs Docs](https://vercel.com/docs/cron-jobs) - HIGH confidence (official)

### Supabase
- [Supabase PostGIS Docs](https://supabase.com/docs/guides/database/extensions/postgis) - HIGH confidence (official)
- [Supabase Free Tier Pausing Prevention](https://github.com/travisvn/supabase-pause-prevention) - MEDIUM confidence
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security) - HIGH confidence (official)

### GDPR / Italian Privacy
- [Italian DPA web scraping enforcement](https://morrirossetti.it/en/insight/publications/the-italian-data-protection-authority-puts-a-stop-to-web-scraping.html) - HIGH confidence (Italian law firm analysis)
- [Web Scraping GDPR 2025](https://medium.com/deep-tech-insights/web-scraping-in-2025-the-20-million-gdpr-mistake-you-cant-afford-to-make-07a3ce240f4f) - MEDIUM confidence
