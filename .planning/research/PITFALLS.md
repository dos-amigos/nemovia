# Pitfalls Research

**Domain:** Netflix scroll rows, Unsplash API, city autocomplete, scraper expansion, full-width layout, data quality fixes for existing Next.js 15 + Supabase sagre aggregator
**Researched:** 2026-03-10
**Confidence:** HIGH

---

## Critical Pitfalls

---

### Pitfall 1: Nominatim Explicitly Forbids Autocomplete -- City Search Will Get IP Banned

**What goes wrong:**
The v1.4 requirement calls for "search bar home -> autocomplete citta -> redirect Cerca con citta + slider raggio km." The natural implementation is to call Nominatim on every keystroke (debounced to 300ms) to resolve city names to coordinates. This violates Nominatim's usage policy, which explicitly states: **"Auto-complete search... you must not implement such a service on the client side using the API."** The OSM Foundation will block the application's IP address, which also breaks the existing geocoding pipeline used by the enrich-sagre Edge Function.

**Why it happens:**
Developers assume "rate limit 1 req/sec, so debounce to 1 second" is sufficient compliance. It is not. Nominatim's policy is an explicit prohibition on autocomplete, not a rate limit issue. Their infrastructure is not designed for the query patterns autocomplete generates (partial queries like "Pad" returning irrelevant global results, repeated queries for the same prefix chain "P" -> "Pa" -> "Pad" -> "Pado" -> "Padov" -> "Padova"). Even at 1 req/sec, this pattern generates systematic queries that will trigger automatic blocking.

**How to avoid:**
Use a local static dataset of Italian comuni (municipalities) for autocomplete instead of Nominatim:

1. **Static JSON list of Veneto comuni.** Italy has ~7,900 comuni, Veneto has ~563. Create a static JSON file (~15KB gzipped) with `{ name, province_code, lat, lng }` sourced from ISTAT data (freely available at `github.com/topics/comuni-italiani`). Ship it in the client bundle or load it at page mount.
2. **Client-side fuzzy filter.** Use a simple `startsWith` or `includes` filter on the static list. No API calls needed. Response is instant (sub-millisecond for 563 items).
3. **Nominatim only for geocoding on submit.** If the user selects a city from the autocomplete and clicks search, the static dataset already has lat/lng coordinates, so no Nominatim call is needed at all.
4. **Never call Nominatim from the client.** All Nominatim calls must go through the server (Edge Functions) for geocoding new scraper entries only, where rate limiting is already implemented.

**Warning signs:**
- Network tab showing Nominatim requests during typing
- 429 or connection timeout errors from nominatim.openstreetmap.org
- Geocoding in the enrich-sagre Edge Function suddenly failing (shared IP ban on Vercel)

**Phase to address:**
Phase: Homepage UX (city autocomplete task). The static dataset approach must be the architectural decision from the start -- do NOT prototype with Nominatim and "plan to switch later."

---

### Pitfall 2: Unsplash API Free Tier Is 50 Requests/Hour -- Hero Image Will Break on Any Traffic

**What goes wrong:**
The v1.4 requirement calls for "Hero con foto sagra Unsplash API" and "Immagini low-res -> fallback Unsplash a tema." In demo/development mode, the Unsplash API is rate-limited to **50 requests per hour**. The hero image is rendered server-side on the homepage. Every page load = 1 Unsplash API request. 50 unique visitors in an hour exhausts the limit. The 51st visitor sees a broken hero or a fallback placeholder, defeating the purpose of the feature.

Even after production approval (requires a review process), the limit is 5,000 requests/hour. But if Unsplash images are used as fallbacks for low-res scraped images across all cards, each search results page could trigger 10-50 Unsplash API calls, burning through the production limit in minutes with moderate traffic.

