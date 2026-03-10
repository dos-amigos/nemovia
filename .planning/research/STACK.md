# Technology Stack

**Project:** Nemovia v1.4 "Esperienza Completa"
**Researched:** 2026-03-10
**Overall Confidence:** HIGH

## Existing Stack (DO NOT change)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.12 | App Router, SSR, routing |
| React | 19.1.0 | UI framework |
| Tailwind CSS | v4 | Utility-first styling |
| Shadcn/UI | latest (via `shadcn@3.8.5`) | Component library |
| radix-ui | 1.4.3 | Primitive components (bundled package -- includes Popover, Dialog, etc.) |
| Motion | 12.35.0 | Animations (LazyMotion + domMax + m.* components) |
| Leaflet | 1.9.4 | Maps |
| nuqs | 2.8.9 | URL search param state |
| Supabase | 2.98.0 | PostgreSQL + PostGIS + pg_trgm, Edge Functions |
| Cheerio | 1.x (npm:) | HTML scraping in Deno Edge Functions |
| @google/genai | 1.x (npm:) | Gemini 2.5 Flash LLM in Deno Edge Functions |
| Vitest | 4.0.18 | Unit testing |

---

## 1. Unsplash API Integration (Hero + Fallback Images)

### Approach: Direct `fetch()` on Next.js server -- NO npm package needed

