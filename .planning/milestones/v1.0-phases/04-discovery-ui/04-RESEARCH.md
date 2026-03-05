# Phase 4: Discovery UI - Research

**Researched:** 2026-03-05
**Domain:** Next.js 15 App Router data fetching, Supabase PostGIS queries, URL-based filter state, browser Geolocation API, SagraCard component design
**Confidence:** HIGH

## Summary

Phase 4 transforms the placeholder pages from Phase 1 into a fully functional discovery experience: a homepage with hero section, "Questo weekend" sagre, emoji quick-filter chips, and a "Per provincia" section; a reusable SagraCard component; and a search page with multi-filter support (provincia, raggio km, date range, gratis/pagamento, tipo cucina) that sorts by distance when geolocation is active.

The implementation sits on top of the existing stack: Next.js 15 with App Router (server components for data fetching, client components for interactive filters), Supabase with PostGIS (spatial queries via RPC), and the existing shadcn/ui design system with brand theming. The key technical decisions are: (1) use server components for initial data loading via the existing `createClient()` from `@/lib/supabase/server`, (2) use `nuqs` for type-safe URL search params to drive filter state on the search page, (3) create a new `find_nearby_sagre` PostGIS RPC function (migration 004) for distance-based sorting, and (4) use the browser Geolocation API via a custom `useGeolocation` hook for distance features.

**Primary recommendation:** Build in 3 waves -- (1) database migration for `find_nearby_sagre` RPC + data access layer + SagraCard component, (2) homepage with hero/weekend/chips/province sections, (3) search page with filters + distance sorting.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DISC-01 | Homepage con hero "Scopri le sagre del Veneto" e barra ricerca | Server component page, hero section with search bar linking to /cerca |
| DISC-02 | Sezione "Questo weekend" con sagre dei prossimi 3 giorni | Supabase query with date filter `.gte('start_date', today).lte('start_date', threeDaysOut)` or end_date overlap |
| DISC-03 | Quick filter chips emoji (Pesce, Carne, Formaggi, Vino, Radicchio, Funghi, Gratis, Oggi) | Client component with emoji-labeled badge buttons, navigate to /cerca with pre-filled searchParams |
| DISC-04 | SagraCard con immagine, titolo, citta(provincia), date, food tags (max 3), prezzo, distanza | Reusable component using shadcn Card + Badge, next/image for images, distance prop optional |
| DISC-05 | Enriched description come sottotitolo nella card (se disponibile) | Display `enhanced_description` field from Sagra type as CardDescription |
| DISC-06 | Pagina ricerca con filtri: provincia, raggio km, date, gratis/pagamento, tipo cucina | nuqs for URL state, Supabase filter chaining, shadcn Select/Input components |
| DISC-07 | Ordinamento risultati per distanza quando geolocalizzazione attiva | PostGIS `find_nearby_sagre` RPC function, browser Geolocation API via custom hook |
| DISC-08 | Sezione "Per provincia" in homepage con conteggio sagre | Supabase query with GROUP BY province count, server component rendering |
</phase_requirements>

## Standard Stack

### Core (Phase 4 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nuqs | 2.x | Type-safe URL search params state | Used by Vercel, Sentry, Supabase. Replaces manual searchParams parsing. 6kB gzipped. Presented at Next.js Conf 2025. |
| next/image | (built-in) | Optimized image rendering for sagra cards | Automatic format conversion, lazy loading, responsive sizing. Requires `remotePatterns` config. |

### Already Installed (from Phase 1)

| Library | Purpose | Usage in Phase 4 |
|---------|---------|------------------|
| @supabase/ssr + @supabase/supabase-js | Database queries | Server-side data fetching in page components |
| shadcn/ui (Card, Badge, Skeleton, Button) | UI components | SagraCard, filter chips, loading states |
| lucide-react | Icons | Search, MapPin, Calendar, Tag icons |
| class-variance-authority + clsx + tailwind-merge | Styling utilities | Component variant styling |

### New shadcn Components to Add

