# Phase 6: SEO & Polish - Research

**Researched:** 2026-03-05
**Domain:** Next.js App Router SEO (metadata, sitemap, OG images), Motion animations, loading UX
**Confidence:** HIGH

## Summary

Phase 6 covers two distinct areas: (1) SEO infrastructure -- dynamic metadata, sitemap.xml, robots.txt, and dynamic OG images for social sharing -- and (2) UI polish -- loading skeletons, empty states, and scroll/filter/shimmer animations that make the app feel premium.

The SEO work is entirely built on Next.js App Router's native metadata system. All file conventions (`generateMetadata`, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`) are stable, well-documented APIs available since Next.js 13.3+ and fully supported in the project's Next.js 15.5.12. The OG image generation uses `ImageResponse` from `next/og` (built into Next.js, no extra dependency). The animation work uses `motion` (the renamed Framer Motion package) with `"motion/react"` imports, plus Magic UI's `blur-fade` component installed via the shadcn CLI pattern.

**Primary recommendation:** Use Next.js built-in metadata APIs exclusively (no third-party SEO libraries). Use `motion` package for animations (not `framer-motion`). Use Magic UI's `BlurFade` for scroll-triggered fade-in effects. Add `loading.tsx` files per route for skeleton states.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEO-01 | generateMetadata dinamici per ogni pagina (titolo, description, OG) | Next.js `generateMetadata` function + `Metadata` type. Use `title.template` in root layout for consistent suffixing. Dynamic metadata on `/sagra/[slug]` fetches sagra data and sets title, description, openGraph fields. Supabase query is auto-memoized with `generateMetadata`. |
| SEO-02 | Sitemap.xml dinamica con tutte le sagre attive | `app/sitemap.ts` exporting async function that queries Supabase for all active sagra slugs. Returns `MetadataRoute.Sitemap` array. |
| SEO-03 | OG image dinamica per ogni sagra (1200x630, @vercel/og) | `app/(main)/sagra/[slug]/opengraph-image.tsx` using `ImageResponse` from `next/og`. Renders branded card with sagra title, location, dates. Satori engine constraints: flexbox only, no CSS grid/calc/variables. |
| SEO-04 | robots.txt | `app/robots.ts` returning `MetadataRoute.Robots` with allow all, disallow nothing, sitemap URL. |
| SEO-05 | Loading skeleton per ogni route | `loading.tsx` files in `app/(main)/`, `app/(main)/cerca/`, `app/(main)/mappa/`, `app/(main)/sagra/[slug]/`. Reuse existing `SagraCardSkeleton` and `Skeleton` components. |
| SEO-06 | Empty states per ricerche senza risultati | SearchResults already has basic empty state. Enhance with illustration/icon, actionable message. Add empty state to WeekendSection, ProvinceSection. |
| UI-04 | Animazioni premium con Motion + Magic UI (fade-in scroll, spring filters, shimmer loading) | `motion` package with `"motion/react"` imports. `BlurFade` from Magic UI for scroll fade-in. Spring transitions on filter interactions. Shimmer via existing Skeleton pulse + enhanced shimmer CSS. |
| UI-05 | Grafica modernissima -- "non sembra un template" | Combination of scroll animations (whileInView fade+slide), spring-physics filter transitions, gradient accents, staggered card reveals. Existing design system (amber-600/green-700/stone-50) maintained. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next (built-in) | 15.5.12 | `generateMetadata`, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx` | Native App Router APIs, zero additional dependencies |
| next/og (built-in) | 15.5.12 | `ImageResponse` for dynamic OG image generation | Built into Next.js, uses Satori + resvg under the hood |
| motion | 12.x (latest) | Scroll animations, spring transitions, gesture animations | Renamed from framer-motion, 30M+ monthly downloads, de-facto React animation standard |
| @magicui/blur-fade | latest | Scroll-triggered blur+fade-in effect | Shadcn-compatible copy-paste component, no runtime dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Skeleton (existing) | -- | Loading shimmer component | Already in `src/components/ui/skeleton.tsx`, used by `SagraCardSkeleton` |
| SagraCardSkeleton (existing) | -- | Card-shaped loading placeholder | Already in `src/components/sagra/SagraCardSkeleton.tsx` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| motion | CSS-only animations | Less control over spring physics, no gesture support, harder stagger orchestration |
| @magicui/blur-fade | Custom motion wrapper | BlurFade is already tuned for the exact scroll-in pattern needed, saves dev time |
| next/og ImageResponse | Static OG images | Static images can't show sagra-specific title/location/dates |

**Installation:**
```bash
pnpm add motion
pnpm dlx shadcn@latest add "https://magicui.design/r/blur-fade"
```

## Architecture Patterns

### Recommended File Structure
```
src/app/
  layout.tsx              # Add metadataBase + title.template
  robots.ts               # NEW: robots.txt generation
  sitemap.ts              # NEW: dynamic sitemap from Supabase
  (main)/
    loading.tsx            # NEW: homepage skeleton
    page.tsx               # Add generateMetadata (static)
    cerca/
      loading.tsx          # NEW: search page skeleton
      page.tsx             # Add generateMetadata (static)
    mappa/
      loading.tsx          # NEW: map page skeleton
      page.tsx             # Add generateMetadata (static)
    sagra/[slug]/
      loading.tsx          # NEW: detail page skeleton
      page.tsx             # Add generateMetadata (dynamic, fetches sagra)
      opengraph-image.tsx  # NEW: dynamic OG image generation