| Property | Value |
|----------|-------|
| **What** | Unsplash photo search API for hero image + fallback images for sagre without photos |
| **Install** | None -- use native `fetch()` in server components/route handlers |
| **API Key** | Free -- register app at unsplash.com/developers, get Access Key |
| **Rate Limit** | 50 req/hour (demo mode), 5,000 req/hour (production approval) |
| **Cost** | Free forever (Unsplash's business model is attribution, not API fees) |
| **Confidence** | HIGH -- Unsplash API docs verified directly |

**Why NOT use `unsplash-js` (v7.0.20):**

The `unsplash-js` package is a thin wrapper around `fetch()` calls. It adds ~30KB to `node_modules` and introduces a TypeScript `dom` lib dependency issue (GitHub issue #166) that requires workarounds in Next.js server components. Since we only need 2 endpoints (`GET /search/photos` and `GET /photos/random`), plain `fetch()` with typed response interfaces is simpler, lighter, and avoids the dependency.

**API Endpoints needed:**

```typescript
// Hero image -- fetch a random Veneto food/festival photo
// Server component or API route, called at build time or with ISR
const heroRes = await fetch(
  `https://api.unsplash.com/photos/random?query=italian+food+festival+veneto&orientation=landscape`,
  { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
);

// Fallback images -- search for food-themed photos by sagra title/tags
const fallbackRes = await fetch(
  `https://api.unsplash.com/search/photos?query=sagra+${foodTag}&per_page=1&orientation=landscape`,
  { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
);
```

**Unsplash API Requirements (mandatory):**

1. **Hotlinking required** -- Must use `photo.urls.regular` (1080px) or `photo.urls.small` (400px) directly. Do NOT download and self-host images.
2. **Attribution required** -- Display photographer name + link to their Unsplash profile with UTM params: `?utm_source=nemovia&utm_medium=referral`
3. **Trigger download** -- When a photo is displayed, hit `photo.links.download_location` to track usage. This is a fire-and-forget GET request, not user-visible.

**Rate limit strategy for 50 req/hour demo tier:**

- Hero image: Cache with ISR `revalidate: 3600` (1 request/hour max)
- Fallback images: Pre-fetch during `enrich-sagre` Edge Function (batch, not per-page-load)
- Store Unsplash URLs in `sagre.fallback_image_url` column -- one API call per sagra at enrichment time, not per user visit
- Total: ~15-20 enrichment calls per cron run (well within 50/hour)
- Apply for production (5,000/hour) after launch -- trivial approval process

**Image URL format (response shape):**

```typescript
interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;    // Base URL, add ?w=1200&q=80 for custom size
    full: string;   // Max resolution
    regular: string; // 1080px wide -- USE THIS for hero
    small: string;   // 400px wide -- USE THIS for card fallbacks
    thumb: string;   // 200px wide
  };
  user: {
    name: string;
    links: { html: string }; // Profile URL for attribution
  };
  links: {
    download_location: string; // Trigger download endpoint
  };
}
```

**Environment variable:**

```bash
# .env
UNSPLASH_ACCESS_KEY=your_access_key_here
```

### Alternatives Considered

| Option | Why Not |
|--------|---------|
| `unsplash-js` npm package (v7.0.20) | Unnecessary wrapper over fetch; TypeScript dom lib issues; we need only 2 endpoints |
| Pexels API | Similar quality but stricter rate limits (200 req/month free); Unsplash has better Italian food content |
| Pixabay API | Lower image quality; less curated; aggressive watermarks in free tier |
| Self-hosted image CDN | Violates zero-cost constraint; Supabase Storage transforms require Pro plan |
| Static curated images | Limited variety; doesn't scale; stale feeling |

---

## 2. City Autocomplete Search with Radius Slider

### Approach: Static Veneto comuni JSON + client-side fuzzy filter + Shadcn Combobox

| Property | Value |
|----------|-------|
| **What** | Autocomplete city search with ~580 Veneto municipalities |
| **Install** | `cmdk` (v1.1.1) + Shadcn Popover + Command components |
| **Data source** | Static JSON file with ISTAT comuni data, bundled at build time |
| **Cost** | Free -- static data, no API calls |
| **Confidence** | HIGH |

**Why static JSON instead of Nominatim API autocomplete:**

1. **Nominatim explicitly forbids autocomplete.** Their usage policy states: "Auto-complete search is not yet supported. You must not implement such a service on the client side using the API." Violating this risks IP bans, breaking geocoding for the entire app.

2. **Fixed domain -- only Veneto.** There are ~580 comuni in Veneto across 7 provinces. This is a small, bounded dataset that fits in a ~25KB JSON file. No need for a remote API.

3. **Zero latency.** Client-side string matching against 580 items is instant (<1ms). No network round-trip, no debouncing, no loading states.

4. **Enriched data.** The static file includes coordinates (lat/lng) per city, so selecting a city immediately provides coordinates for the `find_nearby_sagre` RPC -- no additional geocoding call needed.

**Data source:** ISTAT (Italian National Statistics Institute) comuni dataset. Available in JSON from multiple GitHub repositories:
- `github.com/Samurai016/Comuni-ITA` -- REST API + JSON dump, updated regularly
- `github.com/adrianocalvitto/istat-cities` -- all Italian cities in JSON

We filter to Veneto (region code "05") and extract: `{ name, province_code, lat, lng }`.

**Static file structure (`src/data/veneto-comuni.json`):**

```json
[
  { "name": "Abano Terme", "province": "PD", "lat": 45.3586, "lng": 11.7897 },
  { "name": "Agna", "province": "PD", "lat": 45.1742, "lng": 11.9614 },
  ...
]
```

### Shadcn Components to Add

**Combobox** is a composition pattern using Popover + Command. Since the project already has `radix-ui@1.4.3` (bundled), Popover primitives are available. The only new dependency is `cmdk` for the Command search component.

```bash
# Install cmdk for the Command component
pnpm add cmdk@1.1.1

# Add Shadcn components (generates .tsx files, no npm deps beyond cmdk)
npx shadcn@latest add popover command
```

| Component | Purpose | Dependencies |
|-----------|---------|-------------|
| `Popover` | Dropdown container for suggestions | `radix-ui` (already installed) |
| `Command` | Searchable list with keyboard navigation | `cmdk@1.1.1` (NEW) |
| Combobox pattern | Composition of Popover + Command | No additional deps |

**Why cmdk instead of a custom filter dropdown:**

1. **Keyboard navigation.** cmdk provides arrow-key navigation, Enter selection, Escape dismissal, and type-ahead filtering out of the box. Building this from scratch is 200+ lines of accessible focus management.
2. **Shadcn integration.** The Command component is a first-class Shadcn component. It uses the project's existing design tokens and styling patterns.
3. **Tiny footprint.** cmdk is ~4KB gzipped. It has zero dependencies beyond React.
4. **Filtered list performance.** cmdk uses an optimized scoring algorithm for filtering -- better than naive `includes()` for Italian city names with accents.

### Radius Slider

**Shadcn Slider** component, built on `radix-ui` Slider primitive (already available in the bundled package).

```bash
# Add Shadcn Slider component (no new npm deps -- uses radix-ui already installed)
npx shadcn@latest add slider
```

| Component | Purpose | Dependencies |
|-----------|---------|-------------|
| `Slider` | Radius km selector (5-100km range) | `radix-ui` (already installed) |

**UX flow:**

1. User types city name in Combobox on homepage hero
2. Suggestions appear filtered from static JSON
3. User selects city -- lat/lng stored in state
4. Slider appears for radius (default 30km)
5. User taps "Cerca" -- navigates to `/cerca?lat=X&lng=Y&raggio=Z` (existing nuqs URL state)

### Alternatives Considered

| Option | Why Not |
|--------|---------|
| Nominatim API autocomplete | Explicitly forbidden by usage policy; risks IP ban |
| Google Places Autocomplete | Pay-per-request ($2.83/1000 requests); violates zero-cost constraint |
| Mapbox Geocoding API | Free tier limited to 100K req/month; adds API key dependency |
| OSMNames API | External dependency for a fixed 580-item dataset; overkill |
| Custom `<datalist>` HTML | No keyboard navigation, no styling control, no fuzzy matching |
| react-select | Heavy (28KB gzipped); Shadcn Combobox is lighter and matches design system |

---

## 3. Netflix-Style Horizontal Scroll Rows

### Approach: Pure CSS + existing Motion animations -- NO carousel library

| Property | Value |
|----------|-------|
| **What** | Horizontal scroll rows grouped by category (weekend, nearby, cuisine, province) |
| **Install** | Nothing -- CSS flexbox + overflow-x + scroll-snap |
| **Bundle impact** | 0 KB -- pure CSS |
| **Confidence** | HIGH |

**Why pure CSS instead of a carousel library:**

1. **CSS scroll-snap is native and performant.** `scroll-snap-type: x mandatory` with `scroll-snap-align: start` on children gives smooth, predictable snapping without JavaScript scroll position calculations.

2. **No swipe library needed.** Mobile browsers handle touch-to-scroll natively on `overflow-x: auto` elements. Libraries like Swiper.js or react-slick add 30-80KB for functionality the browser provides for free.

3. **Existing Motion animations integrate directly.** The `m.div` + `whileInView` pattern from the current `ScrollReveal` component works on horizontal scroll children. No need for a carousel library's animation system.

4. **Simpler is better for this use case.** Netflix rows are a solved CSS pattern. The cards are fixed-width, horizontally scrollable, with optional prev/next buttons. This is `flex flex-nowrap overflow-x-auto scroll-snap-x-mandatory` in Tailwind.

**Implementation pattern:**

```tsx
// ScrollRow.tsx -- reusable Netflix-style row
function ScrollRow({ title, icon, children }: ScrollRowProps) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold px-4">
        {icon}
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto scroll-snap-x-mandatory
                      px-4 pb-2 scrollbar-hide">
        {children}
      </div>
    </section>
  );
}