| Component | Purpose | Install Command |
|-----------|---------|-----------------|
| Select | Province dropdown, tipo cucina filter | `npx shadcn@latest add select` |
| Input | Search bar, raggio km input | `npx shadcn@latest add input` |
| Slider | Raggio km range control (alternative to input) | `npx shadcn@latest add slider` |
| Toggle Group | Gratis/pagamento toggle | `npx shadcn@latest add toggle-group` |
| Popover | Date range picker container | `npx shadcn@latest add popover` |
| Calendar | Date range selection | `npx shadcn@latest add calendar` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nuqs | Manual searchParams parsing | nuqs provides type safety, batched updates, server component cache. Manual approach is fragile with 6+ filter params. |
| Custom date picker | react-day-picker standalone | shadcn Calendar wraps react-day-picker already. Use shadcn for consistency. |
| Client-side filtering | Server-side filtering | Server-side keeps data fetching on the server, doesn't expose DB secrets, leverages PostGIS indexes. Use server-side. |

**Installation:**
```bash
npm install nuqs
npx shadcn@latest add select input slider toggle-group popover calendar
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(main)/
│   ├── page.tsx                   # Homepage (server component)
│   └── cerca/
│       └── page.tsx               # Search page (server component)
├── components/
│   ├── sagra/
│   │   ├── SagraCard.tsx          # Reusable card (server component)
│   │   ├── SagraCardSkeleton.tsx  # Loading placeholder
│   │   └── SagraGrid.tsx          # Responsive grid wrapper
│   ├── home/
│   │   ├── HeroSection.tsx        # Hero with search bar
│   │   ├── WeekendSection.tsx     # "Questo weekend" sagre
│   │   ├── QuickFilters.tsx       # Emoji filter chips (client)
│   │   └── ProvinceSection.tsx    # "Per provincia" counts
│   ├── search/
│   │   ├── SearchFilters.tsx      # Filter controls (client)
│   │   ├── SearchResults.tsx      # Results grid
│   │   └── ActiveFilters.tsx      # Active filter display
│   └── ui/                        # shadcn components (existing)
├── hooks/
│   └── useGeolocation.ts          # Browser geolocation hook
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # (existing) Browser client
│   │   └── server.ts              # (existing) Server client
│   ├── queries/
│   │   ├── sagre.ts               # Supabase query functions
│   │   └── types.ts               # Query parameter types
│   └── constants/
│       └── veneto.ts              # Provinces, food tags, etc.
└── types/
    └── database.ts                # (existing) Sagra type
```

### Pattern 1: Server Component Data Fetching with Supabase

**What:** Page-level server components fetch data directly from Supabase using the server client. No API routes needed.

**When to use:** All initial page loads (homepage sections, search results).

**Example:**
```typescript
// src/app/(main)/page.tsx
// Source: Next.js 15 App Router + Supabase SSR pattern
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  // Weekend sagre (next 3 days)
  const today = new Date().toISOString().split("T")[0];
  const threeDaysOut = new Date(Date.now() + 3 * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: weekendSagre } = await supabase
    .from("sagre")
    .select("id, title, slug, location_text, province, start_date, end_date, enhanced_description, food_tags, image_url, is_free, price_info")
    .eq("is_active", true)
    .or(`start_date.lte.${threeDaysOut},end_date.gte.${today}`)
    .order("start_date", { ascending: true })
    .limit(8);

  // Province counts
  const { data: provinceCounts } = await supabase
    .rpc("count_sagre_by_province");

  return (
    <>
      <HeroSection />
      <WeekendSection sagre={weekendSagre ?? []} />
      <QuickFilters />
      <ProvinceSection counts={provinceCounts ?? []} />
    </>
  );
}
```

### Pattern 2: Async searchParams in Next.js 15

**What:** In Next.js 15, `searchParams` is a Promise. Server components must await it.

**When to use:** Search page, any page that reads URL query params.

