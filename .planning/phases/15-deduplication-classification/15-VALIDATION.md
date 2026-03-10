---
phase: 15
slug: deduplication-classification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | DQ-09 | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "tryUpgradeImageUrl"` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | DQ-10 | manual-only | Visual inspection in dev server | N/A | ⬜ pending |
| 15-02-01 | 02 | 1 | DQ-07, DQ-08 | unit | `npx vitest run src/lib/enrichment/__tests__/llm.test.ts -t "is_sagra"` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | DQ-06 | unit | SQL dry-run verification | ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 1 | DQ-06 | manual-only | SQL Editor dry-run query against production | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/scraper/__tests__/image-upgrade.test.ts` or add to filters.test.ts — stubs for DQ-09 (tryUpgradeImageUrl patterns)
- [ ] Update `src/lib/enrichment/__tests__/llm.test.ts` — covers DQ-07, DQ-08 (is_sagra in prompt + schema)
- [ ] SQL dry-run verification queries for DQ-06 (manual, not automated)

*Existing vitest infrastructure covers test framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Placeholder renders for missing/small images | DQ-10 | UI component visual verification | Open dev server, check cards without images show branded placeholder |
| pg_trgm RPC returns fuzzy matches | DQ-06 | Database-level SQL verification | Run similarity query in Supabase SQL Editor against production data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
