# Phase 1: Foundation & Design System - Research

**Researched:** 2026-03-04
**Domain:** Next.js project scaffolding, Supabase PostGIS setup, Tailwind v4 + shadcn/ui design system, mobile-first layout, Vercel deployment
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure for Nemovia: a Next.js 15 app deployed on Vercel, connected to a Supabase database with PostGIS and pg_cron extensions enabled, wrapped in a mobile-first layout shell with the brand design system applied. No data pipeline or feature logic is built in this phase -- the goal is a deployable skeleton that later phases build upon.

The tech stack is fully decided (Next.js 15, Tailwind v4, shadcn/ui, Supabase with PostGIS, Vercel). Research focused on the exact setup procedures, configuration patterns, and CSS variable mapping needed to implement the brand colors (amber-600 primary, olive/green-700 accent, stone-50 background) within the shadcn/ui theming system using Tailwind v4's `@theme inline` directive.

**Primary recommendation:** Scaffold the project with `pnpm create next-app@15`, initialize shadcn/ui with Tailwind v4, customize the theme variables in `globals.css` to use the Nemovia brand palette, create the Supabase project with PostGIS + pg_cron extensions via SQL, build a mobile BottomNav layout, and deploy to Vercel from the Git repository.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Design mobile-first, perfetto su iPhone | Mobile-first layout shell pattern, BottomNav fixed positioning, viewport meta, Tailwind responsive breakpoints (mobile-first by default) |
| UI-02 | BottomNav mobile con tab Home/Cerca/Mappa | BottomNav component pattern with fixed bottom positioning, lucide-react icons, Next.js App Router navigation via usePathname |
| UI-03 | Colori brand: primary amber-600, accent olive/green-700, bg stone-50 | Exact OKLCH values from Tailwind v4 palette, shadcn/ui CSS variable mapping, @theme inline configuration |
</phase_requirements>

## Standard Stack

### Core (Phase 1 Only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Full-stack React framework | Stable, Vercel-native, App Router for server components. Use 15.x not 16.x for battle-tested ecosystem. |
| React | 19.x | UI rendering | Required by Next.js 15 |
| TypeScript | 5.x | Type safety | Non-negotiable for the project |
| Tailwind CSS | 4.x | Utility-first CSS | shadcn/ui fully supports v4. Uses new `@theme` directive, CSS-first configuration, no tailwind.config.ts needed. |
| shadcn/ui | latest (CLI) | Component library | Copy-paste components, fully customizable. Cards, badges, buttons, skeleton -- needed for future phases. |
| tw-animate-css | latest | CSS animations for shadcn | Replaces deprecated `tailwindcss-animate`. Installed by default with shadcn/ui on Tailwind v4. |
| @supabase/supabase-js | 2.98.x | Supabase client | Database queries from Next.js |
| @supabase/ssr | latest | SSR helpers for Supabase | Server-side Supabase client in App Router |
| lucide-react | latest | Icons | Default icon set for shadcn/ui, used for BottomNav tab icons |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion | 12.x | Animation engine | Not needed in Phase 1 but install now since Magic UI depends on it (Phase 6) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 15 | Next.js 16 | 16 has faster builds but less battle-tested. Upgrade post-MVP. |
| Tailwind v4 | Tailwind v3 | v4 is production-ready with shadcn/ui. No reason to use v3 for new projects. |
| pnpm | npm/yarn | pnpm is faster, stricter on dependencies. Team decision -- already established. |

### Installation

```bash
# Step 1: Scaffold Next.js 15 project
pnpm create next-app@15 nemovia --typescript --tailwind --eslint --app --src-dir --use-pnpm

# Step 2: Install core dependencies for Phase 1
pnpm add @supabase/supabase-js @supabase/ssr lucide-react

# Step 3: Initialize shadcn/ui (handles tw-animate-css, Tailwind v4 config)
pnpm dlx shadcn@latest init

# Step 4: Add base shadcn components needed for layout shell
pnpm dlx shadcn@latest add button card badge skeleton separator
```

