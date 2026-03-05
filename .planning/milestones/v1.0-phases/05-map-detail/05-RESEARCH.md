# Phase 5: Map & Detail - Research

**Researched:** 2026-03-05
**Domain:** Interactive mapping (Leaflet), detail pages, geolocation, sharing
**Confidence:** HIGH

## Summary

Phase 5 adds two major features: an interactive map for spatial discovery of sagre, and a detail page for viewing complete sagra information. The map stack is **Leaflet + react-leaflet + react-leaflet-cluster**, all of which are OSS and free -- matching the project's zero-cost constraint. The primary challenge is Leaflet's SSR incompatibility with Next.js: all map components must be loaded via `next/dynamic` with `ssr: false`. The detail page is a straightforward Next.js dynamic route (`/sagra/[slug]`) as a server component with Supabase data fetching.

The project already has the PostGIS `find_nearby_sagre` RPC, the `useGeolocation` hook, and the search page filters -- all of which can be reused. The Sagra type already contains all fields needed for the detail page (`source_url`, `description`, `location`, etc.). The `SagraCard` already links to `/sagra/${sagra.slug}`, so the detail page route is pre-defined.

**Primary recommendation:** Use react-leaflet v5 + react-leaflet-cluster v4 with dynamic imports, a shared `MapView` component for both fullscreen map page and search page toggle, and a server component detail page at `src/app/(main)/sagra/[slug]/page.tsx`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-01 | Interactive map with Leaflet + OpenStreetMap with pin per sagra | react-leaflet v5 + MapContainer + TileLayer with OSM tiles |
| MAP-02 | Marker clustering for nearby sagre | react-leaflet-cluster v4 wrapping markers |
| MAP-03 | Popup on marker click with sagra mini-info | react-leaflet Popup component inside Marker |
| MAP-04 | "Vicino a me" with browser geolocation via PostGIS RPC | Reuse existing `useGeolocation` hook + `find_nearby_sagre` RPC |
| MAP-05 | Fullscreen dedicated map page | Replace placeholder `/mappa` page, map fills viewport minus BottomNav |
| MAP-06 | Lista/mappa toggle on search page | Client-side state toggle, dynamically import map view |
| MAP-07 | Filter overlay on map view | Reuse existing `SearchFilters` component as overlay |
| DET-01 | Detail page with title, dates, hours, address, price, description | Server component at `/sagra/[slug]`, fetch full Sagra row by slug |
| DET-02 | Mini map with single marker on detail page | Small MapContainer with single marker, same dynamic import pattern |
| DET-03 | "Indicazioni" button opens Google Maps with coordinates | `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` |
| DET-04 | "Condividi" button copies link | `navigator.clipboard.writeText(window.location.href)` with toast |
| DET-05 | Link to original sagra source site | Render `source_url` field as external link |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| leaflet | 1.9.4 | Map rendering engine | Industry standard OSS map library, free, no API key needed with OSM tiles |
| react-leaflet | 5.0.0 | React bindings for Leaflet | Official React wrapper, v5 supports React 19 |
| @react-leaflet/core | 3.0.0+ | Core abstractions (peer dep) | Required peer dependency for react-leaflet v5 |
| react-leaflet-cluster | 4.0.0 | Marker clustering | Supports react-leaflet v5 + React 19, wraps Leaflet.markercluster |
| @types/leaflet | latest | TypeScript definitions | Required for TS projects |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/dynamic | (built-in) | Dynamic import with SSR disable | Loading all Leaflet components |
| lucide-react | 0.577.0 | Icons (MapPin, Navigation, Share2, ExternalLink) | Detail page and map UI buttons |
| nuqs | 2.8.9 | URL search param state | lista/mappa toggle state in search page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Leaflet | Mapbox GL JS | Mapbox requires paid API key, overkill for pin maps |
| Leaflet | Google Maps | Requires API key with billing, not free |
| react-leaflet-cluster | react-leaflet-markercluster | v5.0.0-rc.0 only (release candidate), react-leaflet-cluster is stable v4.0.0 |

