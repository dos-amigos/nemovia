# Feature Landscape

**Domain:** Food festival (sagre) aggregator -- UX upgrade + data quality fixes
**Milestone:** v1.4 "Esperienza Completa"
**Researched:** 2026-03-10
**Overall confidence:** HIGH (implementation patterns well-established, zero novel technology)

## Existing State Assessment

Features already built that v1.4 extends, replaces, or fixes:

| Existing Feature | Status | Relevance to v1.4 |
|------------------|--------|-------------------|
| HeroSection (mesh gradient + CTA link) | Built (v1.3) | **Replace** with photo hero + search bar + city autocomplete |
| QuickFilters (horizontal chip scroll) | Built (v1.0) | **Keep** but move below Netflix rows |
| Bento grid homepage | Built (v1.3) | **Replace** with Netflix-style horizontal scroll rows |
| WeekendSection (standard grid) | Built (v1.0) | **Replace** -- content moves into scroll rows |
| ProvinceSection (grid of province links) | Built (v1.0) | **Replace** with province scroll row |
| SearchFilters (nuqs-driven, geo, raggio Input) | Built (v1.0) | **Extend** with city autocomplete field + radius slider |
| TopNav (glassmorphism, text logo) | Built (v1.2) | **Replace** text logo with SVG logo |
| BottomNav (glassmorphism) | Built (v1.2) | **Keep** |
| Main layout (max-w-7xl container) | Built (v1.2) | **Modify** for full-width sections |
| SagraCard (image overlay) | Built (v1.3) | **Keep** -- used inside scroll rows |
| FeaturedSagraCard | Built (v1.3) | **Keep** for potential use in hero area |
| MapView on /cerca | Built (v1.0) | **Fix** -- currently broken |
| MapView on /mappa | Built (v1.0) | **Extend** with filter overlay at top |
| Branded placeholder (gradient + icon) | Built (v1.3) | **Fix** -- not visible, needs Unsplash fallback |
| Heuristic filters + LLM classification | Built (v1.3) | **Extend** with tighter Veneto gating + non-sagre cleanup |
| Scraping pipeline (5 sources) | Built (v1.1) | **Investigate** event count drop + add new sources |

---

## Table Stakes

Features users expect. Missing any of these = product feels incomplete or broken.

### TS-1: Fix Broken Map on Search Page

| Attribute | Detail |
|-----------|--------|
| **Why expected** | The /cerca page advertises a list/map toggle. Clicking "Mappa" does nothing or shows a blank map. A broken feature is worse than no feature. |
| **Complexity** | LOW |
| **Dependencies** | Existing MapView.dynamic.tsx, ViewToggle, SearchFilters |
| **Notes** | Likely a state sync issue between nuqs filters and map data fetching. The map probably needs the same filtered sagre data passed as markers. Debug before building new features. |

### TS-2: Fix Branded Placeholder Images Not Visible

| Attribute | Detail |
|-----------|--------|
| **Why expected** | Cards with missing images show a faint gradient + icon that is nearly invisible against the light background. Users see blank cards. |
| **Complexity** | LOW |
| **Dependencies** | SagraCard, FeaturedSagraCard |
| **Notes** | Two paths: (1) Increase gradient opacity and icon visibility, (2) Use Unsplash food fallback images. Recommend path 2 -- every card should have an image. |

### TS-3: Unsplash Fallback Images for Missing/Low-Res Photos

| Attribute | Detail |
|-----------|--------|
| **Why expected** | A premium visual product cannot show empty placeholders or pixelated thumbnails. Users judge quality by image quality. |
| **Complexity** | MEDIUM |
| **Dependencies** | Unsplash API account, Next.js Image optimization, SagraCard |
| **Implementation approach** | Pre-fetch a curated set of Italian food/festival images from Unsplash keyed by food_tag (e.g., "pesce" -> fish dishes, "carne" -> grilled meat). Store URLs in a static map or Supabase table. Assign at enrichment time, not at render time. This avoids runtime API calls entirely. |
| **Unsplash constraints** | **Demo mode: 50 req/hr.** Production approval needed for 5,000 req/hr. Attribution required: photographer name + link to Unsplash profile with UTM params. Image URLs must be hotlinked directly (images.unsplash.com does not count against rate limit). Must trigger `/photos/:id/download` endpoint on each download for tracking. |
| **Caching strategy** | Pre-fetch 50-100 food images at build time or via a one-time script. Store the Unsplash URLs + photographer attribution in Supabase. Assign a random food-tag-matched URL to sagre missing images during enrichment. Never call Unsplash API at request time. |
| **Attribution** | Display "Photo by [Photographer] on Unsplash" somewhere accessible -- footer, image tooltip, or detail page. Not required on every card but must be reachable. |

