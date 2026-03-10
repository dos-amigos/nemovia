---
phase: 16
slug: design-system-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 16 — Validation Strategy

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

- **After every task commit:** Run `npx next build` (confirms no build breaks)
- **After every plan wave:** Run `npx next build` + grep check for old color references
- **Before `/gsd:verify-work`:** Full suite must be green + zero grep hits for old palette + visual confirmation
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | UI-01 | manual-only | Visual inspection + `npx next build` | N/A | ⬜ pending |
| 16-01-02 | 01 | 1 | UI-02 | smoke | `npx next build` | N/A -- build check | ⬜ pending |
| 16-01-03 | 01 | 1 | UI-03 | manual-only | Visual inspection of tokens | N/A | ⬜ pending |
| 16-02-01 | 02 | 1 | UI-04 | smoke | `grep -r "amber-\|stone-\|from-green\|to-green\|border-green\|bg-green\|text-green" src/ --include="*.tsx" --include="*.css"` | N/A -- grep check | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

This phase is purely visual/CSS changes with no business logic. Validation is build success + grep-based static analysis + visual inspection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All text renders in Geist font | UI-01 | Font rendering is visual — no programmatic assertion possible | 1. Open app in browser 2. Inspect any text element 3. Verify computed font-family shows "Geist" 4. Confirm no layout shift on load |
| Shadcn token pairs render correctly | UI-03 | Token consistency is a visual property across many components | 1. Navigate to pages with buttons, badges, cards, inputs 2. Verify primary/accent/destructive colors match new palette 3. Check foreground text is readable on each background |
| New palette feels vibrant and modern | UI-02 | Aesthetic quality is subjective | 1. Browse all pages 2. Compare against old amber/stone screenshots 3. Confirm "WOW" factor per user requirement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