**Why it happens:**
Developers treat Unsplash API like a CDN for on-demand image serving. It is not. Unsplash is designed for "pick an image" workflows (like Notion's cover photo picker), not "serve an image on every page load." The API returns metadata (URLs, photographer info, dimensions), and the actual image files come from `images.unsplash.com` which has no rate limit. But you must call the API first to get the URL.

**How to avoid:**
1. **Pre-select and cache hero images.** At build time or via a scheduled function, call the Unsplash API once to fetch 10-20 relevant images (query: "Italian food festival", "sagra italy", "italian countryside"). Store the URLs, photographer names, and attribution data in a Supabase table (`hero_images`). Rotate through them on the frontend with zero API calls at runtime.
2. **For card fallback images, use a curated set.** Pre-fetch 30-50 food/event category images from Unsplash (one per food tag: "fish market", "grilled meat", "polenta", etc.). Store in `unsplash_fallbacks` table. Map to food tags. This requires ~5 API calls total (not per page load).
3. **Trigger download tracking server-side.** Unsplash requires calling `photo.links.download_location` when an image is "used." Do this once when you pre-fetch and store the URL, not on every page view.
4. **Apply for production before launch.** Submit the production application early -- it requires screenshots, description, and a review period of up to 7 business days.
5. **NEVER call the Unsplash API from client-side code.** API keys must remain server-side. Use a server action or API route to proxy requests if needed.

**Warning signs:**
- Unsplash returning 403 or rate limit headers showing 0 remaining
- Hero section showing broken image or flickering between images
- Response header `X-Ratelimit-Remaining: 0`

**Phase to address:**
Phase: Homepage UX (hero image task). Pre-fetch and cache approach must be designed before any Unsplash API code is written.

---

### Pitfall 3: Netflix Scroll Rows on Existing Bento Grid Create Layout Chaos

**What goes wrong:**
The current homepage has a specific vertical flow: HeroSection -> QuickFilters -> Bento Grid (featured + 4 regular cards) -> WeekendSection (remaining cards) -> ProvinceSection. Adding Netflix-style horizontal scroll rows ("mix smart: weekend, vicino a te, tipo cucina, provincia") means inserting 4-8 new horizontally scrolling sections into this vertical flow. The problems compound:

1. **Bento grid conflict:** The bento grid uses `lg:grid-cols-4` with a featured card spanning `lg:col-span-2 lg:row-span-2`. Netflix rows use horizontal scroll with `overflow-x-auto`. These are fundamentally different layout paradigms. Mixing them creates visual confusion -- users scroll down to a horizontal section, then need to scroll right, then scroll down again to the next section. This "zigzag" pattern is fatiguing, especially on mobile.

2. **Duplicate card rendering:** The "weekend" row may show the same sagre already in the bento grid. The "vicino a te" row may overlap with sagre in the "provincia" row. Without deduplication across rows, users see the same card 3 times.

3. **Performance with many rows:** Each Netflix row renders 10-20 SagraCard components. With 6 rows, that is 60-120 cards rendered on initial page load, each with a Next.js Image component fetching external images. The current homepage renders at most 13 cards (1 featured + 4 regular + 8 remaining).

4. **Empty rows on low data:** With the event count dropping from 735 to 26, most category rows will be empty or show 1-2 cards. A Netflix row with 1 card is worse than no row at all.

**Why it happens:**
Netflix scroll rows work because Netflix has thousands of items per category and a professional content team curating each row. A sagre aggregator with 26-100 active events cannot populate 6 meaningful rows without significant overlap or empty states.

**How to avoid:**
1. **Replace the bento grid with Netflix rows, do not layer them on top.** The homepage should be: Hero -> Search Bar -> Row 1 (Questo Weekend) -> Row 2 (Vicino a Te, if geo available) -> Row 3 (Per Tipo) -> ProvinceSection. Remove the bento grid entirely.
2. **Minimum card threshold per row.** Only render a row if it has 3+ items. Below 3, the horizontal scroll pattern looks broken (nothing to scroll). Merge low-count rows into an "Altre sagre" grid fallback.
3. **Deduplicate across rows.** Build all row datasets server-side. After populating Row 1 (weekend), exclude those IDs from Row 2 (nearby). After Row 2, exclude from Row 3 (by type). This ensures each sagra appears at most once.
4. **Lazy render off-screen rows.** Only the first 2 rows should render immediately. Rows 3+ should use IntersectionObserver or `whileInView` to defer rendering until the user scrolls near them. This keeps initial card count under 30.
5. **CSS scroll snap, not JS carousel.** Use `overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;` with CSS. No JS-based carousel library needed. The app already has `scrollbar-hide` utility in globals.css.
6. **Keyboard accessibility.** Add `tabindex="0"`, `role="region"`, and `aria-label="Sagre del weekend"` to each scroll row container. This is frequently missed in Netflix-style implementations.

**Warning signs:**
- Homepage rendering 100+ Image components (check React DevTools component count)
- Empty rows with 0-1 cards visible on the homepage
- Same sagra card appearing in 3 different rows
- LCP (Largest Contentful Paint) increasing above 2.5s

**Phase to address:**
Phase: Homepage UX (Netflix rows task). Architectural decision to REPLACE bento grid, not layer on top. Deduplication logic must be in the server component data-fetching layer.

---

### Pitfall 4: Full-Width Layout Migration Breaks Every Existing Page

**What goes wrong:**
The current layout wrapper in `(main)/layout.tsx` constrains all content to `max-w-7xl` (1280px) with `px-4 sm:px-6 lg:px-8` padding. The v1.4 requirement for "Layout full-width responsive desktop" means removing or widening this constraint. But the constraint is applied at the layout level, affecting ALL pages -- Home, Cerca, Mappa, and Sagra detail. Removing `max-w-7xl` without adjusting every page's internal layout creates:

1. **Unreadable text on ultrawide monitors.** Text paragraphs stretching to 2560px are unreadable. The sagra detail page description would span the full viewport.
2. **Card grid going too wide.** The SagraGrid uses `xl:grid-cols-4`. Without max-width, on a 2560px monitor this creates 4 cards each 600px wide with massive gaps.
3. **Search filters stretching.** The SearchFilters grid uses `lg:grid-cols-4`. At full width, each filter input becomes 400px wide -- awkward and wasted space.
4. **Map page is already full-width.** The Mappa page's MapView likely wants full viewport width, but the Cerca page's map toggle should remain constrained.

**Why it happens:**
"Full-width" is ambiguous. It could mean: (a) the hero/nav/footer span full width while content remains constrained, (b) the entire layout has no max-width, or (c) some sections are full-width (hero, Netflix rows) while others remain constrained (search filters, text content). The common mistake is implementing (b) when the intent is (c).

**How to avoid:**
1. **Keep the layout `max-w-7xl` constraint but use `full-bleed` patterns for specific sections.** The layout wrapper stays as-is. Sections that need full width (hero, Netflix scroll rows, footer) use negative margins or break out of the container: `mx-[-1rem] sm:mx-[-1.5rem] lg:mx-[-2rem] px-4 sm:px-6 lg:px-8`.
2. **Alternatively, move to a per-section max-width model.** Remove `max-w-7xl` from the layout. Add it to each page's content sections individually. Full-width sections (hero, rows, footer) get no max-width. Text/form sections get `max-w-7xl mx-auto`.
3. **The hero and Netflix rows should be full-bleed.** These benefit from edge-to-edge display on large screens.
4. **Text content and forms should NEVER be full-width.** Maximum readable line length is 75 characters (~750px for body text). Use `max-w-prose` or `max-w-3xl` for description text.
5. **Test at 1920px, 2560px, and 3840px.** Chrome DevTools responsive mode can simulate these widths. Most developers only test at 1440px.

**Warning signs:**
- Text lines exceeding 120 characters on desktop
- Card grid gaps larger than card width
- Filter inputs stretching beyond 300px
- Content looking "lost" in the center of ultrawide screens

**Phase to address:**
Phase: Layout and Branding (full-width task). Define a clear full-bleed vs constrained strategy before touching the layout wrapper. Per-section approach is safer than removing the global constraint.

---

### Pitfall 5: Unsplash Attribution and Hotlinking Non-Compliance Gets API Access Revoked

**What goes wrong:**
Unsplash API terms require three specific compliance elements that are frequently missed:

1. **Attribution:** Every displayed Unsplash image must show "Photo by [Name] on Unsplash" with clickable links including UTM parameters (`?utm_source=nemovia&utm_medium=referral`). On SagraCard overlays (white text on dark gradient), the attribution text competes with the card's title/location/date information. Developers either omit attribution entirely or add it as tiny, invisible text -- both violate the terms.

2. **Hotlinking:** You MUST use URLs from `photo.urls` (served from `images.unsplash.com`). You CANNOT download images and re-host them on Supabase Storage or your own CDN. This conflicts with the common pattern of downloading scraped images for reliability.

3. **Download tracking:** When you "use" an image (display it as a hero, set it as a fallback), you must trigger a GET request to `photo.links.download_location`. This is separate from displaying the image. Missing this tracking is the #1 reason for API access revocation.

**Why it happens:**
The Unsplash License says "free to use, no attribution required" for the license itself. But the **API Terms** add additional requirements on top of the license. Developers read the license, skip the API terms, and assume attribution is optional. It is not optional when using the API.

**How to avoid:**
1. **Store full Unsplash metadata.** When pre-fetching images, store not just the URL but also: `photographer_name`, `photographer_username`, `photographer_profile_url`, `download_location_url`, `unsplash_id`. Create a `unsplash_images` table with these columns.
2. **Attribution component.** Build a reusable `<UnsplashAttribution photographerName="..." profileUrl="..." />` component that renders the required text. Place it on the hero section and any card using an Unsplash fallback.
3. **Trigger download endpoint on first use.** When the hero image is first loaded from the pre-fetched cache, call the `download_location` URL server-side (via a Supabase Edge Function or Next.js server action). Do this once per image, not once per page view. Track with a boolean `download_tracked` column.
4. **Do not store Unsplash images in Supabase Storage.** Hotlink from `images.unsplash.com` using the URLs returned by the API. This is not a performance issue -- Unsplash CDN (Imgix) is fast globally.
5. **Use `photo.urls.regular` (1080px width) for hero, `photo.urls.small` (400px) for card fallbacks.** Do not use `photo.urls.full` -- it is the original upload resolution and can be 30MB+.

**Warning signs:**
- Unsplash images showing without photographer credit
- Images served from your own domain instead of `images.unsplash.com`
- API access revoked with email from Unsplash compliance team
- Missing UTM parameters on attribution links

**Phase to address:**
Phase: Homepage UX (hero image task) and Data Quality (image fallback task). Attribution component must be built and tested before any Unsplash image is displayed.

---

### Pitfall 6: Event Count Collapse (26 vs 735) Makes Every New Feature Look Broken

**What goes wrong:**
The PROJECT.md notes a "calo drastico eventi (26 vs 735)." With only 26 active events, every v1.4 feature will appear broken:

- Netflix rows: 5 rows with 26 events total = 5 cards per row on average. Most rows will have 1-3 cards. Horizontal scroll with 2 cards is useless.
- "Vicino a te" row: With 26 events across all of Veneto, the nearby row for most users will be empty.
- City autocomplete: User types "Padova", selects it, finds 0-2 results within 30km.
- Province section: 7 provinces, 26 events = some provinces show 0.
- Hero "SCOPRI LE SAGRE DEL VENETO" over an empty app is embarrassing.

This is not a UI bug but a data problem. Building features against 26 events will produce a misleading experience. Features tested with 26 events will have different performance, layout, and UX characteristics than the same features with 500+ events.

**Why it happens:**
The v1.3 data quality filters (heuristic filters + LLM classification + fuzzy dedup) were likely too aggressive, or scraper sources have changed their HTML structure causing parse failures, or seasonal variation means March has fewer sagre than summer. The scraper's `consecutive_failures` circuit breaker may have disabled sources. Regardless of cause, building UI features on an empty dataset is building on sand.

**How to avoid:**
1. **Fix the data pipeline BEFORE building any UI features.** Investigate the event count collapse first: check `scrape_logs` for error rates, check `scraper_sources` for disabled sources, review filter rejection rates. This is the most critical v1.4 task.
2. **Add new scraping sources.** The requirement already calls for this. Identify 2-3 additional sagre listing sites. Configure them in `scraper_sources` before spending time on Netflix rows.
3. **Review filter aggressiveness.** The v1.3 `isExcessiveDuration` filter rejects events > 7 days, but many legitimate multi-day sagre span 10-14 days. The `isCalendarDateRange` filter may reject legitimate month-long festivals. Run: `SELECT deactivation_reason, count(*) FROM sagre WHERE is_active = false GROUP BY deactivation_reason` to find which filter is killing the most events.
4. **Seed test data for UI development.** Create 100+ realistic test sagre in a separate `sagre_test` table (or use a dev branch with seeded data). Develop UI features against this dataset. Then validate against production data once the pipeline is fixed.
5. **Add an admin dashboard query.** Create an RPC or view: `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active, COUNT(*) FILTER (WHERE status = 'pending_geocode') as pending_geocode` etc. Monitor daily.

**Warning signs:**
- Homepage showing "Nessuna sagra questo weekend" empty state
- Province counts all showing 0-1
- Netflix rows not rendering (below minimum threshold)
- Users landing on an apparently empty app

**Phase to address:**
Phase: Data Quality (pipeline investigation). This MUST be Phase 1 -- before any UI work begins. Without data, every UI feature is built in the dark.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Calling Unsplash API on every page load for hero | Dynamic hero image, easy to implement | Hits rate limit at 50 visits/hour, API access revoked | Never -- always pre-fetch and cache |
| Using Nominatim for autocomplete with debounce | Quick prototype, works in dev | IP banned in production, breaks geocoding pipeline | Never -- use static dataset |
| Removing `max-w-7xl` globally for full-width | Quick, one-line change | Every page breaks on wide screens, unreadable text | Never -- use per-section approach |
| Rendering all Netflix rows eagerly | Simpler code, no lazy loading | 100+ Image components on homepage, LCP regression | Only acceptable if total cards < 30 |
| Storing Unsplash images in Supabase Storage | Faster loading, no external dependency | Violates API terms, gets access revoked | Never when using Unsplash API |
| Skipping row deduplication | Simpler server queries, each row independent | Same card in 3 rows, user thinks data is wrong | Never -- deduplicate at query level |
| Inline copy of new filter functions in Edge Function | Quick to add, existing pattern | 4th milestone of growing drift, 8+ duplicated functions | Acceptable only if `_shared/` directory is used |
| Hard-coding Unsplash search queries | Specific, relevant images | Images become stale, no variety | Acceptable for hero (curated), not for fallbacks (need category mapping) |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Unsplash API | Calling API from client-side JS, exposing API key | Server-only: use Next.js server actions or API routes. Store key in `.env`, never in client bundle |
| Unsplash API | Using `photo.urls.full` for hero | Use `photo.urls.regular` (1080px) for hero, `photo.urls.small` (400px) for card fallbacks. `full` can be 30MB+ |
| Unsplash API | Forgetting to call `download_location` endpoint | Call it once when image is first cached, not on every page view. Track with `download_tracked` boolean |
| Nominatim | Using it for autocomplete | Use static ISTAT comuni dataset. Nominatim is for geocoding new scraper entries only |
| Nominatim | Calling from client-side without User-Agent | All Nominatim calls must include a valid `User-Agent` identifying the app. Calls without it are blocked |
| Next.js Image + Unsplash | Not configuring `remotePatterns` for `images.unsplash.com` | Already have `**` wildcard, but should tighten to specific hostnames: `images.unsplash.com` |
| New scraper sources | Using the same User-Agent and timing for all sources | Each source may have different rate limits and blocking strategies. Vary politeness delay (1.5s-3s) per source |
| New scraper sources | Not checking robots.txt | Read robots.txt for every new source. Document allowed paths. Respect `Crawl-delay` directives |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering 100+ SagraCard components on homepage (6 Netflix rows x 15-20 cards) | LCP > 4s, scroll jank, memory pressure on mobile | Lazy-render rows 3+, limit per-row cards to 10, use IntersectionObserver | > 60 cards on initial render |
| Each SagraCard using `<FadeImage>` with external `image_url` (100+ simultaneous image requests) | Network waterfall, images loading in random order, data usage spike on mobile | Use `loading="lazy"` on off-screen cards, set `sizes` prop accurately, limit eager images to first 2 rows | > 20 simultaneous image loads |
| Netflix row scroll with motion `whileHover` on each card | CPU spike during scroll, frame drops as motion processes hover events for off-screen cards | Disable `whileHover` for cards inside scroll containers (use CSS `:hover` instead), or only enable for visible cards | > 10 motion-wrapped cards in scroll view |
| Server component fetching 6 separate row datasets with individual Supabase queries | Cold start latency increase, 6 sequential DB round-trips, SSR timeout risk | Fetch all sagre once with a single query, partition into rows in JS, use `Promise.all` for independent queries | > 4 sequential queries per page |
| Unsplash fallback images: each card without image_url triggers an Unsplash lookup | API rate limit exceeded, all fallback images break simultaneously | Pre-map categories to cached Unsplash URLs, never call API at render time | > 50 req/hour in demo, > 5000/hour in production |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Unsplash API key in client-side code | Key theft, API abuse under your account, access revocation | Keep key server-side only. Use Next.js server actions to proxy API calls |
| Wildcard `remotePatterns: [{ hostname: "**" }]` in next.config.ts | SSRF via image optimization -- attacker can force Next.js to fetch arbitrary URLs | Restrict to known hostnames: scraped source domains + `images.unsplash.com` |
| Scraper User-Agent impersonating a real browser | Legal liability -- GDPR/Italy DPA views this as deceptive data collection | Use honest User-Agent: `Nemovia/1.4 (+https://nemovia.it)` as already implemented |
| Storing personal data from scraped sites (organizer names, phone numbers) | GDPR violation -- scraping personal data without consent | Only scrape event metadata (title, dates, location, price). Never store organizer contact info |
| Not having a privacy policy mentioning Unsplash tracking | GDPR non-compliance -- Unsplash hotlinks send user data to Unsplash/Imgix CDN | Add disclosure in privacy policy: "Images provided by Unsplash. When viewing images, your browser connects to Unsplash servers." |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Netflix rows that are not swipeable on mobile (only scroll via touch drag) | Users on mobile expect swipe gesture, get confused when row does not respond | Use CSS `scroll-snap-type: x mandatory` with `overflow-x: auto`. Native touch scrolling works automatically. Do NOT use a JS drag library |
| Hiding scrollbar on Netflix rows with no scroll indicator | Users do not know the row scrolls horizontally. They see only 2-3 cards and assume that is all | Add a subtle fade gradient on the right edge (from-transparent to-background) to hint at more content. Or show a ">" arrow button |
| City autocomplete that clears on blur | User starts typing "Padova", clicks somewhere else (e.g., to read results), returns to input -- it is empty | Persist the autocomplete value in URL state via nuqs. Input should retain its value across focus/blur cycles |
| Autocomplete dropdown covering the hero section content | On mobile, the dropdown pushes content down or covers the hero text | Position dropdown below input with `position: absolute`, use `max-h-48 overflow-y-auto` to limit height. On mobile, consider a full-screen search overlay |
| Radius slider without visual feedback | User sets "30km" but has no sense of what that covers geographically | Show a small text indicator: "~Padova e dintorni" or "include Vicenza, Treviso" based on the radius value |
| Empty Netflix row showing with just a title | Section header "Sagre di Pesce" with 0 cards below -- app looks broken | Never render a row section with fewer than 3 cards. Collapse empty sections entirely |
| Full-width layout on mobile creating edge-to-edge cards with no breathing room | Cards touching screen edges feel cramped, buttons near edges are hard to tap | Maintain `px-4` (16px) side padding on mobile even in "full-width" mode. Full-bleed only on desktop/tablet |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

### Data Pipeline
- [ ] **Event count recovery:** Active sagre count is back above 100 -- verify with `SELECT count(*) FROM sagre WHERE is_active = true`
- [ ] **Scraper sources healthy:** All sources in `scraper_sources` have `is_active = true` and `consecutive_failures = 0`
- [ ] **Filter calibration:** Run `SELECT deactivation_reason, count(*) FROM sagre WHERE is_active = false GROUP BY deactivation_reason` to verify no single filter is rejecting > 20% of events
- [ ] **New sources producing data:** Any new scraper sources have at least 1 successful run in `scrape_logs`
- [ ] **Province always displayed:** Every active sagra has a non-null `province` field -- verify with `SELECT count(*) FROM sagre WHERE is_active = true AND province IS NULL`

### Unsplash Integration
- [ ] **Attribution visible:** Every Unsplash image shows "Photo by [Name] on Unsplash" with working links
- [ ] **UTM parameters present:** All Unsplash links include `?utm_source=nemovia&utm_medium=referral`
- [ ] **Download tracking:** `download_tracked = true` for all cached Unsplash images
- [ ] **API key server-side only:** No Unsplash API key in any client-side bundle (check Next.js build output)
- [ ] **Rate limit headroom:** Pre-fetched images cached in DB, zero Unsplash API calls at runtime

### Netflix Rows
- [ ] **Row deduplication:** Same sagra ID never appears in two different rows on the homepage
- [ ] **Empty row suppression:** Rows with < 3 items are not rendered
- [ ] **Keyboard navigation:** Each scroll row is focusable with `tabindex="0"` and has `role="region"` + `aria-label`
- [ ] **Scroll hint visible:** Right-edge fade gradient or arrow button visible when row has more content to scroll
- [ ] **Reduced motion:** `prefers-reduced-motion` disables smooth scroll behavior on rows

### City Autocomplete
- [ ] **No Nominatim calls on keystrokes:** Network tab shows zero requests to nominatim.openstreetmap.org during typing
- [ ] **Static dataset complete:** All 563 Veneto comuni are in the dataset with correct lat/lng/province_code
- [ ] **Province in parentheses:** Autocomplete suggestions show "Padova (PD)", "Zugliano (VI)" format
- [ ] **URL state persistence:** Selected city and radius survive page refresh (stored via nuqs)

### Full-Width Layout
- [ ] **Text readability on ultrawide:** Description text never exceeds `max-w-prose` width
- [ ] **Card grid sane at 2560px:** Cards do not stretch beyond 350px width
- [ ] **Existing pages not broken:** Cerca, Mappa, and Sagra detail pages still look correct
- [ ] **Mobile padding preserved:** `px-4` minimum side padding on all mobile views

### Footer and Logo
- [ ] **Footer does not overlap BottomNav:** On mobile, footer content is above the `pb-20` spacer, not behind the fixed BottomNav
- [ ] **SVG logo accessible:** Logo has `aria-label` and works at 24x24 (TopNav) and larger (footer) sizes
- [ ] **Footer links functional:** All footer links (if any) work and open correctly

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Nominatim IP ban from autocomplete (#1) | HIGH | Contact OSM Foundation to request unblock. Switch to static dataset. All geocoding broken until unblocked. 24-48 hours minimum |
| Unsplash rate limit exhausted (#2) | LOW | Pre-fetch images into DB cache. Zero API calls at runtime going forward. 2-3 hours to implement caching layer |
| Netflix rows creating layout chaos (#3) | MEDIUM | Remove Netflix rows, revert to bento grid. Incremental approach: add one row at a time. 2-4 hours per revert/re-implementation |
| Full-width layout breaks pages (#4) | LOW | Revert layout.tsx to `max-w-7xl`. 5 minutes revert, 2-4 hours to implement per-section approach correctly |
| Unsplash API access revoked for non-compliance (#5) | HIGH | Remove all Unsplash images. Switch to branded placeholders. Reapply for API access (7+ business day review). 1-2 days |
| Event count too low for meaningful UX (#6) | MEDIUM | Seed with historical/test data for development. Fix pipeline in parallel. 4-8 hours to diagnose and fix scraper issues |
| Scraper blocked by source site | MEDIUM | Check robots.txt, increase politeness delay to 3-5 seconds, add request jitter. May need to find alternative source. 2-4 hours |
| Edge Function inline copy drift (expanded) | MEDIUM | Diff all inline copies against `src/lib/` canonical copies. Create `_shared/` directory. 3-4 hours |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Nominatim autocomplete ban (#1) | Homepage UX -- city search task | Network tab shows zero Nominatim requests during autocomplete |
| Unsplash rate limit (#2) | Homepage UX -- hero image task | `unsplash_images` table populated, zero API calls in production request logs |
| Netflix row layout chaos (#3) | Homepage UX -- scroll rows task | Homepage renders < 40 total cards, no duplicate IDs across rows |
| Full-width layout breakage (#4) | Layout & Branding -- layout task | All pages visually correct at 1920px, 2560px. Text < 80 chars per line |
| Unsplash non-compliance (#5) | Homepage UX -- hero image task | Attribution visible, UTM params in links, download tracking active |
| Event count collapse (#6) | Data Quality -- FIRST PHASE | Active sagre count > 100 before any UI work begins |
| Scraper expansion blocking (#7) | Data Quality -- new sources task | robots.txt checked, politeness delay documented, User-Agent honest |
| Edge Function drift (ongoing) | Data Quality -- first task | `_shared/` directory created, no more inline copies in function files |
| Empty state handling across features | All phases | Every section has a meaningful empty state, not broken layout |
| Filter calibration too aggressive/loose | Data Quality -- filter review task | No filter rejects > 20% of events; non-sagre count < 5% of active |

---

## Sources

### Unsplash API
- [Unsplash API Documentation -- Rate Limits](https://unsplash.com/documentation) - HIGH confidence (official docs: 50 req/hr demo, 5000 req/hr production)
- [Unsplash API Guidelines -- Hotlinking](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images) - HIGH confidence (must use `photo.urls`, no self-hosting)
- [Unsplash API Guidelines -- Attribution](https://help.unsplash.com/en/articles/2511315-guideline-attribution) - HIGH confidence ("Photo by [Name] on Unsplash" with UTM params required)
- [Unsplash API Terms](https://unsplash.com/api-terms) - HIGH confidence (download tracking, GDPR compliance, API key confidentiality)
- [Next.js Image Config -- remotePatterns](https://nextjs.org/docs/app/api-reference/config/next-config-js/images) - HIGH confidence (official docs)

### Nominatim
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) - HIGH confidence (official OSM Foundation: "you must not implement [autocomplete]", 1 req/sec, cache results)
- [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/) - HIGH confidence (official docs)
- [Italian Comuni Dataset (ISTAT via GitHub)](https://github.com/topics/comuni-italiani) - HIGH confidence (multiple open-source repos with ISTAT data)

### Web Scraping Legal (Italy)
- [Italian DPA Web Scraping Guidance](https://morrirossetti.it/en/insight/publications/the-italian-data-protection-authority-puts-a-stop-to-web-scraping.html) - MEDIUM confidence (law firm analysis of Garante rulings)
- [Web Scraping Legal Guide 2025](https://www.browserless.io/blog/is-web-scraping-legal) - MEDIUM confidence (industry overview, cites relevant cases)
- [GDPR and Web Scraping Risks](https://medium.com/deep-tech-insights/web-scraping-in-2025-the-20-million-gdpr-mistake-you-cant-afford-to-make-07a3ce240f4f) - MEDIUM confidence (cites Clearview AI 20M EUR fine)

### CSS Scroll / Netflix Rows
- [Building CSS Carousels (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Overflow/Carousels) - HIGH confidence (official MDN docs)
- [CSS Scroll Snap Best Practices](https://ishadeed.com/article/css-scroll-snap/) - MEDIUM confidence (well-known frontend author)
- [Bidirectional Scrolling Accessibility](https://adamsilver.io/blog/bidirectional-scrolling-whats-not-to-like/) - MEDIUM confidence (accessibility expert, cited by CSS-Tricks)

### Existing Codebase (PRIMARY source for integration pitfalls)
- `src/app/(main)/layout.tsx` -- `max-w-7xl px-4 sm:px-6 lg:px-8` constraint that full-width migration must address
- `src/app/(main)/page.tsx` -- Current bento grid structure that Netflix rows must replace/integrate with
- `src/components/home/HeroSection.tsx` -- Current mesh gradient hero that will be replaced with Unsplash photo hero
- `src/components/sagra/SagraCard.tsx` -- Motion-wrapped card with FadeImage that Netflix rows will render 60-100x
- `src/components/search/SearchFilters.tsx` -- Existing nuqs-based filter state that city autocomplete must integrate with
- `supabase/functions/scrape-sagre/index.ts` -- Full scraping pipeline with inline filter copies, source-specific extraction
- `src/app/globals.css` -- `scrollbar-hide` utility already exists for Netflix rows
- `next.config.ts` -- Wildcard `**` hostname in remotePatterns (security concern to tighten)

---
*Pitfalls research for: Nemovia v1.4 "Esperienza Completa" -- Netflix rows, Unsplash API, city autocomplete, scraper expansion, full-width layout, data quality fixes*
*Researched: 2026-03-10*
