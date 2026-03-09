# Feature Research

**Domain:** Data quality filtering + UI/UX redesign for food festival (sagre) aggregator
**Researched:** 2026-03-09
**Milestone:** v1.3 "Dati Puliti + Redesign"
**Confidence:** HIGH (data quality) / MEDIUM (UI redesign -- design trends require subjective validation)

## Existing State Assessment

Features already built that this milestone extends or fixes:

| Existing Feature | Status | Relevance to v1.3 |
|------------------|--------|-------------------|
| `isNoiseTitle()` heuristic filter | Built (scrape-sagre) | Catches some junk but misses calendar titles, non-sagre events |
| `parseItalianDateRange()` | Built | Parses dates but does not validate duration or reject impossible ranges |
| `find_duplicate_sagra` RPC | Built (PostgreSQL) | Exact-match dedup by normalized title + city + dates. No fuzzy matching. |
| Expire cron job | Built (pg_cron daily) | Deactivates past events but may not catch 2025 events correctly |
| Veneto province gating | Built (enrich-sagre) | Filters non-Veneto after geocoding. Working correctly. |
| Gemini structured output enrichment | Built | Tags + descriptions. Could be extended to classify event type. |
| OKLCH color system in globals.css | Built | amber-600 primary, green-700 accent, stone-50 background. Ready to swap. |
| Shadcn/UI component library | Built | Provides base components. Theme swap via CSS variables is trivial. |
| Motion animation system | Built | FadeIn, StaggerGrid, ScrollReveal, ParallaxHero, page transitions all exist |
| Responsive desktop layout | Built (v1.2) | TopNav, multi-col grids, side-by-side detail already done |

---

## Track 1: Data Quality Features

### Table Stakes (Users Expect Clean Data)

Features that fix visible data corruption. Users seeing junk events = immediate loss of trust.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Expired event removal (2025 events)** | Events from 2025 are still showing in March 2026. The expire cron must check `end_date < NOW()` and also handle events with no end_date where `start_date < NOW() - interval '3 days'`. Users opening the app see stale events and assume the data is abandoned. | LOW | Expire SQL query fix. No code dependencies. Run once as retroactive cleanup + fix cron logic. |
| **Calendar date rejection** | Dates like "1 gennaio - 31 gennaio" or "1 gen - 31 dic" are calendar page artifacts, not real sagra dates. Real sagre last 1-7 days max, with rare exceptions up to 14 days. Duration > 14 days should be flagged as suspicious and rejected. | LOW | Add duration validation to `scrape-sagre` after `parseItalianDateRange()`. If `endDate - startDate > 14 days`, mark as noise. |
| **Junk title filter enhancement** | Current `isNoiseTitle()` catches "Calendario mensile" but misses patterns like "Calendario eventi sagre [month] [region]", "Sagre del mese di [month]", generic listing titles. These are navigation/index page artifacts, not event names. | LOW | Extend `isNoiseTitle()` regex patterns. Add: titles containing multiple month names, "del mese di", "eventi in [region]", and titles that are pure category listings. |
| **Duplicate detection improvement** | Same junk event appears multiple times because `find_duplicate_sagra` matches on normalized_title + city + start_date. If the junk passes with slightly different dates or missing city, it creates duplicates. Need fuzzy matching on title similarity. | MEDIUM | Enhance `find_duplicate_sagra` RPC to use `pg_trgm` trigram similarity for fuzzy title matching (threshold 0.7). PostgreSQL extension, no external deps. |
| **Past-year event filtering** | Events scraped with year 2025 dates should be auto-rejected at scrape time, not just expired later. The scraper currently accepts any parsed date regardless of year. | LOW | Add year check in `scrape-sagre`: if `startDate` year < current year, skip the event. Simple integer comparison. |