**Example:**
```typescript
// src/app/(main)/cerca/page.tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/page
export default async function CercaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const provincia = typeof params.provincia === "string" ? params.provincia : undefined;
  const cucina = typeof params.cucina === "string" ? params.cucina : undefined;
  const raggio = typeof params.raggio === "string" ? parseInt(params.raggio, 10) : undefined;

  // Build Supabase query based on filters...
}
```

### Pattern 3: nuqs for Client-Side Filter State

**What:** Use nuqs to synchronize filter UI state with URL search params. Client components update the URL; the server component re-renders with new data.

**When to use:** Search page filter controls.

**Example:**
```typescript
// src/components/search/SearchFilters.tsx
"use client";
import { useQueryStates, parseAsString, parseAsInteger, parseAsBoolean } from "nuqs";

const filterParsers = {
  provincia: parseAsString,
  raggio: parseAsInteger.withDefault(30),
  cucina: parseAsString,
  gratis: parseAsBoolean,
  da: parseAsString,  // date start YYYY-MM-DD
  a: parseAsString,   // date end YYYY-MM-DD
};

export function SearchFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: false, // trigger server re-render
  });

  return (
    // Filter UI components that call setFilters(...)
  );
}
```

**Setup required in root layout:**
```typescript
// src/app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

### Pattern 4: Conditional Supabase Query Building

**What:** Build Supabase queries incrementally by chaining filters only when the param exists.

**When to use:** Search page where 0-6 filters may be active simultaneously.

**Example:**
```typescript
// src/lib/queries/sagre.ts
import { createClient } from "@/lib/supabase/server";

interface SearchFilters {
  provincia?: string;
  cucina?: string;
  gratis?: boolean;
  da?: string;
  a?: string;
  lat?: number;
  lng?: number;
  raggio?: number; // km
}

export async function searchSagre(filters: SearchFilters) {
  const supabase = await createClient();

  // If geolocation available, use RPC for distance sorting
  if (filters.lat && filters.lng) {
    const { data } = await supabase.rpc("find_nearby_sagre", {
      user_lat: filters.lat,
      user_lng: filters.lng,
      radius_meters: (filters.raggio ?? 30) * 1000,
      max_results: 50,
    });
    // Apply additional filters in-memory or add to RPC
    return data;
  }

  // Non-geo query: standard Supabase chaining
  let query = supabase
    .from("sagre")
    .select("id, title, slug, location_text, province, start_date, end_date, enhanced_description, food_tags, image_url, is_free, price_info, location")
    .eq("is_active", true);

  if (filters.provincia) {
    query = query.eq("province", filters.provincia);
  }
  if (filters.cucina) {
    query = query.contains("food_tags", [filters.cucina]);
  }
  if (filters.gratis !== undefined) {
    query = query.eq("is_free", filters.gratis);
  }
  if (filters.da) {
    query = query.gte("end_date", filters.da);
  }
  if (filters.a) {
    query = query.lte("start_date", filters.a);
  }

  query = query.order("start_date", { ascending: true }).limit(50);

  const { data } = await query;
  return data;
}
```

### Pattern 5: Browser Geolocation Hook

**What:** Custom React hook wrapping `navigator.geolocation.getCurrentPosition` for client components.

**When to use:** SagraCard distance display, search page distance sorting.

**Example:**
```typescript
// src/hooks/useGeolocation.ts
"use client";
import { useState, useEffect, useCallback } from "react";

