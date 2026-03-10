# Project Research Summary

**Project:** Nemovia v1.4 "Esperienza Completa"
**Domain:** Food festival aggregator UX enhancement + data quality fixes
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

Nemovia v1.4 aims to transform the homepage from a static grid into a Netflix-style browsable discovery experience while addressing critical data quality issues. Research reveals that the most critical issue is the event count collapse (26 active events vs 735 previously), which makes every UI feature appear broken. **Data pipeline restoration MUST precede all UI work.** The current stack (Next.js 15, Supabase PostGIS, Motion with LazyMotion) is well-suited for the planned enhancements, requiring only one new npm dependency (`cmdk` for city autocomplete).

The recommended approach uses zero-dependency solutions where possible: CSS scroll-snap for Netflix rows (not a carousel library), static JSON for city autocomplete (not Nominatim API), and pre-cached Unsplash images (not runtime API calls). The critical path is: fix data pipeline → enhance images → rebuild homepage with full-width layout and scroll rows → add city search. This order ensures UI features are built against a healthy dataset and avoids three catastrophic pitfalls: Nominatim autocomplete (IP ban), Unsplash runtime API calls (rate limit exhaustion), and layout changes before data fixes (building on empty data).

Key risks are all mitigated with established patterns: Nominatim explicitly forbids autocomplete (use local city database instead), Unsplash free tier is 50 req/hour (pre-fetch and cache images), and full-width layout requires per-section breakout (not removing global constraints). The architecture leverages existing server component patterns, nuqs URL state, and Edge Functions with inline filter copies (established pattern). Total new code surface is ~24-38 hours of work across 4 phases with well-defined dependencies.

## Key Findings

### Recommended Stack

The existing stack handles v1.4 requirements with minimal additions. Only `cmdk` (4KB) is needed for the Shadcn Combobox pattern. No carousel libraries, no Unsplash SDK, no Nominatim wrappers.

**New npm dependencies:**
- **cmdk@1.1.1:** Command/search component for city autocomplete — Shadcn-native, zero dependencies, keyboard-accessible, optimized scoring

**New Shadcn components (generated .tsx, no npm deps):**
- **Popover:** Dropdown container for autocomplete suggestions
- **Command:** Searchable list inside Popover (requires cmdk)
- **Slider:** Radius km selector (5-100km)

**New environment variables:**
- **UNSPLASH_ACCESS_KEY:** Free Unsplash API access (50 req/hr demo, 5000/hr production approval)

**New static assets:**
- **veneto-comuni.json:** ~580 Veneto municipalities with name, province code, lat, lng (~25KB)

**Critical rejections:**
- **Swiper/react-slick/Embla:** CSS scroll-snap handles Netflix rows natively
- **unsplash-js:** Unnecessary wrapper over fetch, adds TypeScript dom lib issues
- **react-select/downshift:** Shadcn Combobox is lighter and matches design system
- **Nominatim autocomplete:** Explicitly forbidden by usage policy, use static data

### Expected Features

**Must have (table stakes):**
- **Fix event count drop (26 vs 735):** Critical blocker — investigate scraper logs, source failures, filter aggressiveness before any UI work
- **Fix broken map on search page:** State sync issue between nuqs filters and map data fetching
- **Fix events outside Veneto:** Tighten Nominatim bounding box (`viewbox` + `bounded=1`)
- **Fix non-sagre still present:** Add heuristic pre-filters (passeggiata, carnevale, concerto, mostra)
- **Province always visible:** Normalize to 2-letter codes (VI, PD) at pipeline time, display as "City (XX)"
- **Unsplash fallback images:** Pre-fetch curated food images, assign during enrichment (not render time)
- **Fix placeholder visibility:** Resolved by Unsplash fallbacks

