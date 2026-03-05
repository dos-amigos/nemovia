# Requirements: Nemovia

**Defined:** 2026-03-04
**Core Value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.

## v1 Requirements

### Data Pipeline

- [x] **PIPE-01**: Sistema scrapa automaticamente sagre da almeno 5 siti (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly)
- [x] **PIPE-02**: Scraper config-driven legge selettori CSS dal database per ogni fonte
- [x] **PIPE-03**: Geocoding automatico citta -> coordinate GPS via Nominatim (rate limit 1 req/sec)
- [x] **PIPE-04**: Deduplicazione cross-fonte tramite normalizzazione nome+citta+date sovrapposte
- [x] **PIPE-05**: Scadenza automatica eventi passati (is_active = false)
- [x] **PIPE-06**: Cron scheduling via Supabase pg_cron (scraping 2x/giorno, enrichment 2x/giorno, expire 1x/giorno)
- [x] **PIPE-07**: LLM auto-tagging con Gemini 2.5 Flash: assegna food_tags e feature_tags a ogni sagra
- [x] **PIPE-08**: LLM arricchimento descrizioni: genera testo coinvolgente max 250 char per sagra
- [x] **PIPE-09**: Batching LLM: 5-10 eventi per prompt per rispettare limite 250 RPD free tier

### Discovery

- [ ] **DISC-01**: Homepage con hero "Scopri le sagre del Veneto" e barra ricerca
- [ ] **DISC-02**: Sezione "Questo weekend" con sagre dei prossimi 3 giorni
- [ ] **DISC-03**: Quick filter chips emoji (Pesce, Carne, Formaggi, Vino, Radicchio, Funghi, Gratis, Oggi)
- [x] **DISC-04**: SagraCard con immagine, titolo, citta(provincia), date, food tags (max 3), prezzo, distanza
- [x] **DISC-05**: Enriched description come sottotitolo nella card (se disponibile)
- [x] **DISC-06**: Pagina ricerca con filtri: provincia, raggio km, date, gratis/pagamento, tipo cucina
- [x] **DISC-07**: Ordinamento risultati per distanza quando geolocalizzazione attiva
- [ ] **DISC-08**: Sezione "Per provincia" in homepage con conteggio sagre

### Mappa

- [x] **MAP-01**: Mappa interattiva con Leaflet + OpenStreetMap con pin per ogni sagra
- [x] **MAP-02**: Marker clustering quando sagre vicine
- [x] **MAP-03**: Popup al click su marker con mini-info sagra
- [ ] **MAP-04**: "Vicino a me" con geolocalizzazione browser via API PostGIS find_nearby_sagre
- [ ] **MAP-05**: Pagina mappa fullscreen dedicata
- [ ] **MAP-06**: Toggle lista/mappa nella pagina ricerca
- [ ] **MAP-07**: Filtri overlay sulla mappa

### Dettaglio

- [x] **DET-01**: Pagina dettaglio sagra con titolo, date, orari, indirizzo, prezzo, descrizione
- [x] **DET-02**: Mini mappa con singolo marker nella pagina dettaglio
- [x] **DET-03**: Bottone "Indicazioni" che apre Google Maps con coordinate
- [x] **DET-04**: Bottone "Condividi" con copia link
- [x] **DET-05**: Link al sito originale della sagra

### SEO & Polish

- [ ] **SEO-01**: generateMetadata dinamici per ogni pagina (titolo, description, OG)
- [ ] **SEO-02**: Sitemap.xml dinamica con tutte le sagre attive
- [ ] **SEO-03**: OG image dinamica per ogni sagra (1200x630, @vercel/og)
- [ ] **SEO-04**: robots.txt
- [ ] **SEO-05**: Loading skeleton per ogni route
- [ ] **SEO-06**: Empty states per ricerche senza risultati

### UI & Design