interface GeoState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    lat: null, lng: null, error: null, loading: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: "Geolocation not supported" }));
      return;
    }
    setState(s => ({ ...s, loading: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        error: null,
        loading: false,
      }),
      (err) => setState(s => ({
        ...s, error: err.message, loading: false,
      })),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { ...state, requestLocation };
}
```

### Pattern 6: PostGIS find_nearby_sagre RPC (Database Migration)

**What:** Postgres function that returns sagre within a radius, sorted by distance, using PostGIS spatial index.

**When to use:** DISC-07 (distance sorting), later MAP-04 ("Vicino a me").

**Example:**
```sql
-- Migration 004_discovery.sql
-- CRITICAL: Use extensions. prefix for PostGIS functions (Supabase installs PostGIS in extensions schema)
CREATE OR REPLACE FUNCTION public.find_nearby_sagre(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 50000,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  location_text TEXT,
  province TEXT,
  start_date DATE,
  end_date DATE,
  enhanced_description TEXT,
  food_tags TEXT[],
  feature_tags TEXT[],
  image_url TEXT,
  is_free BOOLEAN,
  price_info TEXT,
  distance_km DOUBLE PRECISION
)
SET search_path = ''
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id, s.title, s.slug, s.location_text, s.province,
    s.start_date, s.end_date,
    s.enhanced_description, s.food_tags, s.feature_tags,
    s.image_url, s.is_free, s.price_info,
    ROUND((extensions.st_distance(
      s.location,
      extensions.st_point(user_lng, user_lat)::extensions.geography
    ) / 1000.0)::numeric, 1)::double precision AS distance_km
  FROM public.sagre s
  WHERE s.is_active = true
    AND s.location IS NOT NULL
    AND extensions.st_dwithin(
      s.location,
      extensions.st_point(user_lng, user_lat)::extensions.geography,
      radius_meters
    )
  ORDER BY s.location OPERATOR(extensions.<->)
    extensions.st_point(user_lng, user_lat)::extensions.geography
  LIMIT max_results;
$$;

-- Province count helper for homepage
CREATE OR REPLACE FUNCTION public.count_sagre_by_province()
RETURNS TABLE (
  province TEXT,
  count BIGINT
)
SET search_path = ''
LANGUAGE sql STABLE
AS $$
  SELECT province, COUNT(*) as count
  FROM public.sagre
  WHERE is_active = true
    AND province IS NOT NULL
  GROUP BY province
  ORDER BY count DESC;
