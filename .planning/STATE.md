---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Esperienza Completa
status: executing
stopped_at: "Completed 18-02-PLAN.md"
last_updated: "2026-03-10T17:10:43Z"
last_activity: 2026-03-10 -- Completed 18-02 Province Normalization
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 11
---

# Project State: Nemovia v1.4

**Last updated**: 2026-03-10
**Current milestone**: v1.4 "Esperienza Completa"

## Project Reference

**Core value**: Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.

**Current focus**: Transform Nemovia from prototype to complete product through data pipeline restoration, Netflix-style discovery UI, and UX polish.

## Current Position

**Phase**: 18 - Data Pipeline Restoration
**Plan**: 2/3 complete, next: 18-03
**Status**: Executing Phase 18 plans
**Progress**: 0/6 phases complete (11%)

```
v1.4 Progress: [=====                                             ] 11%
Phase 18:      [=================================                 ] 67%
```

## Performance Metrics

### Milestone v1.4 (In Progress)

**Timeline**: Started 2026-03-10
**Phases complete**: 0/6
**Plans complete**: 2/3 (Phase 18)
**Commits**: 8
**LOC delta**: +200/-3

### Previous Milestone: v1.3 (Shipped 2026-03-10)

**Duration**: 2 days (2026-03-09 → 2026-03-10)
**Phases**: 4/4 complete
**Plans**: 9/9 complete
**Commits**: 60
**LOC delta**: +1173/-259 TypeScript/CSS

**Velocity**: 30 commits/day, ~+457 net LOC/day

## Accumulated Context

### Recent Decisions

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

**Phase 18 Execution (Next: 18-03)**
- [x] Investigate scraper_logs and scraper_sources for event count drop root cause (18-01)
- [x] Plan diagnostic queries for filter rejection rates (18-01)
- [x] Design Veneto bounding box parameters for Nominatim (18-02)
- [x] Plan heuristic filters for non-sagre detection (18-01)
- [x] Plan province code normalization SQL migration (18-02)
- [ ] Execute 18-03 plan (next)

**Research Integration**
- [ ] Review research/SUMMARY.md pitfalls section during phase planning
- [ ] Reference research/ARCHITECTURE.md for Unsplash integration patterns (Phase 19)
- [ ] Reference research/FEATURES.md for Netflix rows implementation details (Phase 21)

### Blockers

**None** — Roadmap complete, ready to begin Phase 18 planning.

### Technical Notes

**Critical Constraints for v1.4**
1. **Nominatim autocomplete forbidden**: Use static veneto-comuni.json (~580 cities), single geocode only on selection
2. **Unsplash rate limits**: Pre-fetch images at pipeline time, never runtime API calls (50 req/hr demo tier)
3. **Full-width layout**: Use negative margin breakout (-mx-4 sm:-mx-6 lg:-mx-8), keep max-w-7xl global constraint
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
- Negative margin breakout already in MappaClientPage.tsx (line 26)

## Session Continuity

### How to Resume Work

**If starting Phase 18 planning:**
```bash
/gsd:plan-phase 18
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
**Milestone goal**: Transform Nemovia from prototype to complete product — Netflix scroll rows, hero photographico, city search con raggio, full-width layout, logo, footer, e fix critici su dati e UX.

**Phase 18 goal**: Restore application to healthy data state with 100+ active sagre, accurate Veneto gating, and effective non-sagre filtering.

**Why Phase 18 is first**: Event count collapse (26 vs 735 events) makes every UI feature appear broken. Research identified this as the critical blocker — building Netflix rows, hero images, or city search against an empty dataset produces misleading results and broken-looking features. Data health must be restored before any UI work begins.

**Phase 18 requirements**: DATA-01 (restore 100+ events), DATA-02 (Veneto gating), DATA-03 (non-sagre filter), DATA-04 (province display), SCRAPE-02 (investigate new sources)

**Next action**: Run `/gsd:execute-phase 18` to execute plan 18-03 (remaining phase 18 plan).

---

**Archive notes**: Previous milestone states archived in `.planning/milestones/v1.X-STATE.md`
