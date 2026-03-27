# Architettura Nemovia — Riferimento Tecnico

> Aggregatore sagre del Veneto. Ultimo aggiornamento: 2026-03-16.

---

## 1. Stack & Dipendenze

| Layer | Tecnologia | Versione |
|-------|-----------|----------|
| Framework | Next.js (App Router, Server Components, Turbopack) | 15.5.12 |
| UI | React + TypeScript | 19.1.0 / TS 5 |
| Styling | TailwindCSS v4 + Tailwind Merge | 4.x |
| Animazioni | Motion (Framer Motion) con LazyMotion strict | 12.35 |
| URL State | nuqs | 2.8.9 |
| Mappe | Leaflet + react-leaflet | 1.9.4 / 5.0.0 |
| Componenti UI | Shadcn/UI + Radix-UI + Lucide-react | 0.577 |
| Backend/DB | Supabase (PostGIS + pg_trgm) | supabase-js 2.98.0 |
| API esterne | Unsplash + Pexels (immagini), Pexels (video), Google Gemini (LLM), Nominatim (geocoding), Tavily (discovery) | |
| Scraping esterno | GitHub Actions (cron per script Node.js: Facebook, Tavily) | |
| Test | Vitest, ESLint 9 | 4.0.18 |

---

## 2. Struttura Cartelle

```
src/
├── app/
│   ├── (main)/
│   │   ├── page.tsx                  # Homepage
│   │   ├── layout.tsx                # Layout (TopNav, Footer, BottomNav)
│   │   ├── template.tsx              # Wrapper transizioni
│   │   ├── cerca/page.tsx            # Ricerca con filtri
│   │   ├── mappa/
│   │   │   ├── page.tsx              # Mappa (RSC server fetch)
│   │   │   └── MappaClientPage.tsx   # Client component Leaflet
│   │   └── sagra/[slug]/
│   │       ├── page.tsx              # Dettaglio sagra
│   │       └── opengraph-image.tsx   # OG image dinamica
│   ├── layout.tsx                    # Root layout (Providers, font, metadata)
│   ├── globals.css                   # Tailwind + CSS vars brand
│   ├── robots.ts, sitemap.ts
│
├── components/
│   ├── Providers.tsx                 # LazyMotion + MotionConfig + NuqsAdapter
│   ├── animations/                   # ParallaxHero, FadeImage, ScrollReveal
│   ├── brand/                        # Logo.tsx, NemoviaIcon.tsx
│   ├── detail/                       # SagraDetail, DetailMiniMap, BackButton, ShareButton
│   ├── home/                         # HeroSection, ScrollRow, ScrollRowSection, QuickFilters
│   ├── layout/                       # TopNav, Footer, BottomNav
│   ├── map/                          # MapView, MapGestureHandler, MapMarkerPopup
│   ├── sagra/                        # SagraCard, FoodIcon, SagraGrid
│   ├── search/                       # SearchFilters, SearchResults, ActiveFilters
│   └── ui/                           # Primitive Shadcn
│
├── lib/
│   ├── constants/
│   │   ├── food-icons.tsx            # Tag cibo → icona Lucide + colore
│   │   ├── veneto.ts                 # Province, quick filters, costanti
│   │   └── veneto-comuni.ts          # Autocomplete comuni (statico, zero API)
│   ├── enrichment/
│   │   ├── geocode.ts                # Integrazione Nominatim
│   │   └── llm.ts                    # Template prompt Gemini
│   ├── scraper/
│   │   ├── types.ts, normalize.ts, date-parser.ts, filters.ts
│   ├── supabase/
│   │   ├── server.ts                 # Client SSR (con cookies)
│   │   └── client.ts                 # Client browser
│   ├── queries/
│   │   ├── sagre.ts                  # Tutte le query Supabase
│   │   └── types.ts                  # SagraCardData, MapMarkerData, SearchFilters
│   ├── unsplash.ts                   # Client API Unsplash
│   ├── hero-videos.ts                # Video hero curati
│   ├── fallback-images.ts            # 5 immagini fallback per categoria
│   ├── map-markers.ts                # SVG marker tematici (pin 40x56px)
│   ├── pexels-video.ts              # Client API Pexels
│   ├── motion-features.ts            # Feature bundle per LazyMotion
│   └── utils.ts
│
└── types/database.ts                 # Tipi generati da Supabase

supabase/
├── functions/
│   ├── scrape-sagre/index.ts         # Scraper principale (6 fonti Cheerio)
│   ├── enrich-sagre/index.ts         # Pipeline arricchimento 3 passi
│   ├── scrape-sagretoday/index.ts    # Round-robin per provincia
│   ├── scrape-trovasagre/index.ts    # API JSON singola
│   └── scrape-sagriamo/index.ts      # API JSON paginata
└── migrations/001-021                # Migrazioni SQL
```

