# Technology Stack

**Project:** Nemovia v1.3 "Dati Puliti + Redesign"
**Researched:** 2026-03-09
**Overall Confidence:** HIGH

## Existing Stack (DO NOT change)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.12 | App Router, SSR, routing |
| React | 19.1.0 | UI framework |
| Tailwind CSS | v4 | Utility-first styling |
| Shadcn/UI | latest | Component library |
| Motion | 12.35.0 | Animations (FadeIn, StaggerGrid, ScrollReveal, ParallaxHero) |
| Leaflet | 1.9.4 | Maps |
| nuqs | 2.8.9 | URL search param state |
| tw-animate-css | 1.4.0 | Tailwind animation utilities |
| Supabase | 2.98.0 | PostgreSQL + PostGIS, Edge Functions |
| Cheerio | 1.x (npm:) | HTML scraping in Deno Edge Functions |
| @google/genai | 1.x (npm:) | Gemini 2.5 Flash LLM in Deno Edge Functions |
| Vitest | 4.0.18 | Unit testing |

## Track 1: Data Quality -- No New Dependencies

The entire data quality track requires **zero npm additions**. All improvements are logic changes in the existing Edge Functions (`scrape-sagre` and `enrich-sagre`) plus PostgreSQL extensions.

### PostgreSQL Extension: pg_trgm (enable in Supabase)

| Property | Value |
|----------|-------|
| **What** | Trigram-based fuzzy string matching for deduplication |
| **Install** | `CREATE EXTENSION IF NOT EXISTS pg_trgm;` in Supabase SQL Editor |
| **Cost** | Free -- pg_trgm is a built-in PostgreSQL extension, available on all Supabase tiers |
| **Confidence** | HIGH -- pg_trgm is listed in official Supabase extensions docs |

**Why pg_trgm for deduplication instead of client-side fuzzy matching:**

1. **Server-side is correct for batch pipelines.** Dedup runs inside Edge Functions during scraping -- comparing against 700+ existing rows. Fetching all rows to do client-side Levenshtein is wasteful. pg_trgm's `similarity()` function runs inside PostgreSQL where the data already lives.

2. **GIN index support.** `CREATE INDEX idx_sagre_trgm ON sagre USING gin (title gin_trgm_ops);` enables fast fuzzy lookups without sequential scans. The existing `find_duplicate_sagra` RPC does exact normalized-title comparison; adding a `similarity(normalized_title, $1) > 0.6` threshold catches near-duplicates that slip through exact matching.

3. **No JS dependency to maintain.** Libraries like `string-similarity` (Dice coefficient) or `fastest-levenshtein` would need to be vendored into the Deno Edge Function. pg_trgm is built into PostgreSQL -- zero maintenance.

**Implementation: Enhanced dedup RPC**

