# PROGRESS.md — Riferimento Assoluto di Progetto

> **REGOLA**: Leggere questo file ALL'INIZIO di ogni nuova sessione chat.
> Aggiornarlo DOPO ogni azione completata.
> Ultimo aggiornamento: 2026-03-27 (sessione 17).

---

## Stato Attuale del Progetto

### Stack e Infrastruttura
- **Framework**: Next.js 15, Tailwind v4, Shadcn/UI
- **Database**: Supabase (PostGIS + pg_trgm)
- **Scraping**: Cheerio/JSON in Edge Functions + Node.js scripts via GitHub Actions
- **Pipeline**: pg_cron (Edge Functions) + GitHub Actions (Node.js scripts)
- **Immagini**: Unsplash -> Pexels -> local fallback (cascata in enrich-sagre Pass 3) + Vision AI validation
- **Quality system**: confidence scoring (0-100) + review_status workflow + admin area
- **Deploy**: Vercel (nemovia.it)
- **Migrations**: 001-052, tutte applicate

### Numeri
- **Sagre in DB**: 1,373+
- **Sagre attive**: 271+
- **Fonti scraping**: 33 totali (vedi `.planning/FONTI.md` per dettagli)
  - 25 Edge Functions (scrape-sagre[6 fonti], scrape-sagretoday, scrape-trovasagre, scrape-sagriamo, scrape-cheventi, scrape-insagra, scrape-prolocobellunesi, scrape-anteprimasagre, scrape-2d2web, scrape-gardaclick, scrape-eventivicenza, scrape-regioneveneto, scrape-trevisoeventi, scrape-easyvi, scrape-4jesoloevents, scrape-invenicetoday, scrape-arquapetrarca, scrape-venetoedintorni, scrape-visitchioggia, scrape-visitfeltre, scrape-caorle, scrape-prolocovicentine, scrape-panesalamina, scrape-primarovigo)
  - 1 enrichment Edge Function (enrich-sagre)
  - 3 GitHub Actions (facebook, tavily, instagram/apify)
  - 1 GitHub Action (culturaveneto.mjs, 2x/week)
  - 1 XLSX parser (regioneveneto, 1,123 sagre)

### Versioni
- v1.0-v1.3: vedi .planning/milestones/
- v1.4 "Esperienza Completa": shipped 2026-03-12 (tag git v1.4)

---

## COSA E' IMPLEMENTATO

### Scraping
- [x] assosagre.it, solosagre.com, sagritaly.it, eventiesagre.it, itinerarinelgusto.it (scrape-sagre, 6 fonti DB-driven)
- [x] sagretoday.it (JSON-LD, 1x/day 06:00)
- [x] trovasagre.it (JSON API, dati test 2025)
- [x] sagriamo.it (REST API)
- [x] cheventi.it (JSON-LD, GPS coords)
- [x] insagra.it (JSON-LD, 15 sagre primo run, 4 RO)
- [x] culturaveneto.it (GitHub Action, 2x/week, fonte regionale ufficiale)
- [x] prolocobellunesi.it (WP REST API, copre BL)
- [x] anteprimasagre.it (WP REST API, TV+VE+PD+VI)
- [x] 2d2web.com (Cheerio, 132 inserite al primo run)
- [x] gardaclick.com (Cheerio, area Garda VR)
- [x] eventivicenza (JSON API, REST /opendata/api/)
- [x] regioneveneto XLSX (1,123 sagre, fonte definitiva per legge)
- [x] trevisoeventi.com (HTML)
- [x] easyvi.it (AJAX /getevents.php)
- [x] 4jesoloevents.it (HTML)
- [x] invenicetoday (HTML)
- [x] arquapetrarca (HTML, Colli Euganei)
- [x] venetoedintorni.it (HTML)
- [x] visitchioggia (HTML)
- [x] visitfeltre (HTML, BL)
- [x] caorle (HTML, VE costiera)
- [x] prolocovicentine (HTML, VI)
- [x] panesalamina (HTML)
- [x] primarovigo (HTML, RO)
- [x] Facebook events (GitHub Action, daily 08:00, stagionale)
- [x] Tavily Search (GitHub Action, ogni 3gg)
- [x] Instagram/Apify (GitHub Action, Lun+Gio 09:00)

### Enrichment Pipeline
- [x] Enrich pipeline (categorizzazione, geocoding, Unsplash/Pexels images)
- [x] Vision AI (Groq Vision) validazione OGNI immagine
- [x] Filtro anti-asiatico 30+ termini su tutte le API immagini
- [x] Detail scraping (menu, orari, descrizioni) con pattern NULL-only update
- [x] LLM chain: Groq -> Mistral -> Gemini (enrichment), Groq Vision (image validation)
- [x] Photo dedup (no stessa immagine su sagre diverse)
- [x] Self-chaining (server continua anche a browser chiuso)
- [x] Batch 200/run per Unsplash rate limits
- [x] Vinitaly hardcoded blocklist
- [x] Low-quality image defense (3 livelli: scrape/enrich/display)