---

## 3. Database Schema

### Tabella `sagre`

| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID PK | Default gen_random_uuid() |
| title | TEXT | Titolo originale |
| slug | TEXT UNIQUE | URL-friendly, generato |
| location_text | TEXT | Testo libero località |
| location | geography(POINT,4326) | Coordinate PostGIS |
| province | TEXT | Codice 2 lettere (VI, PD, TV...) |
| start_date | DATE | Inizio evento |
| end_date | DATE | Fine evento (nullable) |
| description | TEXT | Descrizione originale |
| enhanced_description | TEXT | Descrizione arricchita da Gemini |
| food_tags | TEXT[] | Es. ["vino", "carne", "dolci"] |
| feature_tags | TEXT[] | Es. ["giostre", "musica_live"] |
| image_url | TEXT | URL Unsplash assegnata in pipeline |
| image_credit | TEXT | Attribuzione fotografo |
| source_url | TEXT | URL pagina sorgente |
| is_free | BOOLEAN | Ingresso gratuito |
| price_info | TEXT | Dettagli prezzo |
| status | TEXT | `pending_geocode` / `pending_llm` / `enriched` / `geocode_failed` |
| content_hash | TEXT | Per deduplicazione |
| source_id | UUID FK | Riferimento a scraper_sources |
| sources | TEXT[] | Nomi fonti multiple |
| is_active | BOOLEAN | Evento ancora valido |
| normalized_title | TEXT | Per dedup applicativo |
| unsplash_query | TEXT | Query generata da Gemini per Unsplash |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabella `scraper_sources`

| Colonna | Tipo | Note |
|---------|------|------|
| name | TEXT | Nome fonte (es. "assosagre") |
| base_url | TEXT | URL base sito |
| selector_* | TEXT | Selettori CSS per Cheerio |
| url_pattern | TEXT | Pattern URL da scrapare |
| max_pages | INT | Limite paginazione |
| is_active | BOOLEAN | Fonte attiva |
| consecutive_failures | INT | Contatore errori consecutivi |

### Indici

- **GIST** su `location` (query spaziali)
- **B-tree** su `status`, `start_date`, `end_date`, `province`, `slug`, `is_active`

### Funzioni RPC

| Funzione | Scopo |
|----------|-------|
| `find_duplicate_sagra()` | Dedup in fase scraping (content_hash + fuzzy title) |
| `find_nearby_sagre()` | Sagre vicine per dettaglio (PostGIS ST_DWithin) |
| `count_sagre_by_province()` | Conteggi per homepage con dedup |
| `normalize_text()` | Normalizzazione testo per confronti |

### Cron Jobs (pg_cron)

| Job | Orario | Funzione |
|-----|--------|----------|
| expire-sagre-daily | 01:00 | Disattiva sagre passate (grace 30gg senza end_date) |
| scrape-sagre | 06:00, 18:00 | Scraper principale 6 fonti |
| enrich-sagre | 06:30, 18:30 | Pipeline arricchimento |
| scrape-sagretoday | Ogni 30 min | 1 provincia a rotazione (7 totali) |
| scrape-trovasagre | 07:15, 19:15 | Fonte trovasagre |
| scrape-sagriamo | 07:20, 19:20 | Fonte sagriamo |
| scrape-cheventi | 08:00, 20:00 | Fonte cheventi.it (JSON-LD con GPS) |
| scrape-insagra | 07:35, 19:35 | Fonte insagra.it (JSON-LD con GPS, paginated) |

