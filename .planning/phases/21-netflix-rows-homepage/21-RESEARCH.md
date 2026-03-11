# Phase 21: Netflix Rows Homepage - Research

**Researched:** 2026-03-11
**Domain:** CSS horizontal scroll containers, server-side data fetching patterns, homepage restructure
**Confidence:** HIGH

## Summary

Phase 21 replaces the existing bento grid homepage with Netflix-style horizontal scroll rows. The current homepage fetches weekend sagre and province counts in parallel, then renders a featured card + grid + province links. The new design uses 4-5 horizontally-scrollable card rows, each querying a different category (weekend, food type, province, free events).

The implementation is straightforward: CSS `scroll-snap` with Tailwind v4 native utility classes (`snap-x`, `snap-mandatory`, `snap-start`) handles the scroll behavior with zero external dependencies. The project already has the `scrollbar-hide` utility in globals.css. Data fetching follows the established `Promise.all` pattern in the server component, with new query functions in `lib/queries/sagre.ts`. The main complexity lies in deduplication across rows and the edge-to-edge scroll container that aligns first card with page content.

**Primary recommendation:** Build a reusable `ScrollRow` client component with CSS scroll-snap and optional desktop arrow buttons, a `ScrollRowSection` server wrapper for title/icon/row composition, and 3-4 new query functions that exclude already-shown IDs to prevent cross-row duplication.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HOME-01 | Netflix-style horizontal scroll rows on homepage with smart mix (weekend, vicino a te, tipo cucina, provincia) | CSS scroll-snap with Tailwind v4 native classes; new query functions per category; dedup via ID exclusion sets; minimum-3 threshold for row visibility; `ScrollRow` + `ScrollRowSection` component architecture |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | ^4 (already installed) | scroll-snap utilities, layout, responsive | Native `snap-x snap-mandatory snap-start` classes -- no plugin needed in v4 |
| motion/react-m | ^12.35 (already installed) | Subtle hover/tap animations on cards, fade-in on rows | Already used throughout project via LazyMotion strict mode |
| lucide-react | ^0.577 (already installed) | Row icons (Calendar, MapPin, ChefHat, etc.), arrow buttons (ChevronLeft/Right) | Already the icon library for the entire project |
| Next.js 15 | 15.5.12 (already installed) | Server component data fetching, parallel queries | Established pattern in existing homepage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase JS | ^2.98 (already installed) | Query functions for each row category | All new `getSagreBy*` functions use existing server client |
| nuqs | ^2.8.9 (already installed) | URL state for "Vedi tutti" links | Existing pattern for /cerca page filter params |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS scroll-snap | SwiperJS / Embla Carousel | Explicitly out of scope in REQUIREMENTS.md; adds 20-40KB bundle for no benefit |
| Manual arrow buttons | react-horizontal-scrolling-menu | Unnecessary dependency; `scrollBy()` + a ref is ~15 lines of code |
| Multiple parallel queries | Single UNION ALL query | More complex SQL, not cacheable independently, harder to debug |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    home/
      ScrollRow.tsx             # Client component: horizontal scroll container
      ScrollRowSection.tsx      # Server component: title + icon + row wrapper
      NearbyRow.tsx             # Client component: geo-aware row (lazy loaded)
      HeroSection.tsx           # MODIFY: keep as-is (already full-bleed from Phase 20)
      QuickFilters.tsx          # KEEP: move below scroll rows
  lib/
    queries/
      sagre.ts                  # MODIFY: add new category query functions
      types.ts                  # MODIFY: add HomepageRowData type if needed
  app/
    (main)/
      page.tsx                  # MODIFY: replace bento grid with scroll row sections
    api/
      nearby/
        route.ts                # NEW: Route Handler for geo-aware "Vicino a te" row
