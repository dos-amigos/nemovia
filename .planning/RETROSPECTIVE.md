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

## Milestone: v1.3 -- Dati Puliti + Redesign

**Shipped:** 2026-03-10
**Phases:** 4 | **Plans:** 9 | **Commits:** 60

### What Was Built
- TDD-built heuristic filters (noise titles, calendar spam, >7-day events, past-year events) with production retroactive cleanup
- LLM is_sagra classification piggybacking on existing Gemini enrichment (zero additional API calls)
- pg_trgm fuzzy dedup with GIN trigram index (title similarity + date overlap requirement)
- Source-specific image URL upgrade (WordPress thumbnails, size params) + branded placeholder
- Geist font + coral/teal OKLCH palette replacing amber/stone across all 25+ Shadcn tokens
- Glassmorphism nav bars and floating overlays with GPU-composited backdrop-blur
- Mesh gradient hero, image-overlay SagraCard, FeaturedSagraCard, bento grid homepage
- LazyMotion migration (12 files, motion.* to m.*, ~28KB initial JS reduction)

### What Worked
- **Two-track milestone (data + UI) worked cleanly**: data quality phases (14-15) cleaned the pipeline before UI phases (16-17) made it shine -- clean data + modern design amplified each other
- **TDD for filter functions**: RED-GREEN-REFACTOR produced 63+ tests catching edge cases before pipeline integration
- **Piggybacking LLM classification**: adding is_sagra to existing Gemini batch call avoided cost/latency increase entirely
- **CSS custom properties for placeholders**: from-primary/via-accent gradient auto-updated when Phase 16 changed the palette
- **Semantic token migration before visual effects**: Phase 16 token work made Phase 17 glassmorphism/mesh naturally use correct colors
- **LazyMotion strict mode**: catches motion.* leaks at runtime, preventing regression after migration

### What Was Inefficient
- **Edge Function inline copies still unresolved**: now 4 milestones with this pattern -- growing maintenance burden (filters.ts + llm.ts both have inline copies)
- **Nyquist compliance partial (1/4 phases)**: Phases 14-16 have VALIDATION.md stubs but no test runs -- formal test coverage gaps
- **No ESLint rule for m.* enforcement**: strict mode catches at runtime, but a build-time check would be more reliable

### Patterns Established
- **Heuristic filter pipeline integration**: filters run between normalizeRawEvent() and upsertEvent() in Edge Function
- **LLM classification piggyback**: add field to responseSchema + branch in result loop -- zero cost increase
- **Fuzzy dedup via pg_trgm**: GIN index + plpgsql RPC with configurable similarity thresholds
- **OKLCH palette with semantic tokens**: primary=coral(25.5), accent=teal(185), neutral=cool(260)
- **Glass utilities**: glass-nav for sticky nav bars, glass-overlay for floating elements, literal OKLCH values
- **Image overlay card**: full-bleed image + from-black/70 gradient + white text at bottom
- **LazyMotion pattern**: m.* from motion/react-m for elements, motion/react for hooks/providers only

### Key Lessons
1. **Data quality before design refresh** -- cleaning noise/dupes/non-sagre first meant the redesigned UI only showed quality content from day one
2. **Piggyback on existing LLM calls** -- adding is_sagra to the enrichment prompt was zero-cost, zero-latency vs. a separate classification pipeline
3. **Use CSS custom properties for palette-dependent components** -- Phase 15 placeholders auto-updated when Phase 16 changed colors
4. **Literal OKLCH in backdrop-filter contexts** -- CSS custom properties don't compose well inside backdrop-filter; use literal values
5. **domMax not domAnimation for LazyMotion** -- if any component uses layoutId, you need the full feature set

### Cost Observations
- Model mix: primarily Opus for planning and execution
- Sessions: ~3 across 2 days
- Notable: 9 plans across 4 phases in 2 days -- dual-track (data + UI) execution was efficient due to clear phase ordering

---

## Milestone: v1.4 -- Esperienza Completa

**Shipped:** 2026-03-12
**Phases:** 6 | **Plans:** 13 | **Commits:** 74

### What Was Built
- Data pipeline restoration: whitelist-aware filters, Veneto-bounded Nominatim, province normalization, itinerarinelgusto.it 6th source (100+ active events)
- Unsplash image quality: pipeline-time image assignment with hero rotation, credit parsing, full-bleed photo hero with attribution
- Full-width responsive layout with custom SVG logo (coral/teal) and professional footer ("Fatto con cuore in Veneto")
- Netflix-style horizontal scroll rows: CSS scroll-snap, drag-to-scroll, desktop hover arrows, cross-row Set deduplication
- City autocomplete search from 555 static Veneto comuni with glass-styled dropdown and keyboard navigation
- 6 SVG food type icons (carne, pesce, zucca, verdura, gnocco, altro) with priority-based tag mapping on cards and row titles
- Map filter sync fixes: searchMapSagre for Cerca page, always-visible filters on Mappa page
- Source-specific detail extractors for menu, orari, descriptions with 10-page-capped backfill strategy

