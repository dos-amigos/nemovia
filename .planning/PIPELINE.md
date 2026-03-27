# PIPELINE — Algoritmo Completo Scraping, Enrichment, Qualità

> **BIBBIA** del progetto. Ogni decisione su dati, scraping, immagini, qualità è qui.
> Struttura replicabile: cambiando soggetto (mercatini, eventi medievali...) basta
> modificare le sezioni marcate con 🎯.
> Ultimo aggiornamento: 2026-03-20 (sessione 13).

---

## 1. Architettura Pipeline

```
FONTI (13 scraper)
    ↓
INSERIMENTO → is_active=false, status='pending_geocode'
    ↓
DEDUP al volo (RPC find_duplicate_sagra)
  → stesso paese + stesse date = stessa sagra (merge sources)
  → titolo simile + città simile = stessa sagra (pg_trgm > 0.6)
    ↓
ENRICHMENT Pass 1: GEOCODING (Nominatim, 1 req/sec)
  → location_text → coordinate GPS + provincia (2-letter)
  → Non-Veneto → discard
  → Già enriched senza GPS → aggiunge coordinate senza resettare status
    ↓
ENRICHMENT Pass 2: LLM (chain multi-provider)
  → Groq Llama 3.1 8B (14.400 RPD gratis)
  → Mistral Small (86.400 RPD gratis)
  → Gemini 2.5 Flash (20 RPD gratis)
  → Vertex AI Gemini (crediti Cloud, ultimo resort)
  → Genera: food_tags, feature_tags, enhanced_description, unsplash_query
  → Auto-approval: confidence≥70 + data YYYY-MM-DD valida + Veneto + futura
    ↓
ENRICHMENT Pass 3: IMMAGINI (catena 3 provider)
  → Unsplash (50 req/ora) — primario
  → Pexels (200 req/ora) — fallback
  → Pixabay (100 req/min) — terzo livello
  → Query specifica per sagra (generata da LLM basata su descrizione)
    ↓
EXPIRE CRON (01:00 ogni giorno)
  → end_date < oggi → disattiva
  → start_date < oggi - 30gg (senza end_date) → disattiva
  → Anno precedente → disattiva
    ↓
FRONTEND
  → Dedup: location+date, poi titolo esatto
  → Filtro: is_active=true AND province IS NOT NULL
  → Fallback immagini: 33 soggetti × 10 foto locali (Pexels)
  → Fallback video: Pexels Video API per tema cibo
```

---

## 2. 🎯 Fonti Scraping

### Edge Functions (Supabase, pg_cron)
| Fonte | Tipo | Frequenza | Note |
|-------|------|-----------|------|
| assosagre.it | Cheerio | 2x/giorno | Dettaglio con menu/orari |
| venetoinfesta.it | Cheerio | 2x/giorno | |
| solosagre.com | Cheerio | 2x/giorno | |
| sagritaly.it | Cheerio | 2x/giorno | |
| eventiesagre.it | Cheerio | 2x/giorno | Filtro Veneto |
| itinerarinelgusto.it | Cheerio | 2x/giorno | |
| sagretoday.it | JSON-LD | Ogni 30min | 1 provincia a rotazione |
| trovasagre.it | JSON API | 2x/giorno | |
| sagriamo.it | REST API | 2x/giorno | |
| cheventi.it | Cheerio | 2x/giorno | |
| insagra.it | JSON-LD | 2x/giorno | Listing + detail pages, GPS coords |

### GitHub Actions (Node.js)
| Fonte | Frequenza | Note |
|-------|-----------|------|
| Facebook Graph API | Daily 08:00 | Pagine da external_sources |
| Tavily Search API | Ogni 3gg 10:00 | Discovery nuove sagre |
| Instagram (Apify) | Lun+Gio 09:00 | Pagine da external_sources |

