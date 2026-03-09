# Domain Pitfalls

**Domain:** Advanced data quality filters + UI/UX redesign for existing Next.js 15 + Supabase sagre aggregator
**Researched:** 2026-03-09
**Confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major regressions.

---

### Pitfall 1: Overly Aggressive Filters Kill Real Sagre (False Positives in Data Quality)

**What goes wrong:**
New data quality filters designed to catch junk data inadvertently deactivate legitimate sagre. The v1.3 data quality requirements target seven problems (titoli spazzatura, date calendario, duplicati, durata assurda, eventi passati, foto bassa risoluzione, non-sagre). Each filter individually seems reasonable, but stacked together they create an aggressive exclusion chain where a real sagra can be rejected at multiple stages. With only 735 active sagre, losing 10-15% to false positives is catastrophic -- users see empty search results for their province.

**Why it happens:**
The precision-recall tradeoff is fundamental to classification. Each heuristic filter has a false positive rate. When you chain seven filters, false positives compound multiplicatively. Specific risks in the v1.3 scope:

1. **Duration filter ("durata assurda"):** Real sagre CAN last longer than 3 days. Multi-weekend sagre (e.g., "Festa del Radicchio" spanning 3 consecutive weekends) might have a start-to-end span of 15+ days. A naive "reject if duration > 7 days" filter would kill these.

2. **Non-sagre filter ("e una sagra?"):** Using Gemini to classify "is this a sagra?" will produce false negatives for events with titles like "Festa della Birra" (legitimate sagra, but could be classified as a "beer festival" rather than "sagra"). The boundary between sagra, festa, mercato, and fiera is culturally fuzzy -- even Italians disagree.

3. **Title noise filter (expanding existing isNoiseTitle):** Tightening the existing regex patterns (currently 150-char max) risks rejecting real sagre with long descriptive titles that some sources provide (e.g., "LXIII Sagra del Baccala alla Vicentina di Sandrigo con Degustazione Piatti Tipici").

4. **Duplicate detection:** Fuzzy matching between "Sagra del Pesce - Chioggia" and "Sagra del Pesce Fritto - Chioggia" could incorrectly merge two distinct events at different locations in the same city.

**Consequences:**
- Users searching for sagre in their province find fewer results
- The 735 active sagre drops to 500-600 without the user seeing any quality improvement
- Data loss is invisible until a user complains their local sagra is missing
- Rolled-back filters require manual reactivation of incorrectly deactivated rows

**Prevention:**
1. **DRY RUN first:** Every filter MUST run in "audit mode" before "enforcement mode." Query how many sagre would be deactivated, review the list manually, THEN enable the filter. SQL pattern: `SELECT id, title FROM sagre WHERE is_active = true AND <new_filter_condition>` before any `UPDATE`.
2. **Add a `deactivation_reason` column:** When a filter deactivates a sagra, store WHY (e.g., "duration_exceeded", "non_sagra_classification", "duplicate_of:uuid"). This enables review and rollback of specific filter false positives.
3. **Duration filter:** Use 21 days as max duration (covers 3-weekend sagre), not 7 days. Log and review anything between 7-21 days.
4. **Non-sagre LLM classification:** Use a confidence threshold. Gemini returns text, but you can prompt for a confidence score. Only reject when confidence > 0.85 that it is NOT a sagra. Below that, keep it.
5. **Test against known-good data:** Take 50 known-real sagre from production and verify every new filter passes them. This is the "golden set" regression test.

**Detection:**
- Active sagra count drops significantly after filter deployment (monitor `SELECT count(*) FROM sagre WHERE is_active = true` before and after)
- Users report missing sagre they know exist
- Province-level counts become unbalanced (one province suddenly has 2 sagre instead of 30)

**Phase to address:**
Phase: Data Quality Filters. Every filter task must include a "dry run" step with manual review before enforcement.

---

### Pitfall 2: Gemini Free Tier Rate Limits Break the Classification Pipeline

**What goes wrong:**
Adding LLM-based classification ("is this a sagra?") to the enrichment pipeline exhausts Gemini 2.5 Flash free tier limits. The current pipeline already uses Gemini for tag generation and description enrichment (BATCH_SIZE=8, up to 25 batches per invocation = 200 sagre). Adding a classification step doubles LLM calls. The free tier limits for Gemini 2.5 Flash are approximately 10 RPM and 250 RPD. A single enrich-sagre invocation with 200 sagre at BATCH_SIZE=8 = 25 requests. Running this twice daily for enrichment = 50 RPD. Adding classification at the same batch size = another 50 RPD. Total: 100 RPD, which fits within 250 RPD. BUT: classification should happen BEFORE enrichment (why enrich a non-sagra?), which means running classification on ALL pending items, not just the 200 that get enriched. With 735+ sagre and continuous scraping, backlog can spike.

