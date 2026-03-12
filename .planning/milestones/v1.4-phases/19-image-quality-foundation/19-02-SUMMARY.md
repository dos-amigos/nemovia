---
phase: 19-image-quality-foundation
plan: 02
subsystem: ui
tags: [unsplash, hero-image, next-image, attribution, full-bleed]

# Dependency graph
requires:
  - phase: 19-image-quality-foundation
    provides: Unsplash utility library (getHeroImage, parseImageCredit) and image_credit column
provides:
  - Full-bleed Unsplash photo hero on homepage with dark overlay and white text
  - Unsplash photographer attribution on sagra detail page
  - image_credit field in SagraCardData type for card-level attribution
affects: [20 layout-branding, 21 netflix-rows]

# Tech tracking
tech-stack:
  added: []
  patterns: [full-bleed-breakout-negative-margin, unsplash-attribution-display]

key-files:
  modified:
    - src/components/home/HeroSection.tsx
    - src/app/(main)/page.tsx
    - src/components/detail/SagraDetail.tsx
    - src/lib/queries/types.ts
    - src/lib/constants/veneto.ts

key-decisions:
  - "Server component hero (no 'use client') -- static render with next/image priority for LCP"
  - "Rounded corners (rounded-2xl) on hero per user visual feedback at checkpoint"
  - "image_credit added to SAGRA_CARD_FIELDS query constant to fix runtime mismatch"

patterns-established:
  - "Full-bleed breakout: -mx-4 sm:-mx-6 lg:-mx-6 wrapper for edge-to-edge hero sections"
  - "Unsplash attribution pattern: parseImageCredit() + conditional render below image"
  - "Hero height classes h-[280px] sm:h-[340px] lg:h-[400px] for CLS prevention"

requirements-completed: [IMG-02]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 19 Plan 02: Unsplash Hero & Attribution UI Summary

**Full-bleed Unsplash food photo hero with dark gradient overlay, edge-to-edge breakout layout, and photographer attribution on detail pages**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T10:25:00Z
- **Completed:** 2026-03-11T10:33:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Homepage hero completely rewritten from mesh gradient to full-bleed Unsplash food photograph with dark-to-transparent gradient overlay
- White bold text "SCOPRI LE SAGRE DEL VENETO" with drop-shadow and search CTA pill button
- Photographer attribution in bottom-right corner of hero linking to Unsplash with UTM params
- Sagra detail page displays "Photo by [Name] on Unsplash" below hero image when image_credit is present
- Edge-to-edge breakout wrapper (-mx-4 sm:-mx-6 lg:-mx-6) for hero section on homepage
- SagraCardData type includes image_credit for future card-level attribution

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite HeroSection with full-bleed photo and wire into homepage** - `93ea0d2` (feat)
2. **Task 2: Add Unsplash attribution to sagra detail page** - `9795afd` (feat)
3. **Task 3: Visual verification + rounded corners refinement** - `cb9c045` (style)

## Files Created/Modified
- `src/components/home/HeroSection.tsx` - Full-bleed Unsplash photo hero with dark gradient overlay, white text, search CTA, and attribution
- `src/app/(main)/page.tsx` - Negative-margin breakout wrapper for edge-to-edge hero display
- `src/components/detail/SagraDetail.tsx` - Unsplash photographer attribution below hero image (conditional on image_credit)
- `src/lib/queries/types.ts` - Added image_credit to SagraCardData Pick type
- `src/lib/constants/veneto.ts` - Added image_credit to SAGRA_CARD_FIELDS query constant

## Decisions Made
- Hero uses server component (no "use client") for static rendering with next/image priority prop for LCP optimization
- Rounded corners (rounded-2xl) added to hero section per user visual feedback during checkpoint review
- image_credit added to SAGRA_CARD_FIELDS constant to fix runtime type mismatch (was in type but not in query string)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added image_credit to SAGRA_CARD_FIELDS query constant**
- **Found during:** Task 1 (HeroSection rewrite)
- **Issue:** image_credit was added to SagraCardData type but not to the SAGRA_CARD_FIELDS string constant used in Supabase queries, causing runtime mismatch
- **Fix:** Added `image_credit` to the select string in `src/lib/constants/veneto.ts`
- **Files modified:** src/lib/constants/veneto.ts
- **Verification:** TypeScript compilation passed
- **Committed in:** 93ea0d2 (Task 1 commit)

**2. [Rule 1 - Visual Fix] Added rounded corners to hero per user feedback**
- **Found during:** Task 3 (Visual verification checkpoint)
- **Issue:** User requested rounded corners on hero section for better visual integration with page layout
- **Fix:** Added `rounded-2xl` class and horizontal margins `mx-4 lg:mx-6` to hero section
- **Files modified:** src/components/home/HeroSection.tsx
- **Verification:** User visually approved
- **Committed in:** cb9c045 (post-checkpoint)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 visual fix from user feedback)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None - all three tasks completed without blocking issues.

## User Setup Required
None - no external service configuration required. (Unsplash API key setup was handled in Plan 19-01.)

## Next Phase Readiness
- Phase 19 (Image Quality Foundation) fully complete
- Hero section ready for full-width layout integration in Phase 20
- Attribution pattern established for reuse in Netflix row cards (Phase 21)
- image_credit in SagraCardData enables card-level attribution when needed

## Self-Check: PASSED

All 5 modified files verified present. All 3 commits verified in git log.

---
*Phase: 19-image-quality-foundation*
*Completed: 2026-03-11*
