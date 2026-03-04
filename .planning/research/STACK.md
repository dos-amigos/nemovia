# Technology Stack

**Project:** Nemovia -- Italian Sagre Aggregator
**Researched:** 2026-03-04
**Overall Confidence:** HIGH

## Executive Summary

The team's pre-selected stack is solid and well-validated for this use case. Every choice aligns with the zero-budget constraint and the domain requirements (scraping, LLM enrichment, geo-search, interactive maps). Two critical corrections surfaced during research:

1. **Framer Motion has been renamed to Motion** (package: `motion`, not `framer-motion`). The old package is deprecated.
2. **The `@google/generative-ai` package is deprecated** (support ended August 2025). Use `@google/genai` instead.
3. **Vercel free tier crons run only once/day** -- use Supabase pg_cron + pg_net to trigger scraping/enrichment at any frequency, bypassing Vercel's limitation entirely.
4. **Supabase free tier pauses projects after 7 days of inactivity** -- not an issue here since pg_cron will keep the database active, but worth knowing.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 15.x (latest stable) | Full-stack React framework | Stable, production-proven, excellent Vercel integration. Use 15.x over 16.x for stability -- 16 is newer but 15 has a longer track record. Turbopack dev is stable in 15.5+. | HIGH |
| React | 19.x | UI rendering | Required by Next.js 15, required by react-leaflet 5.x. Stable since late 2024. | HIGH |
| TypeScript | 5.x | Type safety | Non-negotiable for any project with scraping configs, LLM schemas, and geo data. Catches integration bugs early. | HIGH |

**Why Next.js 15 over 16:** Next.js 16 (released Dec 2025) defaults to Turbopack and has performance improvements (5.7s vs 24.5s builds), but 15.x is battle-tested with a larger ecosystem of working examples, especially for react-leaflet SSR workarounds. Upgrade to 16 after MVP.

### Styling & UI Components

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | 4.x | Utility-first CSS | shadcn/ui fully supports v4 since March 2025. Use v4 (not v3) for new projects -- new `@theme` directive, better performance. | HIGH |
| shadcn/ui | latest (CLI) | Base component library | Copy-paste components, fully customizable, no vendor lock-in. Cards, dialogs, dropdowns, badges -- covers 80% of UI needs. Install via `pnpm dlx shadcn@latest init`. | HIGH |
| Magic UI | latest | Animated components | 150+ animated components built on shadcn/ui + Tailwind + Motion. Use for hero sections, card animations, text reveals. Copy-paste model (no npm dependency). | MEDIUM |
| ReactBits | latest | Interactive UI effects | 110+ animated components. Use selectively for text animations and background effects. Copy-paste model. | MEDIUM |
| motion | 12.x | Animation engine | Formerly "Framer Motion" -- renamed and expanded beyond React. Required by Magic UI components. Install `motion` (NOT `framer-motion`). | HIGH |
| tw-animate-css | latest | CSS animations for shadcn | Replacement for deprecated `tailwindcss-animate`. Installed by default with new shadcn/ui projects on Tailwind v4. | HIGH |

**Important:** Magic UI and ReactBits are copy-paste libraries, not npm dependencies. They add code to your project. Use them sparingly -- pick 5-10 components max to avoid bloating the bundle. Prioritize Magic UI (better shadcn integration) over ReactBits.

### Database & Backend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase | Client: 2.98.x | BaaS (DB, auth, edge functions) | PostgreSQL + PostGIS + pg_cron + pg_net on free tier. 500 MB storage, 500K edge function invocations/month. Enough for thousands of sagre records. | HIGH |
| PostGIS | (Supabase extension) | Geographic queries | Enable via Supabase Dashboard. ST_DWithin for radius search, `<->` operator for nearest-neighbor sort. Native spatial indexing. | HIGH |
| pg_cron | (Supabase extension) | Job scheduling | Available on free tier. Cron syntax down to 1-second intervals. Replaces Vercel cron (which is daily-only on free tier). | HIGH |
| pg_net | (Supabase extension) | HTTP requests from Postgres | Allows pg_cron jobs to call Edge Functions or external webhooks via HTTP. Required for the scraping/enrichment pipeline. | HIGH |