### What Worked
- **Data-first phase ordering**: restoring 100+ events in Phase 18 before building Netflix rows in Phase 21 meant real content from day one — building on empty data would have been misleading
- **Static data for city search**: bundling 555 comuni as JSON avoided Nominatim API calls entirely, instant client-side filtering, zero rate limit risk
- **CSS scroll-snap for Netflix rows**: native momentum scrolling with no JS carousel dependency, drag-to-scroll added as lightweight mouse event handler
- **Unsplash at pipeline time**: pre-fetching images during enrich-sagre run avoided runtime API calls (50 req/hr demo tier limitation)
- **NULL-only update pattern**: detail scraping never overwrites existing content, preserving curated/LLM content while filling gaps progressively
- **6-phase milestone with clear dependencies**: Phase 18→19→20→21→22→23 chain ensured each phase built on solid foundation

### What Was Inefficient
- **Edge Function inline copies still unresolved**: now 5 milestones with this pattern — filters.ts, llm.ts, unsplash.ts, detail extractors all have inline copies in Edge Functions
- **Food type icon coverage gap**: "vino" and "dolci" categories map to generic "altro" fallback arrow icon instead of thematic icons (wine glass, cake) — should have expanded icon set
- **image_credit migration not applied to remote DB**: migration 012 exists but was never run on production, forced temporary removal from SAGRA_CARD_FIELDS
- **Phase 22 overloaded**: combining city search, map fixes, and food icons in one phase (3 plans) stretched scope — could have been 2 focused phases

### Patterns Established
- **ScrollRow/ScrollRowSection**: full-width CSS scroll-snap container with responsive card widths (75vw/45vw/280px), server component wrapper with min-3 threshold
- **Full-width-by-default layout**: main has no max-w, pages opt into containment via mx-auto max-w-7xl wrapper divs
- **Static data import**: JSON in public/data/ → TypeScript module in lib/constants/ → tested filter utility for zero-API client features
- **Glass autocomplete**: rounded-full input with border-white/30 bg-white/20, dropdown with bg-black/70 backdrop-blur-md
- **Detail extractor pattern**: function extractXxxDetail($: cheerio.CheerioAPI): DetailContent per source
- **Combined new+backfill strategy**: newly inserted events get priority, remaining budget fills gaps progressively

### Key Lessons
1. **Data pipeline first, UI second** — building Netflix rows on 26 events would have looked broken; restoring 100+ events first was critical
2. **Static data avoids rate limits** — 555 comuni as bundled JSON eliminated all Nominatim autocomplete risk with instant client-side filtering
3. **Plan icon sets for ALL categories before implementation** — implementing 6 icons and discovering "vino" and "dolci" need thematic icons post-launch is avoidable
4. **Apply migrations to production immediately** — delaying migration 012 caused runtime errors and forced workarounds
5. **3 plans per phase is the sweet spot** — Phase 22 with 3 diverse features felt overloaded; Phase 21 with 1 focused plan was the most efficient

### Cost Observations
- Model mix: primarily Opus for planning and execution, Sonnet/Haiku for research subagents
- Sessions: ~5 across 3 days
- Notable: 13 plans across 6 phases in 3 days — largest milestone by phase count, maintained velocity through clear dependency chain

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Plans | Key Change |
|-----------|---------|--------|-------|------------|
| v1.0 | 85 | 6 | 18 | First milestone -- established all patterns |
| v1.1 | 29 | 4 | 7 | Data pipeline focus -- no frontend, all scraper/quality work |
| v1.2 | 37 | 3 | 7 | UX polish -- responsive layout, transitions, micro-interactions |
| v1.3 | 60 | 4 | 9 | Dual-track -- data quality overhaul + UI/UX redesign |
| v1.4 | 74 | 6 | 13 | Full product -- data restore, Unsplash, Netflix rows, city search, detail scraping |

### Cumulative Quality

| Milestone | LOC | Files | Scraper Sources Active | Active Sagre | Data Quality |
|-----------|-----|-------|----------------------|-------------|-------------|
| v1.0 | 3,514 | 159 | 1/5 | ~140 | Basic |
| v1.1 | ~3,900 | 159 | 5/5 | 735 | Noise filter + location gating |
| v1.2 | ~4,200 | 170+ | 5/5 | 735 | Same as v1.1 |
| v1.3 | ~5,100 | 180+ | 5/5 | Clean | Heuristic + LLM + fuzzy dedup |
| v1.4 | ~7,700 | 200+ | 6/6 | 100+ | + Unsplash images + detail scraping |

### Top Lessons (Verified Across Milestones)

1. **Validate assumptions about external sites before planning** -- v1.0 assumed JS rendering for sagritaly, v1.1 proved it was SSR (validated v1.0 + v1.1)
2. **Phase-by-phase incremental delivery works** -- all 5 milestones shipped incrementally with verification at each phase (validated v1.0-v1.4)
3. **Edge Function inline copies are a growing burden** -- noted in all 5 milestones, still unresolved (validated v1.0-v1.4)
4. **Foundation/data work before UI polish** -- v1.2 A11Y before animations, v1.3 data quality before design refresh, v1.4 data pipeline before Netflix rows (validated v1.2-v1.4)
5. **Research third-party libraries before planning** -- v1.2 eliminated 3 incompatible libraries; v1.3 research identified OKLCH backdrop-filter pitfall; v1.4 eliminated SwiperJS/Embla (validated v1.2-v1.4)
6. **Piggyback on existing infrastructure** -- v1.3 is_sagra on Gemini enrichment; v1.4 Unsplash assignment on enrich-sagre Pass 3, static JSON for city search (validated v1.3 + v1.4)
7. **Apply DB migrations to production immediately** -- v1.4 delayed migration 012 causing runtime errors and workarounds (validated v1.4)