**Why it happens:**
The current pipeline assumes a fixed enrichment load (200 sagre/invocation, 2x/day). Adding classification changes the flow from `scrape -> geocode -> enrich` to `scrape -> geocode -> classify -> enrich`. Classification runs on more items than enrichment because it must evaluate items that might be rejected. If scraping discovers 100 new items per day and classification happens before enrichment, you need 100/8 = 13 classification requests + 25 enrichment requests = 38 requests per invocation. Two invocations = 76 RPD. This seems safe, but a backlog from a scraper outage recovery (e.g., 3 days of accumulated items = 300 items needing classification = 38 requests just for classification) can spike past RPM limits.

**Consequences:**
- Gemini returns 429 (rate limit) errors, classification fails silently
- Sagre stuck in "pending_classification" status indefinitely
- Pipeline log shows "LLM batch enrichment error" repeatedly
- New sagre never appear in the app because they are stuck in an intermediate status

**Prevention:**
1. **Combine classification with enrichment in ONE LLM call.** Do not make two separate LLM requests (one for "is sagra?" and one for tags/description). Instead, expand the existing enrichment prompt to include: `is_sagra: boolean` in the response schema. This means zero additional LLM requests -- the same 25 batches that generate tags also classify.
2. **Add status "rejected_non_sagra" as an enrichment outcome.** After the combined LLM call, if `is_sagra === false`, set `status = "rejected_non_sagra"` and `is_active = false` instead of writing tags.
3. **Implement exponential backoff on 429 errors.** The current catch block in `runLLMPass` logs the error and continues to the next batch. Add a retry with delay: 429 -> wait 10s -> retry once. If second attempt fails, skip batch and continue.
4. **Monitor RPD usage.** Add a counter in `enrich_logs` for `llm_requests_count` to track how many API calls were made per invocation. Alert (via log) when approaching 200 RPD.

**Detection:**
- `enrich_logs` showing `llm_count = 0` when there are pending items
- Error messages containing "429" or "RESOURCE_EXHAUSTED" in Edge Function logs
- Growing backlog: `SELECT count(*) FROM sagre WHERE status IN ('pending_llm', 'pending_classification')` increasing over time

**Phase to address:**
Phase: Data Quality Filters (LLM classification task). The combined-prompt approach must be the architectural decision from the start.

---

### Pitfall 3: CSS Variable Swap During Redesign Breaks Every Shadcn Component

**What goes wrong:**
Changing the OKLCH color values in `globals.css` `:root` block to achieve the new "modern, WOW" aesthetic breaks Shadcn/UI components that depend on specific contrast relationships between `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--muted`, and `--muted-foreground`. A designer picks a beautiful new primary color (e.g., a vibrant indigo) but does not update `--primary-foreground` to maintain WCAG 4.5:1 contrast. Result: white text on a light-colored button becomes unreadable.

**Why it happens:**
Shadcn/UI's component library is built on paired CSS variables. Every `--X` has a corresponding `--X-foreground`. The components use `bg-primary text-primary-foreground`, `bg-accent text-accent-foreground`, etc. These pairs MUST maintain contrast ratios. When you change `--primary` from amber-600 (oklch 0.666 0.179 58.318) to, say, a lighter cyan, the existing `--primary-foreground: oklch(1 0 0)` (white) may no longer have sufficient contrast against the new primary.

The current Nemovia palette has 8 paired variables in `:root`:
- `--primary` / `--primary-foreground` (amber-600 / white)
- `--secondary` / `--secondary-foreground` (stone-100 / stone-900)
- `--accent` / `--accent-foreground` (green-700 / white)
- `--muted` / `--muted-foreground` (stone-100 / stone-500)
- `--destructive` / `--destructive-foreground`
- `--card` / `--card-foreground`
- `--popover` / `--popover-foreground`
- `--background` / `--foreground`

Changing ANY of these requires checking contrast of the pair AND checking how that variable is used across all components (badges, buttons, inputs, cards, nav elements).

Additionally, the current design uses hardcoded color references outside the CSS variable system:
- `HeroSection.tsx`: `bg-gradient-to-br from-amber-50 via-orange-50 to-green-50`
- `SagraCard.tsx`: `bg-gradient-to-br from-amber-100 to-green-100` (fallback placeholder)
- `SagraDetail.tsx`: `bg-gradient-to-br from-amber-100 to-green-100` (fallback placeholder)

