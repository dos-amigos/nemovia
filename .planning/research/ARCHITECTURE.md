# Architecture Patterns

**Domain:** Event aggregator with web scraping, LLM enrichment, and geo-search
**Project:** Nemovia -- Italian food festival (sagre) aggregator for Veneto
**Researched:** 2026-03-04

## Recommended Architecture

Nemovia follows a **pipeline-and-serve** architecture: data flows through a multi-stage ingestion pipeline (scrape, geocode, enrich) into a PostGIS-enabled database, then gets served to a mobile-first Next.js frontend via server components and RPC functions.

The system has three distinct runtime contexts:
1. **Scheduled Pipeline** -- Background jobs that scrape, geocode, and enrich data
2. **Server Rendering** -- Next.js server components fetching from Supabase for SSR pages
3. **Client Interactivity** -- Browser-side map rendering, geolocation, and filtering

```
[Cron Trigger] --> [Scrape Handler] --> [Raw Events Table]
                                              |
                                     [Geocode Handler] --> [Geocoded Events]
                                                                  |
                                                          [Enrich Handler] --> [Enriched Events]
                                                                                      |
                                                                    [Next.js Server Components]
                                                                              |
                                                                    [Client: Map + Filters]
```

### Component Boundaries

| Component | Responsibility | Communicates With | Runtime |
|-----------|---------------|-------------------|---------|
| **Scraper Engine** | Fetch HTML from source sites, parse with Cheerio, extract raw event data, deduplicate | Source websites (HTTP), Supabase (write) | Vercel Function (cron) or Supabase Edge Function |
| **Scraper Config Store** | Hold CSS selectors, URLs, and parsing rules per source site | Scraper Engine (read) | Supabase table (`scraper_configs`) |
| **Geocoder** | Convert city/address strings to lat/lng coordinates via Nominatim | Nominatim API (HTTP), Supabase (read/write) | Vercel Function (cron) or Supabase Edge Function |
| **LLM Enricher** | Classify events by cuisine type, generate engaging descriptions | Gemini 2.5 Flash API, Supabase (read/write) | Vercel Function (cron) or Supabase Edge Function |
| **PostGIS Database** | Store events with geography points, support spatial queries, manage scraper configs | All backend components | Supabase PostgreSQL |
| **Geo-Query RPC** | Expose `find_nearby_sagre` and distance-sorted queries as Postgres functions | Next.js server components (via Supabase client) | Supabase RPC |
| **Next.js Server Components** | Fetch and render event listings, detail pages, SEO metadata | Supabase (read), Client components (props) | Vercel SSR |
| **Next.js Route Handlers** | API endpoints for client-side filtering, search, and geo-queries | Supabase (read), Client components (fetch) | Vercel Functions |
| **Map Component** | Render Leaflet map with marker clusters, popups, geolocation | Client-side only, receives data via props/API | Browser (dynamic import, no SSR) |
| **Filter/Search UI** | Province, radius, date, cuisine type, free/paid filters | Route Handlers or Server Actions | Browser + Server |

### Data Flow

#### Ingestion Pipeline (Background)

```
1. SCRAPE (daily cron)
   For each source in scraper_configs:
     - Fetch HTML page(s) via fetch()
     - Parse with Cheerio using configured CSS selectors
     - Extract: title, dates, location_text, description, price, image_url
     - Generate content_hash = hash(title + dates + location_text)
     - UPSERT into raw_events (deduplicate by content_hash + source_id)
     - Mark new/changed events with status = 'pending_geocode'

2. GEOCODE (runs after scrape, or separate cron)
   SELECT events WHERE status = 'pending_geocode'
   For each event (rate-limited 1 req/sec):
     - Call Nominatim: location_text + ", Veneto, Italia"
     - Parse lat/lng from response
     - UPDATE event SET location = ST_MakePoint(lng, lat)::geography
     - SET status = 'pending_enrichment'
     - Cache geocode results (same city = same coordinates)

3. ENRICH (runs after geocode, or separate cron)
   SELECT events WHERE status = 'pending_enrichment'
   For each event (rate-limited ~10 req/min for free tier):
     - Send title + description + location to Gemini 2.5 Flash
     - Parse response: cuisine_tags[], enhanced_description (max 250 char)
     - UPDATE event SET tags, enhanced_description
     - SET status = 'active'

4. EXPIRE (daily)
   UPDATE events SET status = 'expired' WHERE end_date < NOW()
```