// Card inside scroll row -- fixed width + snap alignment
function ScrollRowCard({ sagra }: { sagra: SagraCardData }) {
  return (
    <div className="w-[260px] flex-shrink-0 snap-start">
      <SagraCard sagra={sagra} />
    </div>
  );
}
```

**CSS already in globals.css:**

```css
/* Already exists in globals.css -- scrollbar-hide utility */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

**Tailwind v4 scroll-snap utilities** (`scroll-snap-x-mandatory`, `snap-start`) are built-in. No plugins needed.

**Row categories (smart mix from PROJECT.md requirements):**

| Row | Data Source | Query |
|-----|------------|-------|
| "Questo weekend" | `getWeekendSagre()` (existing) | Active sagre through next Sunday |
| "Vicino a te" | `searchSagre({ lat, lng, raggio: 50 })` | Requires geolocation; hide row if no permission |
| "Sagre di pesce" / cuisine type | `searchSagre({ cucina: 'Pesce' })` | One row per popular food tag |
| "In provincia di Padova" etc. | `searchSagre({ provincia: 'Padova' })` | One row per province with events |

### Alternatives Considered

| Option | Why Not |
|--------|---------|
| Swiper.js | 44KB gzipped; pagination/autoplay features not needed; CSS scroll-snap is sufficient |
| react-slick | 28KB; jQuery heritage; poor React 19 compatibility; touch scrolling is native |
| Embla Carousel | Best React carousel (8KB), but still unnecessary when CSS scroll-snap works |
| Keen Slider | Good but adds dependency for zero benefit over native CSS |
| Custom JS scroll with `requestAnimationFrame` | Over-engineering; CSS handles momentum scrolling natively |

