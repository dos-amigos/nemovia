---
phase: 02-scraping-pipeline
plan: 01
subsystem: scraper-helpers
tags: [vitest, typescript, normalization, date-parsing, tdd]
dependency_graph:
  requires: []
  provides: [scraper-types, normalize-helpers, date-parser, vitest-config]
  affects: [02-02, 02-03]
tech_stack:
  added: [vitest@4, @vitest/ui, vite-tsconfig-paths]
  patterns: [tdd-red-green, pure-functions, immutable-helpers]
key_files:
  created:
    - vitest.config.ts
    - src/lib/scraper/types.ts
    - src/lib/scraper/normalize.ts
    - src/lib/scraper/date-parser.ts
    - src/lib/scraper/__tests__/normalize.test.ts
    - src/lib/scraper/__tests__/date-parser.test.ts
  modified:
    - package.json
    - vitest.config.ts
decisions:
  - "Used manual accent map (no external library) to mirror PostgreSQL unaccent behavior in JS"
  - "djb2-style double-pass hash for 12-char content hash without crypto dependency"
  - "TDD approach: write failing tests first, implement to green, no refactor needed"
  - "reporters: ['verbose'] array syntax (not reporter string) required for vitest v4 type compliance"
requirements-completed: [PIPE-01, PIPE-02, PIPE-04]
metrics:
  duration: 15min
  completed: 2026-03-04
---

# Phase 2 Plan 1: Vitest Setup and Scraper Helper Library Summary

**Vitest configured with TDD; normalizeText (accent map + djb2 hash), parseItalianDateRange (DD/MM/YYYY + word formats), and ScraperSource/NormalizedEvent types -- 18 tests all green.**

## What Was Built

Established the testable foundation of the scraping pipeline: pure helper functions that the Edge Function will copy inline (Deno cannot import from Next.js src/).

### Files Created

- **`vitest.config.ts`** -- node environment, src/**/*.test.ts include pattern, vite-tsconfig-paths plugin
- **`src/lib/scraper/types.ts`** -- ScraperSource, RawEvent, NormalizedEvent, ScrapeSummary interfaces
- **`src/lib/scraper/normalize.ts`** -- normalizeText, generateSlug, generateContentHash
- **`src/lib/scraper/date-parser.ts`** -- parseItalianDateRange supporting 4 Italian date formats
- **`src/lib/scraper/__tests__/normalize.test.ts`** -- 9 tests for normalize helpers
- **`src/lib/scraper/__tests__/date-parser.test.ts`** -- 9 tests for Italian date parsing

### package.json Changes

Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts. Installed vitest, @vitest/ui, vite-tsconfig-paths as dev dependencies.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install vitest and configure for Next.js + TypeScript** - `4c8241f` (feat)
2. **Task 2: Create scraper types and normalization helpers** - `4c8241f` (feat, TDD green)
3. **Task 3: Implement Italian date parser with tests** - `c72cbe1` (feat, TDD green)
4. **Fix: vitest config reporter -> reporters for v4** - `b57679c` (fix)

## Verification

```
Test Files: 2 passed (2)
Tests:      18 passed (18)
Duration:   389ms
```

All tests green. TypeScript check passes for all scraper lib files (`pnpm exec tsc --noEmit` clean on src/).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vitest config `reporter` to `reporters` array for vitest v4 type compliance**
- **Found during:** Final TypeScript verification
- **Issue:** Plan specified `reporter: "verbose"` (singular string) but vitest v4 InlineConfig type requires `reporters: string[]` (plural array). TypeScript error TS2769 raised.
- **Fix:** Changed `reporter: "verbose"` to `reporters: ["verbose"]` in vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm exec tsc --noEmit` passes with no vitest.config.ts errors; `pnpm test` still passes 18/18 tests
- **Committed in:** b57679c

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug in config field name)
**Impact on plan:** Trivial field name fix. No behavior change -- vitest outputs verbose results identically.

## Self-Check: PASSED

- vitest.config.ts: FOUND
- src/lib/scraper/types.ts: FOUND
- src/lib/scraper/normalize.ts: FOUND
- src/lib/scraper/date-parser.ts: FOUND
- src/lib/scraper/__tests__/normalize.test.ts: FOUND
- src/lib/scraper/__tests__/date-parser.test.ts: FOUND
- Commits: 4c8241f (normalize+types), c72cbe1 (date-parser), b57679c (fix): FOUND

## Next Phase Readiness
- Plan 02-02 (Database Migration): ready -- scraper types defined
- Plan 02-03 (Edge Function): ready -- will copy normalize.ts and date-parser.ts for Deno runtime
- Plan 02-04 (Admin Trigger): ready -- can reference types for UI integration
- No blockers