### Filtri pre-inserimento (tutti gli scraper)
1. `isNoiseTitle()` — skip titoli rumore (calendario, navigazione)
2. `isNonSagraTitle()` — skip non-sagre (concerti, mostre, mercatini non-food)
3. `containsPastYear()` — **skip pagine con SOLO anni passati** nel titolo/URL/body. Dinamico: usa `new Date().getFullYear()`. Se trova "2025" ma non "2026" → skip. Se trova "2025-2026" → ok.
4. `isPastYearEvent()` — skip se date estratte sono di anno passato
5. `isCalendarDateRange()` / `isExcessiveDuration()` — skip date impossibili
6. `find_duplicate_sagra()` RPC — dedup prima di inserire

### Aggiungere una nuova fonte
1. Creare edge function `scrape-<nome>/index.ts`
2. Inline: normalizzazione, dedup hash, province mapping, **containsPastYear**
3. **is_active: false** all'inserimento (SEMPRE)
4. Chiamare `find_duplicate_sagra()` RPC prima di inserire
5. Aggiungere pg_cron job in nuova migration
6. Testare con curl + service_role_key
7. Aggiornare PIPELINE.md e PROGRESS.md

---

## 3. 🎯 Regole Auto-Approval

Una sagra viene auto_approved (visibile sul sito) SOLO se TUTTE queste condizioni:

| Condizione | Implementazione |
|-----------|----------------|
| `is_sagra = true` | LLM classifica come sagra specifica |
| `confidence >= 70` | LLM score 0-100 |
| `start_date` valida YYYY-MM-DD | Regex `/^\d{4}-\d{2}-\d{2}$/` — NO stringhe generiche |
| Provincia Veneto | `province` in BL/PD/RO/TV/VE/VI/VR |
| Data futura | `end_date >= oggi` o `start_date >= oggi` |

Se NON soddisfa → `needs_review` (visibile solo in admin).
Se non è una sagra o confidence < 30 → `discarded`.
Se alta confidence ma non Veneto → `discarded` silenziosamente.

---

## 4. Province — Regole Ferree

- **SEMPRE codice 2 lettere maiuscole**: BL, PD, RO, TV, VE, VR, VI
- MAI nomi completi nel DB
- Display: "Città (XX)" — funzione `provinceSuffix()`
- Sagre senza provincia = **invisibili** nel frontend
- Non-Veneto → `is_active=false`

---

## 5. Date — Regole Ferree

- **Senza data valida → MAI auto_approved** (va in needs_review)
- Date LLM accettate solo se formato YYYY-MM-DD (regex)
- **LLM NON deve inventare l'anno**: se la fonte dice "15-20 settembre" senza anno → `null`
  Solo se c'è scritto esplicitamente "2026" o "settembre 2026" può usare quell'anno.
  Date di anni passati (2025, 2024...) → `null`
- Expire: grace period 30gg per sagre senza end_date
- Query frontend: lookback 30 giorni

---

## 6. Deduplicazione — 3 Livelli

### Livello 1: In-scraper (al momento dell'inserimento)
RPC `find_duplicate_sagra()` cerca:
- **Metodo A**: Titolo simile (pg_trgm > 0.6) + città simile (> 0.5)
- **Metodo B**: Stessa città + stesse date esatte (qualsiasi titolo)
Se trovato → merge sources, non inserire duplicato.

### Livello 2: Frontend (query time)
`deduplicateByTitle()` rimuove duplicati per:
1. location_text + start_date (priorità)
2. titolo esatto lowercase

### Livello 3: Pulizia periodica (manuale/migration)
SQL: GROUP BY normalized_title, keep best version.

---

## 7. 🎯 LLM Enrichment — Prompt e Regole

### Provider chain (in ordine)
1. **Groq** Llama 3.1 8B — 14.400 RPD gratis, veloce
2. **Mistral** Small — 86.400 RPD gratis
3. **Gemini** 2.5 Flash — 20 RPD gratis (AI Studio free tier)
4. **Vertex AI** Gemini — crediti Cloud 254€ (solo emergenza)

