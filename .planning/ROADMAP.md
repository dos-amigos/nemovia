# Roadmap: Nemovia

## Milestones

- [x] **v1.0 MVP** - Phases 1-6 (shipped 2026-03-05)
- [x] **v1.1 Dati Reali** - Phases 7-10 (shipped 2026-03-07)
- [ ] **v1.2 Polish** - Phases 11-13 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) - SHIPPED 2026-03-05</summary>

- [x] Phase 1: Foundation & Design System (2/2 plans) - completed 2026-03-04
- [x] Phase 2: Scraping Pipeline (4/4 plans) - completed 2026-03-04
- [x] Phase 3: Data Enrichment (3/3 plans) - completed 2026-03-04
- [x] Phase 4: Discovery UI (3/3 plans) - completed 2026-03-05
- [x] Phase 5: Map & Detail (3/3 plans) - completed 2026-03-05
- [x] Phase 6: SEO & Polish (3/3 plans) - completed 2026-03-05

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>v1.1 Dati Reali (Phases 7-10) - SHIPPED 2026-03-07</summary>

- [x] Phase 7: Deploy & Verify Baseline (1/1 plans) - completed 2026-03-06
- [x] Phase 8: Fix Cheerio Scrapers (3/3 plans) - completed 2026-03-07
- [x] Phase 9: Sagritaly Ingestion (1/1 plans) - completed 2026-03-07
- [x] Phase 10: Data Quality Filters (2/2 plans) - completed 2026-03-07

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.2 Polish (In Progress)

**Milestone Goal:** Fix UX bugs and add polish -- page transitions, responsive desktop layout, micro-interazioni -- per un'esperienza premium su ogni device.

- [ ] **Phase 11: Bug Fixes + Foundation** - Fix 4 broken UX flows and establish accessibility baseline for all animation work
- [ ] **Phase 12: Responsive Desktop Layout** - Desktop-optimized layout with navigation, grids, and breakpoint-aware skeletons
- [ ] **Phase 13: Transitions + Micro-Interactions** - Page transitions, hover/tap effects, scroll animations, and shimmer loaders for premium feel

## Phase Details

### Phase 11: Bug Fixes + Foundation
**Goal**: Users encounter zero broken flows and the app respects their motion/accessibility preferences
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, A11Y-01, A11Y-02
**Success Criteria** (what must be TRUE):
  1. User can tap a back button on the sagra detail page to return to their previous view (search results, map, or homepage)
  2. User sees a styled placeholder (gradient + icon) on the sagra detail page when the sagra has no image, instead of broken/empty space
  3. User lands on Cerca page and immediately sees all sagre with "TUTTE" province filter pre-selected, without needing to interact
  4. User on a desktop browser sees content filling the available screen width, not squeezed into a narrow mobile column
  5. User with prefers-reduced-motion enabled sees no animations, and keyboard-only users see visible focus indicators on every interactive element
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md -- Fix 4 UX bugs (back button verify, placeholder verify, Cerca default filter, desktop width)
- [ ] 11-02-PLAN.md -- Accessibility foundation (reduced-motion MotionConfig, focus-visible on all interactive elements)

### Phase 12: Responsive Desktop Layout
**Goal**: Users on tablet and desktop see a layout purpose-built for larger screens with proper navigation, grids, and skeleton shapes
**Depends on**: Phase 11
**Requirements**: DESK-01, DESK-02, DESK-03, DESK-04, DESK-05, SKEL-02
**Success Criteria** (what must be TRUE):
  1. User on tablet sees 2-column card grids and on desktop sees 3-4 column grids with a responsive max-width container that scales across breakpoints
  2. User on lg+ screens sees a top navigation bar instead of BottomNav, with the same Home/Cerca/Mappa destinations
  3. User on desktop sees the sagra detail page with side-by-side layout (image and map on one side, info on the other) and sees sagra name tooltips on map marker hover
  4. User sees skeleton loading shapes that match the actual content layout at every breakpoint (single column on mobile, multi-column on tablet/desktop), preventing layout shift when content loads
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

### Phase 13: Transitions + Micro-Interactions
**Goal**: Users experience smooth, premium-feeling interactions that make Nemovia feel like a native app
**Depends on**: Phase 12
**Requirements**: TRANS-01, TRANS-02, MICRO-01, MICRO-02, MICRO-03, MICRO-04, MICRO-05, MICRO-06, SKEL-01, SCRL-01, SCRL-02, SCRL-03
**Success Criteria** (what must be TRUE):
  1. User sees smooth cross-fade transitions between pages and card images morph into detail page hero images during navigation
  2. User on desktop sees cards lift (scale + shadow) on hover and food tag badges brighten; on mobile, user feels brief scale-down tap feedback on cards and action buttons
  3. User sees images fade in smoothly as they load, BottomNav icons animate on selection, and all skeleton loaders display a shimmer sweep animation
  4. User scrolling the detail page sees a progress bar at the top, sections reveal with directional variety, and the hero section has a subtle parallax effect
  5. All animations from criteria 1-4 are suppressed when the user has prefers-reduced-motion enabled (enforced by A11Y-01 from Phase 11)
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD
- [ ] 13-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 1. Foundation & Design System | v1.0 | 2/2 | Complete | 2026-03-04 |
| 2. Scraping Pipeline | v1.0 | 4/4 | Complete | 2026-03-04 |
| 3. Data Enrichment | v1.0 | 3/3 | Complete | 2026-03-04 |
| 4. Discovery UI | v1.0 | 3/3 | Complete | 2026-03-05 |
| 5. Map & Detail | v1.0 | 3/3 | Complete | 2026-03-05 |
| 6. SEO & Polish | v1.0 | 3/3 | Complete | 2026-03-05 |
| 7. Deploy & Verify Baseline | v1.1 | 1/1 | Complete | 2026-03-06 |
| 8. Fix Cheerio Scrapers | v1.1 | 3/3 | Complete | 2026-03-07 |
| 9. Sagritaly Ingestion | v1.1 | 1/1 | Complete | 2026-03-07 |
| 10. Data Quality Filters | v1.1 | 2/2 | Complete | 2026-03-07 |
| 11. Bug Fixes + Foundation | v1.2 | 0/2 | Not started | - |
| 12. Responsive Desktop Layout | v1.2 | 0/? | Not started | - |
| 13. Transitions + Micro-Interactions | v1.2 | 0/? | Not started | - |