```

### Pattern 1: Server-Fetched Scroll Row Data with Deduplication
**What:** Homepage server component fetches all row data in parallel, then passes a running exclusion set of IDs to prevent sagre from appearing in multiple rows.
**When to use:** When rendering multiple category rows from the same dataset.
**Example:**
```typescript
// Source: Existing homepage pattern (page.tsx) + dedup logic
export default async function HomePage() {
  const [weekendSagre, allActive, provinceCounts] = await Promise.all([
    getWeekendSagre(12),
    getActiveSagre(50),        // broader fetch for category rows
    getProvinceCounts(),
  ]);

  // Dedup: track shown IDs
  const shown = new Set(weekendSagre.map(s => s.id));

  // Build category rows from allActive, excluding shown IDs
  const gratisSagre = allActive
    .filter(s => s.is_free && !shown.has(s.id))
    .slice(0, 12);
  gratisSagre.forEach(s => shown.add(s.id));

  const topProvince = provinceCounts[0]?.province;
  const provinceSagre = topProvince
    ? allActive.filter(s => s.province === topProvince && !shown.has(s.id)).slice(0, 12)
    : [];
  provinceSagre.forEach(s => shown.add(s.id));

  // ... render rows, hiding any with < 3 items
}
```

### Pattern 2: CSS Scroll-Snap Container with Edge-to-Edge Scroll
**What:** A flex container with `overflow-x: auto` and `scroll-snap-type: x mandatory` that extends to viewport edges while keeping the first card aligned with page content.
**When to use:** Any horizontal scroll row on the homepage.
**Example:**
```typescript
// Source: MDN scroll-snap docs + existing scrollbar-hide utility in globals.css
// ScrollRow.tsx - "use client"
"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SagraCard } from "@/components/sagra/SagraCard";
import type { SagraCardData } from "@/lib/queries/types";

interface ScrollRowProps {
  sagre: SagraCardData[];
}