### TS-4: Province Always Visible After City Name

| Attribute | Detail |
|-----------|--------|
| **Why expected** | "Zugliano" means nothing to most users. "Zugliano (VI)" instantly locates it. Province context is essential for a regional discovery app. |
| **Complexity** | LOW |
| **Dependencies** | SagraCard, FeaturedSagraCard, detail page, map popups |
| **Notes** | The `province` field already exists in the DB and is already shown conditionally in SagraCard (`{sagra.province && \`(\${sagra.province})\`}`). Issue may be that some records have null province. Fix at data level (ensure enrichment always sets province) and at display level (always format as "City (XX)"). |

### TS-5: Fix Events Outside Veneto

| Attribute | Detail |
|-----------|--------|
| **Why expected** | "San Miniato" (Tuscany) appearing in a Veneto app destroys credibility. Users will not trust the data. |
| **Complexity** | LOW |
| **Dependencies** | enrich-sagre Edge Function, Nominatim geocoding |
| **Notes** | The Veneto gating already exists (checks province after geocoding). Issue is likely: (a) some events bypass enrichment, (b) province extraction from Nominatim response is flawed for edge cases, or (c) events were imported before gating was added and never cleaned. Need retroactive cleanup query + gating audit. |

### TS-6: Fix Non-Sagre Events Still Present

| Attribute | Detail |
|-----------|--------|
| **Why expected** | "Passeggiata lungo il fiume" and "Carnevale di Venezia" are not food events. Their presence signals broken data quality. |
| **Complexity** | LOW-MEDIUM |
| **Dependencies** | LLM is_sagra classification (v1.3), heuristic filters |
| **Notes** | The LLM classification exists but may have false negatives or was not applied retroactively. Need: (1) Check if is_sagra field is properly filtering in queries, (2) Run retroactive LLM classification on events that predate v1.3, (3) Add explicit heuristic rules for known non-sagra patterns ("passeggiata", "carnevale", "mercatino", etc.). |

### TS-7: Investigate and Fix Event Count Drop (26 vs 735)

| Attribute | Detail |
|-----------|--------|
| **Why expected** | Going from 735 to 26 active events means the app looks empty and abandoned. This is a critical data pipeline issue. |
| **Complexity** | MEDIUM-HIGH |
| **Dependencies** | All 5 scraper sources, cron jobs, heuristic filters, LLM classification |
| **Investigation areas** | (1) Are scrapers still running? Check pg_cron logs. (2) Are source websites still accessible? Test each URL. (3) Did heuristic filters become too aggressive? Check how many events are being rejected. (4) Is the expire cron deactivating current events? Check query logic. (5) Seasonal factor -- March may genuinely have fewer sagre than summer. (6) Are new events being scraped but failing enrichment? |
| **Notes** | This is the most critical issue in v1.4. An aggregator with 26 events is useless. Must be investigated first before building UI features. |

---

## Differentiators

Features that set Nemovia apart. Not expected in a basic aggregator, but create the "wow" factor.

### D-1: Netflix-Style Horizontal Scroll Rows

| Attribute | Detail |
|-----------|--------|
| **Value proposition** | Transforms the homepage from a static grid into a browsable, Netflix-like discovery experience. Each row = a smart category. Users can scan 4-5 categories without scrolling the page much. This is the signature UX pattern of modern content discovery apps. |
| **Complexity** | MEDIUM |
| **Dependencies** | SagraCard (reuse), new query functions for row data, scroll container component |

