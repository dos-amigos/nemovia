# Requirements: Nemovia

**Defined:** 2026-03-06
**Core Value:** Mostrare TUTTE le sagre del Veneto in un unico posto — dove sono, quando sono, cosa offrono — con un'esperienza mobile-first che nessun portale esistente offre.

## v1.1 Requirements

Requirements for v1.1 "Dati Reali". Each maps to roadmap phases.

### Deploy

- [ ] **DEPLOY-01**: enrich-sagre Edge Function deployed with PostGIS WKT geocoding fix

### Scraping

- [ ] **SCRAPE-01**: eventiesagre scraper verified working and producing valid sagre data
- [ ] **SCRAPE-02**: assosagre CSS selectors updated to match live site and produce valid data
- [ ] **SCRAPE-03**: solosagre CSS selectors updated to match live site and produce valid data
- [ ] **SCRAPE-04**: venetoinfesta CSS selectors updated to match live site and produce valid data
- [ ] **SCRAPE-05**: sagritaly data ingested (via alternative to Cheerio for JS-rendered content)

### Data Quality

- [ ] **QUAL-01**: Non-Veneto events filtered out during scraping or enrichment
- [ ] **QUAL-02**: Noise/invalid event titles detected and excluded
- [ ] **QUAL-03**: location_text cleaned before geocoding for higher match rate

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

### Authentication

- **AUTH-01**: User can sign up with Google OAuth
- **AUTH-02**: User can sign up with Magic Link

### User Features

- **USER-01**: User can save sagre as favorites
- **USER-02**: User can leave reviews and upload photos

### Expansion

- **EXPAND-01**: Scraper sources expanded beyond the initial 5

## Out of Scope

| Feature | Reason |
|---------|--------|
| Frontend UI changes | v1.1 is data pipeline only — user preference |
| User authentication | Requires separate milestone, premature |
| Profili utente e gamification | Requires auth, premature |
| Notifiche push | Requires auth + infrastructure |
| Multi-LLM router | Gemini 2.5 Flash sufficient |
| New scraper sources beyond 5 | Fix existing first, expand in v1.2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | — | Pending |
| SCRAPE-01 | — | Pending |
| SCRAPE-02 | — | Pending |
| SCRAPE-03 | — | Pending |
| SCRAPE-04 | — | Pending |
| SCRAPE-05 | — | Pending |
| QUAL-01 | — | Pending |
| QUAL-02 | — | Pending |
| QUAL-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 0
- Unmapped: 9

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
