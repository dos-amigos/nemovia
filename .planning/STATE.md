---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Dati Puliti + Redesign
status: executing
stopped_at: Completed 16-01-PLAN.md
last_updated: "2026-03-10T10:23:33Z"
last_activity: 2026-03-10 -- Completed Plan 16-01 (Font & Palette Foundation)
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.
**Current focus:** v1.3 Dati Puliti + Redesign -- Phase 16 in progress

## Current Position

Phase: 16 of 17 (Design System Foundation) -- IN PROGRESS
Plan: 1 of 2 complete
Status: Executing
Last activity: 2026-03-10 -- Completed Plan 16-01 (Font & Palette Foundation)

Progress: [████████░░] 83% (5/6 plans complete in v1.3 so far)

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (v1.3)
- Average duration: ~10min
- Total execution time: ~48min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14 | 2/2 | ~7min | ~3.5min |
| 15 | 2/2 | ~38min | ~19min |
| 16 | 1/2 | ~3min | ~3min |

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

### Pending Todos

- Italian date format parsing may need refinement as real data volume grows
- Gemini free tier limits may change (last checked Dec 2025)
- Edge Function inline copies need a better solution (growing maintenance burden)
- Futuro: includere mercatini, mostre, fiere e altri eventi non-sagre — servirebbero categorie nell'UI e filtro per tipo evento. Per ora filtrati via is_sagra=false e keyword heuristic (008 migration)
- LazyMotion migration scheduled for Phase 17 (UI-10)

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-03-10
Stopped at: Completed 16-01-PLAN.md
Resume file: None
