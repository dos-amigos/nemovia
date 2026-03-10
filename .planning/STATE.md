---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Dati Puliti + Redesign
status: executing
stopped_at: Completed 17-02-PLAN.md
last_updated: "2026-03-10T11:55:30Z"
last_activity: 2026-03-10 -- Completed Plan 17-02 (Card Overlay + Bento Grid)
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 9
  completed_plans: 8
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.
**Current focus:** v1.3 Dati Puliti + Redesign -- Phase 17 in progress

## Current Position

Phase: 17 of 17 (Visual Effects, Layout, Performance)
Plan: 2 of 3 complete
Status: Executing
Last activity: 2026-03-10 -- Completed Plan 17-02 (Card Overlay + Bento Grid)

Progress: [████████░░] 89% (8/9 plans complete in v1.3 so far)

## Performance Metrics

**Velocity:**
- Total plans completed: 8 (v1.3)
- Average duration: ~7min
- Total execution time: ~57min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14 | 2/2 | ~7min | ~3.5min |
| 15 | 2/2 | ~38min | ~19min |
| 16 | 2/2 | ~8min | ~4min |
| 17 | 2/3 | ~8min | ~4min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0/v1.1/v1.2 decisions archived to PROJECT.md Key Decisions table.

- [14-01] Used getUTCDate() for timezone-safe calendar date range detection
- [14-01] Multi-word "calendario" pattern to avoid false positives on legitimate sagra titles
- [14-01] Dynamic year comparison in isPastYearEvent (no hardcoded 2026)
- [14-02] Filters run on normalized event data (after date parsing) for correct date validation
- [14-02] PostgreSQL \y word boundary instead of \b for POSIX regex compatibility
- [14-02] Expire cron unschedule-before-reschedule to avoid pg_cron duplicate job issue
- [15-01] Source-specific image upgrade via switch statement for extensibility
- [15-01] CSS custom properties (from-primary/via-accent) for palette-agnostic placeholders
- [15-02] pg_trgm similarity thresholds: 0.6 title, 0.5 city for fuzzy dedup
- [15-02] Retroactive dedup requires BOTH title similarity AND date overlap (never title alone)
- [15-02] Non-sagra events deactivated with status classified_non_sagra (never deleted)
- [15-02] is_sagra rides existing Gemini batch call -- zero additional API calls
- [16-01] Geist variable font (weight 100-900) with latin subset only -- sufficient for Italian content
- [16-01] Cool neutral hue 260 for all grays instead of warm stone hue 106 -- modern, crisp feel
- [16-01] Coral primary at oklch(0.637 0.237 25.5) -- high chroma for visual impact
- [16-02] Hero gradient uses from-primary/10 via-primary/5 to-accent/10 for subtle coral-to-teal wash
- [16-02] Active state buttons use bg-accent/10 border-accent/30 text-accent pattern consistently
- [16-02] All dark: prefixed color classes removed -- dark mode out of scope
- [17-01] Literal OKLCH values in glass CSS utilities (not CSS vars) to avoid backdrop-filter composition issues
- [17-01] will-change: backdrop-filter on glass classes for GPU layer pre-allocation
- [17-01] Max 3 simultaneous blur surfaces per viewport for mobile performance
- [17-02] Inline mesh gradient style object (self-contained, no globals.css dependency)
- [17-02] First weekendSagra as featured card (no DB change needed)
- [17-02] Removed Card/CardContent wrappers from SagraCard (motion.div IS the card)
- [17-02] Bento grid 4-col on lg with featured spanning 2x2

### Pending Todos

- Italian date format parsing may need refinement as real data volume grows
- Gemini free tier limits may change (last checked Dec 2025)
- Edge Function inline copies need a better solution (growing maintenance burden)
- Futuro: includere mercatini, mostre, fiere e altri eventi non-sagre — servirebbero categorie nell'UI e filtro per tipo evento. Per ora filtrati via is_sagra=false e keyword heuristic (008 migration)
- LazyMotion migration scheduled for Phase 17 (UI-10)

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-03-10T11:55:30Z
Stopped at: Completed 17-02-PLAN.md
Resume file: .planning/phases/17-visual-effects-layout-performance/17-02-SUMMARY.md
