# Ricerca Fonti: Citta principali, piccoli centri, localita costiere

> Ricerca completata 2026-03-27 sessione 17. Risultati di 8 agenti paralleli.

---

## PATTERN TRASVERSALE: CityNews Network

trevisotoday.it, padovaoggi.it, vicenzatoday.it, veronasera.it — stessa piattaforma, JSON-LD Event.
PROBLEMA: tutti restituiscono **403** (anti-bot aggressivo). Serve Apify o proxy.

---

## TOP FONTI DA IMPLEMENTARE (ordine priorita)

### PRIORITA MASSIMA — Coprono aree grandi con un solo scraper

| # | Fonte | Copertura | Tipo | Volume | Note |
|---|-------|-----------|------|--------|------|
| 1 | **venetoedintorni.it** | TUTTO il Veneto | HTML, filtro `/tipo=sagre` | 100+ | Copre TUTTI i piccoli centri |
| 2 | **visitchioggia.com** | Chioggia+Sottomarina (VE) | HTML | 10-20 | Sagra del Pesce (87a edizione!) |
| 3 | **visitfeltre.info** | Feltrino (BL) | WP REST API `/wp-json/wp/v2/evento` | 50+ | Custom evento post type |
| 4 | **caorle.eu** | Caorle (VE) | HTML | 10-15 | Festa del Pesce, vino |
| 5 | **prolocovicentine.it** | Tutto VI | WordPress | 30+ | Federazione Pro Loco |
| 6 | **panesalamina.com** | VR sud/ovest | WordPress | 20-30 | Valeggio, Isola della Scala |
| 7 | **InSagra API upgrade** | Tutto Veneto | REST API JSON | 1.038 | GPS+tel+email inclusi! |

### MEDIA PRIORITA — Aree specifiche

| # | Fonte | Copertura | Note |
|---|-------|-----------|------|
| 8 | primarovigo.it | Rovigo provincia | Sagre e feste section |
| 9 | eventideltapo.it | Delta del Po (RO) | Tutte le localita del Delta |
| 10 | visitcavallino.com | Cavallino-Treporti (VE) | Portale turistico |
| 11 | adorable.belluno.it | Belluno citta | WP REST API |
| 12 | prolocobassoveronese.it | Basso veronese (VR) | Hyper-locale |
| 13 | ecolinea.bio | Verona provincia | Ha GPS coords! |

### PAGINE SOCIAL DA AGGIUNGERE (pipeline esistente)

**Facebook:**
- Sagra Del Pesce Chioggia, Festa del Pesce Caorle
- Feste Marinare Cortellazzo, Sagra S.Stefano Portosecco
- Pro Loco Rosolina, Pro Loco Caorle, Pro Loco Eraclea
- Pro Loco Thiene, Pro Loco Schio, Pro Marostica
- Rovigo Eventi (@rovigoeventioj)

**Instagram:**
- @sagradelpescechioggia

---

## SAGRE SPECIFICHE TROVATE PER LOCALITA COSTIERA

### Chioggia/Sottomarina
- Sagra del Pesce (87a ed., 10-19 luglio 2026) — 10 sere, Corso del Popolo
- Palio della Marciliana (giugno)

### Caorle
- Festa del Pesce (11-13 settembre 2026) — sulla spiaggia
- Caorle Wine & Art (6-7 luglio 2026)

### Pellestrina
- Sagra di Santo Stefano di Portosecco (agosto, 56a ed.)
- Sagra di Sant'Antonio (luglio)
- Festa di San Pietro in Volta (fine giugno)

### Rosolina
- Festa dell'Anguilla / Sagra di San Rocco (5-16 agosto 2026)

### Jesolo (gia coperto da 4jesoloevents)
- Feste Marinare di Cortellazzo (luglio-agosto)
- Equilium in Festa (19-25 giugno 2026)

### Eraclea
- Sagra Gesu Buon Pastore di Valcasoni (aprile)
- Sagra Poenta e Osei, Sagra dell'Assunta

### Cavallino-Treporti
- Festa dea Sparesea (1 maggio) — asparagi
- Sagra dea Sucheta — prugne gialle

### Bibione
- Festa dell'Asparago Bianco (fine aprile)
- Septemberfest (settembre)
