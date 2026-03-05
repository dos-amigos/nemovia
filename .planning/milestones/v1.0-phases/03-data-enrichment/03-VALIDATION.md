---
phase: 3
slug: data-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual Edge Function smoke test
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | PIPE-03 | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/geocode.test.ts` | ❌ Wave 0 | ⬜ pending |
| 3-01-02 | 01 | 0 | PIPE-07, PIPE-08, PIPE-09 | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/llm.test.ts` | ❌ Wave 0 | ⬜ pending |
| 3-02-01 | 02 | 1 | PIPE-03 | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/geocode.test.ts` | ✅ Wave 0 | ⬜ pending |
| 3-02-02 | 02 | 1 | PIPE-07, PIPE-08, PIPE-09 | unit | `pnpm test -- --reporter=verbose src/lib/enrichment/__tests__/llm.test.ts` | ✅ Wave 0 | ⬜ pending |
| 3-03-01 | 03 | 1 | PIPE-03, PIPE-07, PIPE-08, PIPE-09 | manual | Invoke `enrich-sagre` from Supabase Dashboard | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/enrichment/__tests__/geocode.test.ts` — stubs for PIPE-03 (cleanCityName, isValidItalyCoord)
- [ ] `src/lib/enrichment/__tests__/llm.test.ts` — stubs for PIPE-07, PIPE-08, PIPE-09 (tag filtering, batch chunking, description truncation)
- [ ] `src/lib/enrichment/geocode.ts` — exportable pure functions (cleanCityName, isValidItalyCoord)
- [ ] `src/lib/enrichment/llm.ts` — exportable pure functions (validateTags, chunkBatch, truncateDescription)

*Note: Phase 3 adopts hybrid pattern — thin Edge Function orchestrator, pure business logic extracted to `src/lib/enrichment/` for Vitest coverage.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Nominatim HTTP geocoding returns valid lat/lon for Italian cities | PIPE-03 | Live API with 1 req/sec rate limit | Invoke `enrich-sagre` from Dashboard; check `location` column in sagre table |
| Gemini API returns structured food_tags and feature_tags | PIPE-07 | Live LLM API (250 RPD limit) | Check `food_tags` and `feature_tags` columns after Edge Function run |
| `enhanced_description` is populated and ≤ 250 chars | PIPE-08 | LLM output | `SELECT max(length(enhanced_description)) FROM sagre WHERE status = 'enriched';` — must be ≤ 250 |
| Batching stays within 250 RPD | PIPE-09 | Requires counting live API calls | Check `enrich_logs` table for calls_made count after full queue drain |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