$$;
```

### Anti-Patterns to Avoid

- **Client-side data fetching with exposed keys:** Never call Supabase from client components for read queries. The server component pattern keeps the anon key server-side and avoids unnecessary client JS.
- **Computing distance in JavaScript:** Use PostGIS `ST_Distance` and `<->` operator. JS Haversine calculations cannot use spatial indexes and are orders of magnitude slower.
- **Synchronous searchParams access:** Next.js 15 made `searchParams` a Promise. Using it synchronously triggers deprecation warnings and will break in Next.js 16.
- **Fetching all columns with `select('*')`:** Select only the columns needed for the card/list view. The `description` and `content_hash` fields are large and unnecessary for cards.
- **Hardcoding filter values in URL:** Use nuqs parsers to serialize/deserialize. Manual `router.push(`/cerca?provincia=${val}`)` leads to encoding bugs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL search param state | Manual URLSearchParams parsing + router.push | nuqs | Type safety, batched updates, serialization, server component integration. 6+ params makes manual approach fragile. |
| Distance calculation | Haversine formula in JS | PostGIS ST_Distance + <-> operator | Spatial index utilization, sub-millisecond queries, accurate geodesic distance |
| Date picker | Custom date input | shadcn Calendar + Popover | Accessibility, locale support, range selection, keyboard nav |
| Image optimization | Manual img tags with lazy loading | next/image | Automatic WebP/AVIF, responsive srcset, lazy loading, blur placeholder |
| Province/tag dropdowns | Custom dropdown menus | shadcn Select | Accessible, keyboard-navigable, styled consistently with design system |

**Key insight:** Phase 4 is UI-heavy but data-driven. The heavy lifting (distance calculation, spatial filtering) belongs in PostGIS. The UI layer should focus on presentation and filter state management, not computation.

## Common Pitfalls

### Pitfall 1: PostGIS Function Schema Prefix
**What goes wrong:** Queries fail with `function st_dwithin does not exist`.
**Why it happens:** Supabase installs PostGIS in the `extensions` schema, not `public`. Bare function names like `ST_DWithin(...)` resolve to `public` schema.
**How to avoid:** Always prefix PostGIS functions with `extensions.`: `extensions.st_dwithin(...)`, `extensions.st_point(...)`, `extensions.st_distance(...)`. Use `SET search_path = ''` in RPC functions. Use the `OPERATOR(extensions.<->)` syntax for operators.
**Warning signs:** "function does not exist" errors in Supabase logs.

### Pitfall 2: PostGIS Longitude/Latitude Order
**What goes wrong:** Distance calculations return wildly incorrect results; points appear in the wrong hemisphere.
**Why it happens:** PostGIS `ST_MakePoint` and `ST_Point` take `(longitude, latitude)` -- X then Y. The browser Geolocation API returns `(latitude, longitude)`. Developers swap them.
**How to avoid:** Name RPC parameters explicitly: `user_lat`, `user_lng`. In SQL: `st_point(user_lng, user_lat)`. Add a comment in the migration.
**Warning signs:** Distances of thousands of km for nearby locations.

### Pitfall 3: Next.js 15 Async searchParams
**What goes wrong:** Build errors or runtime crashes when accessing `searchParams.query` directly.
**Why it happens:** In Next.js 15, `searchParams` is a `Promise<{ [key: string]: string | string[] | undefined }>`. Must be awaited.
**How to avoid:** Always `const params = await searchParams;` at the top of async server components. For client components, use `use(searchParams)` from React.
**Warning signs:** TypeScript errors about `Property does not exist on type Promise`.

### Pitfall 4: Remote Images Without Configuration
**What goes wrong:** `next/image` throws "hostname not configured" error for remote sagra images.
**Why it happens:** Next.js requires explicit `remotePatterns` in `next.config.ts` for security.
**How to avoid:** Configure `remotePatterns` for known image domains (eventiesagre, solosagre, etc.) AND add a fallback pattern for unknown CDNs. Use a placeholder image for sagre without images.
**Warning signs:** Image errors in console, broken image display.

### Pitfall 5: Geolocation Permission UX
**What goes wrong:** App requests geolocation immediately on page load, user denies, no way to re-request.
**Why it happens:** Calling `getCurrentPosition` in `useEffect` on mount is aggressive and confusing.
**How to avoid:** Make geolocation opt-in via a button ("Usa la mia posizione"). Store permission state. Show distance features only after explicit user action. Handle denied/unavailable states gracefully.
**Warning signs:** Permission popup appearing before user understands why, permanently denied state.

### Pitfall 6: Empty Data States
**What goes wrong:** Page shows empty white space when no sagre match filters.
**Why it happens:** No empty state component, no handling for `data === null` or `data.length === 0`.
**How to avoid:** Always render an empty state with a message and suggestion (e.g., "Nessuna sagra trovata. Prova a cambiare i filtri."). Handle both `null` (error) and `[]` (no results).
**Warning signs:** Blank page with just filter controls visible.

### Pitfall 7: Weekend Date Logic Edge Cases
**What goes wrong:** "Questo weekend" section shows wrong sagre or misses multi-day events.
**Why it happens:** A sagra running "March 1-8" should appear in "weekend" even if start_date is in the past. Simple `start_date >= today` misses it.
**How to avoid:** Query with `end_date >= today AND start_date <= threeDaysOut` to capture overlapping ranges. Events where `end_date IS NULL` should be treated as single-day (`end_date = start_date`).
**Warning signs:** Multi-day sagre disappearing from weekend view mid-event.

## Code Examples

### SagraCard Component
```typescript
// src/components/sagra/SagraCard.tsx
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar } from "lucide-react";
import type { Sagra } from "@/types/database";

interface SagraCardProps {
  sagra: Pick<Sagra, "id" | "slug" | "title" | "location_text" | "province" | "start_date" | "end_date" | "enhanced_description" | "food_tags" | "image_url" | "is_free" | "price_info">;
  distanceKm?: number;
}

