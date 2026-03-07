# Nemovia

## What This Is

Un'app web che aggrega tutte le sagre ed eventi gastronomici del Veneto da 5+ siti diversi e li presenta in una UI moderna, mobile-first, con mappa interattiva, filtri, e dettagli condivisibili. L'utente apre l'app, trova le sagre del weekend nella sua zona, filtra per tipo cucina, vede tutto su mappa, e condivide il link. Nessun login, nessuna recensione — pura scoperta di sagre.

## Core Value

Mostrare TUTTE le sagre del Veneto in un unico posto — dove sono, quando sono, cosa offrono — con un'esperienza mobile-first che nessun portale esistente offre.

## Requirements

### Validated

- ✓ Scraping automatico da 5+ siti di sagre del Veneto — v1.0 (config-driven, 5 sources configured, 1 active)
- ✓ Generic scraper config-driven con selettori CSS da DB — v1.0
- ✓ Geocoding automatico città → coordinate via Nominatim — v1.0
- ✓ LLM auto-tagging con Gemini 2.5 Flash — v1.0 (food_tags + feature_tags)
- ✓ LLM arricchimento descrizioni max 250 char — v1.0
- ✓ Homepage con hero, sagre del weekend, quick filters, card grid — v1.0
- ✓ SagraCard con immagine, titolo, città, date, food tags, prezzo, distanza — v1.0
- ✓ Mappa interattiva fullscreen con Leaflet + OSM, marker cluster, popup — v1.0
- ✓ Pagina ricerca con filtri: provincia, raggio km, date, gratis/pagamento, tipo cucina — v1.0
- ✓ Toggle lista/mappa nella ricerca — v1.0
- ✓ "Vicino a me" con geolocalizzazione browser — v1.0
- ✓ Dettaglio sagra: info pratiche, mini mappa, condivisione link, indicazioni Google Maps — v1.0
- ✓ Cron jobs: scraping 2x/giorno, enrichment 2x/giorno, expire eventi passati — v1.0
- ✓ SEO: metadata dinamici, sitemap, OG image per ogni sagra — v1.0
- ✓ UI grafica modernissima con Shadcn/UI + Motion — v1.0
- ✓ Colori brand: primary amber-600, accent olive/green-700, bg stone-50 — v1.0
- ✓ Mobile-first con BottomNav (Home/Cerca/Mappa) — v1.0
- ✓ Deploy su Vercel — v1.0
- ✓ Deploy enrich-sagre Edge Function fix (PostGIS WKT geocoding) — v1.1
- ✓ All 5 scraper sources active (eventiesagre, assosagre, solosagre, venetoinfesta, sagritaly) — v1.1
- ✓ Sagritaly ingested via Cheerio (server-rendered WordPress, not JS-rendered) — v1.1
- ✓ Data quality: noise title detection, location normalization, Veneto province gating — v1.1
- ✓ Retroactive data cleanup: 36 dirty rows deactivated, 735 clean active sagre — v1.1

### Active

- [ ] Back button on sagra detail page
- [ ] Image placeholder on sagra detail page
- [ ] Cerca page: "TUTTE" province filter selected by default
- [ ] Responsive desktop layout (grid/sidebar per schermi grandi)
- [ ] Page transitions (Motion / View Transitions API)
- [ ] Micro-interazioni (hover effects, skeleton loaders, scroll animations)
- [ ] User authentication (Google OAuth, Magic Link) — deferred to v1.3+
- [ ] Preferiti / salva sagra — deferred to v1.3+
- [ ] Recensioni e foto utenti — deferred to v1.3+
- [ ] Expand to new scraper sources beyond the initial 5 — deferred to future

### Out of Scope

- Profili utente e gamification — richiede auth, premature
- Listing sponsorizzati / monetizzazione — prima validare con utenti reali
- Multi-LLM router — Gemini 2.5 Flash sufficiente, no need to complicate
- OCR locandine social — richiede multi-LLM router, deferred
- Notifiche push — richiede auth + infrastruttura, premature
- Cache ricerche — ottimizzazione prematura
- App nativa mobile — web app mobile-first è sufficiente
- Prenotazione tavoli — fuori scope, l'app mostra info

## Current Milestone: v1.2 "Polish"

**Goal:** Fix UX bugs and add polish — page transitions, responsive desktop layout, micro-interazioni — per un'esperienza premium su ogni device.

**Target features:**
- Fix 4 bug noti (back button, image placeholder, responsive, TUTTE default)
- Page transitions smooth tra le pagine
- Layout desktop curato (grid/sidebar)
- Micro-interazioni (hover, skeleton loaders, feedback tattile, scroll animations)

## Latest Milestone: v1.1 "Dati Reali" (Shipped 2026-03-07)

**Delivered:** All 5 scraper sources active with data quality filters producing 735 clean Veneto sagre.

