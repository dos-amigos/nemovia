# Architecture Patterns

**Domain:** Data quality filtering + UI/UX redesign for sagre aggregator
**Project:** Nemovia v1.3 "Dati Puliti + Redesign"
**Researched:** 2026-03-09

## Existing Architecture Summary

Nemovia is a Next.js 15 App Router application with a two-tier data pipeline and a server-first rendering model.

```
DATA PIPELINE (Supabase Edge Functions + pg_cron):
  Sources (5 sites) --> scrape-sagre --> raw DB rows --> enrich-sagre --> enriched rows
    |                     (Cheerio)        (status:         (Gemini +       (status:
    |                                    pending_geocode)   Nominatim)      enriched)
    |
    v
  pg_cron: scrape 2x/day, enrich 2x/day, expire 1x/day

FRONTEND (Next.js 15 App Router):
  layout.tsx (Server) --> Providers.tsx (Client: MotionConfig + NuqsAdapter)
    (main)/layout.tsx (Server: TopNav + BottomNav + responsive container)
      template.tsx (Client: AnimatePresence + FrozenRouter page transitions)
        page.tsx (Server: data fetch) --> Client islands (SagraCard, MapView, etc.)
```

### Current Database Schema (sagre table)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `title` | TEXT | Raw scraped title |
| `slug` | TEXT UNIQUE | URL-safe identifier |
| `location_text` | TEXT | City name from scraper |
| `location` | GEOGRAPHY(POINT, 4326) | PostGIS coordinates |
| `province` | TEXT | From Nominatim geocode |
| `start_date` / `end_date` | DATE | Event date range |
| `enhanced_description` | TEXT | Gemini-generated |
| `food_tags` / `feature_tags` | TEXT[] | Gemini-classified |
| `image_url` | TEXT | Scraped image URL |
| `source_url` | TEXT | Link to original |
| `is_free` | BOOLEAN | Price detection |
| `status` | TEXT | Pipeline state: pending_geocode -> pending_llm -> enriched |
| `content_hash` | TEXT | Dedup key |
| `sources` | TEXT[] | Which scrapers found it |
| `is_active` | BOOLEAN | Soft delete / expiry |

---

## Architecture for v1.3: Two Integration Tracks

v1.3 has two distinct tracks that touch different layers of the system:

- **Track 1 (Data Quality)**: Modifies the data pipeline (Edge Functions + DB). Zero frontend component changes.
- **Track 2 (UI/UX Redesign)**: Modifies the frontend (components + CSS + layout). Zero pipeline changes.

These tracks are independent and can be built in parallel. Track 1 improves what data reaches the frontend. Track 2 improves how that data is presented.

---

## Track 1: Data Quality Architecture

### Enhanced Scrape Pipeline

```
CURRENT FLOW:
  fetchHTML -> extractRawEvent -> isNoiseTitle? -> normalizeRawEvent -> upsertEvent

V1.3 FLOW (new steps marked with [NEW]):
  fetchHTML -> extractRawEvent
    -> isNoiseTitle? (expanded patterns) [MODIFIED]
    -> isPastYear? [NEW]
    -> isCalendarDateRange? [NEW]
    -> normalizeRawEvent
    -> tryUpgradeImageUrl? [NEW]
    -> upsertEvent (with pg_trgm fuzzy dedup) [MODIFIED]
```

**Validation functions are pure, stateless, and testable.** Each new filter function takes raw fields and returns `boolean`. They are inserted as guard clauses in the `scrapeSource()` for-loop, before `upsertEvent()`. If any filter returns `true` (meaning "reject"), the event is skipped with a counter increment for logging.

### Enhanced Enrichment Pipeline

```
CURRENT FLOW:
  Pass 1: pending_geocode -> geocode -> pending_llm (or geocode_failed)
  Pass 2: pending_llm -> Gemini (tags + description) -> enriched

V1.3 FLOW (classification added to Pass 2):
  Pass 1: pending_geocode -> geocode -> pending_llm (or geocode_failed)
  Pass 2: pending_llm -> Gemini (is_sagra + tags + description) -> enriched [MODIFIED]
    -> if is_sagra == false: set is_active = false [NEW]
```

**Key design decision: Deactivate, never delete.** Non-sagre events are set to `is_active = false`, not deleted. This allows:
- Manual review via Supabase dashboard
- Audit trail for false positives
- Easy reactivation if the classifier improves

### Fuzzy Deduplication (pg_trgm)

```
CURRENT:
  find_duplicate_sagra RPC
    WHERE normalize_text(title) = p_normalized_title
    AND lower(location_text) = p_city

V1.3:
  find_duplicate_sagra RPC (ENHANCED)
    WHERE (
      normalize_text(title) = p_normalized_title
      OR similarity(normalize_text(title), p_normalized_title) > 0.6
    )
    AND (
      lower(location_text) = p_city
      OR similarity(lower(location_text), p_city) > 0.5
    )
```

