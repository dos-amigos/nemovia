# PIPELINE — Regole Definitive Scraping, Qualita', Date, Province

> **BIBBIA** per ogni attivita' di scraping e qualita' dati futura.
> Ultimo aggiornamento: 2026-03-16.

---

## 1. Flusso Dati Completo

```
SCRAPING (9 fonti)
    |
    v
 [sagre] status='pending_geocode'
    |
    v
ENRICHMENT Pass 1: Geocoding (Nominatim)
  - location_text → coordinate GPS + provincia (2-letter code)
  - Non-Veneto → is_active=false, status='geocode_failed'
    |
    v
 [sagre] status='pending_llm'
    |
    v
ENRICHMENT Pass 2: LLM (Google Gemini 2.5 Flash-Lite — 1000 RPD free tier)
  - Genera: food_tags, feature_tags, enhanced_description, unsplash_query
  - Budget: 120s totale, rate limit 4.5s tra batch
    |
    v
 [sagre] status='enriched'
    |
    v
ENRICHMENT Pass 3: Immagini (Unsplash API)
  - Cerca con unsplash_query (generata da Gemini)
  - Fallback: 5 immagini curate per categoria
    |
    v
EXPIRE CRON (01:00 ogni giorno)
  - end_date < oggi → is_active=false
  - start_date < oggi - 30 giorni (senza end_date) → is_active=false
  - Anno precedente → is_active=false
    |
    v
QUERY FRONTEND
  - is_active=true AND province IS NOT NULL
  - end_date >= oggi OR (end_date NULL AND start_date >= oggi - 30gg) OR (entrambi NULL)
```

---

## 2. Province — Regole Ferree

### Formato DB
- **SEMPRE codice 2 lettere maiuscole**: BL, PD, RO, TV, VE, VR, VI
- MAI nomi completi nel DB (Verona, Padova, ecc.)
- Se Nominatim ritorna "Provincia di Padova" → normalizzare a "PD"

### Normalizzazione
```
belluno, provincia di belluno → BL
padova, provincia di padova → PD
rovigo, provincia di rovigo → RO
treviso, provincia di treviso → TV
venezia, provincia di venezia → VE
verona, provincia di verona → VR
vicenza, provincia di vicenza → VI
```

### Regole
1. Sagre senza provincia sono **invisibili** (tutte le query richiedono `province IS NOT NULL`)
2. Province non-Veneto → `is_active=false, status='geocode_failed'`
3. Display: sempre "Citta' (XX)" — mai citta' sola, mai duplicare se gia' presente
4. Funzione `provinceSuffix()` in `veneto.ts` per display consistente

### Diagnosi "poche sagre"
Se ci sono poche sagre visibili, controllare:
```sql
-- Quante attive senza provincia?
SELECT count(*) FROM sagre WHERE is_active=true AND province IS NULL;
-- Se > 0: serve re-enrichment (set status='new' per ri-geocodare)
```

---

## 3. Date — Regole Ferree

### Campi
- `start_date`: data inizio evento (DATE, nullable)
- `end_date`: data fine evento (DATE, nullable)

### Logica Expire (cron giornaliero 01:00)
```sql
-- Sagre da disattivare:
WHERE is_active = true AND (
  -- Con end_date esplicita passata
  (end_date IS NOT NULL AND end_date < CURRENT_DATE)
  -- Senza end_date: grace period 30 giorni dalla start_date
  OR (end_date IS NULL AND start_date IS NOT NULL
      AND start_date < CURRENT_DATE - INTERVAL '30 days')
  -- Anno precedente
  OR (start_date IS NOT NULL
      AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
)
```

### Logica Query Frontend (lookback 30 giorni)
```
Mostra sagra SE:
  end_date >= oggi                                          (multi-day, non scaduta)
  OR (end_date NULL AND start_date >= oggi - 30 giorni)     (senza fine, recente)
  OR (end_date NULL AND start_date NULL)                    (senza date)
```

### Perche' 30 giorni (non 14)
Molte sagre durano 2-4 settimane ma gli scraper non estraggono `end_date`.
Con 14 giorni, una sagra del 1 marzo spariva il 15 marzo anche se era ancora attiva.
30 giorni copre la maggior parte delle sagre mensili.

