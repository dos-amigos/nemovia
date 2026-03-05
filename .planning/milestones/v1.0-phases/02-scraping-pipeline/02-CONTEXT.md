# Phase 2: Scraping Pipeline - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Config-driven automated scraping of sagre from 5+ Veneto sources, with deduplication and automatic expiration of past events. Scheduling via Supabase pg_cron + Edge Functions. Geocoding and LLM enrichment are Phase 3 — not in scope here.

</domain>

<decisions>
## Implementation Decisions

### Source failure handling
- When a source fails (network down, bad HTML, timeout): log the failure, skip that source, continue scraping the rest
- All scraping runs are recorded in a `scrape_logs` Supabase table: source, status (success/error), events_found, error_message, timestamp
- After 3 consecutive failures, set `is_active = false` on the source config — prevents wasting time on permanently broken sources
- Re-enabling a dead source is a manual DB update

### Deduplication matching
- Duplicate detection: normalized name (lowercase, strip accents, remove punctuation) + city + overlapping dates
- When a duplicate is found: keep the existing record, update any missing fields with data from the new source (enrichment strategy, not overwrite)
- Track provenance: `sources` column (text[]) records which sites list each sagra — useful for debugging and future "verified by N sources" UI
- If the duplicate has no new information to contribute, discard silently (no error)

### CSS selector bootstrapping
- Initial selectors for all 5 sources provided in a SQL seed file (manual execution in Supabase SQL Editor, same pattern as Phase 1 migration)
- Core fields only per source config: title, dates, city, price, url, image — no description/organizer (Phase 3 LLM enrichment fills those)
- Pagination: each source config includes an optional `next_page_selector` or `url_pattern` (e.g., `?page={n}`) with a `max_pages` limit; scraper follows pages automatically

### Image handling
- Store scraped image URL as-is in the DB — no download or re-hosting
- No URL validation during scraping (no HEAD requests) — keeps scraper fast
- UI handles broken image URLs lazily with Next.js Image `onError` fallback

### Claude's Discretion
- Exact normalization algorithm for name comparison (how to handle special Italian chars, multiple spaces, etc.)
- How "overlapping dates" is computed (exact overlap vs. same-month heuristic)
- Edge Function architecture (one function per source vs. one orchestrator) — choose based on Supabase limits
- `scrape_logs` table schema details
- `max_pages` default value
- Rate limiting / politeness delay between requests to the same source

</decisions>

<specifics>
## Specific Ideas

- The scraper should feel like a set-and-forget cron — developer only touches it when a source site changes its HTML structure
- Broken sources should be self-healing where possible (auto-disable, easy re-enable) rather than requiring constant monitoring
- The `sources` array tracking sets up a future "found on X sources" trust signal in the UI

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/server.ts`: async server Supabase client — use in Edge Functions for DB writes
- `src/lib/supabase/client.ts`: browser client — not relevant for scraper (server-only)

### Established Patterns
- SQL migration files run manually in Supabase SQL Editor (no Supabase CLI) — seed file for source configs follows same pattern
- Environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY already configured

### Integration Points
- Scraper runs as Supabase Edge Function (not Next.js) — writes directly to `sagre` table and `scrape_logs`
- pg_cron schedules the Edge Function invocations (2x/day scraping already decided)
- Phase 3 reads from `sagre` table (rows with missing geocoding/tags) — scraper output is Phase 3's input

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-scraping-pipeline*
*Context gathered: 2026-03-04*