These hardcoded Tailwind colors will NOT update when CSS variables change, creating visual inconsistency.

**Consequences:**
- Unreadable text on buttons, badges, inputs
- Visual inconsistency between themed components and hardcoded gradients
- Accessibility violations (WCAG contrast failure)
- The "new look" partially applied -- some elements look modern, others look like the old design

**Prevention:**
1. **Change ALL paired variables together.** Never change `--primary` without updating `--primary-foreground`. Use a contrast checker (e.g., tweakcn.com, the Shadcn theme generator) to validate all pairs before committing.
2. **Audit hardcoded colors first.** Before touching CSS variables, grep the codebase for hardcoded Tailwind color classes (`amber-`, `green-`, `stone-`, `orange-`) and convert them to use CSS variables or create new semantic variables (e.g., `--gradient-start`, `--gradient-end`).
3. **Use a theme generator.** The tweakcn.com tool generates complete Shadcn v4 themes with OKLCH values and validated contrast ratios. Generate the full theme, then swap ALL variables at once.
4. **Test every Shadcn component after variable swap.** Visit every page and interact with every component type: buttons (all variants), badges (default, secondary, outline), inputs, selects, cards, separators. Check in both light background sections and darker sections.

**Detection:**
- Text visually disappearing against backgrounds
- Lighthouse accessibility audit flagging contrast issues
- Gradients clashing with new color scheme

**Phase to address:**
Phase: UI/UX Redesign (color system task). This MUST be the first task in the redesign track -- every subsequent visual change builds on the color foundation.

---

### Pitfall 4: Redesigning UI While Animation System Is Tightly Coupled

**What goes wrong:**
The existing animation system (FadeIn, StaggerGrid, ScrollReveal, ParallaxHero, FrozenRouter, page transitions via AnimatePresence) is deeply wired into the component tree. Changing component structure during the redesign (e.g., moving from a simple card grid to a bento grid, or adding glassmorphism containers) breaks animations that depend on specific DOM structure and component hierarchy.

**Why it happens:**
The current animation architecture has specific coupling points:

1. **`template.tsx` uses AnimatePresence + FrozenRouter** for page cross-fade transitions. The FrozenRouter freezes `LayoutRouterContext` during exit. If the redesign adds new layout wrappers (e.g., a glassmorphism container between template and page content), the frozen context may not propagate correctly, causing either no exit animation or the wrong content being frozen.

2. **`SagraCard` has motion.div with whileHover/whileTap/exit.** If the card component is restructured (e.g., horizontal layout for bento grid), the motion wrapper must move with the interactive element. Wrapping a new card structure in motion.div without adjusting the animation targets creates janky hover effects on the wrong element.

3. **`ScrollReveal` uses `whileInView` with directional variants** (up, left, right). If the redesign changes the scroll container (e.g., adding a horizontal scroll section for featured sagre), elements inside a horizontal scroll won't trigger `whileInView` correctly because the intersection calculation assumes vertical scrolling.

4. **`ParallaxHero` uses `useScroll` + `useTransform`** and is disabled on desktop with `lg:!transform-none`. If the redesign changes the hero section layout, this CSS override must be updated or the parallax will either break or appear on desktop unintentionally.

5. **`BottomNav` uses `layoutId="bottomnav-active"`** for the animated active indicator. If the nav is redesigned (e.g., adding more tabs, changing to a different pattern), the layoutId animation must be preserved or replaced.

**Consequences:**
- Page transitions stop working or cause flashing/flickering
- Hover effects trigger on wrong elements or at wrong scale
- Scroll animations fire at wrong times or not at all
- The app looks "broken" during the redesign transition period

**Prevention:**
1. **Redesign in layers: colors first, then layout, then component structure.** Do NOT change colors + layout + component DOM simultaneously. Each layer affects animations differently.
2. **Keep animation wrappers stable while changing inner content.** If SagraCard is redesigned, keep the outer `motion.div` wrapper identical and change only the inner Card content.
3. **Test animations at each design change step.** After every component modification, verify: (a) page transitions still work, (b) card hover/tap works, (c) scroll reveal triggers correctly, (d) parallax works on mobile only.
4. **If switching from bento grid to a new layout pattern, update StaggerGrid's stagger timing.** The current `staggerChildren: 0.08` assumes grid items of similar size. Bento grids with mixed-size items need different stagger values or per-item delays.