**Note:** Do NOT install cheerio, leaflet, @google/genai, date-fns, nuqs, or other libraries yet. They are for later phases.

## Architecture Patterns

### Recommended Project Structure (Phase 1)

```
src/
  app/
    layout.tsx              # Root layout (fonts, metadata, Supabase provider)
    (main)/
      layout.tsx            # Main layout with BottomNav
      page.tsx              # Homepage placeholder
    cerca/
      page.tsx              # Search page placeholder
    mappa/
      page.tsx              # Map page placeholder
    globals.css             # Tailwind imports + brand theme variables
  components/
    layout/
      BottomNav.tsx          # Mobile bottom navigation
      MobileShell.tsx        # Mobile viewport wrapper (optional)
  lib/
    supabase/
      server.ts             # createServerClient() for Server Components
      client.ts             # createBrowserClient() for Client Components
  types/
    database.ts             # Supabase generated types (placeholder)
```

### Pattern 1: Mobile-First BottomNav Layout

**What:** A fixed-bottom navigation bar visible on mobile viewports with three tabs: Home, Cerca (Search), Mappa (Map). Each tab uses an icon and label. The active tab is highlighted with the primary brand color.

**When:** Always rendered in the `(main)/layout.tsx` route group.

**Example:**

```typescript
// src/components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/cerca", label: "Cerca", icon: Search },
  { href: "/mappa", label: "Mappa", icon: Map },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe">
      <div className="flex h-16 items-center justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

```typescript
// src/app/(main)/layout.tsx
import { BottomNav } from "@/components/layout/BottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto max-w-lg px-4 py-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

### Pattern 2: shadcn/ui Brand Theme with Tailwind v4

**What:** Map the Nemovia brand colors (amber-600 primary, green-700 accent, stone-50 background) to shadcn/ui CSS variables using the `@theme inline` directive.

**When:** Configured once in `globals.css`, applied everywhere via shadcn/ui utility classes.

**Brand Color Values (from Tailwind v4 OKLCH palette):**

| Color Name | Tailwind Token | OKLCH Value | Hex Approx |
|------------|---------------|-------------|------------|
| Primary (amber-600) | `amber-600` | `oklch(0.666 0.179 58.318)` | #D97706 |
| Primary foreground | white | `oklch(1 0 0)` | #FFFFFF |
| Accent (green-700) | `green-700` | `oklch(0.527 0.154 150.069)` | #15803D |
| Accent foreground | white | `oklch(1 0 0)` | #FFFFFF |
| Background (stone-50) | `stone-50` | `oklch(0.985 0.001 106.423)` | #FAFAF9 |
| Foreground (stone-900) | `stone-900` | `oklch(0.216 0.006 56.043)` | #1C1917 |

**Example globals.css:**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;

  /* Brand: Nemovia -- Sagre del Veneto */
  --background: oklch(0.985 0.001 106.423);       /* stone-50 */
  --foreground: oklch(0.216 0.006 56.043);         /* stone-900 */

  --card: oklch(1 0 0);                            /* white */
  --card-foreground: oklch(0.216 0.006 56.043);    /* stone-900 */

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.216 0.006 56.043);

  --primary: oklch(0.666 0.179 58.318);            /* amber-600 */
  --primary-foreground: oklch(1 0 0);              /* white */

  --secondary: oklch(0.970 0.001 106.424);         /* stone-100 */
  --secondary-foreground: oklch(0.216 0.006 56.043);

  --muted: oklch(0.970 0.001 106.424);             /* stone-100 */
  --muted-foreground: oklch(0.553 0.013 58.071);   /* stone-500 */

  --accent: oklch(0.527 0.154 150.069);            /* green-700 */
  --accent-foreground: oklch(1 0 0);               /* white */

  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.923 0.003 48.717);             /* stone-200 */
  --input: oklch(0.923 0.003 48.717);              /* stone-200 */
  --ring: oklch(0.666 0.179 58.318);               /* amber-600 (focus ring = primary) */

  --chart-1: oklch(0.666 0.179 58.318);            /* amber-600 */
  --chart-2: oklch(0.527 0.154 150.069);           /* green-700 */
  --chart-3: oklch(0.553 0.013 58.071);            /* stone-500 */
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### Pattern 3: Supabase Client Factory for Next.js App Router