**PostGIS Setup Pattern:**
```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Sagre table with geography column
CREATE TABLE sagre (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  -- ... other columns
);

-- Spatial index
CREATE INDEX idx_sagre_location ON sagre USING GIST(location);

-- Find nearby sagre (RPC function)
CREATE OR REPLACE FUNCTION find_nearby_sagre(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 30
)
RETURNS SETOF sagre AS $$
  SELECT *
  FROM sagre
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_km * 1000  -- meters
  )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
$$ LANGUAGE sql STABLE;
```

**CRITICAL: Longitude comes FIRST in PostGIS functions** (ST_MakePoint(lng, lat), not lat, lng). This is the #1 PostGIS mistake.

### Scraping

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| cheerio | 1.2.x | HTML parsing | 14.5M weekly npm downloads. Fast, lightweight (6.6kb), jQuery-like API. Perfect for static HTML scraping. No browser overhead. | HIGH |

**Why NOT Puppeteer/Playwright:** Italian sagre websites (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly) are server-rendered static HTML sites. They don't use JS-heavy SPAs. Cheerio is 70% faster and requires zero browser infrastructure. If a source later requires JS rendering, add Playwright for that single source only.

**Scraping Architecture:** Config-driven generic scraper. Each source is a row in a `scraper_configs` table with CSS selectors:

```typescript
interface ScraperConfig {
  id: string;
  source_name: string;
  base_url: string;
  list_selector: string;      // CSS selector for event cards
  title_selector: string;
  date_selector: string;
  location_selector: string;
  description_selector: string;
  image_selector: string;
  pagination_selector?: string;
  enabled: boolean;
}
```

### Geocoding

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Nominatim (OSM) | Public API | City name to coordinates | Free, accurate for Italian locations, no API key needed. Rate limit: 1 req/sec (absolute max). | HIGH |

**Rate Limit Strategy:** Geocode during enrichment batch processing, not on user requests. Cache results in DB -- Italian cities don't move. A `geocoding_cache` table with city name -> coordinates avoids re-requesting. With ~500 unique Veneto locations, initial geocoding takes ~8 minutes at 1 req/sec. After that, cache hits only.

**Required Headers:** Must set a custom `User-Agent` header identifying the application (e.g., `Nemovia/1.0 (contact@nemovia.it)`). Requests without proper identification may be blocked.

### LLM Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @google/genai | 1.43.x | Gemini API client | The NEW official Google GenAI SDK. Do NOT use `@google/generative-ai` (deprecated, support ended Aug 2025). | HIGH |
| Gemini 2.5 Flash | model: `gemini-2.5-flash` | Text classification & enrichment | Free tier: 10 RPM, 250 RPD, 250K TPM. Use for food-type tagging and description enrichment. | HIGH |
| zod | 3.x | Schema validation | Define structured output schemas for Gemini responses. Use with `zod-to-json-schema` for type-safe LLM outputs. | HIGH |
| zod-to-json-schema | latest | Schema conversion | Converts Zod schemas to JSON Schema for Gemini's `responseJsonSchema` config. | HIGH |

**CRITICAL: Gemini Free Tier is 250 RPD (requests per day)**, not 2000. The PROJECT.md states ~2000 req/day which exceeds the free tier by 8x. Solutions:
1. **Batch intelligently:** Only enrich NEW sagre (not all). With ~50 new sagre/day across 5 sources, 250 RPD is sufficient.
2. **Combine tagging + description in one request** to halve the request count.
3. **Cache LLM results** -- once enriched, never re-process.
4. If volume grows, Gemini pay-as-you-go is very cheap ($0.10/1M input tokens for Flash).

**Structured Output Pattern:**
```typescript
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const SagraEnrichmentSchema = z.object({
  food_tags: z.array(z.string()).describe("Tipo cucina: pesce, carne, pizza, dolci, polenta, etc."),
  description_short: z.string().max(250).describe("Descrizione coinvolgente in italiano, max 250 caratteri"),
  is_free: z.boolean().describe("Ingresso gratuito o a pagamento"),
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: `Analizza questa sagra e classifica: ${sagraTitle} - ${sagraDescription}`,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(SagraEnrichmentSchema),
  },
});
```

