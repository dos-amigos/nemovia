---
phase: 13-transitions-micro-interactions
plan: 02
subsystem: ui
tags: [motion, framer-motion, animations, micro-interactions, hover, tap, fade-image]

# Dependency graph
requires:
  - phase: 11-bug-fixes-foundation
    provides: MotionConfig with reduced-motion support in Providers.tsx
  - phase: 13-transitions-micro-interactions
    plan: 01
    provides: page transition AnimatePresence wrapper (exit animations context)
provides:
  - FadeImage client component for smooth image loading transitions
  - Card hover lift (desktop) and tap feedback (mobile) via motion.div
  - Card exit animation (scale-up + fade) for page transition morph effect
  - Press animations on DirectionsButton, ShareButton, QuickFilter chips
  - Badge secondary variant hover scale + brightness effect
affects: [13-transitions-micro-interactions]

# Tech tracking
tech-stack:
  added: []
  patterns: [motion.div wrapper for gesture animations, motion.a for animated anchor tags, motion.button for animated buttons, FadeImage wrapper for progressive image loading]

key-files:
  created:
    - src/components/animations/FadeImage.tsx
  modified:
    - src/components/sagra/SagraCard.tsx
    - src/components/detail/SagraDetail.tsx
    - src/components/detail/DirectionsButton.tsx
    - src/components/detail/ShareButton.tsx
    - src/components/home/QuickFilters.tsx
    - src/components/ui/badge.tsx

key-decisions:
  - "SagraCard converted to client component -- safe since parent StaggerGrid is already client"
  - "DirectionsButton converted to client component for motion.a usage -- no server-side data fetching affected"
  - "ShareButton wrapped in motion.div rather than converting Button to motion component -- simpler, same visual"
  - "Badge hover effects use CSS-only (no motion import) to keep Badge as non-client component"
  - "FadeImage handles cached images via useEffect + img.complete check"

patterns-established:
  - "motion.div wrapper pattern: wrap existing UI in motion.div for gesture animations without changing component structure"
  - "FadeImage pattern: opacity-0 initial, onLoad + useEffect complete check for fade-in"

requirements-completed: [TRANS-02, MICRO-01, MICRO-02, MICRO-03, MICRO-05, MICRO-06]

# Metrics
duration: 8min
completed: 2026-03-09
---

# Phase 13 Plan 02: Card & Button Micro-Interactions Summary

**Card hover/tap gestures with motion.div, FadeImage progressive loading, button press animations, and badge hover effects across all interactive elements**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T09:36:45Z
- **Completed:** 2026-03-09T09:45:08Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Cards respond to hover (desktop lift with shadow) and tap (mobile scale-down feedback) with spring physics
- Card exit animation creates a brief scale-up + fade morph effect during page transitions
- Images fade in smoothly on load via FadeImage component (handles both fresh and cached images)
- All action buttons (DirectionsButton, ShareButton) and filter chips have press animation feedback
- Food tag badges scale up and brighten on hover via CSS transitions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FadeImage component and convert SagraCard to client with motion gestures** - `bffb1eb` (feat)
2. **Task 2: Add press animations to buttons, filter chips, and badge hover effects** - `ec7b1a8` (feat)

## Files Created/Modified
- `src/components/animations/FadeImage.tsx` - Client component wrapping next/image with opacity fade-in on load
- `src/components/sagra/SagraCard.tsx` - Converted to client component with motion.div whileHover, whileTap, exit gestures
- `src/components/detail/SagraDetail.tsx` - Hero image replaced with FadeImage for smooth loading; removed unused import
- `src/components/detail/DirectionsButton.tsx` - Converted to client component with motion.a whileTap press animation
- `src/components/detail/ShareButton.tsx` - Wrapped Button in motion.div with whileTap press animation
- `src/components/home/QuickFilters.tsx` - Filter chip buttons converted to motion.button with whileTap animation
- `src/components/ui/badge.tsx` - Secondary variant gains hover:scale-105 and hover:brightness-110 CSS transitions

## Decisions Made
- SagraCard safely converted to client -- parent StaggerGrid is already a client component boundary
- DirectionsButton converted to client for motion.a -- pure presentational, no server data fetching
- ShareButton uses motion.div wrapper instead of motion-compatible Button to avoid Shadcn component complexity
- Badge hover effects are CSS-only (no motion import) to keep Badge as a server-safe component
- FadeImage uses useEffect + img.complete check to handle browser-cached images that skip onLoad

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused ArrowLeft import from SagraDetail**
- **Found during:** Task 1 (SagraDetail modification)
- **Issue:** ESLint flagged ArrowLeft as unused import after Image import was replaced
- **Fix:** Removed ArrowLeft from lucide-react import list
- **Files modified:** src/components/detail/SagraDetail.tsx
- **Verification:** Build passes with no warnings
- **Committed in:** bffb1eb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup of pre-existing unused import. No scope creep.

## Issues Encountered
- Stale .next cache caused build-manifest.json / pages-manifest.json errors during build verification. Resolved by cleaning .next directory before rebuild. Not a code issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All card and button micro-interactions complete
- FadeImage component available for any future image usage
- Ready for Plan 03 (skeleton shimmer animations, remaining polish)

## Self-Check: PASSED

All 8 files verified present. Both task commits (bffb1eb, ec7b1a8) verified in git log.

---
*Phase: 13-transitions-micro-interactions*
*Completed: 2026-03-09*