---

## 4. Custom SVG Logo

### Approach: Hand-code SVG inline -- NO design tool dependency in codebase

| Property | Value |
|----------|-------|
| **What** | SVG logo mark + wordmark using Geist font + coral/teal palette |
| **Install** | Nothing -- SVG is inline JSX in a React component |
| **Design tool** | Figma (free tier) for initial design, export as optimized SVG |
| **Confidence** | HIGH |

**Why inline SVG component, not an image file:**

1. **Color theme integration.** The logo uses `currentColor` or CSS custom properties (`var(--primary)`, `var(--accent)`) so it automatically matches the palette. An image file would need multiple versions for different contexts.

2. **Crisp at every size.** SVG scales perfectly from 24px favicon to 200px footer. No need for multiple PNG exports.

3. **Zero network requests.** Inline SVG renders instantly, no `<img>` load or layout shift.

4. **Tiny footprint.** A simple logo SVG is 500-2000 bytes inline -- smaller than any optimized PNG.

**Design approach:**

```tsx
// src/components/brand/Logo.tsx
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Stylized fork/location pin hybrid in coral */}
      <path d="..." fill="var(--primary)" />
      {/* Teal accent element */}
      <circle cx="..." cy="..." r="..." fill="var(--accent)" />
    </svg>
  );
}

// Wordmark version for nav/footer
export function LogoFull({ height = 28 }: { height?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Logo size={height} />
      <span className="font-bold text-foreground" style={{ fontSize: height * 0.7 }}>
        Nemovia
      </span>
    </div>
  );
}
```

**Design recommendations:**

- **Icon concept:** Fork + map pin hybrid (food discovery = eating + location). Simple geometric shapes matching Geist's aesthetic.
- **Colors:** Coral primary fill + teal accent dot/ring. Works on both light backgrounds and dark overlays (using `currentColor` variant for dark contexts).
- **Create in Figma** (free tier), run through SVGO/SVGOMG for optimization, then convert to JSX component.

---

## 5. Full-Width Responsive Layout Changes

### Approach: CSS container width adjustment -- NO new dependencies

| Property | Value |
|----------|-------|
| **What** | Remove `max-w-7xl` constraint for full-width sections (hero, scroll rows) |
| **Install** | Nothing -- Tailwind utility class changes |
| **Confidence** | HIGH |

**Current layout structure (from `src/app/(main)/layout.tsx`):**

