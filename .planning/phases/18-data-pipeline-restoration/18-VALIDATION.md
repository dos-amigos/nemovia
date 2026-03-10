---
phase: 18
slug: data-pipeline-restoration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run src/lib/scraper/__tests__/filters.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/scraper/__tests__/filters.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | DATA-01 | manual + SQL | SQL: `SELECT count(*) FROM sagre WHERE is_active = true` | N/A (database) | ⬜ pending |
| 18-01-02 | 01 | 1 | DATA-03 | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts` | ❌ W0 (needs isNonSagraTitle tests) | ⬜ pending |
| 18-02-01 | 02 | 1 | DATA-02 | unit + SQL | `npx vitest run src/lib/enrichment/__tests__/geocode.test.ts` | ✅ (needs viewbox tests) | ⬜ pending |
| 18-02-02 | 02 | 1 | DATA-04 | unit + SQL | Test normalizeProvinceCode() | ❌ W0 (new test needed) | ⬜ pending |
| 18-03-01 | 03 | 2 | SCRAPE-02 | manual + SQL | SQL: `SELECT * FROM scrape_logs WHERE source_name = 'itinerarinelgusto'` | N/A (database) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/scraper/__tests__/filters.test.ts` — add `isNonSagraTitle()` test cases
- [ ] `src/lib/enrichment/__tests__/geocode.test.ts` — add `normalizeProvinceCode()` test cases
- [ ] No new framework install needed — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 100+ active sagre visible | DATA-01 | Requires populated database + running scraper | Run SQL count query, verify homepage shows results |
| No non-Veneto events | DATA-02 | Requires geocoding against live Nominatim API | Search for known non-Veneto cities, verify no results |
| New scraper source active | SCRAPE-02 | Requires deployed Edge Function + pg_cron | Check scrape_logs for itinerarinelgusto entries |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