export function SagraCard({ sagra, distanceKm }: SagraCardProps) {
  const foodTags = (sagra.food_tags ?? []).slice(0, 3);

  return (
    <Link href={`/sagra/${sagra.slug}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        {/* Image */}
        <div className="relative h-40 w-full bg-muted">
          {sagra.image_url ? (
            <Image
              src={sagra.image_url}
              alt={sagra.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {/* Placeholder icon or gradient */}
            </div>
          )}
          {sagra.is_free && (
            <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
              Gratis
            </Badge>
          )}
        </div>

        <CardContent className="p-4 space-y-2">
          {/* Title */}
          <h3 className="font-semibold text-base line-clamp-1">{sagra.title}</h3>

          {/* Enhanced description */}
          {sagra.enhanced_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {sagra.enhanced_description}
            </p>
          )}

          {/* Location + distance */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="line-clamp-1">
              {sagra.location_text}
              {sagra.province && ` (${sagra.province})`}
            </span>
            {distanceKm !== undefined && (
              <span className="ml-auto shrink-0 font-medium text-foreground">
                {distanceKm} km
              </span>
            )}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDateRange(sagra.start_date, sagra.end_date)}</span>
          </div>

          {/* Food tags + price */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {foodTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {sagra.price_info && !sagra.is_free && (
              <span className="ml-auto text-xs text-muted-foreground">
                {sagra.price_info}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

### Emoji Quick Filter Chips
```typescript
// src/components/home/QuickFilters.tsx
"use client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const QUICK_FILTERS = [
  { label: "Pesce", emoji: "🐟", param: "cucina", value: "Pesce" },
  { label: "Carne", emoji: "🥩", param: "cucina", value: "Carne" },
  { label: "Formaggi", emoji: "🧀", param: "cucina", value: "Formaggi" },
  { label: "Vino", emoji: "🍷", param: "cucina", value: "Vino" },
  { label: "Radicchio", emoji: "🥬", param: "cucina", value: "Radicchio" },
  { label: "Funghi", emoji: "🍄", param: "cucina", value: "Funghi" },
  { label: "Gratis", emoji: "🆓", param: "gratis", value: "true" },
  { label: "Oggi", emoji: "📅", param: "da", value: "today" },
] as const;

export function QuickFilters() {
  const router = useRouter();

  function handleClick(param: string, value: string) {
    const searchParams = new URLSearchParams();
    searchParams.set(param, value === "today" ? new Date().toISOString().split("T")[0] : value);
    router.push(`/cerca?${searchParams.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {QUICK_FILTERS.map(({ label, emoji, param, value }) => (
        <button
          key={label}
          onClick={() => handleClick(param, value)}
          className="shrink-0"
        >
          <Badge variant="outline" className="text-sm px-3 py-1.5 cursor-pointer hover:bg-secondary">
            {emoji} {label}
          </Badge>
        </button>
      ))}
    </div>
  );
}
```

### next.config.ts Remote Image Configuration
```typescript
// next.config.ts -- MUST be updated for remote sagra images
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.eventiesagre.it",
      },
      {
        protocol: "https",
        hostname: "**.solosagre.it",
      },
      {
        protocol: "https",
        hostname: "**.sagritaly.com",
      },
      {
        protocol: "https",
        hostname: "**.assosagre.it",
      },
      {
        protocol: "https",
        hostname: "**.venetoinfesta.it",
      },
      // Catch-all for other CDN domains (review in production)
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
```
**Note:** The catch-all `**` pattern is acceptable for MVP since scraped images come from unpredictable CDN domains. Tighten in production.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync searchParams prop | Async Promise searchParams | Next.js 15 RC (2024) | Must await searchParams in server components |
| Manual URL state mgmt | nuqs library | nuqs v2 (2024) | Type-safe, batched URL state with parsers |
| tailwind.config.ts | @theme inline in CSS | Tailwind v4 (2025) | CSS-first config, already set up in globals.css |
| @supabase/auth-helpers-nextjs | @supabase/ssr | 2024 | Already using correct package |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr` (already done in Phase 1)
- Synchronous `searchParams` access in Next.js 15: Works but deprecated, will break in Next.js 16+
- `tailwindcss-animate`: Replaced by `tw-animate-css` (already done in Phase 1)

## Domain Knowledge: Veneto Provinces and Data Constants

### Veneto Provinces (7 total)
```typescript
// src/lib/constants/veneto.ts
export const VENETO_PROVINCES = [
  { name: "Belluno", code: "BL" },
  { name: "Padova", code: "PD" },
  { name: "Rovigo", code: "RO" },
  { name: "Treviso", code: "TV" },
  { name: "Venezia", code: "VE" },
  { name: "Verona", code: "VR" },
  { name: "Vicenza", code: "VI" },
] as const;
```

### Food Tags (from existing LLM enrichment)
Already defined in `src/lib/enrichment/llm.ts` as `FOOD_TAGS`: Pesce, Carne, Vino, Formaggi, Funghi, Radicchio, Dolci, Prodotti Tipici.

### Quick Filter Chips (from DISC-03)
Pesce, Carne, Formaggi, Vino, Radicchio, Funghi, Gratis, Oggi -- these are a subset of food_tags plus two special filters.

## Open Questions

1. **Image fallback strategy**
   - What we know: Some sagre have `image_url`, many don't. Image URLs come from scraped sources and may break.
   - What's unclear: How many production sagre actually have working image URLs.
   - Recommendation: Use a branded placeholder SVG/gradient for sagre without images. Wrap `next/image` in error boundary with `onError` fallback. Test with real production data.

2. **Province data quality**
   - What we know: Province field is populated by geocoding but may be NULL for some events. Some events may have non-Veneto provinces (data quality issue noted in STATE.md).
   - What's unclear: What percentage of production sagre have correct province values.
   - Recommendation: Filter "Per provincia" to only the 7 Veneto provinces. Handle NULL province gracefully (show "Provincia non disponibile").

3. **Distance sorting without RPC filter chaining**
   - What we know: `find_nearby_sagre` RPC handles distance sorting and radius filtering. But combining it with food_tag/province/date filters is not trivial in a single RPC.
   - What's unclear: Whether to add filter params to the RPC or filter results in-memory after RPC call.
   - Recommendation: Start with in-memory filtering on RPC results (max 50 results is small enough). If needed later, add optional filter params to the RPC function.

## Sources

### Primary (HIGH confidence)
- [Next.js 15 page.tsx API reference](https://nextjs.org/docs/app/api-reference/file-conventions/page) -- async searchParams type signature, verified 2026-02-27
- [Supabase PostGIS docs](https://supabase.com/docs/guides/database/extensions/postgis) -- find_nearby RPC pattern, ST_DWithin, <-> operator
- [nuqs GitHub](https://github.com/47ng/nuqs) -- v2 API, NuqsAdapter, parsers, useQueryStates

### Secondary (MEDIUM confidence)
- [Supabase Discussion #5390](https://github.com/orgs/supabase/discussions/5390) -- geo queries and distance sorting community patterns
- [Next.js searchParams guide](https://www.robinwieruch.de/next-search-params/) -- URL state management patterns
- [Supabase filter chaining docs](https://supabase.com/docs/reference/javascript/filter) -- .gte, .lte, .contains, .in, .or API

### Project-Internal (HIGH confidence)
- `src/types/database.ts` -- Sagra type definition with all fields
- `src/lib/enrichment/llm.ts` -- FOOD_TAGS, FEATURE_TAGS constants
- `supabase/migrations/001_foundation.sql` -- sagre table schema, PostGIS geography column, GIST index
- `supabase/migrations/002_scraping_pipeline.sql` -- is_active, normalized_title, province columns
- `.planning/research/ARCHITECTURE.md` -- find_nearby_sagre RPC pattern (lines 263-305)
- `.planning/phases/01-foundation-design-system/01-RESEARCH.md` -- PostGIS extensions schema prefix pitfall

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries are decided and verified. nuqs is the only new addition, well-established.
- Architecture: HIGH -- Patterns follow official Next.js 15 + Supabase documentation. PostGIS RPC pattern verified from multiple sources.
- Pitfalls: HIGH -- PostGIS schema prefix, lng/lat order, and async searchParams are well-documented issues found in Phase 1 research and official docs.
- Data quality: MEDIUM -- Unknown percentage of sagre have images, correct provinces, or geocoded locations in production.

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable stack, no expected breaking changes)