**GIN index required for performance:**
```sql
CREATE INDEX IF NOT EXISTS idx_sagre_title_trgm
  ON sagre USING gin (title gin_trgm_ops);
```

### Image URL Upgrade Strategy

Source-specific URL manipulation in `extractRawEvent()`:

| Source | Thumbnail Pattern | Full-Res Pattern |
|--------|------------------|------------------|
| sagritaly | `-150x150.jpg` WordPress suffix | Remove dimension suffix |
| solosagre | `?w=150&h=150` query params | Remove query params |
| venetoinfesta | `img.img_evt_list` small src | Check `data-src` / `srcset` |
| eventiesagre | List thumbnail | Optional: fetch detail page og:image |
| assosagre | No images typically | No upgrade possible |

### Track 1 Data Flow: Before and After

```
BEFORE (v1.2):
  HTML --> extractRawEvent --> isNoiseTitle? --> normalizeRawEvent --> upsertEvent
                                 |                                       |
                              [basic regex]                        [exact dedup]
                                                                        |
                                                                        v
  enrich-sagre: geocode --> Gemini(tags + description) --> status: enriched
  expire-cron: end_date < today --> is_active = false

AFTER (v1.3):
  HTML --> extractRawEvent --> isNoiseTitle? --> isPastYear? --> isCalendarRange?
                                 |                  |                |
                           [enhanced regex]    [year check]    [duration check]
                                                                     |
                                                                     v
                              normalizeRawEvent --> tryUpgradeImage --> upsertEvent
                                                                         |
                                                                [exact + trigram dedup]
                                                                         |
                                                                         v
  enrich-sagre: geocode --> Gemini(is_sagra + tags + description)
                               |
                        [is_sagra = false? --> is_active = false]
                               |
                        [is_sagra = true? --> status: enriched]
                               |
                               v
  expire-cron: end_date < today OR (no end_date + start_date 3+ days ago)
```

---

## Track 2: UI/UX Redesign Architecture

### Design System Strategy: CSS Variables, Not a New Component Library

**Keep Shadcn/UI because:**
- Already installed and used across 10+ components
- Shadcn components are customizable via CSS variables
- Swapping the palette in `globals.css` transforms every component at once
- No new dependency needed

**Keep Motion (with LazyMotion migration) because:**
- Motion v12 is already wired in
- Modern effects (glassmorphism, mesh gradients) are CSS-only -- no JS animation needed
- LazyMotion reduces bundle from 34KB to 6KB

### Component: Design Token System (globals.css)

The existing OKLCH CSS custom properties become the complete design token system. New tokens added for glass effects and mesh gradients:

```css
:root {
  /* Palette swap -- new values derived from oklch.fyi */
  --primary: oklch(/* warm coral/terracotta */);
  --accent: oklch(/* deep teal/emerald */);
  --background: oklch(/* warm off-white */);

  /* NEW tokens for glass effects */
  --glass-bg: oklch(1 0 0 / 0.7);
  --glass-border: oklch(1 0 0 / 0.2);

  /* NEW tokens for mesh gradients */
  --mesh-1: oklch(/* warm */);
  --mesh-2: oklch(/* mid */);
  --mesh-3: oklch(/* cool accent */);
}
```

### Component: Font Integration (Geist)

```
CURRENT:
  layout.tsx -> Inter (next/font/google) -> --font-inter -> @theme --font-sans

V1.3:
  layout.tsx -> Geist + Geist_Mono (next/font/google) -> --font-geist-sans, --font-geist-mono
  globals.css -> @theme --font-sans: var(--font-geist-sans), --font-mono: var(--font-geist-mono)
```

### Component: Glassmorphism Surfaces

Applied to 2-3 key surfaces only:

```
TopNav:  backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--glass-border)]
BottomNav: backdrop-blur-xl bg-[var(--glass-bg)] border-t border-[var(--glass-border)]
Card overlay badges: backdrop-blur-sm bg-white/60
```

**Performance constraint:** Maximum 3 simultaneous glass surfaces visible. Each backdrop-filter creates a separate GPU compositing layer.

### Component: Mesh Gradient (Hero + Background)

```css
.hero-mesh {
  background:
    radial-gradient(circle at 20% 30%, var(--mesh-1) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, var(--mesh-2) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, var(--mesh-3) 0%, transparent 60%),
    var(--background);
}
```

### Component: LazyMotion Migration

```
CURRENT:
  Providers.tsx -> MotionConfig
  Components -> import { motion } from "motion/react"

V1.3:
  Providers.tsx -> LazyMotion + MotionConfig
  Components -> import { m } from "motion/react"
```

The `strict` prop on `LazyMotion` throws a runtime error if any component imports `motion` instead of `m`.

### Component: Bento Grid Homepage (Desktop)

