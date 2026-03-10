# Nemovia

## What This Is

Un'app web che aggrega tutte le sagre ed eventi gastronomici del Veneto da 5+ siti diversi e li presenta in una UI moderna e d'impatto, mobile-first, con mappa interattiva, filtri, e dettagli condivisibili. Pipeline automatica con filtri heuristic, classificazione LLM, e deduplicazione fuzzy garantiscono dati puliti. Design system con Geist typography, OKLCH coral/teal palette, glassmorphism, mesh gradients, e bento grid layout.

## Core Value

Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.

## Requirements

### Validated

- ✓ Scraping automatico da 5+ siti di sagre del Veneto -- v1.0
- ✓ Generic scraper config-driven con selettori CSS da DB -- v1.0
- ✓ Geocoding automatico citta -> coordinate via Nominatim -- v1.0
- ✓ LLM auto-tagging con Gemini 2.5 Flash -- v1.0
- ✓ LLM arricchimento descrizioni max 250 char -- v1.0
- ✓ Homepage con hero, sagre del weekend, quick filters, card grid -- v1.0
- ✓ SagraCard con immagine, titolo, citta, date, food tags, prezzo, distanza -- v1.0
- ✓ Mappa interattiva fullscreen con Leaflet + OSM, marker cluster, popup -- v1.0
- ✓ Pagina ricerca con filtri: provincia, raggio km, date, gratis/pagamento, tipo cucina -- v1.0
- ✓ Toggle lista/mappa nella ricerca -- v1.0
- ✓ "Vicino a me" con geolocalizzazione browser -- v1.0
- ✓ Dettaglio sagra: info pratiche, mini mappa, condivisione link, indicazioni Google Maps -- v1.0
- ✓ Cron jobs: scraping 2x/giorno, enrichment 2x/giorno, expire eventi passati -- v1.0
- ✓ SEO: metadata dinamici, sitemap, OG image per ogni sagra -- v1.0
- ✓ UI grafica modernissima con Shadcn/UI + Motion -- v1.0
- ✓ Mobile-first con BottomNav (Home/Cerca/Mappa) -- v1.0
- ✓ Deploy su Vercel -- v1.0
- ✓ All 5 scraper sources active -- v1.1
- ✓ Data quality: noise title detection, location normalization, Veneto province gating -- v1.1
- ✓ Responsive desktop layout with TopNav, multi-column grids, side-by-side detail -- v1.2
- ✓ Page transitions, micro-interactions, scroll animations -- v1.2
- ✓ Accessibility foundation (reduced-motion, focus-visible) -- v1.2
- ✓ Heuristic filters: noise titles, calendar spam, excessive duration, past-year events -- v1.3
- ✓ Retroactive production data cleanup (deactivate violating records) -- v1.3
- ✓ LLM is_sagra classification (zero additional API calls) -- v1.3
- ✓ pg_trgm fuzzy deduplication (title + city similarity + date overlap) -- v1.3
- ✓ Image URL upgrade (source-specific thumbnail -> full resolution) -- v1.3
- ✓ Branded placeholder for missing images -- v1.3
- ✓ Geist font + coral/teal OKLCH palette replacing amber/stone -- v1.3
- ✓ All Shadcn tokens + hardcoded colors migrated to new palette -- v1.3
- ✓ Glassmorphism nav bars and floating overlays -- v1.3
- ✓ Mesh gradient hero + image-overlay SagraCard + bento grid homepage -- v1.3
- ✓ LazyMotion migration (~28KB initial JS reduction) -- v1.3

### Active