### Differentiators (Better Than Competitors)

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **"Is it a sagra?" LLM classifier** | Non-sagre events (antique markets, art exhibitions, trade fairs) slip through because the scraper has no concept of event type. Use Gemini to classify: `{type: "sagra" | "mercato" | "mostra" | "fiera" | "altro", confidence: 0.0-1.0, reason: "..."}`. Only keep events classified as "sagra" or "fiera gastronomica" with confidence > 0.7. This is the single highest-impact data quality feature. | MEDIUM | Add classification step to `enrich-sagre` Edge Function, between geocoding and tag enrichment. Use Gemini structured output with enum response schema. Batch 8 events per request (same as current enrichment). Adds ~2s per batch. |
| **Image quality gating** | Scraped images are often tiny thumbnails (50x50, 100x75). These look terrible on cards with `h-40` (160px) height. Filter images below a minimum dimension threshold (e.g., width < 200px or height < 150px). Replace sub-threshold images with the styled placeholder (gradient + icon). | LOW | At scrape time or enrich time, HEAD request the image URL and check `Content-Length` (very small = likely thumbnail) or, better, fetch image headers to get dimensions. If below threshold, set `image_url = null` so the placeholder renders. |
| **Higher-resolution image extraction** | Many source sites serve thumbnail URLs in listing pages but have full-res images on detail pages. Scraping the detail page URL for each event to find `<meta property="og:image">` or the largest `<img>` could yield much better images. | HIGH | Requires a second scraping pass per event (detail page fetch). Rate-limited by politeness delays. Could add 5-10 minutes per scraper run. Best done as a separate enrichment step, not blocking the main scrape. |
| **Automated data quality dashboard** | Track metrics over time: % of events rejected by each filter, % with images, % with valid dates, duplicate rate. Log to `data_quality_logs` table. Helps detect when a source site changes format and breaks the scraper. | LOW | New DB table + INSERT at end of each scrape/enrich run. No UI needed initially -- query via Supabase dashboard. |

### Anti-Features (Data Quality)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **ML-based title classification** | "Use a trained model to detect junk titles" | Overkill for ~735 events. Training data doesn't exist. The junk patterns are deterministic (regex-catchable). ML adds latency, cost, and a model to maintain. | Extend `isNoiseTitle()` with more regex patterns. If false negatives persist, use Gemini classifier (already integrated) as a second pass. |
| **Manual curation queue** | "Let an admin review flagged events before they go live" | No admin users exist. The app has zero authentication. Building an admin panel is out of scope for a solo project. Adds maintenance burden. | Auto-reject with high-confidence rules. Low-confidence events (Gemini score 0.5-0.7) get `is_active = false` and can be manually activated via Supabase dashboard if needed. |
| **Cross-source deduplication by event URL** | "Same event on eventiesagre and assosagre should merge" | Already handled by `find_duplicate_sagra` which deduplicates by normalized title + city + dates and merges sources array. URL-based dedup adds little value since source URLs are always different across sites. | Keep current dedup. Enhance with trigram similarity for fuzzy title matching. |
| **OCR on event poster images** | "Extract dates and details from locandina images" | Requires vision LLM or separate OCR service. High latency, high error rate on stylized poster text. Free-tier Gemini vision has limited capacity. | Defer to v2+. Text extraction from HTML is sufficient for now. |

---

## Track 2: UI/UX Redesign Features

### Table Stakes (Modern Web App in 2026)

These are foundational for any redesign. Without them, new colors/effects feel like lipstick on a pig.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Color palette refresh** | Current amber-600/stone-50 reads as "food blog template 2020." Modern apps (Linear, Vercel, Raycast) use deeper, richer palettes with intentional contrast. A contemporary food discovery app should feel warm but sophisticated -- not generic. | LOW | Swap OKLCH CSS variables in `globals.css`. All components use CSS variables already, so the change propagates automatically. No component code changes needed. |
| **Typography upgrade (Geist)** | Inter is fine but generic. Geist, Vercel's typeface, has slightly rounder curves and friendlier apertures that align with the reference apps (Linear, Vercel, Raycast). Available via `next/font/google` with zero additional installs. Geist Mono provides complementary monospace for data-dense elements (dates, distances, prices). | LOW | Replace Inter import in `layout.tsx` with Geist + Geist_Mono. Update CSS variable in globals.css `@theme inline`. 3-line change total. |
| **Refined spacing and proportions** | Current spacing feels tight in some areas (card content `p-3`) and loose in others. A consistent 4px/8px grid with intentional density creates visual rhythm. | LOW | Audit component padding/margin values. Standardize on Tailwind spacing scale. |
| **Card component redesign** | Current SagraCard is functional but generic: rectangular image, stacked text. Modern cards use rounded corners (radius-xl+), subtle borders, refined shadows, and better information hierarchy. The image-to-content ratio should feel balanced. | MEDIUM | Redesign SagraCard.tsx. New visual treatment while keeping same data props. Larger corner radius, refined shadow, better tag presentation. |
| **Consistent icon style** | Lucide icons are good but used inconsistently. Some are 3.5, some 4, some 5. Standardize sizes by context (nav: 5, card meta: 4, inline: 3.5). | LOW | Audit icon sizes across components. Define size constants. |