**Detection:**
- Page navigation causing flash of unstyled content (FOUC)
- Cards "jumping" on hover instead of smooth scale
- Elements animating in from the wrong direction
- ParallaxHero visible on desktop (the `lg:!transform-none` override stopped working)

**Phase to address:**
Phase: UI/UX Redesign. Color changes FIRST (no animation impact), then component visual changes (test animations after each), then layout structural changes LAST (highest risk to animations).

---

## Moderate Pitfalls

---

### Pitfall 5: Edge Function Inline Copy Drift Gets Worse with New Filters

**What goes wrong:**
The existing tech debt of maintaining inline copies of pure functions in Edge Functions (documented in PROJECT.md as a revisit item) compounds when adding new data quality filters. Currently, `normalize.ts`, `date-parser.ts`, and `geocode.ts` are duplicated between `src/lib/` and `supabase/functions/`. Adding new filter functions (duration validation, title classification, duplicate detection) means more inline copies in Edge Functions. If a bug is fixed in `src/lib/scraper/normalize.ts` but not in `supabase/functions/scrape-sagre/index.ts`, the scraper behaves differently from local tests.

**Why it happens:**
Deno Edge Functions cannot import from the Next.js `src/` directory. This is a fundamental constraint of the Supabase Edge Function runtime. The project made a pragmatic decision in v1.0 to inline copies, and it worked fine with 3-4 small functions. But v1.3 adds potentially 5+ new filter functions across both Edge Functions, making the inline-copy approach increasingly fragile.

**Prevention:**
1. **Create a shared utility file in `supabase/functions/_shared/`.** Supabase Edge Functions support shared modules via the `_shared` directory convention. Move all pure utility functions there. Both `scrape-sagre` and `enrich-sagre` can import from `../_shared/filters.ts`.
2. **If `_shared` is not viable**, at minimum add a comment header to every inlined function: `// SYNC: Must match src/lib/scraper/normalize.ts normalizeText()` with date of last sync. Add a CI step or pre-commit check that diffs the inline copy against the canonical source.
3. **Add unit tests in `src/lib/` for every filter function.** Even though the Edge Function uses an inline copy, the test validates the canonical logic. If the canonical function passes tests, syncing the inline copy is safe.

**Detection:**
- Scraper behavior differs from local test expectations
- Bug fixed locally but still occurring in production
- Two different filter results for the same input (one from src/lib test, one from Edge Function)

**Phase to address:**
Phase: Data Quality Filters (first task). Resolve the shared module approach before adding new filter functions.

---

### Pitfall 6: Calendar Date Ranges Produce Invalid Date Spans

**What goes wrong:**
The v1.3 requirement to reject "date calendario" (entries like "1 gen -> 31 gen" that represent calendar pages, not real events) requires enhancing the date parser. But the current `parseItalianDateRange` function in the Edge Function already handles complex multi-segment date formats. Adding a "reject if span > N days" check after parsing creates false positives for legitimate multi-weekend sagre. Worse, some source sites encode recurring weekly events as a date range (e.g., "every Friday in June" becomes "01/06/2026 al 30/06/2026"), which looks like a calendar range but represents a real event series.

**Why it happens:**
The fundamental problem is that a date range alone does not distinguish between:
- A calendar page listing (1 Jan - 31 Dec) -- NOISE
- A month-long festival (15 Jul - 15 Aug) -- REAL but unusual
- A multi-weekend sagra (5-6, 12-13, 19-20 Jul) -- REAL, encoded as range
- A weekly recurring event (every Sat in June) -- REAL, encoded as range

The date parser produces start/end dates but loses the semantic context of whether the range represents continuous days, specific dates within a range, or a navigation/calendar artifact.

**Prevention:**
1. **Combine date span check with title analysis.** A 30-day range WITH a title containing "calendario", "elenco", or month names is noise. A 30-day range WITH a title like "Sagra del Baccala" is likely a real multi-weekend event.
2. **Use tiered thresholds:**
   - Span > 90 days: Always reject (no sagra lasts 3+ months)
   - Span 30-90 days: Reject if title matches noise patterns, otherwise flag for review
   - Span 7-30 days: Accept (legitimate multi-weekend events)
   - Span 1-7 days: Accept (typical sagra duration)
3. **Store the raw date text.** Add a `raw_date_text` column to preserve the original scraped date string. This enables post-hoc analysis of date parsing accuracy and manual review of edge cases.
4. **Handle null dates explicitly.** Currently, if `parseItalianDateRange` returns `{ start: null, end: null }`, the event is inserted with null dates. These should be flagged for review (they may be valid events with unparseable dates or navigation noise).

