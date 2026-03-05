---
phase: 06-seo-polish
plan: 01
subsystem: seo
tags: [metadata, opengraph, sitemap, robots, next-og, seo]

# Dependency graph
requires:
  - phase: 05-map-detail
    provides: "sagra detail page and getSagraBySlug query"
provides:
  - "metadataBase and title.template on root layout"
  - "robots.txt allowing all crawlers with sitemap reference"
  - "dynamic sitemap.xml with static + sagre entries from Supabase"
  - "per-page metadata exports (home, cerca, mappa, sagra detail)"
  - "dynamic OG image generation per sagra detail page"
affects: [06-seo-polish]

# Tech tracking
tech-stack:
  added: [next/og ImageResponse]
  patterns: [generateMetadata, MetadataRoute.Robots, MetadataRoute.Sitemap, dynamic OG images]

key-files:
  created:
    - src/app/robots.ts
    - src/app/sitemap.ts
    - src/app/(main)/sagra/[slug]/opengraph-image.tsx
    - src/app/robots.test.ts
    - src/app/sitemap.test.ts
  modified:
    - src/app/layout.tsx
    - src/app/(main)/page.tsx
    - src/app/(main)/cerca/page.tsx
    - src/app/(main)/mappa/page.tsx
    - src/app/(main)/sagra/[slug]/page.tsx

key-decisions:
  - "metadataBase uses NEXT_PUBLIC_SITE_URL env var with nemovia.vercel.app fallback"
  - "title.template pattern '%s | Nemovia' for consistent branding suffix"
  - "OG image uses default sans-serif font (no custom font for MVP)"
  - "sitemap.ts revalidates hourly (revalidate = 3600)"

patterns-established:
  - "Static metadata: export const metadata: Metadata on server pages"
  - "Dynamic metadata: export async function generateMetadata for data-driven pages"
  - "OG image: ImageResponse with inline flex styles (Satori constraint)"

requirements-completed: [SEO-01, SEO-02, SEO-03, SEO-04]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 06 Plan 01: SEO Infrastructure Summary

**Dynamic metadata on every page, sitemap.xml from Supabase, robots.txt, and per-sagra OG image generation with branded gradient cards**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T14:43:57Z
- **Completed:** 2026-03-05T14:48:27Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Every page has unique title with "| Nemovia" suffix via template pattern
- robots.txt allows all crawlers and references sitemap.xml
- sitemap.xml dynamically queries Supabase for all active sagre with hourly revalidation
- Each sagra detail page generates a branded 1200x630 OG image with title, location, and dates
- All pages have Open Graph metadata for social media sharing

## Task Commits

Each task was committed atomically:

1. **Task 1: Root layout metadata + robots.ts + sitemap.ts + static page metadata** - `012f067` (feat)
2. **Task 2 RED: Robots and sitemap unit tests** - `db5961b` (test)
3. **Task 2 GREEN: Dynamic sagra metadata + OG image generation** - `2aae882` (feat)

## Files Created/Modified
- `src/app/layout.tsx` - Enhanced with metadataBase, title.template, OG defaults
- `src/app/robots.ts` - Generates robots.txt allowing all crawlers with sitemap URL
- `src/app/sitemap.ts` - Dynamic sitemap from Supabase with static entries + sagre
- `src/app/(main)/page.tsx` - Added static metadata export for home page
- `src/app/(main)/cerca/page.tsx` - Added static metadata export for search page
- `src/app/(main)/mappa/page.tsx` - Added static metadata export for map page
- `src/app/(main)/sagra/[slug]/page.tsx` - Added generateMetadata with dynamic title/description/OG
- `src/app/(main)/sagra/[slug]/opengraph-image.tsx` - Dynamic OG image with gradient card design
- `src/app/robots.test.ts` - Unit tests for robots.ts output
- `src/app/sitemap.test.ts` - Unit tests for sitemap.ts with mocked Supabase

## Decisions Made
- metadataBase uses NEXT_PUBLIC_SITE_URL env var with nemovia.vercel.app fallback for OG image URL resolution
- title.template uses "%s | Nemovia" pattern for consistent branding across all pages
- OG image uses default sans-serif font rather than loading a custom font (MVP simplicity)
- sitemap.ts uses revalidate = 3600 for hourly refresh to balance freshness and performance
- OG image gradient: amber-50 to green-50 (warm Italian food palette) with stone-colored text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SEO infrastructure complete, all pages are crawlable and shareable
- OG images will auto-generate for new sagre added to the database
- Ready for remaining 06-seo-polish plans (loading states, polish)

## Self-Check: PASSED

- All 5 created files verified on disk
- All 3 commits (012f067, db5961b, 2aae882) verified in git history
- Build succeeds with robots.txt, sitemap.xml, and opengraph-image routes
- All 47 tests pass (6 test files including 2 new)

---
*Phase: 06-seo-polish*
*Completed: 2026-03-05*
