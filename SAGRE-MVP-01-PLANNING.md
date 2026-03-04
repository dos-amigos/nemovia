# 🎪 APP SAGRE VENETO — MVP Planning

---

## 1. VISIONE MVP

### Il Problema
Chi vuole trovare sagre ed eventi gastronomici nel weekend in Veneto deve visitare 5-8 siti diversi, ognuno con dati parziali, interfacce datate, nessuna geolocalizzazione, nessun filtro utile.

### La Soluzione MVP
Un'app web moderna che aggrega TUTTE le sagre del Veneto da multiple fonti e le presenta in una UI bellissima, mobile-first, con mappa interattiva e filtri per data/zona/tipo.

**L'MVP fa UNA cosa e la fa benissimo:** mostra tutte le sagre del Veneto, dove sono, quando sono, e cosa offrono. Fine.

### Cosa È Dentro l'MVP
- ✅ Scraping automatico da 5+ siti di sagre
- ✅ LLM auto-tagging (Gemini 2.5 Flash): classifica ogni sagra per tipo cucina/ingrediente
- ✅ LLM arricchimento descrizioni: trasforma testi scarni in descrizioni coinvolgenti
- ✅ Listing moderno mobile-first con card belle
- ✅ Mappa interattiva con tutte le sagre (Leaflet + OSM, gratis)
- ✅ Filtri: data, provincia, tipo cucina/ingrediente, gratis/a pagamento
- ✅ Dettaglio sagra con info pratiche + mini mappa
- ✅ "Vicino a me" con geolocalizzazione
- ✅ SEO per indicizzazione Google
- ✅ Deploy su Vercel

### Cosa È FUORI dall'MVP (→ vedi sezione EXTRA)
- ❌ Auth / login utenti
- ❌ Recensioni, commenti, foto
- ❌ Profili utente e gamification
- ❌ Listing sponsorizzati / monetizzazione
- ❌ Auto-discovery selettori scraping (LLM avanzato)
- ❌ Preferiti / salva sagra
- ❌ Notifiche
- ❌ Cache ricerche

---

## 2. ESEMPIO PRATICO MVP

Laura, Cittadella (PD), venerdì sera. Apre l'app dal telefono.

**Homepage:** vede "Sagre questo weekend in Veneto" — griglia di card. Ogni card ha: titolo, città, date, immagine (se disponibile), 2-3 tag cucina.

**Filtra:** tocca "Pesce" nei quick filters. Restano 3 sagre. Tocca "Provincia: VI". Resta la Sagra del Baccalà a Sandrigo.

**Dettaglio:** vede titolo, date, orari, indirizzo, descrizione (quella scraped dal sito originale), mini mappa con pin, link al sito originale per maggiori info.

**Mappa:** tocca il tab Mappa. Vede tutti i pin delle sagre attive. Zoom sulla sua zona, tocca un pin → popup con mini-info → tocca per andare al dettaglio.

**Condivide:** copia il link della sagra e lo manda al marito su WhatsApp.

Fine. Semplice, veloce, utile.

---

## 3. STACK TECNICO MVP

- **Framework:** Next.js 14+ (App Router), TypeScript
- **Styling:** Tailwind CSS + Shadcn/UI
- **DB:** Supabase (PostgreSQL + PostGIS)
- **Mappa:** Leaflet + OpenStreetMap (gratis)
- **Scraping:** Cheerio (config-driven)
- **Geocoding:** Nominatim (gratis)
- **LLM:** Gemini 2.5 Flash (singolo provider, solo batch per arricchimento + tagging)
- **Deploy:** Vercel

**Non servono per l'MVP:** Google Maps APIs, Auth, Mapbox, multi-LLM router.

---

## 4. SCHEMA DATABASE MVP

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
  price_info TEXT,                    -- Testo libero: "€15 a persona", "ingresso libero"
  website_url TEXT,
  image_url TEXT,
  food_tags TEXT[] DEFAULT '{}',
  feature_tags TEXT[] DEFAULT '{}',
  -- LLM enrichment
  enriched_description TEXT,          -- Generata da Gemini
  is_enriched BOOLEAN DEFAULT FALSE,  -- LLM ha arricchito?
  is_tagged BOOLEAN DEFAULT FALSE,    -- LLM ha generato tag?
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

-- Indices
CREATE INDEX idx_events_coords ON public.events USING GIST(location_coords);
CREATE INDEX idx_events_dates ON public.events (start_date, end_date) WHERE is_active = TRUE;
CREATE INDEX idx_events_province ON public.events (province) WHERE is_active = TRUE;
CREATE INDEX idx_events_food_tags ON public.events USING GIN(food_tags);
CREATE INDEX idx_events_title_trgm ON public.events USING GIN(title gin_trgm_ops);

