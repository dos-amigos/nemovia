# FONTI — Catalogo Completo Sorgenti Dati

> Ultimo aggiornamento: 2026-03-27 (sessione 17).
> Per ogni fonte: stato, tipo, frequenza, volume stimato, note tecniche.

---

## 1. Fonti ATTIVE (18 totali, 17 operative)

### Edge Functions (Supabase, pg_cron)

| # | Fonte | Tipo | Freq | Volume | Stato | Note |
|---|-------|------|------|--------|-------|------|
| 1 | assosagre.it | Cheerio | 2x/day | ~20 sagre | OK | Detail con menu/orari |
| 2 | solosagre.com | Cheerio | 2x/day | ~15 | OK | |
| 3 | sagritaly.it | Cheerio | 2x/day | ~30 | OK | |
| 4 | eventiesagre.it | Cheerio | 2x/day | ~40 | OK | Filtro Veneto |
| 5 | itinerarinelgusto.it | Cheerio | 2x/day | ~150 | FIXATA sess.17 | Selettori aggiornati (migration 034) |
| 6 | sagretoday.it | JSON-LD | 1x/day 06:00 | ~50 | OK | Era ogni 30min → troppa spazzatura |
| 7 | trovasagre.it | JSON API | 2x/day | ~20 | DATI TEST | API ha solo dati dummy 2025 |
| 8 | sagriamo.it | REST API | 2x/day | ~150 | OK | |
| 9 | cheventi.it | Cheerio | 2x/day | ~10 | OK | JSON-LD, GPS coords |
| 10 | insagra.it | JSON-LD | 2x/day | ~40 | NUOVO sess.17 | 15 sagre al primo run, 4 RO! |
| 11 | culturaveneto.it | Cheerio | 2x/day | ~170 | OK | Fonte regionale ufficiale |
| 12 | prolocobellunesi.it | WP REST API | 2x/day | ~50 BL | NUOVO sess.17 | The Events Calendar, copre tutto BL |
| 13 | anteprimasagre.it | WP REST API | 2x/day | ~80 TV | NUOVO sess.17 | Sagre-focused, TV+VE+PD+VI |
| 14 | 2d2web.com | Cheerio | 2x/day | ~224 | NUOVO sess.17 | 132 inserite al primo run! Multi-provincia |

### GitHub Actions (Node.js)

| # | Fonte | Freq | Stato | Note |
|---|-------|------|-------|------|
| 12 | Facebook events | Daily 08:00 | STAGIONALE | Tutti isPast:true ora, riprende in stagione |
| 13 | Tavily Search | Ogni 3gg 10:00 | OK | Discovery, 33 sagre/run |
| 14 | Instagram/Apify | Lun+Gio 09:00 | OK | Pagine da external_sources |

### Disattivate

| Fonte | Motivo | Data |
|-------|--------|------|
| venetoinfesta.it | Sito quasi morto, 2 eventi, selettori rotti | 2026-03-27 (migration 033) |

---

## 2. FONTE DEFINITIVA — XLSX Regione Veneto

**PRIORITÀ MASSIMA.** La Regione Veneto pubblica un file XLSX ufficiale con TUTTE le sagre che servono cibo in Veneto. Per legge ogni sagra deve essere registrata. È la fonte più completa e autorevole possibile.

- **Tipo**: File XLSX scaricabile (zero scraping, zero anti-bot)
- **Copertura**: 100% sagre registrate in tutto il Veneto
- **Rischio legale**: Zero (dati pubblici istituzionali)
- **Implementazione**: Parser XLSX → import nel DB
- **Stato**: DA IMPLEMENTARE

---

## 3. Fonti DA IMPLEMENTARE (ricerca completata 2026-03-27)

### ALTA PRIORITÀ

| # | Fonte | Provincia | Volume | Tipo | Note |
|---|-------|-----------|--------|------|------|
| 1 | prolocobellunesi.it | BL | 60 Pro Loco | WordPress REST API `/wp-json/tribe/events/v1/events/` | Copre TUTTO BL con un solo scraper |
| 2 | anteprimasagre.it | TV (tutto Veneto) | ~80 sagre/anno | WordPress REST API | Solo sagre, aggiornato settimanalmente |
| 3 | 2d2web.com | Tutto Veneto | ~60+ sagre | HTML statico, ASP.NET paginato `?pg=N` | Multi-provincia |
| 4 | eventi.comune.vicenza.it | VI | dati strutturati | REST API pubblica `/opendata/api/` | Fonte istituzionale |

