# Phase 11: Bug Fixes + Foundation - Research

**Researched:** 2026-03-07
**Domain:** UX bug fixes, responsive layout foundation, accessibility (reduced-motion, focus indicators)
**Confidence:** HIGH

## Summary

Phase 11 addresses four concrete UX bugs and two accessibility requirements that together form the foundation for all subsequent v1.2 animation/polish work. The bugs are straightforward fixes in existing components: the BackButton already exists and works (BUG-01 is already resolved in current code), the image placeholder already exists on the detail page (BUG-02 is also already resolved), the Cerca page default behavior needs the query to run without filters pre-applied (BUG-03), and the main layout's `max-w-lg` (512px) constraint must be widened for desktop (BUG-04).

The accessibility requirements are critical because they gate Phase 13 entirely -- all animations added later must respect `prefers-reduced-motion`. Motion (the animation library already in the stack) provides `MotionConfig` with a `reducedMotion="user"` prop that automatically disables transform/layout animations when the OS setting is enabled. For focus indicators, the existing Shadcn/UI components already include `focus-visible:ring` styles on buttons, inputs, badges, and selects -- but custom interactive elements (BackButton, QuickFilters chips, BottomNav links, province links) lack visible focus styles.

**Primary recommendation:** Wrap the app in `<MotionConfig reducedMotion="user">` at the root layout, widen the main container from `max-w-lg` to a responsive `max-w-7xl`, audit all interactive elements for `focus-visible` styles, and fix the Cerca page default filter state.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | Back button on sagra detail page | BackButton component already exists at `src/components/detail/BackButton.tsx` and is rendered in SagraDetail. Already working -- verify only. |
| BUG-02 | Image placeholder on sagra detail page when no image | Placeholder already exists in SagraDetail (gradient + UtensilsCrossed icon, lines 47-49). Already working -- verify only. |
| BUG-03 | Cerca page shows all sagre by default with "TUTTE" pre-selected | SearchFilters uses nuqs `parseAsString` for provincia (defaults to null/undefined). When provincia is null, the query returns all sagre. The issue is likely that users see "Tutte le province" placeholder text but don't realize results are already showing. Verify actual behavior. |
| BUG-04 | Desktop content fills available screen width (not squeezed into 512px) | Main layout at `src/app/(main)/layout.tsx` line 10 uses `max-w-lg` (512px). Must widen to responsive breakpoints. |
| A11Y-01 | prefers-reduced-motion: no animations when OS setting enabled | Use Motion's `MotionConfig reducedMotion="user"` wrapper. Also add CSS `motion-reduce:` variants for non-Motion animations (e.g., `animate-pulse` on skeletons, `animate-spin` on loader). |
| A11Y-02 | Visible focus indicators on all interactive elements for keyboard navigation | Shadcn components (Button, Input, Badge, Select) already have `focus-visible:ring` styles. Custom elements (BackButton, BottomNav links, QuickFilters chips, ProvinceSection links, SagraCard links) need `focus-visible:ring` or `focus-visible:outline` added. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | ^12.35.0 | Animation library (FadeIn, StaggerGrid) | Already in use, provides MotionConfig for reduced-motion |
| tailwindcss | ^4 | Utility-first CSS framework | Already in use, provides `motion-reduce:` and `focus-visible:` variants |
| shadcn/ui | ^3.8.5 | UI component library | Already in use, components have built-in focus-visible styles |
| nuqs | ^2.8.9 | URL state management for search filters | Already in use for SearchFilters |
| lucide-react | ^0.577.0 | Icon library | Already in use for BackButton arrow, UtensilsCrossed placeholder |

### Supporting
No new libraries needed. All fixes use existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MotionConfig reducedMotion="user" | Custom useReducedMotion hook per component | MotionConfig is simpler -- one wrapper vs. per-component logic |
| Tailwind motion-reduce: variants | @media (prefers-reduced-motion) in globals.css | Tailwind variants are more maintainable and collocated with component classes |
| focus-visible:ring-ring/50 | Custom CSS focus styles | Shadcn already uses ring pattern -- consistency matters |

## Architecture Patterns

### Current Layout Structure
```
src/app/layout.tsx            -- Root: html, body, NuqsAdapter, font
src/app/(main)/layout.tsx     -- Main: max-w-lg container + BottomNav
src/app/(main)/page.tsx       -- Home
src/app/(main)/cerca/page.tsx -- Search
src/app/(main)/mappa/page.tsx -- Map
src/app/(main)/sagra/[slug]/page.tsx -- Detail
```

