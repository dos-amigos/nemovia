# PROGRESS.md — Riferimento Assoluto di Progetto

> **REGOLA**: Leggere questo file ALL'INIZIO di ogni nuova sessione chat.
> Aggiornarlo DOPO ogni azione completata.

---

## Stato Attuale del Progetto

### Stack e Infrastruttura Esistente
- **Framework**: Next.js 15, Tailwind v4, Shadcn/UI
- **Database**: Supabase (PostGIS + pg_trgm)
- **Scraping attuale**: Cheerio in Supabase Edge Functions (scrape-sagre, enrich-sagre)
- **Fonti attive (9)**: assosagre, venetoinfesta, solosagre, sagritaly, eventiesagre, itinerarinelgusto + custom: sagretoday, trovasagre, sagriamo
- **Pipeline**: pg_cron — scrape 2x/day, enrich 2x/day, expire 1x/day, batch 200/run
- **Immagini**: Unsplash API (assegnate in enrich-sagre Pass 3)
- **Deploy**: Vercel (nemovia.it)

### Versioni Completate
- v1.0–v1.3: vedi .planning/milestones/
- v1.4 "Esperienza Completa": shipped 2026-03-12 (tag git v1.4)

---

## COSA E' GIA' IMPLEMENTATO

### Scraping (Cheerio — 6 fonti DB-driven + 3 custom API-based)
- [x] assosagre.it — scraper + detail extractor
- [x] venetoinfesta.it — scraper + detail extractor
- [x] solosagre.com — scraper + detail extractor
- [x] sagritaly.it — scraper + detail extractor
- [x] eventiesagre.it — scraper + detail extractor
- [x] itinerarinelgusto.it — scraper + detail extractor
- [x] sagretoday.it — custom scraper (JSON-LD from Next.js) + detail extractor
- [x] trovasagre.it — custom scraper (JSON API) + description from API
- [x] sagriamo.it — custom scraper (REST API) + description from API
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
- [x] Hero dettaglio: overlay scuro + titolo/luogo sovrapposto sull'immagine
- [x] Video Pexels della città come fallback quando immagine non disponibile
- [x] Mappa mobile: drag con 2 dita (MapGestureHandler) + hint "Usa due dita"
- [x] Hero parallax: fade-out graduale allo scroll (no scomparsa brusca)
- [x] ScrollRow: snap magnetico desktop + CSS snap mobile (SOLUZIONE DEFINITIVA)
- [x] Fix "poche sagre": lookback 30gg, MIN_ROW 2, limite 200, grace period 30gg
- [x] DB cleanup: dedup, ri-attiva fiere food, filtra non-sagre (migration 021)

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

### Fase 3: Sezione "Sagre Vegetariane" in Homepage
- [x] Aggiunto tag "Verdura" a FOOD_TAGS — FATTO (sessione 2026-03-13 sera)
- [x] TAG_TO_CATEGORY: Zucca→verdura, Verdura→verdura, Radicchio→verdura, Funghi→verdura
- [ ] La row "Sagre di Verdura" apparirà automaticamente quando ci saranno ≥3 sagre con tag Verdura
- [ ] Richiede re-enrichment delle sagre esistenti con nuovo prompt (deploy enrich-sagre)

### Fase 4: Miglioramenti Pipeline
- [x] Applicare migration 016 al DB remoto — FATTO (sessione 2026-03-12)
- [x] Nuovo tag "Pane" per focacce/pinza/pinzin — FATTO (sessione 2026-03-13 sera)
- [x] Prompt Gemini migliorato per gastronomia veneta — FATTO
- [x] Video fallback tematico (cerca per tema sagra, non per nome comune) — FATTO
- [ ] Aumentare copertura immagini (maggior parte sagre ancora senza immagine)
- [x] Deployare enrich-sagre aggiornata (nuovi tag + prompt veneto) — FATTO 2026-03-13
- [x] Re-enrichire sagre esistenti — triggerato manualmente via net.http_post (ID 36)

### Fase 5: Nuove Fonti Scraping (ricerca completata 2026-03-13)

**TIER 1 — Alta priorità, scrapabili con Cheerio:**
1. **cheventi.it** — JSON-LD con Schema.org Event (date, coordinate, prezzi). 50-100+ eventi. MIGLIOR FONTE.
2. **venetoedintorni.it** — Server-rendered, filtro `tipo=sagre`. 20-50 sagre.
3. **culturaveneto.it** — DB ufficiale Regione Veneto. 412 voci. Molto autorevole.
4. **giraitalia.it** — Liste semplici per provincia/mese. 50-200+ (verificare freschezza dati).