**Should have (differentiators):**
- **Netflix scroll rows:** Horizontal CSS scroll-snap rows with smart categories (weekend, nearby, cuisine, province)
- **Photo hero with Unsplash:** Full-bleed hero with food photo, search bar embedded, ISR cached 1hr
- **City autocomplete + radius:** Supabase DISTINCT query for cities (not Nominatim), Shadcn Combobox, slider integration
- **Custom SVG logo:** Coral/teal palette, inline component, theme-integrated with currentColor
- **Full footer:** Credits, links, "Fatto con cuore in Veneto", Unsplash attribution
- **Map page filters:** Reuse SearchFilters on dedicated /mappa page
- **Full-width layout:** Negative margin breakout for hero/rows, keep max-w-7xl for content

**Defer (v2+):**
- **New scraper sources:** Finding, testing, building scrapers is separate effort unless event count drop requires it
- **Scrape complete info:** Menu, orari extraction requires per-source modifications, medium complexity, low urgency

### Architecture Approach

The architecture leverages existing server component patterns with selective client-side hydration. Server components fetch data via multiple parallel queries (Promise.all), pass as props to client components for interactivity. Netflix rows use CSS scroll-snap with negative margin breakout from the max-w-7xl container (established pattern in MappaClientPage.tsx). City autocomplete uses a Route Handler (`/api/cities`) with Supabase DISTINCT query to avoid exposing anon key. Unsplash integration is server-only with ISR caching (`next: { revalidate: 3600 }`), storing URLs in database to avoid runtime API calls. Data quality fixes happen in Edge Functions using the established inline copy pattern (Deno import constraint).

**Major components:**
1. **ScrollRow (client):** Horizontal snap-scroll container with `overflow-x: auto snap-x snap-mandatory`, negative margins for edge-to-edge, reuses existing SagraCard
2. **CityAutocomplete (client):** Debounced Supabase city query via Route Handler, Shadcn Combobox pattern, single Nominatim geocode on selection (policy-compliant)
3. **Unsplash integration (server):** Pre-fetch hero images with ISR, assign card fallbacks during enrichment pipeline, store URLs + attribution in database
4. **Full-width layout:** Keep max-w-7xl in layout, use negative margin breakout (`-mx-4 sm:-mx-6 lg:-mx-8`) for hero and scroll rows
5. **Data quality filters:** Add isNonSagraTitle() heuristic, Veneto bounding box to Nominatim, province code normalization at pipeline time

### Critical Pitfalls

1. **Nominatim explicitly forbids autocomplete — city search will get IP banned** — Use static JSON of Veneto comuni (563 items, ~25KB) with client-side filtering. Single Nominatim geocode only on final city selection. Never call Nominatim on keystrokes. Violation breaks the entire geocoding pipeline used by enrich-sagre Edge Function.

2. **Unsplash API free tier is 50 req/hour — hero image breaks on any traffic** — Pre-fetch 10-20 hero images at build time, store URLs in database, rotate client-side. Pre-map food categories to curated images for card fallbacks. Zero runtime API calls. Apply for production (5000/hr) before launch. Trigger download tracking server-side once per image, not per view.

3. **Netflix scroll rows on existing bento grid create layout chaos** — Replace bento grid entirely, don't layer on top. Deduplicate across rows (weekend excludes from nearby, nearby excludes from cuisine). Minimum 3 cards per row or hide row. Lazy-render rows 3+ with IntersectionObserver. CSS scroll-snap, no JS carousel library.

4. **Full-width layout migration breaks every existing page** — Keep max-w-7xl in layout. Use negative margin breakout for hero and scroll rows (`-mx-4 sm:-mx-6 lg:-mx-8` pattern already in MappaClientPage). Never remove global constraint. Test at 1920px, 2560px for text readability (max 75 chars per line).

5. **Event count collapse (26 vs 735) makes every new feature look broken** — Fix data pipeline BEFORE any UI work. Investigate scraper_logs for errors, check scraper_sources for disabled sources, review filter rejection rates. With 26 events, Netflix rows have 1-2 cards each (worse than no feature). This is the critical blocker for all v1.4 features.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Pipeline Restoration
**Rationale:** Event count collapse is the critical blocker. Building UI features against 26 events produces misleading results and broken-looking features. Data health must be restored first.