## Context

### Current State

Shipped v1.1 with ~3,900 LOC TypeScript across 159 files.
Tech stack: Next.js 15 App Router, Supabase (PostgreSQL + PostGIS), Tailwind v4 + Shadcn/UI, Leaflet + OSM, Cheerio, Nominatim, Gemini 2.5 Flash, Motion (animations).
Deployed on Vercel at nemovia.vercel.app.

Pipeline: All 5 scraper sources active (eventiesagre, assosagre, solosagre, venetoinfesta, sagritaly). 735 clean active sagre. Enrichment runs 2x/day via pg_cron. Geocoding via Nominatim with location normalization. Noise title filtering and Veneto province gating in place.

Known UI issues being addressed in v1.2: back button on detail page, image placeholder on detail, responsive desktop layout, Cerca page default province filter.

### Il problema

Chi vuole trovare sagre nel weekend in Veneto deve visitare 5-8 siti diversi (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly, etc.), ognuno con dati parziali, interfacce datate, pubblicità invasive, nessuna geolocalizzazione, nessun filtro per tipo cucina.

### Concorrenza

Tutti i portali esistenti hanno gli stessi problemi: UX anni 2000, non mobile-first, dati frammentati. Nemovia risolve aggregando tutto in un'unica app moderna.

### Utente tipo

Laura, Cittadella (PD), venerdì sera. Vuole trovare una sagra per il weekend. Apre Nemovia, filtra per "Pesce" nella sua zona, trova la Sagra del Baccalà a Sandrigo, vede i dettagli, manda il link al marito su WhatsApp. 30 secondi.

### Tono

Italiano, informale ma competente. L'app deve sembrare curata, non un template.

## Constraints

- **Tech stack**: Next.js 15 App Router, TypeScript, Tailwind v4 + Shadcn/UI, Supabase (PostgreSQL + PostGIS), Leaflet + OSM, Cheerio, Nominatim, Gemini 2.5 Flash
- **Budget**: Zero costi fissi — tutti servizi free tier (Supabase, Gemini, Nominatim, Vercel, OSM)
- **LLM**: Solo Gemini 2.5 Flash, singolo provider, batch (15 req/min free tier)
- **Geocoding**: Nominatim con rate limit 1 req/sec
- **Deploy**: Vercel
- **Design**: Mobile-first obbligatorio, grafica premium (Motion animations)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase con PostGIS per geo-queries | Query spaziali native, RPC find_nearby_sagre, free tier generoso | ✓ Good — PostGIS RPCs power distance sorting, map queries, and nearby search |
| Generic scraper config-driven | Un unico scraper che legge selettori CSS dal DB per ogni fonte | ✓ Good — all 5 sources fixed with source-specific extraction branches |
| Gemini 2.5 Flash singolo provider | Free tier sufficiente per MVP, singolo integration point | ✓ Good — BATCH_SIZE=8, food/feature tags + descriptions working |
| Leaflet + OSM invece di Google Maps/Mapbox | Zero costi, nessuna API key | ✓ Good — map with clustering, popups, geolocation all working |
| Nominatim per geocoding | Gratuito, accurato per l'Italia, rate limit gestibile | ✓ Good — GEOCODE_LIMIT=30 per batch, fits in Edge Function timeout |
| LLM enrichment asincrono via cron | Disaccoppia scraping da enrichment | ✓ Good — independent retry, rate limit management |
| Shadcn/UI + Motion | Componenti base solidi + animazioni premium | ✓ Good — FadeIn/StaggerGrid wrappers, premium feel achieved |
| CDN URLs for Leaflet marker icons | Turbopack-safe, avoids broken static asset imports | ✓ Good — reliable across environments |
| nuqs for URL search params | Type-safe URL state management for filters | ✓ Good — clean filter persistence and sharing |
| Inline pure function copy for Deno Edge Functions | Deno can't import from Next.js src/ | ⚠️ Revisit — works but creates maintenance burden |
| next.config catch-all hostname ** for images | Unpredictable CDN domains from scraped sources | ✓ Good for MVP — revisit if security concerns arise |
| Source-specific extraction branches | Non-standard HTML layouts need keyed branches in extractRawEvent() | ✓ Good — scales to 5 sources without generic selector complexity |
| Cheerio for sagritaly (not headless) | sagritaly.com is server-rendered WordPress, not JS-rendered | ✓ Good — consistent approach, no headless browser needed |
| Noise title heuristic filter | Pattern matching (length, regex) instead of ML classification | ✓ Good — simple, fast, no dependencies |
| Location normalization + Veneto gating | Append ", Veneto" for disambiguation, deactivate non-Veneto after geocoding | ✓ Good — 36 dirty rows caught, 735 clean remaining |

---
*Last updated: 2026-03-07 after v1.2 milestone start*
