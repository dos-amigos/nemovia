# CLAUDE.md — App Sagre Veneto (MVP)
# ═══════════════════════════════════════════
# Prompt per sviluppo assistito — lo sviluppatore guida, Claude Code esegue.
# Incolla questo in Claude Code come contesto iniziale.
# Poi dai comandi fase per fase.
# ═══════════════════════════════════════════

## COS'È QUESTA APP

Un'app web che aggrega tutte le sagre ed eventi gastronomici del Veneto da 5+ siti diversi e li mostra in una UI moderna, mobile-first, con mappa e filtri.

**L'MVP fa una cosa sola:** mostrare tutte le sagre del Veneto — dove sono, quando sono, cosa offrono. Con mappa, filtri per tipo cucina/ingrediente, geolocalizzazione. Niente login, niente recensioni. Scraping + LLM tagging/arricchimento batch + listing + mappa.

### Esempio d'uso
Laura, Cittadella (PD), venerdì sera. Apre l'app. Vede "Sagre questo weekend". Filtra per "Pesce" → trova la Sagra del Baccalà a Sandrigo. Tocca → vede date, orari, indirizzo, mappa. Copia il link, lo manda al marito. Fine.

### Tono dell'App
- Italiano, informale ma competente
- Mobile-first, niente pubblicità
- Card visive, mappa interattiva
- Colori caldi (arancione/ambra + verde oliva)

### Design e Frontend
L'app DEVE avere una grafica modernissima, non il classico look generico da template.
Stack UI: **Shadcn/UI** (base componenti) + **Magic UI** (micro-animazioni, componenti "wow" tipo animated cards, shimmer borders, gradient backgrounds) + **Framer Motion** (page transitions fluide, scroll-triggered animations, hover effects) + **ReactBits** (reactbits.dev — componenti decorativi moderni, text effects, animated backgrounds).
Installa: `framer-motion`, `magic-ui` (o copia i componenti da magicui.design), cerca componenti adatti su reactbits.dev.
Obiettivo: quando l'utente apre l'app deve pensare "questa non sembra un sito fatto con un template". Animazioni sottili ma presenti: card che appaiono con fade-in dallo scroll, filtri che si espandono con spring animation, mappa che si carica con transizione fluida, shimmer sulle card durante il loading. Ispirazione: app come Airbnb, TheFork, ma con personalità propria.

---

## STACK

- **Next.js 14+** (App Router, TypeScript)
- **Tailwind CSS + Shadcn/UI**
- **Supabase** (PostgreSQL + PostGIS)
- **Leaflet + OpenStreetMap** (mappa gratis)
- **Cheerio** (scraping)
- **Nominatim** (geocoding gratis)
- **Gemini 2.5 Flash** (LLM: arricchimento descrizioni + auto-tagging, solo batch)
- **Vercel** (deploy)

Non servono: Google Maps APIs, Auth, Mapbox, multi-LLM router.

---

