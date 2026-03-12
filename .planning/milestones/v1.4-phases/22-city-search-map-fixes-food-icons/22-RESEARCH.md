# Phase 22: City Search, Map Fixes & Food Icons - Research

**Researched:** 2026-03-11
**Domain:** City autocomplete search, Leaflet map state synchronization, SVG food type icons
**Confidence:** HIGH

## Summary

Phase 22 has four distinct work areas: (1) food type SVG icons on SagraCard and scroll row titles, (2) city autocomplete search in hero with radius slider, (3) fixing the Cerca page map to respect search filters, and (4) adding filter controls to the dedicated Mappa page. All four areas build on existing code with clear patterns established in previous phases.

The food icons are a pure frontend task requiring ~6 inline SVG icons mapped to the existing `food_tags` array on each sagra. The city autocomplete uses a static `veneto-comuni.json` file (~580 entries with lat/lng) to avoid Nominatim API calls, with Shadcn Combobox for the UI. The map bug is a data-flow issue: `getMapSagre()` ignores all user filters. The Mappa page needs the existing `SearchFilters` component embedded at the top (MapFilterOverlay already does this but needs to be always-visible, not hidden behind a toggle).

**Primary recommendation:** Split into 3 plans: (1) Food icons + scroll row title icons, (2) City autocomplete + radius slider in hero, (3) Map fixes for both Cerca and Mappa pages.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ICON-01 | Minimal food type icons on SagraCard bottom-right + scroll row section titles | Food tag mapping, inline SVG patterns, SagraCard overlay positioning |
| HOME-02 | City autocomplete search bar in hero with radius km slider, redirects to Cerca | Static veneto-comuni.json, Shadcn Combobox, nuqs URL param sync |
| MAP-01 | Cerca page map view works correctly (fix filter sync issue) | Bug analysis: getMapSagre() ignores filters; solution: searchMapSagre(filters) |
| MAP-02 | Dedicated Mappa page has filter controls at top | Reuse SearchFilters, replace toggle overlay with persistent filter bar |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.12 | Framework | Already in use |
| nuqs | 2.8.9 | URL state management | Already manages all search filters |
| Leaflet | 1.9.4 | Map rendering | Already in use with react-leaflet |
| react-leaflet | 5.0.0 | React Leaflet bindings | Already in use |
| lucide-react | 0.577.0 | Icons | Already in use for UI icons |
| radix-ui | 1.4.3 | UI primitives | Already in use via Shadcn |

### New (to install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Shadcn Combobox | latest | City autocomplete dropdown | Hero search bar |
| Shadcn Slider | latest | Radius km range input | Cerca page radius control |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shadcn Combobox | Custom input + dropdown | Combobox handles keyboard nav, fuzzy search, a11y for free |
| Shadcn Slider | HTML range input | Slider has consistent styling, thumb labels, step control |
| Static JSON file | Supabase table for comuni | Static file has zero latency, no API call, ~25KB is trivial |
| Inline SVG icons | Lucide custom icons | Inline SVG gives full control over size/style, no dependency |

**Installation:**
```bash
npx shadcn@latest add combobox slider
```

Note: The combobox component depends on command and popover primitives. The `shadcn add combobox` command installs all dependencies automatically (command, popover, and the combobox itself).

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    home/
      HeroSection.tsx          # Modified: embed CitySearch
      ScrollRowSection.tsx     # Modified: use FoodIcon instead of lucide icon
    sagra/
      SagraCard.tsx            # Modified: add FoodIcon overlay
    search/
      CitySearch.tsx           # NEW: Combobox autocomplete + radius slider
      SearchFilters.tsx        # Modified: add radius slider (Shadcn Slider)
    map/
      MapFilterOverlay.tsx     # Modified: always-visible filter bar for Mappa
  lib/
    constants/
      food-icons.tsx           # NEW: FoodIcon component + tag-to-icon mapping
      veneto-comuni.ts         # NEW: typed export of static comuni data
  public/
    data/
      veneto-comuni.json       # NEW: ~580 comuni with lat/lng (~25KB)