src/components/
  animations/
    FadeIn.tsx             # Reusable motion wrapper for scroll fade-in
    StaggerGrid.tsx        # Staggered children reveal for card grids
  home/
    WeekendSection.tsx     # Add empty state
    ProvinceSection.tsx    # Add empty state
  search/
    SearchResults.tsx      # Enhance existing empty state
```

### Pattern 1: Dynamic Metadata with Data Memoization
**What:** `generateMetadata` in `/sagra/[slug]/page.tsx` fetches the same sagra data the page needs. Next.js auto-memoizes the fetch so it only runs once.
**When to use:** Any dynamic route that needs per-item metadata.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
import type { Metadata } from "next";
import { getSagraBySlug } from "@/lib/queries/sagre";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sagra = await getSagraBySlug(slug);
  if (!sagra) return { title: "Sagra non trovata" };

  return {
    title: sagra.title,
    description: sagra.enhanced_description ?? `Scopri ${sagra.title} a ${sagra.location_text}`,
    openGraph: {
      title: sagra.title,
      description: sagra.enhanced_description ?? undefined,
      type: "article",
    },
  };
}
```

### Pattern 2: Title Template in Root Layout
**What:** Root layout sets `title.template` so all child pages get consistent branding suffix.
**When to use:** Always -- eliminates repetitive title suffixing.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nemovia.vercel.app"),
  title: {
    default: "Nemovia - Sagre del Veneto",
    template: "%s | Nemovia",
  },
  description: "Scopri tutte le sagre ed eventi gastronomici del Veneto",
  openGraph: {
    siteName: "Nemovia",
    locale: "it_IT",
    type: "website",
  },
};
```

### Pattern 3: Dynamic OG Image with Satori/ImageResponse
**What:** `opengraph-image.tsx` in dynamic route generates a branded 1200x630 PNG.
**When to use:** Per-sagra social sharing cards.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
import { ImageResponse } from "next/og";
import { getSagraBySlug } from "@/lib/queries/sagre";

export const alt = "Sagra del Veneto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sagra = await getSagraBySlug(slug);

  return new ImageResponse(
    (
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #fef3c7, #ecfccb)",
        padding: "60px",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, fontWeight: 700, color: "#292524" }}>
            {sagra?.title ?? "Sagra"}
          </div>
          <div style={{ fontSize: 32, color: "#78716c", marginTop: 16 }}>
            {sagra?.location_text}{sagra?.province ? ` (${sagra.province})` : ""}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 24, color: "#d97706" }}>nemovia.vercel.app</div>
          <div style={{ fontSize: 28, color: "#78716c" }}>
            {sagra?.start_date ?? ""}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

### Pattern 4: Route-Level Loading Skeletons
**What:** `loading.tsx` files automatically wrap the page in a Suspense boundary.
**When to use:** Every route that fetches data server-side.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/loading
import { SagraCardSkeleton } from "@/components/sagra/SagraCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <Skeleton className="h-40 w-full rounded-2xl" />
      {/* Quick filters skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
        ))}
      </div>
      {/* Card grid skeleton */}
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SagraCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

### Pattern 5: Motion Scroll Fade-In
**What:** Elements animate in when they enter the viewport.
**When to use:** Card grids, section headings, content blocks.
**Example:**
```typescript
// Source: https://motion.dev/docs/react-scroll-animations
"use client";
import { motion } from "motion/react";