#### Serving Pipeline (Request-time)

```
1. Homepage (Server Component)
   - Fetch "this weekend" events via date filter
   - Fetch "popular" events (by province or trending)
   - Render SagraCards server-side for SEO

2. Search Page (Server + Client)
   - Server: Initial load with default filters (SSR)
   - Client: Filter changes trigger API call to Route Handler
   - Route Handler calls Supabase with PostGIS queries
   - Returns filtered events + distances

3. Map Page (Client-only rendering)
   - Dynamic import Leaflet (ssr: false)
   - Fetch events via API (with bounding box or radius)
   - Render MarkerCluster groups
   - Popup shows SagraCard preview

4. Detail Page (Server Component)
   - Fetch single event by slug
   - Render full details, mini-map, share links
   - Generate dynamic OG metadata for social sharing
```

## Critical Architecture Decision: Scheduling Strategy

**Confidence: HIGH** (verified against official Vercel and Supabase docs)

### The Vercel Hobby Plan Cron Limitation

This is the single most important architectural constraint. The PROJECT.md specifies "Cron jobs: scraping 2x/giorno, enrichment 2x/giorno, expire eventi passati" -- but **Vercel Hobby plan cron jobs can only run once per day**, with hourly timing precision (could fire anywhere in a 59-minute window).

Sources: [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)

### Recommended Approach: Single Daily Orchestrator + Supabase pg_cron

Use a **hybrid scheduling strategy**:

1. **Vercel Cron (1x/day)**: A single "orchestrator" endpoint that kicks off the full pipeline: scrape all sources, then geocode new events, then enrich new events. With Fluid Compute, Hobby functions get up to 300s (5 minutes) per invocation.

2. **Supabase pg_cron (sub-minute intervals)**: For the expire job and any lightweight database maintenance. pg_cron runs SQL directly in the database with zero network latency, supports sub-minute intervals, and is included in the free tier.

3. **Chain pattern within the orchestrator**: The single Vercel cron endpoint calls scrape, waits, calls geocode, waits, calls enrich -- all within one 5-minute function execution. If 5 minutes is insufficient for all sources, split into multiple sequential calls using Supabase pg_cron + pg_net to invoke Supabase Edge Functions.

**Alternative if more frequency is needed**: Use Supabase pg_cron + pg_net extension to call Supabase Edge Functions on a schedule. This bypasses Vercel cron limits entirely. Edge Functions have a 150s timeout on free tier but no frequency restrictions when triggered by pg_cron.

### Function Timeout Budget (5 minutes = 300s)

| Step | Estimated Time | Notes |
|------|---------------|-------|
| Scrape 5 sources | ~60-90s | Sequential fetch + parse, ~12-18s per source |
| Geocode new events | ~30-60s | ~30-60 new events/day at 1 req/sec |
| Enrich new events | ~90-180s | ~30-60 events at 10 RPM = 3-6 minutes |

**Problem**: Enrichment alone can exceed the 5-minute budget if there are many new events. **Solution**: Split into two daily Vercel cron jobs (allowed: up to 100 per project, each once/day):
- **Morning cron** (e.g., 06:00 UTC): Scrape + Geocode
- **Afternoon cron** (e.g., 14:00 UTC): Enrich pending events + Expire old events

This fits within Hobby plan limits (2 cron jobs, each once/day, each up to 300s).

## Patterns to Follow

### Pattern 1: Config-Driven Generic Scraper

**What:** Store CSS selectors and URL patterns in a database table, not in code. One scraper function reads the config and applies it.

**When:** Always -- this is core to the project's extensibility.

**Why:** Adding a new source site means inserting a row, not deploying code. Different sites have different HTML structures but the same data model (title, dates, location, description).