```

### Pattern 1: Food Icon Mapping
**What:** Map food_tags strings to inline SVG icons with a fallback "altro" icon
**When to use:** Whenever displaying food type for a sagra (cards, row titles, popups)
**Example:**
```typescript
// src/lib/constants/food-icons.tsx
import type { ReactNode } from "react";

// Map from food_tag string to icon category
const TAG_TO_CATEGORY: Record<string, string> = {
  "Carne": "carne",
  "Pesce": "pesce",
  "Funghi": "verdura",   // leafy/earthy
  "Radicchio": "verdura",
  "Formaggi": "altro",
  "Vino": "altro",
  "Dolci": "altro",
  "Prodotti Tipici": "altro",
};

// Each icon is a tiny inline SVG, sized at 16x16 by default
const ICONS: Record<string, (className?: string) => ReactNode> = {
  carne: (className) => (
    <svg viewBox="0 0 24 24" className={className} /* steak/meat icon */ >
      {/* ... paths ... */}
    </svg>
  ),
  pesce: (className) => (/* fish icon */),
  zucca: (className) => (/* pumpkin icon */),
  verdura: (className) => (/* leaf icon */),
  gnocco: (className) => (/* dumpling icon */),
  altro: (className) => (/* fork-knife generic icon */),
};

export function FoodIcon({
  foodTags,
  className = "h-4 w-4",
}: {
  foodTags: string[] | null;
  className?: string;
}) {
  const category = getPrimaryCategory(foodTags);
  const renderIcon = ICONS[category] ?? ICONS.altro;
  return renderIcon(className);
}

function getPrimaryCategory(tags: string[] | null): string {
  if (!tags || tags.length === 0) return "altro";
  for (const tag of tags) {
    const cat = TAG_TO_CATEGORY[tag];
    if (cat && cat !== "altro") return cat;
  }
  return "altro";
}
```

### Pattern 2: Static City Autocomplete (No API Calls)
**What:** Load ~580 Veneto comuni from a static JSON file, filter client-side
**When to use:** Hero search bar autocomplete
**Example:**
```typescript
// src/lib/constants/veneto-comuni.ts
import comuniData from "@/../public/data/veneto-comuni.json";

export interface VenetoComune {
  nome: string;
  provincia: string; // "PD", "VR", etc.
  lat: number;
  lng: number;
}

export const VENETO_COMUNI: VenetoComune[] = comuniData as VenetoComune[];

// Client-side fuzzy filter (case-insensitive startsWith)
export function filterComuni(query: string, limit = 8): VenetoComune[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return VENETO_COMUNI
    .filter((c) => c.nome.toLowerCase().startsWith(q))
    .slice(0, limit);
}
```

### Pattern 3: Map Filter Sync Fix
**What:** Pass search filters to map data fetching so map shows filtered results
**When to use:** Cerca page map view
**Example:**
```typescript
// In cerca/page.tsx, replace:
//   vista === "mappa" ? getMapSagre() : Promise.resolve([])
// With:
//   vista === "mappa" ? searchMapSagre(filters) : Promise.resolve([])