**Implementation details:**

**Scroll Container Architecture:**
- Use native CSS `overflow-x: auto` with `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on each card
- Use `scroll-padding-inline` to account for page edge padding
- Tailwind classes: `flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide` on container, `snap-start shrink-0` on each card item
- Card width: `w-[280px]` fixed width, or `w-[75vw] sm:w-[45vw] lg:w-[280px]` responsive
- **Peek effect**: Container must extend to screen edge but cards respect page padding. Use negative margin + padding trick: `mx-[-1rem] px-4` so the scroll extends full-width while first card aligns with content

**Mobile (touch) behavior:**
- Native swipe scrolling via `overflow-x: auto` -- no JS library needed
- `scroll-snap-type: x mandatory` ensures cards snap cleanly after swipe
- `-webkit-overflow-scrolling: touch` for iOS momentum scrolling (Tailwind: included by default)
- Use `scroll-snap-type: x proximity` instead of `mandatory` to be less aggressive -- allows natural overscroll

**Desktop (mouse/trackpad) behavior:**
- Add left/right arrow buttons that appear on hover (`group` + `group-hover:opacity-100`)
- Arrows use `scrollBy({ left: cardWidth, behavior: 'smooth' })` via a ref to the scroll container
- Hide arrows on mobile: `hidden lg:flex`
- Arrows positioned absolute at vertical center of the row, left/right edges

**Row categories (smart mix):**

| Row | Query Logic | Notes |
|-----|-------------|-------|
| "Questo weekend" | `start_date <= nextSunday AND (end_date >= today OR end_date IS NULL)` | Already exists as `getWeekendSagre()`, increase limit |
| "Vicino a te" | PostGIS `find_nearby_sagre` with browser geolocation | Only show if user grants location. Fallback: hide row. |
| "Gratis" | `is_free = true AND active AND not expired` | Always popular filter |
| Per provincia (e.g., "A Padova", "A Verona") | `province = X` with highest count first | Dynamic -- only show provinces with 3+ events |
| Per cucina (e.g., "Pesce", "Carne") | `food_tags @> ARRAY['Pesce']` | Dynamic -- only show tags with 3+ events |

**Accessibility:**
- `role="region"` + `aria-label="Sagre questo weekend"` on each row
- Arrow buttons: `aria-label="Scorri a destra"` / `aria-label="Scorri a sinistra"`
- `tabindex="0"` on scroll container for keyboard navigation
- Respect `prefers-reduced-motion`: disable snap animation

**No external carousel library needed.** CSS scroll snap + a 30-line React component is sufficient. Avoid SwiperJS, Embla, or similar -- they add bundle weight for no benefit when native CSS handles the core behavior.

### D-2: Photo Hero Section with Unsplash

| Attribute | Detail |
|-----------|--------|
| **Value proposition** | A beautiful full-width hero with a real food/festival photo immediately signals quality. The current mesh gradient hero is pleasant but generic -- it could be any app. A food photo says "sagre" instantly. |
| **Complexity** | MEDIUM |
| **Dependencies** | Unsplash API (or pre-fetched curated images), Next.js Image, ParallaxHero component (already exists) |

**Implementation details:**

**Image source strategy:**
- Pre-select 10-15 high-quality landscape photos from Unsplash matching "Italian food festival", "sagra italiana", "outdoor food market Italy"
- Store URLs + attribution in a constants file or Supabase table
- Rotate image: pick randomly or cycle daily (use date-based seed for consistency across SSR)
- Use Unsplash dynamic resize params: `?w=1600&q=80&fm=webp` for optimal quality/size

**Layout structure:**
```
[Full-width hero container: relative, h-[400px] lg:h-[500px]]
  [Background image: absolute inset-0, object-cover, Next.js Image with priority]
  [Dark gradient overlay: absolute inset-0, bg-gradient-to-t from-black/60 via-black/25 to-black/10]
  [Content container: absolute bottom-0 left-0 right-0, p-6 lg:p-12]
    [H1: "SCOPRI LE SAGRE DEL VENETO" -- text-white, text-3xl lg:text-5xl, font-bold]
    [Subtitle: "Trova sagre ed eventi gastronomici nella tua zona" -- text-white/80]
    [Search bar: city autocomplete input -- see D-3]
