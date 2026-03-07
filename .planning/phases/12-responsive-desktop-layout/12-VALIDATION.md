---
phase: 12
slug: responsive-desktop-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run` + manual browser check at 640px, 768px, 1024px, 1280px, 1536px
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | DESK-01 | manual-only | Visual check at multiple viewport widths | N/A | ⬜ pending |
| 12-01-02 | 01 | 1 | DESK-02 | manual-only | Visual check at sm/md/lg/xl breakpoints | N/A | ⬜ pending |
| 12-01-03 | 01 | 1 | DESK-03 | manual-only | Visual check at lg breakpoint (1024px) | N/A | ⬜ pending |
| 12-01-04 | 01 | 1 | DESK-04 | manual-only | Visual check at lg breakpoint | N/A | ⬜ pending |
| 12-01-05 | 01 | 1 | DESK-05 | manual-only | Hover map marker at desktop viewport | N/A | ⬜ pending |
| 12-01-06 | 01 | 1 | SKEL-02 | manual-only | Compare skeleton vs loaded content at each breakpoint | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase's requirements are CSS layout changes best verified visually. No new test files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive max-width container with breakpoint padding | DESK-01 | CSS visual layout — Vitest uses node environment, cannot test CSS breakpoints | Resize browser to sm/md/lg/xl/2xl widths, verify container padding scales |
| Multi-column card grids on tablet/desktop | DESK-02 | CSS grid column count changes — requires visual verification at breakpoints | Check grid: 1 col <640px, 2 cols sm, 3 cols lg, 4 cols xl |
| Desktop top nav visible, BottomNav hidden on lg+ | DESK-03 | CSS display toggle — requires visual check at 1024px breakpoint | Resize to 1024px+: TopNav visible, BottomNav hidden; <1024px: reversed |
| Side-by-side detail layout on desktop | DESK-04 | CSS grid layout change — requires visual check | Open sagra detail at lg+: image+map left, info right |
| Tooltip on map marker hover | DESK-05 | Leaflet DOM interaction — requires browser hover event | Hover map marker at desktop viewport, verify tooltip with sagra name appears |
| Skeleton shapes match content layout at every breakpoint | SKEL-02 | CSS layout consistency — requires visual comparison | Compare skeleton vs loaded content at each breakpoint, no layout shift |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
