# ISTRUZIONI — Regole Contenuto e UX

Riferimento definitivo su **cosa mostrare e come**. Per l'architettura tecnica vedi `ARCHITETTURA.md`.

---

## 1. Icone Food

8 categorie. Giostre **non** e' una categoria icona (solo feature_tag nel DB).

| Categoria | Icona | Colore | Hex |
|-----------|-------|--------|-----|
| carne | Drumstick (custom SVG) | warm brown | `#7C2D12` |
| pesce | Fish (custom SVG) | sky blue | `#0EA5E9` |
| zucca | Pumpkin (custom SVG) | orange | `#EA580C` |
| verdura | Leaf (Lucide) | green | `#16A34A` |
| gnocco | Dumpling (custom SVG) | golden | `#CA8A04` |
| vino | Wine glass (custom SVG) | bordeaux | `#881337` |
| dolci | Cupcake (custom SVG) | magenta | `#DB2777` |
| altro | UtensilsCrossed (Lucide) | brand primary | `#9B1B30` |

**Priorita' (tag multipli):** carne > pesce > zucca > gnocco > verdura > vino > dolci > altro

### Mapping tag → categoria

| Tag DB | Categoria |
|--------|-----------|
| Carne, Salsiccia, Maiale, Pollo, Cinghiale, Oca, Anatra | carne |
| Pesce, Baccala', Stoccafisso, Sarde, Anguilla | pesce |
| Zucca | zucca |
| Gnocchi | gnocco |
| Verdura, Broccolo/i, Radicchio, Asparago/i, Funghi, Carciofo/i, Fagioli, Bisi, Piselli | verdura |
| Vino | vino |
| Dolci, Tiramisu', Frittelle, Galani | dolci |
| Pane, Formaggi, Prodotti Tipici | altro |

### Fallback da titolo (quando food_tags mancano)

```
/broccol|radicch|asparag|carciof|fagiol|bisi|pisell|funghi|verdur|orto/  → verdura
/zucca|zucche/                                                           → zucca
/carne|salsiccia|maiale|pollo|oca|anatra|cinghial|bistecca|grigliata/    → carne
/pesce|baccalà|stoccafisso|sarde|anguilla|mare|frutti di mare/           → pesce
/vino|vendemmia|calici|prosecco|cantina/                                 → vino
/dolci|tiramisu|tiramisù|frittell|galani|torta|gelato/                   → dolci
/gnocc/                                                                  → gnocco
```

---

## 2. Immagini

### Query Unsplash per categoria

| Soggetto | Query |
|----------|-------|
| Pesce | `fresh seafood platter Mediterranean` |
| Carne | `grilled meat outdoor Italian barbecue` |
| Vino | `wine glass pouring vineyard sunset` |
| Formaggi | `Italian cheese board rustic` |
| Funghi | `porcini mushroom Italian dish` |
| Radicchio | `radicchio red chicory Italian salad` |
| Dolci | `Italian pastry dessert table` |
| Pane | `Italian focaccia flatbread rustic` |
| Verdura | `fresh vegetables Italian garden market` |
| Prodotti Tipici | `Italian food market outdoor rustic` |
| Default | `italian sagra food festival` |

### Regole query (generate da Gemini)

- 2-4 parole in **inglese**
- Soggetto = keyword dopo "Sagra del/della/delle", tradotto
- Es: "Festa dell'Olio" → `olive oil pouring bread`, "Sagra della Pinza" → `Italian focaccia flatbread`
- **Vietato**: cibi non nel titolo. Olio != miele, Pinza != cheese, Pasqua != cannoli
- **Vino** = calici, vino versato, uva, vigneti. **MAI** bottiglie o etichette
- **Olio** = olio versato, olive, frantoio. **MAI** depositi o macchinari

### Pattern immagini rifiutate (low-quality)

Tracking pixel, placeholder, favicon, logo sito, thumbnail WordPress, data URI, dimensioni URL <= 400px.
Siti specifici: `eventiesagre/thumb`, `assosagre/thumb`, `sagritaly/_small`, `solosagre/s/`.

### Fallback immagini — REGOLA TASSATIVA

**Sistema a 3 livelli:**
1. **Unsplash query specifica** (da Gemini `unsplash_query`) — priorità massima
2. **Immagini locali per SOGGETTO specifico** — quando Unsplash non disponibile
3. **MAI immagini generiche** — ogni sagra deve avere un'immagine pertinente al suo tema

