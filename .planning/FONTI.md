# FONTI — Catalogo Completo Sorgenti Dati

> Ultimo aggiornamento: 2026-03-27 (sessione 17).
> Per ogni fonte: stato, tipo, frequenza, volume stimato, note tecniche.

---

## 1. Fonti ATTIVE (33 totali: 27 Edge Functions + 3 GitHub Actions + 1 disattivata + 1 XLSX + social)

### Edge Functions — scrape-sagre (multi-source generico, Cheerio)

Le prime 6 fonti usano il generico `scrape-sagre` con selettori configurati nel DB.

| # | Fonte | Tipo | Freq | Volume | Stato | Note |
|---|-------|------|------|--------|-------|------|
| 1 | assosagre.it | Cheerio | 2x/day | ~20 sagre | OK | Detail con menu/orari |
| 2 | solosagre.com | Cheerio | 2x/day | ~15 | OK | |
| 3 | sagritaly.it | Cheerio | 2x/day | ~30 | OK | |
| 4 | eventiesagre.it | Cheerio | 2x/day | ~40 | OK | Filtro Veneto |
| 5 | itinerarinelgusto.it | Cheerio | 2x/day | ~150 | OK | Selettori aggiornati (migration 034) |
| 6 | culturaveneto.it | Cheerio | 2x/day | ~170 | OK | Fonte regionale ufficiale |

### Edge Functions — dedicati (1 per fonte)

| # | Fonte | Edge Function | Tipo | Freq | Volume | Stato | Note |
|---|-------|---------------|------|------|--------|-------|------|
| 7 | sagretoday.it | scrape-sagretoday | JSON-LD | 1x/day 06:00 | ~50 | OK | Era ogni 30min, ridotto |
| 8 | trovasagre.it | scrape-trovasagre | JSON API | 2x/day | ~20 | DATI TEST | API ha solo dati dummy 2025 |
| 9 | sagriamo.it | scrape-sagriamo | REST API | 2x/day | ~150 | OK | |
| 10 | cheventi.it | scrape-cheventi | Cheerio | 2x/day | ~10 | OK | JSON-LD, GPS coords |
| 11 | insagra.it | scrape-insagra | REST API JSON | 2x/day | ~1.038 | OK | API upgrade, GPS+tel+email inclusi |
| 12 | prolocobellunesi.it | scrape-prolocobellunesi | WP REST API | 2x/day | ~50 BL | OK | The Events Calendar, copre tutto BL |
| 13 | anteprimasagre.it | scrape-anteprimasagre | WP REST API | 2x/day | ~80 | OK | TV+VE+PD+VI |
| 14 | 2d2web.com | scrape-2d2web | Cheerio | 2x/day | ~224 | OK | 132 inserite al primo run, multi-provincia |
| 15 | gardaclick.com | scrape-gardaclick | Cheerio | 1x/day | ~20 VR | OK | Area Garda |
| 16 | eventivicenza | scrape-eventivicenza | JSON API | 2x/day | ~1-5 VI | OK | REST API /opendata/api/, GPS coords |
| 17 | regioneveneto (XLSX) | scrape-regioneveneto | XLSX parser | 1x/week lun 06:15 | **1.123** | OK | FONTE DEFINITIVA, tutte le sagre per legge |
| 18 | trevisoeventi.com | scrape-trevisoeventi | HTML | 2x/day | ~80-100 TV | OK | Treviso-specifico |
| 19 | easyvi.it | scrape-easyvi | AJAX `/getevents.php` | 2x/day | ~provincia VI | OK | |
| 20 | 4jesoloevents.it | scrape-4jesoloevents | HTML | 2x/day | ~40 VE | OK | Jesolo, dati eccellenti |
| 21 | invenicetoday.com | scrape-invenicetoday | HTML | 2x/day | ~37 VE | OK | Feste veneziane, parrocchiali/rionali |
| 22 | arquapetrarca.com | scrape-arquapetrarca | HTML | 2x/day | ~8 PD | OK | Giuggiole, Olio Novello, Colli Euganei |
| 23 | venetoedintorni.it | scrape-venetoedintorni | HTML | 2x/day | ~100+ | OK | Copre TUTTO il Veneto, filtro sagre |
| 24 | visitchioggia.com | scrape-visitchioggia | HTML | 2x/day | ~10-20 VE | OK | Chioggia+Sottomarina, Sagra del Pesce |
| 25 | visitfeltre.info | scrape-visitfeltre | WP REST API | 2x/day | ~50 BL | OK | Custom evento post type, Feltrino |
| 26 | caorle.eu | scrape-caorle | HTML | 2x/day | ~10-15 VE | OK | Festa del Pesce, vino |
| 27 | prolocovicentine.it | scrape-prolocovicentine | WordPress | 2x/day | ~30+ VI | OK | Federazione Pro Loco vicentine |
| 28 | panesalamina.com | scrape-panesalamina | WordPress | 2x/day | ~20-30 VR | OK | VR sud/ovest, Valeggio, Isola della Scala |
| 29 | primarovigo.it | scrape-primarovigo | HTML | 2x/day | ~10-15 RO | OK | Rovigo provincia, sagre e feste |

