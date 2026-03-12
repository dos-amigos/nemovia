# PROGRESS.md — Riferimento Assoluto di Progetto

> **REGOLA**: Leggere questo file ALL'INIZIO di ogni nuova sessione chat.
> Aggiornarlo DOPO ogni azione completata.

---

## Stato Attuale del Progetto

### Stack e Infrastruttura Esistente
- **Framework**: Next.js 15, Tailwind v4, Shadcn/UI
- **Database**: Supabase (PostGIS + pg_trgm)
- **Scraping attuale**: Cheerio in Supabase Edge Functions (scrape-sagre, enrich-sagre)
- **Fonti attive (6)**: assosagre, venetoinfesta, solosagre, sagritaly, eventiesagre, itinerarinelgusto
- **Pipeline**: pg_cron — scrape 2x/day, enrich 2x/day, expire 1x/day, batch 200/run
- **Immagini**: Unsplash API (assegnate in enrich-sagre Pass 3)
- **Deploy**: Vercel (nemovia.it)

### Versioni Completate
- v1.0–v1.3: vedi .planning/milestones/
- v1.4 "Esperienza Completa": shipped 2026-03-12 (tag git v1.4)

---

## COSA E' GIA' IMPLEMENTATO

### Scraping (Cheerio — 6 fonti)
- [x] assosagre.it — scraper + detail extractor
- [x] venetoinfesta.it — scraper + detail extractor
- [x] solosagre.com — scraper + detail extractor
- [x] sagritaly.it — scraper + detail extractor
- [x] eventiesagre.it — scraper + detail extractor
- [x] itinerarinelgusto.it — scraper + detail extractor
- [x] Enrich pipeline (categorizzazione, geocoding, Unsplash images)
- [x] Detail scraping (menu, orari, descrizioni) con pattern NULL-only update
- [x] Vinitaly hardcoded blocklist
- [x] Low-quality image defense (3 livelli: scrape/enrich/display)
- [x] Batch 200/run per Unsplash rate limits

### Frontend
- [x] Homepage con hero random, QuickFilters, ScrollRows per provincia e food
- [x] Pagina /cerca con filtri sidebar (desktop) / top (mobile)
- [x] Pagina /mappa con Leaflet, marker tematici (40x56px)
- [x] Pagina dettaglio sagra con mini-map, menu, orari, gallery
- [x] Ricerca città + raggio (slider Airbnb-style)
- [x] Food icons tematiche (carne, pesce, zucca, gnocco, verdura, vino, dolci, altro)
- [x] Brand color CSS variables (--brand-l/c/h)
- [x] OG metadata, share button, back button

---

## COSA E' DA FARE

### Fase 1: Tavily Search — Discovery Nuove Sagre (FREE TIER)

**Obiettivo**: Usare Tavily Search API (1000 crediti/mese gratis) per scoprire sagre che le 6 fonti attuali non coprono.

**Decisioni prese**:
- Tavily NON sostituisce Cheerio — è un layer di discovery aggiuntivo
- Free tier: 1000 crediti/mese, 1 credito = 1 search
- Output: title, url, snippet (NON dati strutturati)
- Servirà parsing dello snippet per estrarre nome/luogo/date (best effort)

**Tasks**:
- [ ] Creare account Tavily e ottenere API key
- [ ] Aggiungere TAVILY_API_KEY a .env e Vercel env vars
- [ ] Creare Edge Function `discover-sagre` che:
  - Cerca `"sagra [mese] [anno] Veneto"` per ogni mese futuro
  - Cerca `"sagra [provincia]"` per ogni provincia veneta
  - Filtra risultati duplicati (già presenti in DB)
  - Salva nuove sagre con source="tavily" e status="discovered"
- [ ] Parsing degli snippet Tavily per estrarre:
  - Nome sagra (dal title)
  - Luogo/provincia (dal snippet o title)
  - Date (dal snippet, best effort)
  - URL fonte originale
- [ ] Aggiungere job pg_cron per discover-sagre (1x/giorno? 1x/settimana?)
- [ ] Decidere: le sagre "discovered" vanno in homepage o servono validazione manuale?
- [ ] Monitorare consumo crediti (max 1000/mese)

**Note tecniche**:
- Tavily API: `POST https://api.tavily.com/search`
- Body: `{ "query": "...", "search_depth": "basic", "max_results": 10 }`
- Response: `{ results: [{ title, url, content, score }] }`

---

### Fase 2: Facebook Graph API — Sagre da Pagine/Eventi FB

**Obiettivo**: Integrare la Graph API di Meta per pescare eventi sagra da pagine Facebook di Pro Loco e organizzatori. Legale, entro i limiti API.

**Decisioni prese**:
- Graph API è l'unica via legale e sostenibile per dati FB/IG
- Dati disponibili: nome, date (start/end), luogo (nome + coordinate), descrizione, cover photo
- Gratis ma rate limited (~200 chiamate/ora)
- Richiede Facebook App approvata

**Tasks**:
- [ ] Creare Facebook App su developers.facebook.com
  - [ ] Tipo: Business app
  - [ ] Permessi richiesti: pages_read_engagement, pages_read_user_content
  - [ ] Ottenere App Review (se necessario per pagine pubbliche)
