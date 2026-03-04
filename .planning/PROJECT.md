# Nemovia

## What This Is

Un'app web che aggrega tutte le sagre ed eventi gastronomici del Veneto da 5+ siti diversi e li presenta in una UI moderna, mobile-first, con mappa interattiva e filtri. L'utente apre l'app, trova le sagre del weekend nella sua zona, filtra per tipo cucina, vede tutto su mappa, e condivide il link. Nessun login, nessuna recensione — pura scoperta di sagre.

## Core Value

Mostrare TUTTE le sagre del Veneto in un unico posto — dove sono, quando sono, cosa offrono — con un'esperienza mobile-first che nessun portale esistente offre.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scraping automatico da 5+ siti di sagre del Veneto (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly)
- [ ] Generic scraper config-driven con selettori CSS da DB
- [ ] Geocoding automatico città → coordinate via Nominatim
- [ ] LLM auto-tagging con Gemini 2.5 Flash: classifica ogni sagra per tipo cucina/ingrediente
- [ ] LLM arricchimento descrizioni: trasforma testi scarni in descrizioni coinvolgenti (max 250 char)
- [ ] Homepage con hero, sagre del weekend, quick filters, card grid
- [ ] SagraCard con immagine, titolo, città, date, food tags, prezzo, distanza
- [ ] Mappa interattiva fullscreen con Leaflet + OpenStreetMap, marker cluster, popup
- [ ] Pagina ricerca con filtri: provincia, raggio km, date, gratis/pagamento, tipo cucina
- [ ] Toggle lista/mappa nella ricerca
- [ ] "Vicino a me" con geolocalizzazione browser
- [ ] Dettaglio sagra: info pratiche, mini mappa, condivisione link, indicazioni Google Maps
- [ ] Cron jobs: scraping 2x/giorno, enrichment 2x/giorno, expire eventi passati
- [ ] SEO: metadata dinamici, sitemap, OG image per ogni sagra
- [ ] UI grafica modernissima con Shadcn/UI + Magic UI + Framer Motion + ReactBits
- [ ] Colori brand: primary amber-600, accent olive/green-700, bg stone-50
- [ ] Mobile-first con BottomNav (Home/Cerca/Mappa)
- [ ] Deploy su Vercel

### Out of Scope

- Auth / login utenti — non necessario per MVP, l'app è pura consultazione
- Recensioni, commenti, foto utenti — complessità eccessiva per v1
- Profili utente e gamification — richiede auth, deferred
- Listing sponsorizzati / monetizzazione — prima validare il prodotto
- Multi-LLM router — Gemini 2.5 Flash sufficiente per MVP
- OCR locandine social — richiede multi-LLM router (EXTRA 1), deferred
- Preferiti / salva sagra — richiede auth
- Notifiche — richiede auth + infrastruttura push
- Cache ricerche — ottimizzazione prematura per MVP

## Context

### Il problema
Chi vuole trovare sagre nel weekend in Veneto deve visitare 5-8 siti diversi (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly, etc.), ognuno con dati parziali, interfacce datate, pubblicità invasive, nessuna geolocalizzazione, nessun filtro per tipo cucina.

### Concorrenza
Tutti i portali esistenti hanno gli stessi problemi: UX anni 2000, non mobile-first, dati frammentati. Nemovia risolve aggregando tutto in un'unica app moderna.

### Utente tipo
Laura, Cittadella (PD), venerdì sera. Vuole trovare una sagra per il weekend. Apre Nemovia, filtra per "Pesce" nella sua zona, trova la Sagra del Baccalà a Sandrigo, vede i dettagli, manda il link al marito su WhatsApp. 30 secondi.

### Tono
Italiano, informale ma competente. L'app deve sembrare curata, non un template.

## Constraints

- **Tech stack**: Next.js 14+ App Router, TypeScript, Tailwind + Shadcn/UI, Supabase (PostgreSQL + PostGIS), Leaflet + OSM, Cheerio, Nominatim, Gemini 2.5 Flash — tutto deciso, non negoziabile per MVP
- **Budget**: Zero costi fissi — tutti servizi free tier (Supabase, Gemini, Nominatim, Vercel, OSM)
- **LLM**: Solo Gemini 2.5 Flash, singolo provider, solo batch (15 req/min free tier)
- **Geocoding**: Nominatim con rate limit 1 req/sec
- **Deploy**: Vercel con cron jobs nativi
- **Design**: Mobile-first obbligatorio, grafica premium (Magic UI, Framer Motion, ReactBits)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase con PostGIS per geo-queries | Query spaziali native, RPC find_nearby_sagre, free tier generoso | — Pending |
| Generic scraper config-driven | Un unico scraper che legge selettori CSS dal DB per ogni fonte, facile aggiungere nuovi siti | — Pending |
| Gemini 2.5 Flash singolo provider | Free tier sufficiente per MVP (~2000 req/giorno), singolo integration point | — Pending |
| Leaflet + OSM invece di Google Maps/Mapbox | Zero costi, nessuna API key, sufficiente per il caso d'uso | — Pending |
| Nominatim per geocoding | Gratuito, accurato per l'Italia, rate limit gestibile per batch processing | — Pending |
| LLM enrichment asincrono via cron | Disaccoppia scraping da enrichment, gestisce rate limits, retry indipendente | — Pending |
| Shadcn/UI + Magic UI + Framer Motion | Componenti base solidi + animazioni premium per differenziarsi dai portali datati | — Pending |

---
*Last updated: 2026-03-04 after initialization*