**Immagini locali per soggetto** (`/public/images/fallback/{soggetto}-{1..5}.jpg`):
- Scaricare da Unsplash 5 foto BELLE e SPECIFICHE per ogni soggetto
- Categorie OBBLIGATORIE (basate su analisi sagre attive):
  radicchio, zucca, pesce, vino, uva, formaggio, gnocchi, bigoli, cinghiale,
  piselli, carciofi, asparagi, funghi, polenta, baccalà, salsiccia, castagne,
  mele, fragole, riso, bufala, oca, dolci, pane/focaccia, olio, birra,
  prodotti-tipici, generico-sagra
- Ogni soggetto ha 5 varianti → assegnazione RANDOM per hash ID sagra
- Con 5 varianti per soggetto è MOLTO improbabile che sagre vicine abbiano la stessa foto
- La keyword del soggetto si estrae dal TITOLO: "Sagra del Radicchio" → soggetto "radicchio"
- Se il soggetto non ha immagini locali dedicate → fallback alla categoria food tag più vicina

**VIETATO:**
- Foto di mercati generici, tendoni, bancarelle senza cibo riconoscibile
- Foto non pertinenti al soggetto (luna per bufala, spaghetti per radicchio)
- Stessa immagine ripetuta su più sagre visibili contemporaneamente

---

## 3. Video

### Video locali curati

5 video nel progetto + 12 query citta' venete (Padova Prato della Valle, Verona arena, Venezia canal grande, Vicenza piazza, Treviso fiume, Bassano ponte, ecc.).

### Video dettaglio sagra — REGOLA TASSATIVA

**Sistema a 3 livelli (stesso principio delle immagini):**
1. **Video Pexels per SOGGETTO sagra** — cerca il CIBO/TEMA dal titolo, NON la città
2. **Video locali per soggetto** (`/public/videos/fallback/{soggetto}-{1..5}.mp4`) — quando Pexels non disponibile
3. **Video locali hero generici** (centri storici veneti, cibo italiano) — ultimo fallback

**Video locali per soggetto** — scaricare da Pexels 5 video per ogni tema:
  radicchio, pesce, vino, formaggio, gnocchi, carne-griglia, asparagi, funghi,
  polenta, dolci, pane, olio, pizza, pasta, mercato-italiano, sagra-generica
- Assegnazione RANDOM per hash ID sagra (5 varianti → no duplicati)
- La keyword si estrae dal TITOLO: "Festa della Bufala" → cerca "buffalo mozzarella", NON "Terrassa Padovana"

**Ordine ricerca video Pexels:**
1. Soggetto dal titolo sagra (tradotto in inglese)
2. Se nessun risultato → food tag principale
3. Se nessun risultato → video locale per soggetto
4. **MAI** cercare per nome città — produce risultati irrilevanti (luna, panorami, traffico)

### Divieti assoluti

- **MAI** cibo asiatico, bacchette, cucina orientale
- **MAI** cercare video per nome città (produce luna, panorami, traffico)
- **MAI** video irrilevanti al tema sagra (luna per bufala, tramonto per radicchio)
- **SOLO** cibo italiano, campagna veneta, centri storici

---

## 4. Prompt Gemini

### Food tags possibili

`Pesce, Carne, Vino, Formaggi, Funghi, Radicchio, Zucca, Dolci, Pane, Verdura, Prodotti Tipici`

### Feature tags possibili (max 2)

`Gratis, Musica, Artigianato, Bambini, Tradizionale, Giostre`

### Regole gastronomia veneta

| Alimento | Regola |
|----------|--------|
| Pinza veneta | = FOCACCIA → tag **Pane**, MAI "Dolci" |
| Polenta | "Prodotti Tipici" o "Carne" se accompagnata da carne |
| Baccala'/Stoccafisso | "Pesce" |
| Asparago, Radicchio, Broccolo | "Verdura" |
| Zucca | "Zucca" (tag dedicato, **NON** "Verdura") |
| Gnocchi | "Prodotti Tipici" |
| "Verdura" | Solo se titolo contiene ortaggi specifici, **mai** per sagre generiche |
| Giostre | Solo per grandi fiere con luna park |
| Se non chiaro | "Prodotti Tipici" |

---

## 5. Map Markers

- Pin: **40x56px** teardrop, stroke 2.2, bianco
- Icona food: scale 0.83, centrata nel cerchio, bianca su sfondo colorato
- Drop shadow: 2px blur, 30% opacita'
- Cache: 8 `L.divIcon` (uno per categoria)
- Usato in `MapView.tsx` e `DetailMiniMap.tsx`

---

## 6. Regole Card