**Detection:**
- Sagre with month-long duration being deactivated
- Province counts dropping after duration filter
- `raw_date_text` values showing patterns the parser mishandles

**Phase to address:**
Phase: Data Quality Filters (date validation task). Implement tiered thresholds, not a single cutoff.

---

### Pitfall 7: Glassmorphism / Mesh Gradients Tank Mobile Performance

**What goes wrong:**
The v1.3 redesign targets "WOW effect" aesthetics including glassmorphism (frosted glass via `backdrop-filter: blur()`), mesh gradients, and potentially 3D elements. These CSS effects are GPU-intensive. On the mid-range Android phones typical of Italian sagre-searching users (Samsung Galaxy A series, Xiaomi Redmi Note), glassmorphism on large surfaces or multiple overlapping elements causes:
- Scroll jank (dropped frames below 30fps)
- Increased battery drain
- Visible rendering artifacts on low-end GPUs

**Why it happens:**
`backdrop-filter: blur()` is one of the most expensive CSS properties. It requires the browser to:
1. Render everything behind the element
2. Apply a Gaussian blur to that rendered layer
3. Composite the blurred layer with the semi-transparent foreground

This happens on EVERY frame if the content behind the element is scrolling. On desktop GPUs, this is unnoticeable. On a Qualcomm Adreno 610 (Galaxy A series GPU), it causes frame drops. The problem compounds when:
- Multiple glassmorphic elements overlap (each needs its own blur pass)
- The glassmorphic element is large (full-width nav bar, hero section)
- The background contains complex content (images, gradients, text)

Mesh gradients (`background: conic-gradient(...)` or canvas-based) are less problematic but still GPU-intensive when animated.

**Prevention:**
1. **Limit glassmorphism to 2-3 small elements per viewport.** Use it for nav bars, floating action buttons, or modal overlays -- NOT for full-width sections, card backgrounds, or every Badge.
2. **Reduce blur radius on mobile.** Use `backdrop-filter: blur(8px)` instead of `blur(20px)`. Lower blur = fewer GPU passes. Use a CSS media query: `@media (max-width: 768px) { .glass { backdrop-filter: blur(6px); } }`
3. **Never animate glassmorphic elements.** Do not use Motion to animate opacity, scale, or position on elements with `backdrop-filter`. The blur recomputation on every animation frame destroys performance.
4. **Use static mesh gradients, not animated ones.** Mesh gradients as backgrounds are fine (single paint). Animated mesh gradients (CSS animations on gradient stops) are expensive and add little value.
5. **Test with Chrome DevTools paint flashing.** Enable "Paint flashing" in Rendering panel. Green flashes on every scroll = the element is being repainted every frame. Glassmorphic elements should NOT flash green during scroll unless they are in a `position: fixed` layer.
6. **Provide a reduced-motion fallback.** For users with `prefers-reduced-motion`, replace `backdrop-filter: blur()` with a solid semi-transparent background (`background: oklch(0.97 0 0 / 0.85)`). This is already partially supported by the MotionConfig wrapper.

**Detection:**
- Scroll FPS below 30 on Chrome DevTools with CPU 4x throttle
- Paint flashing on scroll behind glassmorphic elements
- Users on older phones reporting sluggish navigation
- Lighthouse Performance score dropping

**Phase to address:**
Phase: UI/UX Redesign (visual effects task). Every glassmorphism addition must be performance-tested on CPU-throttled mobile viewport.

---

### Pitfall 8: Image Resolution Upgrade Creates Unpredictable External Fetches

**What goes wrong:**
The v1.3 requirement for higher-resolution images means the pipeline needs to either: (a) find higher-res versions of existing scraped images, or (b) fetch from the source detail page to find a better image. Both approaches introduce new HTTP fetches during the scraping/enrichment pipeline, which can:
- Exceed Edge Function wall clock timeout (150s free tier)
- Get blocked by source sites (increased request volume)
- Produce broken image URLs that fail at render time
- Introduce new external domains that need to be whitelisted in `next.config.ts` `remotePatterns`

**Why it happens:**
Current scraping extracts image URLs from listing pages, which often use thumbnails (100x80px). To get full-resolution images, you need to fetch the detail page for each sagra, parse it for a larger image, and store that URL. This means one additional HTTP request per sagra per scrape cycle. With 735+ sagre and 5 sources, that is hundreds of additional requests per scrape cycle, each with a 10-second timeout. The Edge Function wall clock limit of 150s (free tier) cannot accommodate this volume.

