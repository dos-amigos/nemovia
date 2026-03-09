# Roadmap: Nemovia

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-05)
- ✅ **v1.1 Dati Reali** — Phases 7-10 (shipped 2026-03-07)
- ✅ **v1.2 Polish** — Phases 11-13 (shipped 2026-03-09)
- 🚧 **v1.3 Dati Puliti + Redesign** — Phases 14-17 (in progress)

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

<details>
<summary>✅ v1.1 Dati Reali (Phases 7-10) — SHIPPED 2026-03-07</summary>

- [x] Phase 7: Deploy & Verify Baseline (1/1 plans) — completed 2026-03-06
- [x] Phase 8: Fix Cheerio Scrapers (3/3 plans) — completed 2026-03-07
- [x] Phase 9: Sagritaly Ingestion (1/1 plans) — completed 2026-03-07
- [x] Phase 10: Data Quality Filters (2/2 plans) — completed 2026-03-07

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Polish (Phases 11-13) — SHIPPED 2026-03-09</summary>

- [x] Phase 11: Bug Fixes + Foundation (2/2 plans) — completed 2026-03-07
- [x] Phase 12: Responsive Desktop Layout (2/2 plans) — completed 2026-03-07
- [x] Phase 13: Transitions + Micro-Interactions (3/3 plans) — completed 2026-03-09

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### 🚧 v1.3 Dati Puliti + Redesign (In Progress)

**Milestone Goal:** Eliminare i dati spazzatura dalla pipeline e ridisegnare l'interfaccia con un'estetica moderna e d'impatto.

- [ ] **Phase 14: Data Quality Heuristic Filters** - Deterministic validation filters in scrape pipeline reject garbage data before it reaches users
- [ ] **Phase 15: Deduplication & Classification** - Fuzzy dedup via pg_trgm and LLM-based sagra/non-sagra classification eliminate duplicates and off-topic events
- [ ] **Phase 16: Design System Foundation** - New Geist typography and vibrant OKLCH color palette replace the dated amber/stone aesthetic
- [ ] **Phase 17: Visual Effects, Layout & Performance** - Glassmorphism, mesh gradients, bento grid, and LazyMotion deliver the WOW factor with optimized bundle

## Phase Details

### Phase 14: Data Quality Heuristic Filters
**Goal**: Users see only real, current sagre with valid dates and reasonable durations -- no calendar spam, no expired 2025 events, no absurd multi-month "sagre"
**Depends on**: Phase 13 (v1.2 complete)
**Requirements**: DQ-01, DQ-02, DQ-03, DQ-04, DQ-05
**Success Criteria** (what must be TRUE):
  1. Browsing the app shows zero generic calendar-spam titles (e.g., "Calendario mensile eventi sagre...")
  2. No event displayed has a date range spanning an entire month or longer
  3. No event displayed has a duration exceeding 7 days
  4. No event from 2025 or earlier appears anywhere in the app
  5. Existing production data that violates these rules has been cleaned up (deactivated)
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

### Phase 15: Deduplication & Classification
**Goal**: Users see each sagra only once and never see non-sagra events (antique markets, exhibitions, generic markets) mixed in with real food festivals
**Depends on**: Phase 14
**Requirements**: DQ-06, DQ-07, DQ-08, DQ-09, DQ-10
**Success Criteria** (what must be TRUE):
  1. No two events with near-identical titles in the same location appear in search results or on the map
  2. Events that are clearly not sagre (antiquariato, mostre, mercati) do not appear in the app
  3. LLM classification runs within the existing enrichment pipeline with no additional API calls
  4. Sagra cards display higher-resolution images where the source provides them (no more tiny thumbnails when a larger version exists)
  5. Cards without a usable image show a visually pleasant branded placeholder instead of a broken image or generic grey box
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

### Phase 16: Design System Foundation
**Goal**: The app's visual identity is transformed -- modern Geist typography and a vibrant new color palette make every screen feel fresh and intentional
**Depends on**: Phase 15 (clean data makes the new design shine)
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. All text across the app renders in Geist font (loaded via next/font/google, no layout shift)
  2. The amber-600/stone-50 palette is completely gone -- replaced by a vibrant, modern OKLCH palette visible on every page
  3. All Shadcn/UI component tokens (primary, secondary, accent, destructive, and their foreground pairs) use the new palette consistently
  4. No hardcoded old-palette colors remain in any component (gradients, badges, tags, backgrounds all use new palette)
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD

### Phase 17: Visual Effects, Layout & Performance
**Goal**: The app delivers a WOW-factor visual experience -- glassmorphism nav, mesh gradient backgrounds, bento grid homepage, and a dramatically smaller animation bundle
**Depends on**: Phase 16 (visual effects must layer on finalized color palette)
**Requirements**: UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11
**Success Criteria** (what must be TRUE):
  1. TopNav and BottomNav have a glass-like translucent appearance (backdrop-blur, semi-transparent background) that reveals content scrolling behind them
  2. Hero section and page backgrounds use mesh gradients that create visual depth and movement
  3. Homepage uses a responsive bento grid layout that feels editorial and modern (not a uniform card list)
  4. SagraCard, Hero, and key page components have been visually redesigned to match the modern aesthetic (not just recolored)
  5. Motion bundle initial load is reduced from ~34KB to ~5KB via LazyMotion migration, with no regression in existing animations, and glassmorphism scrolls smoothly on mobile (no jank)
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD
- [ ] 17-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17

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
| 11. Bug Fixes + Foundation | v1.2 | 2/2 | Complete | 2026-03-07 |
| 12. Responsive Desktop Layout | v1.2 | 2/2 | Complete | 2026-03-07 |
| 13. Transitions + Micro-Interactions | v1.2 | 3/3 | Complete | 2026-03-09 |
| 14. Data Quality Heuristic Filters | v1.3 | 0/? | Not started | - |
| 15. Deduplication & Classification | v1.3 | 0/? | Not started | - |
| 16. Design System Foundation | v1.3 | 0/? | Not started | - |
| 17. Visual Effects, Layout & Performance | v1.3 | 0/? | Not started | - |
