# Phase 19: Image Quality Foundation - Research

**Researched:** 2026-03-11
**Domain:** Unsplash API integration, image pipeline, full-bleed hero UI
**Confidence:** HIGH

## Summary

Phase 19 has two clear deliverables: (1) replace missing/low-res sagra images with themed Unsplash fallbacks populated at pipeline time, and (2) transform the homepage hero from a mesh-gradient placeholder into a full-bleed Unsplash food photograph with white overlay text. Both requirements are constrained by the Unsplash demo tier rate limit (50 requests/hour) and the project's zero-cost budget, which means all API calls must happen server-side in the enrichment pipeline, never at render time.

The existing codebase is well-prepared for this. The `next.config.ts` already allows all remote image hosts (`hostname: "**"`), the `enrich-sagre` Edge Function already runs 2x/day via pg_cron with a batch processing architecture, and the `SagraCard`/`FeaturedSagraCard` components already handle `image_url` with a gradient placeholder fallback. The database `sagre` table has an `image_url TEXT` column ready for Unsplash URLs. The main work is adding an Unsplash image pass to the enrichment pipeline, adding an `image_credit` column for attribution, creating a server-side hero image utility, and rewriting the `HeroSection` component.

**Primary recommendation:** Add a third pass to `enrich-sagre` that fetches Unsplash images for sagre with null `image_url`, storing both the hotlinked URL and photographer credit in the database. For the hero, use a curated static Unsplash photo URL to avoid any runtime API calls. Show Unsplash attribution in the footer (Phase 20 will create the footer; Phase 19 adds the attribution data structure).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMG-01 | Missing or low-res images replaced with themed Unsplash photos (pre-fetched at pipeline time, not runtime) | Unsplash search API `/search/photos` with food-themed queries; store hotlinked URLs + `image_credit` in DB during `enrich-sagre` third pass; rate limit safe at ~20 images/run within 50 req/hr demo tier |
| IMG-02 | Hero section displays full-bleed Unsplash food photo with white text overlay "SCOPRI LE SAGRE DEL VENETO" | Static curated Unsplash photo URL (zero API calls at runtime); full-bleed via negative margin breakout pattern; dark gradient overlay for text readability; Unsplash attribution link |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Image | 15.5.12 (bundled) | Optimized image rendering with lazy loading | Already used via `FadeImage` wrapper; handles Unsplash CDN images natively |
| Unsplash API | v1 (REST) | Search and retrieve food/festival photos | Official free API, no SDK needed (project explicitly forbids `unsplash-js`) |
| Supabase Edge Functions | Deno runtime | Pipeline-time Unsplash image fetching | Existing `enrich-sagre` function; extends with third pass |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion/react-m | 12.35.0 | Hero parallax/fade animations | Already imported; reuse for hero image entrance |
| FadeImage component | Existing | Image load transition with opacity fade | Already wraps Next.js Image; use for hero and card images |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static hero photo URL | Runtime Unsplash API call with ISR | Adds complexity and API call risk; static URL is simpler and zero-cost |
| `unsplash-js` SDK | Native `fetch()` | Project explicitly forbids SDK (REQUIREMENTS.md Out of Scope); native fetch is lighter |
| Storing Unsplash images in Supabase Storage | Hotlinking Unsplash CDN URLs | Unsplash API guidelines REQUIRE hotlinking; storing copies violates terms |

**Installation:**
```bash
# No new dependencies needed -- uses native fetch + existing stack
```

## Architecture Patterns

### Recommended Approach

```
PIPELINE (enrich-sagre Edge Function)                  PRESENTATION (Next.js)
+--------------------------------------------+        +--------------------------------+
| Pass 1: Geocoding (existing)               |        | SagraCard.tsx                  |
| Pass 2: LLM enrichment (existing)          |        |   image_url ? FadeImage : skip |
| Pass 3: Unsplash fallback (NEW)            |        |   (gradient placeholder gone)  |
|   - Query: WHERE image_url IS NULL          |        +--------------------------------+
|     AND status = 'enriched'                 |        | HeroSection.tsx                |
|     AND is_active = true                    |        |   Static Unsplash URL          |
|   - Search Unsplash: food_tags[0] + query  |        |   Dark gradient overlay        |
|   - Store: image_url + image_credit         |        |   White text + attribution     |
|   - Rate: 1 req/sec, max 30 per run        |        +--------------------------------+
+--------------------------------------------+
```

