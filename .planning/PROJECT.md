# Nemovia

## What This Is

Un'app web che aggrega tutte le sagre ed eventi gastronomici del Veneto da 6+ siti diversi e li presenta in una UI moderna e d'impatto, mobile-first, con mappa interattiva, filtri, Netflix-style scroll rows, city search autocomplete, e dettagli condivisibili con menu e orari. Pipeline automatica con filtri heuristic, classificazione LLM, deduplicazione fuzzy, e Unsplash image fallback garantiscono dati puliti e immagini di alta qualità. Design system con Geist typography, OKLCH coral/teal palette, glassmorphism, full-width layout, custom logo, e footer professionale.

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
- ✓ Event count restored to 100+ active sagre with filter recalibration and new source -- v1.4
- ✓ No events outside Veneto (Nominatim viewbox + province gating) -- v1.4
- ✓ Non-sagre filtered out (whitelist-aware isNonSagraTitle) -- v1.4
- ✓ City names always display with provincia in parentheses -- v1.4
- ✓ Missing/low-res images replaced with themed Unsplash photos (pipeline-time) -- v1.4
- ✓ Full-bleed Unsplash food photo hero with white text overlay -- v1.4
- ✓ Netflix-style horizontal scroll rows (weekend, gratis, province, food type) -- v1.4
- ✓ City autocomplete search bar in hero with redirect to Cerca -- v1.4
- ✓ Full-width responsive desktop layout -- v1.4
- ✓ Custom SVG logo in navigation bar (coral/teal palette) -- v1.4
- ✓ Modern footer with credits "Fatto con cuore in Veneto" and Unsplash attribution -- v1.4
- ✓ Cerca page map view works correctly (filter sync) -- v1.4
- ✓ Mappa page has filter controls at top -- v1.4
- ✓ 6 SVG food type icons on cards and scroll row titles -- v1.4
- ✓ Source sites scraped for complete info (menu, orari, descriptions) -- v1.4
- ✓ itinerarinelgusto.it added as 6th scraper source -- v1.4

### Active

(None — planning next milestone)

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
- SwiperJS/Embla carousel -- CSS scroll-snap handles Netflix rows natively
- Nominatim autocomplete -- explicitly forbidden by usage policy, use static data
- unsplash-js SDK -- unnecessary wrapper, native fetch sufficient
- Runtime Unsplash API calls -- rate limit risk, pre-fetch at pipeline time only

## Previous Milestone: v1.4 "Esperienza Completa" (Shipped 2026-03-12)

**Delivered:** Complete product experience — restored data pipeline to 100+ events, Unsplash image quality at pipeline time, full-width layout with custom branding, Netflix-style discovery rows, city search autocomplete from 555 Veneto comuni, food type icons, map filter sync, and source-specific detail scraping for menu/orari/descriptions.

## Context

### Current State

Shipped v1.4 with ~7,700 LOC TypeScript/CSS across 92 files modified since v1.3.
Tech stack: Next.js 15 App Router, Supabase (PostgreSQL + PostGIS + pg_trgm), Tailwind v4 + Shadcn/UI, Leaflet + OSM, Cheerio, Nominatim, Gemini 2.5 Flash, Motion (LazyMotion + domMax), Unsplash API.
Deployed on Vercel at nemovia.it.

Pipeline: 6 scraper sources active (assosagre, venetoinfesta, solosagre, sagritaly, eventiesagre, itinerarinelgusto). Heuristic filters + LLM is_sagra classification + fuzzy dedup + Unsplash image assignment in pipeline. Detail scraping for menu/orari/descriptions. Scraping 2x/day, enrichment 2x/day, expire 1x/day via pg_cron.

UI: Geist font, coral/teal OKLCH palette, glassmorphism nav bars, full-bleed Unsplash photo hero, Netflix scroll rows with CSS scroll-snap and drag-to-scroll, city autocomplete, 6 SVG food type icons, custom logo, professional footer. Full-width layout with per-page containment. LazyMotion with m.* components.

### Known Issues