```tsx
<main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
  {children}
</main>
```

Everything is constrained to `max-w-7xl` (1280px). For Netflix-style scroll rows and a full-width hero, this needs a mixed approach:

**Recommended layout pattern:**

```tsx
// Layout: full-width wrapper, content sections control their own width
<main className="py-4">
  {children}
</main>

// In page.tsx, sections that need full-width:
<HeroSection />  {/* Full viewport width, no padding */}
<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  <QuickFilters />  {/* Constrained width */}
</div>
<ScrollRow />  {/* Full viewport width for horizontal scroll */}
<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  <ProvinceSection />  {/* Constrained width */}
</div>
```

**Key principle:** Move width constraints from layout to individual page sections. Full-width sections (hero, scroll rows) break out. Content sections (filters, province chips, footer) stay constrained.

The TopNav already has its own `max-w-7xl` constraint internally, so it won't be affected by this change.

---

## 6. Footer Component

### Approach: Pure JSX + Tailwind -- NO new dependencies

| Property | Value |
|----------|-------|
| **What** | Full footer with credits, navigation links, Unsplash attribution |
| **Install** | Nothing |
| **Confidence** | HIGH |

**Key content from PROJECT.md requirements:**

- "Fatto con cuore in Veneto" tagline
- Logo (from section 4 above)
- Navigation links (Home, Cerca, Mappa)
- Unsplash attribution (required by API guidelines): "Photos by Unsplash"
- Source credits: "Dati da SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly"

No external library needed. This is a standard React component with Tailwind styling, reusing the existing `Logo` component and color palette.

---

## 7. New Scraper Sources for Veneto Sagre

### Approach: Add new source configurations to existing `scraper_sources` table -- NO new dependencies

| Property | Value |
|----------|-------|
| **What** | Additional scraper sources to increase event coverage |
| **Install** | Nothing -- existing Cheerio + config-driven generic scraper |
| **Confidence** | MEDIUM (source HTML structures need verification during implementation) |

**Current 5 sources (from PROJECT.md and Edge Function):**

1. SagreItaliane (sagreitaliane.it)
2. EventieSagre (eventiesagre.it)
3. SoloSagre (solosagre.com)
4. TuttoFesta (tuttofesta.it -- assumed)
5. Sagritaly (sagritaly.com)

**New sources to investigate:**

| Source | URL | Coverage | Scraping Approach | Confidence |
|--------|-----|----------|-------------------|------------|
| itinerarinelgusto.it | `/sagre-e-feste/veneto` | Veneto sagre + feste, monthly pages | Generic scraper config -- needs CSS selector discovery | MEDIUM |
| paesiinfesta.com | `/sagre/` | Friuli + Veneto orientale (VE, TV, BL) | WordPress structure -- likely similar to sagritaly | MEDIUM |
| ilturista.info | `/ch/eventi/veneto/` | Veneto events broadly (includes non-sagre) | Needs LLM is_sagra filter; likely structured listings | LOW |
| cibotoday.it | `/storie/` | National weekend event roundups | Article format, not structured listings; harder to scrape | LOW |

**Recommendation:** Start with `itinerarinelgusto.it` and `paesiinfesta.com` -- both are dedicated sagre/feste sites with structured event listings similar to existing sources. The other two have lower signal-to-noise ratios.

**Implementation:** Add rows to `scraper_sources` table with CSS selectors. May need source-specific extraction branches in `extractRawEvent()` if HTML structure differs significantly from generic pattern.

**Source HTML verification required at implementation time.** Cannot confirm exact CSS selectors from research alone -- need to inspect live pages with browser devtools or `cheerio.load()` in a test script.

---

## 8. Data Quality Fixes (No New Dependencies)

All data quality fixes listed in v1.4 requirements use existing infrastructure:

| Fix | Approach | New Deps |
|-----|----------|----------|
| Fix eventi fuori Veneto | Tighten province gating in `upsertEvent()` -- reject if geocoded province not in `VENETO_PROVINCES` | None |
| Fix non-sagre still present | Retroactive `UPDATE sagre SET is_active = false WHERE is_sagra = false` + tighten enrichment | None |
| Investigate event count drop (26 vs 735) | Check `scrape_logs` for errors; verify source URLs haven't changed; re-enable disabled sources | None |
| Always show province in parentheses | Format `location_text` display as `"{city} ({province})"` in components | None |
| Scrape complete info (menus, hours) | Add `selector_description` to source configs; store in `description` or new column | None |
| Fix broken placeholder images | Debug `FadeImage` fallback logic; verify branded placeholder CSS renders correctly | None |

---

## Recommended Stack (Summary Table)

### New npm Dependencies

| Package | Version | Purpose | Size (gzipped) | Why This One |
|---------|---------|---------|----------------|-------------|
| `cmdk` | 1.1.1 | Command/search component for city autocomplete Combobox | ~4KB | Shadcn-native; zero deps; keyboard-accessible; optimized scoring |

### New Shadcn Components (generated .tsx files, no additional npm deps)

| Component | Source | Purpose |
|-----------|--------|---------|
| `Popover` | `npx shadcn@latest add popover` | Dropdown container for Combobox suggestions |
| `Command` | `npx shadcn@latest add command` | Searchable list inside Popover (requires `cmdk`) |
| `Slider` | `npx shadcn@latest add slider` | Radius km selector (5-100km) |

### New Environment Variables

| Variable | Purpose | Where to Get |
|----------|---------|-------------|
| `UNSPLASH_ACCESS_KEY` | Unsplash API authentication | unsplash.com/developers (free registration) |

### New Static Assets

| File | Purpose | Size |
|------|---------|------|
| `src/data/veneto-comuni.json` | City autocomplete data (name, province, lat, lng) | ~25KB |

### New Database Changes

| Change | Purpose |
|--------|---------|
| `ALTER TABLE sagre ADD COLUMN fallback_image_url TEXT` | Unsplash fallback URL for sagre without images |
| New rows in `scraper_sources` table | itinerarinelgusto.it, paesiinfesta.com configs |

### Infrastructure Changes (no new packages)

| Change | Purpose | What Changes |
|--------|---------|--------------|
| Full-width layout | Hero + scroll rows break out of `max-w-7xl` | Layout wrapper in `(main)/layout.tsx` |
| Unsplash server-side fetch | Hero + fallback images | New `lib/unsplash.ts` utility |
| SVG logo component | Brand identity | New `components/brand/Logo.tsx` |
| Footer component | Complete page layout | New `components/layout/Footer.tsx` |
| Netflix scroll rows | Homepage content discovery | New `components/home/ScrollRow.tsx` |
| City Combobox | Homepage search UX | New `components/search/CitySearch.tsx` |
| Source-specific scraper branches | New scraping sources | `scrape-sagre/index.ts` additions |

---

## Libraries Explicitly NOT Adding

### Swiper.js / react-slick / Embla Carousel -- REJECT

**Why considered:** Netflix-style horizontal scroll rows.

**Why not:** CSS `scroll-snap-type` + `overflow-x: auto` provides native touch scrolling, momentum, and snap-to-card behavior with zero JavaScript. The carousel libraries add 8-44KB gzipped for pagination dots and autoplay features that Netflix rows don't need. The existing `scrollbar-hide` CSS utility in `globals.css` already hides the scrollbar.

### unsplash-js -- REJECT

**Why considered:** Official Unsplash API wrapper.

**Why not:** We need exactly 2 API endpoints (`photos/random` and `search/photos`). The library is a thin fetch wrapper that adds 30KB to node_modules, introduces TypeScript `dom` lib dependency issues, and provides no value beyond what a 20-line typed `fetch()` utility provides. Server-side API calls should use native fetch.