```sql
-- Upgrade find_duplicate_sagra to use fuzzy matching
CREATE OR REPLACE FUNCTION find_duplicate_sagra(
  p_normalized_title text,
  p_city text,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS TABLE(id uuid, image_url text, price_info text, is_free boolean, sources text[]) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.image_url, s.price_info, s.is_free, s.sources
  FROM sagre s
  WHERE s.is_active = true
    AND (
      -- Exact match (existing behavior)
      lower(s.location_text) = p_city
      OR similarity(lower(s.location_text), p_city) > 0.5
    )
    AND (
      -- Exact normalized title match
      normalize_text(s.title) = p_normalized_title
      -- OR fuzzy title match (catches "Sagra del Pesce" vs "Sagra Del Pesce di Mare")
      OR similarity(normalize_text(s.title), p_normalized_title) > 0.6
    )
  ORDER BY similarity(normalize_text(s.title), p_normalized_title) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

### Data Quality Filters (pure TypeScript in Edge Functions)

All 7 data quality problems map to filter functions added to the existing `scrape-sagre/index.ts` and `enrich-sagre/index.ts`. No new libraries needed.

| Problem | Solution | Where | Library |
|---------|----------|-------|---------|
| Titoli spazzatura | Expand `isNoiseTitle()` with more patterns | scrape-sagre | None (regex) |
| Date calendario | New `isCalendarDateRange()` -- reject if span > 14 days | scrape-sagre | None (date math) |
| Duplicati | Upgrade `find_duplicate_sagra` RPC with pg_trgm | PostgreSQL | pg_trgm extension |
| Durata assurda | New `isAbsurdDuration()` -- reject events > 14 days | scrape-sagre | None (date math) |
| Eventi passati | Fix expire cron -- filter `end_date < NOW()` more aggressively | PostgreSQL cron | None (SQL) |
| Non-sagre | Add LLM classification step in enrichment | enrich-sagre | Gemini 2.5 Flash (already used) |
| Foto bassa risoluzione | Image URL resolution upgrade logic | scrape-sagre | None (URL manipulation) |

### LLM-Based Non-Sagra Detection (Gemini 2.5 Flash structured output)

The enrichment pipeline already uses Gemini 2.5 Flash with structured output (JSON schema). Adding a `is_sagra: boolean` classification field to the existing enrichment prompt costs zero additional API calls -- it rides the same batch request.

```typescript
// Add to existing enrichment prompt in enrich-sagre/index.ts
config: {
  responseMimeType: "application/json",
  responseSchema: {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        is_sagra: { type: "BOOLEAN" },  // NEW: classify event type
        food_tags: { type: "ARRAY", items: { type: "STRING" } },
        feature_tags: { type: "ARRAY", items: { type: "STRING" } },
        enhanced_description: { type: "STRING" },
      },
      required: ["id", "is_sagra", "food_tags", "feature_tags", "enhanced_description"],
    },
  },
},
```

**Why this works:** Gemini 2.5 Flash has strong Italian text comprehension and can reliably distinguish "Sagra del Baccalà" (sagra) from "Mostra Antiquariato Padova" (not a sagra). The free tier (15 req/min) is sufficient since this runs in the existing enrichment batches.

### Image Quality Upgrade Strategy

No new image processing library needed. The approach is **URL manipulation at scrape time**, not image resizing:

1. **Source-specific thumbnail-to-full URL patterns.** Most sagre sites serve thumbnails in listings with predictable URL patterns (e.g., `-150x150.jpg` suffix, `/thumbs/` path segment). Replace these patterns with full-resolution URLs during extraction.

2. **Next.js Image Optimization handles the rest.** The project already uses `next/image` with `hostname: "**"` in remotePatterns. Next.js automatically resizes, compresses (Sharp), and serves WebP/AVIF to capable browsers. No custom image proxy needed.

3. **Fallback placeholder for truly tiny images.** Add a `MIN_IMAGE_WIDTH` check via `<img>` natural dimensions in the client component -- if the loaded image is < 200px wide, show the gradient placeholder instead.

**Why NOT add Sharp as a direct dependency:**
- Next.js already uses Sharp internally for its Image Optimization API
- Adding Sharp as a build dependency increases bundle/deploy complexity on Vercel
- The constraint is "zero costi fissi" -- Supabase Storage image transforms require Pro plan ($25/mo)
- URL manipulation at scrape time is free and catches 90% of low-res issues

## Track 2: UI/UX Redesign -- Minimal New Dependencies

### Font: Geist (replaces Inter)

| Property | Value |
|----------|-------|
| **What** | Vercel's modern variable font, designed for UI clarity |
| **Install** | Already available via `next/font/google` -- no npm install needed |
| **Bundle impact** | ~0 KB delta -- replaces Inter (both are variable fonts loaded the same way) |
| **Confidence** | HIGH -- Geist is the default font for Next.js 15 projects |

**Why Geist instead of Inter:**

1. **Modern aesthetic.** Geist was designed by Vercel in collaboration with Basement Studio specifically for modern UI. It has slightly rounder curves, friendlier apertures, and more character spacing than Inter -- exactly the "non-anonimo" feel the user wants.

2. **Reference app alignment.** The user cited Linear, Vercel, Raycast, and Arc Browser as inspiration. Vercel uses Geist. Linear and Raycast use similar geometric sans-serifs. Switching to Geist immediately aligns the typographic feel with these references.

3. **Zero migration cost.** Geist is available in `next/font/google`. The change is a 3-line edit in `layout.tsx` and 1 line in `globals.css`.

4. **Geist Mono for accents.** Geist Mono provides a complementary monospace variant useful for dates, prices, and distance numbers -- adding subtle typographic hierarchy without a separate font load.

**Implementation:**

```typescript
// layout.tsx -- replace Inter with Geist
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// In <body>:
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
```

```css
/* globals.css -- update @theme inline */
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

