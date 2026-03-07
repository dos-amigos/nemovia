# Phase 12: Responsive Desktop Layout - Research

**Researched:** 2026-03-07
**Domain:** Responsive layout, CSS grid, navigation patterns, Leaflet tooltips, breakpoint-aware skeletons
**Confidence:** HIGH

## Summary

Phase 12 transforms Nemovia from a mobile-only layout into a responsive experience that adapts across mobile, tablet, and desktop breakpoints. The project already uses Tailwind CSS v4 with standard breakpoints (sm:640px, md:768px, lg:1024px, xl:1280px, 2xl:1536px), so no new dependencies are needed for responsive layout work.

The current codebase has minimal responsive styling: `StaggerGrid` uses `grid-cols-1 gap-4 sm:grid-cols-2`, the main layout uses `max-w-7xl`, and SearchFilters uses `grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4`. The BottomNav is always visible. The detail page is single-column. Map markers use Popup (click) but no Tooltip (hover). All loading skeletons render single or two-column grids only.

**Primary recommendation:** Use Tailwind v4 responsive utilities exclusively -- add `md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` to card grids, create a `TopNav` component shown at `lg:` and above (hiding BottomNav), restructure SagraDetail with CSS grid for side-by-side layout, add react-leaflet `<Tooltip>` for hover names, and make all skeleton loading files mirror their page's responsive grid classes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DESK-01 | User sees wider content area on desktop with responsive max-width scaling | Current `max-w-7xl` already set; add breakpoint padding adjustments (`sm:px-6 lg:px-8`) for breathing room |
| DESK-02 | User sees multi-column card grids on tablet (2 cols) and desktop (3-4 cols) | Update `StaggerGrid` default className from `grid-cols-1 sm:grid-cols-2` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`; same for ProvinceSection |
| DESK-03 | User sees desktop navigation (top bar) on lg+ screens instead of BottomNav | Create `TopNav` component, use `hidden lg:block` / `lg:hidden` to swap; adjust `pb-20` on main wrapper |
| DESK-04 | User sees sagra detail with side-by-side layout on desktop | Use CSS grid `lg:grid-cols-[1fr_1fr]` or `lg:grid-cols-2` with image+map in left column, info in right column |
| DESK-05 | User sees sagra name tooltip on map marker hover on desktop | Import `Tooltip` from react-leaflet (already installed), nest `<Tooltip>{sagra.title}</Tooltip>` inside each `<Marker>` |
| SKEL-02 | User sees content-aware skeleton shapes matching actual layout at every breakpoint | Duplicate the responsive grid classes from actual pages into their corresponding loading.tsx files |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | v4 | Responsive utilities, grid, breakpoints | Already in project, standard responsive approach |
| react-leaflet | v5.0.0 | Map rendering, Tooltip component | Already installed, Tooltip is built-in |
| Next.js | 15.5.12 | App Router layout system | Already in project |
| lucide-react | 0.577.0 | Icons for TopNav | Already in project |
| motion | 12.35.0 | Animation wrappers (FadeIn, StaggerGrid) | Already in project |

### Supporting

No new libraries needed. Everything required is already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind responsive classes | CSS @container queries | Container queries would work but Tailwind breakpoints are simpler and already used throughout |
| TopNav component | Shadcn/UI NavigationMenu | Overkill for 3 links -- custom is simpler and consistent with existing BottomNav |
| CSS Grid for detail layout | Flexbox | Grid is cleaner for 2-column layouts with row spanning; flex requires more wrapping |

## Architecture Patterns

### Current Project Structure (relevant files)

```
src/
  app/(main)/
    layout.tsx              # Main layout with BottomNav -- MODIFY
    loading.tsx             # Home skeleton -- MODIFY
    page.tsx                # Home page (no changes)
    cerca/
      loading.tsx           # Cerca skeleton -- MODIFY
    mappa/
      loading.tsx           # Mappa skeleton -- MODIFY (minimal)
    sagra/[slug]/
      loading.tsx           # Detail skeleton -- MODIFY
      page.tsx              # Detail page (no changes needed)
  components/
    layout/
      BottomNav.tsx         # Mobile bottom nav -- MODIFY (hide on lg+)
      TopNav.tsx            # NEW -- desktop top navigation bar
    animations/
      StaggerGrid.tsx       # Grid wrapper -- MODIFY (add responsive cols)
    detail/
      SagraDetail.tsx       # Detail layout -- MODIFY (side-by-side on desktop)
    home/
      ProvinceSection.tsx   # Province grid -- MODIFY (more cols on desktop)
      HeroSection.tsx       # Hero banner -- MODIFY (scale up text/padding on desktop)
    map/
      MapView.tsx           # Map markers -- MODIFY (add Tooltip)
    sagra/
      SagraCard.tsx         # Card component -- MODIFY (image sizes attribute)