### Cosa genera il LLM (per ogni sagra)
| Campo | Regola |
|-------|--------|
| `is_sagra` | true solo per evento singolo specifico, non elenchi/articoli |
| `confidence` | 0-100, basato su completezza dati |
| `clean_title` | Titolo pulito, senza date/luoghi, max 80 char |
| `city` | Comune specifico (non provincia) |
| `province_code` | BL/PD/RO/TV/VE/VI/VR o null |
| `start_date` | YYYY-MM-DD o null |
| `end_date` | YYYY-MM-DD o null |
| `food_tags` | Max 3 da: Pesce, Carne, Vino, Formaggi, Funghi, Radicchio, Zucca, Dolci, Pane, Verdura, Prodotti Tipici |
| `feature_tags` | Max 2 da: Musica, Artigianato, Bambini, Tradizionale, Giostre |
| `description` | Italiano, paragrafi con emoji (📍🕐📞), max 1200 char |
| `unsplash_query` | 3-5 parole EN, SPECIFICO al cibo/prodotto dalla descrizione |

### Regole gastronomia veneta 🎯
- Pinza/Pinzin = "Pane" (focaccia veneta, NON dolci)
- Baccalà/Stoccafisso = "Pesce"
- Zucca = tag dedicato (NON Verdura)
- Gnocchi = "Prodotti Tipici"
- Se non si capisce il cibo → ["Prodotti Tipici"]
- MAI inventare tag non presenti nella descrizione

### Regole description (formato paragrafi)
```
Paragrafo 1: Descrizione evento (storia, edizione, cosa si fa)

Paragrafo 2: Menu e piatti (se dati disponibili)

📍 Indirizzo
🕐 Orari
🎟️ Ingresso
📞 Contatti
```
MAI inventare dettagli non presenti nella fonte originale.

### Regole unsplash_query
- Leggere TUTTA la descrizione per capire il soggetto SPECIFICO
- "Palio del Chiaretto" → "rosé pink wine glass vineyard" (NON "wine" generico)
- "Festa delle Ciliegie" → "fresh red cherries tree branch" (NON "berries")
- VIETATO: "festival", "celebration", "market", "outdoor", "traditional", "Italian food"
- Se titolo è già chiaro ("Sagra del Baccalà") → basta il titolo

---

## 8. Immagini — Pipeline 3 Livelli

### Livello 1: Immagini da fonte (scraping)
- Scraper estrae image_url dalla pagina sorgente
- `isLowQualityUrl()` rifiuta: thumbnail, placeholder, favicon, logo, < 400px

### Livello 2: API Immagini (enrichment Pass 3)
Catena: **Unsplash → Pexels → Pixabay**
- Query = `unsplash_query` generata da LLM (specifica per sagra)
- Se query non trova nulla → `buildQueryFromTitle()` (traduce keyword dal titolo)
- Hash deterministico per varietà (stessa query, foto diverse per sagre diverse)

### Livello 3: Fallback locali
- 33 soggetti × 10 foto = 330 immagini locali da Pexels
- Matching: regex su titolo → soggetto → foto random dal pool
- Soggetti: birra, radicchio, asparagi, polenta, baccalà, ciliegie, fragole, castagne, mele, risotto, olio, rane, funghi, zucca, ...

### Regole immagini
- **MAI** cibo asiatico, bacchette, cucina orientale
- **MAI** foto generiche "Italian food" — sempre il PRODOTTO specifico
- Ciliegie ≠ fragole ≠ lamponi (Unsplash confonde i frutti rossi)
- Chiaretto = vino rosato (NON spritz)
- Query Unsplash con `-asian -sushi -chopsticks` quando rilevante

### Video fallback (pagina dettaglio)
- Se sagra non ha immagine → Pexels Video API cerca per tema cibo
- Query con `-asian -chopsticks -sushi -ramen`
- Se no video → fallback immagine locale

---

## 9. 🎯 Filtri Euristici — Cosa È/Non È una Sagra

