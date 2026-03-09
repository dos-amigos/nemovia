# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-05
**Phases:** 6 | **Plans:** 18 | **Commits:** 85

### What Was Built
- Config-driven scraping pipeline with Cheerio, dedup, pg_cron scheduling, and event expiration
- Gemini LLM enrichment (food/feature tags + descriptions) and Nominatim geocoding on automated schedule
- Homepage with hero, weekend sagre, emoji quick filters, province counts
- Filterable search page with geolocation distance sorting and lista/mappa toggle
- Interactive Leaflet map with clustering, geolocation, popups navigating to detail pages
- Sagra detail page with mini-map, Google Maps directions, share button, source link
- SEO infrastructure (dynamic metadata, sitemap, OG images) + premium scroll animations

### What Worked
- **Phase-by-phase incremental delivery**: each phase produced a deployable increment, making verification natural
- **PostGIS RPCs**: spatial queries via Supabase RPC (find_nearby_sagre, search_sagre) worked cleanly with the Next.js server component pattern
- **Server/client component split**: keeping data fetching in server components and interactivity in thin client wrappers kept the architecture clean
- **Parallel data fetching**: Promise.all pattern in server components for homepage and search page kept load times fast
- **CDN URLs for Leaflet icons**: avoided Turbopack static asset issues entirely
- **Motion library**: FadeIn/StaggerGrid client wrappers gave premium feel with minimal code

### What Was Inefficient
- **Scraper source attrition**: invested time configuring 5 sources but 4 have broken CSS selectors or need JS rendering — should have validated selectors earlier
- **Inline function copy for Edge Functions**: Deno can't import from Next.js src/, so pure functions are duplicated in Edge Functions — maintenance burden
- **Missing VERIFICATION.md for early phases**: Phases 1 and 3 lacked formal verification files, creating audit gaps that had to be explained later
- **DISC checkbox tracking**: 4 requirements (DISC-01, 02, 03, 08) were implemented but not checked off in REQUIREMENTS.md — better to check off during execution

### Patterns Established
- **Server component → RPC pattern**: server pages call Supabase RPC functions, no client-side data fetching
- **Dynamic import with ssr:false**: for Leaflet components, always wrap in dynamic() with "use client" for Turbopack compatibility
- **nuqs for URL state**: search filters persisted in URL params for sharing and back-button behavior
- **Brand OKLCH colors in Tailwind config**: single source of truth for amber-600 primary, green-700 accent, stone-50 bg
- **Edge Function → pg_cron scheduling**: all background work (scrape, enrich, expire) runs as scheduled Supabase Edge Functions

### Key Lessons
1. **Validate scraper selectors against live HTML before committing to a source** — CSS selectors break without warning when sites update
2. **Create VERIFICATION.md during phase execution, not retroactively** — avoids audit gaps
3. **Check off requirements in REQUIREMENTS.md as part of plan completion** — don't defer this administrative step
4. **Deno Edge Functions need their own copy of shared utilities** — plan for this from the start rather than discovering it during implementation
5. **2 days from zero to shipped MVP is achievable** with clear requirements, phased roadmap, and incremental verification

### Cost Observations
- Model mix: primarily Opus for planning and execution
- Sessions: ~6-8 across 2 days
- Notable: 18 plans across 6 phases in 2 days — high throughput from clear requirements and minimal rework

---

## Milestone: v1.1 — Dati Reali

**Shipped:** 2026-03-07
**Phases:** 4 | **Plans:** 7 | **Commits:** 29

### What Was Built
- Deployed enrich-sagre PostGIS WKT geocoding fix and verified end-to-end pipeline
- Fixed assosagre, solosagre, venetoinfesta scrapers with source-specific CSS selectors and date parsers
- Added sagritaly.com as 5th active source via Cheerio (WordPress SSR, not JS-rendered as assumed)
- Noise title detection filters out calendar pages, nav text, and generic non-event strings at scrape time
- Location normalization appends ", Veneto" for Nominatim disambiguation; non-Veneto sagre deactivated after geocoding
- Retroactive cleanup: 36 dirty rows deactivated, 735 clean active sagre

### What Worked
- **Source-specific extraction branches**: keying extractRawEvent() by source.name scaled cleanly to 5 different HTML layouts
- **Reusing parseItalianDateRange()**: composing dates into a standard format let all 5 sources share one date parser
- **Heuristic data quality filters**: simple regex/length checks caught all noise without ML complexity
- **REST API verification pattern**: checking scrape_logs and sagre table via REST API provided fast feedback during scraper fixes
- **12-minute sagritaly phase**: discovering the site was server-rendered WordPress (not JS) eliminated an entire headless browser complexity

### What Was Inefficient
- **Inline function duplication for Edge Functions**: still copying pure functions between src/ and supabase/functions/ — maintenance burden grows with each data quality function added
- **Manual function invocation**: triggering Edge Functions via curl for testing; could benefit from a dev/test mode
- **No automated selector validation**: CSS selectors break when sites update — no alerting in place

### Patterns Established
- **Source-specific extraction**: when a scraper source has non-standard HTML, add a named branch keyed by source.name in extractRawEvent()
- **Pipeline-stage filtering**: noise detection at scrape time, province gating at geocode time — filter as early as possible
- **Location normalization**: strip province codes, region prefixes, append disambiguation suffix before geocoding

### Key Lessons
1. **Check if a site is SSR before assuming JS rendering** — sagritaly was WordPress, Cheerio worked directly, saving significant complexity
2. **Heuristic filters beat ML for known patterns** — noise titles follow predictable regex patterns, no need for classification models
3. **Deactivate instead of delete dirty data** — keeping is_active=false rows preserves debugging context
4. **Small phase count (4) with focused scope shipped in 3 days** — data-pipeline-only milestone avoided UI complexity