**Delivers:** Active sagre count restored to 100+, all scraper sources healthy, province normalization, tighter Veneto gating, non-sagre filters

**Addresses:** TS-7 (event count drop), TS-5 (events outside Veneto), TS-6 (non-sagre), TS-4 (province display), TS-1 (broken map)

**Avoids:** Pitfall #6 (building on empty data), establishes foundation for all subsequent phases

**Tasks:**
- Investigate scraper_logs and scraper_sources for failures
- Add Veneto bounding box to Nominatim geocoding (`viewbox` + `bounded=1`)
- Add isNonSagraTitle() heuristic filter in both src/lib and Edge Function
- Normalize province to 2-letter codes at pipeline time + SQL migration
- Fix SearchFilters map state sync issue
- Review filter aggressiveness (query rejection reasons)
- Add new scraper sources if needed to restore count

### Phase 2: Image Quality Foundation
**Rationale:** Unsplash integration requires careful architectural decisions (pre-fetch vs runtime calls, attribution compliance). Establishing this foundation early allows both hero and card fallbacks to share infrastructure.

**Delivers:** Unsplash pre-fetched image cache, hero image rotation system, card fallback assignment during enrichment, attribution component

**Uses:** Unsplash API with ISR caching, database storage for URLs + attribution

**Addresses:** D-2 (photo hero), TS-3 (Unsplash fallbacks), TS-2 (placeholder visibility)

**Avoids:** Pitfall #2 (runtime API calls), Pitfall #5 (non-compliance)

**Tasks:**
- Create lib/unsplash.ts with ISR caching (revalidate: 3600)
- Pre-fetch 10-20 hero images, store in hero_images table
- Create UnsplashAttribution component with UTM params
- Add Unsplash fallback pass to enrich-sagre (post-LLM)
- Database: add image_credit TEXT column to sagre table
- Test download tracking (call download_location once per image)

### Phase 3: Layout and Branding Foundation
**Rationale:** Full-width layout changes affect all subsequent UI work (hero, scroll rows, footer). Establishing the negative margin breakout pattern and SVG logo early creates a stable foundation.

**Delivers:** Full-width layout with selective breakout pattern, SVG logo, complete footer with credits

**Implements:** Full-width layout architecture (negative margins for hero/rows, keep max-w-7xl for content)

**Addresses:** D-7 (full-width layout), D-4 (SVG logo), D-5 (footer)

**Avoids:** Pitfall #4 (breaking existing pages)

**Tasks:**
- Design SVG logo (coral primary + teal accent, inline component)
- Create Footer component with credits, links, Unsplash attribution
- Update TopNav with SVG logo
- Test negative margin breakout pattern in page.tsx
- Verify all pages (Cerca, Mappa, Sagra detail) still correct at 1920px, 2560px
- Maintain px-4 mobile padding in full-width sections

### Phase 4: Netflix Rows and Homepage Transformation
**Rationale:** With clean data (Phase 1), Unsplash infrastructure (Phase 2), and layout foundation (Phase 3), the Netflix rows can be built against a healthy dataset using established patterns.

**Delivers:** Homepage with horizontal scroll rows, photo hero with search bar, QuickFilters repositioned, bento grid replaced

**Uses:** CSS scroll-snap, existing SagraCard, multiple parallel server queries, Unsplash hero from Phase 2

**Addresses:** D-1 (Netflix rows), D-2 (photo hero integration), homepage replacement

**Avoids:** Pitfall #3 (layout chaos via deduplication and replacement strategy)

