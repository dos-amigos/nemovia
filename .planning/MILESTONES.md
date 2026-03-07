# Milestones

## v1.1 Dati Reali (Shipped: 2026-03-07)

**Delivered:** Data pipeline fix — all 5 scraper sources active with data quality filters producing 735 clean Veneto sagre.

**Phases completed:** 4 phases, 7 plans
**Commits:** 29 | **Source files changed:** 9 | **LOC delta:** +385/-46 TypeScript
**Timeline:** 3 days (2026-03-04 → 2026-03-07)
**Git range:** `4568d59` → `27a53f3`

**Key accomplishments:**
1. Deployed enrich-sagre Edge Function with PostGIS WKT geocoding fix, verified end-to-end pipeline
2. Fixed all 3 broken Cheerio scrapers (assosagre, solosagre, venetoinfesta) with source-specific CSS selectors
3. Added sagritaly.com as 5th active scraper source via Cheerio (WordPress SSR, not JS-rendered)
4. Implemented noise title detection, location text normalization, and Veneto province gating
5. Retroactive data cleanup: 36 dirty rows deactivated, 735 clean active sagre remaining
6. All 5 configured scraper sources now active and producing valid enriched data

---

## v1.0 MVP (Shipped: 2026-03-05)

**Delivered:** Sagre aggregator for the Veneto region — scraping, enrichment, discovery UI, interactive map, and SEO — all zero-cost.

**Phases completed:** 6 phases, 18 plans
**Commits:** 85 | **Files:** 159 | **LOC:** 3,514 TypeScript
**Timeline:** 2 days (2026-03-04 → 2026-03-05)
**Git range:** `feat(01-01)` → `feat(06-03)`

**Key accomplishments:**
1. Next.js 15 + Supabase PostGIS foundation with mobile-first BottomNav shell and brand design system
2. Config-driven scraping pipeline collecting sagre from 5 sources with dedup, scheduling, and expiration
3. Gemini LLM enrichment (food tags, descriptions) + Nominatim geocoding on automated schedule
4. Homepage with weekend sagre, emoji quick filters, province counts, and filterable search page
5. Interactive Leaflet map with clustering, geolocation, and sagra detail pages with sharing/directions
6. SEO infrastructure (dynamic metadata, sitemap, OG images) + premium scroll animations with Motion

**Known Gaps (from audit):**
- Only 1 of 5 scraper sources active (eventiesagre) — others have broken CSS selectors
- sagritaly is JS-rendered — needs headless browser or API alternative
- Data quality: some scraped events are not sagre or not from Veneto
- Missing VERIFICATION.md for Phases 1 and 3 (process gap, not implementation gap)

**Tech debt:**
- Scraper source fixes (assosagre, solosagre, venetoinfesta CSS selectors)
- Non-Veneto event filtering
- Italian date format edge cases

---