### Cost Observations
- Model mix: primarily Opus for execution
- Sessions: ~4 across 3 days
- Notable: 7 plans across 4 phases in 3 days — fast velocity from focused data-pipeline scope with no frontend changes

---

## Milestone: v1.2 — Polish

**Shipped:** 2026-03-09
**Phases:** 3 | **Plans:** 7 | **Commits:** 37

### What Was Built
- Fixed 4 UX bugs (back button verified, image placeholder verified, Cerca default filter, desktop max-width)
- Accessibility foundation: MotionConfig reduced-motion wrapper, focus-visible rings on all interactive elements
- Responsive desktop layout: TopNav, multi-column grids (1→2→3→4 cols), side-by-side detail with sticky left column
- Page cross-fade transitions via AnimatePresence + FrozenRouter pattern
- Card hover/tap micro-interactions, button press animations, badge hover effects
- FadeImage progressive loading component with cached-image handling
- Shimmer gradient skeleton loaders replacing pulse animation
- Scroll-linked animations: progress bar, directional section reveals, mobile-only parallax hero
- BottomNav sliding active tab indicator with spring physics

### What Worked
- **Providers.tsx pattern**: wrapping MotionConfig + NuqsAdapter in one client component kept layout.tsx as Server Component
- **CSS-only responsive patterns**: nav swap (hidden/lg:block), responsive grids, responsive map height — no JS viewport detection needed
- **FrozenRouter for page transitions**: solved the AnimatePresence exit animation problem cleanly
- **Short transition durations (150ms/100ms)**: premium feel without hurting utility app speed
- **Accessibility-first approach**: putting A11Y-01 in Phase 11 meant all Phase 13 animations automatically respected reduced-motion
- **Research-driven scope**: investigating barba.js, Lenis, reactbits upfront prevented wasted implementation time on incompatible libraries

### What Was Inefficient
- **Phase 13 plan checkboxes not updated in ROADMAP.md**: the 3 Phase 13 plans show `[ ]` instead of `[x]` in the archived roadmap (cosmetic, caught during milestone completion)
- **Stale .next cache issues**: build-manifest.json errors required manual .next directory cleanup twice during Phase 13 execution
- **Edge Function inline copies still unresolved**: noted in v1.0 and v1.1 — still copying pure functions, growing maintenance burden

### Patterns Established
- **Providers pattern**: all client-side context providers wrapped in src/components/Providers.tsx
- **Focus ring standard**: focus-visible:ring-[3px] focus-visible:ring-ring/50 on all custom interactive elements
- **FrozenRouter**: wrap AnimatePresence children to freeze router context during exit transitions
- **FadeImage**: opacity-0 initial, onLoad + useEffect complete check for progressive image loading
- **Mobile-only parallax**: lg:!transform-none CSS override to disable motion transform on desktop
- **Shimmer skeleton**: CSS @keyframes shimmer with gradient sweep, respects reduced-motion

### Key Lessons
1. **Put accessibility gates before animation work** — Phase 11's MotionConfig + reduced-motion CSS paid off when every Phase 13 animation automatically respected user preferences
2. **Research libraries before committing to them** — discovering barba.js/Lenis/reactbits were incompatible saved days of wasted work
3. **Short animation durations for utility apps** — 150ms enter / 100ms exit felt premium without the 300-500ms lag that hurts usability
4. **Clean .next before major animation work** — stale build cache causes confusing manifest errors unrelated to actual code changes
5. **CSS-only responsive patterns scale well** — hidden/lg:block nav swap, responsive grid classes, Tailwind arbitrary values for height calc — all zero-JS, no hydration issues

### Cost Observations
- Model mix: primarily Opus for planning and execution
- Sessions: ~4 across 3 days
- Notable: 7 plans across 3 phases in 3 days — animation/polish work had similar velocity to feature work

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Plans | Key Change |
|-----------|---------|--------|-------|------------|
| v1.0 | 85 | 6 | 18 | First milestone — established all patterns |
| v1.1 | 29 | 4 | 7 | Data pipeline focus — no frontend, all scraper/quality work |
| v1.2 | 37 | 3 | 7 | UX polish — responsive layout, transitions, micro-interactions |

### Cumulative Quality

| Milestone | LOC | Files | Scraper Sources Active | Active Sagre |
|-----------|-----|-------|----------------------|-------------|
| v1.0 | 3,514 | 159 | 1/5 | ~140 |
| v1.1 | ~3,900 | 159 | 5/5 | 735 |
| v1.2 | ~4,200 | 170+ | 5/5 | 735 |

### Top Lessons (Verified Across Milestones)

1. **Validate assumptions about external sites before planning** — v1.0 assumed JS rendering for sagritaly, v1.1 proved it was SSR (validated across phases 2 and 9)
2. **Phase-by-phase incremental delivery works** — all 3 milestones shipped incrementally with verification at each phase (validated v1.0 + v1.1 + v1.2)
3. **Edge Function inline copies are a growing burden** — noted in all 3 milestones, still unresolved
4. **Put accessibility/foundation work first in a polish milestone** — v1.2 Phase 11 (A11Y) enabled all Phase 13 animations to automatically respect user preferences (validated v1.2)
5. **Research third-party libraries before planning** — v1.2 research phase eliminated 3 incompatible libraries (barba.js, Lenis, reactbits) before any code was written (validated v1.2)
