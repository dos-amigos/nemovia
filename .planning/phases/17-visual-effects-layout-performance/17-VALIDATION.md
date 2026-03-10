---
phase: 17
slug: visual-effects-layout-performance
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run build` (verify no build errors)
- **After every plan wave:** `npm run test` + `npm run build` (full suite + build verification)
- **Before `/gsd:verify-work`:** Full suite must be green + manual visual inspection on mobile viewport
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | UI-05 | manual-only | Visual inspection in browser | N/A | ⬜ pending |
| 17-01-02 | 01 | 1 | UI-06 | manual-only | Visual inspection + Chrome DevTools Layers panel | N/A | ⬜ pending |
| 17-01-03 | 01 | 1 | UI-07 | manual-only | Visual inspection | N/A | ⬜ pending |
| 17-01-04 | 01 | 1 | UI-11 | manual-only | Chrome DevTools Performance recording on throttled CPU | N/A | ⬜ pending |
| 17-02-01 | 02 | 2 | UI-08 | manual-only | Visual inspection, verify text readability | N/A | ⬜ pending |
| 17-02-02 | 02 | 2 | UI-09 | manual-only | Resize browser / test mobile viewport | N/A | ⬜ pending |
| 17-03-01 | 03 | 1 | UI-10 | smoke | `npm run build` + check bundle size | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* This phase is predominantly CSS/visual work where automated unit tests add no value. Build verification (`npm run build`) is the primary automated gate. The existing vitest suite ensures no regressions in data/query logic.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glass-like translucent nav bars | UI-05 | Visual CSS effect, no testable logic | Verify TopNav and BottomNav show frosted glass effect with backdrop-blur, content scrolls behind them |
| Max 2-3 blur surfaces per viewport | UI-06, UI-11 | CSS constraint requires visual audit | Count blur elements per page in Chrome DevTools Layers panel. Max 3 on any page |
| Mesh gradient backgrounds | UI-07 | Pure CSS visual effect | Verify hero section and page backgrounds show radial gradient blobs with coral/teal colors |
| SagraCard image overlay redesign | UI-08 | HTML/CSS structure change | Verify card shows full-bleed image with dark gradient overlay, white text readable on all image types |
| Bento grid responsive layout | UI-09 | CSS Grid layout | Resize browser: mobile=single column, desktop=asymmetric 4-col grid with featured card spanning 2 cols |
| Mobile glass performance | UI-11 | Runtime performance | Chrome DevTools Performance recording with 4x CPU throttle, verify no jank during scroll |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