### Quality & Dedup
- [x] confidence scoring (0-100) + review_status workflow
- [x] Auto-approval: confidence>=50 + data + Veneto + futura
- [x] is_sagra=false + confidence>=70 -> needs_review (non discard)
- [x] Provincia sconosciuta -> needs_review (non discard)
- [x] Dedup: 5 livelli (find_duplicate_sagra RPC, deduplicate_sagre() cron 02:00 UTC con 4 metodi, deduplicateByTitle frontend, cleanup_stale_sagre cron, geo-proximity 15km)
- [x] dedup_logs table (traccia ogni merge)

### Frontend
- [x] Homepage con hero, QuickFilters, ScrollRows per provincia e food
- [x] Frosted glass header
- [x] Pagina /cerca con filtri sidebar (desktop) / top (mobile), view toggle griglia+lista
- [x] Pagina /mappa con Leaflet, marker tematici (40x56px), tooltip ricca
- [x] Pagina dettaglio sagra con mini-map, menu, orari, gallery
- [x] Ricerca citta + raggio (slider Airbnb-style)
- [x] Food icons tematiche (carne, pesce, zucca, gnocco, verdura, vino, dolci, altro) con SVG custom
- [x] ScrollRow: CSS snap mobile + JS drag desktop (separazione totale)
- [x] Video Pexels della citta come fallback
- [x] Mappa mobile: drag con 2 dita (MapGestureHandler)
- [x] Brand color CSS variables (--brand-l/c/h), logo bordeaux SVG
- [x] OG metadata, share button, back button
- [x] Province display normalizzato "(VI)" maiuscolo, mai "()" vuoto

### Admin Area
- [x] Route /admin (password gate)
- [x] 3 viste con sidebar: Dashboard, Dettagli, Gestione Sagre
- [x] Dashboard: semaforo, metriche, progress bar, review summary, unioni recenti dedup
- [x] Dettagli: pipeline stats, stato fonti, gestione fonti CRUD, cron jobs con trigger
- [x] Gestione Sagre: filtri, tabella approve/reject/edit, bulk approve, paginazione

---

## TODO REALI (non completati)

### Media Priorita
- [ ] La row "Sagre di Verdura" apparira automaticamente quando ci saranno >=3 sagre con tag Verdura (richiede massa critica dati)
- [ ] Aumentare copertura immagini (parte delle sagre ancora senza immagine valida)

### Bassa Priorita
- [ ] prolocovenete.it (AJAX WordPress, reverse-engineering)
- [ ] paesiinfesta.com (solo VE/TV orientale, 10-30 sagre)
- [ ] Widget TOSC5 reverse-engineering (sblocca UNPLI Padova, Visit Cittadella, Welcome Saccisica)

### Fonti da investigare (vedi FONTI.md per dettagli)
- [ ] Venezia centro storico: feste parrocchiali/sestiere molto locali
- [ ] Arqua Petrarca: altre sagre Colli Euganei oltre a quelle gia coperte

---

## BUG RISOLTI (archivio)

Tutti i bug BUG-001 attraverso BUG-018 sono stati risolti. Riepilogo:

- BUG-001: Ricerca citta+raggio 0 risultati (migration 016)
- BUG-002: Click sagra homepage non navigava (setPointerCapture fix)
- BUG-003: Immagini bassa risoluzione (isLowQualityUrl rafforzato)
- BUG-004: Filtri /cerca sidebar compressi (grid-cols fix)
- BUG-005: Logo non visibile mobile (barra mobile aggiunta)
- BUG-006: Filtri /mappa full-width (variant prop)
- BUG-007: Scroll row mobile no snap (CSS snap-x)
- BUG-008: Drag desktop rotto + padding + logo (pointer-type split)
- BUG-009: Drag a scatti smartphone (rimosso snap-always)
- BUG-010: Icona "altro" illeggibile (redesign fork+knife)
- BUG-011: Icona dolci sembra edificio (redesign cupcake)
- BUG-012: "Questo weekend" non visibile (minItems prop)
- BUG-013: Pin mappa icona troppo alta (translate fix)
- BUG-014: Progress bar scroll non necessaria (rimossa)
- BUG-015: Immagini Unsplash non pertinenti (unsplash_query LLM-generated)
- BUG-016: Header compatto (padding fix)
- BUG-017: Logo colore terracotta -> bordeaux (SVG + CSS vars)
- BUG-018: Province display "()" vuota (provinceSuffix helper)