### react-select / downshift -- REJECT

**Why considered:** Autocomplete/combobox components.

**Why not:** The project already uses `radix-ui@1.4.3` (bundled Popover primitive) and Shadcn design system. The standard Shadcn Combobox pattern (Popover + Command via `cmdk`) integrates with existing styling, uses the same Radix foundation, and is ~4KB vs react-select's 28KB.

### Mapbox/Google Places Autocomplete -- REJECT

**Why considered:** City search with autocomplete.

**Why not:** The domain is fixed (580 Veneto municipalities). A ~25KB static JSON with client-side filtering is instantaneous, free, offline-capable, and doesn't depend on external APIs with rate limits or costs. Google Places costs $2.83/1000 requests.

### next-themes -- DEFER (same as v1.3)

**Why considered:** Dark mode support.

**Why not now:** v1.4 scope is already large. Can be added in a future milestone.

---

## Installation

```bash
# Single new npm dependency
pnpm add cmdk@1.1.1

# Shadcn components (generates .tsx files into src/components/ui/)
npx shadcn@latest add popover command slider

# No PostgreSQL extensions to add (pg_trgm already enabled from v1.3)

# Environment variable (add to .env)
# UNSPLASH_ACCESS_KEY=your_key_here
```

---

## Sources

### HIGH Confidence (official docs or verified directly)

- [Unsplash API Documentation](https://unsplash.com/documentation) -- rate limits (50/hr demo, 5000/hr production), endpoints, attribution requirements
- [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) -- hotlinking requirement, trigger download requirement
- [Unsplash Hotlinking Guideline](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images) -- must use API-returned URLs directly
- [Unsplash Trigger Download Guideline](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download) -- fire download_location on display
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) -- autocomplete explicitly forbidden
- [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/) -- search endpoint docs, no autocomplete support
- [cmdk npm](https://www.npmjs.com/package/cmdk) -- v1.1.1, last published, 2778 dependents
- [Shadcn Combobox](https://ui.shadcn.com/docs/components/radix/combobox) -- Popover + Command composition pattern
- [Shadcn Slider](https://ui.shadcn.com/docs/components/radix/slider) -- Radix UI Slider primitive
- [Radix UI Slider Primitive](https://www.radix-ui.com/primitives/docs/components/slider) -- single/multi thumb, accessible
- [unsplash-js GitHub](https://github.com/unsplash/unsplash-js) -- v7.0.20, TypeScript dom lib issue (#166)

### MEDIUM Confidence (multiple sources agree)

- [ISTAT Cities JSON (GitHub)](https://github.com/adrianocalvitto/istat-cities) -- Italian municipalities with coordinates
- [Comuni-ITA API (GitHub)](https://github.com/Samurai016/Comuni-ITA) -- Updated ISTAT data with province codes
- [Netflix Carousel Pure CSS (Raddy)](https://raddy.dev/blog/netflix-carousel-using-css/) -- CSS-only implementation pattern
- [3 Ways to Implement Carousel in Next.js (Cloudinary)](https://cloudinary.com/blog/3-ways-to-implement-a-carousel-in-nextjs) -- CSS scroll-snap approach
- [itinerarinelgusto.it](https://www.itinerarinelgusto.it/sagre-e-feste/veneto) -- potential new scraper source, structured event listings
- [paesiinfesta.com](https://paesiinfesta.com/sagre/) -- potential new scraper source, Friuli + Eastern Veneto
- [Database Comuni Italiani](https://www.databasecomuni.it/download-italian-database-of-cities-provincies-cap-coordinates-and-email-in-excel-mysql-and-json-format/) -- alternative ISTAT data source

### LOW Confidence (needs validation during implementation)

- itinerarinelgusto.it and paesiinfesta.com HTML structures -- CSS selectors need browser devtools inspection
- ilturista.info and cibotoday.it scraping feasibility -- lower signal-to-noise, article-format pages