export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

### Pattern 6: Staggered Grid Animation
**What:** Cards reveal one-by-one with increasing delay.
**When to use:** SagraGrid when rendering multiple cards.
**Example:**
```typescript
"use client";
import { motion } from "motion/react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", damping: 20 } },
};

export function StaggerGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className="grid gap-4"
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={item}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
```

### Anti-Patterns to Avoid
- **Don't use `framer-motion` package:** The library has been renamed to `motion`. Import from `"motion/react"`, not `"framer-motion"`.
- **Don't add `display: flex` implicitly in OG images:** Satori requires explicit `display: "flex"` on every container element. Missing this causes silent rendering failures.
- **Don't use CSS grid, calc(), or CSS variables in OG images:** Satori ignores these silently -- your OG image will look broken with no error.
- **Don't animate server components:** Motion components need `"use client"`. Wrap server component content in a client animation wrapper, don't convert server components to client.
- **Don't set `viewport={{ once: false }}` for scroll animations:** This causes animations to replay every scroll, creating a janky, unpolished feel. Use `once: true`.
- **Don't skip `metadataBase` in root layout:** Without it, relative OG image URLs resolve incorrectly and social sharing breaks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sitemap generation | Custom XML string builder | `app/sitemap.ts` with `MetadataRoute.Sitemap` | Next.js handles XML serialization, encoding, proper headers |
| Robots.txt | Static file or custom route handler | `app/robots.ts` with `MetadataRoute.Robots` | Type-safe, auto-served, linked to sitemap |
| OG image rendering | Canvas-based image generation | `ImageResponse` from `next/og` | Handles font loading, edge-compatible, JSX-based layout |
| Loading states | Manual Suspense boundaries everywhere | `loading.tsx` file convention | Next.js auto-wraps page in Suspense, zero boilerplate |
| Scroll-triggered animations | IntersectionObserver + manual state | `motion.div` with `whileInView` | Handles threshold, cleanup, animation orchestration |
| Blur fade-in effect | Custom motion+CSS blur combination | Magic UI `BlurFade` component | Pre-tuned blur+opacity+translate combination |

**Key insight:** Next.js 15 provides first-class file conventions for ALL SEO concerns (metadata, sitemap, robots, OG images, loading states). Using these conventions means zero third-party SEO dependencies and full TypeScript support.

## Common Pitfalls

### Pitfall 1: Satori CSS Limitations in OG Images
**What goes wrong:** OG images render as blank or broken layout because unsupported CSS is silently ignored.
**Why it happens:** Satori (the engine behind `ImageResponse`) only supports flexbox layout. No CSS grid, no `calc()`, no CSS custom properties (`var(--x)`), no `position: relative/absolute` nesting depth.
**How to avoid:** Use only inline `style` objects with flexbox properties. Every container must have `display: "flex"`. Test OG images locally by visiting `/sagra/[slug]/opengraph-image` in the browser during development.
**Warning signs:** OG image preview shows blank white rectangle or elements overlapping.

### Pitfall 2: Missing metadataBase Breaks OG Images
**What goes wrong:** Social media crawlers get relative URLs for OG images and can't fetch them.
**Why it happens:** Without `metadataBase` in root layout, Next.js can't compose absolute URLs for file-based metadata (like `opengraph-image.tsx`).
**How to avoid:** Set `metadataBase: new URL("https://nemovia.vercel.app")` in `app/layout.tsx` metadata. Use `VERCEL_URL` env var for preview deployments.
**Warning signs:** Twitter/Facebook debugger shows no image or broken image icon.

### Pitfall 3: Motion "use client" Requirement
**What goes wrong:** Build error or hydration mismatch when using `motion.div` in a server component.
**Why it happens:** Motion components use React hooks internally and must run in the browser.
**How to avoid:** Create thin client wrapper components (e.g., `FadeIn.tsx`, `StaggerGrid.tsx`) with `"use client"` directive. Pass server-rendered children through them.
**Warning signs:** "useState is not a function" or hydration errors in console.

