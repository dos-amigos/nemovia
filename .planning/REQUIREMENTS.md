# Requirements: Nemovia v1.3

**Defined:** 2026-03-09
**Core Value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.

## v1.3 Requirements

Requirements for v1.3 "Dati Puliti + Redesign". Each maps to roadmap phases.

### Data Quality — Heuristic Filters

- [ ] **DQ-01**: Pipeline rifiuta titoli spazzatura generici (es. "Calendario mensile eventi sagre...") tramite filtro noise migliorato
- [ ] **DQ-02**: Pipeline rifiuta eventi con date calendario (range mensili tipo 1 gen → 31 gen) che non rappresentano sagre reali
- [ ] **DQ-03**: Pipeline rifiuta eventi con durata assurda (>7 giorni), dato che le sagre reali durano 2-3 giorni
- [ ] **DQ-04**: Pipeline rimuove eventi passati del 2025 e precedenti (il filtro expire funziona correttamente per l'anno in corso 2026)
- [ ] **DQ-05**: Cleanup retroattivo dei dati esistenti in produzione che violano i nuovi filtri

### Data Quality — Deduplicazione & Classificazione

- [ ] **DQ-06**: Pipeline rileva e disattiva duplicati tramite fuzzy matching (pg_trgm similarity) su titolo e localit
- [ ] **DQ-07**: Pipeline classifica ogni evento come sagra/non-sagra tramite LLM (Gemini is_sagra) e disattiva i non-sagre (antiquariato, mostre, mercati)
- [ ] **DQ-08**: La classificazione LLM non genera chiamate API aggiuntive (campo aggiunto al prompt di enrichment esistente)

### Data Quality — Immagini

- [ ] **DQ-09**: Pipeline tenta upgrade delle immagini a risoluzione maggiore tramite pattern URL source-specifici (thumbnail → full)
- [ ] **DQ-10**: Card mostra placeholder gradevole quando l'immagine non è disponibile o è troppo piccola

### UI/UX — Design System Foundation

- [ ] **UI-01**: Font sostituito da Geist (Vercel) tramite next/font/google per un'estetica moderna e coerente con le reference app
- [ ] **UI-02**: Palette OKLCH completamente rinnovata — colori vibranti e sofisticati al posto di amber-600/stone-50
- [ ] **UI-03**: Variabili CSS Shadcn aggiornate coerentemente (primary + primary-foreground, tutti i pairs)
- [ ] **UI-04**: Tutti i colori hardcoded nei componenti (gradienti, badge, tag) allineati alla nuova palette

### UI/UX — Effetti Visivi

- [ ] **UI-05**: Glassmorphism applicato a TopNav e BottomNav (backdrop-blur, bg semi-trasparente, bordi vetro)
- [ ] **UI-06**: Glassmorphism applicato a card e overlay dove appropriato (max 2-3 superfici blur per viewport su mobile)
- [ ] **UI-07**: Mesh gradients su hero section e sfondi pagina per profondità visiva
- [ ] **UI-08**: Componenti chiave (SagraCard, Hero, pagine) ridisegnati con estetica moderna

### UI/UX — Layout & Performance

- [ ] **UI-09**: Homepage ridisegnata con bento grid layout (CSS Grid responsivo)
- [ ] **UI-10**: LazyMotion migration completata (da 34kb a ~5kb bundle iniziale)
- [ ] **UI-11**: Performance glassmorphism verificata su mobile (blur ≤12px, nessun jank su scroll)

## Future Requirements

Deferred to v1.4+. Tracked but not in current roadmap.

### Espansione

- **EXP-01**: Nuove sorgenti scraper oltre le 5 attuali
- **EXP-02**: OCR locandine social per estrazione eventi da immagini

### Utenti

- **USR-01**: Autenticazione utente (Google OAuth, Magic Link)
- **USR-02**: Preferiti / salva sagra
- **USR-03**: Recensioni e foto utenti

## Out of Scope

| Feature | Reason |
|---------|--------|
| Detail page scraping per immagini HD | Complessità alta, rischio rottura, defer a v1.4 se URL patterns non bastano |
| Nuovi scraper sources | Fuori scope v1.3, focus su qualità dati esistenti |
| Auth + profili utente | Premature, prima validare design con utenti reali |
| Neo-brutalism | Non coerente con l'estetica premium/sofisticata richiesta |
| 3D elements (Three.js) | Overhead bundle eccessivo per zero-cost constraint |
| Dark mode | Non richiesto, singolo tema sofisticato è sufficiente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DQ-01 | Phase 14 | Pending |
| DQ-02 | Phase 14 | Pending |
| DQ-03 | Phase 14 | Pending |
| DQ-04 | Phase 14 | Pending |
| DQ-05 | Phase 14 | Pending |
| DQ-06 | Phase 15 | Pending |
| DQ-07 | Phase 15 | Pending |
| DQ-08 | Phase 15 | Pending |
| DQ-09 | Phase 15 | Pending |
| DQ-10 | Phase 15 | Pending |
| UI-01 | Phase 16 | Pending |
| UI-02 | Phase 16 | Pending |
| UI-03 | Phase 16 | Pending |
| UI-04 | Phase 16 | Pending |
| UI-05 | Phase 17 | Pending |
| UI-06 | Phase 17 | Pending |
| UI-07 | Phase 17 | Pending |
| UI-08 | Phase 17 | Pending |
| UI-09 | Phase 17 | Pending |
| UI-10 | Phase 17 | Pending |
| UI-11 | Phase 17 | Pending |

**Coverage:**
- v1.3 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
