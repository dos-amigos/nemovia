---
phase: 5
slug: map-detail
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | MAP-01 | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | MAP-02, MAP-03 | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | MAP-04, MAP-05, MAP-06 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | DET-01, DET-02, DET-03, DET-04, DET-05 | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Map renders markers at correct positions | MAP-01 | Requires visual browser check | Open /mappa, verify markers appear on map |
| Marker clustering works at zoom levels | MAP-02 | Visual clustering behavior | Zoom out on map with many markers, verify clusters form |
| Geolocation centers map correctly | MAP-04 | Requires browser geolocation | Click "Vicino a me", verify map centers on user |
| Google Maps directions link works | DET-04 | External navigation | Click "Indicazioni" on detail page, verify Google Maps opens |
| Share/copy link works | DET-05 | Clipboard interaction | Click "Condividi", verify URL copied |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