### GitHub Actions Cron (`.github/workflows/scrape-external.yml`)

| Job | Orario | Script |
|-----|--------|--------|
| scrape-facebook | 08:00 UTC daily | `scripts/scrape-facebook.mjs` |
| discover-tavily | 10:00 UTC ogni 3 giorni | `scripts/discover-tavily.mjs` |

> **REGOLA**: Script che non possono girare come Edge Function (dipendenze npm non-Deno come axios) vanno in GitHub Actions, MAI come script locali sul PC dello sviluppatore. Il sito deve funzionare anche a PC spento.

---

## 4. Edge Functions

### scrape-sagre (~1500 LOC)
- Scorre 6 fonti Cheerio configurate in `scraper_sources`
- Selettori CSS dal DB (titolo, data, luogo, descrizione, immagine)
- Deduplicazione via `find_duplicate_sagra()` RPC
- Inserisce con `status: 'pending_geocode'`

### enrich-sagre (~2000 LOC)
Pipeline 3 passi con budget temporale 120s:
1. **Pass 1 — Geocoding**: Nominatim (location_text → coordinate + provincia)
2. **Pass 2 — LLM**: Gemini 2.5 Flash-Lite genera food_tags, feature_tags, enhanced_description, unsplash_query
3. **Pass 3 — Immagini**: Unsplash API usando unsplash_query di Gemini

### scrape-sagretoday
- Round-robin time-based: 1 provincia per invocazione
- Ogni 30 min cicla tutte le 7 province venete
- Estrazione dati da JSON-LD delle pagine

### scrape-trovasagre
- Singolo endpoint JSON API
- Una chiamata = tutte le sagre Veneto

### scrape-sagriamo
- API JSON paginata
- Scorre tutte le pagine disponibili

### scrape-cheventi
- JSON-LD con coordinate GPS (skip geocoding → `status: pending_llm`)
- 7 province Veneto in una sola invocazione
- Filtro `isFoodEvent()` per escludere concerti/mostre/teatro

### scrape-insagra
- Listing pages paginate (5 pagine, ~41 eventi Veneto)
- Per ogni evento: fetch detail page → parse JSON-LD Event
- GPS coordinates incluse → `status: pending_llm` (skip geocoding)
- Province estratte da URL path (`/veneto/{province}/...`)
- Filtri: isNoiseTitle, isNonSagraTitle, containsPastYear, past event date check

> **Nota**: le Edge Function usano copie inline delle funzioni pure (Deno non importa da `src/`). Timeout: 60s (free) / 150s (pro).

### Script Node.js (GitHub Actions)

#### scrape-facebook.mjs
- Usa `facebook-event-scraper` npm (axios, non Deno-compatibile)
- Scrapa pagine Facebook pubbliche Pro Loco venete
- Dedup via `find_duplicate_sagra()` RPC
- Resa bassa: pagine Pro Loco usano poco Facebook Events

#### discover-tavily.mjs
- Tavily Search API (1000 crediti/mese free, 14 crediti per run)
- Cerca "sagra festa enogastronomica {provincia} Veneto {mese} {anno}"
- Filtra risultati: solo titoli con keyword food
- Discovery layer: trova sagre su siti non scrappati (blog, Pro Loco, giornali)

---

## 5. Pagine & Route

### `/` — Homepage
- **Dati**: sagre weekend (20), pool attive (200), conteggi province, video hero
- **Sezioni**: HeroSection → QuickFilters → ScrollRow weekend → ScrollRow gratis → 3 righe province (top 3) → 4 righe food (top 4)
- Video hero: 5 locali curati + Pexels API (tema sagra, poi citta, poi provincia)

### `/cerca` — Ricerca
- **Layout**: sidebar filtri (desktop), top filtri (mobile)
- **Filtri**: provincia, food_tags, feature_tags, date range, is_free, citta+raggio (slider Airbnb)
- **State**: nuqs URL params (persistenza e condivisione)

