# Architecture Research: v1.4 Esperienza Completa

**Domain:** Feature integration into existing sagre aggregator (Next.js 15 + Supabase)
**Researched:** 2026-03-10
**Confidence:** HIGH

## Existing Architecture Snapshot

```
                    PRESENTATION LAYER (Next.js App Router)
 +-----------------------------------------------------------------+
 |  Server Components           |  Client Components               |
 |  +-----------------------+   |  +---------------------------+   |
 |  | page.tsx (Home)       |   |  | SearchFilters (nuqs)      |   |
 |  | page.tsx (Cerca)      |   |  | MapView (Leaflet)         |   |
 |  | page.tsx (Mappa)      |   |  | SagraCard (m.*)           |   |
 |  | page.tsx (Sagra/[slug]|   |  | QuickFilters              |   |
 |  +-----------+-----------+   |  | HeroSection               |   |
 |              |               |  | BottomNav / TopNav         |   |
 |              v               |  +---------------------------+   |
 +-----------------------------------------------------------------+
                    |
                    | Server-side fetch
                    v
           DATA ACCESS LAYER (lib/queries/sagre.ts)
 +-----------------------------------------------------------------+
 |  getWeekendSagre()  |  searchSagre()  |  getMapSagre()          |
 |  getProvinceCounts() | getSagraBySlug()                         |
 +-----------------------------------------------------------------+
                    |
                    | Supabase JS Client (server.ts)
                    v
           DATABASE LAYER (Supabase PostgreSQL + PostGIS)
 +-----------------------------------------------------------------+
 |  sagre table + PostGIS geography  |  RPC: find_nearby_sagre     |
 |  scraper_sources                  |  RPC: find_duplicate_sagra  |
 |  scrape_logs / enrich_logs        |  pg_cron schedules          |
 +-----------------------------------------------------------------+
                    ^
                    |
           PIPELINE LAYER (Edge Functions)
 +-----------------------------------------------------------------+
 |  scrape-sagre: fetch -> extract -> filter -> normalize -> upsert |
 |  enrich-sagre: geocode (Nominatim) -> LLM classify (Gemini)    |
 +-----------------------------------------------------------------+
```

### Key Architectural Constraints for v1.4

| Constraint | Impact on v1.4 |
|-----------|----------------|
| Server Components fetch data; Client Components own interactivity | New Netflix rows need server-fetched data passed as props |
| nuqs manages URL state (shallow: false triggers server re-fetch) | Radius slider and city autocomplete integrate via nuqs |
| Layout has `max-w-7xl px-4 sm:px-6 lg:px-8` container | Full-width requires selective breakout, not container removal |
| Nominatim policy: NO autocomplete allowed (1 req/sec, no auto-suggest) | City autocomplete MUST use Supabase, NOT Nominatim |
| Budget: zero cost (all free tiers) | Unsplash demo = 50 req/hr, must cache aggressively |
| Edge Functions use inline copies of src/ pure functions | Data quality filter changes need dual updates |
| `next.config.ts` allows all remote image hosts (`hostname: "**"`) | Unsplash images work without config changes |

---

## Integration Architecture: Feature by Feature

### 1. Netflix Scroll Rows

**Decision:** New components, minimal homepage page.tsx changes. Pure CSS scroll-snap, no external library.

**Component Architecture:**

```
page.tsx (Server Component)
  |-- fetches data via multiple queries in parallel
  |-- passes row data as props
  v
+---------------------------+
| ScrollRowSection          | (Server Component - wraps each row)
|  props: title, sagre[]    |
|  +---------------------+  |
|  | ScrollRow            | (Client Component - "use client")
|  |  overflow-x-auto     |  |
|  |  snap-x snap-mandatory|  |
|  |  flex gap-3           |  |
|  |  +------+ +------+   |  |
|  |  |Card  | |Card  |...|  |
|  |  +------+ +------+   |  |
|  +---------------------+  |
+---------------------------+
```

**Data Fetching Strategy: Multiple parallel RPCs**

The homepage currently calls `getWeekendSagre()` and `getProvinceCounts()` in `Promise.all`. For Netflix rows, add dedicated query functions:

```typescript
// lib/queries/sagre.ts - NEW functions

// Row 1: "Questo weekend" (reuse getWeekendSagre, increase limit from 8 to 12)
// Row 2: "Vicino a te" (client-driven, deferred, see below)
// Row 3: By food type (top 8 for a popular tag)
// Row 4: By province (top 8 for a province)
// Row 5: "Le piu popolari" (all active, no date filter, ordered by source count)

export async function getSagreByFoodTag(
  tag: string, limit = 8
): Promise<SagraCardData[]>

export async function getSagreByProvince(
  province: string, limit = 8
): Promise<SagraCardData[]>

export async function getPopularSagre(
  limit = 8
): Promise<SagraCardData[]>
```

**Rationale for multiple queries vs single mega-query:** Each row needs different filtering and sorting. A single query would require complex SQL (UNION ALL with different WHERE clauses) and return all data even if the user never scrolls to later rows. Parallel small queries are simpler, cacheable independently via Next.js fetch cache, and map naturally to the row-based UI. With Supabase free tier, 5-6 parallel queries add negligible latency (all hit the same connection pool).

**New Files:**

| File | Type | Purpose |
|------|------|---------|
| `components/home/ScrollRow.tsx` | Client | Horizontal scroll container with snap and scroll indicators |
| `components/home/ScrollRowSection.tsx` | Server | Section wrapper with title, icon, "Vedi tutti" link |
| Modify `app/(main)/page.tsx` | Server | Add parallel queries, render multiple ScrollRowSection |

**Scroll Implementation (Tailwind v4 native, zero dependencies):**

```tsx
// ScrollRow.tsx - "use client"
// Negative margins create edge-to-edge scroll while maintaining container alignment
<div className="flex gap-3 overflow-x-auto snap-x snap-mandatory
                scrollbar-hide pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
  {sagre.map((sagra) => (
    <div key={sagra.id} className="snap-start flex-shrink-0 w-[280px] sm:w-[300px]">
      <SagraCard sagra={sagra} />
    </div>
  ))}
</div>
```

No external dependencies needed. CSS `scroll-snap` is natively supported in all target browsers. The `-mx-4 px-4` pattern creates edge-to-edge scrolling while maintaining container alignment -- this exact pattern is already used by `MappaClientPage.tsx` for the full-bleed map.

**"Vicino a te" Row (Geo-aware):**

This row is special because it requires client-side geolocation. The recommended pattern:

1. Render a placeholder/skeleton row server-side
2. On client mount, request geolocation via existing `useGeolocation` hook
3. If permission granted, fetch nearby sagre via a new Next.js Route Handler (`GET /api/nearby?lat=X&lng=Y&raggio=30`)
4. Route Handler calls the existing `find_nearby_sagre` RPC server-side
5. Hydrate the row with results

This keeps the Supabase service role key server-side and allows HTTP-level response caching. If geolocation is denied, hide the row entirely (graceful degradation).

---

### 2. Unsplash API Hero Image

**Decision:** Server-side only. Fetch in server component with Next.js ISR caching. Never call Unsplash from client.

**Architecture:**

```
page.tsx (Server Component)
  |-- calls getHeroImage() with next: { revalidate: 3600 }
  |-- passes image data to HeroSection
  v
HeroSection (receives unsplash image prop)
  +------------------------------------------+
  | Full-bleed background: Unsplash photo    |
  |   <Image src={unsplashUrl} priority />   |
  |   Dark gradient overlay                  |
  |   "SCOPRI LE SAGRE DEL VENETO" (white)   |
  |   [CityAutocomplete search bar]          |
  |   "Photo by {name} on Unsplash" (small)  |
  +------------------------------------------+
```

**Unsplash Integration:**

```typescript
// lib/unsplash.ts - NEW

interface UnsplashImage {
  url: string;          // raw URL with sizing params
  photographer: string;
  photographerUrl: string;
  blurHash: string;     // for placeholder
}

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY!;

export async function getHeroImage(): Promise<UnsplashImage | null> {
  // Rotate queries for variety
  const queries = ["sagra italiana", "italian food festival", "veneto countryside"];
  const idx = Math.floor(Date.now() / 3_600_000) % queries.length; // rotate hourly
  const query = queries[idx];

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5`,
    {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      next: { revalidate: 3600 }, // ISR: 1 hour
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const photo = data.results?.[0];
  if (!photo) return null;

  return {
    url: `${photo.urls.raw}&w=1920&h=600&fit=crop&q=80`,
    photographer: photo.user.name,
    photographerUrl: photo.user.links.html,
    blurHash: photo.blur_hash,
  };
}
```

**Rate Limit Safety:** Demo tier = 50 req/hr. Image file requests (`images.unsplash.com`) do NOT count against the limit -- only JSON API calls to `api.unsplash.com` count. With `next: { revalidate: 3600 }`, the hero image API call happens once per hour across all users (ISR cache). Even with 1000 concurrent users, only 1 Unsplash API call per hour. Well within the 50/hr demo limit.

**Image Fallback Chain for SagraCard:**

```
Priority 1: source image_url (from scraper)
  |-- exists and valid? -> USE IT
  |-- null or broken?
      v