**What:** Separate client factories for server components and client components using `@supabase/ssr`.

**When:** Every Supabase interaction in the Next.js app.

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component -- the supabase middleware
            // will handle cookie persistence
          }
        },
      },
    }
  );
}
```

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Pattern 4: Supabase Database Schema (Foundation)

**What:** Create the core `sagre` table with PostGIS geography column, enable required extensions, and set up pg_cron. This is the minimal schema for Phase 1 -- later phases add scraper_configs and geocode_cache tables.

**SQL Migration:**

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Core sagre table
CREATE TABLE IF NOT EXISTS public.sagre (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location_text TEXT NOT NULL,
  location extensions.geography(POINT, 4326),
  province TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  enhanced_description TEXT,
  food_tags TEXT[],
  feature_tags TEXT[],
  image_url TEXT,
  source_url TEXT,
  is_free BOOLEAN,
  price_info TEXT,
  status TEXT DEFAULT 'pending_geocode',
  content_hash TEXT NOT NULL,
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS sagre_location_idx ON public.sagre USING GIST (location);
CREATE INDEX IF NOT EXISTS sagre_status_idx ON public.sagre (status);
CREATE INDEX IF NOT EXISTS sagre_dates_idx ON public.sagre (start_date, end_date);
CREATE INDEX IF NOT EXISTS sagre_province_idx ON public.sagre (province);
CREATE INDEX IF NOT EXISTS sagre_slug_idx ON public.sagre (slug);
CREATE UNIQUE INDEX IF NOT EXISTS sagre_content_source_idx ON public.sagre (content_hash, source_id);

-- Enable Row Level Security (read-only public access)
ALTER TABLE public.sagre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.sagre
  FOR SELECT
  USING (true);
```

**CRITICAL PostGIS note:** Use `extensions.geography(POINT, 4326)` (prefixed with the `extensions` schema) when the PostGIS extension is installed in the `extensions` schema (Supabase default). PostGIS functions must also be schema-prefixed: `extensions.st_dwithin(...)`, `extensions.st_makepoint(...)`, etc.

### Anti-Patterns to Avoid

- **Storing lat/lng as separate FLOAT columns:** Use PostGIS `geography(POINT)` with GIST index. Separate columns cannot use spatial indexes.
- **Installing all dependencies upfront:** Only install what Phase 1 needs. Adding cheerio, leaflet, @google/genai etc. now bloats the project.
- **Using tailwind.config.ts with Tailwind v4:** Tailwind v4 is CSS-first. Use `@theme` directives in `globals.css`, not a JS config file.
- **Hardcoding color hex values:** Use shadcn/ui CSS variables (`bg-primary`, `text-accent-foreground`) instead of `bg-amber-600` directly. This enables consistent theming.
- **Skipping RLS on the sagre table:** Even for a read-only MVP, enable RLS with a permissive SELECT policy. Adding RLS later is painful.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component library | Custom buttons/cards/badges | shadcn/ui | 50+ accessible, themed components. Copy-paste, fully customizable. |
| CSS theme system | Custom CSS variable scheme | shadcn/ui theming + Tailwind v4 @theme | Background/foreground convention, dark mode support, component integration |
| Supabase client setup | Manual fetch to Supabase REST API | @supabase/ssr + @supabase/supabase-js | Cookie handling, type safety, server/client separation |
| Spatial queries | Haversine formula in JS | PostGIS geography type + GIST index | Earth-curvature-aware, index-backed, sub-100ms queries |
| Icon system | SVG imports or custom icons | lucide-react | shadcn/ui default, tree-shakeable, 1500+ icons |

