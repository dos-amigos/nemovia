---
phase: 19
slug: image-quality-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 19 — Validation Strategy

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
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | IMG-01 | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "assigns image"` | No - Wave 0 | ⬜ pending |
| 19-01-02 | 01 | 1 | IMG-01 | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "stores credit"` | No - Wave 0 | ⬜ pending |
| 19-01-03 | 01 | 1 | IMG-01 | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "parseImageCredit"` | No - Wave 0 | ⬜ pending |
| 19-01-04 | 01 | 1 | IMG-01 | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "TAG_QUERIES"` | No - Wave 0 | ⬜ pending |
| 19-02-01 | 02 | 1 | IMG-02 | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "getHeroImage"` | No - Wave 0 | ⬜ pending |
| 19-02-02 | 02 | 1 | IMG-02 | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "UTM"` | No - Wave 0 | ⬜ pending |
| 19-02-03 | 02 | 1 | IMG-02 | manual-only | Visual inspection in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/unsplash.test.ts` — stubs for IMG-01, IMG-02
- No new framework install needed — Vitest 4.0.18 already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HeroSection renders full-bleed with priority image | IMG-02 | Visual layout/rendering requires browser inspection | Open homepage, verify hero image is full-bleed edge-to-edge with white text overlay and dark gradient |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
