---
phase: 01-foundation-design-system
plan: 01
subsystem: infra
tags: [nextjs, tailwind-v4, shadcn-ui, supabase, postgis, oklch, typescript]

# Dependency graph
requires:
  - phase: none
    provides: "First plan -- no dependencies"
provides:
  - "Next.js 15 project with TypeScript, Tailwind v4, ESLint, App Router"
  - "shadcn/ui brand design system with amber-600/green-700/stone-50 OKLCH palette"
  - "Supabase server and browser client factories via @supabase/ssr"
  - "TypeScript types for sagre table (Sagra, SagraInsert, SagraUpdate)"
  - "Foundation SQL migration with PostGIS geography column, indexes, and RLS"
  - "shadcn/ui base components: button, card, badge, skeleton, separator"
affects: [01-02-PLAN, 02-scraping-pipeline, 03-data-enrichment, 04-discovery-ui]

# Tech tracking
tech-stack:
  added: [next@15.5.12, react@19.1.0, typescript@5.9.3, tailwindcss@4.2.1, "@supabase/supabase-js@2.98.0", "@supabase/ssr@0.9.0", lucide-react@0.577.0, tw-animate-css, shadcn-ui]
  patterns: [css-first-tailwind-v4, oklch-color-system, supabase-ssr-client-factory, app-router-metadata-viewport]

key-files:
  created:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/lib/utils.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/types/database.ts
    - supabase/migrations/001_foundation.sql
    - .env.example
    - components.json
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/separator.tsx
  modified: []

key-decisions:
  - "Used Tailwind v4 CSS-first @theme inline instead of tailwind.config.ts"
  - "OKLCH color values from Tailwind v4 palette for perceptually uniform brand colors"
  - "Separate Supabase client factories for server (async cookies) and browser contexts"
  - "SQL migration file for manual execution in Supabase SQL Editor rather than Supabase CLI"
  - "Scaffolded into temp directory and copied due to create-next-app file conflict detection"

patterns-established:
  - "Brand theme via CSS custom properties in globals.css with @theme inline mapping"
  - "Supabase server client: async createClient() using @supabase/ssr createServerClient"
  - "Supabase browser client: createClient() using @supabase/ssr createBrowserClient"
  - "PostGIS types use extensions schema prefix: extensions.geography(POINT, 4326)"

requirements-completed: [UI-03]

# Metrics
duration: 42min
completed: 2026-03-04
---

# Phase 1 Plan 01: Project Scaffold Summary

**Next.js 15 with Tailwind v4 OKLCH brand theme, Supabase client factories, and PostGIS sagre table migration**

## Performance

- **Duration:** 42 min
- **Started:** 2026-03-04T14:44:15Z
- **Completed:** 2026-03-04T15:26:06Z
- **Tasks:** 3 (2 auto + 1 checkpoint approved)
- **Files created:** 29

## Accomplishments
- Scaffolded Next.js 15 project with TypeScript, Tailwind v4, ESLint, and App Router (src directory structure)
- Configured Nemovia brand design system using OKLCH color values: amber-600 primary, green-700 accent, stone-50 background
- Created Supabase server and browser client factories using @supabase/ssr with proper cookie handling
- Defined TypeScript types (Sagra, SagraInsert, SagraUpdate) matching the PostGIS-enabled database schema
- Created foundation SQL migration with sagre table, PostGIS geography column, 6 indexes, and RLS policy
- Installed and configured 5 shadcn/ui base components: button, card, badge, skeleton, separator
- User verified brand theme visually, created Supabase project, ran migration, configured environment variables

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project with shadcn/ui and brand theme** - `16a237c` (feat)
2. **Task 2: Create Supabase client utilities and database migration** - `9660845` (feat)
3. **Task 3: Verify project scaffold, brand theme, and Supabase setup** - checkpoint approved by user