### Pitfall 4: Font Loading in OG Images on Edge Runtime
**What goes wrong:** Custom fonts don't render in OG images deployed to Vercel Edge.
**Why it happens:** Edge Runtime can't read local files with `readFile`. Fonts must be fetched at runtime or loaded from the local filesystem using `process.cwd()` on Node.js runtime.
**How to avoid:** For simplicity, use the default sans-serif font (no custom font needed for MVP). If a custom font is required, use `readFile` with `process.cwd()` path on Node.js runtime (not Edge).
**Warning signs:** OG image shows system font instead of expected font.

### Pitfall 5: Supabase Query in sitemap.ts Not Refreshing
**What goes wrong:** Sitemap shows stale data because the route handler is cached.
**Why it happens:** `sitemap.ts` is a special Route Handler that is cached by default.
**How to avoid:** Add `export const revalidate = 3600` (1 hour) to the sitemap file so it refreshes periodically.
**Warning signs:** New sagre don't appear in sitemap for days.

### Pitfall 6: Animation Performance on Mobile
**What goes wrong:** Scroll animations cause jank on low-end mobile devices.
**Why it happens:** Too many simultaneous animations, complex spring calculations, or large DOM subtrees being animated.
**How to avoid:** Use `viewport={{ once: true }}` to fire animations only once. Keep stagger groups small (8-12 items max). Prefer opacity+transform animations (GPU-accelerated). Avoid animating layout properties (width, height, padding).
**Warning signs:** Dropped frames during scroll, visible stutter on homepage.

## Code Examples

### Dynamic Sitemap with Supabase Query
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
// File: app/sitemap.ts
import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nemovia.vercel.app";

export const revalidate = 3600; // Refresh every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: sagre } = await supabase
    .from("sagre")
    .select("slug, updated_at")
    .eq("is_active", true);

  const sagreEntries: MetadataRoute.Sitemap = (sagre ?? []).map((sagra) => ({
    url: `${BASE_URL}/sagra/${sagra.slug}`,
    lastModified: new Date(sagra.updated_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/cerca`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/mappa`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    ...sagreEntries,
  ];
}
```

### robots.ts
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
// File: app/robots.ts
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nemovia.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

### Empty State Component
```typescript
// File: src/components/ui/EmptyState.tsx
import { UtensilsCrossed } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        {icon ?? <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}
```

### BlurFade Usage (Magic UI)
```typescript
// After installing: pnpm dlx shadcn@latest add "https://magicui.design/r/blur-fade"
"use client";
import BlurFade from "@/components/magicui/blur-fade";

export function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <BlurFade delay={delay} inView>
      {children}
    </BlurFade>
  );
}
```

### Spring Filter Transition
```typescript
"use client";
import { motion, AnimatePresence } from "motion/react";