```

**Full-width approach:**
- Hero must break out of the `max-w-7xl` container
- Use negative margins: `mx-[calc(-50vw+50%)]` or render hero outside the container in layout
- Better approach: restructure homepage to render hero before the container `<main>` content

**Parallax:**
- Reuse existing `ParallaxHero` component which already handles mobile parallax + desktop static
- The `y` transform from `useScroll` creates subtle depth when scrolling

**Responsive:**
- Mobile: `h-[350px]`, smaller text, search bar full-width below hero text
- Desktop: `h-[500px]`, larger text, search bar inline or below text
- Always: `object-cover` with `object-position: center` for smart cropping

**Performance:**
- Use `priority` prop on Next.js Image to preload LCP image
- `sizes="100vw"` since hero is always full viewport width
- Consider `placeholder="blur"` with a base64 blur data URL for instant loading feel

### D-3: City Autocomplete Search with Radius

| Attribute | Detail |
|-----------|--------|
| **Value proposition** | "Cerca per nome, citta..." is a passive link to /cerca. A real search bar with city autocomplete lets users start their journey from the homepage. Type "Pad..." and see "Padova (PD)" appear. Select it and get redirected to /cerca with city + radius pre-filled. |
| **Complexity** | MEDIUM |
| **Dependencies** | Local Veneto city database, Shadcn Combobox, nuqs URL params, SearchFilters |

**CRITICAL: Nominatim forbids autocomplete.** The Nominatim usage policy explicitly states: "Auto-complete search is not yet supported by Nominatim and you must not implement such a service on the client side using the API." Using Nominatim for keystroke-by-keystroke autocomplete would violate their policy and risk IP bans.

**Solution: Local city database for Veneto.**
- Veneto has ~563 comuni (municipalities). This is a small enough dataset to ship client-side as a static JSON file (~30-50 KB gzipped).
- Source: ISTAT official data or OpenDataSoft's `georef-italy-comune` dataset. Both include nome, provincia, and coordinates.
- Structure: `Array<{ name: string; province: string; lat: number; lng: number }>` sorted alphabetically
- Filter to Veneto only (563 rows vs 8,000+ for all of Italy)
- No API calls needed. Instant autocomplete. Zero rate limit concerns.

**Autocomplete UX:**

| Aspect | Implementation |
|--------|---------------|
| **Component** | Shadcn Combobox (Popover + Command composition) -- already in the Shadcn ecosystem, accessible, keyboard-navigable |
| **Filtering** | Client-side string matching. `city.name.toLowerCase().startsWith(query.toLowerCase())`. No fuzzy needed -- Italian city names are typed predictably. If fuzzy desired, simple `includes()` check suffices for 563 items. |
| **Display format** | "Cittadella (PD)" -- name + province code in each dropdown item |
| **Min chars** | Start filtering at 2 characters typed |
| **Selection behavior** | On select: redirect to `/cerca?lat={lat}&lng={lng}&raggio=15` (or set nuqs params) |
| **Debounce** | Not needed for client-side filtering of 563 items -- instant |
| **Mobile** | Full-width input, dropdown below, touch-friendly item height (min 44px) |

**Radius slider:**

| Aspect | Implementation |
|--------|---------------|
| **Trigger** | Appears after city is selected (or always visible next to city input) |
| **Range** | 5-50 km, step 5 km, default 15 km |
| **Component** | HTML `<input type="range">` styled with Tailwind, or Shadcn Slider if available |
| **Label** | Show current value: "Entro 15 km" |
| **Map circle preview** | On /cerca page with map view, show a `<Circle>` component from react-leaflet centered on the selected city with radius matching the slider. Semi-transparent fill (primary/10), stroke (primary). Update circle reactively when slider changes. |
| **Integration** | Slider value maps to `raggio` nuqs param. City lat/lng map to `lat`/`lng` params. |

### D-4: Custom SVG Logo

| Attribute | Detail |
|-----------|--------|
| **Value proposition** | The current logo is plain text "Nemovia" in the nav. A custom SVG logo with the coral/teal brand palette signals a finished product. |
| **Complexity** | LOW |
| **Dependencies** | Design decision (manual SVG creation or tool) |
| **Notes** | Create a simple wordmark or icon+wordmark. Use coral primary for the main mark, teal accent for a detail element. Keep it simple -- a stylized fork/map-pin combo or just the wordmark in a distinctive treatment. SVG for crispness at all sizes. Two variants: full (nav desktop) and icon-only (favicon, small spaces). |

### D-5: Full Footer with Credits

| Attribute | Detail |
|-----------|--------|
| **Value proposition** | A footer signals completeness. Without one, the page just... ends. It anchors the brand, provides attribution, and houses secondary links. |
| **Complexity** | LOW |
| **Dependencies** | Layout component |

**Content for a sagre aggregator footer:**

| Section | Content |
|---------|---------|
| **Brand** | SVG logo + "Fatto con cuore in Veneto" tagline |
| **Navigation** | Home, Cerca, Mappa (mirrors nav) |
| **Data attribution** | "Dati aggregati da [source names]" -- credit scraping sources |
| **Image attribution** | "Foto da Unsplash" with link (satisfies Unsplash attribution requirement for fallback images) |
| **Tech credits** | Optional: "Powered by Next.js, Supabase, OpenStreetMap" |
| **Legal** | "I dati sono forniti a scopo informativo" disclaimer |
| **Copyright** | "2026 Nemovia. Tutti i diritti riservati." |

**Layout:**
- Mobile: single column, stacked sections
- Desktop: 3-4 column grid
- Background: darker shade (`bg-foreground/5` or subtle mesh gradient)
- Text: `text-muted-foreground`, links hover to `text-foreground`
- Generous padding: `py-12 lg:py-16`
- Place before `<BottomNav>` on mobile (above the fixed bottom bar)

### D-6: Filters on Dedicated Map Page

| Attribute | Detail |
|-----------|--------|
| **Value proposition** | The /mappa page shows all sagre but offers no way to filter. Users exploring the map want to narrow by province, cuisine type, or date just like on /cerca. |
| **Complexity** | LOW-MEDIUM |
| **Dependencies** | MapFilterOverlay (already exists), SearchFilters component (reuse) |
| **Notes** | MapFilterOverlay.tsx already exists in the codebase. May need to wire it to actual filtering logic. Render a collapsible filter bar at the top of the map page. Apply filters to the `getMapSagre()` query or filter markers client-side. |

### D-7: Full-Width Responsive Desktop Layout

| Attribute | Detail |
|-----------|--------|
| **Value proposition** | The current `max-w-7xl` container wastes screen space on wide monitors. Hero and scroll rows should be edge-to-edge. Content sections can remain contained. |
| **Complexity** | LOW |
| **Dependencies** | Layout component, HeroSection, scroll row component |

**Implementation approach:**
- Keep `max-w-7xl` as the default content container
- Hero section renders outside the container (full viewport width)
- Netflix scroll rows use the negative margin trick to extend to edges while keeping card alignment with content
- Other sections (footer, detail pages) stay within container
- Structural change: either use a "breakout" CSS class or restructure the page component to alternate between full-width and contained sections

---

## Anti-Features

Features to explicitly NOT build in v1.4.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **SwiperJS / Embla carousel library** | Adds 20-40 KB bundle for scroll rows. CSS scroll-snap + a simple arrow component achieves the same result with zero dependencies. The project already has Motion for animations -- no need for another interaction library. | Build a `<ScrollRow>` component using native CSS scroll snap + `scrollBy()` for arrow buttons |
| **Nominatim live autocomplete** | Explicitly forbidden by Nominatim usage policy. Risk of IP ban. 1 req/sec limit makes it unusable for autocomplete anyway. | Ship Veneto comuni as a static JSON (~30-50 KB). Client-side filtering is instant for 563 items. |
| **Google Places / Mapbox geocoding** | Violates zero-cost constraint. Google Places charges per request. Mapbox free tier is limited. | Local city DB for autocomplete + existing Nominatim for one-time geocoding of scraper results (already works) |
| **Runtime Unsplash API calls** | 50 req/hr in demo mode is too low for per-request image fetching. Even at 5,000/hr production, every page load costing an API call is fragile. | Pre-fetch curated food images once. Store URLs in DB. Assign at enrichment time. Zero runtime API calls. |
| **Infinite scroll / lazy loading rows** | Homepage has at most 5-7 scroll rows. Loading them all upfront is fine. Infinite scroll adds complexity (intersection observers, loading states, pagination) for no benefit with this data volume. | Render all rows server-side. Client hydration for scroll behavior only. |
| **User-uploaded photos** | Requires auth, moderation, storage. Massively increases scope. Not needed when Unsplash + scraper images cover the use case. | Unsplash fallbacks + scraped images from source sites |
| **Custom map tiles / dark map theme** | OSM tiles are free and functional. Custom Mapbox tiles cost money. Dark map themes conflict with the light coral/teal design language. | Keep OSM default tiles. Focus on marker/popup styling instead. |
| **Complex logo animation** | Animated logos add load time and distraction. The glassmorphism nav is already visually rich. | Static SVG logo. Maybe a subtle hover scale with Motion, nothing more. |

---

## Feature Dependencies

```
TS-7 (Fix event count drop)
  |-> TS-5 (Fix events outside Veneto)
  |-> TS-6 (Fix non-sagre events)
  |-> All homepage UI features (no point building Netflix rows for 26 events)