**Tasks:**
- Create ScrollRow (client) and ScrollRowSection (server) components
- Add query functions: getSagreByFoodTag, getSagreByProvince, getPopularSagre
- Implement row deduplication logic (weekend excludes from nearby, etc.)
- Replace bento grid with 4-5 scroll rows
- Integrate Unsplash hero with HeroSection
- Add minimum card threshold (3+ or hide row)
- Lazy-render rows 3+ with IntersectionObserver
- Test at 60+ total cards for performance

### Phase 5: City Search and Radius
**Rationale:** Depends on hero layout from Phase 4. City autocomplete is a complex feature requiring Route Handler, static city dataset, and nuqs integration.

**Delivers:** City autocomplete search bar in hero, radius slider, Supabase city query, integration with existing SearchFilters

**Uses:** Static veneto-comuni.json (~580 items), Shadcn Combobox (cmdk), Supabase DISTINCT query via Route Handler

**Addresses:** D-3 (city autocomplete + radius)

**Avoids:** Pitfall #1 (Nominatim autocomplete ban via static dataset)

**Tasks:**
- Source and create veneto-comuni.json with name, province, lat, lng
- Create /api/cities Route Handler with DISTINCT ILIKE query
- Install cmdk@1.1.1, add Shadcn Popover + Command + Slider components
- Create CityAutocomplete component with useDebounce
- Integrate autocomplete into HeroSection
- Replace SearchFilters number input with range slider for raggio
- Create /api/nearby Route Handler for geo-aware row (optional)
- Test network tab: zero Nominatim calls during typing

### Phase 6: Polish and Map Enhancements
**Rationale:** Final polish items and map page improvements are independent of core features and can be done last.

**Delivers:** Map page filter overlay, placeholder fixes, scraper expansion (if needed)

**Addresses:** D-6 (map filters), scraper expansion (deferred unless needed)

**Tasks:**
- Wire MapFilterOverlay to actual filtering logic on /mappa
- Add new scraper sources if event count requires it
- Test robots.txt compliance for new sources
- Final visual QA across all pages

### Phase Ordering Rationale

- **Data first, UI later:** Phase 1 must precede all UI work. Building Netflix rows with 26 events produces broken-looking features and misleading performance characteristics.
- **Foundation then features:** Phases 2-3 establish shared infrastructure (Unsplash, layout, logo) that Phases 4-5 depend on.
- **Hero before search:** The city autocomplete (Phase 5) is embedded in the hero section (Phase 4), so hero layout must be complete first.
- **Deferred scraper expansion:** Only becomes Phase 1 priority if event count investigation shows source websites are down. Otherwise, existing sources should restore to 100+ events with filter calibration.

### Research Flags

**Phases with standard patterns (low research need):**
- **Phase 1 (Data Pipeline):** Extends existing Edge Function patterns, uses established heuristic filter approach
- **Phase 2 (Images):** Unsplash API is well-documented, Next.js ISR caching is standard pattern
- **Phase 3 (Layout):** CSS negative margin breakout already used in MappaClientPage.tsx
- **Phase 4 (Netflix Rows):** CSS scroll-snap is well-established, no novel patterns
- **Phase 5 (City Search):** Shadcn Combobox pattern is documented, nuqs integration is familiar

**Phases potentially needing task-level research:**
- **Phase 1 — Source HTML structure verification:** If new scraper sources are added, need browser devtools inspection of target sites to confirm CSS selectors
- **Phase 2 — Unsplash image curation:** Selecting 10-20 hero queries and 30-50 food category mappings requires manual curation (not research-phase, just task time)

**Overall:** No phases require `/gsd:research-phase` — all patterns are well-documented or already established in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Single new dependency (cmdk), Unsplash API verified directly, CSS scroll-snap native |
| Features | HIGH | Table stakes all fixable with existing patterns, differentiators use standard approaches |
| Architecture | HIGH | Extends existing server component + Edge Function patterns, no novel integrations |
| Pitfalls | HIGH | Critical pitfalls have clear avoidance strategies (static dataset, pre-fetch, breakout pattern) |

**Overall confidence:** HIGH