- **Overlay**: gradiente scuro in basso (`from-black/85 via-black/30`), trasparente in alto. **MAI** uniforme
- **Food icon**: cerchio perfetto, `bg-white/60`, 16px min. **MAI** ovale
- **Provincia**: SEMPRE visibile — "Zugliano (VI)" non "Zugliano". Mai duplicare se gia' presente
- **Hover**: `scale 1.02` | **Tap**: `scale 0.97`
- **Giostre**: MAI come icona card (a 16px sembra lente d'ingrandimento)

---

## 7. Regole Dettaglio

- **Hero**: gradiente `from-black/70 via-black/25 to-transparent`
- Titolo + luogo sovrapposti in basso (bianco, drop-shadow)
- **ParallaxHero** (solo mobile): 30px parallax + fade-out 70-100% scroll
- **Desktop**: sticky layout, no parallax, no cambio opacita'
- **NO** progress bar (articoli troppo corti)
- Video fallback via Pexels: tema → citta' → provincia → generico

---

## 8. ScrollRow

| | Mobile | Desktop |
|---|--------|---------|
| Scroll | CSS `snap-x snap-mandatory snap-start` | JS drag + frecce |
| JS handlers | ZERO | Drag + calamita (snap magnetico a sinistra) |
| Click | Diretto su `Link` | `setPointerCapture` **dopo 5px** di drag |
| Snap | CSS nativo | JS `snapToNearest()` |

- **MAI** `snap-always` (causa scatti mobile + blocca click)
- `overscroll-x-contain` sul container
- "Questo weekend" sempre prima row (`minItems=1`)
- Separazione mobile/desktop via `window.matchMedia("(pointer: fine)")`

---

## 9. Province

- Formato: **"Citta' (XX)"** — codice 2 lettere maiuscole
- `BL`=Belluno, `PD`=Padova, `RO`=Rovigo, `TV`=Treviso, `VE`=Venezia, `VR`=Verona, `VI`=Vicenza
- Normalizzazione: `"belluno"→BL`, `"verona"→VR`, ecc.
- Se provincia non riconosciuta → niente parentesi
- **Deduplicazione** in: card, popup mappa, pagina dettaglio

---

## 10. Classificazione Sagre

**E' una sagra**: sagre, feste del cibo, fiere gastronomiche, eventi con componente gastronomica significativa.

**NON e' una sagra**: antiquariato, mostre generiche, mercati generici, concerti senza cibo, eventi sportivi.

**Blocklist**: `Vinitaly` (hardcoded in `enrich-sagre`).

**Giostre**: solo `feature_tag` nel DB, mai categoria icona. Solo per grandi fiere con luna park (es. Antica Fiera del Tresto, Antica Fiera del Soco).

**Non-sagre da filtrare**: visite guidate, wine tasting puri, convegni, mostre, concerti senza cibo, sport, expo vini. Vedi `PIPELINE.md` sezione 5 per la lista completa.

**Trappola "fiera"**: "fiera" da sola NON e' motivo di deattivazione. Molte fiere venete SONO sagre del cibo (Fiera del Riso, Fiera del Baccala'). Filtrare solo se combinata con termini non-food.

---

## 11. Regole Tassative

Divieti assoluti — **MAI** violare:

- **NO immagini low-res** → usare Unsplash fallback tematico
- **SEMPRE provincia visibile** su card, mappa, dettaglio
- **DRAG + CALAMITA** tassativo su desktop (snap magnetico a sinistra al rilascio)
- **NO snap-always** (causa scatti e blocca click su mobile)
- **Logo grande** `h-10` nella TopNav
- **Brand color = colore logo** via CSS variables `--brand-l/c/h`
- **Icone food = Lucide React**, MAI SVG a mano (tranne le 5 custom gia' fatte)
- **Video hero = solo italiano**, campagna veneta, centri storici. MAI cibo asiatico
- **Pinza = focaccia** (Pane), **Zucca = icona dedicata** (arancione), **Verdura = foglia** (verde), **Carne = drumstick** (marrone)
- **Click homepage DEVE funzionare** — `setPointerCapture` solo dopo 5px di drag
- **Popup mappa professionale** — foto, titolo, date, luogo, pulsante "Vedi dettagli" stilizzato
- **Foto Unsplash consone** al tema della sagra. Se sbagliate: azzerare e riassegnare
- **Vino** = calici/versato, MAI bottiglie. **Olio** = olive/frantoio, MAI depositi
- **Giostre MAI come icona card** — solo feature_tag nel DB
- **Date**: lookback 30 giorni per sagre senza end_date. Grace period cron 30 giorni.
- **Province**: SEMPRE codice 2 lettere (BL/PD/RO/TV/VE/VR/VI). Non-Veneto → disattivato.
- **Dedup**: 3 livelli (scraper hash, DB normalized_title, applicativo). Vedi `PIPELINE.md`.
- **Pipeline completa**: Vedi `PIPELINE.md` per regole ferree su scraping/qualita'/date/province.