-- RLS (tutto pubblico, no auth nell'MVP)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events: read all" ON public.events FOR SELECT USING (TRUE);
CREATE POLICY "Events: write service" ON public.events FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Events: update service" ON public.events FOR UPDATE USING (TRUE);
CREATE POLICY "Events: delete service" ON public.events FOR DELETE USING (TRUE);
CREATE POLICY "Sources: read all" ON public.scraping_sources FOR SELECT USING (TRUE);
CREATE POLICY "Sources: write service" ON public.scraping_sources FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Sources: update service" ON public.scraping_sources FOR UPDATE USING (TRUE);

-- RPC Geo-search
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

-- Seed scraping sources
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

## 5. STRUTTURA CARTELLE MVP

```
sagre-veneto/
├── src/
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Homepage
│   │   │   ├── cerca/page.tsx          # Ricerca + filtri
│   │   │   ├── sagra/[id]/page.tsx     # Dettaglio sagra
│   │   │   └── mappa/page.tsx          # Mappa fullscreen
│   │   ├── api/
│   │   │   ├── cron/
│   │   │   │   ├── scrape-sagre/route.ts
│   │   │   │   └── expire-events/route.ts
│   │   │   └── og/[id]/route.tsx       # OG image condivisione
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── not-found.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser client
│   │   │   ├── server.ts               # Server client (RSC)
│   │   │   └── admin.ts                # Service role (cron)
│   │   ├── scraper/
│   │   │   ├── generic-scraper.ts
│   │   │   └── geocode.ts              # Nominatim
│   │   ├── validators/schemas.ts
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/                         # Shadcn
│   │   ├── sagra/
│   │   │   ├── SagraCard.tsx
│   │   │   ├── SagraDetail.tsx
│   │   │   └── SagraInfoBox.tsx
│   │   ├── search/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── FilterChips.tsx
│   │   │   ├── FilterSheet.tsx
│   │   │   ├── MapView.tsx             # Leaflet
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

## 6. FASI MVP (~10-12 ore)

| Fase | Ore | Cosa |
|------|-----|------|
| 1. Setup | 0-0.5h | Next.js, Tailwind, Shadcn, deps, struttura |
| 2. Database | 0.5-1.5h | Schema SQL, seed 30 sagre reali Veneto |
| 3. Scraper | 1.5-3h | Generic scraper config-driven + geocoding Nominatim + cron |
| 4. LLM Enrichment | 3-4.5h | Gemini 2.5 Flash: arricchimento descrizioni + auto-tagging batch |
| 5. Homepage | 4.5-6.5h | Hero, sagre weekend, quick filters, card grid |
| 6. Ricerca + Mappa | 6.5-8.5h | Pagina cerca con filtri + Leaflet + lista |
| 7. Dettaglio sagra | 8.5-9.5h | Info, mappa, condivisione, link sito originale |
| 8. SEO + Deploy | 9.5-12h | Metadata, sitemap, OG image, Vercel deploy |

---

## 7. CONCORRENTI

Tutti i portali esistenti (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly, AssoSagre, ItinerariNelGusto) hanno gli stessi problemi: UX datata, non mobile-first, pubblicità invasive, nessuna geolocalizzazione, dati parziali, nessun filtro per tipo cucina.

L'MVP risolve GIÀ i problemi principali: aggrega tutto, mobile-first, mappa, geolocalizzazione, filtri.

---

## 8. EXTRA (post-MVP, in ordine di priorità)

### EXTRA 1: Multi-LLM Router + Auto-Discovery
Prerequisito per EXTRA 2 (OCR) e per rendere più robusto l'arricchimento/tagging già presente nell'MVP.
- 6 provider con fallback (Gemini → Groq → Mistral → DeepSeek → OpenRouter → Cloudflare)
- Quota tracker in-memory con reset giornaliero
- Timeout 30s, retry automatico su provider successivo
- Auto-discovery selettori: incolla URL di un nuovo sito → LLM genera selettori CSS
- Capacità stimata: ~2,000+ req/giorno distribuiti sui free tier

### EXTRA 2: OCR Locandine da Social ⭐ VANTAGGIO COMPETITIVO
Usa il multi-LLM router (EXTRA 1) per distribuire il carico.
- Scraping pagine pubbliche Facebook/Instagram delle Pro Loco venete
- Estrazione immagini locandine
- OCR + parsing con LLM vision (manda immagine → ricevi JSON strutturato)
- Prompt: "Analizza questa locandina di sagra. Estrai: title, city, province, dates, times, description, food_tags, is_free, price_info"
- Volume stimato: 200-600 immagini/settimana
- Dati che NESSUN concorrente ha: molte sagre piccole esistono SOLO come locandina su Facebook

### EXTRA 3: Auth + Preferiti
- Login Google + Magic Link
- Salva sagre nei preferiti
- Profilo utente base

### EXTRA 4: Recensioni + Commenti
- Sistema recensioni (stelle + testo + tag)
- Voto "utile / non utile"
- Rating medio per sagra
- Upload foto

### EXTRA 5: Gamification
- Livelli utente (Nuovo → Esploratore → Intenditore → Esperto → Maestro)
- Badge, stats, progress bar
- Benefici per livelli alti

### EXTRA 6: Monetizzazione
- Listing sponsorizzati (badge "In Evidenza")
- Posizionamento top nei risultati
- Profilo premium organizzatore
- Dashboard analytics per sponsor

### EXTRA 7: Cache Ricerche
- Cache geo-query con TTL 6h
- Stessa ricerca non rieseguita per ore

### EXTRA 8: Notifiche + "Aperte Ora"
- Filtro real-time sagre aperte
- Notifiche "nuova sagra nella tua zona"
- Contatore "23 persone interessate"