### GitHub Actions (Node.js)

| # | Fonte | Freq | Stato | Note |
|---|-------|------|-------|------|
| 30 | Facebook events | Daily 08:00 | STAGIONALE | Tutti isPast:true ora, riprende in stagione |
| 31 | Tavily Search | Ogni 3gg 10:00 | OK | Discovery, 33 sagre/run |
| 32 | Instagram/Apify | Lun+Gio 09:00 | OK | Pagine da external_sources |

### Disattivate

| # | Fonte | Motivo | Data |
|---|-------|--------|------|
| 33 | venetoinfesta.it | Sito quasi morto, 2 eventi, selettori rotti | 2026-03-27 (migration 033) |

---

## 2. FONTE DEFINITIVA — XLSX Regione Veneto

**PRIORITA MASSIMA.** La Regione Veneto pubblica un file XLSX ufficiale con TUTTE le sagre che servono cibo in Veneto. Per legge ogni sagra deve essere registrata. E la fonte piu completa e autorevole possibile.

- **Tipo**: File XLSX scaricabile (zero scraping, zero anti-bot)
- **Copertura**: 100% sagre registrate in tutto il Veneto
- **Rischio legale**: Zero (dati pubblici istituzionali)
- **Implementazione**: Parser XLSX -> import nel DB
- **URL**: `https://www.regione.veneto.it/documents/10713/13530434/Calendario+sagre+e+fiere+18.02.2026.xlsx/...`
- **Entries**: 1,123 sagre (VI 388, TV 237, VR 192, PD 123, VE 95, BL 66, RO 22)
- **Colonne**: Provincia, Comune, Denominazione, Periodo/orario, Attivita, Sito web, Organizzatore
- **Base legale**: DGR 184/2017, LR 34/2014
- **Stato**: IMPLEMENTATO (sessione 17, migration 040, cron 1x/settimana lunedi 06:15 UTC)

---

## 3. Fonti DA IMPLEMENTARE (ricerca completata 2026-03-27)

### MEDIA PRIORITA

| # | Fonte | Provincia | Volume | Tipo | Note |
|---|-------|-----------|--------|------|------|
| 1 | eventideltapo.it | RO | Delta del Po | HTML | Tutte le localita del Delta |
| 2 | visitcavallino.com | VE | Cavallino-Treporti | HTML | Portale turistico |
| 3 | adorable.belluno.it | BL | Belluno citta | WP REST API | |
| 4 | trevisoinfo.it | TV | ~40 | HTML statico `<li>` | Semplicissimo |

### BASSA PRIORITA

| # | Fonte | Provincia | Note |
|---|-------|-----------|------|
| 5 | visitmarostica.eu | VI | 15 eventi fino al 2027 |
| 6 | eventivenetando.it | TV nord | JSON API, solo Marca Trevigiana |
| 7 | agordinodolomiti.it | BL | 16 comuni, WordPress REST API |
| 8 | visitschio.it | VI | 40+ eventi/settimana |
| 9 | cittadiverona.it | VR | Sezione sagre, WordPress |
| 10 | prolocobassoveronese.it | VR | Basso veronese, hyper-locale |
| 11 | ecolinea.bio | VR | Ha GPS coords |
| 12 | comune.venezia.it | VE | Ufficiale municipale, feste |
| 13 | evenice.it | VE | Aggregatore Venezia |

### NON FATTIBILI (bloccate/morte)

| Fonte | Motivo |
|-------|--------|
| TrevisoToday.it | 403, Citynews anti-bot aggressivo |
| PadovaOggi.it | 403, Citynews anti-bot aggressivo |
| VicenzaToday.it | 403, Citynews anti-bot aggressivo |
| VeronaSera.it | 403, Citynews anti-bot aggressivo |
| VisitTreviso.it | Timeout, JS pesante |
| ProLocoVenete.it | 403 bloccato |
| visitrovigo.it | JS widget TOSC5, serve Playwright |
| rovigoveneto.it | Dati 2019, non mantenuto |
| virgilio.it | JS pesante, API offuscata |
| eventideltapo.it | Dominio morto (redirect a web agency) |
| VenetoSagre.it | Dati 2019 |
| Veneto.eu | Angular SPA |
| IlTurista.info | 403 |
| VeneziaToday.it | 403, Citynews anti-bot aggressivo |