- [ ] Ottenere Page Access Token (long-lived)
- [ ] Aggiungere FB_ACCESS_TOKEN a .env e Vercel env vars
- [ ] Ricercare: quali endpoint servono?
  - `GET /{page-id}/events` — eventi di una pagina
  - `GET /search?type=event&q=sagra` — cerca eventi (se disponibile)
  - Verificare se serve `GET /search?type=page&q=pro+loco+veneto` per trovare pagine
- [ ] Creare lista seed di pagine FB Pro Loco venete (manuale iniziale)
- [ ] Creare Edge Function `discover-fb-sagre` che:
  - Per ogni pagina Pro Loco nella lista seed, fetch eventi futuri
  - Estrae: nome, date, luogo, descrizione, cover photo URL
  - Deduplica contro sagre esistenti in DB
  - Salva con source="facebook"
- [ ] Mapping campi FB → tabella sagre:
  - `event.name` → `nome`
  - `event.start_time` / `event.end_time` → `data_inizio` / `data_fine`
  - `event.place.name` → `luogo`
  - `event.place.location.latitude/longitude` → `lat` / `lng`
  - `event.description` → `descrizione`
  - `event.cover.source` → `image_url`
- [ ] Gestire token refresh (long-lived token dura 60 giorni)
- [ ] Aggiungere job pg_cron (1x/giorno)
- [ ] Valutare: serve anche Instagram Graph API? (stessi eventi spesso cross-postati)

**Note tecniche**:
- Graph API base URL: `https://graph.facebook.com/v19.0/`
- Rate limit: 200 chiamate/ora per app
- Long-lived token: richiede exchange via endpoint OAuth
- Instagram Graph API usa stessi token se pagina FB è collegata a account IG Business

---

### Fase 3: Miglioramenti Pipeline (futuri, non prioritari)
- [ ] Applicare migration 016 al DB remoto (find_nearby_sagre RPC + location column)
- [ ] Aumentare copertura immagini (maggior parte sagre ancora senza immagine)
- [ ] Valutare LLM (GPT-4o-mini) per parsing HTML ambiguo come alternativa a Cheerio
- [ ] Valutare Apify ($49/mese) come backup se Graph API ha limitazioni eccessive
  - Vantaggi: scraping FB/IG senza setup, hashtag search Instagram, zero manutenzione
  - Svantaggi: zona grigia legale, costo mensile, dipendenza esterna
  - Decisione: NON ora — solo se Tavily free + Graph API non bastano

---

## BUG APERTI (da risolvere)

### BUG-001: Ricerca città+raggio restituisce 0 risultati
- **Repro**: Cerca "Verona", raggio 100km → 0 risultati
- **Causa**: Migration 016 (`find_nearby_sagre` RPC con colonna location) NON applicata al DB remoto
- **Fix**: Applicare `supabase/migrations/016_nearby_add_location.sql` al DB Supabase remoto
- **Stato**: DA FARE

### BUG-002: Click su sagra in homepage non naviga alla pagina dettaglio
- **Repro**: Homepage → click su card sagra → non succede nulla
- **Causa probabile**: `setPointerCapture` nello ScrollRow intercetta il click, oppure threshold drag troppo basso (10px)
- **File**: `src/components/home/ScrollRow.tsx`
- **Stato**: DA INVESTIGARE

### BUG-003: Immagini a bassa risoluzione ancora visibili
- **Repro**: Alcune sagre mostrano immagini pixelate/piccole inaccettabili
- **Difesa esistente**: 3 livelli (scrape/enrich/display) + `isLowQualityUrl()` check
- **Causa probabile**: `isLowQualityUrl()` non cattura tutti i pattern di URL bassa qualità
- **File**: `src/lib/fallback-images.ts`
- **Stato**: DA INVESTIGARE

### BUG-004: Filtri /cerca sidebar — campi attaccati su desktop
- **Repro**: Desktop → /cerca → filtri nella sidebar sinistra tutti compressi in griglia
- **Fix applicato**: Cambiato `lg:grid-cols-4` → `lg:grid-cols-1` in SearchFilters.tsx
- **Stato**: FIXATO

### BUG-005: Filtri /mappa — campi tutti full-width, troppo lunghi
- **Repro**: Desktop → /mappa → filtri sopra la mappa tutti impilati full-width
- **Fix applicato**: Aggiunta prop `variant` a SearchFilters ("sidebar" | "topbar")
  - Topbar: città a sx (w-64) + filtri in griglia 5 colonne a dx, tutto su una riga
  - Sidebar: layout verticale invariato
- **Stato**: FIXATO

---

## Log Sessioni

### 2026-03-12 — Sessione iniziale
- Discusso Tavily vs Cheerio: Tavily utile per discovery, non sostituto
- Discusso scraping FB/IG: Graph API unica via legale
- Discusso opzione "solo link" vs dati strutturati: Graph API dà tutti i campi necessari
- Discusso Apify ($49/mese): non giustificato adesso, solo se le opzioni free non bastano
- Creato questo file PROGRESS.md come riferimento assoluto
- Fix filtri sidebar: `lg:grid-cols-4` → `lg:grid-cols-1`
- Identificati 4 bug aperti (BUG-001 a BUG-004)
- **Codice scritto**: solo fix filtri sidebar

---

## Regole di Aggiornamento
1. Leggere PROGRESS.md all'inizio di OGNI sessione
2. Spostare task da `[ ]` a `[x]` quando completati
3. Aggiungere nuove scoperte/decisioni nelle sezioni appropriate
4. Aggiungere entry nel Log Sessioni ad ogni sessione
5. MAI cancellare task completati — servono come storico