```

### Pattern 1: Responsive Navigation Swap

**What:** Show BottomNav on mobile, TopNav on desktop using Tailwind display utilities.
**When to use:** When mobile and desktop have fundamentally different navigation patterns.
**Example:**
```typescript
// In app/(main)/layout.tsx
<div className="min-h-screen bg-background pb-20 lg:pb-0">
  <TopNav />   {/* has className="hidden lg:block" internally */}
  <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
    {children}
  </main>
  <BottomNav /> {/* has className="lg:hidden" added to nav element */}
</div>
```

### Pattern 2: Responsive Grid Scaling

**What:** Use Tailwind breakpoint prefixes for progressive grid column increases.
**When to use:** Card grids, province grids, filter grids.
**Example:**
```typescript
// StaggerGrid default className
"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

// ProvinceSection grid
"grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
```

### Pattern 3: Detail Page Side-by-Side Layout

**What:** Use CSS grid to create side-by-side layout on desktop.
**When to use:** Detail pages with image/map + info sections.
**Example:**
```typescript
// SagraDetail root container
<div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
  {/* Left column: hero image + mini map */}
  <div className="space-y-6">
    {/* Image */}
    {/* Mini map */}
  </div>
  {/* Right column: title, info, tags, description, actions */}
  <div className="space-y-6">
    {/* Title, location, date, tags, description, action buttons, source link */}
  </div>
</div>
```

### Pattern 4: Leaflet Tooltip for Hover

**What:** Add `<Tooltip>` component nested inside `<Marker>` for hover display.
**When to use:** Desktop users hovering over map markers should see sagra name without clicking.
**Example:**
```typescript
import { Marker, Popup, Tooltip } from "react-leaflet";

<Marker key={sagra.id} position={position}>
  <Tooltip>{sagra.title}</Tooltip>
  <Popup>
    <MapMarkerPopup sagra={sagra} />
  </Popup>
</Marker>
```

### Pattern 5: Breakpoint-Aware Skeletons

**What:** Skeleton loading files must use the same responsive grid classes as the actual content.
**When to use:** Every loading.tsx file.
**Example:**
```typescript
// Home loading.tsx -- match WeekendSection grid
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {Array.from({ length: 8 }).map((_, i) => (
    <SagraCardSkeleton key={i} />
  ))}