### MEDIA PRIORITÀ

| # | Fonte | Provincia | Volume | Tipo | Note |
|---|-------|-----------|--------|------|------|
| 5 | gardaclick.com | VR | 130+ eventi | HTML statico | Area Garda, facile |
| 6 | trevisoeventi.com | TV | ~80-100/anno | HTML statico | Treviso-specifico, no anti-bot |
| 7 | easyvi.it | VI | provincia intera | AJAX `/getevents.php` | |
| 8 | 4jesoloevents.it | VE | 40+ eventi | HTML | Dati eccellenti |
| 9 | trevisoinfo.it | TV | ~40 | HTML statico `<li>` | Semplicissimo |

### BASSA PRIORITÀ

| # | Fonte | Provincia | Note |
|---|-------|-----------|------|
| 10 | visitmarostica.eu | VI | 15 eventi fino al 2027 |
| 11 | eventivenetando.it | TV nord | JSON API, solo Marca Trevigiana |
| 12 | agordinodolomiti.it | BL | 16 comuni, WordPress REST API |
| 13 | visitschio.it | VI | 40+ eventi/settimana |
| 14 | cittadiverona.it | VR | Sezione sagre, WordPress |

### NON FATTIBILI (bloccate/morte)

| Fonte | Motivo |
|-------|--------|
| TrevisoToday.it | 403, Citynews anti-bot aggressivo |
| VisitTreviso.it | Timeout, JS pesante |
| ProLocoVenete.it | 403 bloccato |
| visitrovigo.it | JS widget TOSC5, serve Playwright |
| rovigoveneto.it | Dati 2019, non mantenuto |
| virgilio.it | JS pesante, API offuscata |
| eventideltapo.it | Dominio morto (redirect a web agency) |
| VenetoSagre.it | Dati 2019 |
| Veneto.eu | Angular SPA |
| IlTurista.info | 403 |

---

## 4. Fonti per Provincia (copertura attuale)

| Provincia | Sagre attive | Fonti principali | Gap |
|-----------|-------------|-------------------|-----|
| TV | 17 | eventiesagre, itinerarinelgusto, insagra | Manca anteprimasagre, trevisoeventi |
| VR | 16 | sagritaly, eventiesagre, insagra | Manca gardaclick, visitverona |
| PD | 11 | eventiesagre, insagra, sagriamo | OK ma ampliabile |
| VI | 6 | eventiesagre | Manca eventi.comune.vicenza, easyvi |
| BL | 6 | eventiesagre | Manca prolocobellunesi (coprirebbe tutto) |
| VE | 5 | eventiesagre, insagra | Manca 4jesoloevents |
| RO | 1→5 | insagra (nuovo!) | Manca culturaveneto filtro RO |

---

## 5. Pagine Social (external_sources)

### Facebook
- Sagre Veneto (74.897 like) — facebook.com/sagre.veneto/
- Sagre in Veneto (35.000+ follower) — facebook.com/SagrenelVeneto/
- UNPLI Veneto Pro Loco — facebook.com/unpliveneto.proloco
- Pro Loco Verona (9.848 like) — facebook.com/prolocoverona/

### Instagram
- Gestite da admin via external_sources table

---

## 6. Note Tecniche

- **MAI is_active:true all'inserimento** — tutti inseriscono con is_active:false
- **Dedup al volo**: RPC find_duplicate_sagra() prima di ogni insert
- **containsPastYear()**: filtro dinamico su anni passati
- **Deploy**: `npx supabase functions deploy <nome> --project-ref lswkpaakfjtxeroutjsb`
- **Test**: `curl -s "https://lswkpaakfjtxeroutjsb.supabase.co/functions/v1/<nome>" -H "Authorization: Bearer $SERVICE_ROLE_KEY"`
- **Widget TOSC5**: usato da UNPLI Padova, Visit Cittadella, Welcome Saccisica — se si reverse-engineera l'API si sbloccano tutte
