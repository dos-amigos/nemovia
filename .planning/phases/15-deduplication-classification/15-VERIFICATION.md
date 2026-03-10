---
phase: 15-deduplication-classification
verified: 2026-03-10T09:30:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Browse the app and verify no duplicate sagre appear"
    expected: "Events with near-identical titles in the same location should appear only once"
    why_human: "Fuzzy dedup logic deployed but requires production data observation to confirm effectiveness"
  - test: "Browse the app and verify no non-sagra events appear (antique markets, exhibitions, generic markets)"
    expected: "Only food festivals should be visible; events classified as non-sagra should be filtered out"
    why_human: "LLM classification deployed but requires production data observation to confirm accuracy"
  - test: "Check sagra cards with images from sagritaly and solosagre sources"
    expected: "Images should load at higher resolution (not tiny thumbnails)"
    why_human: "Image upgrade happens at scrape time; requires new scrape run to observe upgraded URLs"
  - test: "Find a sagra card with no image_url in the database"
    expected: "Card should show a branded placeholder with utensils icon and 'Sagra' label on a subtle primary/accent gradient"
    why_human: "Visual appearance of placeholder needs human aesthetic judgment"
---

# Phase 15: Deduplication & Classification Verification Report

**Phase Goal:** Users see each sagra only once and never see non-sagra events (antique markets, exhibitions, generic markets) mixed in with real food festivals

**Verified:** 2026-03-10T09:30:00Z

**Status:** human_needed

**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sagritaly images load at full resolution instead of 150x150 thumbnails | VERIFIED | tryUpgradeImageUrl strips WordPress -WxH suffix, integrated in scrape pipeline at line 506 |
| 2 | Solosagre images load without size-constraining query params | VERIFIED | tryUpgradeImageUrl removes w/h/resize params via URL.searchParams.delete(), 8 passing tests |
| 3 | Cards without images show a branded placeholder with utensils icon and 'Sagra' label | VERIFIED | SagraCard.tsx lines 40-45: from-primary/10 via-accent/5 gradient + UtensilsCrossed icon + "Sagra" label |
| 4 | Detail page without image shows the same branded placeholder | VERIFIED | SagraDetail.tsx lines 53-58: same pattern with h-10/w-10 icon and text-sm label |
| 5 | Enrichment pipeline classifies each event as sagra or non-sagra via is_sagra boolean | VERIFIED | EnrichmentResult interface line 81, prompt line 94, responseSchema line 315, 5 passing tests |
| 6 | Non-sagra events are deactivated after enrichment | VERIFIED | enrich-sagre index.ts lines 331-339: if is_sagra === false, update is_active=false with status classified_non_sagra |
| 7 | No additional Gemini API calls for classification | VERIFIED | is_sagra added to existing responseSchema (line 315), no new API call code path |
| 8 | Near-duplicate events caught by fuzzy matching | VERIFIED | find_duplicate_sagra RPC uses extensions.similarity() with 0.6 title / 0.5 city thresholds, GIN index created |
| 9 | The find_duplicate_sagra RPC uses pg_trgm similarity instead of exact-only title matching | VERIFIED | 007_dedup_classification.sql lines 52, 56, 64: extensions.similarity() in WHERE and ORDER BY |