**Installation:**
```bash
npm install leaflet react-leaflet @react-leaflet/core react-leaflet-cluster
npm install -D @types/leaflet
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/(main)/
    mappa/page.tsx                     # Fullscreen map page (server component wrapper)
    cerca/page.tsx                     # Updated: add vista query param for toggle
    sagra/[slug]/page.tsx              # Detail page (server component)
  components/
    map/
      MapView.tsx                      # Main map client component ("use client")
      MapView.dynamic.tsx              # Dynamic import wrapper (ssr: false)
      MapMarkerPopup.tsx               # Marker popup content
      LocationButton.tsx               # "Vicino a me" button overlay
      MapFilterOverlay.tsx             # Filters overlay for map view
    detail/
      SagraDetail.tsx                  # Detail page content layout
      DetailMiniMap.tsx                # Small map for detail page ("use client")
      DetailMiniMap.dynamic.tsx        # Dynamic import wrapper
      ShareButton.tsx                  # Copy link button ("use client")
      DirectionsButton.tsx             # Google Maps directions button
  lib/
    queries/
      sagre.ts                         # Add getSagraBySlug() and getMapSagre()
      types.ts                         # Add SagraDetailData type
```

### Pattern 1: Leaflet Dynamic Import (SSR Avoidance)
**What:** All Leaflet-dependent components must be loaded client-side only
**When to use:** Every file that imports from `leaflet` or `react-leaflet`
**Example:**
```typescript
// src/components/map/MapView.dynamic.tsx
// Source: Next.js docs + react-leaflet community pattern
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("./MapView"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <p className="text-muted-foreground">Caricamento mappa...</p>
      </div>
    ),
  }
);

export default MapView;
```

```typescript
// src/components/map/MapView.tsx
"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

// Fix default marker icon (Webpack breaks Leaflet's icon URL detection)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
});

// ... MapContainer usage
```

### Pattern 2: Server Component Detail Page with Slug
**What:** Dynamic route fetching a single sagra by slug
**When to use:** `/sagra/[slug]` route
**Example:**
```typescript
// src/app/(main)/sagra/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getSagraBySlug } from "@/lib/queries/sagre";

export default async function SagraDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sagra = await getSagraBySlug(slug);

  if (!sagra) {
    notFound();
  }

  return <SagraDetail sagra={sagra} />;
}
```

### Pattern 3: Lista/Mappa Toggle on Search Page
**What:** Toggle between list view and map view using URL state
**When to use:** Search page view switching
**Example:**
```typescript
// In SearchFilters or a new toggle component
import { parseAsStringEnum, useQueryState } from "nuqs";

type ViewMode = "lista" | "mappa";
const [vista, setVista] = useQueryState(
  "vista",
  parseAsStringEnum<ViewMode>(["lista", "mappa"]).withDefault("lista")
);
```

### Pattern 4: Share Button with Clipboard API
**What:** Copy current URL to clipboard with visual feedback
**When to use:** Detail page "Condividi" button
**Example:**
```typescript
"use client";
import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: Web Share API on mobile
      if (navigator.share) {
        await navigator.share({ url: window.location.href });
      }
    }
  };

  return (
    <Button onClick={handleShare} variant="outline">
      {copied ? <Check /> : <Share2 />}
      {copied ? "Copiato!" : "Condividi"}
    </Button>
  );
}
```

### Pattern 5: Google Maps Directions Link
**What:** Open Google Maps with destination coordinates for driving directions
**When to use:** Detail page "Indicazioni" button
**Example:**
```typescript
function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
// Render as <a href={url} target="_blank" rel="noopener noreferrer">
```

### Anti-Patterns to Avoid
- **Importing leaflet at module top-level in server components:** Leaflet accesses `window` and `document` on import -- ALWAYS use dynamic import with `ssr: false`
- **Using default Leaflet markers without icon fix:** Webpack breaks the default icon URL detection -- must delete `_getIconUrl` and set paths manually
- **Rendering MapContainer without explicit height:** Leaflet requires its container to have explicit CSS height -- `h-0` or no height = invisible map
- **Fetching all sagra fields for map markers:** Map only needs id, slug, title, location_text, start_date, lat/lng -- keep payloads lean with a `MAP_MARKER_FIELDS` constant
- **Re-creating MapContainer on every render:** MapContainer props (center, zoom) are immutable after initial render -- use `map.setView()` or `useMap()` hook to update programmatically

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map rendering | Custom canvas/SVG map | Leaflet + react-leaflet | Handles tile loading, zoom, pan, touch, projections |
| Marker clustering | Custom proximity grouping | react-leaflet-cluster | Handles zoom-level-dependent aggregation, spiderfying, animation |
| Marker icons | Custom SVG pin rendering | Leaflet L.Icon with `/public` assets or L.divIcon | Handles retina, shadow, anchor points |
| Geolocation | Custom navigator.geolocation wrapper | Existing `useGeolocation` hook | Already built, handles errors in Italian |
| URL state for view toggle | Custom useState + pushState | nuqs `parseAsStringEnum` | Already in project, syncs with URL, SSR-compatible |
| Spatial queries | Custom haversine formula in JS | PostGIS `find_nearby_sagre` RPC | Already built, server-side, indexed, accurate |

