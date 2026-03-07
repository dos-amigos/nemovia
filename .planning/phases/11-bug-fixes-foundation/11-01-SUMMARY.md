---
phase: 11-bug-fixes-foundation
plan: 01
subsystem: ui
tags: [tailwind, shadcn-select, responsive, ux-bugs]

# Dependency graph
requires:
  - phase: none
    provides: first plan of v1.2
provides:
  - "Desktop-width container (max-w-7xl) for all (main) pages"
  - "Cerca page default provincia filter showing all sagre"
  - "Verified: back button and image placeholder already working"
affects: [12-responsive-desktop-layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "max-w-7xl container for responsive desktop width"
    - "__all__ sentinel value for Select default state"

key-files:
  created: []
  modified:
    - src/app/(main)/layout.tsx
    - src/components/search/SearchFilters.tsx

key-decisions:
  - "BUG-01 and BUG-02 confirmed already working (no code changes needed)"
  - "Used max-w-7xl (1280px) as desktop max-width, preserving mobile px-4 padding"
  - "Used __all__ sentinel as Select default value instead of empty string for visual pre-selection"

patterns-established:
  - "max-w-7xl responsive container: mobile unaffected, desktop fills to 1280px"

requirements-completed: [BUG-01, BUG-02, BUG-03, BUG-04]

# Metrics
duration: 8min
completed: 2026-03-07
---

# Phase 11 Plan 01: Fix 4 UX Bugs Summary

**Desktop content width expanded to 1280px (max-w-7xl), Cerca page defaults to "Tutte" provincia filter, back button and image placeholder verified working**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-07T12:19:00Z
- **Completed:** 2026-03-07T12:27:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- BUG-04: Desktop content now fills available width up to 1280px instead of being squeezed into 512px column
- BUG-03: Cerca page shows "Tutte" pre-selected in provincia filter on first visit, so all sagre display immediately
- BUG-01: Back button on sagra detail page verified already working (BackButton component exists at line 51 of SagraDetail.tsx)
- BUG-02: Image placeholder on sagra detail page verified already working (gradient placeholder with UtensilsCrossed icon at lines 47-49 of SagraDetail.tsx)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix desktop content width (BUG-04) and Cerca default filter (BUG-03)** - `f6730b3` (fix)
2. **Task 2: Verify all four bug fixes** - checkpoint:human-verify, approved by user

## Files Created/Modified
- `src/app/(main)/layout.tsx` - Changed `max-w-lg` to `max-w-7xl` in main container for desktop-width content
- `src/components/search/SearchFilters.tsx` - Changed provincia Select default from empty string to `__all__` so "Tutte" appears selected

## Decisions Made
- BUG-01 (back button) and BUG-02 (image placeholder) were confirmed already working during research phase, so no code changes were needed -- only verification
- Used `max-w-7xl` (1280px) as the desktop max-width, which has zero effect on mobile since viewports are already narrower than 1280px
- Used `__all__` sentinel value as the Select's default `value` prop instead of empty string, making "Tutte" visually appear as a selected option rather than placeholder text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Desktop container width is set, ready for Phase 12 responsive grid layout work
- All four UX bugs resolved, no broken flows remain
- Phase 11 Plan 02 (accessibility foundation) can proceed independently

## Self-Check: PASSED

- [x] `src/app/(main)/layout.tsx` exists and contains `max-w-7xl`
- [x] `src/components/search/SearchFilters.tsx` exists and contains `__all__` default
- [x] Commit `f6730b3` exists in git history

---
*Phase: 11-bug-fixes-foundation*
*Completed: 2026-03-07*
