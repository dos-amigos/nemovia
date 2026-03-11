---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Esperienza Completa
status: executing
last_updated: "2026-03-11T13:17:40.902Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
---

---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Esperienza Completa
status: executing
stopped_at: "Completed 20-02-PLAN.md"
last_updated: "2026-03-11T13:11:13Z"
last_activity: 2026-03-11 -- Completed 20-02 Logo & Footer Branding
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State: Nemovia v1.4

**Last updated**: 2026-03-11
**Current milestone**: v1.4 "Esperienza Completa"

## Project Reference

**Core value**: Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.

**Current focus**: Transform Nemovia from prototype to complete product through data pipeline restoration, Netflix-style discovery UI, and UX polish.

## Current Position

**Phase**: 20 - Layout & Branding (COMPLETE)
**Plan**: 2/2 complete
**Status**: Phase 20 complete. Ready for Phase 21 (Netflix Rows).
**Progress**: 3/6 phases complete, 7/7 plans (100%)

```
v1.4 Progress: [██████████] 100%
Phase 20:      [==================================================] 100%
```

## Performance Metrics

### Milestone v1.4 (In Progress)

**Timeline**: Started 2026-03-10
**Phases complete**: 3/6
**Plans complete**: 7 (Phase 18: 3, Phase 19: 2/2, Phase 20: 2/2)
**Commits**: 19
**LOC delta**: +720/-41

### Previous Milestone: v1.3 (Shipped 2026-03-10)

**Duration**: 2 days (2026-03-09 to 2026-03-10)
**Phases**: 4/4 complete
**Plans**: 9/9 complete
**Commits**: 60
**LOC delta**: +1173/-259 TypeScript/CSS

**Velocity**: 30 commits/day, ~+457 net LOC/day

## Accumulated Context

### Recent Decisions

**20-02 Logo & Footer Branding (2026-03-11)**
- **Decision**: Inline SVG paths for logo wordmark instead of `<text>` element for font-independent rendering
- **Decision**: Footer uses pb-24 on mobile to clear fixed BottomNav, pb-8 on desktop
- **Decision**: Logo SVG placeholder will be replaced with user's own design later
- **Decision**: Unsplash attribution UTM params: utm_source=nemovia&utm_medium=referral
- **Pattern**: Brand component directory: src/components/brand/ for logo and brand-identity components

**20-01 Full-Width Layout Restructure (2026-03-11)**
- **Decision**: Full-width-by-default layout: main has no max-w-7xl, pages opt into containment via wrapper divs
- **Decision**: Hero card margins use mx-4/sm:mx-6/lg:mx-8 responsive steps for breathing room in full-width context
- **Decision**: Detail page hero keeps mobile full-bleed via -mx breakout from container (intentional design, not a hack)
- **Decision**: Search map view stays within max-w-7xl container (secondary view, no need for edge-to-edge)
- **Pattern**: Content containment wrapper: `div.mx-auto.max-w-7xl.px-4.sm:px-6.lg:px-8`

**19-02 Unsplash Hero & Attribution UI (2026-03-11)**
- **Decision**: Server component hero (no "use client") for static rendering with next/image priority for LCP
- **Decision**: Rounded corners (rounded-2xl) on hero per user visual feedback at checkpoint
- **Decision**: image_credit added to SAGRA_CARD_FIELDS constant to fix runtime type mismatch

**19-01 Unsplash Integration Foundation (2026-03-11)**
- **Decision**: Hero images use UTM params on both image URL and photographer URL for Unsplash attribution compliance
- **Decision**: TAG_QUERIES inline copy in Edge Function follows established pattern (Deno cannot import from src/)
- **Decision**: Rate limit check at X-Ratelimit-Remaining < 5 preserves budget for next run
- **Decision**: Credit stored as "Name|profile_url" pipe-delimited format for simple parsing
- **Decision**: Download tracking uses fire-and-forget pattern to avoid blocking pipeline

**18-03 itinerarinelgusto Source (2026-03-10)**
- **Decision**: Selector .row.tile.post.pad verified from live HTML (research suggested .row.post.pad)
- **Decision**: Schema.org meta tags used for dates instead of text parsing -- ISO format provides reliable data
- **Decision**: max_pages set to 3 (conservative) to avoid Edge Function timeout
- **Decision**: Full-size CDN image preferred over midsize thumbnail

**18-01 Filter Recalibration (2026-03-10)**
- **Decision**: Whitelist-first approach for isNonSagraTitle() -- check sagra/festa/food keywords before non-sagra rejection
- **Decision**: Dedup guard in re-activation SQL prevents duplicates from re-activated events
- **Decision**: SQL migration 009 mirrors isNonSagraTitle() logic in PostgreSQL regex for retroactive cleanup

**18-02 Province Normalization (2026-03-10)**
- **Decision**: Veneto viewbox 10.62,44.79,13.10,46.68 with bounded=1 restricts Nominatim to Veneto region
- **Decision**: Province codes stored as 2-letter format (BL,PD,RO,TV,VE,VR,VI) not Nominatim raw text
- **Decision**: SQL migration for retroactive normalization of existing province values

**v1.4 Roadmap Structure (2026-03-10)**
- **Decision**: 6-phase structure prioritizing data pipeline restoration before all UI work
- **Rationale**: Event count collapse (26 vs 735) makes all UI features appear broken. Building Netflix rows on empty data produces misleading results.
- **Phases**: 18 (Data), 19 (Images), 20 (Layout/Branding), 21 (Netflix Rows), 22 (City Search/Map), 23 (Scraping)