### Differentiators (WOW Effect)

These create the "questo non sembra un sito di sagre" reaction the user wants.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Glassmorphism navigation bar** | Frosted glass effect on TopNav and BottomNav using `backdrop-blur-xl bg-white/70` (or dark variant). Navigation floats over content with blur, creating depth without heaviness. This is the signature effect of Linear/Arc/Raycast. Tailwind v4 supports `backdrop-blur` natively. | LOW | Update TopNav.tsx and BottomNav.tsx: add `backdrop-blur-xl bg-white/70 border-b border-white/20`. Position `sticky top-0 z-50`. Browser support is excellent (all modern browsers except legacy Firefox ESR). |
| **Mesh gradient hero** | Replace the flat `bg-gradient-to-br from-amber-50 via-orange-50 to-green-50` with an animated mesh gradient using layered radial gradients. CSS-only, no JS. Creates a living, breathing hero section that feels premium. Reference: Apple product pages, Stripe landing page. | MEDIUM | Create mesh gradient with 4-5 positioned `radial-gradient()` layers in CSS. Animate positions with `@keyframes` for subtle movement. Respect `prefers-reduced-motion`. |
| **Bento grid homepage layout** | Replace the current linear stack (hero, quick filters, weekend, provinces) with a bento grid layout on desktop. Cards of varying sizes create visual interest and information density. Weekend sagre get hero-sized tiles, provinces get compact tiles, filters get a dedicated tile. | MEDIUM | Desktop-only layout change. Use CSS Grid with `grid-template-areas` and `grid-template-rows` for named regions. Mobile stays linear stack. New `BentoGrid` component wrapping existing sections. |
| **Subtle grain/noise texture overlay** | A barely-visible noise texture (CSS `url(data:image/svg+xml,...)` or tiny repeating PNG) over backgrounds adds organic warmth and depth. This is a hallmark of premium design (Raycast, Notion, Arc). Prevents backgrounds from looking "too digital." | LOW | Single CSS pseudo-element (`::after`) on the body or main container with `opacity: 0.03-0.05`, `pointer-events: none`. SVG noise pattern inlined as data URI (~200 bytes). |
| **Animated gradient borders on focus/hover** | Cards and inputs get a subtle animated gradient border on hover/focus instead of a static color. Creates a premium interactive feel. Reference: Vercel's input focus states, GitHub Copilot cards. | LOW | CSS `background-image: linear-gradient()` on a pseudo-element with `background-size: 200%` animated. Or use `@property` for direct gradient animation. |
| **LazyMotion migration** | Reduce Motion bundle from 34KB to 6KB initial load. Since every component is being touched for the redesign, this is the perfect time to migrate from `motion.div` to `m.div` + `LazyMotion` provider. | MEDIUM | Update Providers.tsx with LazyMotion. Replace all `motion` imports with `m` across 15+ components. Use `strict` mode to catch missed imports. |
| **Premium loading states** | Replace shimmer skeletons with more refined versions: slightly colored tint matching section context (warm shimmer for food sections, neutral for navigation). Skeleton shapes more closely match final content with rounded pill shapes for text. | LOW | Update Skeleton component with contextual color variants. Refine existing shimmer animation timing. |