**TIER 2 — Implementati 2026-03-13:**
5. **sagretoday.it** — [x] IMPLEMENTATO. Next.js, scrape JSON-LD da /sagre/veneto/{provincia}/page/{n}/. 318 sagre, 7 province, max 5 pagine/provincia. Detail extractor per JSON-LD Event.
6. **trovasagre.it** — [x] IMPLEMENTATO. JSON API `backend-agg.php?action=sagre`, filtro regione=Veneto. Campi: nome_sagra, descrizione, date, comune, foto[].
7. **sagriamo.it** — [x] IMPLEMENTATO. REST API `app.sagriamo.it/api/festival/all?page={n}&perPage=100`, filtro province Veneto (BL/PD/RO/TV/VE/VI/VR). 323 festival totali, ~150 Veneto. Dati ricchi: description, cover/logo images, address, dates.

**Non ancora implementati:**
8. **prolocovenete.it** — Portale ufficiale Pro Loco Venete. AJAX WordPress (reverse-engineering).
9. **paesiinfesta.com** — Solo Veneto orientale (VE/TV). 10-30 sagre.

**Pagine Facebook (per futura Graph API):**
- **Sagre Veneto** (74.897 like) — facebook.com/sagre.veneto/
- **Sagre in Veneto** (35.000+ follower) — facebook.com/SagrenelVeneto/
- **UNPLI Veneto Pro Loco** — facebook.com/unpliveneto.proloco
- **Pro Loco Verona** (9.848 like) — facebook.com/prolocoverona/

### Fase 6: Valutazioni Future
- [ ] Valutare LLM (GPT-4o-mini) per parsing HTML ambiguo come alternativa a Cheerio
- [ ] Valutare Apify ($49/mese) come backup se Graph API ha limitazioni eccessive

---

## BUG APERTI (da risolvere)

### BUG-001: Ricerca città+raggio restituisce 0 risultati
- **Repro**: Cerca "Verona", raggio 100km → 0 risultati
- **Causa**: Migration 016 (`find_nearby_sagre` RPC con colonna location) NON applicata al DB remoto
- **Fix**: Utente ha applicato migration 016 manualmente in Supabase SQL Editor
- **Stato**: FIXATO

### BUG-002: Click su sagra in homepage non naviga alla pagina dettaglio
- **Repro**: Homepage → click/tap su card sagra → non succede nulla
- **Causa**: `setPointerCapture` nello ScrollRow intercettava tutti i pointer events inclusi i tap
- **Fix applicato**: Rimosso `setPointerCapture`, drag inizia solo dopo 5px di movimento
- **Stato**: FIXATO

### BUG-007: Scroll row mobile — card non si allineano a sinistra dopo swipe
- **Repro**: Mobile → swipe ScrollRow → le card si fermano a metà, non snappano
- **Causa**: Rimosso snap magnetico JS nel fix BUG-002 senza sostituirlo con CSS snap
- **Regola UX**: Mobile=snap nativo CSS, Desktop=drag fluido+frecce NO snap
- **Fix applicato**: Aggiunto `snap-x snap-mandatory lg:snap-none` al container, `snap-start` alle card
- **Stato**: FIXATO

### BUG-008: Drag desktop rotto + padding sparito + logo mobile piccolo
- **Repro**: Desktop→drag non funziona. Mobile→card attaccate ai bordi. Logo mobile piccolo.
- **Causa 1**: Rimosso `setPointerCapture` per tutti i pointer, ma serve per mouse (desktop drag)
- **Causa 2**: `snap-mandatory` ignora `pl-4` — serviva `scroll-pl-4` per scroll-padding
- **Causa 3**: Logo h-10 troppo piccolo su mobile
- **Fix applicato**:
  - `setPointerCapture` solo per `pointerType === "mouse"`, touch usa CSS snap nativo
  - Aggiunto `scroll-pl-4 sm:scroll-pl-6` per rispettare padding con snap
  - `touchAction: "pan-x pan-y"` per non bloccare scroll nativo mobile
  - Cursor grab solo su desktop (`lg:cursor-grab`)
  - Logo mobile: h-10→h-12, barra h-12→h-14
- **Stato**: FIXATO