### Pattern 1: MotionConfig Wrapper at Root Layout
**What:** Wrap the entire app in `<MotionConfig reducedMotion="user">` so ALL Motion animations automatically respect the OS preference.
**When to use:** Always -- this is a one-time setup that applies globally.
**Example:**
```typescript
// src/app/layout.tsx
import { MotionConfig } from "motion/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${inter.className} antialiased`}>
        <MotionConfig reducedMotion="user">
          <NuqsAdapter>{children}</NuqsAdapter>
        </MotionConfig>
      </body>
    </html>
  );
}
```
**Note:** MotionConfig is a client component. Since it wraps NuqsAdapter (already client-side), this pattern works. However, the root layout is a Server Component. The solution is either: (a) create a `Providers.tsx` client component that wraps both, or (b) add `"use client"` to a dedicated wrapper. Option (a) is cleaner.

**CRITICAL CAVEAT:** `MotionConfig` is a React Context provider, which means it requires `"use client"`. The root layout.tsx is a Server Component. The standard Next.js App Router pattern is to create a `Providers` component:

```typescript
// src/components/Providers.tsx
"use client";

import { MotionConfig } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <NuqsAdapter>{children}</NuqsAdapter>
    </MotionConfig>
  );
}
```

### Pattern 2: Responsive Container Widening
**What:** Replace `max-w-lg` (512px) with a responsive max-width that scales with viewport.
**When to use:** BUG-04 fix.
**Example:**
```typescript
// src/app/(main)/layout.tsx
// BEFORE:
<main className="mx-auto max-w-lg px-4 py-4">{children}</main>

// AFTER (Phase 11 -- foundational widening, Phase 12 refines further):
<main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
```
**Rationale:** `max-w-7xl` = 1280px is a standard content width for web apps. Phase 12 will add breakpoint-specific grid columns and responsive navigation. Phase 11 just removes the 512px squeeze so content can breathe on desktop.

**Important:** The detail page hero image uses `w-[calc(100%+2rem)]` and `-mx-4` to bleed edge-to-edge. At wider widths this will still work correctly since it's relative to the container.

### Pattern 3: Focus-Visible Ring on Custom Interactive Elements
**What:** Add consistent `focus-visible:ring-[3px] focus-visible:ring-ring/50` to all interactive elements that lack it.
**When to use:** A11Y-02 fix for custom elements.
**Example:**
```typescript
// BackButton -- add focus-visible ring
<button
  onClick={() => router.back()}
  className="... focus-visible:ring-[3px] focus-visible:ring-ring/50"
  aria-label="Torna indietro"
>
```

### Anti-Patterns to Avoid
- **Adding `tabIndex` to non-interactive elements:** Don't make divs focusable. Use semantic elements (button, a, input).
- **Using `outline-none` without replacement:** In Tailwind v4, use `outline-hidden` if you need to hide the default outline, but always pair with a visible focus-visible style.
- **Per-component reduced-motion logic:** Don't add `useReducedMotion()` hooks in every animation component. Use `MotionConfig` once at root.
- **Removing animations entirely for reduced-motion:** The correct approach is to keep opacity/color transitions but disable transform (x, y, scale) and layout animations. `MotionConfig reducedMotion="user"` handles this automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reduced-motion detection | Custom `matchMedia` hook | `MotionConfig reducedMotion="user"` | Motion handles all its own animations automatically; one line of config |
| Focus ring styles | Custom CSS per element | Tailwind `focus-visible:ring-[3px] focus-visible:ring-ring/50` | Consistent with Shadcn component patterns already in use |
| CSS reduced-motion for non-Motion animations | Custom @media queries in globals.css | Tailwind `motion-reduce:animate-none` variant | Collocated with the animation class, easier to audit |

**Key insight:** The Motion library's `MotionConfig` handles 90% of the reduced-motion work automatically. The remaining 10% is CSS animations (skeleton pulse, spinner) that need Tailwind's `motion-reduce:` variant.

## Common Pitfalls

### Pitfall 1: MotionConfig in Server Component
**What goes wrong:** Placing `<MotionConfig>` directly in the root `layout.tsx` (a Server Component) causes a build error because MotionConfig uses React Context.
**Why it happens:** Next.js App Router renders layouts as Server Components by default.
**How to avoid:** Create a `Providers.tsx` client component that wraps both MotionConfig and NuqsAdapter.
**Warning signs:** "React Context is not available in Server Components" error.

### Pitfall 2: Widening Container Breaks Mobile Layout
**What goes wrong:** Changing `max-w-lg` to `max-w-7xl` makes content too wide on mobile if padding is insufficient.
**Why it happens:** Mobile was designed for 512px max, so all spacing and sizing was tuned for that.
**How to avoid:** Keep `px-4` padding. Mobile screens are already narrower than 512px, so `max-w-7xl` has no effect on mobile -- it only unlocks desktop width. The card grid (`grid-cols-1 sm:grid-cols-2` in StaggerGrid) already handles responsive columns.
**Warning signs:** Content touching screen edges on mobile (won't happen with px-4 preserved).

### Pitfall 3: Cerca Page "TUTTE" Bug May Not Be What It Seems
**What goes wrong:** The user expects to see all sagre on first visit, but the query already returns all sagre when no filters are set. The "bug" may be a UX perception issue where the provincia Select shows placeholder "Tutte le province" but the user doesn't realize results are already loaded.
**Why it happens:** nuqs `parseAsString` defaults to `null`, which means no filter is applied -- all sagre are returned. The Select's `value` is `""` (empty string) when provincia is null, showing the placeholder text.
**How to avoid:** Verify the actual behavior first. If sagre DO show on first visit, the fix might be purely visual (pre-selecting the "Tutte" option). If they don't show, investigate why.
**Warning signs:** The searchSagre function returns all active sagre when no filters are applied (confirmed by code review).

### Pitfall 4: Missing Focus Styles on Link-Wrapped Cards
**What goes wrong:** SagraCard wraps content in a `<Link>` which doesn't have focus-visible styles. Keyboard users tab to the card but see no visual feedback.
**Why it happens:** Next.js `<Link>` renders an `<a>` tag, which gets default browser focus styles, but those may be invisible with `outline-ring/50` in globals.css base layer.
**How to avoid:** Add explicit focus-visible ring styles to the Link's className.
**Warning signs:** Tabbing through the page shows no visual indicator on cards.

### Pitfall 5: CSS animate-pulse Not Controlled by MotionConfig
**What goes wrong:** The skeleton `animate-pulse` class keeps pulsing even when reduced-motion is enabled, because it's a CSS animation, not a Motion animation.
**Why it happens:** `MotionConfig reducedMotion="user"` only affects Motion's JavaScript animations. CSS animations are independent.
**How to avoid:** Add `motion-reduce:animate-none` alongside `animate-pulse` on skeleton elements, or add a global rule in globals.css.
**Warning signs:** Skeleton loaders still pulse when OS reduced-motion is on.

## Code Examples

### Fix 1: Providers Component (A11Y-01 foundation)
```typescript
// src/components/Providers.tsx
"use client";