**Key insight:** The project already has PostGIS, geolocation hook, and nuqs -- reuse them rather than building parallel systems.

## Common Pitfalls

### Pitfall 1: Leaflet CSS Not Loaded
**What goes wrong:** Map tiles render but controls, popups, and markers look broken or invisible
**Why it happens:** Leaflet CSS must be explicitly imported; it's not bundled automatically
**How to avoid:** Import `"leaflet/dist/leaflet.css"` at the top of the client map component; also import `"react-leaflet-cluster/lib/assets/MarkerCluster.css"` and `"react-leaflet-cluster/lib/assets/MarkerCluster.Default.css"` for cluster styling
**Warning signs:** Tiles visible but markers/popups mispositioned or unstyled

### Pitfall 2: MapContainer Height is Zero
**What goes wrong:** Map component renders but nothing is visible
**Why it happens:** Leaflet requires explicit height on its container div; Tailwind utility classes like `h-full` only work if parent has explicit height
**How to avoid:** Use explicit height classes: `h-[calc(100vh-8rem)]` for fullscreen (accounting for BottomNav and padding), or `h-64` for mini-map
**Warning signs:** DOM inspector shows map container with 0px height

### Pitfall 3: Marker Icon 404
**What goes wrong:** Markers show as broken images or don't appear
**Why it happens:** Webpack/Turbopack transforms Leaflet's default icon URLs into data URIs or hashed filenames that don't resolve
**How to avoid:** Delete `L.Icon.Default.prototype._getIconUrl` and use `L.Icon.Default.mergeOptions()` with correct paths from the leaflet package, OR copy marker-icon.png and marker-shadow.png to `/public` and reference them directly
**Warning signs:** Network tab shows 404 for marker-icon.png

### Pitfall 4: MapContainer Props Are Immutable
**What goes wrong:** Changing `center` or `zoom` props on MapContainer has no effect after first render
**Why it happens:** Leaflet's MapContainer creates the map instance once; subsequent prop changes are ignored by design
**How to avoid:** Use the `useMap()` hook inside a child component to call `map.setView()`, `map.flyTo()`, or `map.fitBounds()` programmatically
**Warning signs:** Map doesn't re-center when user clicks "Vicino a me"

### Pitfall 5: Hydration Mismatch with Dynamic Import
**What goes wrong:** React hydration errors in console
**Why it happens:** Server renders the loading fallback but client renders the map -- if the fallback structure differs from what the client expects
**How to avoid:** Always use `next/dynamic` with `ssr: false` (not just `"use client"`); the `ssr: false` flag is what prevents server-side rendering entirely
**Warning signs:** Console warnings about hydration mismatch

### Pitfall 6: Location Column Is PostGIS Geography, Not Simple lat/lng
**What goes wrong:** Trying to read lat/lng directly from `location` column
**Why it happens:** PostGIS stores location as `geography(POINT, 4326)` which serializes as GeoJSON `{type: "Point", coordinates: [lng, lat]}` -- note the lng/lat order (not lat/lng)
**How to avoid:** Parse coordinates as `[location.coordinates[1], location.coordinates[0]]` for Leaflet (which expects `[lat, lng]`)
**Warning signs:** Markers appear in wrong locations (swapped lat/lng)

### Pitfall 7: Turbopack and Leaflet Static Assets
**What goes wrong:** Leaflet marker images fail to load when using Turbopack
**Why it happens:** Turbopack handles static asset imports differently than Webpack
**How to avoid:** Copy marker icon files to `/public/` and reference them with absolute paths (`/marker-icon.png`) rather than importing from the leaflet package
**Warning signs:** Works in `next build` but breaks in `next dev --turbopack`