**Key insight:** Phase 1 is entirely about wiring together existing tools correctly. Zero custom logic is needed -- only correct configuration and standard patterns.

## Common Pitfalls

### Pitfall 1: PostGIS Schema Prefix

**What goes wrong:** Queries fail with `function st_dwithin does not exist` errors.
**Why it happens:** Supabase installs PostGIS in the `extensions` schema, not the public schema. Direct calls like `ST_DWithin(...)` fail because they look in the `public` schema.
**How to avoid:** Always prefix PostGIS functions with `extensions.`: `extensions.st_dwithin(...)`, `extensions.st_makepoint(...)`.
**Warning signs:** Any PostGIS function call that doesn't include the schema prefix.

### Pitfall 2: PostGIS Coordinate Order

**What goes wrong:** All markers appear in the wrong location on the map (often in the ocean).
**Why it happens:** PostGIS uses (longitude, latitude) order, but most people think (latitude, longitude).
**How to avoid:** Always use `ST_MakePoint(lng, lat)`, never `ST_MakePoint(lat, lng)`. Document this in code comments.
**Warning signs:** Test with known Veneto coordinates (e.g., Padova: lat 45.4064, lng 11.8768) and verify on a map.

### Pitfall 3: Tailwind v4 Config Confusion

**What goes wrong:** Custom colors or theme changes don't work; error about missing tailwind.config.ts.
**Why it happens:** Tailwind v4 is CSS-first. The `tailwind.config.ts` file is only for v3 compatibility mode. New projects should use `@theme` in CSS.
**How to avoid:** Configure everything in `globals.css` using `@theme inline`. Do not create `tailwind.config.ts`.
**Warning signs:** Any reference to `tailwind.config.ts` or `tailwind.config.js` in a Tailwind v4 project.

### Pitfall 4: Supabase Environment Variable Naming

**What goes wrong:** Supabase client fails silently, returns null data.
**Why it happens:** Using `SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL`. Client-side code needs the `NEXT_PUBLIC_` prefix to access env vars.
**How to avoid:** Always use:
- `NEXT_PUBLIC_SUPABASE_URL` -- accessible on both server and client
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- accessible on both server and client
- `SUPABASE_SERVICE_ROLE_KEY` -- server-only, never exposed to client
**Warning signs:** Empty response from Supabase queries without errors.

### Pitfall 5: Missing pb-safe for BottomNav on iPhone

**What goes wrong:** BottomNav overlaps with the iPhone home indicator bar.
**Why it happens:** iOS Safari has a safe area at the bottom for the home indicator. Standard bottom padding doesn't account for it.
**How to avoid:** Add `pb-safe` class (or `pb-[env(safe-area-inset-bottom)]`) to the BottomNav container. Also set `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` in the root layout.
**Warning signs:** Test on a physical iPhone or Safari simulator.

### Pitfall 6: Forgetting pb-20 on Main Content

**What goes wrong:** Content at the bottom of the page is hidden behind the fixed BottomNav.
**Why it happens:** Fixed-position elements are removed from the document flow. Content flows behind them.
**How to avoid:** Add `pb-20` (or equivalent) to the main content container to ensure content doesn't get clipped.
**Warning signs:** Last items in lists or page sections are invisible.

## Code Examples

### Vercel Deployment Configuration

No `vercel.json` is needed for basic Next.js deployment. Vercel auto-detects Next.js projects. Just:

1. Push to GitHub
2. Import project in Vercel dashboard
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Root Layout with Mobile Viewport