<!-- v1.4 Esperienza Completa -->
- [ ] Netflix-style horizontal scroll rows (mix smart: weekend, vicino a te, tipo cucina, provincia)
- [ ] Hero con foto sagra Unsplash API + testo bianco "SCOPRI LE SAGRE DEL VENETO"
- [ ] Search bar home → autocomplete città → redirect Cerca con città + slider raggio km
- [ ] Layout full-width responsive desktop
- [ ] Footer completo con credits "Fatto con cuore in Veneto"
- [ ] Logo SVG custom (Geist + icona stilizzata coral/teal)
- [ ] Fix mappa pagina Cerca non funzionante
- [ ] Filtri in cima alla pagina Mappa dedicata
- [ ] Fix placeholder immagini brandizzato non visibile
- [ ] Immagini low-res → fallback Unsplash a tema (NO bassa risoluzione mai)
- [ ] Sempre provincia tra parentesi dopo nome città (es. "Zugliano (VI)")
- [ ] Scrape info complete dalle fonti (menu, orari, descrizioni)
- [ ] Fix eventi fuori Veneto (San Miniato Toscana)
- [ ] Fix non-sagre ancora presenti (Passeggiata, Carnevale)
- [ ] Investigare calo drastico eventi (26 vs 735) e cercare nuove fonti scraping

### Out of Scope

- Profili utente e gamification -- richiede auth, premature
- Listing sponsorizzati / monetizzazione -- prima validare con utenti reali
- Multi-LLM router -- Gemini 2.5 Flash sufficiente
- OCR locandine social -- richiede multi-LLM router, deferred
- Notifiche push -- richiede auth + infrastruttura, premature
- Cache ricerche -- ottimizzazione prematura
- App nativa mobile -- web app mobile-first sufficiente
- Prenotazione tavoli -- fuori scope, l'app mostra info
- Dark mode -- singolo tema sofisticato sufficiente
- Neo-brutalism -- non coerente con estetica premium
- 3D elements (Three.js) -- overhead bundle eccessivo per zero-cost constraint
- Recensioni e foto utenti -- premature, prima validare con utenti reali

## Current Milestone: v1.4 "Esperienza Completa"

**Goal:** Trasformare Nemovia da prototipo a prodotto completo — Netflix scroll rows, hero fotografico, city search con raggio, full-width layout, logo, footer, e fix critici su dati e UX.

**Target features:**
- Netflix-style scroll rows (mix smart) in homepage
- Hero fotografico Unsplash + city search autocomplete con slider raggio
- Logo SVG custom + footer completo
- Full-width responsive desktop
- Data quality: fix Veneto gating, non-sagre, calo eventi, nuove fonti, scraping completo
- UX fixes: mappa Cerca, filtri Mappa, placeholder immagini, provincia sempre visibile

## Previous Milestone: v1.3 "Dati Puliti + Redesign" (Shipped 2026-03-10)

**Delivered:** Data quality overhaul + UI/UX redesign -- heuristic filters, LLM classification, fuzzy dedup, Geist/OKLCH palette, glassmorphism, mesh gradients, bento grid, and LazyMotion performance optimization.

## Context

### Current State

Shipped v1.3 with ~5,100 LOC TypeScript/CSS across 34 source files modified.
Tech stack: Next.js 15 App Router, Supabase (PostgreSQL + PostGIS + pg_trgm), Tailwind v4 + Shadcn/UI, Leaflet + OSM, Cheerio, Nominatim, Gemini 2.5 Flash, Motion (LazyMotion + domMax).
Deployed on Vercel at nemovia.it.

Pipeline: 5 scraper sources active. Heuristic filters (noise, calendar, duration, past-year) + LLM is_sagra classification + fuzzy dedup in pipeline. Enrichment + scraping run 2x/day via pg_cron.

UI: Geist font, coral/teal OKLCH palette, glassmorphism nav bars, mesh gradient hero, image-overlay SagraCard, bento grid homepage with featured card, LazyMotion (m.* components, ~28KB savings). Responsive desktop layout. Full accessibility support.

### Il problema

Chi vuole trovare sagre nel weekend in Veneto deve visitare 5-8 siti diversi (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly, etc.), ognuno con dati parziali, interfacce datate, pubblicita invasive, nessuna geolocalizzazione, nessun filtro per tipo cucina.