</div>
```

### Anti-Patterns to Avoid

- **Don't use JavaScript for responsive logic:** Tailwind CSS breakpoints handle everything -- never use `window.innerWidth` or `useMediaQuery` for grid layout decisions.
- **Don't create separate mobile/desktop components:** Same component with responsive Tailwind classes is always preferable. One component, multiple breakpoints.
- **Don't add breakpoint-specific skeleton counts with JS:** Use CSS `hidden`/`block` on extra skeleton items if needed, or just render enough items and let the grid flow naturally (the grid crops visually).
- **Don't forget to update Image `sizes` attribute:** When cards go from full-width to multi-column, update `sizes` for proper image optimization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive breakpoints | Custom media query hooks | Tailwind v4 responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) | Utilities are composable, work at build time, zero JS |
| Navigation visibility toggle | JavaScript-based show/hide | Tailwind `hidden lg:block` / `lg:hidden` | CSS-only, no hydration flash, no layout shift |
| Map marker hover text | Custom hover event handlers | react-leaflet `<Tooltip>` component | Built into react-leaflet, handles mouse enter/leave automatically |
| Side-by-side layout | Absolute positioning or float | CSS Grid (`lg:grid-cols-2`) | Clean, maintainable, responsive, handles unequal column heights |

**Key insight:** This entire phase requires zero new npm dependencies. Every feature is achievable with existing Tailwind utilities and react-leaflet's built-in Tooltip component.

## Common Pitfalls

### Pitfall 1: BottomNav Padding Not Removed on Desktop
**What goes wrong:** Desktop users see 80px of dead space at the bottom (the `pb-20` padding for BottomNav).
**Why it happens:** The main layout has `pb-20` unconditionally to make room for the fixed BottomNav.
**How to avoid:** Change to `pb-20 lg:pb-0` so padding is removed when BottomNav is hidden.
**Warning signs:** Excessive whitespace at page bottom on desktop.

### Pitfall 2: Hero Image Bleeds on Desktop Detail
**What goes wrong:** The detail page hero image uses `-mx-4 -mt-4 w-[calc(100%+2rem)]` to bleed edge-to-edge, which looks wrong in side-by-side layout.
**Why it happens:** The negative margins assume full-width single-column layout.
**How to avoid:** Remove the negative margin/calc on `lg:` breakpoint: `lg:mx-0 lg:mt-0 lg:w-full lg:rounded-xl`. The image should be contained within its grid column on desktop.
**Warning signs:** Image overflows its grid column or has weird spacing on desktop.

### Pitfall 3: Skeleton Layout Mismatch Causes CLS
**What goes wrong:** Skeletons show 2 columns but content loads into 3-4 columns, causing layout shift.
**Why it happens:** Skeleton grid classes weren't updated to match the new responsive grid classes on content components.
**How to avoid:** Skeleton loading files MUST mirror the exact same responsive grid classes as their corresponding content components.
**Warning signs:** Layout jump when content replaces skeletons.

### Pitfall 4: StaggerGrid className Override Breaks Responsive
**What goes wrong:** The `StaggerGrid` component takes an optional `className` prop with a default value. Any caller passing a custom className loses the responsive classes.
**Why it happens:** The default is `"grid grid-cols-1 gap-4 sm:grid-cols-2"` -- if a caller overrides, the responsive classes vanish.
**How to avoid:** Update the default value in `StaggerGrid` to include all breakpoints. Check that no caller passes a custom className that would break responsive layout.
**Warning signs:** Some grids are responsive, others aren't.

### Pitfall 5: Map Height Calculation Changes
**What goes wrong:** The mappa page uses `calc(100vh - 5rem)` for map height, accounting for BottomNav. On desktop without BottomNav, the map should be taller.
**Why it happens:** The height calculation subtracts BottomNav height but not TopNav height.
**How to avoid:** Use `calc(100vh - 5rem)` on mobile and `calc(100vh - 4rem)` on desktop (TopNav is typically shorter than BottomNav), or use a CSS variable approach. The exact value depends on the TopNav height chosen.
**Warning signs:** Map has too much/too little dead space on desktop.

### Pitfall 6: TopNav and BottomNav Hydration
**What goes wrong:** Both TopNav and BottomNav are client components (they use `usePathname`). Both render in the DOM but only one is visible via CSS.
**Why it happens:** Using `hidden`/`block` means both components mount and hydrate.
**How to avoid:** This is acceptable for two small components. Do NOT try to conditionally render based on screen size in JS -- that causes hydration mismatches and flash of wrong content. The CSS-only approach is correct.
**Warning signs:** Flash of BottomNav appearing then disappearing on desktop -- this indicates a JS-based approach was used instead of CSS.

## Code Examples

### TopNav Component

```typescript
// Source: Project convention (matches existing BottomNav pattern)
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

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:block sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-8">
        <Link href="/" className="text-lg font-bold text-primary">
          Nemovia
        </Link>
        <div className="flex items-center gap-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  isActive
                    ? "text-primary font-medium bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
```

### Updated Main Layout

```typescript
// Source: Existing app/(main)/layout.tsx pattern
import { BottomNav } from "@/components/layout/BottomNav";
import { TopNav } from "@/components/layout/TopNav";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

### BottomNav with lg:hidden

```typescript
// Add lg:hidden to the nav element in BottomNav
<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-safe lg:hidden">
```

### Leaflet Tooltip on Markers

```typescript
// Source: react-leaflet docs (https://react-leaflet.js.org/docs/api-components/)
import { Marker, Popup, Tooltip } from "react-leaflet";

<Marker key={sagra.id} position={position}>
  <Tooltip>{sagra.title}</Tooltip>
  <Popup>
    <MapMarkerPopup sagra={sagra} />
  </Popup>
</Marker>
```

### SagraCard Image Sizes Update

