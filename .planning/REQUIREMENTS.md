# Requirements: Nemovia v1.4

**Defined:** 2026-03-10
**Core Value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.

## v1 Requirements

Requirements for v1.4 "Esperienza Completa". Each maps to roadmap phases.

### Data Quality

- [x] **DATA-01**: Event count restored to 100+ active sagre (investigate scraper failures, filter aggressiveness, add sources if needed)
- [x] **DATA-02**: No events outside Veneto appear in results (tighten Nominatim bounding box + Veneto province gating)
- [x] **DATA-03**: Non-sagre events filtered out (Passeggiata, Carnevale, Concerto, Mostra, Antiquariato)
- [x] **DATA-04**: City names always display with provincia in parentheses (e.g. "Zugliano (VI)")

### Images

- [x] **IMG-01**: Missing or low-res images replaced with themed Unsplash photos (pre-fetched at pipeline time, not runtime)
- [x] **IMG-02**: Hero section displays full-bleed Unsplash food photo with white text overlay "SCOPRI LE SAGRE DEL VENETO"

### Homepage

- [ ] **HOME-01**: Netflix-style horizontal scroll rows on homepage with smart mix (weekend, vicino a te, tipo cucina, provincia)
- [ ] **HOME-02**: City autocomplete search bar in hero with radius km slider, redirects to Cerca page with city pre-selected

### Layout & Branding

- [ ] **BRAND-01**: Full-width responsive desktop layout (hero and scroll rows edge-to-edge, content sections max-w)
- [ ] **BRAND-02**: Custom SVG logo in navigation bar (Geist typography + stylized icon, coral/teal palette)
- [ ] **BRAND-03**: Modern footer with credits "Fatto con cuore in Veneto" and Unsplash attribution

### Map & Search

- [ ] **MAP-01**: Cerca page map view works correctly (fix nuqs/map state sync issue)
- [ ] **MAP-02**: Dedicated Mappa page has filter controls at top (reuse SearchFilters)

### Scraping

- [ ] **SCRAPE-01**: Source sites scraped for complete info (menu, orari, descriptions) where available
- [x] **SCRAPE-02**: Investigate and add new scraper sources if needed to reach 100+ active events

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Scraping Expansion

- **SCRAPE-03**: OCR locandine from social media (requires multi-LLM router)
- **SCRAPE-04**: Real-time monitoring of new scraper source availability

### User Features

- **USER-01**: Google OAuth authentication
- **USER-02**: Save favorite sagre
- **USER-03**: Push notifications for nearby sagre

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dark mode | Single sophisticated theme sufficient |
| 3D elements (Three.js) | Bundle overhead excessive for zero-cost constraint |
| User reviews and photos | Premature, first validate with real users |
| Native mobile app | Web app mobile-first sufficient |
| Real-time chat | Not core to discovery value |
| Listing sponsorizzati | First validate with real users |
| SwiperJS/Embla carousel | CSS scroll-snap handles Netflix rows natively |
| Nominatim autocomplete | Explicitly forbidden by usage policy — use static data |
| unsplash-js SDK | Unnecessary wrapper, native fetch sufficient |
| Runtime Unsplash API calls | Rate limit risk — pre-fetch at pipeline time only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 18 | Complete |
| DATA-02 | Phase 18 | Complete |
| DATA-03 | Phase 18 | Complete |
| DATA-04 | Phase 18 | Complete |
| SCRAPE-02 | Phase 18 | Complete |
| IMG-01 | Phase 19 | Complete |
| IMG-02 | Phase 19 | Complete |
| BRAND-01 | Phase 20 | Pending |
| BRAND-02 | Phase 20 | Pending |
| BRAND-03 | Phase 20 | Pending |
| HOME-01 | Phase 21 | Pending |
| HOME-02 | Phase 22 | Pending |
| MAP-01 | Phase 22 | Pending |
| MAP-02 | Phase 22 | Pending |
| SCRAPE-01 | Phase 23 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15/15 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