---

## 4. Fonti per Provincia (copertura attuale)

| Provincia | Fonti dedicate | Fonti generiche (tutte le province) | Gap residuo |
|-----------|---------------|--------------------------------------|-------------|
| **TV** | trevisoeventi, anteprimasagre | eventiesagre, itinerarinelgusto, insagra, 2d2web, venetoedintorni, regioneveneto, tavily | trevisoinfo (bassa prio) |
| **VR** | gardaclick, panesalamina | sagritaly, eventiesagre, insagra, 2d2web, venetoedintorni, regioneveneto, tavily | OK — ben coperta |
| **PD** | arquapetrarca | eventiesagre, insagra, sagriamo, anteprimasagre, 2d2web, venetoedintorni, regioneveneto, tavily | OK |
| **VI** | eventivicenza, easyvi, prolocovicentine | eventiesagre, anteprimasagre, 2d2web, venetoedintorni, regioneveneto, tavily | OK — 3 fonti dedicate |
| **BL** | prolocobellunesi, visitfeltre | eventiesagre, 2d2web, venetoedintorni, regioneveneto, tavily | OK |
| **VE** | 4jesoloevents, invenicetoday, visitchioggia, caorle | eventiesagre, insagra, anteprimasagre, 2d2web, venetoedintorni, regioneveneto, tavily | visitcavallino (media prio) |
| **RO** | primarovigo | insagra, culturaveneto, 2d2web, venetoedintorni, regioneveneto, tavily | OK |

### Riepilogo copertura

| Provincia | N. fonti totali | Fonti dedicate |
|-----------|----------------|----------------|
| TV | 9 | 2 |
| VR | 9 | 2 |
| PD | 9 | 1 |
| VI | 9 | 3 |
| BL | 7 | 2 |
| VE | 11 | 4 |
| RO | 7 | 1 |

---

## 5. Pagine Social (external_sources)

### Facebook
- Sagre Veneto (74.897 like) — facebook.com/sagre.veneto/
- Sagre in Veneto (35.000+ follower) — facebook.com/SagrenelVeneto/
- UNPLI Veneto Pro Loco — facebook.com/unpliveneto.proloco
- Pro Loco Verona (9.848 like) — facebook.com/prolocoverona/

### Instagram
- Gestite da admin via external_sources table

### Social DA AGGIUNGERE (da ricerca Venezia + costiere)

**Facebook:**
- festadesanpierodecasteo (San Piero, la piu grande festa veneziana)
- asf.venezia (Sant'Antonio, Castello)
- bragora (San Giovanni in Bragora)
- Sagra Del Pesce Chioggia, Festa del Pesce Caorle
- Feste Marinare Cortellazzo, Sagra S.Stefano Portosecco
- Pro Loco Rosolina, Pro Loco Caorle, Pro Loco Eraclea
- Pro Loco Thiene, Pro Loco Schio, Pro Marostica
- Rovigo Eventi (@rovigoeventioj)
- prolocoarquapetrarca, comunearquapetrarca

**Instagram:**
- @festadesanpierodecasteo, @festabenefica_s.giacomo, @asf_venezia
- @sagradelpescechioggia
- @arquapetrarca

---

## 6. Note Tecniche

- **MAI is_active:true all'inserimento** — tutti inseriscono con is_active:false
- **Dedup al volo**: RPC find_duplicate_sagra() prima di ogni insert
- **containsPastYear()**: filtro dinamico su anni passati
- **Deploy**: `npx supabase functions deploy <nome> --project-ref lswkpaakfjtxeroutjsb`
- **Test**: `curl -s "https://lswkpaakfjtxeroutjsb.supabase.co/functions/v1/<nome>" -H "Authorization: Bearer $SERVICE_ROLE_KEY"`
- **Widget TOSC5**: usato da UNPLI Padova, Visit Cittadella, Welcome Saccisica — se si reverse-engineera l'API si sbloccano tutte
- **CityNews network** (TrevisoToday, PadovaOggi, VicenzaToday, VeronaSera, VeneziaToday): tutti 403, serve Apify o proxy