### Pattern 1: Pipeline-Time Unsplash Image Assignment
**What:** During the enrichment Edge Function run, after LLM enrichment completes, scan for sagre with null `image_url` and fetch themed Unsplash images.
**When to use:** Every `enrich-sagre` invocation (2x/day via pg_cron).
**Why:** Keeps all Unsplash API calls server-side, batched, and rate-limited. With 50 req/hr demo tier and ~20 null-image sagre per run, this is well within limits.

```typescript
// In enrich-sagre/index.ts - NEW Pass 3
const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
const UNSPLASH_LIMIT = 30; // max images per run (well within 50 req/hr)
const UNSPLASH_SLEEP_MS = 2000; // 2s between calls (courtesy + safety margin)

// Food-themed search queries based on food_tags
const TAG_QUERIES: Record<string, string> = {
  "Pesce": "italian seafood festival",
  "Carne": "italian meat grill festival",
  "Vino": "italian wine festival",
  "Formaggi": "italian cheese market",
  "Funghi": "mushroom food festival",
  "Radicchio": "italian vegetable market",
  "Dolci": "italian dessert pastry",
  "Prodotti Tipici": "italian food market",
};
const DEFAULT_QUERY = "italian sagra food festival";

async function runUnsplashPass(supabase: SupabaseClient): Promise<number> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log("UNSPLASH_ACCESS_KEY not set, skipping image pass");
    return 0;
  }

  let assigned = 0;

  const { data: rows } = await supabase
    .from("sagre")
    .select("id, food_tags")
    .is("image_url", null)
    .eq("is_active", true)
    .in("status", ["enriched"])
    .limit(UNSPLASH_LIMIT)
    .order("created_at", { ascending: true });

  if (!rows?.length) return 0;

  for (const sagra of rows) {
    const primaryTag = sagra.food_tags?.[0] ?? null;
    const query = (primaryTag && TAG_QUERIES[primaryTag]) ?? DEFAULT_QUERY;

    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=10&content_filter=high`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
      );

      if (!res.ok) {
        console.error(`Unsplash API error: ${res.status}`);
        break; // Stop on rate limit or auth error
      }

      const data = await res.json();
      // Pick random photo from results for variety
      const photos = data.results ?? [];
      if (photos.length === 0) continue;

      const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 5))];

      // Construct optimized URL: 800px wide, high quality, crop to landscape
      const imageUrl = `${photo.urls.raw}&w=800&h=500&fit=crop&q=80`;
      const credit = `${photo.user.name}|${photo.user.links.html}`;

      await supabase.from("sagre").update({
        image_url: imageUrl,
        image_credit: credit,
        updated_at: new Date().toISOString(),
      }).eq("id", sagra.id);

      // Trigger download tracking (Unsplash API requirement)
      if (photo.links?.download_location) {
        fetch(`${photo.links.download_location}?client_id=${UNSPLASH_ACCESS_KEY}`)
          .catch(() => {}); // Fire and forget
      }

      assigned++;
    } catch (err) {
      console.error("Unsplash fetch error:", err);
    }

    await sleep(UNSPLASH_SLEEP_MS);
  }

  return assigned;
}
```

### Pattern 2: Static Curated Hero Image
**What:** Use a pre-selected, high-quality Unsplash landscape photo URL directly in the HeroSection component, rather than making runtime API calls.
**When to use:** Homepage hero display.
**Why:** Zero API calls at render time. The hero image rarely needs to change -- a beautiful Italian food/festival photo is timeless. If variety is desired later, a curated array of 5-10 URLs can rotate based on `Date.now()`.

```typescript
// lib/unsplash.ts
export interface UnsplashHeroImage {
  url: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
}

// Curated hero images -- hand-picked for quality and relevance
// These are hotlinked Unsplash URLs (required by API terms)
const HERO_IMAGES: UnsplashHeroImage[] = [
  {
    url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1920&h=600&fit=crop&q=80",
    photographer: "Eiliv Aceron",
    photographerUrl: "https://unsplash.com/@eilivaceron?utm_source=nemovia&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/?utm_source=nemovia&utm_medium=referral",
  },
  // ... 4-5 more curated food/festival images
];

export function getHeroImage(): UnsplashHeroImage {
  // Rotate daily for variety
  const dayIndex = Math.floor(Date.now() / 86_400_000) % HERO_IMAGES.length;
  return HERO_IMAGES[dayIndex];
}
```

### Pattern 3: Rewritten HeroSection with Full-Bleed Photo
**What:** Transform the mesh-gradient hero into a full-bleed photo with dark overlay and white text.
**When to use:** Homepage rendering.

```tsx
// components/home/HeroSection.tsx
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { FadeIn } from "@/components/animations/FadeIn";
import { getHeroImage } from "@/lib/unsplash";