**v1.3 LazyMotion Migration (2026-03-10)**
- **Decision**: Async domMax loading with strict mode, m.* components in client code
- **Outcome**: ~28KB initial JS reduction, runtime leak detection, no visual regressions
- **Pattern**: Providers.tsx wraps LazyMotion(strict) + MotionConfig, components use m.* from motion/react-m

**v1.3 OKLCH Color Migration (2026-03-10)**
- **Decision**: Literal OKLCH values in glass utilities to avoid backdrop-filter composition issues
- **Pattern**: `oklch(0.637 0.237 25.5)` inline, not CSS vars, for glass-nav and glass-overlay
- **Outcome**: Consistent glassmorphism rendering across all browsers

**v1.3 Bento Grid Featured Card (2026-03-10)**
- **Decision**: First weekend sagra as featured card (lg:col-span-2 lg:row-span-2)
- **Rationale**: Editorial feel without database schema changes or CMS complexity
- **Implementation**: Filter first item from weekend sagre array, render as featured, slice rest

### Active TODOs

**Phase 19 Complete**
- [x] Unsplash utility library with hero rotation, credit parser, tag queries (19-01)
- [x] SQL migration 012 for image_credit column (19-01)
- [x] Pass 3 in enrich-sagre for Unsplash image assignment (19-01)
- [x] UI components: hero image, attribution display (19-02)

**Phase 18 Complete**
- [x] Investigate scraper_logs and scraper_sources for event count drop root cause (18-01)
- [x] Plan diagnostic queries for filter rejection rates (18-01)
- [x] Design Veneto bounding box parameters for Nominatim (18-02)
- [x] Plan heuristic filters for non-sagre detection (18-01)
- [x] Plan province code normalization SQL migration (18-02)
- [x] Investigate itinerarinelgusto.it and add scraper source (18-03)

**User Action Required (Phase 19 Deployment)**
- [ ] Register at unsplash.com/developers, create application, get Access Key
- [ ] Add UNSPLASH_ACCESS_KEY to .env locally
- [ ] Add UNSPLASH_ACCESS_KEY to Supabase Edge Function secrets (enrich-sagre)
- [ ] Run SQL migration 012 (image_credit column) in Supabase SQL Editor
- [ ] Deploy updated enrich-sagre Edge Function via Supabase Dashboard

**User Action Required (Phase 18 Deployment)**
- [ ] Run SQL migration 009 (filter recalibration) in Supabase SQL Editor
- [ ] Run SQL migration 010 (province normalization) in Supabase SQL Editor
- [ ] Run SQL migration 011 (itinerarinelgusto source) in Supabase SQL Editor
- [ ] Deploy scrape-sagre Edge Function via Supabase Dashboard
- [ ] Deploy enrich-sagre Edge Function via Supabase Dashboard
- [ ] Verify: `SELECT count(*) FROM sagre WHERE is_active = true;` should approach 100+

**Research Integration**
- [ ] Review research/SUMMARY.md pitfalls section during phase planning
- [ ] Reference research/ARCHITECTURE.md for Unsplash integration patterns (Phase 19)
- [ ] Reference research/FEATURES.md for Netflix rows implementation details (Phase 21)

### Blockers

**None** -- Phase 20 complete, ready for Phase 21 (Netflix Rows).

### Technical Notes

**Critical Constraints for v1.4**
1. **Nominatim autocomplete forbidden**: Use static veneto-comuni.json (~580 cities), single geocode only on selection
2. **Unsplash rate limits**: Pre-fetch images at pipeline time, never runtime API calls (50 req/hr demo tier)
3. **Full-width layout**: Main is full-width by default, pages wrap content in max-w-7xl containers (20-01 pattern)
4. **Data pipeline first**: All UI features built against healthy dataset (100+ events), not 26-event collapsed state

**Stack Additions for v1.4**
- cmdk@1.1.1 for city autocomplete (Shadcn Combobox dependency)
- Shadcn components: Popover, Command, Slider
- Static asset: veneto-comuni.json (~25KB)
- Environment: UNSPLASH_ACCESS_KEY

**Existing Patterns to Leverage**
- Server component + parallel queries (Promise.all) for Netflix rows
- Route Handlers for city autocomplete (hide Supabase anon key)
- Edge Function inline copy pattern for filter additions (established pattern since v1.0)
- Full-width main layout with per-page max-w-7xl containment (established 20-01)
- Schema.org microdata extraction for itinerarinelgusto (established in 18-03)

## Session Continuity

### How to Resume Work

**If starting Phase 21 planning:**
```bash
/gsd:plan-phase 21
```

**If checking project status:**
```bash
cat .planning/STATE.md
cat .planning/ROADMAP.md
```

**If reviewing milestone goals:**
```bash
cat .planning/PROJECT.md
cat .planning/REQUIREMENTS.md
```

### Context for Next Session

**Current milestone**: v1.4 "Esperienza Completa"
**Milestone goal**: Transform Nemovia from prototype to complete product -- Netflix scroll rows, hero photographico, city search con raggio, full-width layout, logo, footer, e fix critici su dati e UX.

**Phase 20 status**: COMPLETE (2/2 plans). Full-width layout restructure + logo & footer branding done.

**Next action**: Plan and execute Phase 21 (Netflix Rows).

---

**Archive notes**: Previous milestone states archived in `.planning/milestones/v1.X-STATE.md`