### Gaps to Address

**Event count root cause:** Research identifies the issue (26 vs 735 events) and investigation areas (scraper_logs, scraper_sources, filter rejection rates) but cannot determine root cause remotely. Phase 1 planning will need to include diagnostic queries and log analysis tasks.

**Unsplash image curation:** Research establishes the approach (pre-fetch + cache) but cannot select specific images. Phase 2 will require manual curation of hero image queries and food category mappings. This is execution work, not a research gap.

**Province code mapping completeness:** The VENETO_PROVINCES constant exists in the codebase with 7 provinces. SQL migration for normalization is straightforward, but needs testing to ensure all province name variations are caught.

**New scraper source HTML structures:** If Phase 1 investigation determines new sources are needed, CSS selectors must be discovered via browser devtools. This is task-level research during planning, not a gap requiring separate research-phase.

**Responsive breakpoints for scroll rows:** Research recommends card widths (280px fixed or responsive) but actual breakpoints need testing against real data and device sizes during Phase 4 execution.

## Sources

### Primary (HIGH confidence)
- [Unsplash API Documentation](https://unsplash.com/documentation) — rate limits (50/hr demo, 5000/hr production), endpoints, attribution requirements verified directly
- [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) — hotlinking requirement, download tracking, attribution format
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) — autocomplete prohibition explicitly stated, 1 req/sec limit
- [Shadcn Combobox](https://ui.shadcn.com/docs/components/radix/combobox) — Popover + Command composition pattern
- [CSS Scroll Snap — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap/Basic_concepts) — scroll-snap-type, scroll-snap-align usage
- [cmdk npm](https://www.npmjs.com/package/cmdk) — v1.1.1, 4KB gzipped, zero dependencies
- [Next.js ISR Caching](https://nextjs.org/docs/app/guides/caching) — next: { revalidate } pattern

### Secondary (MEDIUM confidence)
- [ISTAT Cities JSON (GitHub)](https://github.com/adrianocalvitto/istat-cities) — Italian municipalities with coordinates, province codes
- [Comuni-ITA API (GitHub)](https://github.com/Samurai016/Comuni-ITA) — Updated ISTAT data, REST API + JSON dump
- [Netflix Carousel Pure CSS (Raddy)](https://raddy.dev/blog/netflix-carousel-using-css/) — CSS-only implementation pattern
- [CSS Scroll Snap Best Practices (Ahmad Shadeed)](https://ishadeed.com/article/css-scroll-snap/) — proximity vs mandatory, accessibility

### Tertiary (LOW confidence — needs validation)
- itinerarinelgusto.it and paesiinfesta.com as scraper sources — HTML structures need browser devtools inspection during implementation
- ilturista.info and cibotoday.it as scraper sources — lower signal-to-noise ratio, article format pages

### Existing Codebase (PRIMARY source for integration decisions)
- `.planning/research/STACK.md` — detailed technology decisions, explicit library rejections
- `.planning/research/FEATURES.md` — table stakes vs differentiators, complexity estimates
- `.planning/research/ARCHITECTURE.md` — component integration patterns, data flow diagrams
- `.planning/research/PITFALLS.md` — critical failure modes with prevention strategies
- `src/app/(main)/layout.tsx` — max-w-7xl constraint that breakout pattern addresses
- `src/app/(main)/mappa/MappaClientPage.tsx` — negative margin breakout pattern (line 26: `-mx-4 -mt-4 sm:-mx-6 lg:-mx-8`)
- `src/components/home/HeroSection.tsx` — current mesh gradient hero to be replaced
- `src/components/sagra/SagraCard.tsx` — Motion-wrapped card reused in scroll rows
- `src/lib/queries/sagre.ts` — existing query functions to be extended
- `supabase/functions/scrape-sagre/index.ts` — Edge Function inline copy pattern
- `supabase/functions/enrich-sagre/index.ts` — Nominatim geocoding integration point

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