- Food type icons for "vino" and "dolci" use generic arrow/cursor fallback instead of thematic icons (wine glass, cake)
- Province count mismatch: clicking province count on homepage shows different number in results
- Search pill in hero is autocomplete but could be clearer
- image_credit column migration 012 not applied to remote DB
- Some low-quality images still visible

### Il problema

Chi vuole trovare sagre nel weekend in Veneto deve visitare 5-8 siti diversi (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly, etc.), ognuno con dati parziali, interfacce datate, pubblicita invasive, nessuna geolocalizzazione, nessun filtro per tipo cucina.

### Concorrenza

Tutti i portali esistenti hanno gli stessi problemi: UX anni 2000, non mobile-first, dati frammentati. Nemovia risolve aggregando tutto in un'unica app moderna.

### Utente tipo

Laura, Cittadella (PD), venerdi sera. Vuole trovare una sagra per il weekend. Apre Nemovia, filtra per "Pesce" nella sua zona, trova la Sagra del Baccala a Sandrigo, vede i dettagli, manda il link al marito su WhatsApp. 30 secondi.

### Tono

Italiano, informale ma competente. L'app deve sembrare curata, non un template.

## Constraints

- **Tech stack**: Next.js 15 App Router, TypeScript, Tailwind v4 + Shadcn/UI, Supabase (PostgreSQL + PostGIS + pg_trgm), Leaflet + OSM, Cheerio, Nominatim, Gemini 2.5 Flash, Unsplash API
- **Budget**: Zero costi fissi -- tutti servizi free tier (Supabase, Gemini, Nominatim, Vercel, OSM, Unsplash)
- **LLM**: Solo Gemini 2.5 Flash, singolo provider, batch (15 req/min free tier)
- **Geocoding**: Nominatim con rate limit 1 req/sec, viewbox bounded to Veneto
- **Deploy**: Vercel
- **Design**: Mobile-first obbligatorio, grafica premium (Geist + OKLCH + glassmorphism + Motion + Unsplash)

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
| Inline pure function copy for Deno Edge Functions | Deno can't import from Next.js src/ | ⚠️ Revisit -- growing maintenance burden (5 milestones) |
| Source-specific extraction branches | Non-standard HTML layouts need keyed branches | ✓ Good |
| Providers.tsx client wrapper | Single client component wrapping LazyMotion + MotionConfig + NuqsAdapter | ✓ Good |
| FrozenRouter for page transitions | Freeze LayoutRouterContext during AnimatePresence exit | ✓ Good |
| Heuristic filters for data quality | Regex/length patterns instead of ML classification for known noise | ✓ Good |
| LLM is_sagra piggybacking on enrichment | Zero additional API calls, add field to existing Gemini batch | ✓ Good |
| pg_trgm fuzzy dedup with GIN index | Similarity thresholds (0.6 title, 0.5 city) + date overlap | ✓ Good |
| Geist font + OKLCH coral/teal palette | Modern aesthetic, high chroma, cool neutrals | ✓ Good |
| Literal OKLCH in glass CSS utilities | Avoid backdrop-filter composition issues with CSS vars | ✓ Good |
| LazyMotion with domMax + strict mode | ~28KB savings, runtime leak detection | ✓ Good |
| Unsplash pipeline-time image assignment | Pre-fetch at scrape/enrich time, never runtime (50 req/hr demo tier) | ✓ Good |
| Full-width-by-default layout | Main has no max-w, pages opt into containment via wrapper divs | ✓ Good |
| CSS scroll-snap for Netflix rows | Native momentum, no JS carousel library needed | ✓ Good |
| Static veneto-comuni.json for autocomplete | Zero Nominatim API calls, 555 comuni, instant client-side filtering | ✓ Good |
| Priority-based food icon mapping | Deterministic category: carne > pesce > zucca > gnocco > verdura > altro | ✓ Good |
| Source-specific detail extractors | Cheerio extractors per source for menu/orari/descriptions | ✓ Good |
| NULL-only update pattern for details | Never overwrite existing detail content, preserves curated/LLM content | ✓ Good |

---
*Last updated: 2026-03-12 after v1.4 milestone*