- [x] **UI-01**: Design mobile-first, perfetto su iPhone
- [x] **UI-02**: BottomNav mobile con tab Home/Cerca/Mappa
- [x] **UI-03**: Colori brand: primary amber-600, accent olive/green-700, bg stone-50
- [ ] **UI-04**: Animazioni premium con Motion + Magic UI (fade-in scroll, spring filters, shimmer loading)
- [ ] **UI-05**: Grafica modernissima -- "non sembra un template"

## v2 Requirements

### Auth & Preferiti

- **AUTH-01**: User can login via Google OAuth
- **AUTH-02**: User can login via Magic Link
- **AUTH-03**: User can save sagre to favorites
- **AUTH-04**: User can view saved favorites list

### Social & Recensioni

- **SOCL-01**: User can rate sagra (1-5 stelle)
- **SOCL-02**: User can write text review
- **SOCL-03**: User can upload photos
- **SOCL-04**: User can vote review as "utile/non utile"

### Advanced Pipeline

- **ADV-01**: Multi-LLM router con 6 provider e fallback
- **ADV-02**: OCR locandine da Facebook/Instagram Pro Loco
- **ADV-03**: Auto-discovery selettori CSS per nuovi siti via LLM

### Engagement

- **ENG-01**: Gamification con livelli utente
- **ENG-02**: Notifiche "nuova sagra nella tua zona"
- **ENG-03**: Filtro "Aperte ora" real-time

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Non necessario per consultazione pura, aggiunge complessita |
| Recensioni e commenti | Richiede auth + moderazione, eccessivo per v1 |
| Listing sponsorizzati | Prima validare il prodotto, poi monetizzare |
| App nativa mobile | Web app mobile-first e sufficiente per v1 |
| Real-time chat | Irrilevante per il caso d'uso |
| Prenotazione tavoli | Fuori scope -- l'app mostra info, non gestisce prenotazioni |
| Multi-lingua | Solo italiano per MVP -- target Veneto |
| Cache ricerche | Ottimizzazione prematura |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 2 | Complete |
| PIPE-02 | Phase 2 | Complete |
| PIPE-03 | Phase 3 | Complete |
| PIPE-04 | Phase 2 | Complete |
| PIPE-05 | Phase 2 | Complete |
| PIPE-06 | Phase 2 | Complete |
| PIPE-07 | Phase 3 | Complete |
| PIPE-08 | Phase 3 | Complete |
| PIPE-09 | Phase 3 | Complete |
| DISC-01 | Phase 4 | Pending |
| DISC-02 | Phase 4 | Pending |
| DISC-03 | Phase 4 | Pending |
| DISC-04 | Phase 4 | Complete |
| DISC-05 | Phase 4 | Complete |
| DISC-06 | Phase 4 | Complete |
| DISC-07 | Phase 4 | Complete |
| DISC-08 | Phase 4 | Pending |
| MAP-01 | Phase 5 | Complete |
| MAP-02 | Phase 5 | Complete |
| MAP-03 | Phase 5 | Complete |
| MAP-04 | Phase 5 | Pending |
| MAP-05 | Phase 5 | Pending |
| MAP-06 | Phase 5 | Pending |
| MAP-07 | Phase 5 | Pending |
| DET-01 | Phase 5 | Complete |
| DET-02 | Phase 5 | Complete |
| DET-03 | Phase 5 | Complete |
| DET-04 | Phase 5 | Complete |
| DET-05 | Phase 5 | Complete |
| SEO-01 | Phase 6 | Pending |
| SEO-02 | Phase 6 | Pending |
| SEO-03 | Phase 6 | Pending |
| SEO-04 | Phase 6 | Pending |
| SEO-05 | Phase 6 | Pending |
| SEO-06 | Phase 6 | Pending |
| UI-01 | Phase 1 | Complete |
| UI-02 | Phase 1 | Complete |
| UI-03 | Phase 1 | Complete |
| UI-04 | Phase 6 | Pending |
| UI-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