Priority 2: Unsplash fallback (populated at PIPELINE time, not render time)
  |-- stored in DB during enrich-sagre? -> USE IT
  |-- not available?
      v
Priority 3: Branded gradient placeholder (existing CSS pattern)
```

**Critical: Do NOT call Unsplash per-card at render time.** With 50 req/hr and 12+ cards per page, a single homepage load would exhaust the rate limit. Instead, populate missing images during the `enrich-sagre` pipeline run:

- After LLM enrichment, check if `image_url` is null
- If null, search Unsplash for `food_tags[0] + " sagra"` or title keywords
- Store the Unsplash image URL directly in `image_url`
- Store photographer attribution in a new `image_credit` TEXT column
- This runs 2x/day via pg_cron, well within rate limits

**Attribution compliance:** Unsplash API guidelines require photographer attribution. For hero: visible "Photo by [Name] on Unsplash" overlay. For card images from Unsplash: show attribution on detail page.

**New Files:**

| File | Type | Purpose |
|------|------|---------|
| `lib/unsplash.ts` | Server utility | Unsplash API client with ISR caching |
| Modify `HeroSection.tsx` | Server | Accept image prop, render full-bleed photo with attribution |
| Modify `enrich-sagre/index.ts` | Edge Function | Unsplash fallback during enrichment (new pass) |

**Database Change:** Add `image_credit TEXT` column to `sagre` table for Unsplash photographer attribution.

---

### 3. City Autocomplete

**Decision:** Supabase `DISTINCT location_text` query via Route Handler. NOT Nominatim.

**Critical Finding:** Nominatim's usage policy explicitly states: "Auto-complete search is not yet supported by Nominatim and you must not implement such a service on the client side using the API." Violation risks IP ban. The app already has all Veneto city names in the `sagre.location_text` column -- use that.

**Architecture:**

```
CityAutocomplete ("use client")
  |-- user types >= 2 chars
  |-- debounce 300ms (useDebounce hook)
  |-- GET /api/cities?q=<prefix>
  v
Route Handler: GET /api/cities
  |-- Supabase query:
  |     SELECT DISTINCT location_text, province
  |     FROM sagre
  |     WHERE is_active = true
  |     AND location_text ILIKE '<prefix>%'
  |     ORDER BY location_text
  |     LIMIT 8
  |-- returns JSON array: [{ city: "Zugliano", province: "Vicenza" }]
  v
CityAutocomplete renders dropdown
  |-- user selects "Zugliano (VI)"
  |-- SINGLE Nominatim geocode call (allowed by policy)
  |     GET /search?q=Zugliano,+Veneto&countrycodes=it&format=json&limit=1
  |-- extracts lat/lng
  |-- router.push("/cerca?lat=45.72&lng=11.52&raggio=30")
```

**Why Route Handler instead of direct Supabase client call:**
1. Keeps query patterns server-side (no anon key exposure)
2. Allows HTTP response caching (`Cache-Control: public, s-maxage=300`)
3. Consistent with the server-first architecture pattern

**Performance:** ILIKE with a prefix pattern (`'Zug%'`) can use a B-tree index if one exists on `location_text`. With ~700 rows in the sagre table, even a sequential scan is fast enough (<5ms). No index needed at this scale.

**Component:**

```typescript
// components/home/CityAutocomplete.tsx - "use client"

