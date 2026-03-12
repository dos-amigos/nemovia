---
phase: 21
slug: netflix-rows-homepage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | HOME-01a | unit | `npx vitest run src/components/home/__tests__/ScrollRowSection.test.ts -t "hides row"` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | HOME-01b | unit | `npx vitest run src/lib/queries/__tests__/homepage-rows.test.ts -t "dedup"` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | HOME-01c | unit | `npx vitest run src/lib/queries/__tests__/homepage-rows.test.ts -t "active"` | ❌ W0 | ⬜ pending |
| 21-01-04 | 01 | 1 | HOME-01d | manual | Visual inspection: horizontal scroll CSS classes | N/A | ⬜ pending |
| 21-01-05 | 01 | 1 | HOME-01e | manual | Visual inspection: desktop arrow buttons | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/home/__tests__/ScrollRowSection.test.ts` — stubs for HOME-01a (min threshold)
- [ ] `src/lib/queries/__tests__/homepage-rows.test.ts` — stubs for HOME-01b, HOME-01c (dedup, active query)
- [ ] Tests require mocking Supabase client — use vitest `vi.mock`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scroll snap interaction feels smooth | HOME-01d | CSS scroll-snap behavior can't be unit-tested | Open dev server, test horizontal scroll on mobile and desktop viewports |
| Desktop arrow buttons scroll container | HOME-01e | Requires browser rendering and click interaction | Hover over scroll row on desktop, click left/right arrows, verify smooth scroll |
| Edge-to-edge scroll alignment | HOME-01d | Visual alignment of first card with content | Verify first card aligns with row title on all breakpoints |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