---

## Log Sessioni

### 2026-03-27 (sessione 17) — 20 nuovi scraper + Vision AI + frosted glass header

**Nuovi scraper implementati (20):**
- insagra.it (JSON-LD, 15 sagre primo run, 4 RO)
- prolocobellunesi.it (WP REST API, copertura BL)
- anteprimasagre.it (WP REST API, TV+VE+PD+VI)
- 2d2web.com (Cheerio, 132 inserite al primo run)
- gardaclick.com (Cheerio, area Garda VR, 14 inserite, 5 merged)
- eventivicenza (JSON API REST /opendata/api/, GPS coords)
- regioneveneto XLSX (FONTE DEFINITIVA: 1,123 sagre registrate per legge, DGR 184/2017)
- trevisoeventi.com (HTML)
- easyvi.it (AJAX /getevents.php)
- 4jesoloevents.it (HTML, 40+ eventi)
- invenicetoday (HTML)
- arquapetrarca (HTML, Colli Euganei)
- venetoedintorni.it (HTML)
- visitchioggia (HTML)
- visitfeltre (HTML, BL)
- caorle (HTML, VE costiera)
- prolocovicentine (HTML, VI)
- panesalamina (HTML)
- primarovigo (HTML, RO)
- insagra API upgrade (da Cheerio a JSON-LD nativo)

**Pipeline e qualita:**
- Vision AI prompt strengthened, fail-closed, photo dedup
- itinerarinelgusto fixed (selettori aggiornati, migration 034)
- venetoinfesta deactivated (migration 033)
- Filtro anti-asiatico espanso 30+ termini su tutte le API

**Frontend:**
- Frosted glass header

**Infrastruttura:**
- CLAUDE.md riscritto
- FONTI.md creato (catalogo completo fonti)
- Memory cleaned up
- Migrations 032-052 create e applicate

**Ricerca:**
- Venezia: 37 festival identificati
- Arqua Petrarca: 8 sagre
- Citta costiere e capoluoghi 7 province

### 2026-03-26 (sessione 16) — Vision AI + filtro anti-asiatico + hero videos fix
- Vision AI image validation: Groq Vision verifica OGNI foto
- Filtro anti-asiatico su TUTTE le API (regex 30+ termini)
- Hero videos rimossi (uno aveva bacchette), ora solo API filtrati + fallback
- LLM prompt hardened: divieto inventare dati
- Query immagini specifiche (no generiche)
- Testo formattato: fix `\n` letterali
- 67 immagini azzerate, 25 ri-assegnate con Vision AI
- enrich-sagre deployata

### 2026-03-26 (sessione 15) — Tooltip mappa + dedup geo-proximity + logging admin
- Tooltip mappa migliorato (nuvoletta ricca CSS custom)
- Dedup geo-proximity (Method C): ST_DWithin 15km + title similarity >0.5 + date +-7gg
- dedup_logs table + Admin "Unioni recenti"
- Merge espande date range (keeper prende range piu ampio)
- Migration 031

### 2026-03-24 (sessione 14) — Dedup aggressiva + pulizia DB
- deduplicate_sagre() function (3 metodi: title+provincia, title+city, city+date)
- cleanup_stale_sagre() function
- pg_cron cleanup-and-dedup-daily 02:00 UTC
- Pulizia DB: 285->118 righe
- View toggle /cerca (griglia + lista)
- Nuovo scraper culturaveneto.it (GitHub Action)
- Migration 030

### 2026-03-17 (sessione 8) — Quality rearchitecture + Admin area + Instagram
- Quality rearchitecture: confidence + review_status, single-pass Gemini prompt
- Admin area /admin: password-protected, filter/approve/reject/edit
- Multiple food icons per sagra
- Instagram/Apify scraper
- Migration 023-025

### 2026-03-17 (sessione 7) — Pexels + cheventi + Tavily + Facebook
- Pexels Image API in enrich-sagre (cascata Unsplash->Pexels)
- scrape-cheventi Edge Function
- discover-tavily.mjs (33 sagre qualita)
- scrape-facebook.mjs
- GitHub Actions workflow

### Sessioni 1-6 (2026-03-12 - 2026-03-16)
- v1.4 shipped, ScrollRow definitivo, video tematici, food icons redesign x3
- 3 nuovi scrapers (sagretoday, trovasagre, sagriamo)
- Province normalization, DB cleanup, dedup
- Pexels fallback immagini, Gemini prompt tuning
- 165 immagini fallback locali (33 soggetti x 5 varianti)
- 18 bug fix (BUG-001 through BUG-018)
