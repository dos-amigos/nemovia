# REGOLE TASSATIVE — LEGGERE PRIMA DI QUALSIASI AZIONE

## 0. ZERO FOTO SBAGLIATE, ZERO TESTO NON FORMATTATO — NON NEGOZIABILE
- OGNI immagine assegnata dal pipeline DEVE essere validata con Vision AI (Groq Vision)
- Vision AI verifica: "questa foto mostra [prodotto dal titolo sagra]?" — se NO → scartare, provare la prossima
- Query Unsplash DEVONO essere IPER-SPECIFICHE: mai "cheese" generico, mai "food Italian"
- Description DEVE essere formattata: paragrafi separati, emoji info pratiche, MAI muro di testo
- MAI inventare dati: indirizzi, telefoni, email, orari, menu — SOLO da fonte originale
- Se non c'è il dato nella fonte → NON includerlo. ZERO eccezioni.

## 1. NO CIBO ORIENTALE — GRAVISSIMO
MAI MAI MAI mostrare sushi, bacchette, ramen, cibo asiatico/orientale/cinese/giapponese in NESSUNA foto o video.
- OGNI query Pexels/Unsplash DEVE avere `-asian -sushi -chopsticks -ramen -chinese -japanese -wok`
- Filtro regex lato codice su OGNI video/immagine restituito da API
- Se in dubbio: NON usare quel video/immagine
- Il sito è SOLO sagre VENETE/ITALIANE

## 2. SEMPRE VERIFICARE PRIMA DI PARLARE
- `next build` prima di dire "fatto". MAI errori.
- Controllare dati REALI nel DB prima di comunicare numeri
- MAI proporre TODO vecchi o attività già fatte
- MAI rispondere a memoria per limiti/prezzi/specifiche tecniche — SEMPRE cercare prima

## 3. LE REGOLE DEVONO ESSERE NEL CODICE
Documentare non basta. Se una regola esiste, il codice DEVE enforcarla.
Esempio: "no cibo orientale" deve essere un filtro nel codice, non solo un commento.

## 4. RICERCA ESAUSTIVA
Tutte le alternative, non solo la prima. MAI farsi suggerire soluzioni ovvie dall'utente.

## 5. PROCESSO > SINGOLA FIX
Quando l'utente segnala un problema su UNA sagra, il fix deve essere AL PROCESSO/PIPELINE.
Non fixare solo il dato singolo — trovare la causa root e fixare il sistema.

## 6. AGENTI PARALLELI
Usare Task tool con più agenti insieme quando possibile. Massimizzare parallelismo.

## 7. NO RIPETIZIONI
Memorizzare SUBITO decisioni e contesto in PROGRESS.md + questo file.
L'utente lavora su DIVERSI PC — tutto deve essere nel repo, MAI in file locali.

## 8. UX/CONTENUTO
- NO low-res images — Unsplash/Pexels fallback se mancante/brutta
- SEMPRE provincia visibile — "Zugliano (VI)" non "Zugliano"
- Province code MAIUSCOLO — "(RO)" mai "(Ro)"
- Icone food: pesce e zucca SVG custom (Lucide non riconoscibili)
- Query Unsplash: SEMPRE includere un ALIMENTO specifico (generiche = foto brutte)
- Immagini Unsplash: scegliere dai TOP 5 risultati (per rilevanza), MAI random da 30

## 9. PIPELINE / ENRICHMENT
- MAI is_active:true all'inserimento — TUTTI gli scraper inseriscono con is_active:false
- Auto-approval: confidence>=50 + data + Veneto + futura
- is_sagra=false + confidence>=70 → needs_review (non discard)
- Provincia sconosciuta → needs_review (non discard)
- MAI sovrascrivere source_description — LLM scrive SOLO in enhanced_description
- LLM NON deve inventare tag/orari/menu/contatti
- Rane = carne (NON pesce)
- Dedup: deduplicate_sagre() cron giornaliero 02:00 UTC

## Riferimenti
- `.planning/PIPELINE.md` — bibbia scraping/qualita/date/province/dedup
- `.planning/ARCHITETTURA.md` — stack, schema DB, edge functions
- `.planning/ISTRUZIONI.md` — regole UX/contenuto dettagliate
- `.planning/RULES.md` — regole qualità dati
- `.planning/PROGRESS.md` — log sessioni, bug tracker, TODO