```
MOBILE (stack):              DESKTOP (bento):
+------------------+        +-------------------+----------+
| Hero             |        | Hero (2 cols)     | Filters  |
| Quick Filters    |        |                   | (1 col)  |
| Weekend Section  |        +-------------------+----------+
| Province Section |        | Weekend (2 cols)  | Province |
+------------------+        |                   | (1 col)  |
                             +-------------------+----------+
```

Mobile stays as vertical stack. Bento is a `lg:grid` enhancement only.

---

## Complete File Change Map

### New Files

| File | Type | Track | Purpose |
|------|------|-------|---------|
| `src/lib/scraper/filters.ts` | Utility | Track 1 | Pure filter functions: isPastYear, isCalendarDateRange |
| `src/lib/scraper/__tests__/filters.test.ts` | Test | Track 1 | Unit tests for filter functions |

### Modified Files -- Track 1 (Data Quality)

| File | Change |
|------|--------|
| `supabase/functions/scrape-sagre/index.ts` | Enhanced isNoiseTitle, new filters, image URL upgrade |
| `supabase/functions/enrich-sagre/index.ts` | is_sagra classification in Gemini prompt, deactivate non-sagre |
| PostgreSQL: `find_duplicate_sagra` RPC | Add pg_trgm similarity matching |
| PostgreSQL: expire cron | Fix for null end_date and 2025 events |

### Modified Files -- Track 2 (UI/UX Redesign)

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Geist + Geist_Mono font imports |
| `src/app/globals.css` | New OKLCH palette, glass tokens, mesh gradient, font variables |
| `src/components/Providers.tsx` | Add LazyMotion wrapper |
| `src/components/sagra/SagraCard.tsx` | Visual redesign (glass, corners, shadows) |
| `src/components/layout/TopNav.tsx` | Glassmorphism effect |
| `src/components/layout/BottomNav.tsx` | Glassmorphism effect |
| `src/components/home/HeroSection.tsx` | Mesh gradient background |
| `src/app/(main)/page.tsx` | Bento grid layout (desktop) |
| All animation components (15+) | Replace `motion` with `m` imports |

### Database Changes

| Change | SQL |
|--------|-----|
| Enable pg_trgm | `CREATE EXTENSION IF NOT EXISTS pg_trgm;` |
| GIN index | `CREATE INDEX idx_sagre_title_trgm ON sagre USING gin (title gin_trgm_ops);` |
| Fix expire cron | Enhanced SQL for null end_date handling |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: LLM Classification at Scrape Time

**What:** Calling Gemini inside scrape-sagre to classify events during scraping.

**Why bad:** Scrape-sagre processes 5 sources with hundreds of events per run. Adding LLM calls would hit Gemini's free tier rate limit (15 req/min) and exceed Edge Function timeouts.

**Instead:** Keep classification in enrich-sagre, which already handles Gemini calls with batching and rate limiting.

### Anti-Pattern 2: Deleting Non-Sagra Events

**What:** `DELETE FROM sagre WHERE is_sagra = false` after LLM classification.

**Why bad:** LLM classification has false positives. A legitimate sagra with an unusual name might be misclassified. Deleting removes the ability to review and correct.

**Instead:** Set `is_active = false`. The event remains for audit.

### Anti-Pattern 3: Applying Glassmorphism to Every Surface

**What:** Adding `backdrop-blur-md bg-white/30` to cards, buttons, badges, and every visible element.

**Why bad:** Each backdrop-filter creates a separate GPU compositing layer. More than 3-4 simultaneous glass layers on mobile causes frame drops.

**Instead:** Apply glassmorphism to max 2-3 persistent surfaces: TopNav, BottomNav, and optionally one floating element.

### Anti-Pattern 4: Animating Mesh Gradient Colors with JavaScript

**What:** Using Motion to interpolate mesh gradient colors in JavaScript.

**Why bad:** Gradient color interpolation in JS triggers paint on every frame. CSS handles gradient animation natively on the compositor.

**Instead:** Use CSS `@keyframes` with `background-position` for mesh gradient movement.

### Anti-Pattern 5: New CSS Framework for Glassmorphism

**What:** Installing a glassmorphism-specific CSS library.

**Why bad:** Adds a dependency for what amounts to 3-4 Tailwind utility combinations. `bg-white/70 backdrop-blur-xl border border-white/20` achieves the same effect with zero new dependencies.

**Instead:** Apply glass treatment directly with Tailwind utilities.

---

## Sources

- [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) -- GIN index, trigram similarity
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) -- JSON schema with boolean/enum types
- [Motion LazyMotion](https://motion.dev/docs/react-lazy-motion) -- m component, strict mode
- [Tailwind backdrop-filter](https://tailwindcss.com/docs/backdrop-filter-blur) -- glassmorphism utilities
- [CSS Mesh Gradient (Mesher)](https://csshero.org/mesher/) -- pure CSS mesh gradient technique
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) -- Geist via next/font/google
- [Glassmorphism with Tailwind](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css) -- implementation patterns