### `/mappa` — Mappa Interattiva
- **Dati**: tutte le sagre attive con coordinate
- Leaflet con marker cluster, pin tematici SVG (40x56px)
- MapGestureHandler: "Usa due dita" su mobile
- Click marker → popup con foto, titolo, date, "Vedi dettagli"

### `/sagra/[slug]` — Dettaglio
- **Dati**: sagra singola + sagre vicine (PostGIS)
- ParallaxHero con immagine/video
- Sezioni: descrizione, menu, orari, mini-mappa, sagre correlate
- OG image dinamica generata server-side

---

## 6. Componenti Chiave

### ScrollRow
- **Mobile**: puro CSS `snap-x snap-mandatory` + `snap-start`. Zero JS handlers.
- **Desktop**: drag JS + frecce + **calamita** (snap magnetico a sinistra al rilascio)
- Discriminazione: `window.matchMedia("(pointer: fine)")`
- Click fix: `setPointerCapture` ritardato dopo 5px di drag (mai su pointerdown)
- `snapToNearest()`: trova card piu vicina e `scrollTo` smooth

### ParallaxHero
- Parallax 30px + fade opacity 70-100% scroll progress
- Desktop: layout sticky, nessun parallax, nessun cambio opacita

### SagraCard
- Immagine con gradient overlay scuro (`from-black/85 via-40%`)
- Icona food in cerchio bianco (`bg-white/60`, icona colorata)
- Provincia sempre visibile: "Zugliano (VI)"

### FoodIcon
- Priorita categorie: carne > pesce > zucca > gnocco > verdura > vino > dolci > altro
- Fallback da titolo sagra (broccol→verdura, zucca→zucca, etc.)
- Icone Lucide: Leaf (verdura), UtensilsCrossed (altro), Wine (vino), Drumstick (carne), etc.

### MapView
- Dynamic import `ssr: false` (Leaflet richiede window)
- Pin SVG tematici: teardrop 40x56px + icona food bianca, scale 0.83
- Cache per categoria (8 `L.divIcon` totali)
- `MapGestureHandler` su mobile e `DetailMiniMap`

---

## 7. Pipeline Dati

```
  SCRAPING                    ENRICHMENT                      DISPLAY
┌──────────┐   ┌─────────────────────────────────────┐   ┌───────────┐
│ 6 Cheerio │──▶│ Pass 1: Geocoding (Nominatim)       │──▶│ Server    │
│ 3 API     │   │ Pass 2: LLM (Gemini → tags, query)  │   │ Components│
│ ─────────▶│   │ Pass 3: Immagini (Unsplash API)     │   │ → RSC     │
│ Dedup     │   │ Budget: 120s totali                  │   │ → SSR     │
│(hash+RPC) │   └─────────────────────────────────────┘   └───────────┘
└──────────┘        status:                                Dedup titolo
 9 fonti         pending_geocode                          applicativo
                 → pending_llm
                 → enriched
```

**9 fonti**: assosagre, venetoinfesta, solosagre, sagritaly, eventiesagre, itinerarinelgusto, sagretoday, trovasagre, sagriamo

**Flusso status**: `pending_geocode` → `pending_llm` → `enriched` (o `geocode_failed`)

**Deduplicazione**: doppio livello — content_hash + RPC fuzzy in DB, normalized_title in applicazione.

**Immagini**: Gemini genera `unsplash_query` specifico (es. "olive oil food"), Pass 3 cerca su Unsplash. 5 fallback per categoria se API fallisce.

---

## 8. Pattern & Convenzioni

### Architettura
- **Server Components di default**, `"use client"` solo quando serve (interazione, hooks browser)
- **Nessun data fetching client-side**: tutto via RSC + Supabase RPC
- **Edge Functions**: copie inline delle funzioni pure (Deno non importa da `src/`)
- **NULL-only update**: detail scraping aggiorna solo campi NULL