### Anti-Features (UI/UX)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full dark mode** | "Modern apps have dark mode" | Doubles the CSS variable surface area. Sagre are outdoor daytime events -- dark mode is semantically wrong for the brand. User specifically asked for "colori WOW" not dark theme. Adds testing burden for every visual change. | Rich, warm light theme with deep saturated colors. Optional: subtle tinted backgrounds (dark teal/navy header section) for contrast without full dark mode. |
| **Neo-brutalism style** | "It's trendy in 2025-2026" | Deliberately ugly aesthetic (thick black borders, raw colors, exposed grid) conflicts with the "curato" (curated/polished) tone from PROJECT.md. Neo-brutalism works for creative portfolios, not food discovery. | Refined modern aesthetic: clean lines, subtle depth (glassmorphism), warm colors. |
| **3D elements / Three.js** | "3D globe or interactive food models" | Massive bundle cost (Three.js ~150KB min), GPU-intensive, kills mobile performance, adds complexity far beyond the project scope. Zero value for finding a sagra this weekend. | CSS-only depth effects: layered gradients, subtle parallax, box-shadow depth. These create perceived 3D without the performance cost. |
| **Full-page scroll hijacking** | "Smooth section-by-section scrolling" | Lenis already rejected in v1.2 for Leaflet conflicts. Full-page scroll hijack (fullPage.js style) destroys content scanning speed. Users want to quickly scroll through cards, not watch animations. | Native scroll with subtle scroll-linked animations (already built). Fast, interruptible, accessible. |
| **Animated page backgrounds (particles, waves)** | "Marketing site wow effect" | Performance killer on mobile. Distracts from content. Battery drain. This is a utility app, not a landing page. | Static or subtly animated mesh gradient on hero only. Content sections get clean, quiet backgrounds. |
| **Custom cursor** | "Trendy on portfolio sites" | Inaccessible, breaks on touch devices, conflicts with browser defaults, performance cost. No user expects this on an event discovery app. | Standard cursor. Focus on making interactive elements respond to hover/tap with micro-interactions. |
| **Horizontal scroll carousels** | "Swipeable card sections" | Mobile scroll hijack frustration. Accessibility nightmare. Content hidden off-screen. Breaks "scan and compare" behavior users need for choosing a sagra. | Vertical grid with responsive columns. All content visible. Better for comparison. |
| **CSS-in-JS (Emotion/Styled-Components)** | "Dynamic theming" | Tailwind v4 + CSS custom properties already handle theming. CSS-in-JS adds runtime overhead or build complexity. | Stay with Tailwind utilities + OKLCH custom properties. |

---

## Feature Dependencies

```
TRACK 1: DATA QUALITY
======================

Expired 2025 Events Removal (standalone)
  --> Fix expire cron SQL (immediate retroactive cleanup)
  --> No dependencies

Past-Year Date Rejection (standalone)
  --> Add year check to scrape-sagre normalizeRawEvent()
  --> No dependencies

Enhanced Junk Title Filter (standalone)
  --> Extend isNoiseTitle() regex patterns
  --> No dependencies

Calendar Date Duration Validation (standalone)
  --> Add duration check after parseItalianDateRange()
  --> Depends on: date parsing working correctly (already does)

Fuzzy Duplicate Detection
  --> Requires: pg_trgm PostgreSQL extension enabled
  --> Modify find_duplicate_sagra RPC to use similarity()
  --> Should run AFTER title filter improvements (so fewer junk titles enter dedup)

"Is it a sagra?" LLM Classifier
  --> Requires: Gemini API (already configured)
  --> Add classification step to enrich-sagre Edge Function
  --> Should run AFTER geocoding, BEFORE tag enrichment
  --> Depends on: Gemini structured output with enum schema

Image Quality Gating
  --> Add dimension/size check at scrape or enrich time
  --> Independent of other features
  --> Enhances: card visual quality (pairs with UI redesign)

Higher-Resolution Image Extraction
  --> Requires: detail page scraping pass (new feature)
  --> Depends on: image quality gating (to know what needs upgrading)
  --> HIGH effort -- consider deferring to v1.4


TRACK 2: UI/UX REDESIGN
========================

Color Palette Refresh (FOUNDATION -- do first)
  --> Swap OKLCH variables in globals.css
  --> ALL visual features depend on this being settled first

Typography Upgrade (Geist)
  --> Replace Inter import in layout.tsx
  --> Independent but should align with color palette timing

Glassmorphism Navigation
  --> Depends on: color palette (blur tints match new palette)
  --> Update TopNav.tsx + BottomNav.tsx

Card Component Redesign
  --> Depends on: color palette + typography (card uses both)
  --> Redesign SagraCard.tsx

Mesh Gradient Hero
  --> Depends on: color palette (gradient colors derive from palette)
  --> Update HeroSection.tsx

Bento Grid Homepage
  --> Depends on: card redesign (bento tiles contain cards)
  --> Desktop-only. Mobile stays linear.

Grain Texture Overlay (standalone)
  --> CSS pseudo-element on body
  --> No dependencies, can be added anytime

Animated Gradient Borders (standalone)
  --> CSS pseudo-element technique
  --> No dependencies

LazyMotion Migration (standalone but time with redesign)
  --> Update Providers.tsx + all motion imports
  --> Best done while touching all components for redesign

CROSS-TRACK:
  Data quality BEFORE redesign
    (Clean data makes redesigned UI look better)

  Image quality gating FEEDS INTO card redesign
    (Fix bad images before designing around them)
```

---

## Phase Recommendation

### Phase 1: Data Quality Cleanup (do first)

