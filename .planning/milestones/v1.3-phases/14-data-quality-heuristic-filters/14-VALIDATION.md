---
phase: 14
slug: data-quality-heuristic-filters
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run src/lib/scraper/__tests__/filters.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/scraper/__tests__/filters.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | DQ-01 | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isNoiseTitle"` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | DQ-02 | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isCalendarDateRange"` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | DQ-03 | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isExcessiveDuration"` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | DQ-04 | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isPastYearEvent"` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | DQ-05 | manual | Run SQL in Supabase SQL Editor, verify with SELECT count | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/scraper/filters.ts` — new module with all filter functions
- [ ] `src/lib/scraper/__tests__/filters.test.ts` — stubs for DQ-01 through DQ-04
- No framework install needed (Vitest already configured and working)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retroactive SQL cleanup deactivates dirty data | DQ-05 | SQL migration against production database, not unit-testable | Run `006_heuristic_filters.sql` in Supabase SQL Editor; verify with `SELECT count(*) FROM sagre WHERE is_active = true` before and after |
| pg_cron expire job catches all edge cases | DQ-04 | Cron job runs on Supabase infrastructure | Verify via Supabase Dashboard → pg_cron that `expire-sagre-daily` has updated SQL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
