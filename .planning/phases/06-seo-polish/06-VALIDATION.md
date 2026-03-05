---
phase: 6
slug: seo-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SEO-01 | manual-only | Visual inspection via `next build` + `curl` headers | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | SEO-02 | smoke | `pnpm test -- src/app/sitemap.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | SEO-03 | manual-only | Visit `/sagra/[slug]/opengraph-image` in browser | N/A | ⬜ pending |
| 06-01-04 | 01 | 1 | SEO-04 | unit | `pnpm test -- src/app/robots.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | SEO-05 | manual-only | Visual inspection during dev navigation | N/A | ⬜ pending |
| 06-02-02 | 02 | 1 | SEO-06 | manual-only | Visual inspection with empty search filters | N/A | ⬜ pending |
| 06-02-03 | 02 | 1 | UI-04 | manual-only | Visual inspection during scroll/interaction | N/A | ⬜ pending |
| 06-02-04 | 02 | 1 | UI-05 | manual-only | Subjective visual review | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/sitemap.test.ts` — verify sitemap function returns expected URL structure with active sagre
- [ ] `src/app/robots.test.ts` — verify robots function returns correct rules and sitemap URL

*Most SEO and UI-polish requirements are visual/manual-only by nature (metadata rendering, OG image appearance, animation smoothness). A `pnpm build` without errors serves as the primary automated gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dynamic meta tags per page | SEO-01 | Metadata rendering is server-side HTML output | 1. Run `pnpm build` 2. `curl -s localhost:3000 \| grep '<title>'` 3. Check OG tags in HTML |
| OG image renders correctly | SEO-03 | Visual quality of generated image | Visit `/sagra/test-slug/opengraph-image` in browser, verify 1200x630 branded card |
| Loading skeletons per route | SEO-05 | Visual timing/appearance | Throttle network in DevTools, navigate between routes, verify skeleton appears |
| Empty states display | SEO-06 | Visual appearance with specific data conditions | Search with impossible filter combination, verify empty state message |
| Animations present | UI-04 | Visual smoothness and timing | Scroll through homepage, apply filters, verify fade-in/spring/shimmer |
| Premium non-template feel | UI-05 | Subjective visual assessment | Full app walkthrough comparing to generic templates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
