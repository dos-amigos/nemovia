---
phase: 11
slug: bug-fixes-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run` + manual browser check
- **Before `/gsd:verify-work`:** Full suite must be green + manual accessibility check
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | BUG-01 | manual-only | N/A -- visual, needs browser | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | BUG-02 | manual-only | N/A -- visual, needs browser | N/A | ⬜ pending |
| 11-01-03 | 01 | 1 | BUG-03 | manual-only | N/A -- requires Supabase + browser | N/A | ⬜ pending |
| 11-01-04 | 01 | 1 | BUG-04 | manual-only | N/A -- visual, needs wide viewport | N/A | ⬜ pending |
| 11-02-01 | 02 | 1 | A11Y-01 | manual-only | N/A -- requires OS setting + visual | N/A | ⬜ pending |
| 11-02-02 | 02 | 1 | A11Y-02 | manual-only | N/A -- requires Tab + visual check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All phase requirements are UI/visual fixes verified manually. Existing Vitest tests (scrapers, date parser, geocoding) are unaffected and should pass without changes.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Back button visible on detail page | BUG-01 | Visual element, needs browser | Navigate to any sagra detail page, verify back button appears |
| Image placeholder on detail page | BUG-02 | Visual element, needs browser | Navigate to sagra without image, verify gradient+icon placeholder |
| Cerca page shows all sagre by default | BUG-03 | Requires Supabase + browser | Visit /cerca, verify sagre list is populated with no filters |
| Desktop content fills screen width | BUG-04 | Visual, needs wide viewport | Open app in desktop browser (>1024px), verify content is not squeezed |
| Reduced-motion disables animations | A11Y-01 | Requires OS setting + visual | Enable reduced-motion in OS, verify no animations play |
| Focus indicators on all interactive elements | A11Y-02 | Requires Tab + visual | Tab through all interactive elements, verify visible focus ring |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