```typescript
// Database table: scraper_configs
interface ScraperConfig {
  id: string;
  source_name: string;          // "SagreItaliane"
  base_url: string;             // "https://www.sagreitaliane.it/veneto"
  list_selector: string;        // ".event-card"
  title_selector: string;       // ".event-card h3"
  date_selector: string;        // ".event-card .dates"
  location_selector: string;    // ".event-card .location"
  description_selector: string; // ".event-card .desc"
  image_selector: string;       // ".event-card img@src"
  pagination_selector: string;  // ".next-page@href"
  date_format: string;          // "DD/MM/YYYY"
  is_active: boolean;
  last_scraped_at: string;
}

// Generic scraper function
async function scrapeSource(config: ScraperConfig): Promise<RawEvent[]> {
  const html = await fetch(config.base_url).then(r => r.text());
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];

  $(config.list_selector).each((_, el) => {
    events.push({
      title: $(el).find(config.title_selector).text().trim(),
      dates: $(el).find(config.date_selector).text().trim(),
      location_text: $(el).find(config.location_selector).text().trim(),
      description: $(el).find(config.description_selector).text().trim(),
      image_url: $(el).find(config.image_selector).attr('src'),
      source_id: config.id,
      content_hash: generateHash(/* title + dates + location */),
    });
  });
  return events;
}
```

### Pattern 2: Status-Based Pipeline Processing

**What:** Each event has a `status` field that tracks its position in the pipeline. Each processing stage queries for events in its input status and advances them.

**When:** Always -- this decouples pipeline stages and enables retry.

**Why:** If geocoding fails halfway, you restart and it picks up where it left off. If enrichment hits rate limits, pending events wait for the next run. No complex job queue needed.

```typescript
type EventStatus =
  | 'pending_geocode'    // Just scraped, needs coordinates
  | 'geocode_failed'     // Nominatim couldn't resolve (retry later)
  | 'pending_enrichment' // Has coordinates, needs LLM tags
  | 'enrichment_failed'  // Gemini failed (retry later)
  | 'active'             // Fully processed, visible to users
  | 'expired';           // Past end_date, hidden from listings

// Each pipeline stage:
// 1. SELECT WHERE status = 'my_input_status' LIMIT batch_size
// 2. Process each event
// 3. UPDATE SET status = 'next_status' (or 'failed_status' on error)
```

### Pattern 3: Content-Hash Deduplication

**What:** Generate a hash from the event's core identifying fields (title + normalized dates + normalized location). Use this as a unique constraint for upserts.

**When:** Every scrape run, since the same event appears on multiple source sites and across multiple scrape runs.

**Why:** Events from SagreItaliane and EventieSagre may describe the same festival with slightly different wording. Exact hash catches same-source duplicates; fuzzy matching (deferred to post-MVP) catches cross-source duplicates.

```typescript
function generateContentHash(title: string, dates: string, location: string): string {
  const normalized = [
    title.toLowerCase().trim(),
    dates.replace(/\s+/g, ''),
    location.toLowerCase().trim()
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// UPSERT pattern:
// INSERT INTO events (...) VALUES (...)
// ON CONFLICT (content_hash, source_id) DO UPDATE SET
//   description = EXCLUDED.description,
//   updated_at = NOW()
```

### Pattern 4: Supabase Client Factory for Next.js App Router

**What:** Create separate Supabase client factories for server components, route handlers, and client components using `@supabase/ssr`.

**When:** Every Supabase interaction in the Next.js app.

**Why:** Server components need cookie-aware clients for potential future auth. Client components need browser clients for real-time features. Service role clients are used only in cron/pipeline functions where no user context exists.

```
src/
  lib/
    supabase/
      server.ts       -- createServerClient() for Server Components + Route Handlers
      client.ts        -- createBrowserClient() for Client Components
      service-role.ts  -- createServiceRoleClient() for cron jobs / pipeline
```

### Pattern 5: PostGIS RPC for Geo-Queries

**What:** Define Postgres functions for spatial queries and call them via Supabase RPC from Next.js.

**When:** All proximity-based searches ("nearby", "within X km", distance sorting).

**Why:** PostGIS spatial indexes (GIST) make these queries fast. The `<->` operator uses the spatial index for nearest-neighbor sorting. Wrapping in an RPC function keeps the query logic in the database and provides a clean API.