TS-3 (Unsplash fallback images)
  |-> TS-2 (Fix placeholder visibility) -- Unsplash fallback IS the fix
  |-> D-2 (Photo hero) -- uses same Unsplash infrastructure
  |-> D-5 (Footer) -- Unsplash attribution lives here

D-2 (Photo hero)
  |-> D-3 (City autocomplete) -- search bar embedded in hero
  |-> D-7 (Full-width layout) -- hero must be full-width

D-1 (Netflix scroll rows)
  |-> D-7 (Full-width layout) -- rows extend to screen edges
  |-> TS-7 (Event count fix) -- need enough events to populate rows

D-3 (City autocomplete)
  |-> Local Veneto city database (must be created/sourced first)
  |-> Radius slider integration with existing nuqs filter params

D-4 (SVG logo)
  |-> D-5 (Footer) -- logo appears in footer too

D-6 (Map page filters)
  |-> TS-1 (Fix search page map) -- same underlying map issues may affect both
```

**Critical path:** TS-7 (event count) MUST be fixed before any homepage UI work. Building beautiful Netflix rows for 26 events is pointless.

---

## MVP Recommendation

### Phase 1: Data Foundation (fix first, build later)

Prioritize in this order:
1. **TS-7** -- Investigate and fix event count drop (CRITICAL BLOCKER)
2. **TS-5** -- Fix events outside Veneto
3. **TS-6** -- Fix non-sagre events still present
4. **TS-4** -- Province always visible
5. **TS-1** -- Fix broken map on search page

### Phase 2: Image and Visual Foundation

6. **TS-3** -- Unsplash fallback images (pre-fetch curated set, assign during enrichment)
7. **TS-2** -- Fix placeholder visibility (resolved by TS-3)
8. **D-4** -- SVG logo design

### Phase 3: Homepage Transformation

9. **D-7** -- Full-width layout restructure
10. **D-2** -- Photo hero with Unsplash image
11. **D-3** -- City autocomplete + radius slider in hero
12. **D-1** -- Netflix scroll rows

### Phase 4: Polish and Completion

13. **D-5** -- Footer
14. **D-6** -- Map page filters
15. Scrape info complete (menu, orari, descrizioni) from sources

### Defer to v1.5:

- **New scraping sources**: Finding, testing, and building scrapers for new sites is a separate effort. If the event count drop is caused by source websites going offline, this becomes v1.4 scope. Otherwise, defer.
- **Scrape complete info (menu, orari)**: Requires per-source scraper modifications. Medium complexity, low urgency relative to UX features. Defer unless trivially achievable.

---

## Complexity Budget

| Feature | Estimated Effort | Risk |
|---------|-----------------|------|
| TS-1: Fix search map | 1-2 hours | LOW -- likely a data-passing bug |
| TS-2: Fix placeholders | 0.5 hours | LOW -- CSS tweak or Unsplash fallback |
| TS-3: Unsplash fallbacks | 3-4 hours | MEDIUM -- API setup, curation, attribution compliance |
| TS-4: Province display | 0.5 hours | LOW -- conditional display already exists |
| TS-5: Fix non-Veneto | 1-2 hours | LOW -- retroactive cleanup + gating audit |
| TS-6: Fix non-sagre | 1-2 hours | LOW -- heuristic rules + retroactive cleanup |
| TS-7: Event count drop | 2-4 hours | HIGH -- investigation, multiple possible causes |
| D-1: Netflix scroll rows | 4-6 hours | LOW -- CSS scroll snap is well-understood |
| D-2: Photo hero | 2-3 hours | LOW -- straightforward layout replacement |
| D-3: City autocomplete + radius | 3-4 hours | MEDIUM -- city DB sourcing, Combobox integration |
| D-4: SVG logo | 1-2 hours | LOW -- design task |
| D-5: Footer | 1-2 hours | LOW -- standard component |
| D-6: Map filters | 2-3 hours | LOW-MEDIUM -- reuse SearchFilters, wire to map |
| D-7: Full-width layout | 1-2 hours | LOW -- CSS restructure |
| **Total** | **~24-38 hours** | |

---

## Sources

### Netflix Horizontal Scroll Rows
- [CSS Scroll Snap Basics -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap/Basic_concepts) -- HIGH confidence
- [Creating Horizontal Scrolling Containers with CSS Grid -- UX Collective](https://uxdesign.cc/creating-horizontal-scrolling-containers-the-right-way-css-grid-c256f64fc585) -- MEDIUM confidence
- [Tailwind CSS Horizontal Card Carousel -- Antonio Ufano](https://antonioufano.com/articles/tailwind-horizontal-card-netflix/) -- MEDIUM confidence
- [Beware Horizontal Scrolling on Desktop -- NNG](https://www.nngroup.com/articles/horizontal-scrolling/) -- HIGH confidence (accessibility/UX)
- [CSS scroll-snap-type -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-type) -- HIGH confidence

### City Autocomplete
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) -- HIGH confidence (autocomplete forbidden)
- [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/) -- HIGH confidence (featureType=city, viewbox, bounded)
- [ISTAT Comuni Italiani](https://www.istat.it/en/classification/codes-of-italian-municipalities-provinces-and-regions/) -- HIGH confidence
- [OpenDataSoft georef-italy-comune](https://public.opendatasoft.com/explore/dataset/georef-italy-comune/export/) -- HIGH confidence
- [Shadcn Combobox](https://ui.shadcn.com/docs/components/radix/combobox) -- HIGH confidence

### Unsplash API
- [Unsplash API Documentation](https://unsplash.com/documentation) -- HIGH confidence
- [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) -- HIGH confidence
- [Unsplash Rate Limits FAQ](https://help.unsplash.com/en/articles/3887917-when-should-i-apply-for-a-higher-rate-limit) -- HIGH confidence

### Radius/Map Circle
- [React Leaflet Circle Component](https://react-leaflet.js.org/docs/api-components/) -- HIGH confidence
- [Leaflet Circle Class](https://leafletjs.com/examples/quick-start/) -- HIGH confidence

### Hero Section Design
- [Hero Section Design Best Practices 2026](https://www.perfectafternoon.com/2025/hero-section-design/) -- MEDIUM confidence
- [Hero Section Design Ideas 2025 -- Detachless](https://detachless.com/blog/hero-section-web-design-ideas) -- MEDIUM confidence

### Footer Design
- [Website Footer Best Practices -- Orbit Media](https://www.orbitmedia.com/blog/website-footer-design-best-practices/) -- HIGH confidence
- [Modern Footer Design Guide 2025 -- BeetleBeetle](https://beetlebeetle.com/post/modern-website-footer-design-examples-practices) -- MEDIUM confidence