```typescript
// Update sizes attribute for responsive grid
<Image
  src={sagra.image_url}
  alt={sagra.title}
  fill
  className="object-cover"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Media query hooks in JS | Tailwind responsive prefixes | Standard since Tailwind v1 | Zero JS, no hydration issues |
| Separate mobile/desktop routes | Single component with responsive classes | Next.js 13+ App Router | One codebase, one component tree |
| Hide with `display:none` in CSS modules | Tailwind `hidden lg:block` | Standard Tailwind pattern | Composable, readable in markup |

**No deprecated/outdated approaches apply to this phase.**

## Open Questions

1. **TopNav height and map height calculation**
   - What we know: BottomNav is h-16 (4rem), so current `pb-20` includes safe area. TopNav will likely be h-14 (3.5rem).
   - What's unclear: Exact TopNav height affects map page height calc.
   - Recommendation: Use h-14 for TopNav (standard desktop nav height), adjust map height calc to `lg:calc(100vh - 3.5rem)`.

2. **Number of skeleton items on desktop**
   - What we know: Mobile shows 4 card skeletons. Desktop 4-column grid would show 4 in one row.
   - What's unclear: Whether to show 4 or 8 skeletons on desktop.
   - Recommendation: Show 8 skeletons so desktop users see 2 full rows, matching visual weight of mobile's 4-card single-column view.

3. **Detail page BackButton position on desktop**
   - What we know: BackButton is absolutely positioned over the hero image with `left-3 top-3`.
   - What's unclear: Whether BackButton should remain over the image in side-by-side layout or move to a breadcrumb-style position.
   - Recommendation: Keep BackButton on the image for consistency. The image will still be large enough in the left column to contain it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements - Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DESK-01 | Responsive max-width container with breakpoint padding | manual-only | Visual check at multiple viewport widths | N/A |
| DESK-02 | Multi-column card grids (2 on tablet, 3-4 on desktop) | manual-only | Visual check at sm/md/lg/xl breakpoints | N/A |
| DESK-03 | Desktop top nav visible on lg+, BottomNav hidden | manual-only | Visual check at lg breakpoint (1024px) | N/A |
| DESK-04 | Side-by-side detail layout on desktop | manual-only | Visual check at lg breakpoint | N/A |
| DESK-05 | Tooltip on map marker hover | manual-only | Hover map marker at desktop viewport | N/A |
| SKEL-02 | Skeleton shapes match content layout at every breakpoint | manual-only | Compare skeleton vs loaded content at each breakpoint | N/A |

**Justification for manual-only:** All DESK-* and SKEL-02 requirements are purely CSS/visual layout changes. The project uses Vitest with `environment: "node"` which cannot render React components or test CSS breakpoint behavior. Testing responsive layouts requires either visual regression tools (Playwright, Cypress) or manual browser inspection -- neither is in the current test infrastructure. Adding visual regression testing would be out of scope for this phase.

### Sampling Rate
- **Per task commit:** `npx vitest run` (confirms no regressions in existing tests)
- **Per wave merge:** `npx vitest run` + manual browser check at 640px, 768px, 1024px, 1280px, 1536px
- **Phase gate:** Full vitest suite green + manual verification at all breakpoints

### Wave 0 Gaps
None -- existing test infrastructure covers utility/data tests. This phase's requirements are CSS layout changes best verified visually. No new test files needed.

## Sources

### Primary (HIGH confidence)
- **Tailwind CSS v4 docs** - responsive breakpoints: sm=640px, md=768px, lg=1024px, xl=1280px, 2xl=1536px ([Responsive Design](https://tailwindcss.com/docs/responsive-design))
- **react-leaflet v5 docs** - Tooltip component API ([API Components](https://react-leaflet.js.org/docs/api-components/))
- **Project codebase** - direct file reads of all affected components, layout, skeletons, and types

### Secondary (MEDIUM confidence)
- **Tailwind CSS v4 breakpoint configuration** - ([Customizing Screens](https://tailwindcss.com/docs/screens))

### Tertiary (LOW confidence)
- None -- all findings verified against installed packages and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, everything already installed and verified in package.json
- Architecture: HIGH - patterns derived directly from existing codebase conventions and Tailwind v4 documentation
- Pitfalls: HIGH - identified from direct code analysis of current layout.tsx, StaggerGrid, and SagraDetail implementations
- Tooltip: HIGH - react-leaflet Tooltip is a standard component, documented, and react-leaflet v5 is already installed

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no moving parts, all dependencies locked)