### Maps & Geolocation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| leaflet | 1.9.4 | Map rendering engine | Stable, free, no API key. Do NOT use Leaflet 2.0 (alpha, breaking changes). | HIGH |
| react-leaflet | 5.0.0 | React wrapper for Leaflet | Requires React 19 + Leaflet 1.9.x. Provides `<MapContainer>`, `<TileLayer>`, `<Marker>`, `<Popup>`. | HIGH |
| react-leaflet-cluster | 2.x | Marker clustering | Wraps Leaflet.markercluster. Supports chunkedLoading for performance. CSS must be imported manually. | HIGH |

**CRITICAL SSR Workaround:** Leaflet accesses `window` on import, which breaks Next.js SSR. The solution is mandatory:

```typescript
// components/Map.tsx (client component)
"use client";
import dynamic from "next/dynamic";

const MapComponent = dynamic(
  () => import("./MapInner"),
  { ssr: false, loading: () => <div className="h-[500px] bg-stone-100 animate-pulse" /> }
);

export default MapComponent;
```

**Tile Layer (OpenStreetMap):**
```typescript
<TileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
/>
```

### Deployment & Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vercel | Hobby (free) | Hosting & CDN | Native Next.js support, automatic deployments from Git, edge network. Free tier: 100 GB bandwidth, 10s function timeout (60s with Fluid Compute). | HIGH |
| Supabase Edge Functions | (Deno runtime) | Scraping & enrichment workers | 150s timeout (vs Vercel's 10s). 500K invocations/month free. Run scraping and LLM enrichment here, NOT in Vercel serverless functions. | HIGH |
| Supabase pg_cron | (PostgreSQL extension) | Job scheduling | Schedule scraping 2x/day, enrichment 2x/day. Calls Edge Functions via pg_net HTTP requests. Replaces Vercel cron entirely. | HIGH |

**Why Supabase Edge Functions over Vercel Serverless for scraping:**
- Vercel free tier: 10s timeout (60s with Fluid Compute). Scraping 5 websites takes longer.
- Supabase Edge Functions: 150s timeout. Sufficient for scraping a batch of pages.
- pg_cron can schedule at any frequency (every minute if needed), unlike Vercel's daily-only free cron.

**Architecture Decision: Use Vercel ONLY for the frontend and API routes. Use Supabase Edge Functions for ALL background processing (scraping, geocoding, LLM enrichment).**

### SEO & Metadata

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js Metadata API | (built-in) | Dynamic meta tags | `generateMetadata()` in App Router. Dynamic OG titles/descriptions per sagra page. | HIGH |
| @vercel/og | latest | OG image generation | Generate dynamic Open Graph images for social sharing. Each sagra gets a branded OG image. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| @supabase/ssr | latest | Supabase SSR helpers | Server-side Supabase client in Next.js App Router. Required for server components. | HIGH |
| date-fns | 4.x | Date manipulation | Parse Italian date formats from scraped data. Locale support for "it". | HIGH |
| lucide-react | latest | Icons | Default icon set for shadcn/ui. Consistent, tree-shakeable. | HIGH |
| nuqs | latest | URL query state | Sync filter state (province, date, cuisine) with URL params. Enables shareable filtered views. | MEDIUM |
| next-sitemap | latest | Sitemap generation | Auto-generate sitemap.xml with all sagra detail pages for SEO. | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Next.js 16 | 16 is newer but less battle-tested. Upgrade post-MVP. |
| Framework | Next.js 15 | Remix / Astro | Team chose Next.js. Vercel-native. No reason to change. |
| CSS | Tailwind v4 | Tailwind v3 | v4 is production-ready with shadcn/ui. No reason to use v3 for new projects. |
| Database | Supabase (PostgreSQL) | PlanetScale / Neon | PostGIS support is critical. Supabase has native PostGIS. PlanetScale is MySQL (no PostGIS). Neon has PostGIS but worse free tier. |
| Maps | Leaflet + OSM | Google Maps / Mapbox | Zero cost, no API key, sufficient for the use case. Google Maps = billing. Mapbox = token management. |
| Scraping | Cheerio | Puppeteer / Playwright | Target sites are static HTML. Cheerio is 70% faster, zero browser overhead. |
| Scraping | Cheerio | Crawlee | Crawlee is overkill for 5 static sites. Adds complexity without benefit. |
| Geocoding | Nominatim | Google Geocoding / Mapbox | Free, accurate for Italy, no API key. Google/Mapbox = billing. |
| LLM | Gemini 2.5 Flash | GPT-4o-mini / Claude Haiku | Free tier. GPT-4o-mini has no free tier. Claude Haiku has no free tier. |
| LLM SDK | @google/genai | @google/generative-ai | Old package deprecated Aug 2025. Must use new SDK. |
| LLM SDK | @google/genai | Vercel AI SDK (@ai-sdk/google) | Adds abstraction layer. Direct SDK is simpler for batch processing (no streaming needed). |
| Animation | motion (v12) | framer-motion | Same library, renamed. `framer-motion` is the old package name. |
| State | URL params (nuqs) | Zustand / Jotai | No client-side state management needed. All state is URL-driven (filters, search) or server-fetched. Shareable URLs are a feature requirement. |
| ORM | Raw SQL (Supabase client) | Prisma / Drizzle | Supabase client handles queries. PostGIS functions are best written as raw SQL/RPC. An ORM adds complexity without value here. |

## Version Matrix

```
next@15.x
react@19.x
react-dom@19.x
typescript@5.x
tailwindcss@4.x
motion@12.x
@supabase/supabase-js@2.98.x
@supabase/ssr@latest
@google/genai@1.43.x
cheerio@1.2.x
leaflet@1.9.4
react-leaflet@5.0.0
react-leaflet-cluster@2.x
zod@3.x
zod-to-json-schema@latest
date-fns@4.x
lucide-react@latest
nuqs@latest
next-sitemap@latest
tw-animate-css@latest
```

## Installation

```bash
# Initialize Next.js project
pnpm create next-app@15 nemovia --typescript --tailwind --eslint --app --src-dir

# Core dependencies
pnpm add @supabase/supabase-js @supabase/ssr @google/genai cheerio leaflet react-leaflet react-leaflet-cluster zod zod-to-json-schema date-fns lucide-react nuqs motion next-sitemap

# Type definitions
pnpm add -D @types/leaflet

# Initialize shadcn/ui (Tailwind v4)
pnpm dlx shadcn@latest init

# Add commonly needed shadcn components
pnpm dlx shadcn@latest add button card badge input select dialog sheet separator skeleton tabs toggle-group
```

## Free Tier Budget Summary

| Service | Free Tier Limit | Expected Usage (MVP) | Headroom |
|---------|----------------|---------------------|----------|
| Vercel Hosting | 100 GB bandwidth | <5 GB/month | 95% |
| Supabase Database | 500 MB storage | ~50 MB (few thousand sagre) | 90% |
| Supabase Edge Functions | 500K invocations/month | ~1,000/month (cron jobs) | 99% |
| Gemini 2.5 Flash | 250 RPD / 10 RPM | ~100 RPD (batch enrichment) | 60% |
| Nominatim | 1 req/sec | Burst on new cities, then cache | OK |
| OpenStreetMap Tiles | Unlimited (fair use) | Standard usage | OK |
| GitHub Actions | 2,000 min/month | Not needed (pg_cron replaces) | 100% |

## Sources

- [Next.js 15 Release Blog](https://nextjs.org/blog/next-15) - HIGH confidence
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) - HIGH confidence
- [Supabase PostGIS Documentation](https://supabase.com/docs/guides/database/extensions/postgis) - HIGH confidence
- [Supabase Cron Documentation](https://supabase.com/docs/guides/cron) - HIGH confidence
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits) - HIGH confidence
- [Supabase Pricing](https://supabase.com/pricing) - HIGH confidence
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) - HIGH confidence
- [Vercel Limits](https://vercel.com/docs/limits) - HIGH confidence
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) - HIGH confidence
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) - HIGH confidence
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) - HIGH confidence
- [@google/generative-ai npm (DEPRECATED)](https://www.npmjs.com/package/@google/generative-ai) - HIGH confidence
- [Cheerio Official Site](https://cheerio.js.org/) - HIGH confidence
- [react-leaflet Installation](https://react-leaflet.js.org/docs/start-installation/) - HIGH confidence
- [React Leaflet on Next.js 15 (SSR workaround)](https://xxlsteve.net/blog/react-leaflet-on-next-15/) - MEDIUM confidence
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) - HIGH confidence
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) - HIGH confidence
- [Motion (formerly Framer Motion)](https://motion.dev) - HIGH confidence
- [Magic UI](https://magicui.design/) - MEDIUM confidence
- [ReactBits](https://reactbits.dev/) - MEDIUM confidence
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) - HIGH confidence