export function HeroSection() {
  const hero = getHeroImage();

  return (
    <FadeIn>
      <section className="relative h-[280px] sm:h-[340px] lg:h-[400px] overflow-hidden">
        {/* Full-bleed background photo */}
        <Image
          src={hero.url}
          alt="Sagre del Veneto - Italian food festival"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

        {/* Content overlay */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-bold text-white lg:text-5xl drop-shadow-lg">
            SCOPRI LE SAGRE DEL VENETO
          </h1>
          <p className="mt-3 text-white/80 lg:text-lg max-w-lg">
            Trova sagre ed eventi gastronomici nella tua zona
          </p>
          <Link
            href="/cerca"
            className="mt-6 inline-flex items-center gap-3 rounded-full bg-white/20 border border-white/30 px-5 py-3 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <Search className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">Cerca per nome, citta...</span>
          </Link>
        </div>

        {/* Unsplash attribution -- small, bottom-right */}
        <div className="absolute bottom-2 right-3 z-10 text-[10px] text-white/50">
          Photo by{" "}
          <a href={hero.photographerUrl} target="_blank" rel="noopener noreferrer"
             className="underline hover:text-white/70">
            {hero.photographer}
          </a>{" "}
          on{" "}
          <a href={hero.unsplashUrl} target="_blank" rel="noopener noreferrer"
             className="underline hover:text-white/70">
            Unsplash
          </a>
        </div>
      </section>
    </FadeIn>
  );
}
```

**Full-bleed integration with layout:** The hero needs to break out of the `max-w-7xl` container. Use the negative margin pattern already established in `MappaClientPage.tsx`:

```tsx
// In app/(main)/page.tsx:
<div className="-mx-4 -mt-4 sm:-mx-6 lg:-mx-8">
  <HeroSection />
</div>
```

### Anti-Patterns to Avoid
- **Runtime Unsplash API calls per card:** With 50 req/hr demo limit and 12+ cards per page, a single page load would exhaust the limit. Always pre-fetch at pipeline time.
- **Storing Unsplash image copies:** Unsplash API guidelines REQUIRE hotlinking their CDN URLs. Downloading and re-hosting violates their terms of service.
- **Using `unsplash-js` SDK:** Explicitly forbidden in project REQUIREMENTS.md Out of Scope section. Use native `fetch()`.
- **Removing gradient placeholder entirely without Unsplash fallback:** During the transition period before the pipeline populates all images, some sagre may still have null `image_url`. Keep a minimal fallback, but make it rarer over time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image CDN/optimization | Custom image proxy or resize service | Unsplash CDN URL params (`&w=800&h=500&fit=crop&q=80`) + Next.js Image | Unsplash CDN handles resizing via Imgix params; Next.js Image adds lazy loading, format optimization |
| Image placeholder blur | Custom base64 blur generation | CSS gradient placeholder or `blurDataURL` from Unsplash `blur_hash` | Unsplash returns `blur_hash` in API response; decode to small data URL for placeholder |
| Attribution tracking | Custom attribution database | `image_credit` TEXT column with `photographer_name|profile_url` format | Simple pipe-delimited string avoids schema complexity; parse at render time |
| Download event tracking | Custom analytics | Unsplash `download_location` endpoint (fire-and-forget POST) | Required by Unsplash API guidelines; simple fetch call |

## Common Pitfalls

### Pitfall 1: Rate Limit Exhaustion on Demo Tier
**What goes wrong:** Making too many Unsplash API calls causes 403 responses, breaking both hero and card images.
**Why it happens:** Demo tier allows only 50 requests/hour. If both hero (ISR) and pipeline compete, or if the pipeline processes too many images at once.
**How to avoid:** Hero uses static URLs (zero API calls). Pipeline limits to 30 images/run with 2s delay between calls. Check `X-Ratelimit-Remaining` header and stop early if below 5.
**Warning signs:** 403 responses from `api.unsplash.com`, empty image results.

### Pitfall 2: Hotlinking Requirement Violation
**What goes wrong:** Downloading Unsplash images and serving them from your own domain or Supabase Storage.
**Why it happens:** Developers assume they should cache images locally for reliability.
**How to avoid:** Always use `images.unsplash.com` URLs directly. Unsplash CDN is globally distributed and fast. Image file requests do NOT count against the rate limit.
**Warning signs:** Images served from any domain other than `images.unsplash.com`.

### Pitfall 3: Missing Download Tracking
**What goes wrong:** Unsplash rejects production approval because download events are not tracked.
**Why it happens:** Developers skip the `download_location` endpoint call.
**How to avoid:** After selecting an image for a sagra, fire a request to `photo.links.download_location` with `client_id` param. This is a fire-and-forget call.
**Warning signs:** Unsplash dashboard shows 0 downloads despite many image assignments.

### Pitfall 4: CORS Issues with Unsplash API
**What goes wrong:** Client-side JavaScript cannot call the Unsplash API due to CORS.
**Why it happens:** Attempting to call `api.unsplash.com` from browser JavaScript.
**How to avoid:** All Unsplash API calls happen server-side (Edge Function for pipeline, server utility for hero). Image CDN URLs (`images.unsplash.com`) work fine in `<img>` tags and Next.js Image.
**Warning signs:** CORS errors in browser console.

### Pitfall 5: Hero Image Layout Shift (CLS)
**What goes wrong:** The hero section jumps in height as the Unsplash image loads.
**Why it happens:** No explicit height set, or image loads after text is rendered.
**How to avoid:** Set explicit `h-[280px] sm:h-[340px] lg:h-[400px]` on the hero container. Use `priority` prop on the Image component for LCP optimization. Optionally use `blurDataURL` for instant placeholder.
**Warning signs:** Layout shift visible on page load, poor Core Web Vitals CLS score.

### Pitfall 6: Edge Function UNSPLASH_ACCESS_KEY Not Set
**What goes wrong:** The Unsplash pass silently fails because the environment variable is missing from the Edge Function secrets.
**Why it happens:** UNSPLASH_ACCESS_KEY is added to `.env` for local development but not to Supabase Edge Function secrets.
**How to avoid:** Add UNSPLASH_ACCESS_KEY to Supabase Edge Function secrets via Dashboard. Add graceful skip logic (`if (!UNSPLASH_ACCESS_KEY) return 0`).
**Warning signs:** enrich_logs shows 0 unsplash images assigned despite sagre with null image_url.

## Code Examples

### Unsplash API Search Request (Pipeline)
```typescript
// Source: Unsplash API v1 Documentation (https://unsplash.com/documentation)
const res = await fetch(
  `https://api.unsplash.com/search/photos?query=${encodeURIComponent("italian food festival")}&orientation=landscape&per_page=10&content_filter=high`,
  {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      "Accept-Version": "v1",
    },
  }
);