```typescript
// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nemovia - Sagre del Veneto",
  description: "Scopri tutte le sagre ed eventi gastronomici del Veneto",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

### Placeholder Page

```typescript
// src/app/(main)/page.tsx
export default function HomePage() {
  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-bold text-foreground">
        Scopri le sagre del Veneto
      </h1>
      <p className="text-muted-foreground">
        Trova sagre ed eventi gastronomici nella tua zona.
      </p>
      {/* Placeholder -- real content comes in Phase 4 */}
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 rounded-lg bg-card border border-border animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
```

### Environment Variables (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
```

### Supabase SQL: Enable pg_cron

```sql
-- pg_cron is typically pre-installed on Supabase but may need enabling
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA cron;

-- Verify it works
SELECT cron.schedule(
  'test-cron',
  '0 0 * * *',
  $$SELECT 1$$
);

-- Clean up test
SELECT cron.unschedule('test-cron');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.ts (JS) | @theme in CSS (CSS-first) | Tailwind v4 (2025) | No JS config file needed. All theming in globals.css. |
| HSL color format in shadcn/ui | OKLCH color format | shadcn/ui 2025 update | Perceptually uniform colors. Variables now store full oklch() values. |
| tailwindcss-animate | tw-animate-css | Late 2024 | Old package deprecated. shadcn/ui init auto-installs replacement. |
| @layer base { :root } | :root + @theme inline | Tailwind v4 + shadcn/ui | Simpler variable resolution, no layer ordering issues. |
| framer-motion | motion (package) | Mid 2024 | Package renamed. Import from `motion` not `framer-motion`. |

**Deprecated/outdated:**
- `tailwindcss-animate`: Replaced by `tw-animate-css`
- `tailwind.config.ts` for new projects: Use CSS-first `@theme` with Tailwind v4
- HSL color format in shadcn/ui variables: OKLCH is now the default

## Open Questions

1. **Next.js 15 exact latest minor version**
   - What we know: 15.x is stable, 15.5+ has stable Turbopack
   - What's unclear: Whether to pin to a specific minor (e.g., 15.5.3) or use latest
   - Recommendation: Use `@15` in create-next-app to get the latest 15.x. Pin in package.json after install.

2. **Supabase pg_cron free tier limits**
   - What we know: pg_cron is available on free tier. Max 8 concurrent jobs recommended. Each job should run under 10 minutes.
   - What's unclear: Whether there is a hard limit on number of scheduled jobs on free tier
   - Recommendation: Start with 1-2 jobs. Phase 1 only needs to enable the extension, not schedule jobs.

3. **Dark mode for Nemovia**
   - What we know: shadcn/ui supports dark mode via `.dark` class. The brand palette is light-themed.
   - What's unclear: Whether the project needs dark mode
   - Recommendation: Skip dark mode for MVP. The brand identity is warm/light (amber, stone). Add dark mode in v2 if needed. Configure only `:root` theme, not `.dark` theme.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme) - @theme and @theme inline syntax
- [Tailwind CSS v4 Colors](https://tailwindcss.com/docs/customizing-colors) - OKLCH values for amber, green, stone
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) - CSS variable migration to v4 format
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) - Complete CSS variable list, background/foreground convention
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) - Setup commands
- [Supabase PostGIS Documentation](https://supabase.com/docs/guides/database/extensions/postgis) - Extension setup, geography type, RPC pattern
- [Supabase Cron Documentation](https://supabase.com/docs/guides/cron) - pg_cron setup and scheduling
- [Supabase Edge Functions Scheduling](https://supabase.com/docs/guides/functions/schedule-functions) - pg_cron + pg_net to invoke Edge Functions
- [Supabase SSR Client Setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client) - createServerClient / createBrowserClient
- [Next.js create-next-app CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app) - CLI flags
- [Next.js Installation Guide](https://nextjs.org/docs/app/getting-started/installation) - Setup process

### Secondary (MEDIUM confidence)
- [Vercel Next.js Deployment](https://vercel.com/docs/frameworks/full-stack/nextjs) - Auto-detection, environment variables
- [Flowbite Bottom Navigation](https://flowbite.com/docs/components/bottom-navigation/) - Bottom nav pattern reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries well-documented, versions verified against official sources
- Architecture: HIGH - Patterns sourced from official Supabase and Next.js docs, verified with current shadcn/ui v4 guides
- Pitfalls: HIGH - PostGIS coordinate order and schema prefix are well-documented issues; Tailwind v4 migration is verified

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days -- stable ecosystem, no breaking changes expected)