## SCHEMA DATABASE

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TYPE event_source AS ENUM (
  'sagreitaliane', 'eventiesagre', 'solosagre', 'tuttofesta',
  'sagritaly', 'sagreeborghi', 'assosagre', 'itinerarinelgusto',
  'paesionline', 'manual'
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  source event_source NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT NOT NULL,
  location_coords GEOGRAPHY(POINT, 4326) NOT NULL,
  city TEXT NOT NULL,
  province TEXT,
  address TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  is_free BOOLEAN DEFAULT FALSE,
  price_info TEXT,
  website_url TEXT,
  image_url TEXT,
  food_tags TEXT[] DEFAULT '{}',
  feature_tags TEXT[] DEFAULT '{}',
  -- LLM enrichment (Gemini 2.5 Flash, batch)
  enriched_description TEXT,          -- Descrizione generata da LLM
  is_enriched BOOLEAN DEFAULT FALSE,
  is_tagged BOOLEAN DEFAULT FALSE,
  source_url TEXT,
  raw_data JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  scraped_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.scraping_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  region_url_template TEXT,
  selectors JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_successful_scrape TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_coords ON public.events USING GIST(location_coords);
CREATE INDEX idx_events_dates ON public.events (start_date, end_date) WHERE is_active = TRUE;
CREATE INDEX idx_events_province ON public.events (province) WHERE is_active = TRUE;
CREATE INDEX idx_events_food_tags ON public.events USING GIN(food_tags);
CREATE INDEX idx_events_title_trgm ON public.events USING GIN(title gin_trgm_ops);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events: read all" ON public.events FOR SELECT USING (TRUE);
CREATE POLICY "Events: write service" ON public.events FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Events: update service" ON public.events FOR UPDATE USING (TRUE);
CREATE POLICY "Events: delete service" ON public.events FOR DELETE USING (TRUE);
CREATE POLICY "Sources: read all" ON public.scraping_sources FOR SELECT USING (TRUE);
CREATE POLICY "Sources: write service" ON public.scraping_sources FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Sources: update service" ON public.scraping_sources FOR UPDATE USING (TRUE);

CREATE OR REPLACE FUNCTION public.find_nearby_sagre(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km INTEGER DEFAULT 30,
  p_date_start DATE DEFAULT CURRENT_DATE,
  p_date_end DATE DEFAULT NULL,
  p_food_tags TEXT[] DEFAULT NULL,
  p_province TEXT DEFAULT NULL,
  p_is_free BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID, title TEXT, city TEXT, province TEXT,
  description TEXT, start_date DATE, end_date DATE,
  start_time TIME, end_time TIME,
  is_free BOOLEAN, price_info TEXT,
  image_url TEXT, website_url TEXT,
  food_tags TEXT[], feature_tags TEXT[],
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.title, e.city, e.province,
    e.description, e.start_date, e.end_date,
    e.start_time, e.end_time,
    e.is_free, e.price_info,
    e.image_url, e.website_url,
    e.food_tags, e.feature_tags,
    ROUND((ST_Distance(
      e.location_coords,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) / 1000.0)::numeric, 1)::double precision AS distance_km
  FROM public.events e
  WHERE e.is_active = TRUE
    AND e.start_date <= COALESCE(p_date_end, p_date_start + INTERVAL '7 days')
    AND (e.end_date >= p_date_start OR (e.end_date IS NULL AND e.start_date >= p_date_start))
    AND ST_DWithin(
      e.location_coords,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
    AND (p_food_tags IS NULL OR e.food_tags && p_food_tags)
    AND (p_province IS NULL OR e.province = p_province)
    AND (p_is_free IS NULL OR e.is_free = p_is_free)
  ORDER BY distance_km ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

INSERT INTO public.scraping_sources (id, name, base_url, region_url_template, selectors) VALUES
('sagreitaliane', 'Sagre Italiane', 'https://www.sagreitaliane.it', '/sagre-in-{region}/',
  '{"event_list":"article.event-item,.sagra-card","title":"h2,h3,.event-title","city":".location,.city,.luogo","date":".date,.data,.event-date","description":".description,.excerpt,p:first-of-type","link":"a[href]","image":"img[src]"}'::jsonb),
('eventiesagre', 'Eventi e Sagre', 'https://www.eventiesagre.it', '/Sagre/{region}/',
  '{"event_list":".evento-item,.event-card","title":"h3,.title","city":".luogo,.city","date":".data,.date","description":"p,.desc","link":"a[href]","image":"img[src]"}'::jsonb),
('solosagre', 'Solo Sagre', 'https://www.solosagre.it', '/sagre/{region}/',
  '{"event_list":".event-card,.sagra-item","title":"h3,.title","city":".comune,.city","date":".date,.periodo","description":".desc,p","link":"a[href]","image":"img[src]"}'::jsonb),
('tuttofesta', 'TuttoFesta', 'https://www.tuttofesta.net', '/it/sagre/{region}/',
  '{"event_list":".evento-item,.item","title":"h3,.title","city":".luogo,.city","date":".data,.date","description":"p,.desc","link":"a[href]","image":"img[src]"}'::jsonb),
('sagritaly', 'Sagritaly', 'https://sagritaly.com', '/sagre/{region}/',
  '{"event_list":"article,.sagra-card,.event","title":"h2,h3,.title","city":".city,.location","date":".date,.periodo","description":".excerpt,p","link":"a[href]","image":"img[src]"}'::jsonb);
```

---

## STRUTTURA CARTELLE

```
sagre-veneto/
├── src/
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Homepage
│   │   │   ├── cerca/page.tsx          # Ricerca + filtri + mappa
│   │   │   ├── sagra/[id]/page.tsx     # Dettaglio sagra
│   │   │   └── mappa/page.tsx          # Mappa fullscreen
│   │   ├── api/
│   │   │   ├── cron/
│   │   │   │   ├── scrape-sagre/route.ts
│   │   │   │   ├── enrich-sagre/route.ts   # LLM enrich + tag
│   │   │   │   └── expire-events/route.ts
│   │   │   └── og/[id]/route.tsx
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── not-found.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── admin.ts
│   │   ├── llm/
│   │   │   ├── gemini.ts               # Singolo provider, Gemini 2.5 Flash
│   │   │   └── prompts.ts              # Prompt per enrich + tagging
│   │   ├── scraper/
│   │   │   ├── generic-scraper.ts
│   │   │   └── geocode.ts
│   │   ├── validators/schemas.ts
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── sagra/
│   │   │   ├── SagraCard.tsx
│   │   │   ├── SagraDetail.tsx
│   │   │   └── SagraInfoBox.tsx
│   │   ├── search/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── FilterChips.tsx
│   │   │   ├── FilterSheet.tsx
│   │   │   ├── MapView.tsx
│   │   │   ├── ListView.tsx
│   │   │   └── ToggleMapList.tsx
│   │   └── shared/
│   │       ├── Navbar.tsx
│   │       ├── Footer.tsx
│   │       ├── BottomNav.tsx
│   │       ├── LoadingSkeleton.tsx
│   │       ├── EmptyState.tsx
│   │       └── GeolocationButton.tsx
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   └── useDebounce.ts
│   ├── types/
│   │   └── sagra.ts
│   └── config/
│       └── constants.ts
├── scripts/
│   ├── setup-db.ts
│   └── seed-sagre.ts
├── .env.local
├── vercel.json
└── package.json
```

---

## COSTANTI

```typescript
// src/config/constants.ts

export const VENETO_CITIES = [
  { name: 'Venezia', lat: 45.4408, lng: 12.3155, province: 'VE' },
  { name: 'Padova', lat: 45.4064, lng: 11.8768, province: 'PD' },
  { name: 'Verona', lat: 45.4384, lng: 10.9916, province: 'VR' },
  { name: 'Vicenza', lat: 45.5455, lng: 11.5354, province: 'VI' },
  { name: 'Treviso', lat: 45.6669, lng: 12.2430, province: 'TV' },
  { name: 'Belluno', lat: 46.1423, lng: 12.2167, province: 'BL' },
  { name: 'Rovigo', lat: 45.0706, lng: 11.7900, province: 'RO' },
  { name: 'Bassano del Grappa', lat: 45.7655, lng: 11.7351, province: 'VI' },
  { name: 'Conegliano', lat: 45.8869, lng: 12.2978, province: 'TV' },
  { name: 'Chioggia', lat: 45.2196, lng: 12.2786, province: 'VE' },
  { name: 'Este', lat: 45.2267, lng: 11.6605, province: 'PD' },
  { name: 'Cittadella', lat: 45.6490, lng: 11.7843, province: 'PD' },
  { name: 'Sandrigo', lat: 45.6600, lng: 11.6017, province: 'VI' },
  { name: 'Isola della Scala', lat: 45.2733, lng: 11.0133, province: 'VR' },
  { name: 'Castelfranco Veneto', lat: 45.6709, lng: 11.9267, province: 'TV' },
  { name: 'Montagnana', lat: 45.2307, lng: 11.4627, province: 'PD' },
  { name: 'Asolo', lat: 45.8012, lng: 11.9132, province: 'TV' },
  { name: 'Soave', lat: 45.4205, lng: 11.2482, province: 'VR' },
  { name: 'Marostica', lat: 45.7469, lng: 11.6567, province: 'VI' },
] as const;

export const VENETO_PROVINCES = [
  { code: 'VE', name: 'Venezia' },
  { code: 'PD', name: 'Padova' },
  { code: 'VR', name: 'Verona' },
  { code: 'VI', name: 'Vicenza' },
  { code: 'TV', name: 'Treviso' },
  { code: 'BL', name: 'Belluno' },
  { code: 'RO', name: 'Rovigo' },
] as const;

export const FOOD_TAGS = [
  'baccalà', 'polenta', 'radicchio', 'prosecco', 'asparago',
  'bisi', 'sopressa', 'monte_veronese', 'torresano', 'porchetta',
  'bigoli', 'risi_e_bisi', 'sarde_in_saor', 'fritole',
  'grappa', 'spritz', 'pesce', 'carne', 'funghi', 'castagne',
  'tartufo', 'vino', 'birra_artigianale', 'formaggio', 'salumi',
] as const;

export const FEATURE_TAGS = [
  'musica_live', 'area_bimbi', 'parcheggio', 'coperto',
  'all_aperto', 'stand_gastronomici', 'degustazione', 'mercatino',
] as const;

export const QUICK_FILTERS = [
  { emoji: '🐟', label: 'Pesce', tag: 'pesce' },
  { emoji: '🥩', label: 'Carne', tag: 'carne' },
  { emoji: '🧀', label: 'Formaggi', tag: 'formaggio' },
  { emoji: '🍷', label: 'Vino', tag: 'vino' },
  { emoji: '🥬', label: 'Radicchio', tag: 'radicchio' },
  { emoji: '🍄', label: 'Funghi', tag: 'funghi' },
  { emoji: '🆓', label: 'Gratis', tag: '_free' },
  { emoji: '🔥', label: 'Oggi', tag: '_today' },
] as const;
```

---

## FASI DI SVILUPPO

### Fase 1: Setup (chiedi a Claude Code)
```
Crea un progetto Next.js 14 con App Router, TypeScript, Tailwind, Shadcn/UI.
Installa: @supabase/supabase-js, @supabase/ssr, zod, cheerio, leaflet, react-leaflet, @types/leaflet, framer-motion.
Installa Shadcn components: button, card, input, badge, skeleton, sheet, dialog, separator, toast, tabs.
Cerca e copia componenti utili da magicui.design e reactbits.dev (animated cards, shimmer, text reveal, scroll animations).
Crea la struttura cartelle come descritto sopra.
Copia il file .env.local nella root.
```

### Fase 2: Database
```
Esegui lo schema SQL su Supabase (o via script setup-db.ts).
Poi crea seed-sagre.ts con almeno 30 sagre reali del Veneto:
- Sagra del Radicchio Rosso (Treviso)
- Festa del Baccalà (Sandrigo, VI)
- Fiera del Riso (Isola della Scala, VR)
- Sagra dei Bisi (Lumignano, VI)
- Festa del Torresano (Breganze, VI)
- Sagra del Prosecco (Conegliano-Valdobbiadene, TV)
- Sagra della Sopressa (Valli del Pasubio, VI)
- Sagra del Radicchio Variegato (Castelfranco, TV)
- Sagra degli Asparagi (Bassano, VI)
- Sagra della Polenta (varie località)
- ...e almeno 20 altre con coordinate GPS reali, date realistiche, food_tags.
Usa Nominatim per ottenere le coordinate se non le hai.
```

### Fase 3: Scraper
```
Crea il generic scraper config-driven in src/lib/scraper/generic-scraper.ts.
Legge i selettori dalla tabella scraping_sources.
Per ogni fonte:
1. Fetch URL con template regione = "veneto"
2. Parsa HTML con Cheerio usando i selettori
3. Per ogni sagra trovata: titolo, città, date, descrizione, link, immagine
4. Geocoding città → coords con Nominatim (rate limit 1req/sec)
5. Upsert su tabella events (deduplica per titolo+città)

Crea il cron route /api/cron/scrape-sagre protetto da CRON_SECRET.
Crea il cron route /api/cron/expire-events che mette is_active=false su eventi passati.

IMPORTANTE: prima di scrivere i selettori definitivi, fetcha le pagine reali e analizza l'HTML.
Se un sito non funziona con i selettori, logga l'errore e vai avanti con gli altri.

vercel.json:
{
  "crons": [
    { "path": "/api/cron/scrape-sagre", "schedule": "0 4,16 * * *" },
    { "path": "/api/cron/expire-events", "schedule": "0 3 * * *" }
  ]
}
```

### Fase 4: LLM Arricchimento + Tagging
```
Installa: @google/generative-ai

Crea src/lib/llm/gemini.ts:
- Wrapper semplice per Gemini 2.5 Flash
- Funzione callGemini(systemPrompt, userPrompt) → string
- Timeout 30s, retry 1x su errore
- Parse JSON dalla risposta (strip markdown fences se presenti)

Crea src/lib/llm/prompts.ts con due prompt:

PROMPT 1 — ENRICH_DESCRIPTION:
"""
Sei un copywriter specializzato in eventi gastronomici italiani.
Ricevi titolo e descrizione (spesso scarna) di una sagra del Veneto.
Genera una descrizione coinvolgente di 2-3 frasi che faccia venire voglia di andare.
REGOLE:
- Tono informale ma appetitoso, come un amico che ti consiglia dove andare
- Menziona il piatto/ingrediente principale se evidente dal titolo
- NON inventare informazioni specifiche (prezzi, orari esatti) che non hai
- MAX 250 caratteri
- Rispondi SOLO con la descrizione, niente altro
"""

PROMPT 2 — AUTO_TAG:
"""
Sei un classificatore di eventi gastronomici del Veneto.
Ricevi titolo e descrizione di una sagra.
Genera i tag in formato JSON.
{
  "food_tags": ["max 5 tag tra: baccalà, polenta, radicchio, prosecco, asparago, bisi, sopressa, torresano, porchetta, bigoli, pesce, carne, funghi, castagne, tartufo, vino, birra_artigianale, formaggio, salumi, zucca, fagioli, gnocchi, trippa, oca, anatra, lumache, rane, anguilla, riso"],
  "feature_tags": ["max 3 tag tra: musica_live, area_bimbi, parcheggio, coperto, all_aperto, stand_gastronomici, degustazione, mercatino"]
}
Rispondi SOLO con JSON valido, nient'altro.
"""

Crea cron route /api/cron/enrich-sagre/route.ts:
1. Query: SELECT * FROM events WHERE is_enriched = false OR is_tagged = false LIMIT 20
2. Per ogni sagra non enriched: chiama Gemini con ENRICH_DESCRIPTION → salva enriched_description, is_enriched = true
3. Per ogni sagra non tagged: chiama Gemini con AUTO_TAG → parse JSON → salva food_tags + feature_tags, is_tagged = true
4. Rate limit: 1 secondo tra ogni chiamata (free tier Gemini: 15 req/min)
5. Se Gemini fallisce su una sagra, logga errore e vai avanti con la prossima

Aggiorna vercel.json:
{
  "crons": [
    { "path": "/api/cron/scrape-sagre", "schedule": "0 4,16 * * *" },
    { "path": "/api/cron/enrich-sagre", "schedule": "0 5,17 * * *" },
    { "path": "/api/cron/expire-events", "schedule": "0 3 * * *" }
  ]
}

Il cron enrich gira 1h dopo lo scraping, così processa le sagre appena scrapate.
```

### Fase 5: Homepage
```
Crea la homepage (src/app/(main)/page.tsx):
- Navbar con logo/nome app
- Hero section: "Scopri le sagre del Veneto" + barra ricerca con bottone geolocation
- Quick filter chips (dalla costante QUICK_FILTERS)
- Sezione "Questo weekend" — query sagre dei prossimi 3 giorni, griglia di SagraCard
- Sezione "Per provincia" — 7 card con conteggio sagre per provincia
- Footer
- Mobile: BottomNav con tab Home/Cerca/Mappa

SagraCard design:
- Immagine (o placeholder colorato con emoji se manca)
- Titolo
- 📍 Città (Provincia) + distanza se geolocalizzato
- 📅 Date (formato italiano: "15-17 Mar")
- Tag chips (food_tags generati da LLM, max 3: es. 🐟 pesce · 🥔 polenta · 🎵 musica)
- Prezzo (Gratis / "~€15/persona" / info)
- Se enriched_description disponibile, mostra 1 riga come sottotitolo

Colori: primary arancione/ambra, accenti verde oliva, bg warm cream.
Mobile-first: tutto deve essere perfetto su iPhone.
```

### Fase 6: Ricerca + Mappa
```
Crea la pagina ricerca (src/app/(main)/cerca/page.tsx):
- SearchBar in cima con autocomplete sulle città di VENETO_CITIES
- Toggle "Lista | Mappa"
- FilterChips rapidi sotto la barra
- FilterSheet (bottom sheet su mobile) con filtri avanzati:
  - Provincia (select)
  - Raggio km (slider: 5, 10, 20, 30, 50)
  - Date (oggi, domani, weekend, settimana, custom)
  - Solo gratis (toggle)
  - Tipo cucina (multi-select dai FOOD_TAGS)
- Vista Lista: griglia SagraCard con infinite scroll o "carica altri"
- Vista Mappa: Leaflet con OSM tiles, marker per ogni sagra, cluster quando tanti,
  popup al click con mini-info, click sul popup porta al dettaglio

Pagina mappa fullscreen (src/app/(main)/mappa/page.tsx):
- Leaflet full viewport
- Stessi marker e cluster
- Filter chips overlay in basso

Usa Leaflet con dynamic import (no SSR):
const MapView = dynamic(() => import('@/components/search/MapView'), { ssr: false });

Per le query usa la funzione RPC find_nearby_sagre quando c'è geolocation,
altrimenti query diretta per provincia/data.
```

### Fase 7: Dettaglio Sagra
```
Crea la pagina dettaglio (src/app/(main)/sagra/[id]/page.tsx):
- Immagine hero (o placeholder)
- Titolo grande
- Tag chips
- Info box: 📅 Date e orari, 📍 Indirizzo completo, 💰 Info prezzo, 🌐 Link sito originale
- Descrizione (usa enriched_description se disponibile, altrimenti description originale)
- Mini mappa con singolo marker
- Bottone "📤 Condividi" (copy link)
- Bottone "🗺️ Indicazioni" (apre Google Maps in nuovo tab con le coordinate)
- generateMetadata per SEO (titolo, descrizione, OG image)

Crea OG image route (src/app/api/og/[id]/route.tsx) con @vercel/og:
- 1200x630, sfondo arancione caldo
- Titolo sagra, città, date
- Logo/nome app in basso
```

### Fase 8: SEO + Polish + Deploy
```
- generateMetadata su ogni pagina
- sitemap.ts dinamica con tutte le sagre attive
- robots.ts
- loading.tsx con skeleton per ogni route
- not-found.tsx personalizzata
- Empty states ("Nessuna sagra trovata in questa zona")
- Responsive check su mobile
- Leaflet CSS import corretto
- Build pulito senza errori
- Git push
- Vercel import + env variables + deploy
- Testa i cron manualmente una volta
```

---

## COSTANTI .ENV.LOCAL

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=genera-stringa-random-lunga
```

Sono 6 variabili. Gemini API key si ottiene gratis da https://aistudio.google.com/apikey in 2 minuti.

---

## DESIGN REFERENCE

### SagraCard (ASCII mockup)
```
┌─────────────────────────────┐
│  [IMMAGINE / PLACEHOLDER]   │
│                     h:160px │
├─────────────────────────────┤
│  Sagra del Baccalà          │
│  📍 Sandrigo (VI) · 12km    │
│  📅 15-17 Mar 2026          │
│  🐟 pesce · 🎵 musica       │
│  💰 ~€15/persona            │
└─────────────────────────────┘
```

### Mobile Bottom Nav
```
┌──────┬──────┬──────┐
│  🏠  │  🔍  │  🗺️  │
│ Home │Cerca │Mappa │
└──────┴──────┴──────┘
```

### Colori
- Primary: `amber-600` (#D97706)
- Primary hover: `amber-700`
- Accent: `olive-600` / `green-700`
- Background: `stone-50` (#FAFAF9)
- Card bg: `white`
- Text: `stone-800`
- Muted text: `stone-500`

---

## EXTRA FUTURI (non implementare ora, solo reference)

Dopo il deploy dell'MVP, le feature successive in ordine di priorità:

1. **Multi-LLM Router + Auto-Discovery** — Prerequisito per OCR (EXTRA 2). 6 provider con fallback (Gemini → Groq → Mistral → DeepSeek → OpenRouter → Cloudflare), quota tracker, retry automatico. Rende anche più robusto l'arricchimento/tagging già nell'MVP. Auto-generazione selettori per nuovi siti.
2. **OCR Locandine da Social** — Usa il multi-LLM router per distribuire il carico. Scraping pagine pubbliche Facebook/Instagram Pro Loco → estrazione locandine → LLM vision (manda immagine → JSON con titolo/date/luogo/food_tags). Volume: 200-600 img/settimana. Vantaggio competitivo enorme: sagre piccole che esistono SOLO come locandina su Facebook.
3. **Auth + Preferiti** — Login Google, salva sagre, profilo base
4. **Recensioni** — Stelle, commenti, foto, "utile/non utile"
5. **Gamification** — Livelli utente (Nuovo → Esploratore → Esperto → Maestro)
6. **Monetizzazione** — Listing sponsorizzati, profili premium organizzatori
7. **Cache ricerche** — Stessa query non rieseguita per 6h
8. **Notifiche** — "Nuova sagra vicino a te", "Aperte ora"

Per ognuna di queste è già stato fatto un planning dettagliato che verrà fornito al momento dell'implementazione.