### È una sagra ✅
- Sagre del cibo, feste gastronomiche
- Fiere con componente food (Fiera del Riso, Fiera del Baccalà)
- Feste di piazza con cucina tipica
- "sagra", "festa", "gastronomic" nel titolo

### NON è una sagra ❌
- Articoli che ELENCANO più eventi ("Le sagre di agosto a Padova")
- Calendari, guide, roundup ("cosa fare questo weekend")
- Titoli con PLURALE generico ("Sagre e feste", "Eventi enogastronomici")
- Visite guidate, escursioni, convegni, concerti puri
- Wine tasting puri, antiquariato, mercatini non-food
- Vinitaly e simili expo commerciali

### Regola chiave
Una vera sagra ha UN nome specifico ("Sagra della Zucca"), NON un titolo che descrive una categoria.

---

## 10. Schedule Completo

### pg_cron (Supabase)
| Job | Orario | Funzione |
|-----|--------|----------|
| scrape-sagre | 06:00, 18:00 | 6 fonti Cheerio |
| enrich-sagre | Ogni 10 min | Pipeline 3 pass, 120s budget |
| expire-sagre | 01:00 | Disattiva sagre scadute |
| scrape-sagretoday | Ogni 30 min | 1 provincia a rotazione |
| scrape-trovasagre | 07:15, 19:15 | API JSON |
| scrape-sagriamo | 07:20, 19:20 | REST API |
| scrape-cheventi | 2x/giorno | Cheerio |
| scrape-insagra | 07:35, 19:35 | JSON-LD listing+detail |

### GitHub Actions
| Job | Orario | Note |
|-----|--------|------|
| Facebook | Daily 08:00 UTC | Graph API |
| Tavily | Ogni 3gg 10:00 UTC | Discovery |
| Instagram | Lun+Gio 09:00 UTC | Apify |

---

## 11. Environment Variables

### Supabase Secrets (edge functions)
```
GEMINI_API_KEY     — Google AI Studio (free tier 20 RPD)
GROQ_KEY           — Groq (14.400 RPD gratis)
MISTRAL_KEY        — Mistral (86.400 RPD gratis)
PEXELS_API_KEY     — Pexels images + video
UNSPLASH_ACCESS_KEY — Unsplash images
PIXABAY_API_KEY    — Pixabay images (100 req/min)
```

### GitHub Secrets (Actions)
```
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
TAVILY_API, APIFY_API, GEMINI_API_KEY
```

### .env locale
```
Tutti i sopra + ADMIN_PASSWORD
```

---

## 12. Migrazioni Applicate

| # | Scopo |
|---|-------|
| 001-017 | Schema base, pipeline, enrichment, immagini, province |
| 018 | pg_cron per sagretoday/trovasagre/sagriamo |
| 019-020 | Grace period expire 14→30gg |
| 021 | Pulizia DB: dedup, filtri non-sagre, province |
| 022-026 | Varie fix pipeline |
| 027 | Dedup RPC cerca ALL sagre (non solo active) |
| 028 | Dedup per location+date (non solo titolo) |

---

## 13. 🎯 Per Replicare su Altro Verticale

Per adattare a "mercatini", "eventi medievali", etc:

1. **Fonti**: cambiare lista scraper (sezione 2)
2. **Filtri euristici**: cambiare cosa è/non è l'evento target (sezione 9)
3. **Tag**: cambiare food_tags/feature_tags con categorie appropriate (sezione 7)
4. **Regole dominio**: gastronomia veneta → regole del nuovo dominio (sezione 7)
5. **Fallback immagini**: scaricare foto tematiche appropriate (sezione 8)
6. **Auto-approval**: potrebbe servire criteri diversi (sezione 3)
7. **Prompt LLM**: adattare a classificare il nuovo tipo di evento (sezione 7)

Il resto (architettura, dedup, geocoding, pipeline, provider chain) è **generico e riutilizzabile**.