## Code Examples

### Fetching a Single Sagra by Slug
```typescript
// Source: Project pattern from existing sagre.ts queries
export async function getSagraBySlug(slug: string): Promise<Sagra | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sagre")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("getSagraBySlug error:", error.message);
      return null;
    }
    return data as Sagra;
  } catch (err) {
    console.error("getSagraBySlug unexpected error:", err);
    return null;
  }
}
```

### Fetching Map Marker Data (Lean)
```typescript
// Source: Project pattern, lean field selection
const MAP_MARKER_FIELDS = "id, slug, title, location_text, province, start_date, end_date, food_tags, location, is_free";

export async function getMapSagre(): Promise<MapMarkerData[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sagre")
      .select(MAP_MARKER_FIELDS)
      .eq("is_active", true)
      .not("location", "is", null);

    if (error) {
      console.error("getMapSagre error:", error.message);
      return [];
    }
    return (data as MapMarkerData[]) ?? [];
  } catch (err) {
    console.error("getMapSagre unexpected error:", err);
    return [];
  }
}
```

### MapContainer with Clustering
```typescript
// Source: react-leaflet docs + react-leaflet-cluster docs
"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

const VENETO_CENTER: [number, number] = [45.44, 12.32]; // approx center of Veneto
const DEFAULT_ZOOM = 8;

interface MapViewProps {
  sagre: MapMarkerData[];
  center?: [number, number];
  zoom?: number;
}

export default function MapView({ sagre, center, zoom }: MapViewProps) {
  return (
    <MapContainer
      center={center ?? VENETO_CENTER}
      zoom={zoom ?? DEFAULT_ZOOM}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup chunkedLoading>
        {sagre.map((sagra) => {
          if (!sagra.location) return null;
          const [lng, lat] = sagra.location.coordinates;
          return (
            <Marker key={sagra.id} position={[lat, lng]}>
              <Popup>
                <MapMarkerPopup sagra={sagra} />
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
```

### Programmatic Map Re-centering (useMap)
```typescript
// Source: react-leaflet docs
"use client";

import { useMap } from "react-leaflet";
import { useEffect } from "react";

interface RecenterProps {
  lat: number;
  lng: number;
}

function RecenterMap({ lat, lng }: RecenterProps) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 12);
  }, [lat, lng, map]);
  return null;
}
```