### BUG-003: Immagini a bassa risoluzione ancora visibili
- **Repro**: Alcune sagre mostrano immagini pixelate/piccole (es. "Fior Di Pasqua" Cittadella)
- **Fix applicato**: Rafforzato `isLowQualityUrl()` con nuovi pattern:
  - Thumbnail/small/mini/micro keywords nel path
  - Dimensioni URL <= 400px (era 150px) — query params e suffissi WordPress
  - Resize services (/resize/, =s150, =w300)
  - Pattern specifici per siti italiani (eventiesagre, assosagre, sagritaly, solosagre)
- **Stato**: FIXATO

### BUG-004: Filtri /cerca sidebar — campi attaccati su desktop
- **Repro**: Desktop → /cerca → filtri nella sidebar sinistra tutti compressi in griglia
- **Fix applicato**: Cambiato `lg:grid-cols-4` → `lg:grid-cols-1` in SearchFilters.tsx
- **Stato**: FIXATO

### BUG-005: Logo non visibile su mobile nella TopNav
- **Repro**: Mobile → logo non si vede nella barra di navigazione
- **Causa**: TopNav aveva `hidden lg:block` — completamente invisibile su mobile
- **Fix applicato**: Aggiunta barra mobile (h-12) con logo centrato (h-10), glass-nav, visibile solo sotto lg
- **Stato**: FIXATO

### BUG-006: Filtri /mappa — campi tutti full-width, troppo lunghi
- **Repro**: Desktop → /mappa → filtri sopra la mappa tutti impilati full-width
- **Fix applicato**: Aggiunta prop `variant` a SearchFilters ("sidebar" | "topbar")
  - Topbar: città a sx (w-64) + filtri in griglia 5 colonne a dx, tutto su una riga
  - Sidebar: layout verticale invariato
- **Stato**: FIXATO

### BUG-009: Drag va a scatti su smartphone + click sagra non naviga (REGRESSIONE)
- **Repro**: Mobile → swipe ScrollRow a scatti, tap su card non naviga
- **Causa**: `snap-always` (scroll-snap-stop: always) forza lo stop su ogni card, rendendo lo scroll a scatti. Peggio: anche un minimo movimento del dito durante il tap viene trattato come scroll, cancellando l'evento click.
- **Fix applicato**: Rimosso `snap-always` dalle card, mantenuto `snap-start` per allineamento morbido
- **Stato**: FIXATO

### BUG-010: Icona "altro" (forchetta+coltello) illeggibile a dimensioni piccole
- **Repro**: Card sagra "Festa dei Sapori e delle Tradizioni" ha icona astratta non riconoscibile
- **Causa**: Il coltello SVG era troppo sottile e astratto a 16px
- **Fix applicato**: Redesign icona "altro" con forchetta+coltello più leggibili (linee parallele forchetta, lama curva coltello)
- **Stato**: FIXATO

### BUG-011: Icona dolci sembra un edificio, non una torta
- **Repro**: Card con tag "Dolci" mostra icona rettangolare con zigzag (sembra palazzo)
- **Causa**: SVG torta con base rettangolare + candele zigzag = illeggibile a 16px
- **Fix applicato**: Redesign come cupcake con ciliegina, frosting dome, e wrapper conico. Aggiornato anche map-markers.ts
- **Stato**: FIXATO

### BUG-012: "Questo weekend" non visibile come prima row
- **Repro**: Homepage non mostra row "Questo weekend" quando < 3 sagre nel weekend
- **Causa**: ScrollRowSection ha MIN_ROW_ITEMS=3 hardcoded, nasconde la sezione con < 3 risultati
- **Fix applicato**: Aggiunta prop `minItems` a ScrollRowSection, passato `minItems={1}` per la row "Questo weekend"
- **Stato**: FIXATO

### BUG-013: Pin mappa — icona food troppo in alto nel pin
- **Repro**: Mappa → marker pin teardrop con icona food spostata verso l'alto, non centrata nel cerchio
- **Causa**: `translate(10,8)` metteva l'icona troppo in alto nel cerchio (centro cerchio a y=20)
- **Fix applicato**: Cambiato `translate(10,8)` → `translate(10,10)` per centratura verticale
- **Stato**: FIXATO

### BUG-014: Progress bar scroll non necessaria nella pagina dettaglio
- **Repro**: Pagina dettaglio sagra mostra barra progress in alto — articoli troppo corti per giustificarla
- **Fix applicato**: Rimosso `<ScrollProgress />` da SagraDetail.tsx
- **Stato**: FIXATO

