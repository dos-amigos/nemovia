---
phase: 20
slug: layout-branding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Visual inspection at 375px, 768px, 1920px
- **After every plan wave:** `npm run build` to verify no TypeScript/build errors
- **Before `/gsd:verify-work`:** All pages render correctly at 375px, 768px, 1920px, 2560px
- **Max feedback latency:** 30 seconds (build time)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | BRAND-01 | manual | Visual: no max-w-7xl on main, content contained | N/A | ⬜ pending |
| 20-01-02 | 01 | 1 | BRAND-01 | manual | Visual: no horizontal scrollbar at 1920px, 2560px | N/A | ⬜ pending |
| 20-02-01 | 02 | 1 | BRAND-02 | manual | Visual: SVG logo renders in coral/teal in TopNav | N/A | ⬜ pending |
| 20-02-02 | 02 | 1 | BRAND-02 | manual | DOM: `aria-label="Nemovia"` present on SVG | N/A | ⬜ pending |
| 20-03-01 | 03 | 1 | BRAND-03 | manual | Visual: footer on homepage, cerca, mappa, sagra detail | N/A | ⬜ pending |
| 20-03-02 | 03 | 1 | BRAND-03 | manual | Visual: "Fatto con cuore in Veneto" + Unsplash link | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No test infrastructure needed for visual-only changes. Build verification (`npm run build`) is sufficient.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full-width layout with contained content | BRAND-01 | CSS layout change, no logic to unit test | Resize browser to 1920px and 2560px; verify no horizontal scrollbar, text readable |
| SVG logo in coral/teal | BRAND-02 | Static SVG rendering, subjective visual quality | Inspect TopNav at mobile/desktop; verify logo colors match brand palette |
| Footer on every page | BRAND-03 | Static HTML rendering across multiple routes | Navigate homepage, /cerca, /mappa, /sagra/[slug]; verify footer visible |
| No BottomNav overlap on mobile | BRAND-03 | Layout interaction between footer and fixed nav | On mobile (375px), scroll to bottom; verify footer text not hidden behind BottomNav |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