### Color System: New OKLCH Palette (CSS only, no library)

| Property | Value |
|----------|-------|
| **What** | Complete color refresh from amber-600/stone-50 to a vibrant modern palette |
| **Install** | Nothing -- pure CSS custom properties (already using OKLCH in globals.css) |
| **Tooling** | oklch.fyi or oklch.org for palette generation |
| **Confidence** | HIGH -- project already uses OKLCH values in CSS custom properties |

**Why OKLCH palette refresh needs no library:**

The project already uses OKLCH color values in `globals.css` (e.g., `--primary: oklch(0.666 0.179 58.318)`). The redesign is a CSS-only change -- swapping the color values in `:root`, not adding dependencies.

**Recommended palette direction (warm-vibrant, not cold-corporate):**

The user wants "WOW, modernissimo" -- this suggests moving from the muted amber/stone/green toward a more vibrant palette. Given the food/festival domain:

- **Primary:** Warm coral/terracotta (OKLCH hue ~25-30) -- replaces amber-600. More distinctive, works with food photography.
- **Accent:** Deep teal or emerald (OKLCH hue ~165-175) -- replaces green-700. Higher chroma for more visual punch.
- **Background:** Warm off-white with slight warmth (OKLCH lightness ~0.97, low chroma) -- replaces stone-50.
- **Surface:** Pure white with subtle warm tint for cards.

**Specific values to be determined during implementation** with oklch.fyi, testing against actual sagra card images for contrast and harmony. The point is: this is a CSS variable swap, not a dependency change.

### Glassmorphism, Mesh Gradients, Bento Grids (CSS only)

| Effect | Implementation | Library Needed |
|--------|----------------|----------------|
| Glassmorphism cards/nav | `backdrop-blur-md bg-white/30 border border-white/20` | None -- Tailwind utilities |
| Mesh gradients (hero/backgrounds) | CSS `radial-gradient` layering or generated via csshero.org/mesher | None -- pure CSS |
| Bento grid layout | CSS Grid with `grid-template-rows` + `row-span` utilities | None -- Tailwind Grid |
| Aurora gradient animation | `@property` + `@keyframes` hue rotation on OKLCH values | None -- pure CSS |
| Animated gradient borders | `conic-gradient` + `@property` for hue animation | None -- pure CSS |

**Why pure CSS for all visual effects:**