import { MotionConfig } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <NuqsAdapter>{children}</NuqsAdapter>
    </MotionConfig>
  );
}
```

### Fix 2: Root Layout Update
```typescript
// src/app/layout.tsx -- updated to use Providers
import { Providers } from "@/components/Providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Fix 3: Container Widening (BUG-04)
```typescript
// src/app/(main)/layout.tsx
<main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
```

### Fix 4: Focus-Visible on BackButton (A11Y-02)
```typescript
// src/components/detail/BackButton.tsx
<button
  onClick={() => router.back()}
  className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm transition-colors hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
  aria-label="Torna indietro"
>
```

### Fix 5: Focus-Visible on BottomNav Links (A11Y-02)
```typescript
// src/components/layout/BottomNav.tsx
<Link
  key={href}
  href={href}
  className={cn(
    "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50",
    isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
  )}
>
```

### Fix 6: Focus-Visible on SagraCard Link (A11Y-02)
```typescript
// src/components/sagra/SagraCard.tsx
<Link href={`/sagra/${sagra.slug}`} className="block rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50">
```

### Fix 7: CSS Reduced Motion for animate-pulse (A11Y-01)
```css
/* src/app/globals.css -- global rule for CSS animations */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
  }
  .animate-spin {
    animation: none;
  }
}
```
Or per-component with Tailwind: `animate-pulse motion-reduce:animate-none`

### Fix 8: Focus-Visible on QuickFilters Chips (A11Y-02)
```typescript
// src/components/home/QuickFilters.tsx
<button
  key={chip.label}
  type="button"
  onClick={() => handleChipClick(chip.param, chip.value)}
  className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50"
>
```

