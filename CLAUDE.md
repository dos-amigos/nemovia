# NEMOVIA — Guida Agente AI

> Aggregatore sagre del Veneto. Stack: Next.js 15, Supabase (PostGIS), Tailwind v4.
> Deploy: nemovia.it (Vercel). Repo: dos-amigos/nemovia.

---

## PRIMA DI TUTTO: Leggi questi file

| File | Cosa contiene | Quando leggerlo |
|------|--------------|-----------------|
| `.planning/PIPELINE.md` | BIBBIA: scraping, enrichment, qualita, date, province, dedup | Sempre, prima di toccare pipeline |
| `.planning/ARCHITETTURA.md` | Stack, schema DB, edge functions, componenti | Prima di scrivere codice |
| `.planning/FONTI.md` | Catalogo completo fonti: attive, da implementare, bloccate | Prima di aggiungere/modificare scraper |
| `.planning/ISTRUZIONI.md` | Regole UX/contenuto: icone, immagini, video, card, mappa | Prima di toccare frontend |
| `.planning/RULES.md` | Regole qualita dati (testo, titoli, descrizioni) | Prima di toccare enrichment |
| `.planning/PROGRESS.md` | Log sessioni, bug tracker, TODO | A inizio sessione per capire lo stato |

---

## REGOLE TASSATIVE (non negoziabili)

### 0. ZERO FOTO SBAGLIATE, ZERO TESTO NON FORMATTATO
- OGNI immagine assegnata dal pipeline DEVE essere validata con Vision AI (Groq Vision)
- Vision AI verifica: "questa foto mostra [prodotto dal titolo sagra]?" — se NO, scartare
- Query Unsplash DEVONO essere IPER-SPECIFICHE: mai "cheese" generico, mai "food Italian"
- Description DEVE essere formattata: paragrafi separati, emoji info pratiche, MAI muro di testo
- MAI inventare dati: indirizzi, telefoni, email, orari, menu — SOLO da fonte originale
- Se non c'e il dato nella fonte, NON includerlo. ZERO eccezioni.

### 1. NO CIBO ORIENTALE — GRAVISSIMO
MAI mostrare sushi, bacchette, ramen, cibo asiatico/orientale/cinese/giapponese in NESSUNA foto o video.
- OGNI query Pexels/Unsplash DEVE avere `-asian -sushi -chopsticks -ramen -chinese -japanese -wok`
- Filtro regex lato codice su OGNI video/immagine restituito da API
- Se in dubbio: NON usare quel video/immagine
- Il sito e SOLO sagre VENETE/ITALIANE

### 2. SEMPRE VERIFICARE PRIMA DI PARLARE
- `next build` prima di dire "fatto". MAI errori.
- Controllare dati REALI nel DB prima di comunicare numeri
- MAI proporre TODO vecchi o attivita gia fatte — leggere PROGRESS.md prima
- MAI rispondere a memoria per limiti/prezzi/specifiche tecniche — SEMPRE cercare prima

### 3. LE REGOLE DEVONO ESSERE NEL CODICE
Documentare non basta. Se una regola esiste, il codice DEVE enforcarla.
Esempio: "no cibo orientale" deve essere un filtro nel codice, non solo un commento.

### 4. RICERCA ESAUSTIVA
Tutte le alternative, non solo la prima. MAI farsi suggerire soluzioni ovvie dall'utente.

### 5. PROCESSO > SINGOLA FIX
Quando l'utente segnala un problema su UNA sagra, il fix deve essere AL PROCESSO/PIPELINE.
Non fixare solo il dato singolo — trovare la causa root e fixare il sistema.

### 6. AGENTI PARALLELI
Usare Agent tool con piu agenti insieme quando possibile. Massimizzare parallelismo.

### 7. NO RIPETIZIONI
L'utente lavora su DIVERSI PC — tutto deve essere nel repo, MAI in file locali.

### 8. NON MODIFICARE SE NON CHIESTO
Se l'utente chiede un parere o un'informazione, NON modificare codice. Chiedere prima.

---