1. **Browser support is sufficient.** `backdrop-filter` has 95% global support. CSS `@property` works in Chrome, Edge, Safari (Firefox lacks support but degrades gracefully -- the gradient just doesn't animate).

2. **Zero bundle cost.** CSS effects ship in the stylesheet, not JavaScript. The user wants visual wow without compromising the "utility app should feel snappy" principle established in v1.2.

3. **Tailwind v4 integration.** All these effects compose naturally with Tailwind utility classes. No wrapper components or CSS-in-JS needed.

**Glassmorphism best practices for this project:**

- Keep blur values 8-12px (not higher -- performance cost scales exponentially)
- Use glassmorphism sparingly: nav bars, filter panels, card overlays -- NOT every surface
- Always add `border border-white/20` for edge definition
- Test on lower-end mobile devices (the primary audience is Italian users on mid-range phones)
- Provide solid-color fallback for `@supports not (backdrop-filter: blur())` edge cases

### LazyMotion Migration (bundle optimization)

| Property | Value |
|----------|-------|
| **What** | Replace `motion` component with `m` + `LazyMotion` for smaller bundle |
| **Install** | Nothing -- already part of motion@12.35.0 |
| **Bundle savings** | ~34KB to ~6KB initial load (async load remaining features) |
| **Confidence** | HIGH -- verified in Motion docs, this was already flagged in PROJECT.md Active items |

**Why do this now:** The v1.3 redesign touches every component anyway. Perfect time to migrate from `import { motion } from "motion/react"` to `import { m } from "motion/react"` + wrapping the app in `<LazyMotion>`.

**Implementation:**

```typescript
// src/components/Providers.tsx
"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

// Async load animation features
const loadFeatures = () =>
  import("motion/react").then((mod) => mod.domAnimation);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <NuqsAdapter>{children}</NuqsAdapter>
      </MotionConfig>
    </LazyMotion>
  );
}
```

Then in all components, replace `motion.div` with `m.div`, `motion.span` with `m.span`, etc. The `strict` prop will warn if any component accidentally imports the full `motion` component.

## Recommended Stack (Summary Table)

### New Additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pg_trgm (PostgreSQL extension) | Built-in | Fuzzy dedup matching | Server-side similarity in SQL, GIN-indexed, zero JS dependency |
| Geist (via next/font/google) | Variable | Modern sans-serif font | Aligns with reference apps (Vercel, Linear), zero bundle delta |
| Geist Mono (via next/font/google) | Variable | Monospace for dates/numbers | Typographic hierarchy for data-dense UI elements |

### Infrastructure Changes (no new packages)

| Change | Purpose | What Changes |
|--------|---------|--------------|
| OKLCH color palette swap | Modern, vibrant look | CSS custom properties in globals.css |
| LazyMotion migration | 28KB bundle reduction | Providers.tsx + all motion imports |
| Glassmorphism/mesh CSS | Visual wow effects | globals.css + component classes |
| Enhanced data quality filters | Clean scraped data | scrape-sagre/index.ts logic |
| LLM is_sagra classification | Filter non-sagre events | enrich-sagre/index.ts prompt |
| pg_trgm fuzzy dedup | Better duplicate detection | PostgreSQL RPC + extension |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Fuzzy matching | pg_trgm (PostgreSQL) | string-similarity (npm) | Client-side matching against 700+ rows is wasteful; pg_trgm runs where data lives |
| Fuzzy matching | pg_trgm (PostgreSQL) | fastest-levenshtein (npm) | Same reason; also needs vendoring into Deno Edge Function |
| Font | Geist | Inter (current) | Inter is ubiquitous/generic; user explicitly wants distinctive modern feel |
| Font | Geist | Satoshi/Manrope | Not available in next/font/google; would require self-hosting |
| Image quality | URL manipulation at scrape time | Sharp as direct dep | Next.js already uses Sharp internally; adding it directly increases deploy complexity |
| Image quality | URL manipulation at scrape time | Supabase Storage transforms | Requires Pro plan ($25/mo); violates zero-cost constraint |
| Image quality | URL manipulation at scrape time | imgproxy self-hosted | Requires Docker infrastructure; overkill for this use case |
| Non-sagra detection | Gemini 2.5 Flash (existing) | Separate classifier model | Already paying 0 for Gemini free tier; adding field to existing prompt is free |
| Gradient effects | Pure CSS mesh/aurora | Three.js / react-three-fiber | Massive bundle for simple visual effects; CSS achieves 95% of the wow factor |
| Glassmorphism | Tailwind utilities | glassmorphism npm package | Package is just a CSS generator; Tailwind utilities are more flexible and integrated |
| Animation bundle | LazyMotion | Full motion bundle (status quo) | 28KB savings for free; v1.3 redesign touches all components anyway |
| Design tokens | CSS custom properties | Style Dictionary / Stitches | Overkill for single-theme app; CSS vars already established pattern in the project |

## Libraries Explicitly NOT Adding

### Three.js / react-three-fiber -- REJECT

**Why considered:** User mentioned "3D elements" as a design trend.

**Why not:**
- Bundle size: react-three-fiber adds 150KB+ to the client bundle
- The app is a mobile-first utility for finding sagre -- 3D elements add visual complexity without functional value
- The "wow" factor is better achieved with CSS effects (glassmorphism, mesh gradients, animated borders) that cost zero JavaScript
- 3D rendering on mid-range mobile devices (Italian market) causes battery drain and jank

### Framer / Rive -- REJECT

**Why considered:** Advanced animation tools for "design all'avanguardia."

**Why not:**
- Framer Site Builder is a separate product from the Motion library already in use
- Rive adds a runtime player (~50KB) and requires creating animations in a separate tool
- Motion's existing capabilities (whileHover, whileInView, layout, spring physics) cover all needed animation patterns
- LazyMotion migration reduces Motion's footprint from 34KB to 6KB -- going in the right direction

### Tailwind UI / DaisyUI / FlyonUI -- REJECT

**Why considered:** Pre-built component libraries with modern aesthetics.

**Why not:**
- Shadcn/UI is already deeply integrated (Card, Badge, Button, Input, Select, Skeleton, Separator)
- Adding another component library creates style conflicts and inconsistent patterns
- The redesign is about color/typography/effects, not replacing the component system
- Shadcn/UI components are unstyled by default -- the visual refresh comes from changing CSS variables, not swapping components

### CSS-in-JS (Emotion / Styled-Components / Vanilla Extract) -- REJECT

**Why considered:** Some modern design systems use CSS-in-JS for dynamic theming.

**Why not:**
- Tailwind v4 + CSS custom properties already handle theming through `globals.css`
- CSS-in-JS adds runtime overhead (Emotion) or build complexity (Vanilla Extract)
- The project has a clean CSS architecture: Tailwind utilities + OKLCH custom properties. No reason to add another styling paradigm.

### next-themes -- DEFER

**Why considered:** Dark mode is a 2025-2026 design trend.

**Why not now:**
- v1.3 scope is already large (data quality + full redesign)
- Dark mode requires designing and testing a complete second color palette
- The user's request is for "modern WOW" not specifically dark mode
- Can be added in a future milestone with a simple `next-themes` + OKLCH dark palette addition

## Installation

```bash
# No npm packages to install for v1.3

# PostgreSQL extension (run in Supabase SQL Editor)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

# Font change is a code edit, not an install:
# layout.tsx: import { Geist, Geist_Mono } from "next/font/google";
```

## Sources

### HIGH Confidence (official docs or verified)

- [Supabase PostgreSQL Extensions](https://supabase.com/docs/guides/database/extensions) -- pg_trgm availability confirmed
- [PostgreSQL pg_trgm docs](https://www.postgresql.org/docs/current/pgtrgm.html) -- similarity(), GIN index, trigram matching
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) -- Geist via next/font/google
- [Geist Font](https://vercel.com/font) -- variable font, Vercel's official typeface
- [Motion LazyMotion docs](https://motion.dev/docs/react-lazy-motion) -- m component, domAnimation, code splitting
- [Motion Bundle Size Reduction](https://motion.dev/docs/react-reduce-bundle-size) -- 34KB to 6KB with LazyMotion
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) -- JSON schema with BOOLEAN type for classification
- [Tailwind CSS backdrop-filter](https://tailwindcss.com/docs/backdrop-filter-blur) -- glassmorphism utilities
- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image) -- remotePatterns, Sharp integration
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) -- v1.44.0 latest, GA status confirmed

### MEDIUM Confidence (multiple sources agree)

- [Glassmorphism with Tailwind CSS (Epic Web Dev)](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css) -- implementation patterns
- [Glassmorphism Implementation Guide 2025](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) -- performance best practices
- [Web Design Trends 2026 (Figma)](https://www.figma.com/resource-library/web-design-trends/) -- bento grids, vibrant colors
- [Web Design Trends 2026 (Elementor)](https://elementor.com/blog/web-design-trends-2026/) -- aurora gradients, organic shapes
- [OKLCH ecosystem tools (Evil Martians)](https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools) -- oklch.fyi, palette generation
- [Mesher CSS Mesh Gradient Tool](https://csshero.org/mesher/) -- pure CSS mesh gradient generation
- [CSS Gradient Animation (Frontend Hero)](https://frontend-hero.com/how-to-animate-gradients-css) -- @property + @keyframes for gradient animation
- [Geist + Tailwind v4 setup](https://www.buildwithmatija.com/blog/how-to-use-custom-google-fonts-in-next-js-15-and-tailwind-v4) -- CSS variable integration pattern
- [Best Fonts for Web 2025 (Shakuro)](https://shakuro.com/blog/best-fonts-for-web-design) -- Geist vs Inter comparison