### Fix 9: Focus-Visible on Province Links (A11Y-02)
```typescript
// src/components/home/ProvinceSection.tsx
<Link
  key={province.code}
  href={`/cerca?provincia=${province.name}`}
  className="flex items-center justify-between rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50"
>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| outline-none for focus reset | outline-hidden in Tailwind v4 | Tailwind v4 (2024) | outline-none now sets outline-style:none (no transparent outline fallback) |
| Per-component useReducedMotion hook | MotionConfig reducedMotion="user" wrapper | Motion v11+ (2024) | Single config point instead of per-component hooks |
| ring-2 ring-offset-2 for focus | focus-visible:ring-[3px] focus-visible:ring-ring/50 | Shadcn 2025 | Shadcn standardized on this pattern across all components |

**Deprecated/outdated:**
- `framer-motion` package name: renamed to `motion` (already using correct name)
- `outline-none` in Tailwind v4: use `outline-hidden` instead if you need to reset outlines

## Interactive Elements Audit (A11Y-02)

Complete list of interactive elements that need focus-visible verification:

| Component | Element | Has focus-visible? | Action Needed |
|-----------|---------|-------------------|---------------|
| Button (shadcn) | `<button>` | YES | None |
| Input (shadcn) | `<input>` | YES | None |
| Select (shadcn) | `<button>` trigger | YES | None |
| Badge (shadcn) | `<span>` | YES (when used as link) | None |
| BackButton | `<button>` | NO | Add focus-visible:ring |
| BottomNav | `<Link>` (x3) | NO | Add focus-visible:ring |
| SagraCard | `<Link>` wrapper | NO | Add focus-visible:ring |
| QuickFilters | `<button>` chips | NO | Add focus-visible:ring |
| ProvinceSection | `<Link>` per province | NO | Add focus-visible:ring |
| HeroSection | `<Link>` search bar | NO | Add focus-visible:ring |
| ViewToggle | `<Button>` (shadcn) | YES | None |
| SearchFilters geo btn | `<Button>` (shadcn) | YES | None |
| DirectionsButton | `<a>` with buttonVariants | YES | None |
| ShareButton | `<Button>` (shadcn) | YES | None |
| Source link (detail) | `<a>` raw | NO | Add focus-visible:ring |

## Open Questions

1. **BUG-03: Is it actually broken?**
   - What we know: The query returns all active sagre when no filters are applied. The Select shows placeholder "Tutte le province". The search result count shows "X sagre trovate".
   - What's unclear: Does the user actually see no results on first visit, or is the "bug" a perception issue? The code suggests results should show.
   - Recommendation: Test locally first. If results DO show, the fix is cosmetic only (maybe show "TUTTE" as the selected value instead of placeholder text). If results DON'T show, investigate the query.

2. **Container width: max-w-7xl vs max-w-6xl?**
   - What we know: max-w-lg (512px) is too narrow. max-w-7xl (1280px) is standard for web apps.
   - What's unclear: Whether 1280px is right for this content or if 1152px (max-w-6xl) would look better.
   - Recommendation: Use max-w-7xl (1280px). Phase 12 will refine with proper grid columns and sidebars. For now, just remove the squeeze.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | Back button visible on detail page | manual-only | N/A -- visual, needs browser | N/A |
| BUG-02 | Image placeholder on detail page | manual-only | N/A -- visual, needs browser | N/A |
| BUG-03 | Cerca page shows all sagre by default | manual-only | N/A -- requires Supabase connection + browser | N/A |
| BUG-04 | Desktop content fills screen width | manual-only | N/A -- visual, needs wide viewport | N/A |
| A11Y-01 | Reduced-motion disables animations | manual-only | N/A -- requires OS setting + visual check | N/A |
| A11Y-02 | Focus indicators on interactive elements | manual-only | N/A -- requires Tab key + visual check | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run` (ensure no regressions)
- **Per wave merge:** `npx vitest run` + manual browser check
- **Phase gate:** Full suite green + manual accessibility check

### Wave 0 Gaps
None -- all phase requirements are UI/visual fixes verified manually. Existing test infrastructure (Vitest for unit tests on scrapers, date parser, geocoding) is unaffected and should pass without changes.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All component files read directly (BackButton, SagraDetail, SearchFilters, BottomNav, layouts, animations, globals.css)
- [Motion MotionConfig docs](https://motion.dev/docs/react-motion-config) - reducedMotion="user" prop
- [Motion useReducedMotion docs](https://motion.dev/docs/react-use-reduced-motion) - hook API
- [Motion accessibility guide](https://motion.dev/docs/react-accessibility) - best practices
- [Tailwind v4 hover/focus states](https://tailwindcss.com/docs/hover-focus-and-other-states) - focus-visible variant
- [Tailwind v4 outline-hidden change](https://github.com/tailwindlabs/tailwindcss/issues/15152) - v4 breaking change for outline-none

### Secondary (MEDIUM confidence)
- [Josh Comeau prefers-reduced-motion guide](https://www.joshwcomeau.com/react/prefers-reduced-motion/) - best practices for accessible animations
- [Tailwind outline vs ring comparison](https://www.codegenes.net/blog/what-s-the-difference-between-outline-and-ring-in-tailwind/) - ring better for focus indicators with Shadcn

### Tertiary (LOW confidence)
None -- all findings verified against codebase and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all fixes use existing stack
- Architecture: HIGH - Patterns directly verified against codebase
- Pitfalls: HIGH - All pitfalls identified from actual code review, not hypothetical
- Bug analysis: HIGH for BUG-01/02 (code confirms already fixed), HIGH for BUG-04 (max-w-lg confirmed), MEDIUM for BUG-03 (need to verify actual behavior)
- Accessibility: HIGH - Motion docs confirm MotionConfig API, Tailwind docs confirm focus-visible variants

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no fast-moving dependencies)