## UX / CONTENUTO (regole rapide)

- NO low-res images — Unsplash/Pexels fallback se mancante/brutta
- SEMPRE provincia visibile — "Zugliano (VI)" non "Zugliano"
- Province code MAIUSCOLO — "(RO)" mai "(Ro)"
- Icone food: pesce e zucca SVG custom (Lucide non riconoscibili)
- Query Unsplash: SEMPRE includere un ALIMENTO specifico (generiche = foto brutte)
- Immagini Unsplash: scegliere dai TOP 5 risultati (per rilevanza), MAI random da 30
- Admin dashboard chiara, non un muro di dati

---

## PIPELINE / ENRICHMENT (regole rapide)

- MAI is_active:true all'inserimento — TUTTI gli scraper inseriscono con is_active:false
- Auto-approval: confidence>=70 + data + Veneto + futura
- is_sagra=false + confidence>=70 → needs_review (non discard)
- Provincia sconosciuta → needs_review (non discard)
- MAI sovrascrivere source_description — LLM scrive SOLO in enhanced_description
- LLM NON deve inventare tag/orari/menu/contatti
- Rane = carne (NON pesce)
- Dedup: deduplicate_sagre() cron giornaliero 02:00 UTC

---

## COME LAVORARE

### Ad ogni sessione
1. Leggere questo file (automatico)
2. Leggere `.planning/PROGRESS.md` per capire stato e TODO
3. Se servono dettagli, leggere i file specifici in `.planning/`
4. NON proporre attivita gia completate

### Salvare il progresso
- Aggiornare `.planning/PROGRESS.md` dopo ogni azione importante
- Aggiornare `.planning/FONTI.md` se si aggiungono/modificano fonti
- Aggiornare `.planning/PIPELINE.md` se cambia l'architettura pipeline
- Aggiornare `.planning/ARCHITETTURA.md` se cambia lo stack

### Commit e push
- Commit dopo ogni blocco di lavoro logico completato (non accumulare)
- Messaggio commit CHIARO e descrittivo in inglese: "feat: add scraper for prolocobellunesi.it with WordPress REST API"
- Prefissi: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Push ad ogni commit — l'utente lavora su piu PC
- MAI commit con errori di build

### Quando si aggiunge un nuovo scraper
1. Leggere `.planning/FONTI.md` per vedere cosa esiste e cosa manca
2. Leggere `.planning/PIPELINE.md` sezione "Aggiungere una nuova fonte"
3. Creare edge function `supabase/functions/scrape-<nome>/index.ts`
4. Tutti i filtri inline: isNoiseTitle, isNonSagraTitle, containsPastYear, dedup RPC
5. is_active: false all'inserimento (SEMPRE)
6. Migration per pg_cron
7. Deploy: `npx supabase functions deploy <nome> --project-ref lswkpaakfjtxeroutjsb`
8. Test con curl
9. Aggiornare FONTI.md e PROGRESS.md

---

## INFRASTRUTTURA

### Supabase
- Project ref: `lswkpaakfjtxeroutjsb`
- Piano: FREE (timeout edge functions effettivo >=150s)
- Deploy: `npx supabase functions deploy <nome> --project-ref lswkpaakfjtxeroutjsb`
- Migrations: `npx supabase db push --linked`

### Environment
- `.env` in `.gitignore`, keys in `.env` only
- UNSPLASH_ACCESS_KEY, PEXELS_API_KEY, TAVILY_API, ADMIN_PASSWORD in .env
- PEXELS_API_KEY, GEMINI_API_KEY in Supabase secrets
- GitHub Secrets: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TAVILY_API, APIFY_API, GEMINI_API_KEY, GROQ_KEY
- Vercel env vars: ADMIN_PASSWORD, SUPABASE_SERVICE_ROLE_KEY

### Key Patterns
- Server component → Supabase query (no RPC client-side)
- Dynamic import ssr:false per Leaflet
- nuqs per URL search params
- Edge Functions: copie inline (Deno), timeout effettivo >=150s
- Brand colors: --brand-l/c/h CSS vars (oklch)