## Files Created/Modified
- `package.json` - Next.js 15 project with Supabase, shadcn/ui, lucide-react dependencies
- `src/app/globals.css` - Nemovia brand theme with OKLCH color variables and @theme inline
- `src/app/layout.tsx` - Root layout with Inter font, lang="it", mobile viewport meta
- `src/lib/utils.ts` - shadcn/ui cn() utility
- `src/lib/supabase/server.ts` - Server-side Supabase client factory (async, cookie-based)
- `src/lib/supabase/client.ts` - Browser-side Supabase client factory
- `src/types/database.ts` - TypeScript types for sagre table
- `supabase/migrations/001_foundation.sql` - Foundation schema with PostGIS, indexes, RLS
- `src/components/ui/button.tsx` - shadcn/ui Button component
- `src/components/ui/card.tsx` - shadcn/ui Card component
- `src/components/ui/badge.tsx` - shadcn/ui Badge component
- `src/components/ui/skeleton.tsx` - shadcn/ui Skeleton component
- `src/components/ui/separator.tsx` - shadcn/ui Separator component
- `components.json` - shadcn/ui configuration
- `.env.example` - Supabase environment variable placeholders
- `.gitignore` - Standard Next.js gitignore with .env.example exception
- `tsconfig.json` - TypeScript configuration with @/ path alias
- `next.config.ts` - Next.js 15 configuration
- `eslint.config.mjs` - ESLint configuration
- `postcss.config.mjs` - PostCSS with Tailwind v4

## Decisions Made
- Used Tailwind v4 CSS-first configuration (`@theme inline` in globals.css) instead of deprecated tailwind.config.ts
- Chose OKLCH color format (Tailwind v4 + shadcn/ui 2025 default) for perceptually uniform brand colors
- Created separate Supabase client factories for server and browser contexts per @supabase/ssr best practices
- SQL migration stored as version-controlled file but executed manually in Supabase SQL Editor (no CLI dependency)
- Scaffolded into temp directory due to create-next-app refusing to scaffold into directory with existing files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffolded via temp directory to work around create-next-app file detection**
- **Found during:** Task 1 (project scaffolding)
- **Issue:** `pnpm create next-app@15 .` refused to scaffold into the existing directory containing .planning/ and markdown files
- **Fix:** Scaffolded into a temp directory (nemovia-temp), then copied all files to the repo root
- **Files modified:** All scaffolded files (same as plan)
- **Verification:** `pnpm build` succeeds, all files in correct locations
- **Committed in:** 16a237c (Task 1 commit)

**2. [Rule 3 - Blocking] Added .gitignore with .env.example exception**
- **Found during:** Task 1 (environment file setup)
- **Issue:** .gitignore was not copied from temp directory initially; when copied, `.env*` pattern excluded .env.example from version control
- **Fix:** Copied .gitignore and added `!.env.example` exception line
- **Files modified:** .gitignore
- **Verification:** `git status` correctly shows .env.example as trackable
- **Committed in:** 16a237c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to complete scaffolding. No scope creep.

## Issues Encountered
- `pnpm` was not in PATH -- installed globally via `npm install -g pnpm` (located at AppData/Roaming/npm)
- `create-next-app` interactive prompts required `--turbopack` and `--import-alias "@/*"` flags to run non-interactively
- Dev server port 3000 already in use during checkpoint verification; server auto-selected port 3001

## User Setup Required

User completed the following during checkpoint verification:
- Created Supabase project (free tier)
- Enabled PostGIS, pg_cron, and pg_net extensions
- Ran SQL migration in Supabase SQL Editor
- Configured .env.local with Supabase URL and API keys

## Next Phase Readiness
- Project builds and runs locally with `pnpm dev`
- Brand design system is active and visible
- Supabase database is configured with sagre table, PostGIS, and RLS
- Ready for Plan 02: mobile BottomNav layout shell with placeholder pages and Vercel deploy
- All shadcn/ui base components available for layout construction

## Self-Check: PASSED

All 14 claimed files verified present. Both task commits (16a237c, 9660845) verified in git history.

---
*Phase: 01-foundation-design-system*
*Completed: 2026-03-04*