```sql
CREATE OR REPLACE FUNCTION find_nearby_sagre(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_meters FLOAT DEFAULT 50000,  -- 50km default
  max_results INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  location_text TEXT,
  start_date DATE,
  end_date DATE,
  cuisine_tags TEXT[],
  enhanced_description TEXT,
  image_url TEXT,
  lat FLOAT,
  lng FLOAT,
  distance_meters FLOAT
)
SET search_path = ''
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id, e.title, e.location_text,
    e.start_date, e.end_date,
    e.cuisine_tags, e.enhanced_description, e.image_url,
    extensions.st_y(e.location::extensions.geometry) AS lat,
    extensions.st_x(e.location::extensions.geometry) AS lng,
    extensions.st_distance(
      e.location,
      extensions.st_point(user_lng, user_lat)::extensions.geography
    ) AS distance_meters
  FROM public.events e
  WHERE e.status = 'active'
    AND extensions.st_dwithin(
      e.location,
      extensions.st_point(user_lng, user_lat)::extensions.geography,
      radius_meters
    )
  ORDER BY e.location OPERATOR(extensions.<->)
    extensions.st_point(user_lng, user_lat)::extensions.geography
  LIMIT max_results;
$$;
```

### Pattern 6: Leaflet Dynamic Import with SSR Bypass

**What:** All Leaflet/react-leaflet components must be dynamically imported with `ssr: false` because Leaflet accesses the DOM directly during initialization.

**When:** Every map component in the application.

**Why:** Leaflet crashes during SSR because `window` is undefined on the server. This is a well-known constraint with a standard solution.

```typescript
// src/components/map/index.tsx (wrapper)
"use client";
import dynamic from "next/dynamic";

export const MapView = dynamic(
  () => import("./MapView"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[60vh] bg-stone-100 animate-pulse rounded-lg flex items-center justify-center">
        <p className="text-stone-400">Caricamento mappa...</p>
      </div>
    ),
  }
);

// src/components/map/MapView.tsx (actual implementation)
"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
// ... marker icon fix for Next.js build
```

### Pattern 7: Geocode Cache Layer

**What:** Cache Nominatim geocoding results by normalized location string. Many events from the same city produce the same coordinates.

**When:** During the geocoding pipeline stage.

**Why:** Nominatim has a strict 1 request/second rate limit. If 20 events are in "Padova", you should only geocode "Padova" once. A simple database lookup table dramatically reduces API calls.

```sql
CREATE TABLE geocode_cache (
  location_key TEXT PRIMARY KEY,  -- normalized: "padova, veneto, italia"
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
async function geocodeLocation(locationText: string): Promise<{lat: number, lng: number} | null> {
  const key = normalizeLocation(locationText); // lowercase, trim, append ", Veneto, Italia"

  // Check cache first
  const cached = await supabase.from('geocode_cache').select().eq('location_key', key).single();
  if (cached.data) return { lat: cached.data.lat, lng: cached.data.lng };

  // Rate-limited API call
  await rateLimiter.wait(); // Ensure 1 req/sec
  const result = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(key)}&format=json&limit=1`);
  // ... parse and cache result
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: LLM-Powered Scraping

**What:** Using Gemini to parse HTML instead of Cheerio with CSS selectors.

**Why bad:** 10x slower, burns API quota on parsing (not enrichment), unreliable output structure, unnecessary cost. Cheerio parses HTML deterministically in milliseconds. LLMs should only be used for tasks requiring understanding (classification, rewriting), not mechanical extraction.

**Instead:** Use Cheerio with config-driven CSS selectors for scraping. Reserve Gemini exclusively for enrichment (tagging, description enhancement).

### Anti-Pattern 2: Scraping at Request Time

**What:** Fetching and parsing source websites when a user loads a page.

**Why bad:** Adds 2-10 seconds to page load, breaks if source sites are slow/down, hammers source sites with traffic, Vercel function timeout risk, terrible UX.

**Instead:** All scraping happens in background cron jobs. Users always see pre-processed data from the database.

### Anti-Pattern 3: Storing Coordinates as Separate lat/lng Columns

**What:** Using `latitude FLOAT, longitude FLOAT` columns instead of PostGIS geography type.

**Why bad:** Cannot use spatial indexes (GIST), cannot use `ST_DWithin` or `<->` operator, every distance calculation becomes a slow full-table scan with Haversine formula in application code.