export function CityAutocomplete({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CityResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setSuggestions([]); return; }
    fetch(`/api/cities?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => { setSuggestions(data); setIsOpen(true); });
  }, [debouncedQuery]);

  async function handleSelect(city: string) {
    setIsOpen(false);
    setQuery(city);
    // Single Nominatim geocode (policy-compliant)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Veneto")}&countrycodes=it&format=json&limit=1`,
      { headers: { "User-Agent": "Nemovia/1.4 (+https://nemovia.it)" } }
    );
    const results = await res.json();
    if (results[0]) {
      onSelect(parseFloat(results[0].lat), parseFloat(results[0].lon));
    }
  }
  // ... render input + dropdown
}
```

**Integration with homepage:** The CityAutocomplete lives inside the new HeroSection. On city select, it navigates to `/cerca?lat=X&lng=Y&raggio=30`. The existing CercaPage server component picks up lat/lng from searchParams and calls `searchSagre()` with the PostGIS RPC. No changes to the search page needed.

**New Files:**

| File | Type | Purpose |
|------|------|---------|
| `app/api/cities/route.ts` | Route Handler | Distinct city query with ILIKE prefix |
| `components/home/CityAutocomplete.tsx` | Client | Debounced input with dropdown |
| `hooks/useDebounce.ts` | Hook | Generic debounce hook |

---

### 4. Radius Slider

**Decision:** nuqs `parseAsInteger` with local state + debounced sync. Modify existing SearchFilters UI only.

**Integration with existing architecture:**

The radius (`raggio`) is already a nuqs-managed URL param in `SearchFilters.tsx` with `parseAsInteger.withDefault(30)`. Currently rendered as `<Input type="number">`. Changing to a range slider is a UI-only modification:

```typescript
// In SearchFilters.tsx - replace number input with range slider:

// Local state for immediate slider feedback (no URL update lag)
const [localRaggio, setLocalRaggio] = useState(filters.raggio);

// Sync to URL with debounce to avoid spamming history entries
useEffect(() => {
  const timer = setTimeout(() => {
    if (localRaggio !== filters.raggio) {
      setFilters({ raggio: localRaggio });
    }
  }, 250);
  return () => clearTimeout(timer);
}, [localRaggio, filters.raggio, setFilters]);

// Render:
<div className="space-y-1">
  <label className="text-xs font-medium text-muted-foreground">
    Raggio: {localRaggio} km
  </label>
  <input
    type="range" min={5} max={100} step={5}
    value={localRaggio}
    onChange={(e) => setLocalRaggio(parseInt(e.target.value, 10))}
    className="w-full accent-primary"
  />
</div>
```

**PostGIS impact:** Zero query changes needed. The existing `find_nearby_sagre` RPC already accepts `radius_meters` as a parameter. The conversion `raggio * 1000` (km to meters) already happens in `searchSagre()`. The slider just controls the same URL param that the number input controlled.

**Homepage integration:** The slider also appears in the HeroSection alongside the CityAutocomplete. When the user selects a city and adjusts the radius, the redirect URL includes both: `/cerca?lat=X&lng=Y&raggio=20`.

**New Files:** None. Only modifications to `SearchFilters.tsx` (replace number input with range) and `HeroSection.tsx` (add slider alongside search).

---

### 5. Full-Width Layout

**Decision:** Keep `max-w-7xl` container in layout. Use negative margin breakout for hero and scroll rows.

**Current layout (`(main)/layout.tsx`):**
```tsx
<main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
  {children}
</main>
```

**Problem:** `max-w-7xl` (1280px) constrains the hero and scroll rows. Netflix rows should scroll edge-to-edge. Hero should be full-bleed.

**Approach: Selective breakout, not container removal.**

Do NOT remove `max-w-7xl` from the layout. It correctly constrains search results, detail pages, and text content (which becomes unreadable at full width on large screens). Instead, use the negative margin pattern already established in the codebase:

```tsx
// MappaClientPage.tsx (existing, line 26):
className="-mx-4 -mt-4 sm:-mx-6 lg:-mx-8"
// This already breaks out of the container for full-bleed map
```

Apply the same pattern to hero and scroll rows:

```tsx
// In page.tsx:
<div className="-mx-4 sm:-mx-6 lg:-mx-8">
  <HeroSection image={heroImage} />
</div>