// Wrap filter chip selections with spring animation
export function AnimatedBadge({ children, isVisible }: { children: React.ReactNode; isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package | `motion` package, import from `"motion/react"` | 2024-2025 | Must use new package name and import path |
| Manual `<meta>` tags in `<head>` | `generateMetadata` + `Metadata` type | Next.js 13.2+ (stable) | Type-safe, auto-merging, streaming support |
| `/api/og` route for OG images | `opengraph-image.tsx` file convention | Next.js 13.3+ | Auto-linked to metadata, typed size/alt exports |
| Static `sitemap.xml` file | `sitemap.ts` with `MetadataRoute.Sitemap` | Next.js 13.3+ | Dynamic, type-safe, auto-revalidation |
| `viewport` in metadata object | Separate `viewport` export / `generateViewport` | Next.js 14+ | viewport deprecated from metadata, use separate export |
| `ImageResponse` from `@vercel/og` | `ImageResponse` from `next/og` | Next.js 14+ (App Router) | Built-in, no separate package needed |

**Deprecated/outdated:**
- `framer-motion`: Renamed to `motion`. Old package still works but no longer maintained under old name.
- `@vercel/og`: Only needed for Pages Router. App Router uses `import { ImageResponse } from "next/og"`.
- `themeColor` / `colorScheme` in metadata: Deprecated in Next.js 14, use `generateViewport` instead (this project already does this correctly).

## Open Questions

1. **Production domain URL**
   - What we know: Project will deploy to Vercel, likely `nemovia.vercel.app`
   - What's unclear: Final custom domain, if any
   - Recommendation: Use `NEXT_PUBLIC_SITE_URL` env var with fallback to `https://nemovia.vercel.app`. This is needed for `metadataBase`, sitemap URLs, and robots.txt sitemap reference.

2. **Custom font in OG images**
   - What we know: Project uses Inter font (loaded via `next/font/google`)
   - What's unclear: Whether the OG image needs the same Inter font or if system sans-serif is acceptable
   - Recommendation: Skip custom font in OG images for MVP. System sans-serif looks clean enough. Adding Inter requires downloading the `.ttf` file to `assets/` folder and loading it with `readFile` in the OG image function.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEO-01 | generateMetadata returns correct title/description/OG for each page | manual-only | Visual inspection via `next build` + `curl` headers | N/A |
| SEO-02 | sitemap.xml lists all active sagre with correct URLs | smoke | `pnpm test -- src/app/sitemap.test.ts -x` | Wave 0 |
| SEO-03 | OG image renders 1200x630 PNG with sagra title | manual-only | Visit `/sagra/[slug]/opengraph-image` in browser | N/A |
| SEO-04 | robots.txt allows all, references sitemap | unit | `pnpm test -- src/app/robots.test.ts -x` | Wave 0 |
| SEO-05 | Loading skeletons render for each route | manual-only | Visual inspection during dev navigation | N/A |
| SEO-06 | Empty states display when no results match | manual-only | Visual inspection with empty search filters | N/A |
| UI-04 | Animations present (fade-in, spring, shimmer) | manual-only | Visual inspection during scroll/interaction | N/A |
| UI-05 | App feels premium, non-template | manual-only | Subjective visual review | N/A |

### Sampling Rate
- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test && pnpm build`
- **Phase gate:** Full build green + manual visual inspection of all routes

### Wave 0 Gaps
- [ ] `src/app/sitemap.test.ts` -- verify sitemap function returns expected URL structure
- [ ] `src/app/robots.test.ts` -- verify robots function returns correct rules and sitemap URL
- [ ] Most SEO and UI-polish requirements are visual/manual-only by nature (metadata rendering, OG image appearance, animation smoothness). A `pnpm build` without errors serves as the primary automated gate.

## Sources

### Primary (HIGH confidence)
- [Next.js generateMetadata docs](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - v16.1.6, full API reference for metadata fields, title template, openGraph, merging behavior
- [Next.js opengraph-image docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) - v16.1.6, ImageResponse usage, size/alt/contentType exports, params handling
- [Next.js sitemap.xml docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) - v16.1.6, MetadataRoute.Sitemap type, dynamic generation, revalidation
- [Next.js robots.txt docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots) - v16.1.6, MetadataRoute.Robots type, user agent customization
- [Next.js loading.js docs](https://nextjs.org/docs/app/api-reference/file-conventions/loading) - automatic Suspense wrapping with loading file convention

### Secondary (MEDIUM confidence)
- [Motion npm package](https://www.npmjs.com/package/motion) - v12.35.0, verified install command and import path `"motion/react"`
- [Motion scroll animations docs](https://motion.dev/docs/react-scroll-animations) - whileInView, viewport config, scroll-triggered patterns
- [Magic UI blur-fade](https://magicui.design/docs/components/blur-fade) - shadcn CLI install pattern for blur-fade component
- [Motion transitions docs](https://motion.dev/docs/react-transitions) - spring type, damping/stiffness config

### Tertiary (LOW confidence)
- Satori CSS limitations gathered from multiple GitHub issues and blog posts -- constraints verified against official ImageResponse docs but edge cases may exist

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All APIs are stable Next.js built-ins, verified against official docs (v16.1.6)
- Architecture: HIGH - File conventions are well-documented, patterns verified against official examples
- Pitfalls: HIGH - Satori limitations and metadataBase issues are well-documented across multiple sources
- Animations: MEDIUM - motion package API is stable but Magic UI blur-fade component integration untested in this specific project

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable APIs, 30-day validity)