// In lib/queries/sagre.ts, add:
export async function searchMapSagre(
  filters: SearchFilters
): Promise<MapMarkerData[]> {
  // Apply the same filters as searchSagre but return MapMarkerData fields
  // When lat/lng present, use find_nearby_sagre RPC + map to MapMarkerData
  // Otherwise, use standard filter chain on MAP_MARKER_FIELDS
}
```

### Pattern 4: City Search to Cerca Redirect
**What:** User selects city from autocomplete, redirect to /cerca with lat/lng/raggio params
**When to use:** Hero section city search
**Example:**
```typescript
// On city selection:
router.push(`/cerca?lat=${city.lat}&lng=${city.lng}&raggio=30`);
```

### Anti-Patterns to Avoid
- **Nominatim API calls during autocomplete:** Explicitly forbidden. Use static JSON only. Single Nominatim call only on selection is also not needed since we have lat/lng in the static file.
- **Loading comuni from Supabase:** Adds network latency and API cost for static data. Use `public/data/` JSON file.
- **Map showing all sagre while filters are active:** This is the current bug. Map data MUST respect active filters.
- **Separate icon component files per food type:** Use a single FoodIcon component with a mapping object, not 6 separate files.
- **cmdk as direct dependency:** Use Shadcn Combobox which wraps cmdk. Don't install cmdk separately -- the Shadcn CLI manages this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autocomplete dropdown | Custom div + input + keyboard handling | Shadcn Combobox (wraps cmdk) | Keyboard navigation, a11y, fuzzy search, scroll management |
| Range slider | HTML `<input type="range">` | Shadcn Slider (Radix) | Consistent styling, thumb labels, step control, a11y |
| Veneto comuni data | Scrape/API at runtime | Static JSON file (~25KB) | Zero latency, no API risk, cached by browser/CDN |
| Food icon SVGs | Download icon pack or use images | Inline SVG in React component | Bundle-optimized, color-customizable via currentColor, tiny size |

**Key insight:** The city autocomplete is the trickiest part architecturally, but using Shadcn Combobox + static data makes it straightforward. The map fix is a simple data-flow correction. Icons are pure presentational.

## Common Pitfalls

### Pitfall 1: Nominatim Rate Limiting
**What goes wrong:** Making autocomplete API calls to Nominatim during typing causes IP bans
**Why it happens:** Nominatim usage policy forbids heavy autocomplete usage, especially from production apps
**How to avoid:** Use static `veneto-comuni.json` exclusively. Zero Nominatim calls during the entire autocomplete flow.
**Warning signs:** Any `fetch("https://nominatim.openstreetmap.org/` in autocomplete code

### Pitfall 2: Map Shows Stale/Unfiltered Data
**What goes wrong:** Switching to map view shows all sagre regardless of active filters
**Why it happens:** Current code calls `getMapSagre()` which has no filter parameters
**How to avoid:** Create `searchMapSagre(filters)` that applies the same filter logic as `searchSagre()`
**Warning signs:** Map marker count doesn't match list result count

### Pitfall 3: Combobox Not Syncing with URL State
**What goes wrong:** City selection updates local state but doesn't navigate to Cerca
**Why it happens:** Combobox manages its own state; need explicit router.push on selection
**How to avoid:** Use `onSelect` callback to call `router.push()` with lat/lng/raggio params
**Warning signs:** Selecting a city does nothing or only updates the input text

### Pitfall 4: Food Icon Mapping Mismatch
**What goes wrong:** Some sagre show "altro" icon even though they have specific food tags
**Why it happens:** food_tags like "Vino" or "Dolci" don't map to the 6 requested icon categories
**How to avoid:** Create explicit TAG_TO_CATEGORY mapping covering all FOOD_TAGS values. Accept that some will map to "altro".
**Warning signs:** Most cards show the "altro" fallback icon

### Pitfall 5: Leaflet Map Not Updating Markers
**What goes wrong:** Map renders once but doesn't update when filter params change
**Why it happens:** Leaflet MapContainer doesn't re-render on prop changes (center/zoom are immutable after init)
**How to avoid:** The current code already handles this correctly via key-based re-mount or data prop changes. React-leaflet Marker components do react to prop changes. The issue is only about which data is passed.
**Warning signs:** Markers on map don't change when filters are applied

### Pitfall 6: Static JSON Not Found in Production
**What goes wrong:** `public/data/veneto-comuni.json` works in dev but 404 in production
**Why it happens:** Import path vs fetch URL confusion, or file not committed
**How to avoid:** Import as module (`import data from "@/../public/data/veneto-comuni.json"`) which gets bundled, OR use `fetch("/data/veneto-comuni.json")` with correct public path
**Warning signs:** Works locally, breaks on Vercel

### Pitfall 7: Slider Value Not Persisting in URL
**What goes wrong:** Radius slider resets to default on page navigation
**Why it happens:** Slider state not connected to nuqs `raggio` param
**How to avoid:** Bind Slider value to nuqs `raggio` state, same as current Input type="number"
**Warning signs:** Slider shows default value after page refresh

## Code Examples

Verified patterns from the existing codebase:

### Current Search Params Pattern (nuqs)
```typescript
// Source: src/components/search/SearchFilters.tsx
const filterParsers = {
  provincia: parseAsString,
  raggio: parseAsInteger.withDefault(30),
  cucina: parseAsString,
  gratis: parseAsBoolean,
  da: parseAsString,
  a: parseAsString,
  lat: parseAsString,
  lng: parseAsString,
};

const [filters, setFilters] = useQueryStates(filterParsers, {
  shallow: false, // triggers server component re-render
});
```

### Current Map View in Cerca (THE BUG)
```typescript
// Source: src/app/(main)/cerca/page.tsx lines 55-58
// BUG: getMapSagre() ignores all user filters
const [sagre, mapSagre] = await Promise.all([
  searchSagre(filters),
  vista === "mappa" ? getMapSagre() : Promise.resolve([]),
]);

// FIX: Replace with filter-aware query
const [sagre, mapSagre] = await Promise.all([
  searchSagre(filters),
  vista === "mappa" ? searchMapSagre(filters) : Promise.resolve([]),
]);
```

### Current ScrollRowSection Icon Pattern
```typescript
// Source: src/app/(main)/page.tsx lines 112-149
// Currently uses lucide icons:
<ScrollRowSection
  title="Sagre di Carne"
  icon={<ChefHat className="h-5 w-5 text-accent" />}
  sagre={row.sagre}
/>

// Phase 22: Replace with FoodIcon:
<ScrollRowSection
  title={`Sagre di ${row.tag}`}
  icon={<FoodIcon foodTags={[row.tag]} className="h-5 w-5 text-accent" />}
  sagre={row.sagre}
/>
```

### Current Hero Search Pill (to be replaced)
```typescript
// Source: src/components/home/HeroSection.tsx lines 33-39
// Currently a non-interactive Link:
<Link
  href="/cerca"
  className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/20 px-5 py-3 text-white backdrop-blur-sm"
>
  <Search className="h-5 w-5" />
  <span>Cerca per nome, citta...</span>
</Link>

// Phase 22: Replace with CitySearch component
```

### SagraCard Food Icon Placement
```typescript
// The icon goes in bottom-right corner, over the image gradient
// Add to SagraCard.tsx after the "Free badge" block:
{sagra.food_tags && sagra.food_tags.length > 0 && (
  <div className="absolute bottom-2 right-2 rounded-full bg-black/40 p-1 backdrop-blur-sm">
    <FoodIcon
      foodTags={sagra.food_tags}
      className="h-4 w-4 text-white/90"
    />
  </div>
)}
```

### Veneto Comuni JSON Structure
```json
// public/data/veneto-comuni.json (~580 entries, ~25KB)
[
  { "nome": "Abano Terme", "provincia": "PD", "lat": 45.3586, "lng": 11.7909 },
  { "nome": "Agna", "provincia": "PD", "lat": 45.1708, "lng": 11.9611 },
  { "nome": "Albettone", "provincia": "VI", "lat": 45.3622, "lng": 11.5806 },
  // ... ~577 more
]
```

### Shadcn Combobox Usage for City Search
```typescript
// Source: Shadcn docs (https://ui.shadcn.com/docs/components/radix/combobox)
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

// Filter comuni client-side
const filtered = query.length >= 2
  ? VENETO_COMUNI.filter(c => c.nome.toLowerCase().startsWith(query.toLowerCase())).slice(0, 8)
  : [];
```

### Shadcn Slider for Radius
```typescript
// Replace current Input type="number" with Slider
import { Slider } from "@/components/ui/slider";

<Slider
  value={[filters.raggio]}
  onValueChange={([val]) => setFilters({ raggio: val })}
  min={5}
  max={100}
  step={5}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cmdk direct install | Shadcn Combobox wraps cmdk | Shadcn v3 | Single CLI command installs all deps |
| Nominatim autocomplete | Static JSON + client filter | Project decision | Zero API risk, instant response |
| Separate icon files per food | Single FoodIcon component | Best practice | One import, one mapping, easy to extend |
| MapView ignoring filters | Filter-aware map queries | Phase 22 fix | Map matches list view results |

**Deprecated/outdated:**
- cmdk v0.x: Shadcn Combobox now wraps cmdk v1.x; don't install cmdk directly
- next-usequerystate: Renamed to nuqs; already using correct package

## Open Questions

1. **Veneto comuni data source**
   - What we know: ~580 comuni in Veneto, need nome + provincia code + lat + lng
   - What's unclear: Best open data source with coordinates already included
   - Recommendation: Generate the JSON by combining matteocontrini/comuni-json (names, province codes) with gnekt/geolocalizzazione-comuni-italiani (coordinates). This is a one-time build step, not runtime. Alternatively, manually curate from ISTAT data. The file is small enough (~25KB) that accuracy matters more than automation.

2. **Food icon design specifics**
   - What we know: User wants "minimal, cute" SVG icons for carne, pesce, zucca, verdura/foglia, gnocco, altro
   - What's unclear: Exact visual style (line art vs filled, coral/teal coloring vs neutral)
   - Recommendation: Use simple line-art SVGs with `currentColor` so they inherit text color. Keep them 24x24 viewBox, render at h-4 w-4 (16px). Style matches lucide-react aesthetic.

3. **Mappa page filter UX**
   - What we know: MAP-02 requires filter controls at top of Mappa page
   - What's unclear: Should it be always-visible filters or the existing toggle overlay (MapFilterOverlay)?
   - Recommendation: Always-visible filter bar at top of page (not overlay on map). The existing MapFilterOverlay works for Cerca's inline map, but the dedicated Mappa page should have prominent, always-visible filters since it's the primary view.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ICON-01 | FoodIcon renders correct SVG for each food tag | unit | `npx vitest run src/lib/constants/__tests__/food-icons.test.ts -x` | No - Wave 0 |
| ICON-01 | getPrimaryCategory maps all FOOD_TAGS | unit | `npx vitest run src/lib/constants/__tests__/food-icons.test.ts -x` | No - Wave 0 |
| HOME-02 | filterComuni returns matching cities for query | unit | `npx vitest run src/lib/constants/__tests__/veneto-comuni.test.ts -x` | No - Wave 0 |
| HOME-02 | filterComuni returns empty for short queries | unit | `npx vitest run src/lib/constants/__tests__/veneto-comuni.test.ts -x` | No - Wave 0 |
| MAP-01 | searchMapSagre applies provincia filter | unit | `npx vitest run src/lib/queries/__tests__/sagre.test.ts -x` | No - Wave 0 |
| MAP-02 | Mappa page filter controls visible | manual-only | Visual verification | N/A |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/constants/__tests__/food-icons.test.ts` -- covers ICON-01 mapping logic
- [ ] `src/lib/constants/__tests__/veneto-comuni.test.ts` -- covers HOME-02 filter logic
- [ ] `public/data/veneto-comuni.json` -- static data file needed for tests

## Sources

### Primary (HIGH confidence)
- Project codebase analysis -- all existing components, queries, types, and patterns inspected
- [Shadcn Combobox docs](https://ui.shadcn.com/docs/components/radix/combobox) -- installation and usage
- [Shadcn Slider docs](https://ui.shadcn.com/docs/components/radix/slider) -- installation and usage
- [nuqs documentation](https://nuqs.dev/) -- URL state management, shallow: false for server re-render

### Secondary (MEDIUM confidence)
- [matteocontrini/comuni-json](https://github.com/matteocontrini/comuni-json) -- Italian municipalities data (no coordinates)
- [gnekt/geolocalizzazione-comuni-italiani](https://github.com/gnekt/geolocalizzazione-comuni-italiani) -- Municipality coordinates CSV
- [opendatasicilia/comuni-italiani](https://github.com/opendatasicilia/comuni-italiani) -- Alternative data source with lat/lng

### Tertiary (LOW confidence)
- [databasecomuni.it](https://www.databasecomuni.it/) -- Commercial/free municipality database with coordinates

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed or well-documented Shadcn additions
- Architecture: HIGH -- patterns directly derived from existing codebase analysis
- Pitfalls: HIGH -- map bug confirmed by code inspection, Nominatim constraint from project requirements
- Food icons: MEDIUM -- exact SVG designs need to be created, but mapping logic is straightforward
- Veneto comuni data: MEDIUM -- multiple sources available, need one-time generation script

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable domain, no fast-moving dependencies)
