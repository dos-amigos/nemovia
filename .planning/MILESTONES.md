# Milestones

## v1.3 Dati Puliti + Redesign (Shipped: 2026-03-10)

**Delivered:** Data quality overhaul + UI/UX redesign — heuristic filters, LLM classification, fuzzy dedup, Geist/OKLCH palette, glassmorphism, mesh gradients, bento grid, and LazyMotion performance optimization.

**Phases completed:** 4 phases, 9 plans
**Commits:** 60 | **Source files changed:** 34 | **LOC delta:** +1173/-259 TypeScript/CSS
**Timeline:** 2 days (2026-03-09 → 2026-03-10)
**Git range:** `a32b302` → `01b7aaf`

**Key accomplishments:**
1. TDD-built heuristic filters reject noise titles, calendar spam, >7-day events, and past-year events from scrape pipeline with retroactive production cleanup
2. LLM is_sagra classification in existing Gemini enrichment (zero additional API calls) deactivates non-sagre (antiquariato, mostre, mercati)
3. pg_trgm fuzzy dedup with GIN trigram index eliminates near-duplicate events (title + city similarity + date overlap)
4. Geist font + vibrant coral/teal OKLCH palette replace dated amber/stone aesthetic across all 25+ Shadcn tokens
5. Glassmorphism nav bars, mesh gradient hero, image-overlay SagraCard, and bento grid homepage deliver WOW factor
6. LazyMotion migration (~28KB initial JS reduction) with async domMax loading and strict mode leak detection

---

## v1.2 Polish (Shipped: 2026-03-09)

**Delivered:** UX polish — bug fixes, responsive desktop layout, page transitions, micro-interactions, and scroll animations for a premium feel on every device.

**Phases completed:** 3 phases, 7 plans
**Commits:** 37 | **Source files changed:** 29 | **LOC delta:** +571/-260 TypeScript/CSS
**Timeline:** 3 days (2026-03-07 → 2026-03-09)
**Git range:** `ad0d5fc` → `9102f9e`

**Key accomplishments:**
1. Fixed 4 UX bugs (back button, image placeholder, Cerca default filter, desktop width) and established accessibility foundation with reduced-motion and focus-visible support
2. Built responsive desktop layout with TopNav, multi-column grids (1/2/3/4 cols), side-by-side detail page with sticky left column
3. Added smooth page cross-fade transitions with FrozenRouter pattern and shimmer gradient skeleton loaders
4. Implemented card hover/tap micro-interactions, FadeImage progressive loading, button press animations, and badge hover effects
5. Added scroll-linked animations: progress bar, directional section reveals, and mobile-only parallax hero

---

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