### OpenStreetMap Tile Layer (Free, No API Key)
```typescript
// Source: OpenStreetMap tile usage policy
<TileLayer
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-leaflet v4 + React 18 | react-leaflet v5 + React 19 | 2024 | Must use v5 for React 19 compat |
| react-leaflet-markercluster | react-leaflet-cluster | 2024 | react-leaflet-cluster has stable v4 for RL v5; markercluster is RC only |
| Leaflet 1.x | Leaflet 2.0-alpha | Aug 2025 | Stay on 1.9.4 stable; 2.0 not production-ready |
| getStaticPaths + getStaticProps | generateStaticParams (optional) | Next.js 13+ | App Router uses async params in server components |
| useRouter().query.slug | params Promise in Next.js 15 | Next.js 15 | `params` is now a Promise, must be awaited |

**Deprecated/outdated:**
- `LeafletProvider` component: Removed in react-leaflet v5, no longer needed
- `react-leaflet-markercluster`: Use `react-leaflet-cluster` instead for stable v5 support

## Open Questions

1. **Leaflet marker icons with Turbopack**
   - What we know: Webpack breaks default icon URLs; standard fix is `delete _getIconUrl` + `mergeOptions`
   - What's unclear: Whether Turbopack (used by `next dev --turbopack`) handles leaflet image imports the same way
   - Recommendation: Copy marker icons to `/public/` and use absolute paths as the safest approach

2. **OpenStreetMap tile rate limits**
   - What we know: OSM tile servers have a usage policy (no heavy use, proper attribution required)
   - What's unclear: Whether the project's traffic will exceed OSM's fair use policy
   - Recommendation: Start with OSM tiles; if traffic grows, switch to a tile CDN (e.g., Stadia Maps free tier). Always include proper attribution.

3. **react-leaflet-cluster CSS imports**
   - What we know: v4.0.0 no longer auto-imports CSS; must import manually
   - What's unclear: Exact CSS file paths in the v4.0.0 package
   - Recommendation: Check `node_modules/react-leaflet-cluster` after install; may need `leaflet.markercluster/dist/MarkerCluster.css` and `MarkerCluster.Default.css` from the underlying `leaflet.markercluster` package

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | Map renders with markers from sagre data | manual-only | Manual: verify map loads in browser | N/A |
| MAP-02 | Markers cluster when zoomed out | manual-only | Manual: zoom out and verify cluster icons | N/A |
| MAP-03 | Popup shows mini-info on marker click | manual-only | Manual: click marker, verify popup content | N/A |
| MAP-04 | "Vicino a me" centers map on user location | manual-only | Manual: click button, verify map recenters | N/A |
| MAP-05 | Fullscreen map page renders | manual-only | Manual: navigate to /mappa | N/A |
| MAP-06 | Lista/mappa toggle works on search page | manual-only | Manual: toggle between views | N/A |
| MAP-07 | Filters overlay works on map view | manual-only | Manual: apply filter, verify markers update | N/A |
| DET-01 | Detail page shows all sagra info | unit | `npx vitest run src/lib/queries/__tests__/sagre.test.ts -t "getSagraBySlug"` | No -- Wave 0 |
| DET-02 | Mini map renders on detail page | manual-only | Manual: verify mini map on detail page | N/A |
| DET-03 | "Indicazioni" button opens Google Maps | unit | `npx vitest run src/lib/__tests__/directions.test.ts` | No -- Wave 0 |
| DET-04 | "Condividi" copies link | manual-only | Manual: click button, paste to verify | N/A |
| DET-05 | Source link renders correctly | manual-only | Manual: verify link on detail page | N/A |

**Note:** Most MAP-* requirements involve interactive browser behavior (map rendering, click events, geolocation) that cannot be meaningfully unit-tested. The value is in verifying the data layer queries and URL construction functions.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test && npm run build`
- **Phase gate:** Full suite green + manual map interaction check

### Wave 0 Gaps
- [ ] `src/lib/queries/__tests__/sagre.test.ts` -- add tests for `getSagraBySlug` and `getMapSagre` query functions
- [ ] `src/lib/__tests__/directions.test.ts` -- test `getDirectionsUrl()` helper
- [ ] No new framework installs needed; Vitest already configured

## Sources

### Primary (HIGH confidence)
- [react-leaflet v5.0.0 release](https://github.com/PaulLeCam/react-leaflet/releases/tag/v5.0.0) - React 19 peer dependency, LeafletProvider removal
- [react-leaflet-cluster v4.0.0](https://github.com/akursat/react-leaflet-cluster) - Peer deps: react-leaflet 5.x, leaflet 1.9.x, React 19.x
- [Leaflet 1.9.4](https://leafletjs.com/download.html) - Current stable version
- [Next.js dynamic routes docs](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes) - App Router dynamic route pattern
- [react-leaflet installation docs](https://react-leaflet.js.org/docs/start-installation/) - Peer dependencies and setup

### Secondary (MEDIUM confidence)
- [XXL Steve: React Leaflet on Next.js 15](https://xxlsteve.net/blog/react-leaflet-on-next-15/) - Verified dynamic import pattern with working code
- [PlaceKit: Making React-Leaflet work with NextJS](https://placekit.io/blog/articles/making-react-leaflet-work-with-nextjs-493i) - SSR avoidance pattern, icon fix
- [Leaflet marker icon issue #7424](https://github.com/Leaflet/Leaflet/issues/7424) - Webpack icon URL fix

### Tertiary (LOW confidence)
- Cluster CSS import paths for v4.0.0 -- needs verification after `npm install`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified versions, peer deps, and compatibility from npm/GitHub releases
- Architecture: HIGH - Patterns match existing project conventions (server components, lean field selection, nuqs)
- Pitfalls: HIGH - Well-documented issues across multiple sources (SSR, icon fix, CSS, height)
- Detail page: HIGH - Straightforward Next.js dynamic route + existing Supabase patterns

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable libraries, no breaking changes expected)
