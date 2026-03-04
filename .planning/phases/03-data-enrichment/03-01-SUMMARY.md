---
phase: 03-data-enrichment
plan: "01"
subsystem: testing
tags: [vitest, typescript, tdd, geocoding, nominatim, gemini, llm, enrichment]

# Dependency graph
requires:
  - phase: 02-scraping-pipeline
    provides: "Pure helper function pattern (normalize.ts / date-parser.ts) — enrichment follows identical structure"
provides:
  - "src/lib/enrichment/geocode.ts — cleanCityName, isValidItalyCoord, ITALY_BOUNDS (pure, no HTTP)"
  - "src/lib/enrichment/llm.ts — FOOD_TAGS, FEATURE_TAGS, BATCH_SIZE, validateTags, truncateDescription, chunkBatch, buildEnrichmentPrompt"
  - "src/lib/enrichment/__tests__/geocode.test.ts — 10 unit tests for PIPE-03 geocoding helpers"
  - "src/lib/enrichment/__tests__/llm.test.ts — 13 unit tests for PIPE-07/08/09 LLM helpers"
affects:
  - "03-02 (enrich-sagre Edge Function copies these verbatim — inline-only Deno pattern)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hybrid test scaffold: pure logic in src/lib/enrichment/ for Vitest, copied verbatim into Deno Edge Function (Deno cannot import from Next.js src/)"
    - "TDD RED-GREEN cycle: test file written first, confirmed failing, then implementation written"
    - "as const arrays for tag enums — enables TypeScript type narrowing via validateTags generic"

key-files:
  created:
    - src/lib/enrichment/geocode.ts
    - src/lib/enrichment/llm.ts
    - src/lib/enrichment/__tests__/geocode.test.ts
    - src/lib/enrichment/__tests__/llm.test.ts
  modified: []

key-decisions:
  - "Pure function library in src/lib/enrichment/ to enable Vitest testing; verbatim copy pattern into Edge Function for Deno compatibility"
  - "ITALY_BOUNDS bounding box (lat 36-47.5, lon 6-19) used to validate Nominatim geocode results and reject out-of-Italy matches"
  - "BATCH_SIZE=8 sagre per Gemini call — within 250 RPD free tier limit"
  - "MAX_DESC_CHARS=250 character limit enforced client-side in truncateDescription regardless of LLM output"
  - "FOOD_TAGS (8) and FEATURE_TAGS (5) as const arrays — Gemini may output valid JSON but invalid enum values; validateTags filters post-parse"

patterns-established:
  - "Enrichment helper: same pure-function-no-imports pattern as Phase 2 normalize.ts/date-parser.ts"
  - "TDD in this codebase: pnpm test -- --reporter=verbose <file> confirms RED, then GREEN after implementation"
  - "Tag validation: validateTags<T>(tags, allowedTags) generic — reusable for both food and feature tag arrays"

requirements-completed: [PIPE-03, PIPE-07, PIPE-08, PIPE-09]

# Metrics
duration: 2min
completed: "2026-03-04"
---

# Phase 3 Plan 01: Enrichment Helper Library Summary

**Pure geocoding and LLM helper functions (23 unit tests, 41 total suite passing) establishing the Wave 0 test scaffold for Nominatim + Gemini enrichment pipeline**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T22:20:18Z
- **Completed:** 2026-03-04T22:22:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Implemented `cleanCityName` (strips province codes like "(VR)", "- TV") and `isValidItalyCoord` (Italy bounding box validator) with 10 passing unit tests
- Implemented `validateTags`, `truncateDescription`, `chunkBatch`, `buildEnrichmentPrompt` plus FOOD_TAGS/FEATURE_TAGS/BATCH_SIZE constants with 13 passing unit tests
- Established hybrid test scaffold: pure logic lives in `src/lib/enrichment/` for Vitest; will be copied verbatim into the Deno Edge Function where Next.js imports are impossible
- Full test suite: 41/41 tests passing (includes Phase 2 scraper tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: geocode.ts — pure geocoding helper functions with tests** - `4ab23dd` (feat)
2. **Task 2: llm.ts — pure LLM helper functions with tests** - `4f4c5a0` (feat)

_Note: TDD tasks confirmed RED before GREEN for both tasks_

## Files Created/Modified

- `src/lib/enrichment/geocode.ts` - Pure geocoding helpers: `cleanCityName`, `isValidItalyCoord`, `ITALY_BOUNDS` constant
- `src/lib/enrichment/llm.ts` - Pure LLM helpers: `FOOD_TAGS`, `FEATURE_TAGS`, `BATCH_SIZE`, `validateTags`, `truncateDescription`, `chunkBatch`, `buildEnrichmentPrompt`
- `src/lib/enrichment/__tests__/geocode.test.ts` - 10 unit tests covering cleanCityName (5 cases) and isValidItalyCoord (5 cases)
- `src/lib/enrichment/__tests__/llm.test.ts` - 13 unit tests covering validateTags, truncateDescription, chunkBatch, buildEnrichmentPrompt, and constants

## Decisions Made

- **Verbatim copy pattern:** Pure logic in `src/lib/enrichment/` for Vitest testability; Plan 03-02 will copy these functions inline into the Deno Edge Function (same approach Phase 2 used for scraper helpers)
- **Italy bounding box:** lat 36-47.5, lon 6-19 — catches Nominatim ambiguous results that land outside Italy
- **BATCH_SIZE=8:** Stays within Gemini 250 RPD free tier; 8 sagre per prompt call is well within limits
- **validateTags generic:** `validateTags<T>(tags, allowedTags)` works for both food and feature tag arrays without duplication

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 enrichment helper files committed and tested
- Plan 03-02 (enrich-sagre Edge Function) can proceed immediately — copies `geocode.ts` and `llm.ts` verbatim
- No blockers identified

---
*Phase: 03-data-enrichment*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: src/lib/enrichment/geocode.ts
- FOUND: src/lib/enrichment/llm.ts
- FOUND: src/lib/enrichment/__tests__/geocode.test.ts
- FOUND: src/lib/enrichment/__tests__/llm.test.ts
- FOUND: .planning/phases/03-data-enrichment/03-01-SUMMARY.md
- FOUND commit: 4ab23dd (geocode task)
- FOUND commit: 4f4c5a0 (llm task)
