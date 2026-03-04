---
phase: 01-foundation-design-system
plan: 02
subsystem: ui
tags: [bottomnav, mobile-layout, route-groups, lucide-react, vercel-deploy]

# Dependency graph
requires:
  - phase: 01-foundation-design-system
    provides: "Next.js 15 project with Tailwind v4 OKLCH brand theme, shadcn/ui, lucide-react"
provides:
  - "Mobile-first layout shell with fixed BottomNav (Home/Cerca/Mappa tabs)"
  - "Route group (main) with shared layout wrapper and content padding"
  - "3 placeholder pages: homepage with skeleton cards, search page, map page"
  - "Vercel deployment with custom domain nemovia.it"
affects: [02-scraping-pipeline, 04-discovery-ui, 05-map-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [next-route-groups, client-component-usePathname, fixed-bottom-nav-pb-safe, mobile-first-max-w-lg]

key-files:
  created:
    - src/components/layout/BottomNav.tsx
    - src/app/(main)/layout.tsx
    - src/app/(main)/page.tsx
    - src/app/(main)/cerca/page.tsx
    - src/app/(main)/mappa/page.tsx
  modified:
    - src/app/page.tsx (deleted -- replaced by route group page)

key-decisions:
  - "Used Next.js route group (main) to share BottomNav layout across all tab pages"
  - "usePathname() for exact-match active tab detection (pathname === href)"
  - "pb-20 on layout wrapper to prevent content clipping behind fixed BottomNav"
  - "max-w-lg on main content for mobile-optimized feel on wider screens"
  - "Deployed to Vercel with custom domain nemovia.it"

patterns-established:
  - "Route group layout: (main)/layout.tsx wraps all user-facing pages with BottomNav"
  - "BottomNav active state: text-primary for active tab, text-muted-foreground for inactive"
  - "Content padding: pb-20 on wrapper, mx-auto max-w-lg px-4 py-4 on main"
  - "Placeholder page pattern: heading + subtitle + skeleton cards for future content"

requirements-completed: [UI-01, UI-02]

# Metrics
duration: 18min
completed: 2026-03-04
---

# Phase 1 Plan 02: Mobile Layout Shell Summary

**Mobile-first BottomNav layout with Home/Cerca/Mappa tabs, placeholder pages, and Vercel deployment at nemovia.it**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-04T15:29:38Z
- **Completed:** 2026-03-04T15:47:33Z
- **Tasks:** 2 (1 auto + 1 checkpoint approved)
- **Files created:** 5
- **Files deleted:** 1

## Accomplishments
- Built BottomNav client component with 3 tabs (Home, Cerca, Mappa) using lucide-react icons and brand amber-600 active state
- Created route group layout wrapping all tab pages with fixed BottomNav and proper content padding (pb-20)
- Created 3 placeholder pages: homepage with "Scopri le sagre del Veneto" heading and skeleton cards, Cerca search page with filter description, Mappa page with map placeholder
- Deleted default create-next-app page.tsx to avoid route conflicts with route group
- User verified mobile layout visually and deployed to Vercel with custom domain nemovia.it

## Task Commits

Each task was committed atomically:

1. **Task 1: Build BottomNav component and mobile layout shell with placeholder pages** - `60b0237` (feat)
2. **Task 2: Verify mobile layout and deploy to Vercel** - checkpoint approved by user

## Files Created/Modified
- `src/components/layout/BottomNav.tsx` - Client component with 3 tabs, usePathname for active detection, lucide-react icons
- `src/app/(main)/layout.tsx` - Route group layout with BottomNav and pb-20 content padding
- `src/app/(main)/page.tsx` - Homepage placeholder with brand heading and 3 skeleton cards
- `src/app/(main)/cerca/page.tsx` - Search page placeholder with search bar skeleton and 2 card skeletons
- `src/app/(main)/mappa/page.tsx` - Map page placeholder with 60vh map area
- `src/app/page.tsx` - Deleted (replaced by route group page)

## Decisions Made
- Used Next.js route group `(main)` to share BottomNav layout across all tab pages without affecting the URL structure
- Active tab detection uses `usePathname()` with exact match (`pathname === href`) for clean routing
- Applied `pb-20` on layout wrapper to prevent content from being hidden behind the fixed 64px BottomNav
- Constrained main content with `max-w-lg` for a mobile-optimized feel even on wider screens
- Deployed to Vercel with custom domain nemovia.it configured

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

User completed the following during checkpoint verification:
- Verified mobile layout visually in browser
- Pushed code to GitHub (`git push origin master`)
- Imported repository in Vercel dashboard (https://vercel.com/new)
- Added Supabase environment variables in Vercel project settings
- Deployed and configured custom domain nemovia.it

## Next Phase Readiness
- Mobile layout shell is complete with working tab navigation across 3 routes
- Brand design system (amber-600 primary, stone-50 background) is visible throughout
- App is deployed on Vercel at nemovia.it and accessible publicly
- Phase 1 is fully complete -- ready for Phase 2: Scraping Pipeline
- All placeholder pages ready to be populated with real content in Phase 4

## Self-Check: PASSED

All 5 created files verified present. Deleted file (src/app/page.tsx) confirmed removed. Task commit (60b0237) verified in git history.

---
*Phase: 01-foundation-design-system*
*Completed: 2026-03-04*