export function ScrollRow({ sagre }: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  return (
    <div className="group relative">
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-3 overflow-x-auto snap-x snap-mandatory
                   scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-8 pb-2"
      >
        {sagre.map((sagra) => (
          <div key={sagra.id} className="w-[280px] flex-shrink-0 snap-start">
            <SagraCard sagra={sagra} />
          </div>
        ))}
      </div>

      {/* Desktop arrow buttons */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-2 top-1/2 -translate-y-1/2 hidden lg:flex
                   h-10 w-10 items-center justify-center rounded-full
                   bg-background/80 shadow-md backdrop-blur-sm
                   opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Scorri a sinistra"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => scroll("right")}
        className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex
                   h-10 w-10 items-center justify-center rounded-full
                   bg-background/80 shadow-md backdrop-blur-sm
                   opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Scorri a destra"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
```

### Pattern 3: Minimum Row Threshold with Conditional Rendering
**What:** Only render a scroll row if it has >= 3 items. Empty or sparse rows are hidden.
**When to use:** Every scroll row on homepage.
**Example:**
```typescript
// ScrollRowSection.tsx
const MIN_ROW_ITEMS = 3;

interface ScrollRowSectionProps {
  title: string;
  icon: React.ReactNode;
  sagre: SagraCardData[];
  viewAllHref?: string;
}

export function ScrollRowSection({ title, icon, sagre, viewAllHref }: ScrollRowSectionProps) {
  if (sagre.length < MIN_ROW_ITEMS) return null;

  return (
    <section className="space-y-3">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {icon}
          {title}
        </h2>
        {viewAllHref && (
          <a href={viewAllHref} className="text-sm text-primary hover:underline">
            Vedi tutti
          </a>
        )}
      </div>
      <ScrollRow sagre={sagre} />
    </section>
  );
}
```

### Pattern 4: Geo-Aware "Vicino a te" Row (Client-Side with Route Handler)
**What:** A client component that requests geolocation permission, fetches nearby sagre via a Route Handler, and renders as a scroll row.
**When to use:** Only for location-dependent data that cannot be server-fetched.
**Example:**
```typescript
// NearbyRow.tsx - "use client"
// Fetches nearby sagre after geolocation consent
// Falls back to hiding the row if permission denied

// api/nearby/route.ts
// GET /api/nearby?lat=X&lng=Y&raggio=30
// Calls find_nearby_sagre RPC server-side
// Returns SagraCardData[]
```

### Anti-Patterns to Avoid
- **Fetching per-row with useEffect in each scroll section:** Server component can fetch all data in parallel with a single `Promise.all`. Do not create N client components each making their own API call.
- **Removing max-w-7xl from layout:** The full-width layout is already established (Phase 20). Scroll rows extend to edges via the scroll container itself, while row titles stay within the content container.
- **Using `snap-mandatory` without `scroll-pl` padding:** Without scroll-padding, the first card snaps flush to the viewport edge with no breathing room. Use `scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-8` to match page content alignment.
- **Duplicating sagre across rows:** Without dedup logic, the same popular sagra appears in "Questo weekend", "Gratis", and "A Padova" rows simultaneously. Track shown IDs in a Set and filter subsequent rows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horizontal carousel | Custom JS scroll management with IntersectionObserver | CSS `scroll-snap-type: x mandatory` + `overflow-x: auto` | Native momentum scrolling on touch devices; CSS handles all the scroll physics |
| Scroll arrows | Complex prev/next state management | `scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' })` | One line of code, smooth native animation |
| Hidden scrollbar | Custom CSS pseudo-elements | Existing `scrollbar-hide` utility already in globals.css | Already built and tested in QuickFilters horizontal scroll |
| Touch swipe handling | Hammer.js / custom touch events | Native `overflow-x: auto` | Touch scrolling is the browser's job; intercepting it creates jank |
| Row data deduplication | Complex SQL EXCEPT queries | In-memory `Set<string>` of shown IDs in server component | With ~100 active sagre, in-memory dedup is instant and trivially debuggable |

**Key insight:** CSS scroll-snap + native overflow scrolling handles 95% of Netflix-style row UX. The remaining 5% (desktop arrows, peek effect) is ~30 lines of React code. No carousel library is needed.

## Common Pitfalls

### Pitfall 1: Cards Not Snapping on iOS Safari
**What goes wrong:** Scroll snap appears to not work or snap erratically on iOS Safari.
**Why it happens:** iOS Safari has historically had issues with `scroll-snap-type: x mandatory` when combined with `overflow: hidden` on a parent, or when the container has padding that conflicts with snap points.
**How to avoid:** Use `scroll-pl-*` (scroll-padding-left) on the container instead of regular `pl-*` padding. Avoid `overflow: hidden` on any ancestor element. Test on a real iOS device.
**Warning signs:** Cards snap on Chrome but drift on Safari; first card always snaps slightly off-center.

### Pitfall 2: Sparse Rows on Low Event Count
**What goes wrong:** Homepage shows rows with 1-2 cards, looking broken and empty.
**Why it happens:** When fewer than ~50 active sagre exist, spreading across 5 categories leaves some categories nearly empty. Dedup further reduces available items.
**How to avoid:** Enforce minimum 3 items per row. Dynamically determine which categories to show based on available data. The server component should compute rows and omit sparse ones.
**Warning signs:** Empty space after the last card in a row; rows with fewer cards than can fill the visible viewport.

### Pitfall 3: All Sagre in First Row, Nothing Left for Others
**What goes wrong:** "Questo weekend" captures all 20 active events, leaving zero for "Gratis" and province rows.
**Why it happens:** If the weekend date range is wide and most sagre are multi-day events, the weekend query returns nearly everything.
**How to avoid:** Limit weekend row to 12 items. Build subsequent rows from the full active set (not the weekend remainder), only deduplicating against what was already shown.
**Warning signs:** Only the first row has content; all other rows are hidden due to the < 3 threshold.

### Pitfall 4: Edge-to-Edge Scroll Misalignment
**What goes wrong:** The first card in the scroll row does not align with the row title and page content above.
**Why it happens:** The scroll container extends full-width but lacks matching scroll-padding to align the snap point with the content container inset.
**How to avoid:** Use `scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-8` on the scroll container to match the `px-4 sm:px-6 lg:px-8` content padding. The row title sits inside `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` while the scroll container is full-width.
**Warning signs:** Row title says "Questo weekend" aligned to content, but the first card starts at the viewport edge.

### Pitfall 5: Desktop Arrow Buttons Blocking Card Clicks
**What goes wrong:** The left/right arrow overlay buttons intercept click events on the first/last visible card.
**Why it happens:** Arrow buttons positioned `absolute` over the scroll area capture pointer events.
**How to avoid:** Use `pointer-events-none` on the button container and `pointer-events-auto` only on the button itself. Keep arrows at the extreme edges, outside the card click zone. Use opacity transition so arrows only appear on hover.
**Warning signs:** Clicking the first visible card navigates nowhere; clicking slightly to the right works.

### Pitfall 6: "Vicino a te" Row Causing Layout Shift
**What goes wrong:** The page layout shifts when the "Vicino a te" row appears after geolocation succeeds.
**Why it happens:** The row is conditionally rendered after an async client-side operation, pushing content down.
**How to avoid:** Reserve space with a skeleton placeholder from the start, or always place the nearby row at a fixed position in the page. If geolocation is denied, collapse the skeleton smoothly. Consider placing it last so layout shift is below the fold.
**Warning signs:** Content jumps down after ~1 second on page load; CLS metric spikes.

## Code Examples

Verified patterns from the existing codebase:

### Data Fetching Pattern (Parallel Queries)
```typescript
// Source: Existing src/app/(main)/page.tsx lines 20-23
const [weekendSagre, provinceCounts] = await Promise.all([
  getWeekendSagre(),
  getProvinceCounts(),
]);
```

### Existing Horizontal Scroll (QuickFilters)
```typescript
// Source: src/components/home/QuickFilters.tsx line 31
// Already uses scrollbar-hide and overflow-x-auto for horizontal chip scroll
<div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
```

### Animation Pattern (FadeIn on Scroll Rows)
```typescript
// Source: src/components/animations/FadeIn.tsx
// Wrap each ScrollRowSection in FadeIn with staggered delays
<FadeIn delay={0.1}><ScrollRowSection title="..." /></FadeIn>
<FadeIn delay={0.2}><ScrollRowSection title="..." /></FadeIn>
```

### Full-Width Layout Context
```typescript
// Source: src/app/(main)/layout.tsx
// Main has NO max-w constraint (Phase 20 decision)
<main className="flex-1">{children}</main>

// Source: src/app/(main)/page.tsx line 33
// Content sections wrap in max-w-7xl container
<div className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
```

### Card Component (Reused in Scroll Rows)
```typescript
// Source: src/components/sagra/SagraCard.tsx
// Fixed dimensions needed: wrap in flex-shrink-0 w-[280px] container
// SagraCard renders at h-52 with image overlay pattern
<m.div className="relative h-52 w-full overflow-hidden rounded-xl">
```

## Data Strategy for Row Categories

### Available Row Categories

| Row | Query Approach | Data Source | Dedup Order |
|-----|---------------|-------------|-------------|
| "Questo weekend" | Existing `getWeekendSagre()` with increased limit (12) | `start_date <= nextSunday AND (end_date >= today OR null)` | 1st (no dedup needed) |
| "Gratis" | Filter from broader active query | `is_free = true` from active set | 2nd (exclude weekend IDs) |
| "A [Province]" | Filter from broader active query | `province = topProvince` from active set | 3rd (exclude shown IDs) |
| "Sagre di [Food]" | Filter from broader active query | `food_tags contains topTag` from active set | 4th (exclude shown IDs) |
| "Vicino a te" | Client-side via Route Handler | `find_nearby_sagre` RPC | Last (always fresh, independent) |

### Dedup Strategy: Single Fetch + In-Memory Filter

Rather than making 5 separate Supabase queries (each with complex NOT IN exclusion), fetch a broad set of active sagre once and build rows in-memory:

```typescript
// Efficient: 2 queries instead of 5+
const [weekendSagre, allActive, provinceCounts] = await Promise.all([
  getWeekendSagre(12),           // Optimized weekend query (date logic)
  getActiveSagre(80),            // Broad fetch: all active, non-expired, limit 80
  getProvinceCounts(),           // Province counts for dynamic row selection
]);
```

The weekend query stays separate because its date filtering logic is complex. All other rows filter from `allActive` in-memory. This minimizes database round-trips while keeping dedup trivial.

### New Query Function: `getActiveSagre()`

```typescript
// New function in lib/queries/sagre.ts
export async function getActiveSagre(limit = 80): Promise<SagraCardData[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("sagre")
    .select(SAGRA_CARD_FIELDS)
    .eq("is_active", true)
    .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
    .order("start_date", { ascending: true })
    .limit(limit);

  if (error) { console.error("getActiveSagre error:", error.message); return []; }
  return (data as SagraCardData[]) ?? [];
}
```

### Dynamic Row Selection Logic

The server component should dynamically select which food tag and province to feature:

```typescript
// Select province with most events for the province row
const topProvince = provinceCounts[0];

// Select food tag by counting occurrences in allActive
const tagCounts = new Map<string, number>();
for (const s of allActive) {
  for (const tag of s.food_tags ?? []) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
}
const topTag = [...tagCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .find(([_, count]) => count >= 3)?.[0];
```

## Accessibility

### Scroll Row Accessibility Requirements
- Container: `role="region"` + `aria-label="Sagre questo weekend"` (localized per row)
- Container: `tabindex="0"` for keyboard focus and arrow key scrolling
- Arrow buttons: `aria-label="Scorri a sinistra"` / `"Scorri a destra"`
- Arrow buttons: `hidden lg:flex` (only shown on desktop where touch scroll is unavailable)
- Respect `prefers-reduced-motion`: the cards animate via motion library which already respects `MotionConfig reducedMotion="user"` in Providers.tsx

### Keyboard Navigation
- Tab focuses the scroll container
- Left/Right arrow keys scroll the container (browser native behavior for focused overflow containers)
- Enter on a card navigates to the sagra detail page (existing SagraCard is a `<Link>`)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SwiperJS / Flickity carousel libraries | CSS `scroll-snap-type` + native overflow | scroll-snap wide support since 2020 | Zero-dependency horizontal scroll with native momentum |
| `scroll-snap-type: mandatory` only | `mandatory` + `scroll-snap-stop: always` | scroll-snap-stop widely available since July 2022 | Prevents fast-swipe from skipping cards (optional enhancement) |
| Custom scrollbar hiding via JS | CSS `scrollbar-width: none` + `-webkit-scrollbar display:none` | Firefox added `scrollbar-width` 2019 | Pure CSS hidden scrollbar, already in project's globals.css |
| Negative margin trick for edge-to-edge | `scroll-padding` utilities in Tailwind v4 | Tailwind v4 (2025) | Cleaner than `-mx-4 px-4`; use `scroll-pl-4` for snap alignment |

**Deprecated/outdated:**
- `scroll-snap-type: mandatory` without `scroll-padding`: causes misalignment. Always pair with `scroll-pl-*`.
- `-webkit-overflow-scrolling: touch`: No longer needed. iOS Safari handles momentum scrolling natively since iOS 13.

## Scroll Container Architecture Decision

### Edge-to-Edge vs. Contained Scroll

Two approaches for scroll row width:

**Option A: Full-width scroll container (RECOMMENDED)**
- Scroll container has no max-width, extends viewport-wide
- `scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-8` aligns first card with content
- Last card has "peek" effect -- partially visible at right edge signals more content
- Row title lives in a `max-w-7xl` wrapper above the scroll container

**Option B: Contained scroll within max-w-7xl**
- Scroll container inside the `max-w-7xl` wrapper
- No peek effect at edges
- Simpler but less visually engaging

Option A matches the Netflix UX pattern and leverages the full-width layout from Phase 20.

### Card Width Strategy

| Viewport | Card Width | Cards Visible | Rationale |
|----------|------------|---------------|-----------|
| Mobile (<640px) | `w-[75vw]` | ~1.3 | One card + peek of next |
| Tablet (640-1024px) | `w-[45vw]` | ~2.2 | Two cards + peek |
| Desktop (1024px+) | `w-[280px]` | ~4-5 | Multiple cards visible, matches existing card aesthetic |

Using responsive width classes: `w-[75vw] sm:w-[45vw] lg:w-[280px]`

This ensures the "peek" effect works at all breakpoints -- the user always sees a partial card at the right edge, signaling scrollability.

## Open Questions

1. **"Vicino a te" row placement and geolocation UX**
   - What we know: `useGeolocation` hook exists with opt-in behavior. Route Handler needed for server-side RPC call.
   - What's unclear: Should the row appear with a "Attiva posizione" button, or should it auto-request on page load? Auto-requesting may feel intrusive.
   - Recommendation: Render the row with a CTA button "Scopri sagre vicine" that triggers geolocation. If granted, fetch and show results. If denied, collapse the row. Do NOT auto-request on page load. Alternatively, defer this to Phase 22 (City Search) since it overlaps with location-based features.

2. **Number of rows when dataset is small**
   - What we know: Target is 100+ active sagre, but seasonal variation exists.
   - What's unclear: If only 30 active sagre exist, how many distinct non-sparse rows can we form?
   - Recommendation: Build all 4-5 category filters but apply the >= 3 threshold strictly. With 30 sagre, expect 2-3 visible rows. With 100+, expect 4-5.

3. **Whether to keep QuickFilters**
   - What we know: QuickFilters provides horizontal chip scroll with food type shortcuts.
   - What's unclear: With scroll rows per food type, QuickFilters may feel redundant.
   - Recommendation: Keep QuickFilters below the scroll rows. It serves a different purpose (direct navigation to /cerca with filter) vs. scroll rows (browse preview). It also provides "Oggi" and "Gratis" shortcuts not covered by rows.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOME-01a | Scroll row renders minimum 3 cards or is hidden | unit | `npx vitest run src/components/home/__tests__/ScrollRowSection.test.ts -t "hides row"` | No -- Wave 0 |
| HOME-01b | Dedup logic prevents cross-row duplicates | unit | `npx vitest run src/lib/queries/__tests__/homepage-rows.test.ts -t "dedup"` | No -- Wave 0 |
| HOME-01c | getActiveSagre returns non-expired active sagre | unit | `npx vitest run src/lib/queries/__tests__/homepage-rows.test.ts -t "active"` | No -- Wave 0 |
| HOME-01d | Horizontal scroll container has correct CSS classes | manual-only | Visual inspection in browser | N/A |
| HOME-01e | Desktop arrow buttons scroll container | manual-only | Visual inspection on desktop viewport | N/A |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + visual inspection in dev server before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/home/__tests__/ScrollRowSection.test.ts` -- covers HOME-01a (min threshold)
- [ ] `src/lib/queries/__tests__/homepage-rows.test.ts` -- covers HOME-01b, HOME-01c (dedup, query)
- [ ] Tests require mocking Supabase client -- use vitest `vi.mock`

*(Note: Scroll behavior, snap alignment, and visual appearance are not meaningfully unit-testable. These require manual browser testing.)*

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS scroll-snap-type docs](https://tailwindcss.com/docs/scroll-snap-type) -- `snap-x`, `snap-mandatory`, `snap-proximity` utilities confirmed for v4
- [Tailwind CSS scroll-snap-align docs](https://tailwindcss.com/docs/scroll-snap-align) -- `snap-start`, `snap-center`, `snap-end` utilities confirmed for v4
- [Tailwind CSS scroll-padding docs](https://tailwindcss.com/docs/scroll-padding) -- `scroll-pl-*` utilities confirmed built-in for v4
- [MDN scroll-snap-stop](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-stop) -- `always` value widely available since July 2022

### Secondary (MEDIUM confidence)
- [MDN CSS scroll-snap guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap) -- general scroll snap implementation guidance
- Existing project codebase: `globals.css` `scrollbar-hide` utility, `QuickFilters.tsx` horizontal scroll pattern, `page.tsx` parallel query pattern

### Tertiary (LOW confidence)
- None -- all findings verified against official docs and existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in the project; no new dependencies
- Architecture: HIGH -- extending established patterns (server component + parallel queries + client scroll); well-documented CSS scroll-snap
- Pitfalls: HIGH -- based on real browser behavior documented in MDN; dedup concern is project-specific but straightforward
- Data strategy: MEDIUM -- dedup approach is sound but "right" number of categories depends on live event count which varies seasonally

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- no fast-moving dependencies)