The current `next.config.ts` uses a catch-all `**` hostname pattern for images, which works but is a security concern. Adding image upgrade logic means even more unpredictable external domains.

**Prevention:**
1. **Do NOT fetch detail pages during scraping.** Instead, store the detail page URL (already in `source_url` column) and create a separate, dedicated Edge Function (`upgrade-images`) that runs independently, processes a small batch (10-20 sagre per invocation), and updates `image_url` with higher-res versions. This decouples image upgrade from the critical scrape->geocode->enrich pipeline.
2. **Use Supabase Storage for image proxying.** Instead of storing external URLs, download images to Supabase Storage and serve them from your own domain. This eliminates the `remotePatterns` wildcard issue and gives you control over image optimization. BUT: Supabase free tier storage is 1GB -- with 735 sagre at ~100KB each = ~73MB, well within limits.
3. **Validate image URLs before storing.** Send a HEAD request to check the image exists and is a reasonable size (> 5KB, < 5MB). Discard URLs returning 404, redirects to generic "no image" placeholders, or images smaller than 200x200px.
4. **Keep the existing image URL as fallback.** Store `image_url_hires` alongside the existing `image_url`. Display the high-res version if available, fall back to the original. Never overwrite a working image URL with an unvalidated one.

**Detection:**
- Broken images appearing on cards (image URL 404)
- Edge Function timing out more frequently
- Source sites blocking the scraper (increased request volume triggers rate limits)
- Next.js build warnings about unoptimized external images

**Phase to address:**
Phase: Data Quality Filters (image upgrade task). Implement as a separate Edge Function with small batch size.

---

## Minor Pitfalls

---

### Pitfall 9: Font Change Breaks Existing Layout Measurements

**What goes wrong:**
The redesign may involve switching from Inter (current font) to a different font for the "modern, WOW" look. Different fonts have different metrics (x-height, ascender/descender ratios, letter-spacing). Components with fixed heights (`h-16` for nav, `h-40` for card images, `h-48` for map) or line-clamp (`line-clamp-1`, `line-clamp-2`) will render differently with a new font, causing text overflow, clipping, or extra whitespace.

**Prevention:**
1. If changing fonts, do it in the SAME task as the color change (both are "design token" level changes).
2. After font swap, visually inspect every component with real Italian text (long titles like "Sagra del Baccala alla Vicentina con Piatti Tipici Tradizionali").
3. Use `next/font` for the new font (already the pattern with Inter) to ensure font loading does not cause layout shift.

**Detection:**
- Text being clipped in cards or nav
- Layout shift on font load (CLS regression)
- Italian characters with diacritics (a, e, o) rendering differently

**Phase to address:**
Phase: UI/UX Redesign (typography/color system task).

---

### Pitfall 10: Redesign Invalidates Existing OG Images and SEO Metadata

**What goes wrong:**
The sagra detail page generates dynamic OG images via `opengraph-image.tsx`. These images use hardcoded colors and the current design style. After the redesign, the OG images will look inconsistent with the new design -- they will show the old amber/green color scheme when shared on WhatsApp/Facebook while the actual page shows the new design. Social sharing is a core use case for Nemovia (Laura sends the link to her husband), so mismatched OG images create a poor impression.

**Prevention:**
1. Update `opengraph-image.tsx` as part of the redesign color task -- not as a separate task later.
2. After color variables change, regenerate and verify OG images for at least 3 sagre by visiting `/sagra/[slug]/opengraph-image` directly.
3. Consider adding the new brand identity elements (new colors, possibly new logo mark) to the OG image template.

**Detection:**
- Sharing a link on WhatsApp/Facebook shows old-style preview image
- OG image colors clashing with new design when seen side by side

**Phase to address:**
Phase: UI/UX Redesign (color system task, as a sub-task).

---

### Pitfall 11: Duplicate Detection with Fuzzy Matching Creates Incorrect Merges

**What goes wrong:**
The current deduplication uses `find_duplicate_sagra` RPC with normalized title + city + dates. The v1.3 requirement to improve duplicate detection (same junk event repeated multiple times) may lead to loosening the matching criteria. Looser matching causes distinct events to be merged. Example: "Sagra del Pesce" in Chioggia (July) and "Sagra del Pesce" in Chioggia (September) are DIFFERENT events at the same location. If the fuzzy matcher ignores dates, they merge into one.