### Concorrenza

Tutti i portali esistenti hanno gli stessi problemi: UX anni 2000, non mobile-first, dati frammentati. Nemovia risolve aggregando tutto in un'unica app moderna.

### Utente tipo

Laura, Cittadella (PD), venerdi sera. Vuole trovare una sagra per il weekend. Apre Nemovia, filtra per "Pesce" nella sua zona, trova la Sagra del Baccala a Sandrigo, vede i dettagli, manda il link al marito su WhatsApp. 30 secondi.

### Tono

Italiano, informale ma competente. L'app deve sembrare curata, non un template.

## Constraints

- **Tech stack**: Next.js 15 App Router, TypeScript, Tailwind v4 + Shadcn/UI, Supabase (PostgreSQL + PostGIS + pg_trgm), Leaflet + OSM, Cheerio, Nominatim, Gemini 2.5 Flash
- **Budget**: Zero costi fissi -- tutti servizi free tier (Supabase, Gemini, Nominatim, Vercel, OSM)
- **LLM**: Solo Gemini 2.5 Flash, singolo provider, batch (15 req/min free tier)
- **Geocoding**: Nominatim con rate limit 1 req/sec
- **Deploy**: Vercel
- **Design**: Mobile-first obbligatorio, grafica premium (Geist + OKLCH + glassmorphism + Motion)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase con PostGIS per geo-queries | Query spaziali native, RPC find_nearby_sagre, free tier generoso | ✓ Good |
| Generic scraper config-driven | Un unico scraper che legge selettori CSS dal DB per ogni fonte | ✓ Good |
| Gemini 2.5 Flash singolo provider | Free tier sufficiente, singolo integration point | ✓ Good |
| Leaflet + OSM invece di Google Maps/Mapbox | Zero costi, nessuna API key | ✓ Good |
| Nominatim per geocoding | Gratuito, accurato per l'Italia, rate limit gestibile | ✓ Good |
| LLM enrichment asincrono via cron | Disaccoppia scraping da enrichment | ✓ Good |
| Shadcn/UI + Motion | Componenti base solidi + animazioni premium | ✓ Good |
| nuqs for URL search params | Type-safe URL state management for filters | ✓ Good |
| Inline pure function copy for Deno Edge Functions | Deno can't import from Next.js src/ | ⚠️ Revisit -- growing maintenance burden (4+ milestones) |
| Source-specific extraction branches | Non-standard HTML layouts need keyed branches | ✓ Good |
| Providers.tsx client wrapper | Single client component wrapping LazyMotion + MotionConfig + NuqsAdapter | ✓ Good |
| FrozenRouter for page transitions | Freeze LayoutRouterContext during AnimatePresence exit | ✓ Good |
| Heuristic filters for data quality | Regex/length patterns instead of ML classification for known noise | ✓ Good -- simple, fast, catches all known patterns |
| LLM is_sagra piggybacking on enrichment | Zero additional API calls, add field to existing Gemini batch | ✓ Good -- no cost increase |
| pg_trgm fuzzy dedup with GIN index | Similarity thresholds (0.6 title, 0.5 city) + date overlap | ✓ Good -- catches duplicates without false positives |
| Geist font + OKLCH coral/teal palette | Modern aesthetic, high chroma, cool neutrals | ✓ Good -- transformed visual identity |
| Literal OKLCH in glass CSS utilities | Avoid backdrop-filter composition issues with CSS vars | ✓ Good -- consistent glass rendering |
| LazyMotion with domMax + strict mode | ~28KB savings, runtime leak detection | ✓ Good -- significant performance win |
| Bento grid with featured card | First weekend sagra as featured, no DB change needed | ✓ Good -- editorial feel without complexity |

---
*Last updated: 2026-03-10 after v1.4 milestone started*