{/* Scroll rows use internal negative margins */}
<ScrollRowSection title="Questo weekend" sagre={weekendSagre} />
```

**What changes for full-width:**

| Section | Current | v1.4 |
|---------|---------|------|
| Hero | Rounded card, mesh gradient, within container | Full-bleed photo, negative margins, no border-radius |
| Netflix rows | N/A | Scroll rows with edge-to-edge overflow via negative margins |
| Search results | Container-constrained | No change |
| Detail page | Container-constrained | No change |
| Footer | N/A | Full-bleed, new component after `</main>` |
| TopNav | `max-w-7xl` inner container | May widen to `max-w-screen-2xl` for breathing room |

**Footer Component:**

```tsx
// components/layout/Footer.tsx (Server Component)
export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/30 mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Logo + tagline */}
        {/* Navigation links */}
        {/* "Fatto con cuore in Veneto" */}
        {/* Data source credits */}
      </div>
    </footer>
  );
}
```

Add to `(main)/layout.tsx` after `</main>` and before `<BottomNav />`.

**New Files:**

| File | Type | Purpose |
|------|------|---------|
| `components/layout/Footer.tsx` | Server | Credits, links, tagline |
| Modify `(main)/layout.tsx` | Server | Add Footer, adjust container for full-width sections |

---

### 6. Data Quality Fixes (Edge Function Changes)

**Decision:** Targeted filter additions, province normalization, Veneto bounding box constraint.

**6a. Fix non-sagre still present (Passeggiata, Carnevale)**

Current pipeline relies on LLM `is_sagra` classification during enrichment. Some non-sagre slip through because the LLM occasionally misclassifies events with food-adjacent keywords.

**Fix:** Add heuristic pre-filter in `scrape-sagre` BEFORE upsert:

```typescript
// New filter: isNonSagraTitle()
function isNonSagraTitle(title: string): boolean {
  const t = title.toLowerCase();
  const nonSagraPatterns = [
    /\bpasseggiata\b/i, /\bcarnevale\b/i, /\bconcerto\b/i,
    /\bmostra\b/i, /\bmercatino\s+d(i|ell[ao'])\s+antiquariato\b/i,
    /\bcorsa\b/i, /\bmaratona\b/i, /\bgara\s+ciclistic/i,
    /\bprocessione\b/i, /\bpellegrinaggio\b/i,
  ];
  return nonSagraPatterns.some(p => p.test(t));
}
```

**Dual update requirement:** Add to both `src/lib/scraper/filters.ts` (canonical + tests) and `supabase/functions/scrape-sagre/index.ts` (inline copy). This is the established pattern for the Deno import constraint (documented tech debt since v1.0).

**6b. Fix events outside Veneto (San Miniato, Toscana)**

Current Veneto gating checks the Nominatim-returned province against a whitelist. But some city names are ambiguous across regions.

**Fix:** Add Veneto bounding box constraint to Nominatim geocode query:

```typescript
// In enrich-sagre geocode pass:
const params = new URLSearchParams({
  q: city,
  countrycodes: "it",
  format: "json",
  limit: "1",
  addressdetails: "1",
  // NEW: Veneto bounding box constraint
  viewbox: "10.6,44.8,13.2,46.7",  // lon_min,lat_min,lon_max,lat_max
  bounded: "1",                      // restrict results to viewbox
});
```

With `bounded=1`, Nominatim will only return results within the Veneto bounding box. Events genuinely outside Veneto (like San Miniato in Tuscany) will return no geocode results and be marked `geocode_failed` + `is_active = false`. This is more reliable than the post-geocode province name check.

**6c. Province always in parentheses with code, not name**

Current SagraCard renders `{sagra.province && \`(\${sagra.province})\`}` but `province` stores the full name from Nominatim ("Padova"), not the 2-letter code ("PD"). The requirement specifies "Zugliano (VI)" format.

**Two approaches:**

- **Option A (render-time mapping):** Map province name to code using existing `VENETO_PROVINCES` constant:
  ```typescript
  const code = VENETO_PROVINCES.find(p => p.name === sagra.province)?.code;
  ```
  Simple, no DB changes, but runs on every render.

- **Option B (pipeline-time, recommended):** Normalize province to code during geocoding in `enrich-sagre`:
  ```typescript
  const code = VENETO_PROVINCES_MAP[province.toLowerCase()] ?? province;
  // Store "VI" instead of "Vicenza" in the province column
  ```
  Fixes data at source, every consumer benefits, but requires migration of existing data.

Recommend Option B (pipeline-time) with a one-time SQL migration:
```sql
UPDATE sagre SET province = 'BL' WHERE province ILIKE '%belluno%';
UPDATE sagre SET province = 'PD' WHERE province ILIKE '%padova%';
-- ... etc for all 7 provinces
```

Then update all UI code that reads `province` to handle the 2-letter code format. The `VENETO_PROVINCES` constant already has both `name` and `code`.

**6d. Event count investigation (26 vs 735)**

This is a data/operational issue, not an architecture change. The scraper architecture already supports diagnosis:
1. Check `scrape_logs` table for error patterns per source
2. Verify source website URLs haven't changed HTML structure
3. Check `scraper_sources.consecutive_failures` for disabled sources
4. Add new scraper sources as DB rows (config-driven architecture handles this)

No architecture change needed.

**Modified Files for Data Quality:**

| File | Change |
|------|--------|
| `scrape-sagre/index.ts` | Add `isNonSagraTitle()` filter |
| `enrich-sagre/index.ts` | Add `viewbox` + `bounded` to Nominatim params; store province code |
| `src/lib/scraper/filters.ts` | Add `isNonSagraTitle()` (canonical copy) |
| `src/components/sagra/SagraCard.tsx` | Update province display for 2-letter code |
| `src/components/home/FeaturedSagraCard.tsx` | Update province display for 2-letter code |
| SQL migration | Convert existing province names to codes |

---

## Complete New Component Map

```
src/
  app/
    (main)/
      page.tsx                     [MODIFY] Multiple scroll rows, new hero, parallel queries
      layout.tsx                   [MODIFY] Add Footer, adjust for full-width breakout
    api/
      cities/
        route.ts                   [NEW]    City autocomplete (DISTINCT ILIKE query)
      nearby/
        route.ts                   [NEW]    Geo-aware nearby sagre (find_nearby_sagre RPC)
  components/
    home/
      HeroSection.tsx              [MODIFY] Full-bleed Unsplash photo + search bar + attribution
      CityAutocomplete.tsx         [NEW]    Debounced city search with dropdown suggestions
      ScrollRow.tsx                [NEW]    Horizontal snap-scroll container (client component)
      ScrollRowSection.tsx         [NEW]    Section wrapper: title + icon + row + "Vedi tutti" link
      WeekendSection.tsx           [REMOVE] Replaced by ScrollRowSection
      QuickFilters.tsx             [KEEP]   Unchanged
      ProvinceSection.tsx          [KEEP]   Unchanged (or converted to scroll row)
      FeaturedSagraCard.tsx        [MODIFY] Province code display
    layout/
      TopNav.tsx                   [MODIFY] SVG logo instead of "Nemovia" text
      Footer.tsx                   [NEW]    Credits, links, tagline
      BottomNav.tsx                [KEEP]   Unchanged
    search/
      SearchFilters.tsx            [MODIFY] Range slider for raggio, integrate city param
    sagra/
      SagraCard.tsx                [MODIFY] Province code "(VI)" format
  lib/
    unsplash.ts                    [NEW]    Unsplash API client with ISR caching
    queries/
      sagre.ts                     [MODIFY] Add getSagreByFoodTag, getSagreByProvince, getPopularSagre
      types.ts                     [MODIFY] Add CityResult type
    scraper/
      filters.ts                   [MODIFY] Add isNonSagraTitle (canonical)
  hooks/
    useDebounce.ts                 [NEW]    Generic debounce hook (300ms default)
supabase/
  functions/
    scrape-sagre/index.ts          [MODIFY] Add isNonSagraTitle inline filter
    enrich-sagre/index.ts          [MODIFY] Veneto bbox, province code, Unsplash fallback pass
```

---

## Data Flow Changes

### Current Homepage Data Flow

```
page.tsx (server)
  |-- Promise.all([getWeekendSagre(), getProvinceCounts()])
  |-- render: HeroSection + QuickFilters + BentoGrid + ProvinceSection
```

### v1.4 Homepage Data Flow

```
page.tsx (server)
  |-- Promise.all([
  |     getHeroImage(),              // Unsplash hero photo (ISR cached 1hr)
  |     getWeekendSagre(),           // Row: "Questo weekend" (12 items)
  |     getPopularSagre(),           // Row: "Le piu popolari"
  |     getSagreByFoodTag("Pesce"),  // Row: "Sagre di pesce"
  |     getSagreByFoodTag("Carne"),  // Row: "Sagre di carne"
  |     getProvinceCounts(),         // Province section
  |   ])
  |-- render: Hero(full-bleed) + CitySearch + ScrollRows + QuickFilters + ProvinceSection
  |
  |   [Client-side, after mount:]
  |   ScrollRow("Vicino a te")
  |     |-- useGeolocation() -> if granted
  |     |-- GET /api/nearby?lat=X&lng=Y&raggio=30
  |     |-- hydrate row with results
  |     |-- if denied: hide row (graceful degradation)
```

### City Search Flow

```
User types "Zug" in CityAutocomplete (in HeroSection)
  |-- debounce 300ms
  |-- GET /api/cities?q=Zug
  |     |-- Supabase: SELECT DISTINCT location_text, province
  |     |     FROM sagre WHERE location_text ILIKE 'Zug%' AND is_active = true
  |     |-- returns [{ city: "Zugliano", province: "VI" }]
  |-- User selects "Zugliano (VI)"
  |-- Single Nominatim geocode (policy-compliant single request)
  |     GET /search?q=Zugliano,+Veneto&countrycodes=it&format=json&limit=1
  |     -> { lat: 45.72, lon: 11.52 }
  |-- router.push("/cerca?lat=45.72&lng=11.52&raggio=30")
  |-- CercaPage server component reads searchParams
  |-- searchSagre({ lat: 45.72, lng: 11.52, raggio: 30 })
  |     -> calls find_nearby_sagre RPC with radius_meters=30000
  |-- results rendered in SearchResults
```

### Image Fallback Flow (Pipeline-level, in enrich-sagre)

```
enrich-sagre runs (2x/day via pg_cron)
  |-- After LLM enrichment pass:
  |-- For each sagra with status = "enriched" and image_url IS NULL:
  |     |-- Search Unsplash: food_tags[0] + " sagra italiana"
  |     |     (demo tier: 50 req/hr, batch of ~20 null images per run is safe)
  |     |-- Result found?
  |     |     YES -> UPDATE image_url = unsplash_url, image_credit = photographer
  |     |     NO  -> Leave null (branded placeholder at render time)
  |-- Rate limit: 1 second between Unsplash API calls (courtesy)
```

---

## Suggested Build Order

Build order driven by dependencies and testing ability:

```
Phase 1: Layout + Branding Foundation
  1. Full-width layout changes (layout.tsx negative margin breakout pattern)
  2. Footer component
  3. SVG logo in TopNav
  WHY FIRST: All other features render within this layout.
  DEPENDENCY: None.

Phase 2: Data Quality
  4. Non-sagra title filter (isNonSagraTitle in both files)
  5. Veneto bounding box in Nominatim geocode
  6. Province code normalization (DB migration + pipeline + UI)
  7. Investigate and fix event count drop
  8. Fix mappa and placeholder bugs
  WHY SECOND: Clean data is prerequisite for good Netflix rows.
  DEPENDENCY: None (parallel with Phase 1 possible).

Phase 3: Netflix Rows + Unsplash Hero
  9. ScrollRow + ScrollRowSection components
  10. New query functions (getSagreByFoodTag, getPopularSagre)
  11. Unsplash lib (lib/unsplash.ts) + hero integration
  12. Homepage rewrite with scroll rows + full-bleed hero
  13. /api/nearby Route Handler + geo-aware row
  WHY THIRD: Core v1.4 feature, needs layout and clean data.
  DEPENDENCY: Phase 1 (layout), Phase 2 (clean data for rows).

Phase 4: City Search + Radius
  14. useDebounce hook
  15. /api/cities Route Handler
  16. CityAutocomplete component
  17. Radius slider in SearchFilters
  18. Hero search bar integration (autocomplete + slider + submit)
  WHY FOURTH: Depends on hero layout from Phase 3.
  DEPENDENCY: Phase 3 (hero component).

Phase 5: Image Quality + Polish
  19. Unsplash fallback pass in enrich-sagre pipeline
  20. Fix placeholder image visibility
  21. Mappa page filter overlay
  22. Cerca page map fix
  WHY LAST: Polish and data pipeline items, independent of UI features.
  DEPENDENCY: Phase 3 (Unsplash lib reused).
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Unsplash API Calls at Render Time Per Card

**What people do:** Call `GET /search/photos` from SagraCard or a server component for each card missing an image.
**Why wrong:** 50 req/hr demo limit exhausted by a single page load with 10+ missing images. Also blocks rendering and adds latency.
**Do this instead:** Populate fallback images at pipeline time in enrich-sagre (runs 2x/day, batch of ~20 calls). Store URLs in database. Cards always read from DB.

### Anti-Pattern 2: Nominatim Autocomplete

**What people do:** Hit Nominatim API on every keystroke for city suggestions.
**Why wrong:** Explicitly forbidden by Nominatim usage policy: "you must not implement such a service on the client side using the API." Will get IP banned.
**Do this instead:** Use Supabase DISTINCT query on existing `location_text` values via Route Handler. Single Nominatim call only on final city selection for geocoding.

### Anti-Pattern 3: Client-Side Supabase Queries for Scroll Rows

**What people do:** Use `supabase.from("sagre").select()` directly in client components.
**Why wrong:** Exposes query patterns, requires anon key permissions for each query type, cannot leverage Next.js ISR cache.
**Do this instead:** Server Components fetch data and pass as props. For client-driven dynamic rows (geo), use Route Handlers that call Supabase server-side.

### Anti-Pattern 4: Removing Container for Full-Width

**What people do:** Remove `max-w-7xl` from layout to make hero full-width, breaking all pages.
**Why wrong:** Search results and detail pages become unreadable on wide screens. Text lines exceed comfortable reading width.
**Do this instead:** Keep container, use negative margin breakout pattern (`-mx-4 sm:-mx-6 lg:-mx-8`) already established in `MappaClientPage.tsx`.

### Anti-Pattern 5: External Scroll Library for Netflix Rows

**What people do:** Install `react-horizontal-scrolling-menu` or `swiper` for horizontal scroll.
**Why wrong:** Adds bundle size for what CSS `scroll-snap` handles natively. These libraries add touch handling and arrows that conflict with mobile-first design.
**Do this instead:** Pure CSS with `overflow-x-auto snap-x snap-mandatory` + `flex-shrink-0` on children. Native momentum scroll on touch devices. Optional JS-only scroll indicator dots.

---

## External Service Integration

| Service | Integration Pattern | Rate Limit | Caching Strategy |
|---------|---------------------|------------|------------------|
| Unsplash API | Server-side fetch in `lib/unsplash.ts` | 50 req/hr demo (image serves unlimited) | `next: { revalidate: 3600 }` for hero; DB storage for card fallbacks |
| Nominatim | Single geocode on city select (NOT autocomplete) | 1 req/sec strict | Not needed (one-off user action) |
| Supabase | Existing server client, new Route Handlers | Free tier (500MB DB, 50K rows) | Next.js fetch cache on server queries |

## Environment Variables

| Variable | New? | Purpose |
|----------|------|---------|
| `UNSPLASH_ACCESS_KEY` | YES | Unsplash API authentication (server-only, never in NEXT_PUBLIC_) |
| All existing vars | NO | No changes to existing env setup |

## Database Changes

| Change | Type | Purpose |
|--------|------|---------|
| Add `image_credit TEXT` column | Migration | Store Unsplash photographer attribution |
| Migrate `province` values to 2-letter codes | Data migration | "Padova" -> "PD" for display format |
| No schema changes for Netflix rows | - | Queries use existing columns with different filters |

---

## Sources

- [Unsplash API Documentation](https://unsplash.com/documentation) -- rate limits, search endpoint, attribution requirements
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) -- autocomplete prohibition, rate limits
- [nuqs Options](https://nuqs.dev/docs/options) -- debounce for slider inputs, throttle for URL updates
- [Tailwind CSS scroll-snap-type](https://tailwindcss.com/docs/scroll-snap-type) -- snap-x, snap-mandatory for Netflix rows
- [Tailwind CSS scroll-snap-align](https://tailwindcss.com/docs/scroll-snap-align) -- snap-start for card alignment
- [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html) -- radius query (already in use via RPC)
- [Supabase PostGIS Docs](https://supabase.com/docs/guides/database/extensions/postgis) -- RPC patterns, viewbox params
- [Next.js ISR Caching](https://nextjs.org/docs/app/guides/caching) -- `next: { revalidate }` for Unsplash

---
*Architecture research for: Nemovia v1.4 Esperienza Completa*
*Researched: 2026-03-10*
