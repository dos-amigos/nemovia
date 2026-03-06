---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Dati Reali
status: defining_requirements
stopped_at: "Defining requirements for v1.1"
last_updated: "2026-03-06"
last_activity: "2026-03-06 -- Milestone v1.1 started"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.
**Current focus:** v1.1 "Dati Reali" — far funzionare tutti i 5 scraper con dati reali e qualità accettabile.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-06 — Milestone v1.1 started

## Accumulated Context

### Decisions

All v1.0 decisions archived to PROJECT.md Key Decisions table with outcomes.

### Pending Todos

- Fix scraping data quality: non-Veneto events, noise titles, dirty location_text
- Fix CSS selectors for assosagre, solosagre, venetoinfesta (currently disabled)
- sagritaly is JS-rendered -- not scrapable with Cheerio, needs alternative approach
- Italian date format parsing may need refinement as real data volume grows
- Deploy enrich-sagre Edge Function fix (PostGIS geocoding WKT)

### Blockers/Concerns

- Only 1 of 5 scraper sources active (eventiesagre) -- sufficient for dev but not production
- Gemini free tier limits may change (last changed Dec 2025)
- Data quality: some scraped events are not sagre or not from Veneto
- sagritaly JS-rendering requires different scraping approach (headless browser or API)

## Session Continuity

Last session: 2026-03-06
Stopped at: Defining v1.1 requirements
Resume file: None
