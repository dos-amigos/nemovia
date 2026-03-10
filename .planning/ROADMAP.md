# Roadmap: Nemovia

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-05)
- ✅ **v1.1 Dati Reali** — Phases 7-10 (shipped 2026-03-07)
- ✅ **v1.2 Polish** — Phases 11-13 (shipped 2026-03-09)
- ✅ **v1.3 Dati Puliti + Redesign** — Phases 14-17 (shipped 2026-03-10)
- 🚧 **v1.4 Esperienza Completa** — Phases 18-23 (in progress)

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

<details>
<summary>✅ v1.3 Dati Puliti + Redesign (Phases 14-17) — SHIPPED 2026-03-10</summary>

- [x] Phase 14: Data Quality Heuristic Filters (2/2 plans) — completed 2026-03-09
- [x] Phase 15: Deduplication & Classification (2/2 plans) — completed 2026-03-10
- [x] Phase 16: Design System Foundation (2/2 plans) — completed 2026-03-10
- [x] Phase 17: Visual Effects, Layout & Performance (3/3 plans) — completed 2026-03-10

Full details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

</details>

### v1.4 Esperienza Completa (Phases 18-23) — IN PROGRESS

- [x] **Phase 18: Data Pipeline Restoration** - Restore event count to 100+, fix Veneto gating, filter non-sagre (completed 2026-03-10)
- [ ] **Phase 19: Image Quality Foundation** - Unsplash fallbacks for cards + photo hero
- [ ] **Phase 20: Layout & Branding** - Full-width layout, custom logo, complete footer
- [ ] **Phase 21: Netflix Rows Homepage** - Horizontal scroll rows with smart categorization
- [ ] **Phase 22: City Search & Map Fixes** - Autocomplete search bar, radius slider, fix map bugs
- [ ] **Phase 23: Scraping Completeness** - Extract complete info from sources

## Phase Details

### Phase 18: Data Pipeline Restoration
**Goal**: Restore application to healthy data state with 100+ active sagre, accurate Veneto gating, and effective non-sagre filtering.

**Depends on**: Nothing (first phase of v1.4)

**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, SCRAPE-02

**Success Criteria** (what must be TRUE):
1. User sees 100+ active sagre when browsing homepage or search page
2. User never encounters events from outside Veneto region (no San Miniato Toscana)
3. User never sees non-sagre events like passeggiate, concerti, carnevale, or mostre in results
4. Every sagra's location displays with provincia in parentheses (e.g. "Zugliano (VI)")
5. Scraper health dashboard shows all sources active or failing sources identified with new candidates added

**Plans:** 3/3 plans complete

Plans:
- [ ] 18-01-PLAN.md — Filter recalibration: isNonSagraTitle() TDD + SQL re-activation of false positives
- [ ] 18-02-PLAN.md — Veneto gating: Nominatim viewbox + province code normalization + display fix
- [ ] 18-03-PLAN.md — New source investigation: itinerarinelgusto.it + combined count verification

---

### Phase 19: Image Quality Foundation
**Goal**: Ensure every sagra displays a high-quality, relevant image through Unsplash integration and replace homepage placeholder with full-bleed photo hero.

**Depends on**: Phase 18 (needs healthy dataset to test image assignments)

**Requirements**: IMG-01, IMG-02

**Success Criteria** (what must be TRUE):
1. User never sees low-resolution or broken placeholder images on any sagra card
2. Every sagra without a source image displays a thematically relevant Unsplash photo (food/festival themed)
3. Homepage hero displays a stunning full-bleed food photograph with white text "SCOPRI LE SAGRE DEL VENETO"
4. Unsplash attribution appears in footer for all displayed Unsplash images

**Plans**: TBD

---

### Phase 20: Layout & Branding
**Goal**: Transform site visual identity with custom logo, professional footer, and full-width responsive layout that feels premium on desktop.

**Depends on**: Phase 19 (hero image integration needs layout foundation)

**Requirements**: BRAND-01, BRAND-02, BRAND-03

**Success Criteria** (what must be TRUE):
1. User sees custom SVG logo in coral/teal palette on all pages (not generic text)
2. Homepage hero and scroll rows extend edge-to-edge on desktop while content maintains readable width
3. Footer displays on every page with credits "Fatto con cuore in Veneto" and Unsplash attribution
4. Desktop layout at 1920px and 2560px maintains visual hierarchy without text expanding beyond readable width

**Plans**: TBD

---

### Phase 21: Netflix Rows Homepage
**Goal**: Replace static bento grid with engaging Netflix-style horizontal scroll rows that surface sagre through multiple discovery paths.

**Depends on**: Phase 20 (needs full-width layout and hero foundation)

**Requirements**: HOME-01

**Success Criteria** (what must be TRUE):
1. User can horizontally scroll through 4-5 distinct sagra categories (weekend, nearby, cuisine type, province)
2. Each row displays minimum 3 sagre or is hidden (no sparse rows)
3. Sagre do not duplicate across multiple rows (weekend excludes items from nearby, etc.)
4. User can see which row they're scrolling with clear category labels
5. Horizontal scroll interaction feels smooth with CSS scroll-snap, not janky carousel

**Plans**: TBD

---

### Phase 22: City Search & Map Fixes
**Goal**: Enable users to quickly search for sagre near any Veneto city and fix broken map functionality on Cerca and Mappa pages.

**Depends on**: Phase 21 (city search embeds in hero section from Phase 21)

**Requirements**: HOME-02, MAP-01, MAP-02

**Success Criteria** (what must be TRUE):
1. User can type city name in hero search bar and see autocomplete suggestions of Veneto comuni
2. Selecting a city redirects to Cerca page with city pre-selected and radius slider visible (5-100km)
3. Map view on Cerca page displays correct markers matching current search filters
4. Dedicated Mappa page displays filter controls at top allowing users to refine visible sagre
5. No Nominatim API calls occur during autocomplete typing (IP ban prevention)

**Plans**: TBD

---

### Phase 23: Scraping Completeness
**Goal**: Extract maximum information from source sites (menu, orari, descriptions) to provide users with complete sagra details.

**Depends on**: Phase 18 (needs stable scraper infrastructure)

**Requirements**: SCRAPE-01

**Success Criteria** (what must be TRUE):
1. Sagre from sources that publish menus display menu information on detail pages
2. Sagre from sources that publish orari display opening hours/schedule
3. Sagre with detailed descriptions show richer content than generic LLM summaries
4. Source attribution links remain functional and direct users to original event pages

**Plans**: TBD

---

## Progress

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
| 14. Data Quality Heuristic Filters | v1.3 | 2/2 | Complete | 2026-03-09 |
| 15. Deduplication & Classification | v1.3 | 2/2 | Complete | 2026-03-10 |
| 16. Design System Foundation | v1.3 | 2/2 | Complete | 2026-03-10 |
| 17. Visual Effects, Layout & Performance | v1.3 | 3/3 | Complete | 2026-03-10 |
| 18. Data Pipeline Restoration | 3/3 | Complete   | 2026-03-10 | - |
| 19. Image Quality Foundation | v1.4 | 0/? | Not started | - |
| 20. Layout & Branding | v1.4 | 0/? | Not started | - |
| 21. Netflix Rows Homepage | v1.4 | 0/? | Not started | - |
| 22. City Search & Map Fixes | v1.4 | 0/? | Not started | - |
| 23. Scraping Completeness | v1.4 | 0/? | Not started | - |
