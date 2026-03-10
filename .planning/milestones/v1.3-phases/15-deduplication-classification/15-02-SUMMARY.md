---
phase: 15-deduplication-classification
plan: 02
subsystem: database, enrichment
tags: [pg_trgm, fuzzy-matching, gemini, llm-classification, deduplication, supabase-rpc]

# Dependency graph
requires:
  - phase: 14-data-quality-heuristic-filters
    provides: "Heuristic filters in scrape pipeline (noise, calendar, duration, past-year)"
  - phase: 15-deduplication-classification
    provides: "Plan 01 image upgrade and branded placeholder"
provides:
  - "is_sagra boolean classification in Gemini enrichment (zero additional API calls)"
  - "Non-sagra auto-deactivation with status classified_non_sagra"
  - "pg_trgm fuzzy dedup RPC (find_duplicate_sagra with similarity thresholds)"
  - "GIN trigram index on normalized_title for fast fuzzy lookups"
  - "Retroactive dedup SQL for existing production data"
affects: [16-design-system-foundation, 17-visual-effects-layout-performance]

# Tech tracking
tech-stack:
  added: [pg_trgm]
  patterns: [fuzzy-dedup-rpc, llm-classification-in-existing-pipeline, classified_non_sagra-status]

key-files:
  created:
    - supabase/migrations/007_dedup_classification.sql
  modified:
    - src/lib/enrichment/llm.ts
    - src/lib/enrichment/__tests__/llm.test.ts
    - supabase/functions/enrich-sagre/index.ts

key-decisions:
  - "pg_trgm similarity thresholds: 0.6 for title (moderately strict), 0.5 for city (catches accent differences)"
  - "Retroactive dedup requires BOTH title similarity AND date overlap (never dedup on title alone)"
  - "Non-sagra events deactivated with status classified_non_sagra (never deleted)"
  - "is_sagra rides existing Gemini batch call via responseSchema -- zero additional API calls"

patterns-established:
  - "LLM classification piggybacks on existing enrichment: add field to prompt + responseSchema, branch in result loop"
  - "Fuzzy dedup via pg_trgm with GIN index + plpgsql RPC returning similarity-ordered results"
  - "Retroactive data cleanup as commented SQL sections for manual execution in Supabase SQL Editor"

requirements-completed: [DQ-06, DQ-07, DQ-08]

# Metrics
duration: ~35min (including checkpoint verification)
completed: 2026-03-10
---

# Phase 15 Plan 02: Deduplication & Classification Summary

**LLM-based is_sagra classification in Gemini enrichment pipeline with pg_trgm fuzzy dedup RPC and retroactive duplicate cleanup**

## Performance

- **Duration:** ~35 min (including checkpoint for manual SQL migration + Edge Function deploy)
- **Started:** 2026-03-10T08:47:56Z
- **Completed:** 2026-03-10T09:24:45Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Enrichment prompt now classifies every event as sagra or non-sagra via is_sagra boolean, with zero additional Gemini API calls
- Non-sagra events (antiquariato, mostre, mercati) are automatically deactivated with status "classified_non_sagra"
- find_duplicate_sagra RPC upgraded from exact-match to pg_trgm fuzzy matching (0.6 title, 0.5 city thresholds) with GIN trigram index
- Retroactive dedup SQL deactivates newer duplicates while preserving older records, requiring both title similarity AND date overlap

## Task Commits

Each task was committed atomically:

1. **Task 1: Add is_sagra classification to enrichment prompt and Edge Function**
   - `5af1731` (test) -- RED: failing tests for is_sagra in prompt and EnrichmentResult type
   - `2fea5e1` (feat) -- GREEN: is_sagra in buildEnrichmentPrompt + enrich-sagre Edge Function with deactivation logic
2. **Task 2: Create SQL migration for pg_trgm fuzzy dedup** - `6dbee71` (feat) -- 5-section migration file
3. **Task 3: Deploy and verify SQL migration + enrichment Edge Function** - checkpoint:human-verify (user-executed)

## Files Created/Modified
- `src/lib/enrichment/llm.ts` - Added is_sagra classification instruction to buildEnrichmentPrompt, exported EnrichmentResult interface with is_sagra boolean
- `src/lib/enrichment/__tests__/llm.test.ts` - Added is_sagra classification test suite (5 tests) verifying prompt content and type correctness
- `supabase/functions/enrich-sagre/index.ts` - Added is_sagra to responseSchema, deactivation logic for non-sagre (classified_non_sagra status)
- `supabase/migrations/007_dedup_classification.sql` - pg_trgm extension, GIN index, fuzzy RPC, retroactive dedup, verification queries

## Decisions Made
- pg_trgm similarity thresholds set at 0.6 for title (moderately strict to avoid false positives) and 0.5 for city (lower to catch accent/spelling differences in Italian city names)
- Retroactive dedup requires BOTH title similarity AND date overlap -- never dedup on title alone to avoid deactivating recurring annual sagre
- Non-sagra events deactivated (is_active = false) with distinct status "classified_non_sagra" for auditability, never deleted
- is_sagra added as item 1 in the enrichment prompt numbered list, existing items shifted to 2-4, with "Per ogni evento" instead of "Per ogni sagra"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully. The checkpoint for manual SQL migration and Edge Function deployment was approved by the user without issues.

## User Setup Required

None - SQL migration and Edge Function deployment were completed during checkpoint verification.

## Next Phase Readiness
- Phase 15 is fully complete (both plans done): image upgrades, branded placeholders, is_sagra classification, and fuzzy dedup all shipped
- Clean data foundation established for Phase 16 (Design System Foundation) -- modern design will shine with quality data
- No blockers or concerns

## Self-Check: PASSED

- All 5 key files verified present on disk
- All 3 task commits verified in git history (5af1731, 2fea5e1, 6dbee71)
- Full test suite: 138/138 tests passing

---
*Phase: 15-deduplication-classification*
*Completed: 2026-03-10*