### Recupero date mancanti
- `scrape-sagretoday` estrae `startDate`/`endDate` da JSON-LD delle pagine dettaglio
- Priorita': sagre con `start_date IS NULL` vengono scrapate per prime
- Pattern: NULL-only update (non sovrascrive date gia' presenti)

---

## 4. Deduplicazione — 3 Livelli

### Livello 1: In-scraper (al momento dell'inserimento)
- `content_hash` (MD5 di title+location_text+start_date) → se esiste, merge sources
- `find_duplicate_sagra()` RPC → fuzzy match su `normalized_title` (pg_trgm similarity > 0.6)

### Livello 2: DB (migration periodica)
- `normalized_title` → PARTITION BY, keep most enriched version
- Criteri ordinamento: status='enriched' > con end_date > con image > con description > con province > piu' vecchia

### Livello 3: Applicativo (query frontend)
- `deduplicateByTitle()` in `sagre.ts` — rimuove duplicati per titolo lowercase

### Diagnosi duplicati
```sql
SELECT normalized_title, count(*) as cnt
FROM sagre WHERE is_active = true
GROUP BY normalized_title HAVING count(*) > 1
ORDER BY cnt DESC LIMIT 20;
```

---

## 5. Filtri Euristici — Cosa E'/Non E' una Sagra

### E' una sagra (is_active = true)
- Sagre del cibo, feste gastronomiche
- Fiere con componente food significativa (Fiera del Riso, Fiera del Baccala')
- Feste di piazza con cucina tipica
- Manifestazioni con "sagra", "festa", "gastronomic" nel titolo

### NON e' una sagra (is_active = false)
- Visite guidate, escursioni, trekking
- Wine tasting puri (senza cibo), degustazioni vini
- Convegni, conferenze, workshop
- Mostre fotografiche, gallerie, musei
- Concerti, spettacoli teatrali (senza cibo)
- Maratone, gare sportive, tornei
- Antiquariato, mercatini non-food
- Vinitaly e simili expo vini commerciali

### Blocklist hardcoded
```
Vinitaly — in enrich-sagre
```

### Filtri SQL (migration 021)
```sql
-- Deattivare SE contiene:
visita guidata, guided tour, escursion, passeggiata, trekking
tasting, degustazione vini, wine tasting
convegno, conferenza, seminario, workshop, corso, lezione
mostra fotografica, esposizione, galleria, museo
concerto, spettacolo teatrale, recital, opera lirica
maratona, corsa, gara ciclistica, torneo, campionato
vinitaly, wine show, expo vini

-- PROTETTI (non deattivare anche se contengono parole sopra):
sagra, sagre, festa, feste, gastronomic, culinari
polenta, gnocch, risott, baccal, pesce, carne, porchetta, grigliat
```

### Trappola "fiera"
Migration 008 deattivava TUTTE le "fiere". Ma molte fiere venete SONO sagre del cibo.
**Regola**: "fiera" da sola NON e' motivo di deattivazione. Deattivare solo se
combinata con termini non-food (antiquariato, artigianato puro, ecc.).

---

## 6. Immagini — Pipeline Qualita'

### 3 livelli di difesa
1. **Scraping**: `isLowQualityUrl()` rifiuta thumbnail, placeholder, favicon, logo sito
2. **Enrichment**: Gemini genera `unsplash_query` specifico → Unsplash cerca immagine pertinente
3. **Display**: fallback a 5 immagini curate per categoria se URL mancante o low-quality

### Pattern URL rifiutati
```
Tracking pixel, placeholder, favicon, logo sito
thumbnail WordPress (150x150, 300x300)
data: URI
Dimensioni URL <= 400px
Siti specifici: eventiesagre/thumb, assosagre/thumb, sagritaly/_small, solosagre/s/
```

### Regole query Unsplash (generate da Gemini)
- 2-4 parole in inglese
- Soggetto = keyword dopo "Sagra del/della", tradotto
- Vino = calici, versato, uva, vigneti. MAI bottiglie/etichette
- Olio = olive, versato, frantoio. MAI depositi/macchinari
- Pinza veneta = focaccia flatbread. MAI dolci/torte

---

## 7. Scraper — Architettura

### Regole generali
- **Edge Functions separate** per ogni scraper pesante (timeout 60s free / 150s pro)
- **Chunking**: 1 provincia per invocazione (sagretoday)
- **NULL-only update**: detail scraping aggiorna solo campi NULL (non sovrascrive)
- **Copie inline**: funzioni pure copiate dentro la edge function (Deno non importa da src/)
- **Rate limiting**: 1-1.5s tra richieste HTTP, 4.5s tra batch Gemini (modello: gemini-2.5-flash-lite, 1000 RPD free tier)

### Schedule (pg_cron)
| Job | Orario | Note |
|-----|--------|------|
| scrape-sagre | 06:00, 18:00 | 6 fonti Cheerio |
| enrich-sagre | 06:30, 18:30 | Pipeline 3 pass, budget 120s |
| expire-sagre-daily | 01:00 | Grace period 30 giorni |
| scrape-sagretoday | Ogni 30 min | 1 provincia a rotazione |
| scrape-trovasagre | 07:15, 19:15 | API JSON singola |
| scrape-sagriamo | 07:20, 19:20 | API REST paginata |

### Aggiungere una nuova fonte
1. Creare edge function `scrape-<nome>/index.ts`
2. Inline: normalizzazione, dedup hash, province mapping
3. Aggiungere pg_cron job in nuova migration
4. Testare con curl + service_role_key (MAI `supabase functions invoke`)
5. Aggiungere il nome fonte a questo file e a PROGRESS.md

---

## 8. Query Frontend — Parametri Chiave

| Parametro | Valore | Dove |
|-----------|--------|------|
| Lookback window | 30 giorni | sagre.ts (tutte le funzioni) |
| getActiveSagre limit | 200 | sagre.ts default param |
| Homepage limit | 200 | page.tsx getActiveSagre(200) |
| MIN_ROW | 2 | page.tsx (minimo sagre per riga) |
| MAX_PROVINCE_ROWS | 3 | page.tsx |
| MAX_FOOD_ROWS | 4 | page.tsx |
| getWeekendSagre limit | 20 | page.tsx |
| searchSagre limit | 50 | sagre.ts |
| searchMapSagre (RPC) | 200 | sagre.ts |

---

## 9. Diagnosi "Poche Sagre" — Checklist

Se l'homepage mostra poche sagre:

1. **Quante sagre attive con provincia?**
   ```sql
   SELECT count(*) FROM sagre WHERE is_active=true AND province IS NOT NULL;
   ```
   Se < 50: problema di enrichment (province non assegnate)

2. **Quante attive senza provincia?**
   ```sql
   SELECT count(*) FROM sagre WHERE is_active=true AND province IS NULL;
   ```
   Se > 0: serve re-enrichment → `UPDATE sagre SET status='new' WHERE is_active=true AND province IS NULL AND location IS NULL;`

3. **Quante disattivate con date future?**
   ```sql
   SELECT count(*) FROM sagre WHERE is_active=false AND end_date >= CURRENT_DATE;
   ```
   Se > 0: filtri euristici troppo aggressivi, investigare

4. **Duplicati?**
   ```sql
   SELECT normalized_title, count(*) FROM sagre WHERE is_active=true
   GROUP BY normalized_title HAVING count(*) > 1;
   ```

5. **Scraper funzionano?**
   ```sql
   SELECT source_name, status, count(*), max(started_at)
   FROM scrape_logs GROUP BY source_name, status ORDER BY source_name;
   ```

---

## 10. Migrazioni Applicate

| # | Nome | Scopo |
|---|------|-------|
| 001 | foundation | Schema base, tabella sagre |
| 002 | scraping_pipeline | scraper_sources, scrape_logs |
| 003 | enrichment | Status pipeline, indici |
| 004 | discovery | find_duplicate_sagra RPC |
| 005 | data_quality | content_hash, normalized_title |
| 006 | heuristic_filters | Filtri automatici (durata, anno, rumore) |
| 007 | dedup_classification | Dedup avanzata |
| 008 | retroactive_cleanup | Filtro keyword (fiera, mercato, mostra) |
| 009 | filter_recalibration | Whitelist food per riattivare false positive |
| 010 | province_normalization | normalize_province_code() SQL function |
| 011 | add_itinerarinelgusto | Nuova fonte |
| 012 | unsplash_image_credit | Colonna image_credit |
| 013 | scraping_completeness | Detail scraping columns |
| 014 | unsplash_extra_cron | Cron extra per immagini |
| 015 | nearby_image_credit | find_nearby_sagre image_credit |
| 016 | nearby_add_location | find_nearby_sagre + location |
| 017 | unsplash_query_column | Colonna unsplash_query |
| 018 | custom_scraper_cron_jobs | Cron per sagretoday/trovasagre/sagriamo |
| 019 | fix_expire_grace_period | Grace period 14gg per sagre senza end_date |
| 020 | extend_grace_period_30days | Grace period 14→30gg + riattivazione |
| 021 | db_cleanup_dedup_reactivate | Dedup, ri-attiva fiere food, filtra non-sagre |
