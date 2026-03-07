---
phase: 12-responsive-desktop-layout
plan: 01
subsystem: ui
tags: [tailwind, responsive, navigation, layout, nextjs]

# Dependency graph
requires:
  - phase: 11-bug-fixes-a11y-foundation
    provides: "Focus ring pattern (focus-visible:ring-[3px]) and max-w-7xl container"
provides:
  - "TopNav.tsx desktop navigation bar component"
  - "Responsive layout shell with dual nav (TopNav lg+, BottomNav mobile)"
  - "Responsive container padding (px-4/sm:px-6/lg:px-8)"
  - "Responsive map height calculation for both viewports"
affects: [12-02, responsive-desktop-layout]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CSS-only nav swap via hidden/lg:block + lg:hidden", "Tailwind responsive height calc replacing inline styles"]

key-files:
  created:
    - src/components/layout/TopNav.tsx
  modified:
    - src/components/layout/BottomNav.tsx
    - src/app/(main)/layout.tsx
    - src/app/(main)/mappa/MappaClientPage.tsx
    - src/app/(main)/mappa/loading.tsx

key-decisions:
  - "CSS-only nav swap (hidden/lg:block + lg:hidden) -- no JS viewport detection needed"
  - "Replaced inline style heights with Tailwind arbitrary value classes for responsive map"

patterns-established:
  - "Nav swap pattern: TopNav uses hidden lg:block, BottomNav uses lg:hidden for zero-JS breakpoint switching"
  - "Responsive padding scale: px-4 -> sm:px-6 -> lg:px-8 on main content container"

requirements-completed: [DESK-01, DESK-03]

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 12 Plan 01: Desktop Navigation and Responsive Layout Summary

**TopNav desktop navigation with CSS-only nav swap, responsive container padding, and breakpoint-aware map height**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T12:53:05Z
- **Completed:** 2026-03-07T12:54:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created TopNav.tsx with sticky desktop navigation bar (brand + nav links), visible only at lg+ breakpoint
- Updated BottomNav with lg:hidden for automatic mobile/desktop nav switching via CSS
- Added responsive container padding that scales across breakpoints (px-4/sm:px-6/lg:px-8)
- Converted map page from inline style height to Tailwind responsive height classes for both viewports

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TopNav and update navigation swap in layout** - `34d6f98` (feat)
2. **Task 2: Update map page responsive height calculation** - `53c9121` (feat)

## Files Created/Modified
- `src/components/layout/TopNav.tsx` - Desktop navigation bar with brand link and nav tabs, hidden on mobile
- `src/components/layout/BottomNav.tsx` - Added lg:hidden to hide on desktop
- `src/app/(main)/layout.tsx` - Renders both navs, responsive padding, conditional bottom padding
- `src/app/(main)/mappa/MappaClientPage.tsx` - Responsive map height via Tailwind classes (no inline style)
- `src/app/(main)/mappa/loading.tsx` - Skeleton with responsive height matching map page

## Decisions Made
- CSS-only nav swap (hidden/lg:block + lg:hidden) rather than JS-based viewport detection -- simpler, no hydration mismatch risk
- Replaced inline style height with Tailwind arbitrary value classes (h-[calc(100vh-5rem)] lg:h-[calc(100vh-4.5rem)]) -- enables responsive breakpoints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Desktop navigation shell complete, ready for Plan 02 (card grid layouts and content responsiveness)
- TopNav/BottomNav swap pattern established for any future nav additions
- Responsive padding scale in place for all page content

---
*Phase: 12-responsive-desktop-layout*
*Completed: 2026-03-07*
