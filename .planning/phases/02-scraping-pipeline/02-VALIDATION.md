---
phase: 2
slug: scraping-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already in Next.js 15 project) |
| **Config file** | vitest.config.ts — Wave 0 creates if missing |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | PIPE-02 | unit | `npx vitest run scraper-sources` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | PIPE-01 | unit | `npx vitest run normalize` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | PIPE-02 | unit | `npx vitest run scraper` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | PIPE-04 | unit | `npx vitest run dedup` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | PIPE-05 | unit | `npx vitest run expire` | ❌ W0 | ⬜ pending |
| 2-01-06 | 01 | 2 | PIPE-06 | manual | — | N/A | ⬜ pending |
| 2-02-01 | 02 | 1 | PIPE-01 | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/scraper/__tests__/normalize.test.ts` — stubs for name normalization (PIPE-04)
- [ ] `src/lib/scraper/__tests__/scraper.test.ts` — stubs for Cheerio extraction (PIPE-01, PIPE-02)
- [ ] `src/lib/scraper/__tests__/dedup.test.ts` — stubs for deduplication logic (PIPE-04)
- [ ] `src/lib/scraper/__tests__/expire.test.ts` — stubs for event expiration (PIPE-05)
- [ ] `vitest.config.ts` — configure if missing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_cron fires Edge Function 2x/day | PIPE-06 | Requires live Supabase + pg_net infrastructure | Check pg_cron dashboard in Supabase; verify next scheduled run appears in cron.job_run_details |
| Scraper populates DB from all 5 sources | PIPE-01 | Requires live target sites + Edge Function deployed | Trigger function manually via Supabase dashboard; query `SELECT source_name, count(*) FROM sagre GROUP BY source_name` |
| Adding new source requires only DB entry | PIPE-02 | Integration behavior across DB + Edge Function | Insert new row in scraper_sources; trigger scraper; verify new source's events appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