Fix the data before redesigning the UI. Users will judge the redesign harshly if junk data is still visible.

- [ ] Fix expire cron to remove 2025 events and events with `end_date < NOW()`
- [ ] Add past-year date rejection in scrape-sagre
- [ ] Enhance `isNoiseTitle()` with new regex patterns
- [ ] Add calendar date duration validation (>14 days = reject)
- [ ] Enable `pg_trgm` and add fuzzy duplicate detection

### Phase 2: LLM Classification + Image Quality

Higher-effort data quality features that use the enrichment pipeline.

- [ ] Add "is it a sagra?" LLM classifier to enrich-sagre
- [ ] Add image quality gating (reject tiny thumbnails)
- [ ] Retroactive cleanup run on existing 735 events

### Phase 3: Visual Foundation (color + typography + structure)

Establish the new design system before building effects on top.

- [ ] New OKLCH color palette in globals.css
- [ ] Geist font swap (layout.tsx + globals.css)
- [ ] Grain texture overlay (globals.css)
- [ ] Spacing audit and standardization

### Phase 4: Component Redesign + Effects

Apply the new design system to components and add visual effects.

- [ ] SagraCard redesign with new palette and proportions
- [ ] Glassmorphism navigation (TopNav + BottomNav)
- [ ] Mesh gradient hero
- [ ] Animated gradient borders on interactive elements
- [ ] Bento grid homepage layout (desktop)
- [ ] LazyMotion migration
- [ ] Premium loading states

**Rationale:** Data quality first because visible junk undermines any visual improvements. Visual foundation before effects because effects are built on top of the palette and typography decisions. Component redesign last because it depends on both the settled design system and clean data to look right.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Expired 2025 event removal | HIGH | LOW | **P1** |
| Past-year date rejection | HIGH | LOW | **P1** |
| Enhanced junk title filter | HIGH | LOW | **P1** |
| Calendar date duration validation | HIGH | LOW | **P1** |
| Fuzzy duplicate detection | HIGH | MEDIUM | **P1** |
| "Is it a sagra?" LLM classifier | HIGH | MEDIUM | **P1** |
| Image quality gating | MEDIUM | LOW | **P2** |
| Color palette refresh | HIGH | LOW | **P1** |
| Geist font swap | MEDIUM | LOW | **P1** |
| Glassmorphism navigation | HIGH | LOW | **P1** |
| Card component redesign | HIGH | MEDIUM | **P1** |
| LazyMotion migration | MEDIUM | MEDIUM | **P1** |
| Mesh gradient hero | MEDIUM | MEDIUM | **P2** |
| Bento grid homepage | MEDIUM | MEDIUM | **P2** |
| Grain texture overlay | LOW | LOW | **P3** |
| Animated gradient borders | LOW | LOW | **P3** |
| Higher-res image extraction | MEDIUM | HIGH | **P3** (defer) |
| Data quality dashboard | LOW | LOW | **P3** |

**Priority key:**
- P1: Must have for v1.3 launch. Directly addresses user-reported problems or creates the WOW effect.
- P2: Should have. Enhances the experience but not blocking.
- P3: Nice to have. Can ship without or defer to v1.4.

---

## Sources

### Data Quality (HIGH confidence)
- [PostgreSQL pg_trgm documentation](https://www.postgresql.org/docs/current/pgtrgm.html) -- trigram similarity for fuzzy dedup
- [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output) -- enum schemas for classification
- [Supabase PostgreSQL Extensions](https://supabase.com/docs/guides/database/extensions) -- pg_trgm availability

### UI/UX Design (MEDIUM confidence)
- [Figma: Web Design Trends 2026](https://www.figma.com/resource-library/web-design-trends/) -- bento grids, vibrant palettes
- [Elementor: Web Design Trends 2026](https://elementor.com/blog/web-design-trends-2026/) -- aurora gradients, organic shapes
- [TheeDigital: Web Design Trends 2026](https://www.theedigital.com/blog/web-design-trends) -- dopamine design, mesh gradients
- [Epic Web Dev: Glassmorphism with Tailwind](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css) -- implementation patterns
- [Shakuro: Best Fonts for Web 2025](https://shakuro.com/blog/best-fonts-for-web-design) -- Geist vs Inter comparison
- [Vercel: Geist Font](https://vercel.com/font) -- font design rationale

---
*Feature research for: Nemovia v1.3 "Dati Puliti + Redesign"*
*Researched: 2026-03-09*
