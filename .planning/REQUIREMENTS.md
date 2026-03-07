# Requirements: Nemovia v1.2 "Polish"

**Defined:** 2026-03-07
**Core Value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.

## v1 Requirements

Requirements for v1.2 milestone. Each maps to roadmap phases.

### Bug Fixes

- [ ] **BUG-01**: User sees a visible back button on sagra detail page to return to previous view
- [ ] **BUG-02**: User sees an image placeholder (gradient + icon) on sagra detail page when no image is available
- [ ] **BUG-03**: User sees all sagre on Cerca page by default with "TUTTE" province filter pre-selected
- [ ] **BUG-04**: User sees content filling available screen width on desktop (not squeezed into 512px column)

### Responsive Desktop Layout

- [ ] **DESK-01**: User sees a wider content area on desktop (responsive max-width scaling with breakpoints)
- [ ] **DESK-02**: User sees multi-column card grids on tablet (2 cols) and desktop (3-4 cols)
- [ ] **DESK-03**: User sees desktop navigation (top bar or sidebar) on lg+ screens instead of BottomNav
- [ ] **DESK-04**: User sees sagra detail with side-by-side layout on desktop (image+map left, info right)
- [ ] **DESK-05**: User sees sagra name tooltip on map marker hover on desktop (without clicking)

### Page Transitions

- [ ] **TRANS-01**: User sees smooth cross-fade transition when navigating between pages
- [ ] **TRANS-02**: User sees card image morph into detail page hero image (shared element transition)

### Micro-Interactions

- [ ] **MICRO-01**: User sees card lift effect (subtle scale + shadow) on hover on desktop
- [ ] **MICRO-02**: User feels tap feedback (brief scale down) when pressing a card on mobile
- [ ] **MICRO-03**: User sees press animation on action buttons (Directions, Share, filter chips)
- [ ] **MICRO-04**: User sees active tab icon animation in BottomNav on selection
- [ ] **MICRO-05**: User sees images fade in smoothly as they load instead of popping in
- [ ] **MICRO-06**: User sees food tag badges scale slightly and brighten on hover

### Skeleton & Loading

- [ ] **SKEL-01**: User sees shimmer animation (animated gradient sweep) on all skeleton loaders
- [ ] **SKEL-02**: User sees content-aware skeleton shapes that match the actual page layout at every breakpoint

### Scroll Animations

- [ ] **SCRL-01**: User sees sections reveal with directional variety (up, left, right) on scroll
- [ ] **SCRL-02**: User sees a scroll progress bar at the top of the detail page
- [ ] **SCRL-03**: User sees subtle parallax effect on the hero section background

### Accessibility

- [ ] **A11Y-01**: User with prefers-reduced-motion OS setting sees no/minimal animations
- [ ] **A11Y-02**: User navigating with keyboard sees visible focus indicators on all interactive elements

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication

- **AUTH-01**: User can sign in with Google OAuth
- **AUTH-02**: User can sign in with Magic Link email
- **AUTH-03**: User session persists across browser refresh

### Favorites

- **FAV-01**: User can save/bookmark a sagra for later
- **FAV-02**: User can view list of saved sagre

### User Content

- **UGC-01**: User can leave a review on a sagra
- **UGC-02**: User can upload photos of a sagra

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Lenis smooth scroll library | Conflicts with Leaflet map pan/zoom, hijacks native scroll |
| barba.js page transitions | Incompatible with React/Next.js, DOMParser SSR errors |
| reactbits component library | Competing design system, adds GSAP dependency alongside Motion |
| Dark mode | Doubles CSS surface area, daytime-use food discovery app |
| Animated backgrounds / particles | Marketing aesthetic, distracts from content, hurts mobile performance |
| Infinite scroll | Complicates URL sharing and back button, pagination is better for filtered discovery |
| Complex page enter/exit animations | 300-500ms delay per navigation hurts utility app speed |
| Custom loading spinners | Skeleton loaders are strictly better for content-heavy UIs |
| LazyMotion migration | Optimization opportunity (34kb to 5kb) but not user-facing, defer |
| Shared element transitions (advanced) | React ViewTransition component still experimental, defer complex morphs to v1.3 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | — | Pending |
| BUG-02 | — | Pending |
| BUG-03 | — | Pending |
| BUG-04 | — | Pending |
| DESK-01 | — | Pending |
| DESK-02 | — | Pending |
| DESK-03 | — | Pending |
| DESK-04 | — | Pending |
| DESK-05 | — | Pending |
| TRANS-01 | — | Pending |
| TRANS-02 | — | Pending |
| MICRO-01 | — | Pending |
| MICRO-02 | — | Pending |
| MICRO-03 | — | Pending |
| MICRO-04 | — | Pending |
| MICRO-05 | — | Pending |
| MICRO-06 | — | Pending |
| SKEL-01 | — | Pending |
| SKEL-02 | — | Pending |
| SCRL-01 | — | Pending |
| SCRL-02 | — | Pending |
| SCRL-03 | — | Pending |
| A11Y-01 | — | Pending |
| A11Y-02 | — | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after initial definition*
