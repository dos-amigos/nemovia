# Roadmap: Nemovia

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-05)
- 🚧 **v1.1 Dati Reali** — Phases 7-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-05</summary>

- [x] Phase 1: Foundation & Design System (2/2 plans) — completed 2026-03-04
- [x] Phase 2: Scraping Pipeline (4/4 plans) — completed 2026-03-04
- [x] Phase 3: Data Enrichment (3/3 plans) — completed 2026-03-04
- [x] Phase 4: Discovery UI (3/3 plans) — completed 2026-03-05
- [x] Phase 5: Map & Detail (3/3 plans) — completed 2026-03-05
- [x] Phase 6: SEO & Polish (3/3 plans) — completed 2026-03-05

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### v1.1 Dati Reali

- [x] **Phase 7: Deploy & Verify Baseline** - Deploy geocoding fix and confirm eventiesagre scraper produces valid enriched data end-to-end (completed 2026-03-06)
- [ ] **Phase 8: Fix Cheerio Scrapers** - Repair CSS selectors for assosagre, solosagre, and venetoinfesta so all Cheerio-based sources produce valid sagre
- [ ] **Phase 9: Sagritaly Ingestion** - Ingest sagre from sagritaly using an approach that handles JS-rendered content
- [ ] **Phase 10: Data Quality Filters** - Filter out non-Veneto events, noise titles, and dirty location text so the pipeline produces clean data

## Phase Details

### Phase 7: Deploy & Verify Baseline
**Goal**: The existing pipeline runs end-to-end with correct geocoding, and the one active scraper (eventiesagre) reliably produces enriched sagre with valid coordinates
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: DEPLOY-01, SCRAPE-01
**Success Criteria** (what must be TRUE):
  1. enrich-sagre Edge Function is deployed to Supabase production and runs without errors on its next cron invocation
  2. Sagre geocoded after the deploy have valid PostGIS coordinates (not null, not 0,0) visible on the map
  3. eventiesagre scraper runs on its cron schedule and inserts new sagre rows with title, dates, location_text, and source_url populated
  4. End-to-end pipeline confirmed: a sagra scraped from eventiesagre appears on nemovia.vercel.app with coordinates, tags, and description within one cron cycle
**Plans:** 1/1 plans complete
Plans:
- [x] 07-01-PLAN.md — Deploy enrich-sagre fix, trigger pipeline, verify end-to-end data flow

### Phase 8: Fix Cheerio Scrapers
**Goal**: All three broken Cheerio-based scraper sources (assosagre, solosagre, venetoinfesta) produce valid sagre data from their live sites
**Depends on**: Phase 7
**Requirements**: SCRAPE-02, SCRAPE-03, SCRAPE-04
**Success Criteria** (what must be TRUE):
  1. assosagre scraper runs and inserts sagre with title, dates, and location_text populated (no null critical fields)
  2. solosagre scraper runs and inserts sagre with title, dates, and location_text populated (no null critical fields)
  3. venetoinfesta scraper runs and inserts sagre with title, dates, and location_text populated (no null critical fields)
  4. All three sources' sagre appear on the live site after enrichment (geocoded, tagged, with descriptions)
**Plans:** 3 plans
Plans:
- [ ] 08-01-PLAN.md — Fix assosagre scraper CSS selectors and extraction logic
- [ ] 08-02-PLAN.md — Fix solosagre scraper CSS selectors and extraction logic
- [ ] 08-03-PLAN.md — Fix venetoinfesta scraper CSS selectors, base URL, and extraction logic

### Phase 9: Sagritaly Ingestion
**Goal**: Sagre data from sagritaly.it is ingested into the pipeline despite the site using JS rendering that Cheerio cannot parse
**Depends on**: Phase 7
**Requirements**: SCRAPE-05
**Success Criteria** (what must be TRUE):
  1. Sagritaly sagre are ingested into the sagre table with title, dates, location_text, and source_url populated
  2. Ingested sagritaly sagre pass through enrichment (geocoding + LLM tagging) successfully
  3. The ingestion approach works within Supabase Edge Function constraints (or has a viable alternative execution path)
**Plans**: TBD

### Phase 10: Data Quality Filters
**Goal**: The pipeline produces clean, Veneto-only sagre data by filtering out geographic mismatches, noise entries, and normalizing location text for accurate geocoding
**Depends on**: Phase 8, Phase 9
**Requirements**: QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. Events with locations outside Veneto (wrong region, other Italian regions, foreign) are excluded from the active sagre visible to users
  2. Entries with noise or invalid titles (ads, site navigation text, generic non-event strings) are detected and excluded
  3. location_text values are cleaned/normalized before geocoding, resulting in a higher geocoding success rate (fewer null coordinates)
  4. Existing pipeline data is retroactively cleaned (not just new scrapes)
**Plans**: TBD

## Progress

**Execution Order:**
Phases 7 through 10. Phase 8 and Phase 9 can run in parallel (both depend on Phase 7, not on each other). Phase 10 depends on both 8 and 9.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Design System | v1.0 | 2/2 | Complete | 2026-03-04 |
| 2. Scraping Pipeline | v1.0 | 4/4 | Complete | 2026-03-04 |
| 3. Data Enrichment | v1.0 | 3/3 | Complete | 2026-03-04 |
| 4. Discovery UI | v1.0 | 3/3 | Complete | 2026-03-05 |
| 5. Map & Detail | v1.0 | 3/3 | Complete | 2026-03-05 |
| 6. SEO & Polish | v1.0 | 3/3 | Complete | 2026-03-05 |
| 7. Deploy & Verify Baseline | v1.1 | Complete    | 2026-03-06 | 2026-03-06 |
| 8. Fix Cheerio Scrapers | v1.1 | 0/3 | Not started | - |
| 9. Sagritaly Ingestion | v1.1 | 0/? | Not started | - |
| 10. Data Quality Filters | v1.1 | 0/? | Not started | - |