### BUG-015: Immagini Unsplash non pertinenti (es. cetrioli per Festa dell'Olio)
- **Repro**: Sagre con immagini fallback non pertinenti al cibo specifico
- **Causa**: Pass 3 (Unsplash) cercava per tag generico (es. "italian food market") anziché per cibo specifico
- **Fix applicato**:
  - Aggiunto campo `unsplash_query` al prompt Gemini (Pass 2) — genera query specifiche in inglese (es. "olive oil food")
  - Nuova colonna `unsplash_query` nel DB (migration 017)
  - Pass 3 ora usa query LLM-generated quando disponibile, fallback a TAG_QUERIES
- **Stato**: FIXATO (richiede migration 017 + deploy edge function)

### BUG-016: Header troppo compatto, logo senza padding
- **Repro**: TopNav con logo attaccato ai bordi, barra poco spaziosa
- **Fix applicato**: Mobile h-14→h-16 con padding px-3 py-2. Desktop h-14→h-18 con padding px-2 py-3
- **Stato**: FIXATO

### BUG-017: Logo colore terracotta — utente vuole bordeaux acceso
- **Repro**: Logo PNG terracotta (#bd5342) non piace all'utente
- **Fix applicato**:
  - Colori SVG aggiornati: #bd5342→#9B1B30, #662b25→#5C0E28, #8b5a51→#7A2840
  - Logo.tsx ora usa SVG (unoptimized) invece di PNG
  - Brand CSS variables aggiornate: oklch(0.42 0.19 358) bordeaux
  - Colore "altro" food icon aggiornato a #9B1B30
- **Stato**: FIXATO

### BUG-018: Province display "()" vuota e nomi non normalizzati
- **Repro**: Card sagra mostra "Sarcedo ()" o "Sarcedo (verona)" invece di "Sarcedo (VI)"
- **Causa**: SagraCard, MapMarkerPopup, SagraDetail usavano sagra.province raw senza normalizzare a codice 2-letter. Se province non matchava → parentesi vuote.
- **Fix applicato**:
  - Creata funzione `provinceSuffix()` in veneto.ts (single source of truth)
  - Se provincia non corrisponde a nessun codice valido → niente parentesi
  - Se provincia è "verona" → normalizza a "(VR)"
  - Applicato a tutti e 3 i componenti (SagraCard, MapMarkerPopup, SagraDetail)
- **Stato**: FIXATO (commit d09f84d, pushato)

---

## Log Sessioni

### 2026-03-16 (sessione 6) — INTERROTTA: Piano Pexels come seconda fonte immagini
- **TASK IN CORSO**: Aggiungere Pexels Image API come seconda fonte immagini nel Pass 3 di enrich-sagre
- **Decisione utente**: Unsplash + Pexels (NO Pixabay). Pexels key già presente in .env (usata per video).
- **Contesto**:
  - Unsplash: 50 req/ora, buona qualità ma pochi piatti tipici italiani
  - Pexels: 200 req/ora, ottima per cibo italiano, key già in `.env` (PEXELS_API_KEY)
  - Strategia: fallback a cascata — Unsplash prima, se 0 risultati → Pexels
  - Questo triplica il budget API (50+200 = 250 req/ora) e migliora copertura per cibi specifici (baccalà, rane, fichi)
- **Explore agents completati** (prima del crash):
  1. Pexels Image API usage — 28 tool uses, API endpoint: `GET https://api.pexels.com/v1/search?query=...&per_page=30&orientation=landscape`
  2. enrich-sagre Pass 3 flow — 10 tool uses, capito dove inserire Pexels nel flusso
- **Piano era in fase di scrittura** quando il terminale è crashato (`supabase secrets list` ha perso la connessione)
- **PEXELS_API_KEY**: già in `.env` locale (usata da pexels-video.ts), da verificare se è anche nei Supabase secrets (`npx supabase secrets list`)
- **Modifiche unstaged**: enrich-sagre/index.ts ha già la RETRY PHASE (buildQueryFromTitle fallback) non ancora committata
- **DA FARE nella prossima sessione**:
  1. Verificare PEXELS_API_KEY nei Supabase secrets (se non c'è: `npx supabase secrets set PEXELS_API_KEY=...`)
  2. Modificare `runUnsplashPass()` in enrich-sagre/index.ts:
     - Aggiungere `fetchPexelsPhotos()` simile a `fetchUnsplashPhotos()`
     - Dopo Unsplash 0 risultati → provare Pexels prima del retry con buildQueryFromTitle
     - Pexels API: `GET https://api.pexels.com/v1/search`, header `Authorization: PEXELS_API_KEY`
     - Response: `{ photos: [{ src: { large2x, large, medium }, photographer, photographer_url }] }`
     - Image URL: `photo.src.large` (940px) o `photo.src.large2x` (1880px)
     - Credit: `photographer|photographer_url`
  3. Deploy enrich-sagre aggiornata
  4. Testare con run manuale
  5. Committare tutto

### 2026-03-16 (sessione 2) — Fix video/foto/icone/città + timeout audit
- **Video orientale FIXATO**: FOOD_VIDEO_QUERIES aggiornate (3→6 query, tutte con "Italian"/"Mediterranean"). Mai più cibo asiatico.
- **Foto non consone**: prompt Gemini aggiornato — vietato fallback generico "Italian food festival outdoor", ogni sagra deve avere query UNICA e SPECIFICA.
- **Migration 021 APPLICATA**: confermato dall'utente. Step 0 fixato con CASE inline (normalize_province_code non esiste in DB remoto).
- **Unsplash Pass 3 funzionante**: 28 immagini assegnate con query specifiche (italian village square, focaccia, cheese board, ecc.)
- **Città minuscole FIXATO**: CSS `capitalize` + `.toLowerCase()` su SagraCard, SagraDetail, MapMarkerPopup
- **Icona Rane FIXATO**: "Rane"/"Rana" mappato → "pesce" in TAG_TO_CATEGORY
- **Icona zucca ridisegnata**: ellisse larga con nervature verticali + gambo (più riconoscibile a 16px)
- **"Usa posizione" FIXATO**: bottone su riga separata full-width nella sidebar /cerca
- **Timeout audit**: TIME_BUDGET_MS confermato a 120s (free tier timeout effettivo ≥150s, non 60s). ARCHITETTURA.md aggiornata con strategia anti-timeout completa.
- **Edge functions**: tutte deployate (confermato dall'utente — 3 giorni fa + 1 oggi)
- **Fix JSON-LD raw in descrizioni**: scrape-sagretoday ora gestisce @type "EventSeries" + filtro `startsWith("{")` nel fallback body text

### 2026-03-16 (sessione 4+5) — Gemini flash-lite + icona Beef + fallback immagini per soggetto
- **Gemini 2.5 Flash → 2.5 Flash-Lite**: free tier aveva solo 20 RPD, causava 429 continui. Flash-Lite ha 1000 RPD.
- **Icona carne cambiata**: SVG custom ellisse+osso → **Lucide `Beef`**
- **Prompt Gemini unsplash_query RISCRITTO**: query DEVONO contenere almeno 1 alimento specifico
- **FALLBACK IMMAGINI RIFATTO COMPLETAMENTE** (sessione 5):
  - 33 soggetti × 5 varianti = 165 immagini locali (da Pexels API)
  - Nuovi soggetti: birra, radicchio, asparagi, polenta, baccala, salsiccia, castagne, mele, fragole, risotto, bufala, oca, focaccia, olio, bigoli, cinghiale, piselli, carciofi, rane, uva, miele, pasta
  - `getFallbackImage()` ora matcha dal TITOLO sagra (regex), poi food_tags, poi generico
  - "Festa della Birra" → mostra birra, NON tramonti
- **VIDEO FALLBACK SISTEMATO**: rimosso fallback per nome città, solo query per tema cibo
- **Commit b6a2479**: pushato su master, Vercel deploying

### 2026-03-16 (sessione 3) — Deploy edge functions + fix province + fix immagini duplicate
- **SQL pulizia descrizioni JSON-LD raw**: eseguito dall'utente
- **enrich-sagre DEPLOYATA** (2x):
  1. Primo deploy: nuovo prompt Gemini (query Unsplash uniche, no fallback generico)
  2. Secondo deploy: Pass 3 title-based fallback (buildQueryFromTitle con 40+ traduzioni cibo italiano→inglese)
- **scrape-sagretoday DEPLOYATA**: fix EventSeries + filtro JSON-LD raw
- **Province counts FIXATO**: ProvinceSection + SearchFilters ora usano code (BL) non name (Belluno)
- **Province code display FIXATO**: "(RO)" non "(Ro)" — CSS capitalize separato da provinceSuffix()
- **Immagini duplicate FIXATO**: problema era che reset unsplash_query senza reset status → Pass 3 usava TAG_QUERIES generiche → stesse foto per tutte le sagre con stesso tag. Fix: buildQueryFromTitle() estrae keyword dal titolo sagra.
- **Commit c7e2fdd**: 12 file (tutte fix sessione 2+3)
- **Commit f221cfb**: province code display fix (3 file)
- **Utente ha eseguito**: reset image_url + status→pending_llm per re-enrichment completo
- **IN CORSO**: TEST enrich-sagre per ri-generare immagini con query uniche
- **DA FARE**:
  - Commit enrich-sagre title-based fallback
  - Fonti TIER 1

### 2026-03-16 — Fix "poche sagre" + pulizia DB + file guida
- **Lookback 14→30 giorni**: tutte le query sagre.ts ora usano finestra 30 giorni per sagre senza end_date
- **Homepage**: getActiveSagre(120→200), MIN_ROW 3→2 (piu' righe con meno sagre)
- **Migration 019**: grace period 14gg per expire cron (applicata dall'utente)
- **Migration 020**: grace period esteso a 30gg + riattivazione sagre wrongly expired
- **Migration 021**: pulizia DB completa:
  - Normalizzazione province a codice 2 lettere
  - Deattivazione non-Veneto (es. "Toscana San Miniato")
  - Deduplicazione per normalized_title (es. "Fiera di Santa Sofia" x6 → 1)
  - Riattivazione fiere food wrongly killed (Fiera del Riso, ecc.)
  - Filtro non-sagre (visita guidata, tasting, tour, ecc.)
  - Re-enrichment sagre senza provincia (set status='new')
- **scrape-sagretoday aggiornato**: recupera start_date/end_date da JSON-LD dettaglio, priorita' sagre senza date
- **DB stats pre-fix**: 4528 totali, 1608 attive, 332 con provincia, 2920 disattivate, 1276 attive senza provincia/location
- **File guida creati**:
  - `.planning/PIPELINE.md` — regole definitive scraping/qualita'/date/province
  - `.planning/ARCHITETTURA.md` — aggiornato con migration 019-021
  - `.planning/ISTRUZIONI.md` — aggiornato con regole date/province/dedup
- Commits: dcb13cc (fix query + migration 019-020), 140931d (migration 021)
- **FATTO utente**: migration 021 applicata in SQL Editor (2026-03-16)
- **DA FARE utente**: deploy scrape-sagretoday

### 2026-03-13 (notte) — Province fix + 14-day lookback + enrichment pipeline
- **BUG-018 FIXATO**: Province display "()" vuota → `provinceSuffix()` helper, normalizza a codice 2-letter
- **14-day lookback**: sagre senza end_date appaiono se iniziate negli ultimi 14 giorni (fix "poche sagre")
- **3 nuovi food tags**: Zucca, Pane, Verdura nel prompt Gemini (llm.ts)
- **enrich-sagre migliorato**: loop con time budget 120s, rate limiting Gemini (4.5s tra batch), reset modes (?reset=all, ?reset=images)
- **Province code/name fix**: homepage CODE_TO_NAME, SagraCard PROVINCE_CODES accetta codici e nomi
- Commits: 4e53d85, d09f84d (pushati su Vercel)
- **DA FARE**: deploy enrich-sagre aggiornata, re-enrichment, investigare perché poche sagre visibili

### 2026-03-13 (sera 3) — Fix icone DEFINITIVO + scrapers separati + timeout fix
- **Giostre RIMOSSO completamente** da FoodCategory, ICONS, CATEGORY_COLORS, CATEGORY_PRIORITY, map-markers. MAI PIÙ icona giostre sulle card (sembrava lente d'ingrandimento a 16px).
- **Title-based fallback per icone**: se food_tags sono generici, il titolo della sagra determina l'icona (broccol→foglia, zucca→arancione, salsiccia→drumstick, baccalà→pesce, calici→vino, gnocchi→gnocco). FoodIcon riceve `title` prop.
- **"Altro" = forchetta+coltello**: per sagre il cui cibo non è determinabile.
- **20+ mapping extra in TAG_TO_CATEGORY**: Broccolo, Asparago, Bisi, Carciofi, Baccalà, Salsiccia, Tiramisù, etc.
- **Video hero-2.mp4 rimosso**: era cibo asiatico con bacchette (Pexels 2941127).
- **Prompt Zucca fixato**: "Zucca ha tag dedicato" (era erroneamente "va in Verdura").
- **Province count deduplicato**: getProvinceCounts ora deduplica per titolo (stesso filtro di /cerca).
- **Scrapers separati in 3 edge function**: timeout fix. scrape-sagretoday (1 provincia per invocazione, round-robin 30min), scrape-trovasagre, scrape-sagriamo. Ciascuna self-contained.
- **Migration 018**: pg_cron jobs per i 3 nuovi scrapers.
- **30 test food-icons** (10 nuovi per title fallback), tutti passano.
- Commits: ba5df5f, a4643a8, 7e8cbe7, 605421b, acb86cd, 461ecf0, 9c04cea, 7df8a79
- **FATTO utente** (2026-03-13/16): deploy edge functions + migration 018 + re-enrichment

### 2026-03-13 (sera 2) — 3 nuovi scrapers + video centri storici + Giostre + card overlay
- **3 nuovi scrapers implementati** (fonti 6→9):
  - sagretoday.it: JSON-LD da /sagre/veneto/{provincia}/page/{n}/, 318 sagre, 7 province
  - trovasagre.it: JSON API `backend-agg.php?action=sagre`, filtro regione=Veneto
  - sagriamo.it: REST API paginata `app.sagriamo.it/api/festival/all`, ~150 sagre Veneto
- **Video centri storici veneti**: rotazione in hero homepage (Padova, Verona, Venezia, Vicenza, Treviso, Bassano, Chioggia, Burano, Asolo). Interleave con video food. Preload prossimo video per zero flash bianco.
- **Giostre in FEATURE_TAGS**: aggiunto a enrich-sagre + llm.ts con guida nel prompt Gemini
- **Card overlay più scuro**: from-black/85 via-black/30 via-40% (era from-black/70 via-black/25)
- **Preload video**: hidden video element precarica il prossimo video durante la riproduzione
- Commit: ba5df5f
- **FATTO utente** (2026-03-13/16): deploy enrich-sagre + scrape-sagre

### 2026-03-13 (mattina 2) — Icone food redesign + calamita desktop + audit pipeline
- **Icona carne**: redesign da T-bone (illeggibile) a drumstick (coscia). Colore marrone #7C2D12 (era rosso).
- **Icona zucca**: separata da verdura. Zucca→icona zucca arancione dedicata (TAG_TO_CATEGORY fix).
- **Icona verdura**: foglia verde per tutte le verdure tranne zucca (bisi, radicchio, broccolo, funghi).
- **Icona giostre**: NUOVA. Ruota panoramica per sagre grandi con luna park. Colore amber #D97706.
- **Effetto CALAMITA desktop**: snapToNearest() al rilascio mouse. ScrollTo smooth alla card più vicina.
- **feature_tags**: aggiunto a SagraCardData + query + SagraCard per supporto giostre.
- **enrich-sagre deployata**: nuovi tag Pane/Verdura + prompt veneto. Triggerato run (ID 36).
- **Sagre verificate**: Tiramisu TV, Giuggiole Arquà, Calici Arquà/Montagnana, Olio Arquà, Tresto PD, Soco VI, Bisi Baone. Tutte esistono. Tresto/Soco/Bisi confermate su eventiesagre.
- **Audit fonti**: 6 fonti attuali + 8+ nuove identificate. Top 3: sagretoday.it (318 sagre!), trovasagre.it (API), sagriamo.it (API).
- **Video centri storici**: annotato TODO — alternare video centri storici veneti in homepage.
- Commit: 89dbabd
- **FATTO**: re-enrichment, Giostre in prompt Gemini, nuove fonti (sagretoday/trovasagre/sagriamo)

### 2026-03-13 (sera) — ScrollRow definitivo, video tematico, nuovi tag, mappa contenuta, logo grande
- **ScrollRow DEFINITIVO**: separazione TOTALE mobile/desktop via media query `(pointer: fine)`.
  - Mobile: ZERO JS handlers, puro CSS scroll-snap. Click sempre funzionante.
  - Desktop: JS drag + frecce, no snap. onClickCapture solo con hasFinePointer.
  - Rimosso inline `touchAction`, aggiunto `overscroll-x-contain`.
- **Video fallback tematico**: cerca per TEMA della sagra (primavera→spring, broccoli→vegetable market) PRIMA del nome comune. Mai più video irrilevanti.
- **Icona "altro"**: redesign da fork+knife (illeggibile) a steaming bowl (ciotola con vapore).
- **Pin mappa**: icona spostata più in basso (translate 10→12).
- **Mappa /mappa**: contenuta in max-w-7xl con rounded-xl (stessa larghezza header).
- **Gemini prompt migliorato**: istruzioni specifiche per gastronomia veneta (Pinza=focaccia NON dolce, Baccalà=Pesce, ecc.)
- **Nuovi food_tags**: "Pane" (focacce/pinza) e "Verdura" (orto/zucca/asparago).
- **Logo più grande**: h-14 mobile (era h-10), h-16 desktop (era h-12). Barra h-18/h-20.
- **Footer dialetto veneto**: "Ghemo usà un fia de foto bèe da Unsplash..."
- **Ricerca fonti scraping**: trovate 8+ nuove fonti (cheventi.it, culturaveneto.it, trovasagre.it, ecc.)
- Commit: c220840, e0f628c, 295d2b0, 961a908
- **FATTO**: deploy enrich-sagre + re-enrichment con nuovi tag

### 2026-03-13 — 10 bugfix + Unsplash image relevance con Gemini
- 10 bug/richieste dell'utente — tutti risolti in una sessione
- **ScrollRow**: rimosso `snap-always` (causa scatti mobile + click non funzionanti)
- **Icone food**: redesign cupcake (dolci) + forchetta/coltello più leggibili (altro)
- **Homepage**: "Questo weekend" sempre visibile (minItems=1)
- **Mappa**: pin icon centrata verticalmente (translate 8→10)
- **Dettaglio**: rimossa progress bar scroll
- **Unsplash**: Gemini genera query specifiche per immagini più pertinenti (migration 017)
- **Header**: più spazioso, padding aumentato
- **Logo**: SVG con palette bordeaux (#9B1B30), brand CSS variables aggiornate
- Migration 017 applicata al DB remoto + edge function enrich-sagre deployata
- File modificati: ScrollRow.tsx, food-icons.tsx, map-markers.ts, ScrollRowSection.tsx, page.tsx, SagraDetail.tsx, TopNav.tsx, Logo.tsx, globals.css, logo-nemo-via.svg, enrich-sagre/index.ts

### 2026-03-12 — Sessione planning + bugfix
- Discusso Tavily vs Cheerio: Tavily utile per discovery, non sostituto
- Discusso scraping FB/IG: Graph API unica via legale
- Discusso opzione "solo link" vs dati strutturati: Graph API dà tutti i campi necessari
- Discusso Apify ($49/mese): non giustificato adesso, solo se le opzioni free non bastano
- Creato PROGRESS.md come riferimento assoluto
- **Commit 49a9f83**: Fix filtri sidebar (lg:grid-cols-1), filtri mappa (variant topbar), marker icon centering
- **Commit ebd83e5**: Logo mobile, ScrollRow click fix, low-quality image filtering rafforzato
- Utente ha applicato migration 016 in Supabase SQL Editor
- 6 bug identificati e tutti FIXATI (BUG-001 a BUG-006)
- Pianificata Fase 3: sezione "Sagre dell'orto" in homepage

### 2026-03-12 (sera) — Hero overlay + bugfix UX
- **Hero dettaglio**: titolo + luogo sovrapposti sull'immagine con gradient scuro (from-black/70)
- **Video fallback**: Pexels Video API cerca video della città quando immagine non disponibile (fallback: città → provincia → "Veneto Italy")
- **Mappa mobile 2 dita**: MapGestureHandler disabilita drag 1 dito su mobile, mostra hint "Usa due dita", abilita drag con 2+ tocchi
- **Hero fade-out**: parallax ridotto (60→30px) + opacity fade-out graduale (70-100% scroll), elimina scomparsa brusca
- **ScrollRow snap-always**: `scroll-snap-stop: always` impedisce di saltare 2 card con swipe veloce
- Nuovi file: `pexels-video.ts`, `MapGestureHandler.tsx`
- File modificati: SagraDetail.tsx, page.tsx (sagra/[slug]), ParallaxHero.tsx, ScrollRow.tsx, MapView.tsx, DetailMiniMap.tsx

---

## Regole di Aggiornamento
1. Leggere PROGRESS.md all'inizio di OGNI sessione
2. Spostare task da `[ ]` a `[x]` quando completati
3. Aggiungere nuove scoperte/decisioni nelle sezioni appropriate
4. Aggiungere entry nel Log Sessioni ad ogni sessione
5. MAI cancellare task completati — servono come storico