**Instead:** Use `location GEOGRAPHY(POINT)` with a GIST index. PostGIS handles the math correctly (accounting for Earth's curvature) and uses the index.

### Anti-Pattern 4: Monolithic Pipeline Function

**What:** One giant function that scrapes all sources, geocodes everything, and enriches everything in a single execution.

**Why bad:** Exceeds function timeout (5 minutes on Hobby). If enrichment fails at event #45, you lose progress on events 1-44. No observability into which stage failed.

**Instead:** Status-based pipeline where each stage is independently retriable. Even if running in a single cron invocation, structure the code as separate async functions that commit progress after each event.

### Anti-Pattern 5: Client-Side Supabase Queries with Exposed Logic

**What:** Calling Supabase directly from client components with complex query logic exposed in the browser.

**Why bad:** Query patterns visible in browser DevTools, no server-side validation, harder to optimize, potential RLS complexity.

**Instead:** Use Next.js Route Handlers or Server Actions as an API layer. Client components call `/api/search?...`, the Route Handler builds the Supabase query server-side. Keep Supabase service role key server-side only.

## Database Schema Overview

```sql
-- Core tables
events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location_text TEXT NOT NULL,
  location GEOGRAPHY(POINT),          -- PostGIS
  province TEXT,                       -- e.g., "PD", "VI", "TV"
  start_date DATE,
  end_date DATE,
  description TEXT,                    -- raw from source
  enhanced_description TEXT,           -- LLM-generated
  cuisine_tags TEXT[],                 -- LLM-classified: ["pesce", "baccala"]
  image_url TEXT,
  source_url TEXT,
  is_free BOOLEAN,
  price_info TEXT,
  status TEXT DEFAULT 'pending_geocode',
  content_hash TEXT NOT NULL,
  source_id UUID REFERENCES scraper_configs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_hash, source_id)
);

CREATE INDEX events_location_idx ON events USING GIST (location);
CREATE INDEX events_status_idx ON events (status);
CREATE INDEX events_dates_idx ON events (start_date, end_date);
CREATE INDEX events_province_idx ON events (province);
CREATE INDEX events_slug_idx ON events (slug);

scraper_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  list_selector TEXT NOT NULL,
  title_selector TEXT,
  date_selector TEXT,
  location_selector TEXT,
  description_selector TEXT,
  image_selector TEXT,
  pagination_selector TEXT,
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

geocode_cache (
  location_key TEXT PRIMARY KEY,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  province TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Project Structure

```
src/
  app/
    (main)/
      page.tsx                    -- Homepage (Server Component)
      layout.tsx                  -- Main layout with BottomNav
    sagra/
      [slug]/
        page.tsx                  -- Detail page (Server Component)
    cerca/
      page.tsx                    -- Search/filter page (Server + Client)
    mappa/
      page.tsx                    -- Full map page (Client-heavy)
    api/
      cron/
        scrape/route.ts           -- Cron: scrape + geocode
        enrich/route.ts           -- Cron: enrich + expire
      search/route.ts             -- API: filtered search
      nearby/route.ts             -- API: geo-proximity search
  components/
    map/
      index.tsx                   -- Dynamic import wrapper (ssr: false)
      MapView.tsx                 -- Leaflet implementation
      MarkerPopup.tsx             -- Popup card content
    sagra/
      SagraCard.tsx               -- Event card component
      SagraGrid.tsx               -- Card grid layout
      SagraFilters.tsx            -- Filter controls
    layout/
      BottomNav.tsx               -- Mobile navigation
      Header.tsx                  -- Desktop header
  lib/
    supabase/
      server.ts                   -- Server-side Supabase client
      client.ts                   -- Browser-side Supabase client
      service-role.ts             -- Service role client (cron only)
    scraper/
      engine.ts                   -- Generic scraper with Cheerio
      geocoder.ts                 -- Nominatim geocoding with cache
      enricher.ts                 -- Gemini 2.5 Flash enrichment
      rate-limiter.ts             -- Rate limiting utility
    utils/
      dates.ts                    -- Date parsing/formatting (Italian)
      slug.ts                     -- Slug generation
      hash.ts                     -- Content hashing
  types/
    events.ts                     -- Event type definitions
    scraper.ts                    -- Scraper config types
```

## Scalability Considerations

| Concern | At 100 events | At 1,000 events | At 10,000 events |
|---------|--------------|-----------------|-------------------|
| Scraping time | ~30s (5 sources) | ~60s (still 5 sources, more pages) | ~2-3min (pagination needed) |
| Geocoding | ~10s (most cached) | ~30s (city cache helps) | ~100s (more unique locations) |
| LLM enrichment | ~60s (10 RPM) | ~6min (exceeds single function) | ~60min (needs queue/batch API) |
| PostGIS queries | <50ms | <100ms (with GIST index) | <200ms (with GIST index) |
| Map rendering | Instant | ~200ms with clustering | Needs viewport-based loading |
| Storage (Supabase) | <1MB | ~10MB | ~100MB (within free tier) |

**Scaling inflection points:**
- **>500 events/day new**: LLM enrichment exceeds single function timeout. Move to Gemini Batch API or Supabase Edge Functions with pg_cron scheduling.
- **>5,000 total active events**: Map needs viewport-based loading (only fetch events in visible bounding box) instead of loading all events at once.
- **>10 source sites**: Scraping may need parallelization or multiple cron windows.

For MVP with ~5 sources and the Veneto region (~200-500 active sagre at any time), the single-orchestrator architecture is sufficient.

## Suggested Build Order (Dependencies)

The architecture implies this build sequence based on component dependencies:

### Phase 1: Foundation (Database + Core Infra)
Must be built first because everything depends on the database schema and Supabase client setup.
- Supabase project setup with PostGIS extension
- Database schema (events, scraper_configs, geocode_cache)
- PostGIS RPC functions (find_nearby_sagre)
- Supabase client factories (server, client, service-role)
- TypeScript type definitions

### Phase 2: Data Pipeline (Scrape + Geocode + Enrich)
Depends on Phase 1 (database schema). Must exist before the frontend has data to display.
- Generic scraper engine with Cheerio
- Scraper configs for first 2-3 sources
- Rate limiter utility
- Nominatim geocoder with cache layer
- Gemini enricher (tagging + description)
- Status-based pipeline orchestration
- Cron route handlers

### Phase 3: Core Frontend (Pages + Components)
Depends on Phase 1 (Supabase client) and Phase 2 (data in database).
- App layout with mobile BottomNav
- Homepage with SagraCards
- SagraCard component
- Search page with filters
- Detail page with SEO metadata
- Route Handlers for search API

### Phase 4: Map Integration
Depends on Phase 3 (layout exists) and Phase 1 (PostGIS RPC).
- Leaflet dynamic import wrapper
- MapView with tile layer
- MarkerCluster integration
- Marker popups with SagraCard preview
- "Vicino a me" geolocation
- Map/list toggle on search page

### Phase 5: Polish + Production
Depends on all previous phases.
- Remaining scraper configs (all 5+ sources)
- SEO: sitemap, OG images, structured data
- UI polish: animations (Framer Motion, Magic UI)
- Vercel cron deployment config (vercel.json)
- Error handling and retry logic
- Performance optimization

## Sources

### Vercel Platform
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) -- cron configuration and behavior
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- Hobby: 100 crons, once/day only, hourly precision
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) -- Hobby: 300s max duration with Fluid Compute
- [Vercel Cron Job Changelog](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan) -- 100 crons per project on all plans

### Supabase + PostGIS
- [Supabase PostGIS Docs](https://supabase.com/docs/guides/database/extensions/postgis) -- geography type, RPC pattern, spatial index
- [Supabase PostGIS on GitHub](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/extensions/postgis.mdx) -- code examples
- [Supabase Cron Module](https://supabase.com/docs/guides/cron) -- pg_cron for database-level scheduling
- [Supabase Discussion #5390](https://github.com/orgs/supabase/discussions/5390) -- geo queries and distance sorting patterns

### Leaflet + Next.js
- [React Leaflet on Next.js 15](https://xxlsteve.net/blog/react-leaflet-on-next-15/) -- dynamic import pattern for App Router
- [PlaceKit: React-Leaflet with NextJS](https://placekit.io/blog/articles/making-react-leaflet-work-with-nextjs-493i) -- SSR bypass patterns
- [react-leaflet-cluster npm](https://www.npmjs.com/package/react-leaflet-cluster) -- marker clustering wrapper

### Gemini API
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) -- rate limit structure
- [Gemini API Free Tier Limits (2025)](https://www.aifreeapi.com/en/posts/gemini-api-free-quota) -- 2.5 Flash: 10 RPM, 250 RPD, 250K TPM on free tier

### Scraping + Pipeline Patterns
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) -- 1 req/sec, cache required
- [Data Deduplication Techniques](https://scrapingproxies.best/blog/web-data/data-deduplication-techniques/) -- hash-based and fuzzy dedup
- [Supabase @supabase/ssr Client Setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- createServerClient / createBrowserClient pattern