**Score:** 9/9 truths verified (all automated checks passed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/lib/scraper/filters.ts | tryUpgradeImageUrl pure function | VERIFIED | Lines 54-89, exports tryUpgradeImageUrl with source-specific image URL upgrade logic |
| src/lib/scraper/__tests__/filters.test.ts | Unit tests for tryUpgradeImageUrl | VERIFIED | Lines 316-374, 8 tests covering sagritaly WordPress suffix, solosagre params, unknown sources, null/empty handling |
| src/components/sagra/SagraCard.tsx | Branded placeholder replacing amber/green gradient | VERIFIED | Lines 40-45, from-primary/10 via-accent/5 gradient with UtensilsCrossed icon and "Sagra" label |
| src/components/detail/SagraDetail.tsx | Branded placeholder replacing amber/green gradient | VERIFIED | Lines 53-58, same pattern with larger icon (h-10 w-10) and text-sm label |
| src/lib/enrichment/llm.ts | Updated buildEnrichmentPrompt with is_sagra classification | VERIFIED | Lines 92-103, is_sagra instruction as item 1 in prompt, EnrichmentResult interface line 79-85 includes is_sagra boolean |
| src/lib/enrichment/__tests__/llm.test.ts | Tests verifying is_sagra in prompt and response type | VERIFIED | Lines 78-127, 5 tests for is_sagra classification including prompt content and type validation |
| supabase/functions/enrich-sagre/index.ts | Updated enrichment Edge Function with is_sagra handling | VERIFIED | Line 156 EnrichmentResult interface, line 315 responseSchema, lines 330-354 deactivation logic for non-sagre |
| supabase/migrations/007_dedup_classification.sql | pg_trgm extension, GIN index, upgraded RPC, retroactive dedup | VERIFIED | 113 lines, 5 sections: pg_trgm extension, GIN index, fuzzy RPC, retroactive dedup, verification queries |

**Total:** 8/8 artifacts verified (100% exists, substantive, wired)

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| supabase/functions/scrape-sagre/index.ts | tryUpgradeImageUrl | inline copy called in normalizeRawEvent | WIRED | Line 263 function definition, line 506 imageUrl: tryUpgradeImageUrl(raw.image, sourceName) |
| src/components/sagra/SagraCard.tsx | placeholder | conditional render when image_url is null | WIRED | Lines 39-46: image_url check, else block renders branded placeholder with from-primary gradient |
| supabase/functions/enrich-sagre/index.ts | Gemini structured output | is_sagra boolean in responseSchema | WIRED | Line 315 is_sagra: { type: "BOOLEAN" }, line 320 required: ["id", "is_sagra", ...] |
| supabase/functions/enrich-sagre/index.ts | supabase.from('sagre').update | deactivate when is_sagra === false | WIRED | Lines 331-339: if (result.is_sagra === false) updates is_active=false, status=classified_non_sagra |
| supabase/migrations/007_dedup_classification.sql | find_duplicate_sagra RPC | extensions.similarity() fuzzy matching | WIRED | Lines 52, 56, 64: extensions.similarity() with thresholds 0.6 title, 0.5 city, ORDER BY similarity DESC |

**Total:** 5/5 key links verified (100% wired)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DQ-06 | 15-02 | Pipeline detects and disables duplicates via fuzzy matching (pg_trgm similarity) on title and location | SATISFIED | 007_dedup_classification.sql implements pg_trgm extension, GIN index, and upgraded find_duplicate_sagra RPC with similarity thresholds. Retroactive dedup deactivates newer duplicates. |
| DQ-07 | 15-02 | Pipeline classifies every event as sagra/non-sagra via LLM (Gemini is_sagra) and disables non-sagre | SATISFIED | buildEnrichmentPrompt includes is_sagra classification instruction (line 94), enrich-sagre Edge Function deactivates events with is_sagra === false (lines 331-339). |
| DQ-08 | 15-02 | LLM classification generates no additional API calls (field added to enrichment prompt) | SATISFIED | is_sagra added to existing Gemini responseSchema (line 315), no new API call code path. Uses same batch enrichment call. |
| DQ-09 | 15-01 | Pipeline attempts image URL upgrade to higher resolution via source-specific patterns | SATISFIED | tryUpgradeImageUrl function strips WordPress -WxH suffix (sagritaly) and w/h/resize params (solosagre), integrated into scrape pipeline at normalizeRawEvent. |
| DQ-10 | 15-01 | Card shows pleasant branded placeholder when image not available or too small | SATISFIED | SagraCard and SagraDetail use branded placeholder with primary/accent gradient, UtensilsCrossed icon, and "Sagra" label instead of old amber/green gradient. |

**Coverage:** 5/5 requirements satisfied (100%)

**Orphaned Requirements:** None - all 5 requirements (DQ-06 through DQ-10) from REQUIREMENTS.md Phase 15 mapping are covered by plans 15-01 and 15-02.

### Anti-Patterns Found

None - scanned all modified files for TODO/FIXME/PLACEHOLDER comments, empty implementations, and stub patterns. All files are production-ready.

### Human Verification Required

#### 1. Fuzzy Deduplication Effectiveness

**Test:** Browse the production app (after next scrape run) and look for events with similar titles in the same location (e.g., "Sagra del Pesce" and "Sagra del Pesce Fresco" in Chioggia on the same dates).

**Expected:** Only one event should appear. The find_duplicate_sagra RPC should catch near-duplicates with similarity > 0.6 for titles and > 0.5 for city names.

**Why human:** The fuzzy matching logic is deployed (007_dedup_classification.sql executed), but confirmation requires observing real production data over multiple scrape cycles to verify that the similarity thresholds (0.6 title, 0.5 city) effectively catch duplicates without false positives.

#### 2. Non-Sagra Classification Accuracy

**Test:** Browse the production app (after next enrichment run) and verify that non-sagra events (antique markets, art exhibitions, generic markets, concerts without food) do not appear in search results or on the map.

**Expected:** All visible events should be food festivals. Events classified as non-sagra (is_sagra === false) should have is_active = false and status = "classified_non_sagra" in the database.

**Why human:** The LLM classification logic is deployed (enrich-sagre Edge Function updated), but confirmation requires observing real production data to verify that the Gemini model accurately distinguishes sagre from non-sagra events based on the prompt instruction (line 94 in llm.ts).

#### 3. Image Resolution Upgrade Effectiveness

**Test:** After the next scrape run, inspect sagra cards for events from sagritaly.com and solosagre.it sources. Check the browser's network tab or inspect the image_url field in the database.

**Expected:** Image URLs from sagritaly should NOT contain -150x150 or similar WordPress thumbnail suffixes. Image URLs from solosagre should NOT contain w=, h=, or resize= query parameters. Images should appear larger and clearer than before.

**Why human:** The tryUpgradeImageUrl function is integrated into the scrape pipeline (line 506 in scrape-sagre/index.ts), but the upgrade only applies to newly scraped events. Verification requires waiting for the next scrape run (cron: twice daily) and visually comparing image quality before and after.

#### 4. Branded Placeholder Visual Quality

**Test:** Find a sagra in the app that has no image_url in the database (or temporarily set image_url to null for a test record). View the card on both mobile and desktop viewports.

**Expected:** The placeholder should show a subtle gradient (from-primary/10 via-accent/5 to-primary/10), a gray utensils icon (text-muted-foreground/40), and the word "Sagra" in small uppercase text. It should look intentional and branded, not broken or like a missing image error.

**Why human:** While the code is verified (SagraCard.tsx lines 40-45, SagraDetail.tsx lines 53-58), the aesthetic quality and "pleasant" appearance is subjective and requires human visual judgment. The placeholder should feel cohesive with the overall design and not look like an error state.

---

## Verification Summary

**All automated checks PASSED:**

- 9/9 observable truths verified through code inspection and tests
- 8/8 required artifacts exist, are substantive, and are wired into the system
- 5/5 key links verified (wiring connects components correctly)
- 5/5 requirements satisfied with concrete evidence
- 138/138 tests passing (per vitest run output)
- 0 anti-patterns detected (no TODO/FIXME, no stubs, no orphaned code)
- All 7 commits from both SUMMARYs verified in git history

**Human verification required for 4 items:**

1. **Fuzzy deduplication effectiveness** - requires production data observation over multiple scrape cycles
2. **Non-sagra classification accuracy** - requires production data observation after enrichment runs
3. **Image resolution upgrade effectiveness** - requires waiting for next scrape run (2x daily cron) and visual comparison
4. **Branded placeholder visual quality** - requires human aesthetic judgment

**Recommendation:** Phase 15 goal is technically achieved - all code is in place, tested, and wired correctly. The human verification items are observational checks that confirm the implementation works as intended with real production data and passes the aesthetic quality bar. These can be verified over the next 24-48 hours as the scraper and enrichment cron jobs run.

---

_Verified: 2026-03-10T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