// Response shape:
// {
//   total: 1234,
//   total_pages: 124,
//   results: [
//     {
//       id: "abc123",
//       urls: { raw: "https://images.unsplash.com/photo-xxx?ixid=...", full: "...", regular: "...", small: "...", thumb: "..." },
//       blur_hash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
//       user: { name: "Photographer Name", links: { html: "https://unsplash.com/@username" } },
//       links: { download_location: "https://api.unsplash.com/photos/abc123/download" },
//     },
//     ...
//   ]
// }
```

### Constructing Optimized Image URL
```typescript
// Source: Unsplash documentation - Dynamic image URLs via Imgix params
// Use photo.urls.raw (base URL) + sizing params
const cardImageUrl = `${photo.urls.raw}&w=800&h=500&fit=crop&q=80`;
const heroImageUrl = `${photo.urls.raw}&w=1920&h=600&fit=crop&q=80`;
// Note: &fm=webp can be added but Next.js Image handles format negotiation
```

### Database Migration for image_credit Column
```sql
-- Migration 012: Add image_credit column for Unsplash attribution
ALTER TABLE public.sagre ADD COLUMN IF NOT EXISTS image_credit TEXT;

-- Index not needed -- only read on detail page render, not queried/filtered
COMMENT ON COLUMN public.sagre.image_credit IS
  'Unsplash photographer attribution. Format: "Photographer Name|profile_url". Null for source-provided images.';
```

### Parsing image_credit for Attribution Display
```typescript
// Parse the pipe-delimited image_credit field
function parseImageCredit(credit: string | null): { name: string; url: string } | null {
  if (!credit) return null;
  const [name, url] = credit.split("|");
  if (!name || !url) return null;
  return { name, url };
}
```

### Full-Bleed Hero Breakout in page.tsx
```tsx
// Source: Existing pattern from MappaClientPage.tsx line 26
// The negative margin pattern breaks out of the max-w-7xl container
<div className="-mx-4 -mt-4 sm:-mx-6 lg:-mx-8">
  <HeroSection />
