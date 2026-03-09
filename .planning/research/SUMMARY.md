# Research Summary: Nemovia v1.3 "Dati Puliti + Redesign"

**Domain:** Data quality pipeline hardening + UI/UX redesign for food festival aggregator
**Researched:** 2026-03-09
**Overall confidence:** HIGH

## Executive Summary

Nemovia v1.3 tackles two distinct but complementary tracks: cleaning the data pipeline (7 identified quality problems in production data) and redesigning the visual identity to achieve the "WOW, modernissimo" aesthetic the user wants. The critical finding is that **both tracks require almost zero new npm dependencies** -- the data quality work is entirely Edge Function logic + one PostgreSQL extension (pg_trgm), and the redesign is achieved through CSS custom property changes, a font swap (Geist via next/font/google), and pure CSS visual effects.

For data quality, the existing Gemini 2.5 Flash enrichment pipeline already has the infrastructure for the hardest problem (non-sagra classification). Adding an `is_sagra: boolean` field to the existing structured output prompt costs zero additional API calls. The remaining 6 quality issues (noise titles, calendar dates, absurd duration, duplicates, expired events, image quality) are all solvable with deterministic heuristics in the scrape-sagre Edge Function. The one infrastructure addition is enabling PostgreSQL's pg_trgm extension for fuzzy deduplication -- this moves duplicate detection from exact normalized-title matching to trigram similarity, catching variants like "Sagra del Pesce" vs "Sagra del Pesce di Chioggia."

For the UI/UX redesign, the user cited Linear, Vercel, Raycast, and Arc Browser as inspiration. The path to that aesthetic is: (1) swap Inter for Geist font (Vercel's typeface, 3-line code change), (2) replace the muted amber-600/stone-50 palette with a vibrant warm-coral/teal OKLCH palette (CSS variable swap), and (3) add visual depth via glassmorphism (Tailwind's backdrop-blur utilities), mesh gradients (pure CSS), and bento grid layouts (CSS Grid). All of these are CSS-only changes -- zero JavaScript added for visual effects. The LazyMotion migration (already flagged in PROJECT.md Active items) should happen during this milestone since every component is being touched for the redesign anyway -- this saves 28KB from the initial bundle.

The two tracks are largely independent at the implementation level but have a natural ordering: data quality first (cleaner data makes the redesign look better -- no garbage cards cluttering the new UI), then visual redesign.

## Key Findings

**Stack:** Zero new npm packages. Enable pg_trgm extension in PostgreSQL. Swap Inter to Geist font (next/font/google). OKLCH color palette refresh (CSS only). LazyMotion migration (existing Motion library).

**Architecture:** Data quality filters add deterministic validation functions to scrape-sagre Edge Function. LLM classification adds one boolean field to existing Gemini prompt. UI redesign is entirely in CSS custom properties + component class changes.

**Critical pitfall:** The LLM is_sagra classification must deactivate (not delete) non-sagre events, and must handle edge cases where legitimate sagre have non-obvious titles. False positives (marking real sagre as non-sagre) are worse than false negatives (letting non-sagre through).

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Data Quality Filters** - Heuristic validation in scrape pipeline
   - Addresses: Noise titles, calendar dates, absurd duration, expired events, image URL upgrades
   - Avoids: Over-engineering by keeping filters as simple deterministic functions
   - Rationale: Clean data first, then redesign the UI. Garbage data in the new design undermines the visual refresh.

2. **Deduplication & Classification** - pg_trgm fuzzy dedup + Gemini is_sagra classification
   - Addresses: Duplicate events, non-sagre detection
   - Avoids: Client-side fuzzy matching (wasteful for 700+ rows)
   - Rationale: Depends on Phase 1's noise filters being in place (reduces the volume of data hitting dedup/LLM).

3. **Color & Typography Refresh** - Geist font, OKLCH palette swap, CSS foundations
   - Addresses: "Colori vecchi," "design anonimo" feedback
   - Avoids: Touching component structure (just CSS changes)
   - Rationale: Foundation for visual effects in Phase 4. Colors and fonts must be settled before glassmorphism/gradients are tuned.

4. **Visual Effects & Layout** - Glassmorphism, mesh gradients, bento grids, LazyMotion migration
   - Addresses: "WOW effect" visual impact, bundle optimization
   - Avoids: Adding JavaScript for visual effects (pure CSS)
   - Rationale: Layers visual depth on top of the new color/typography system.

**Phase ordering rationale:**
- Data quality before redesign: clean data makes the new UI look better; garbage cards in a beautiful design is worse than garbage cards in the old design
- Heuristic filters before LLM classification: reduces the volume of events that need LLM processing (cost efficiency within free tier)
- Color/typography before visual effects: glassmorphism and gradients depend on the color palette being finalized
- LazyMotion migration during redesign: every component is being touched anyway, perfect time

**Research flags for phases:**
- Phase 2 (Classification): LLM classification confidence threshold needs tuning. Start conservative (only deactivate high-confidence non-sagre). May need phase-specific research on prompt engineering for Italian event classification.
- Phase 3 (Colors): OKLCH palette values need real-world testing against sagra card images. Food photography has warm tones -- the palette must complement, not clash.
- Phase 4 (Glassmorphism): Performance on mid-range mobile devices needs testing. backdrop-filter is GPU-intensive -- keep blur values 8-12px and limit to 2-3 glass surfaces per viewport.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new npm deps verified. pg_trgm confirmed available on Supabase. Geist confirmed in next/font/google. |
| Features | HIGH | All 7 data quality problems have clear solutions. UI trends are well-documented CSS patterns. |
| Architecture | HIGH | Edge Function modifications are additive. CSS redesign touches no data flow. |
| Pitfalls | HIGH | LLM false positives identified as critical risk. Glassmorphism performance well-documented. |

## Gaps to Address

- **OKLCH palette exact values:** Need to be generated with oklch.fyi and tested against real sagra card images. Cannot pre-determine without visual testing.
- **pg_trgm similarity threshold:** The 0.6 threshold for fuzzy dedup is a starting estimate. May need tuning after analyzing actual duplicate patterns in the 735 active sagre.
- **LLM is_sagra prompt wording:** The exact Italian prompt for non-sagra classification needs iteration. "E questo una sagra/festa gastronomica?" may have edge cases with food markets, wine tastings, etc.
- **Mesh gradient performance:** Pure CSS mesh gradients with 4+ radial-gradient layers may cause paint lag on low-end mobile. Need to test and possibly reduce complexity.
- **Image URL upgrade patterns:** Each of the 5 scraper sources has different thumbnail-to-full URL patterns. Need to analyze actual URLs to build source-specific upgrade rules.
