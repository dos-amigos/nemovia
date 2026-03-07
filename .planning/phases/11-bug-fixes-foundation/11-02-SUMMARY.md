---
phase: 11-bug-fixes-foundation
plan: 02
subsystem: ui
tags: [accessibility, motion, focus-visible, reduced-motion, a11y]

# Dependency graph
requires:
  - phase: none
    provides: "First plan of v1.2, no prior dependencies"
provides:
  - "MotionConfig wrapper with reducedMotion='user' for all Motion animations"
  - "CSS @media rule suppressing animate-pulse and animate-spin for reduced-motion users"
  - "Providers.tsx client component wrapping NuqsAdapter + MotionConfig"
  - "Consistent focus-visible:ring on all custom interactive elements"
affects: [13-transitions-micro-interactions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["MotionConfig reducedMotion='user' context wrapper", "focus-visible:ring-[3px] focus-visible:ring-ring/50 standard for custom elements"]

key-files:
  created: ["src/components/Providers.tsx"]
  modified: ["src/app/layout.tsx", "src/app/globals.css", "src/components/detail/BackButton.tsx", "src/components/detail/SagraDetail.tsx", "src/components/layout/BottomNav.tsx", "src/components/sagra/SagraCard.tsx", "src/components/home/QuickFilters.tsx", "src/components/home/ProvinceSection.tsx", "src/components/home/HeroSection.tsx"]

key-decisions:
  - "Used single Providers.tsx wrapping both MotionConfig and NuqsAdapter to keep layout.tsx as Server Component"
  - "Global CSS @media rule for animate-pulse/spin rather than per-component motion-reduce classes"
  - "Consistent focus ring pattern: focus-visible:ring-[3px] focus-visible:ring-ring/50 matching Shadcn/UI conventions"

patterns-established:
  - "Providers pattern: all client-side context providers wrapped in src/components/Providers.tsx"
  - "Focus ring standard: focus-visible:ring-[3px] focus-visible:ring-ring/50 on all custom interactive elements"
  - "Reduced motion: MotionConfig for Motion library animations, CSS @media rule for Tailwind animations"

requirements-completed: [A11Y-01, A11Y-02]

# Metrics
duration: 8min
completed: 2026-03-07
---

# Phase 11 Plan 02: Accessibility Foundation Summary

**MotionConfig reduced-motion wrapper via Providers.tsx and focus-visible keyboard rings on all 7 custom interactive components**

## Performance

- **Duration:** 8 min (across 2 sessions with checkpoint verification)
- **Started:** 2026-03-07T12:20:00Z
- **Completed:** 2026-03-07T12:27:57Z
- **Tasks:** 3 (2 auto + 1 checkpoint verification)
- **Files modified:** 10

## Accomplishments
- Created Providers.tsx wrapping MotionConfig (reducedMotion="user") and NuqsAdapter, keeping root layout as Server Component
- Added CSS @media prefers-reduced-motion rule to suppress animate-pulse and animate-spin globally
- Added consistent focus-visible:ring-[3px] focus-visible:ring-ring/50 to all 7 custom interactive components (BackButton, BottomNav, SagraCard, QuickFilters, ProvinceSection, HeroSection, SagraDetail)
- All Phase 13 animations will automatically respect reduced-motion via the MotionConfig context

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Providers component and add CSS reduced-motion rule (A11Y-01)** - `a4543b2` (feat)
2. **Task 2: Add focus-visible ring to all custom interactive elements (A11Y-02)** - `a4fdeb6` (feat)
3. **Task 3: Verify accessibility features** - checkpoint:human-verify (approved, no commit needed)

## Files Created/Modified
- `src/components/Providers.tsx` - New client wrapper with MotionConfig + NuqsAdapter
- `src/app/layout.tsx` - Updated to use Providers instead of bare NuqsAdapter
- `src/app/globals.css` - Added @media prefers-reduced-motion rule for animate-pulse/spin
- `src/components/detail/BackButton.tsx` - Added focus-visible ring
- `src/components/detail/SagraDetail.tsx` - Added focus-visible ring on source link
- `src/components/layout/BottomNav.tsx` - Added focus-visible ring + rounded-lg on nav links
- `src/components/sagra/SagraCard.tsx` - Added focus-visible ring + rounded-lg on card link
- `src/components/home/QuickFilters.tsx` - Added focus-visible ring on filter chip buttons
- `src/components/home/ProvinceSection.tsx` - Added focus-visible ring on province links
- `src/components/home/HeroSection.tsx` - Added focus-visible ring on search bar link

## Decisions Made
- Used single Providers.tsx wrapping both MotionConfig and NuqsAdapter to keep layout.tsx as a Server Component
- Applied global CSS @media rule for animate-pulse/spin rather than per-component motion-reduce:animate-none classes (more maintainable, catches all current and future uses)
- Consistent focus ring pattern (focus-visible:ring-[3px] focus-visible:ring-ring/50) matching existing Shadcn/UI conventions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Accessibility foundation complete: all Phase 13 animations will automatically respect prefers-reduced-motion via MotionConfig
- Focus ring pattern established: any new interactive elements should follow the same focus-visible:ring-[3px] focus-visible:ring-ring/50 pattern
- Phase 11 complete (both plans done), ready for Phase 12 planning

## Self-Check: PASSED

- All 10 files verified as existing on disk
- Commit a4543b2 (Task 1) verified in git log
- Commit a4fdeb6 (Task 2) verified in git log

---
*Phase: 11-bug-fixes-foundation*
*Completed: 2026-03-07*