</div>
{/* Remaining content stays within container */}
<QuickFilters />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mesh gradient placeholder hero | Full-bleed Unsplash food photo | Phase 19 | Dramatic visual upgrade; establishes premium feel |
| UtensilsCrossed icon for missing images | Unsplash food/festival themed fallback | Phase 19 | No more "broken" looking cards; every card has a quality image |
| No Unsplash integration | Pipeline-time Unsplash image assignment | Phase 19 | Zero runtime API calls; images populated during enrichment |

**Deprecated/outdated:**
- `heroMeshGradient` style object in current HeroSection -- replaced by full-bleed photo
- UtensilsCrossed gradient placeholder pattern -- replaced by Unsplash fallback (though kept as last-resort during transition)

## Open Questions

1. **Hero Image Selection: Curated Static vs API-Fetched**
   - What we know: Static curated URLs avoid any API calls and are the safest approach. API-fetched with ISR caching (1hr revalidation) provides variety but costs 1 req/hr.
   - What's unclear: User preference for variety vs simplicity.
   - Recommendation: Start with curated static array (5 images, daily rotation). No API calls, zero risk. Can upgrade to ISR-fetched later if desired.

2. **Low-Res Source Image Detection**
   - What we know: IMG-01 says "low-res images replaced." Currently only null images have fallback. Source images from scrapers may be low-res thumbnails.
   - What's unclear: How to detect "low-res" without downloading and inspecting each image. Scrapers already run `tryUpgradeImageUrl()` to strip thumbnail suffixes.
   - Recommendation: Trust `tryUpgradeImageUrl()` for known source patterns. For genuinely broken/tiny images, add a check in the Unsplash pass: if `image_url` is set, verify it returns a 200 response with `Content-Length > 10000` (>10KB = likely not a placeholder). If not, replace with Unsplash. This adds minimal API overhead.

3. **Unsplash Attribution Placement Before Footer Exists**
   - What we know: IMG-02 success criteria says "Unsplash attribution appears in footer." Phase 20 creates the footer.
   - What's unclear: Where to show attribution in Phase 19 before the footer exists.
   - Recommendation: Show hero attribution inline on the hero image (small text, bottom-right). For card-level attribution, store `image_credit` in DB and display on detail page. Phase 20 will add global Unsplash credit to footer.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-01 | Unsplash image assigned when image_url is null | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "assigns image"` | No - Wave 0 |
| IMG-01 | image_credit stored correctly | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "stores credit"` | No - Wave 0 |
| IMG-01 | parseImageCredit parses pipe-delimited format | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "parseImageCredit"` | No - Wave 0 |
| IMG-01 | TAG_QUERIES maps food tags to search queries | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "TAG_QUERIES"` | No - Wave 0 |
| IMG-02 | getHeroImage returns valid UnsplashHeroImage | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "getHeroImage"` | No - Wave 0 |
| IMG-02 | Hero attribution URLs include UTM params | unit | `npx vitest run src/lib/__tests__/unsplash.test.ts -t "UTM"` | No - Wave 0 |
| IMG-02 | HeroSection renders full-bleed with priority image | manual-only | Visual inspection in browser | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/unsplash.test.ts` -- covers IMG-01, IMG-02 (unit tests for utility functions)
- [ ] No new framework install needed -- Vitest 4.0.18 already configured

## Sources

### Primary (HIGH confidence)
- [Unsplash API Documentation](https://unsplash.com/documentation) -- search endpoint, rate limits (50 demo / 5000 production), response format, URL parameters
- [Unsplash Attribution Guidelines](https://help.unsplash.com/en/articles/2511315-guideline-attribution) -- required format: "Photo by [Name] on Unsplash" with UTM params
- [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) -- hotlinking requirement, download tracking, production approval process
- Existing codebase: `enrich-sagre/index.ts`, `SagraCard.tsx`, `HeroSection.tsx`, `next.config.ts` -- verified current patterns

### Secondary (MEDIUM confidence)
- [Next.js Image Component Docs](https://nextjs.org/docs/app/api-reference/components/image) -- `priority`, `fill`, `sizes`, `blurDataURL` props
- [Unsplash Rate Limit Help](https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit) -- demo vs production tier details
- `.planning/research/ARCHITECTURE.md` -- project-level Unsplash integration architecture (pre-existing research from v1.4 planning)

### Tertiary (LOW confidence)
- None -- all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, uses existing patterns and verified APIs
- Architecture: HIGH - pipeline-time approach verified against Unsplash rate limits and API guidelines; builds on existing enrich-sagre pattern
- Pitfalls: HIGH - rate limits, hotlinking, download tracking all documented in official Unsplash docs; CORS and CLS are well-known web dev pitfalls

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- Unsplash API v1 is mature and rarely changes)