**Prevention:**
1. NEVER relax date matching in dedup. Two events at the same city with different dates are always different events.
2. For same-city, same-title, same-date duplicates across sources: the current merge logic (keep first, merge sources array) is correct. Do not change it.
3. For detecting "same junk repeated multiple times": look for exact title matches (after normalization), not fuzzy matches. Junk entries typically have identical titles because they come from the same template page.
4. Add dedup metrics to `scrape_logs`: `events_deduped` count per scrape run.

**Detection:**
- Distinct sagre disappearing from search results
- Source count on merged sagre suspiciously high (5+ sources for one sagra)
- Users reporting that a well-known sagra is missing

**Phase to address:**
Phase: Data Quality Filters (duplicate detection task).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Data quality: title filters | False positives killing real sagre (#1) | Dry run every filter, manual review before enforcement |
| Data quality: LLM classification | Rate limit exhaustion (#2) | Combine classification with existing enrichment prompt |
| Data quality: duration filter | Multi-weekend sagre falsely rejected (#6) | Tiered thresholds (7/30/90 days), not a single cutoff |
| Data quality: duplicate detection | Distinct events incorrectly merged (#11) | Never relax date matching, use exact title match for junk |
| Data quality: image upgrade | Edge Function timeout, broken URLs (#8) | Separate Edge Function, small batches, fallback URL |
| Data quality: expired events filter | Events with null dates getting deactivated (#6) | Null dates should flag for review, not auto-deactivate |
| UI/UX: color system change | Shadcn component contrast breakage (#3) | Use theme generator, change all paired variables together |
| UI/UX: layout restructuring | Animation system breakage (#4) | Change colors first, then layout, then DOM structure |
| UI/UX: glassmorphism/effects | Mobile performance regression (#7) | Max 2-3 glass elements, test with CPU throttle |
| UI/UX: font change | Text overflow and layout shift (#9) | Test with real Italian text after font swap |
| UI/UX: new design | OG images outdated (#10) | Update opengraph-image.tsx with color system |
| Both tracks: Edge Function changes | Inline copy drift (#5) | Create `_shared/` directory or add sync comments |

---

## "Looks Done But Isn't" Checklist for v1.3

### Data Quality Track
- [ ] **Dry run verification:** Every filter was run in audit mode (SELECT) before enforcement (UPDATE) with results manually reviewed
- [ ] **Golden set regression:** 50 known-real sagre still pass all filters after deployment
- [ ] **Active count stability:** `SELECT count(*) FROM sagre WHERE is_active = true` is within 5% of pre-filter count (unless legitimate junk was extensive)
- [ ] **Province balance:** No province dropped to < 5 active sagre without explanation
- [ ] **Deactivation reasons:** Every deactivated sagra has a `deactivation_reason` value
- [ ] **Rate limit headroom:** `enrich_logs` shows `llm_requests_count` staying below 200 RPD
- [ ] **Pipeline still completes:** scrape-sagre + enrich-sagre cron cycle completes within 150s wall clock
- [ ] **Null date handling:** Sagre with unparseable dates are flagged for review, not auto-deactivated

### UI/UX Redesign Track
- [ ] **Contrast validation:** All Shadcn component color pairs (primary/primary-foreground, etc.) meet WCAG 4.5:1
- [ ] **Hardcoded colors eliminated:** No remaining `amber-`, `green-`, `stone-`, `orange-` Tailwind classes outside the design system
- [ ] **Page transitions still work:** Navigate between Home/Cerca/Mappa/Sagra detail -- AnimatePresence cross-fade works
- [ ] **Card animations intact:** Hover scale on desktop, tap scale on mobile, exit animation on navigation
- [ ] **ScrollReveal triggers:** Scroll down sagra detail page, sections animate in from correct directions
- [ ] **ParallaxHero mobile-only:** Parallax effect visible on mobile, disabled on desktop (lg:!transform-none still active)
- [ ] **BottomNav indicator:** layoutId animation on BottomNav still smoothly slides between tabs
- [ ] **Glassmorphism performance:** Chrome DevTools CPU 4x throttle, scroll through card grid with glass elements -- 30+ FPS
- [ ] **OG images updated:** Share a sagra link on WhatsApp, preview image shows new design colors
- [ ] **Skeleton-to-content match:** Loading skeletons match redesigned component structure at all breakpoints
- [ ] **Real device test:** Tested on actual Android phone (not just Chrome DevTools), touch interactions work correctly

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| False positive filter kills real sagre (#1) | LOW if deactivation_reason tracked | Query by deactivation_reason, bulk UPDATE is_active = true WHERE deactivation_reason = 'offending_filter'. 30 minutes |
| Gemini rate limit exhaustion (#2) | MEDIUM | Reduce batch frequency from 2x/day to 1x/day. Or switch to Gemini 2.5 Flash-Lite (15 RPM, 1000 RPD). 1-2 hours |
| CSS variables break components (#3) | LOW | Revert globals.css to pre-change values. The entire color system is in one file. 5 minutes revert, 2 hours to redo correctly |
| Animations broken by DOM restructure (#4) | HIGH | Requires understanding which animation wrapper broke and why. Each animation component (FadeIn, ScrollReveal, StaggerGrid, ParallaxHero, template.tsx) must be individually diagnosed. 4-8 hours |
| Edge Function inline copy drift (#5) | MEDIUM | Diff all inline copies against src/lib/ canonical copies. Sync manually. 2-3 hours |
| Duration filter rejects multi-weekend sagre (#6) | LOW | Widen threshold, reactivate falsely rejected sagre. 30 minutes |
| Glassmorphism performance regression (#7) | LOW | Remove or reduce backdrop-filter blur values. Replace with solid semi-transparent backgrounds. 1-2 hours |
| Image upgrade breaks pipeline (#8) | LOW | Disable image upgrade Edge Function, revert to original image URLs. 15 minutes |
| Font change breaks layout (#9) | LOW | Revert to Inter font in layout.tsx. 5 minutes |
| OG images outdated (#10) | LOW | Update colors in opengraph-image.tsx. 30 minutes |
| Incorrect merges from fuzzy dedup (#11) | MEDIUM | Identify merged records, split them (requires creating new rows from merged data). 2-4 hours |

---

## Sources

### Data Quality & Classification
- [Gemini API Free Tier Rate Limits 2026](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits) - MEDIUM confidence (third-party aggregation, verified against multiple sources)
- [Supabase Edge Function Limits](https://supabase.com/docs/guides/functions/limits) - HIGH confidence (official docs: 150s wall clock free tier, 2s CPU time, 256MB memory)
- [Data Deduplication and Canonicalization in Scraped Knowledge Graphs](https://scrapingant.com/blog/data-deduplication-and-canonicalization-in-scraped) - MEDIUM confidence (industry best practices)
- [Supabase Edge Function Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting) - HIGH confidence (official docs)

### UI/UX Redesign
- [Shadcn/UI Theming - OKLCH CSS Variables](https://ui.shadcn.com/docs/theming) - HIGH confidence (official Shadcn docs)
- [tweakcn.com - Shadcn Theme Generator](https://tweakcn.com/) - HIGH confidence (generates validated OKLCH themes with contrast checks)
- [Glassmorphism Performance Best Practices](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) - MEDIUM confidence (practical implementation guide with performance metrics)
- [Glassmorphism: Limit to 2-3 Elements, Reduce Mobile Blur](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026) - MEDIUM confidence (design guide with mobile-specific recommendations)
- [Customizing Shadcn/UI Themes Without Breaking Updates](https://medium.com/@sureshdotariya/customizing-shadcn-ui-themes-without-breaking-updates-a3140726ca1e) - MEDIUM confidence (community guide for safe theme changes)

### Animation System
- [Motion: AnimatePresence Common Bug](https://medium.com/javascript-decoded-in-plain-english/understanding-animatepresence-in-framer-motion-attributes-usage-and-a-common-bug-914538b9f1d3) - MEDIUM confidence (documents fragment children issue)
- [Next.js Image Component - External Images](https://nextjs.org/docs/app/api-reference/components/image) - HIGH confidence (official docs for remotePatterns configuration)

### Existing Codebase (PRIMARY source for pitfalls)
- `supabase/functions/scrape-sagre/index.ts` - Current scraping pipeline with isNoiseTitle, 5 source-specific branches
- `supabase/functions/enrich-sagre/index.ts` - Current enrichment pipeline with Gemini batching, geocoding, province validation
- `src/app/globals.css` - Current OKLCH color system with 8 paired variables
- `src/app/(main)/template.tsx` - AnimatePresence + FrozenRouter page transition system
- `src/components/sagra/SagraCard.tsx` - Card with motion.div hover/tap/exit animations
- `src/components/detail/SagraDetail.tsx` - Detail page with ScrollReveal, ParallaxHero, ScrollProgress
- `.planning/PROJECT.md` - Documented tech debt: inline Edge Function copies, wildcard image hostname

---
*Pitfalls research for: Nemovia v1.3 "Dati Puliti + Redesign" -- data quality filters + UI/UX redesign*
*Researched: 2026-03-09*