### Styling
- **Brand colors via CSS variables**: `--brand-l`, `--brand-c`, `--brand-h` (OKLCH). Cambio 3 valori = reskin intero sito.
- Palette: primary bordeaux `oklch(0.42 0.19 358)`, accent teal `oklch(0.600 0.155 185)`
- Glass utilities: `glass-nav`, `glass-overlay` con valori OKLCH letterali
- Logo SVG bordeaux: `#9B1B30`, `#5C0E28`, `#7A2840`

### Animazioni
- `LazyMotion` strict con feature bundle separato (`motion-features.ts`)
- Componenti `m.*` da `motion/react-m`, hooks da `motion/react`

### URL State
- `nuqs` per tutti i filtri di ricerca — persistenza URL, condivisibilita, SSR-safe

### Query Spaziali
- PostGIS `ST_DWithin` per ricerca per raggio da citta
- Geocoding citta via Nominatim → coordinate → query spaziale

### Autocomplete
- `veneto-comuni.ts`: file statico JSON con tutti i comuni veneti (zero chiamate API)

### Icone
- **Sempre Lucide React** — mai SVG disegnati a mano
- Giostre: solo `feature_tag` nel DB, mai icona su card (illeggibile a 16px)

---

## 9. Environment & Deploy

### Variabili d'ambiente

| Variabile | Dove | Scopo |
|-----------|------|-------|
| NEXT_PUBLIC_SUPABASE_URL | .env + Vercel | URL progetto Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | .env + Vercel | Chiave anonima Supabase |
| UNSPLASH_ACCESS_KEY | .env + Vercel | API Unsplash (immagini) |
| PEXELS_API_KEY | .env + Vercel + Supabase secrets | API Pexels (video hero + immagini fallback) |
| TAVILY_API | .env + GitHub Secrets | API Tavily (discovery sagre) |
| gemini_api_key | Supabase secrets | Per Edge Functions (Gemini LLM) |
| project_url | Supabase secrets | Per pg_cron invocazioni |
| anon_key | Supabase secrets | Per pg_cron autenticazione |

### Deploy

- **Frontend**: Vercel (build automatico da push su master)
- **Backend**: Supabase progetto `lswkpaakfjtxeroutjsb`
- **Dominio**: nemovia.it (custom domain su Vercel)
- **Edge Functions deploy**: `npx supabase functions deploy <nome-funzione>`
- **Migrazioni**: `npx supabase db push` oppure SQL Editor

### Note operative
- `.env` in `.gitignore` — mai committato
- `npx supabase functions invoke` **non funziona** — usare curl + service_role_key oppure SQL Editor con `net.http_post()`
- Edge Functions timeout: 60s (free) / 150s (pro)

### Strategia anti-timeout Edge Functions
Il free tier Supabase ha timeout 60s. Per non sforare:
1. **1 function per fonte** — ogni scraper è una edge function separata (scrape-sagre per le 6 fonti Cheerio, scrape-sagretoday, scrape-trovasagre, scrape-sagriamo). MAI accorpare scraper pesanti.
2. **Batch limitati** — enrich-sagre processa max 200 sagre per run. Pass 2 (Gemini 2.5 Flash-Lite, 1000 RPD free tier) usa batch da 10 con rate limiting 4.5s tra batch. Pass 3 (Unsplash) raggruppa per query per minimizzare API calls.
3. **Round-robin cron** — scrape-sagretoday fa 1 provincia per invocazione (7 province, round-robin ogni 30min). Così ogni invocazione sta sotto i 60s.
4. **Time budget** — enrich-sagre ha `TIME_BUDGET_MS = 120_000` (120s). Il timeout reale del free tier risulta ≥150s (verificato: function completata a 124s senza kill). Se sfora il budget, si ferma e riprende al prossimo ciclo cron. **Piano Supabase: FREE** (timeout effettivo ≥150s).
5. **Cron frequenti** — enrich gira 2x/day, scrape 2x/day, sagretoday ogni 30min. Tanti run piccoli > pochi run grandi.
6. **Trigger manuale** — per testare: usare il pulsante TEST nel dashboard Supabase, oppure curl. `npx supabase functions invoke` NON funziona.
