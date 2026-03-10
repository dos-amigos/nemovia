# Phase 17: Visual Effects, Layout & Performance - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the WOW-factor visual experience: glassmorphism on navigation, mesh gradient backgrounds, bento grid homepage layout, SagraCard redesign with image overlay, and LazyMotion bundle optimization. All visual effects layer on the coral/teal OKLCH palette finalized in Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Glassmorphism
- Subtle frost intensity: 8-12px backdrop-blur, 80-90% opacity
- Thin light border: 1px border with white/10-20% opacity for glass edge highlight
- Neutral cool gray tint on glass (no color tint, matches hue 260 neutrals)
- Scope: TopNav and BottomNav get full glass treatment, plus floating overlays (map controls, search pill). SagraCards stay solid -- no glass on cards
- Performance constraint: blur <=12px, max 2-3 blur surfaces per viewport on mobile (UI-11)

### Homepage Bento Grid
- Full-width hero at top (not embedded in grid)
- Below hero: featured sagra card (2 cols wide, taller ~300px+) alongside smaller regular cards
- Province quick filters as a horizontal scrollable row
- Rounded cells with 12-16px gap, each cell has rounded corners and subtle shadow
- Mobile: stacks vertically (single column), featured card full-width, smaller cards 1-per-row
- Desktop: CSS Grid with named areas, asymmetric editorial layout

### SagraCard Redesign
- Image overlay layout: title, date, and location text overlay on the image with dark gradient overlay for readability
- Image takes full card height (not just 160px top section)
- No-image cards keep the existing branded placeholder gradient with utensil icon, title overlays on the gradient
- Featured card in bento grid is a bigger version of the same overlay design (300px+ height, possible subtle parallax)
- Existing motion hover/tap effects preserved
- Food tags and price info visible on tap/detail page only (not on overlay)

### Mesh Gradients
- Static mesh gradients (pure CSS radial gradient layers, no animation, zero JS cost)
- Color palette: coral (primary) + teal (accent) radial blobs on cool gray base
- Intensity: noticeable (15-25% opacity) -- visible gradient blobs, not a faint wash
- Scope: homepage hero section AND search/map page backgrounds (cohesive brand feel)
- Implementation: layered radial-gradient() in CSS, positioned at different corners/offsets

### LazyMotion (Claude's Discretion)
- Migration from full `motion` import to `LazyMotion` + `m` components
- Target: ~34KB to ~5KB initial animation bundle
- Implementation details left to Claude -- straightforward mechanical migration
- Must not regress any existing animation (hover, tap, page transitions, scroll reveals)

### Claude's Discretion
- Exact blur/opacity values within the specified ranges
- CSS Grid template specifics (column/row definitions, area names)
- Dark gradient overlay intensity on image cards (enough for text readability)
- Mesh gradient blob positioning and radial-gradient() layering
- LazyMotion migration approach (which features to lazy-load)

</decisions>

<specifics>
## Specific Ideas

- "WOW effect" -- design all'avanguardia, modernissimo (user's core vision)
- Reference apps: Linear, Vercel, Raycast, Arc Browser for modern aesthetic
- Apple iOS nav bar style for glassmorphism reference
- Airbnb/Booking card style for image overlay cards

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TopNav` (src/components/layout/TopNav.tsx): Already has `bg-background/95 backdrop-blur` -- near-glass, needs border + refinement
- `BottomNav` (src/components/layout/BottomNav.tsx): Solid bg currently, needs glassmorphism
- `SagraCard` (src/components/sagra/SagraCard.tsx): Well-structured with motion hover/tap, uses FadeImage, Card/CardContent from Shadcn
- `HeroSection` (src/components/home/HeroSection.tsx): Simple gradient, needs mesh gradient + possible redesign
- `FadeImage` (src/components/animations/FadeImage.tsx): Reusable for image overlay cards
- `Providers.tsx`: Wraps MotionConfig -- will need LazyMotion wrapper added here

### Established Patterns
- `motion/react` imports across 12 files -- all need LazyMotion migration
- Semantic CSS tokens throughout (bg-primary, text-accent, etc.) -- mesh gradients should use these
- `cn()` utility for conditional class merging
- FrozenRouter pattern for AnimatePresence exit animations

### Integration Points
- Homepage (src/app/(main)/page.tsx): Server component, renders Hero + QuickFilters + WeekendSection + ProvinceSection -- will need grid wrapper
- globals.css: CSS custom properties -- mesh gradient classes could go here
- MapFilterOverlay, LocationButton, SearchResults: Already use backdrop-blur -- consistent glass treatment

</code_context>

<deferred>
## Deferred Ideas

- **Map filtering UI** -- "filtri sopra la mappa che deve mostrare solo quello che i filtri stanno filtrando" -- this is a new capability (filter-driven map view), belongs in its own phase
- **Sagre in Toscana** -- user reports seeing non-Veneto events -- data quality issue, separate from visual redesign

</deferred>

---

*Phase: 17-visual-effects-layout-performance*
*Context gathered: 2026-03-10*
