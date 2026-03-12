---
phase: 22
slug: city-search-map-fixes-food-icons
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | ICON-01 | unit | `npx vitest run src/lib/constants/__tests__/food-icons.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | ICON-01 | unit | `npx vitest run src/lib/constants/__tests__/food-icons.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | HOME-02 | unit | `npx vitest run src/lib/constants/__tests__/veneto-comuni.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | HOME-02 | unit | `npx vitest run src/lib/constants/__tests__/veneto-comuni.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | MAP-01 | unit | `npx vitest run src/lib/queries/__tests__/sagre.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 2 | MAP-02 | manual | Visual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/constants/__tests__/food-icons.test.ts` — stubs for ICON-01 mapping logic
- [ ] `src/lib/constants/__tests__/veneto-comuni.test.ts` — stubs for HOME-02 filter logic
- [ ] `public/data/veneto-comuni.json` — static data file needed for tests

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mappa page shows filter controls at top | MAP-02 | Visual layout verification | Navigate to /mappa, verify SearchFilters visible above map |
| Food icons render correctly on SagraCard | ICON-01 | Visual SVG rendering | Visit homepage, verify bottom-right icons on cards |
| City autocomplete dropdown appears | HOME-02 | UI interaction flow | Click hero search, type city name, verify dropdown |
| Map markers match filtered results | MAP-01 | Cross-view data consistency | Apply filters on Cerca, switch to map, verify marker count matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
