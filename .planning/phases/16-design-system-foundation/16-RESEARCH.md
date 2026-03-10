# Phase 16: Design System Foundation - Research

**Researched:** 2026-03-10
**Domain:** Typography (Geist font), OKLCH color palette, Shadcn/UI theming, Tailwind v4 CSS variables
**Confidence:** HIGH

## Summary

Phase 16 transforms the visual identity of the Nemovia app through two major changes: replacing the Inter font with Geist (Vercel's purpose-built UI typeface), and replacing the current amber-600/stone-50 color palette with a vibrant, modern OKLCH palette. The codebase is already well-structured for this change -- it uses Tailwind v4 with OKLCH CSS custom properties and Shadcn/UI token conventions, so the palette swap is primarily a matter of updating `globals.css` variables and hunting down a small number of hardcoded color references in components.

The font swap is straightforward: replace the `Inter` import with `Geist` from `next/font/google`, update the CSS variable from `--font-inter` to `--font-geist-sans`, and update the `@theme inline` reference. No new dependencies are needed. The color palette change requires updating ~25 OKLCH values in `:root` CSS variables, then finding and replacing 4 files with hardcoded Tailwind color classes (amber-50, orange-50, green-50, green-300, green-700, green-950, green-800, green-400).

**Primary recommendation:** Update globals.css CSS variables first (font + all color tokens), then sweep components for hardcoded color classes, replacing them with semantic token references (e.g., `bg-accent` instead of `bg-green-50`). Verify with `next build` that no old palette references remain.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Font sostituito da Geist (Vercel) tramite next/font/google per un'estetica moderna e coerente con le reference app | Geist is available via `next/font/google` with zero-config. Import `{ Geist }` instead of `{ Inter }`, set `variable: "--font-geist-sans"`, update `@theme inline` to `--font-sans: var(--font-geist-sans)`. Geist is a variable font -- no weight specification needed. |
| UI-02 | Palette OKLCH completamente rinnovata -- colori vibranti e sofisticati al posto di amber-600/stone-50 | Current palette uses 25 OKLCH CSS custom properties in `:root`. All values must be replaced. New palette recommendation provided in Architecture Patterns section below with specific OKLCH values. |
| UI-03 | Variabili CSS Shadcn aggiornate coerentemente (primary + primary-foreground, tutti i pairs) | All 12 Shadcn token pairs (primary, secondary, accent, muted, destructive, card, popover, border, input, ring, plus sidebar and chart variants) already exist in globals.css. Update all values in a single pass. |
| UI-04 | Tutti i colori hardcoded nei componenti (gradienti, badge, tag) allineati alla nuova palette | Exactly 4 files contain hardcoded color classes: HeroSection.tsx (amber-50, orange-50, green-50), LocationButton.tsx (green-50/300/700/950/800/400), SearchFilters.tsx (green-700/300/50/400/800/950), and globals.css shimmer gradient (oklch literal). All must be replaced with semantic tokens. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/font/google (Geist) | Next.js 15.5.12 | Font loading with zero layout shift | Built-in to Next.js, self-hosts Google Fonts, automatic subset optimization |
| tailwindcss | ^4 | Utility-first CSS with OKLCH support | Already in use, v4 has native OKLCH in `@theme inline` |
| shadcn/ui | ^3.8.5 | Component library with CSS variable theming | Already in use, all components consume CSS custom properties |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Variant management for buttons/badges | Already in use, no changes needed |
| tailwind-merge | ^3.5.0 | Merge conflicting Tailwind classes | Already in use via `cn()` utility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next/font/google (Geist) | `geist` npm package with next/font/local | Extra dependency; next/font/google is simpler and officially documented |
| Manual OKLCH palette | oklch.net palette generator | The generator helps pick colors but final values must be hand-tuned for WCAG contrast |
| Shadcn theme generator (tweakcn.com) | Manual CSS editing | Generators output Shadcn-compatible CSS but may not produce the exact sophisticated aesthetic wanted |

**Installation:**
```bash
# No new packages needed. Geist is available through next/font/google (bundled with Next.js).
```

## Architecture Patterns

### Current Font Setup (to be replaced)
```typescript
// src/app/layout.tsx -- CURRENT (Inter)
import { Inter } from "next/font/google";
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
// body className: `${inter.className} antialiased`
```

```css
/* globals.css -- CURRENT */
@theme inline {
  --font-sans: var(--font-inter);
}
```

### Pattern 1: Geist Font Setup (UI-01)
**What:** Replace Inter with Geist from next/font/google
**When to use:** This is the sole font change for this phase

```typescript
// src/app/layout.tsx -- NEW
import { Geist } from "next/font/google";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// In the body tag:
// <body className={`${geist.className} antialiased`}>
```

```css
/* globals.css -- NEW */
@theme inline {
  --font-sans: var(--font-geist-sans);
}
```

**Source:** [Next.js Font Optimization docs](https://nextjs.org/docs/app/getting-started/fonts) (updated 2026-02-27)

**Key details:**
- Geist is a variable font (weight 100-900) -- no need to specify weight
- `subsets: ["latin"]` is sufficient for Italian content
- The `variable` property creates a CSS custom property, `className` applies the font directly
- Using `className` on `<body>` is the standard pattern (not `variable` on `<html>`)
- No need for Geist_Mono unless monospace is used (it is not in this app)
- This is a server component -- no "use client" needed, same as current Inter setup

### Pattern 2: OKLCH Palette Design (UI-02)
**What:** Replace all `:root` CSS custom properties with a vibrant modern palette
**When to use:** Single update to globals.css `:root` block

The current palette hue centers are: primary at hue 58 (amber), accent at hue 150 (green), neutrals at hue 56/106 (stone/warm gray). The user wants something "WOW, modernissimo" inspired by Linear, Vercel, Raycast, Arc Browser.

**Recommended palette direction:** A warm coral/vermillion primary with teal accent. This gives a sophisticated, food-relevant warmth without the dated amber feel. The coral-teal complementary pair is vibrant and modern.

**Recommended OKLCH values:**

```css
:root {
  --radius: 0.625rem;

  /* Background & Foreground -- cool neutral base */
  --background: oklch(0.985 0.005 260);         /* very light cool gray */
  --foreground: oklch(0.145 0.015 260);          /* near-black cool */

  --card: oklch(0.995 0.002 260);                /* white with cool tint */
  --card-foreground: oklch(0.145 0.015 260);

  --popover: oklch(0.995 0.002 260);
  --popover-foreground: oklch(0.145 0.015 260);

  /* Primary -- warm coral/vermillion */
  --primary: oklch(0.637 0.237 25.5);            /* vibrant coral-red */
  --primary-foreground: oklch(0.985 0.005 260);  /* white */

  /* Secondary -- light cool gray */
  --secondary: oklch(0.960 0.008 260);
  --secondary-foreground: oklch(0.205 0.015 260);

  /* Muted -- subtle cool gray */
  --muted: oklch(0.960 0.008 260);
  --muted-foreground: oklch(0.556 0.015 260);

  /* Accent -- teal */
  --accent: oklch(0.600 0.155 185);              /* vibrant teal */
  --accent-foreground: oklch(0.985 0.005 260);

  /* Destructive -- true red */
  --destructive: oklch(0.577 0.245 27.3);
  --destructive-foreground: oklch(0.985 0 0);

  /* Borders -- cool gray */
  --border: oklch(0.905 0.008 260);
  --input: oklch(0.905 0.008 260);
  --ring: oklch(0.637 0.237 25.5);               /* matches primary */

  /* Charts */
  --chart-1: oklch(0.637 0.237 25.5);            /* coral (primary) */
  --chart-2: oklch(0.600 0.155 185);             /* teal (accent) */
  --chart-3: oklch(0.700 0.150 85);              /* warm gold */
  --chart-4: oklch(0.650 0.200 330);             /* magenta */
  --chart-5: oklch(0.700 0.180 145);             /* emerald */

  /* Sidebar (mirrors main tokens) */
  --sidebar: oklch(0.985 0.005 260);
  --sidebar-foreground: oklch(0.145 0.015 260);
  --sidebar-primary: oklch(0.637 0.237 25.5);
  --sidebar-primary-foreground: oklch(0.985 0.005 260);
  --sidebar-accent: oklch(0.960 0.008 260);
  --sidebar-accent-foreground: oklch(0.205 0.015 260);
  --sidebar-border: oklch(0.905 0.008 260);
  --sidebar-ring: oklch(0.637 0.237 25.5);
}
```

**Accessibility notes:**
- Primary (L=0.637) on white foreground (L=0.985): sufficient contrast for large text and UI elements
- Foreground (L=0.145) on background (L=0.985): exceeds 4.5:1 ratio for body text
- Muted-foreground (L=0.556) on background (L=0.985): meets 3:1 for supplementary text
- All foreground pairs should be verified with a contrast checker after implementation
- Use [OddContrast](https://www.oddcontrast.com/) for OKLCH-native contrast checking

**Important:** These are recommended starting values. The planner/implementer should verify contrast ratios and may adjust lightness values slightly. The hue angles (25.5 for coral, 185 for teal, 260 for cool neutrals) are the design direction; chroma and lightness can be fine-tuned.

### Pattern 3: Shadcn Token Updates (UI-03)
**What:** All 12 token pairs in globals.css use new OKLCH values
**When to use:** Done as part of the palette swap in globals.css

The token structure is already correct. The `@theme inline` block maps each CSS variable to a Tailwind `--color-*` variable. No structural changes are needed -- just value updates.

**Token pairs that must be updated (all 12):**
1. `--background` / `--foreground`
2. `--card` / `--card-foreground`
3. `--popover` / `--popover-foreground`
4. `--primary` / `--primary-foreground`
5. `--secondary` / `--secondary-foreground`
6. `--muted` / `--muted-foreground`
7. `--accent` / `--accent-foreground`
8. `--destructive` / `--destructive-foreground`
9. `--border`
10. `--input`
11. `--ring`
12. `--chart-1` through `--chart-5`
13. `--sidebar` and all sidebar-* variants (7 variables)

### Pattern 4: Hardcoded Color Replacement (UI-04)
**What:** Replace all hardcoded Tailwind color classes with semantic tokens
**When to use:** After the CSS variable palette is updated

**Complete inventory of hardcoded colors (4 files, exhaustive):**

| File | Line | Hardcoded Classes | Replace With |
|------|------|-------------------|--------------|
| `src/components/home/HeroSection.tsx` | 8 | `from-amber-50 via-orange-50 to-green-50` | `from-primary/10 via-primary/5 to-accent/10` (or a semantic gradient using new tokens) |
| `src/components/map/LocationButton.tsx` | 30 | `bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400` | `bg-accent/10 border-accent/30 text-accent` (leverage accent token) |
| `src/components/search/SearchFilters.tsx` | 78 | `text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950` | `text-accent border-accent/30 bg-accent/10` (same pattern as LocationButton) |
| `src/app/globals.css` | 127 | `oklch(0.95 0.001 106)` shimmer highlight | Update to match new `--muted` hue: `oklch(0.95 0.005 260)` |

**No other hardcoded color classes exist** in any component. All other components properly use semantic tokens (`bg-primary`, `text-muted-foreground`, `bg-card`, `border-border`, etc.).

**Additionally:** The dark mode classes in LocationButton and SearchFilters (dark:bg-green-950, etc.) can be removed since the app does not support dark mode (confirmed out of scope in REQUIREMENTS.md).

### Anti-Patterns to Avoid
- **Hardcoding new palette colors in components:** Always use semantic tokens (`bg-primary`, `text-accent`) not raw color names. This was the mistake with the current amber/green hardcodes.
- **Mixing hsl() and oklch():** The project already uses pure OKLCH. Do not introduce any hsl() values.
- **Adding a success semantic token:** The "geo active" green state currently uses hardcoded green. Replace with `accent` token (teal serves the same semantic purpose). Do not create a custom `--success` variable -- it's not a standard Shadcn token and would require @theme inline additions.
- **Changing the @theme inline structure:** The existing mapping from CSS vars to Tailwind color vars is correct and standard. Do not restructure it.
- **Using className instead of variable for font:** The current pattern uses `className` on `<body>` which is correct. Using `variable` on `<html>` and `className` on `<body>` is an alternative but unnecessary here.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OKLCH color selection | Manual guessing of L/C/H values | [oklch.net](https://oklch.net/) color picker | Perceptual uniformity requires proper tooling; guessing leads to inconsistent lightness across hues |
| Contrast checking | Manual math on OKLCH lightness | [OddContrast](https://www.oddcontrast.com/) or [Atmos contrast checker](https://atmos.style/contrast-checker) | WCAG contrast ratios must be computed from relative luminance in sRGB, not OKLCH lightness directly |
| Shadcn theme generation | Writing all 25+ CSS variables by hand | [tweakcn.com](https://tweakcn.com/) as a starting point | Generates valid Shadcn/UI theme CSS with proper foreground pairs |
| Font loading | Self-hosting font files manually | `next/font/google` | Handles subsetting, preloading, CSS variable injection, and prevents layout shift |

**Key insight:** The palette is the creative decision, but the plumbing (CSS variables, @theme inline, font loading) is mechanical. Don't waste time on plumbing -- it's already set up correctly. Focus creative effort on the palette values.

## Common Pitfalls

### Pitfall 1: Layout Shift from Font Swap
**What goes wrong:** Swapping from Inter to Geist changes font metrics (x-height, character width), causing visible layout shift and text reflow.
**Why it happens:** Geist has slightly different metrics than Inter. Elements sized to text content (buttons, badges, nav items) may shift.
**How to avoid:** Use `next/font/google` which automatically handles `size-adjust`, `ascent-override`, and `descent-override` to minimize layout shift. Geist is a variable font so all weights are covered.
**Warning signs:** CLS (Cumulative Layout Shift) increase in Lighthouse; text appearing to "jump" on page load.

### Pitfall 2: Forgetting the Shimmer Gradient
**What goes wrong:** The shimmer animation in globals.css has a hardcoded `oklch(0.95 0.001 106)` that creates a warm-toned shimmer highlight. After palette change, the shimmer looks off-brand.
**Why it happens:** It's buried in a `@layer utilities` block, not in the `:root` variables, so it's easy to miss.
**How to avoid:** Explicitly update the shimmer gradient highlight color to match the new neutral hue. The shimmer should use the same hue angle as `--muted`.

### Pitfall 3: Coral Primary May Need Lightness Adjustment for Small Text
**What goes wrong:** OKLCH L=0.637 with high chroma on white background may not meet 4.5:1 contrast for small body text.
**Why it happens:** WCAG contrast is computed from sRGB relative luminance, not OKLCH lightness. High chroma colors can appear lighter than their L value suggests.
**How to avoid:** Use the primary color only for large text, UI elements (buttons, badges, icons), and interactive states. For small text on white, use `foreground` or `muted-foreground`. Verify with contrast checker.
**Warning signs:** Squinting at primary-colored small text on white background.

### Pitfall 4: Stale CSS Cache in Development
**What goes wrong:** After updating CSS variables, the old palette still shows in the browser.
**Why it happens:** Turbopack hot reload sometimes doesn't fully invalidate CSS. Browser DevTools may cache styles.
**How to avoid:** Hard refresh (Ctrl+Shift+R), clear the `.next` cache folder if needed. Verify in an incognito window.

### Pitfall 5: Dark Mode Classes in Components
**What goes wrong:** LocationButton and SearchFilters have `dark:` prefixed classes that reference old green colors. If dark mode is ever added, these would show stale colors.
**Why it happens:** Components were written with dark mode consideration even though the app doesn't use it.
**How to avoid:** Remove all `dark:` prefixed classes from these components since dark mode is explicitly out of scope. If dark mode is added later (v1.4+), it should use CSS variables not hardcoded colors.

## Code Examples

### Geist Font Migration (UI-01)

```typescript
// Source: https://nextjs.org/docs/app/getting-started/fonts
// src/app/layout.tsx

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // ... unchanged
};

export const viewport: Viewport = {
  // ... unchanged
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${geist.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```css
/* globals.css -- update @theme inline */
@theme inline {
  --font-sans: var(--font-geist-sans);
  /* ... rest unchanged ... */
}
```

### HeroSection Gradient Fix (UI-04)

```tsx
// BEFORE:
<section className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-green-50 ...">

// AFTER:
<section className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 ...">
```

### Location Active State Fix (UI-04)

```tsx
// BEFORE:
className="bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400 shadow-md"

// AFTER:
className="bg-accent/10 border-accent/30 text-accent shadow-md"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `geist` npm package + next/font/local | `next/font/google` with `Geist` import | Google Fonts added Geist in 2024 | No extra dependency needed |
| HSL color space for CSS variables | OKLCH color space | Tailwind v4 (late 2024) / Shadcn 2025 | Perceptually uniform, wider gamut, better palette generation |
| `hsl(var(--primary))` wrapper syntax | Direct `var(--primary)` via @theme inline | Shadcn Tailwind v4 migration | Simpler, no wrapper functions needed |
| Inter as default Next.js font | Geist as default Next.js 15 font | Next.js 15 (late 2024) | Geist designed specifically for UI, better readability at small sizes |

**Deprecated/outdated:**
- `geist` npm package: Still works but unnecessary when using next/font/google
- HSL color values in Shadcn themes: OKLCH is the current standard
- `@layer base { :root { } }` wrapping: Shadcn v4 moved variables outside @layer

## Open Questions

1. **Exact palette hue preferences**
   - What we know: User wants "WOW, modernissimo" inspired by Linear/Vercel/Raycast/Arc. Amber-600 is "old."
   - What's unclear: User may have specific color preferences beyond the coral/teal recommendation.
   - Recommendation: Implement the coral-vermillion primary (hue 25.5) with teal accent (hue 185) as the starting palette. It can be fine-tuned after visual inspection. The structural change (CSS variables) makes palette adjustments trivial.

2. **Geist Mono inclusion**
   - What we know: The app does not currently use monospace fonts anywhere.
   - What's unclear: Whether future features (price tables, data displays) might need it.
   - Recommendation: Do NOT include Geist Mono in this phase. It can be added in a single line if ever needed. Keeping the font bundle minimal is better for performance.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | All text renders in Geist font, loaded via next/font/google | manual-only | Visual inspection + `next build` succeeds | N/A |
| UI-02 | Amber/stone palette completely replaced with vibrant OKLCH | smoke | `npx next build` (no build errors from missing color refs) | N/A -- build check |
| UI-03 | All Shadcn token pairs updated consistently | manual-only | Visual inspection of buttons, badges, cards, inputs | N/A |
| UI-04 | No hardcoded old-palette colors remain | smoke | `grep -r "amber-\|stone-\|from-green\|to-green\|border-green\|bg-green\|text-green" src/ --include="*.tsx" --include="*.css"` | N/A -- grep check |

**Justification for manual-only:** This phase is purely visual/CSS changes with no business logic. The primary validation is:
1. `next build` succeeds (no broken class references)
2. `grep` confirms zero old palette references in src/
3. Visual inspection confirms font renders as Geist and colors are the new palette

### Sampling Rate
- **Per task commit:** `npx next build` (confirms no build breaks)
- **Per wave merge:** `npx next build` + grep check for old color references
- **Phase gate:** Build succeeds + zero grep hits for old palette + visual confirmation

### Wave 0 Gaps
None -- this phase has no unit-testable logic. Validation is build success + grep-based static analysis + visual inspection.

## Sources

### Primary (HIGH confidence)
- [Next.js Font Optimization docs](https://nextjs.org/docs/app/getting-started/fonts) - Geist import syntax, variable font setup, className usage (updated 2026-02-27)
- [Shadcn/UI Theming docs](https://ui.shadcn.com/docs/theming) - CSS variable structure, OKLCH format, @theme inline
- [Shadcn/UI Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) - Migration notes, @theme inline setup
- Codebase analysis of `globals.css`, `layout.tsx`, and all 39 component files in `src/components/`

### Secondary (MEDIUM confidence)
- [oklch.net](https://oklch.net/) - OKLCH color picker for palette design
- [Evil Martians OKLCH guide](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) - OKLCH ecosystem and best practices
- [OddContrast](https://www.oddcontrast.com/) - OKLCH-native contrast checking tool
- [Google Fonts Geist specimen](https://fonts.google.com/specimen/Geist) - Font availability confirmation

### Tertiary (LOW confidence)
- Palette color recommendations (coral/teal direction) are aesthetic judgment based on reference app analysis, not verified against user preferences

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, only import name changes
- Architecture: HIGH - Codebase already uses correct patterns (OKLCH vars, @theme inline, Shadcn tokens). Changes are value updates only
- Pitfalls: HIGH - Complete codebase audit performed, all hardcoded colors inventoried
- Palette recommendation: MEDIUM - Aesthetic direction is sound but user may want adjustments

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain -- font loading and CSS variables don't change frequently)
