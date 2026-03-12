# Phase 23: Scraping Completeness - Research

**Researched:** 2026-03-12
**Domain:** Web scraping detail pages, Supabase Edge Functions, Cheerio HTML extraction, database schema evolution, detail page UI
**Confidence:** MEDIUM-HIGH

## Summary

Phase 23 addresses SCRAPE-01: extracting maximum information from source sites (menu, orari, descriptions) to replace generic LLM-generated summaries with real content from event organizers. Currently, the scraper only extracts list-page data (title, dates, city, price, image, URL) but never visits individual event detail pages. The five active sources -- assosagre, venetoinfesta, itinerarinelgusto, sagritaly, and solosagre -- all have detail pages with varying levels of structured content including menus, opening hours, descriptions, and contact information.

The core architectural change is adding a "detail page scraping" step to the scrape-sagre Edge Function. After extracting basic event data from listing pages, the scraper will follow the `source_url` for each newly inserted/updated event and extract additional fields (description, menu, orari) from the detail page HTML. This requires: (1) new database columns for menu, orari, and richer descriptions, (2) per-source detail page extraction logic in the Edge Function, (3) a SQL migration, (4) updated detail page UI to display the new fields, and (5) updated Sagra TypeScript type.

**Primary recommendation:** Add detail page scraping as a second pass within scrape-sagre, fetching each event's source_url and extracting structured content with source-specific Cheerio selectors. Store in new `menu_text`, `orari_text`, and `source_description` columns. Display on SagraDetail with priority: source_description > enhanced_description > description.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRAPE-01 | Source sites scraped for complete info (menu, orari, descriptions) where available | Detail page HTML analysis for all 5 sources completed; Cheerio selectors identified; database schema extension designed; UI display strategy defined |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cheerio | 1.x | HTML parsing in Deno Edge Functions | Already used by scrape-sagre; `npm:cheerio@1` import pattern established |
| @supabase/supabase-js | 2.x | Database operations | Already used by both Edge Functions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest | Icons for menu/orari sections | Already in SagraDetail; add Clock, UtensilsCrossed icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cheerio per-page fetch | Puppeteer/Playwright | Overkill; all 5 sources are server-rendered HTML, no JS-dependent content |
| Separate detail-scrape Edge Function | Inline in scrape-sagre | Separate function adds deployment complexity; inline keeps pipeline atomic |
| Store menu as structured JSON | Store as plain text | Structured JSON requires complex parsing for each source format; plain text is simpler and sufficient for display |

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  functions/
    scrape-sagre/
      index.ts                # Add detail page scraping logic here
  migrations/
    013_scraping_completeness.sql  # New columns: menu_text, orari_text, source_description
src/
  types/
    database.ts               # Add new fields to Sagra interface
  components/
    detail/
      SagraDetail.tsx          # Display menu, orari, richer description
      MenuSection.tsx          # Optional: dedicated menu display component
      OrariSection.tsx         # Optional: dedicated orari display component
```

### Pattern 1: Detail Page Scraping Within Pipeline
**What:** After list-page scraping inserts/updates events, a second pass fetches each event's `source_url` to extract detail content.
**When to use:** When list pages have URLs to detail pages with additional structured content.
**Why:** Avoids a separate Edge Function invocation, keeps the pipeline atomic, respects rate limits with built-in politeness delays.

```typescript
// Pseudocode for detail page pass
async function scrapeDetailPages(
  supabase: SupabaseClient,
  sourceName: string,
  eventUrls: Array<{ id: string; url: string }>
): Promise<void> {
  for (const { id, url } of eventUrls) {
    const html = await fetchWithTimeout(url, 10_000);
    if (!html) continue;

    const $ = cheerio.load(html);
    const detail = extractDetailContent($, sourceName);

    if (detail.description || detail.menu || detail.orari) {
      await supabase.from("sagre").update({
        source_description: detail.description || undefined,
        menu_text: detail.menu || undefined,
        orari_text: detail.orari || undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
    }

    // Politeness delay between detail page fetches
    await new Promise(r => setTimeout(r, 1500));
  }
}
```

### Pattern 2: Source-Specific Detail Extractors
**What:** A switch/case dispatcher routes each source to its own Cheerio selector logic for detail extraction, similar to the existing `extractRawEvent()` pattern.
**When to use:** Each source has different HTML structure for menus, hours, and descriptions.

```typescript
interface DetailContent {
  description: string | null;
  menu: string | null;
  orari: string | null;
}

function extractDetailContent($: cheerio.CheerioAPI, sourceName: string): DetailContent {
  switch (sourceName) {
    case "assosagre":
      return extractAssosagreDetail($);
    case "venetoinfesta":
      return extractVenetoInFestaDetail($);
    case "itinerarinelgusto":
      return extractItinerariDetail($);
    case "sagritaly":
      return extractSagritalyDetail($);
    case "solosagre":
      return extractSolosagre Detail($);
    default:
      return { description: null, menu: null, orari: null };
  }
}
```

### Pattern 3: Conditional Detail Scraping
**What:** Only fetch detail pages for newly inserted events (not merges or skips), to minimize HTTP requests and stay within Edge Function timeout.
**When to use:** Always -- avoids re-scraping detail pages for events already in the database.

```typescript
// In scrapeSource(), collect new event URLs
const newEventUrls: Array<{ id: string; url: string }> = [];

// After upsertEvent returns "inserted":
if (result === "inserted" && normalized.url) {
  newEventUrls.push({ id: insertedId, url: normalized.url });
}

// After list page loop completes:
await scrapeDetailPages(supabase, source.name, newEventUrls);
```

### Anti-Patterns to Avoid
- **Fetching all detail pages every run:** Would cause timeout. Only fetch for newly inserted events or events missing detail content.
- **Parsing unstructured HTML as structured data:** Don't try to parse free-text menu descriptions into structured JSON (item name, price, etc.). Store as plain text -- it's simpler and more reliable.
- **Ignoring Edge Function timeout:** Supabase Edge Functions have a ~50s execution window. Detail page scraping adds significant time. Limit to a reasonable batch size per run.
- **Overwriting LLM descriptions with empty strings:** Some detail pages may have empty or useless descriptions. Only overwrite when source_description has meaningful content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing | Custom regex extractors | Cheerio selectors | Already used; handles malformed HTML, CSS selectors |
| Rate limiting | Custom request queue | Built-in `setTimeout` delays | Existing pattern works; 1.5s between requests |
| Text cleaning | Complex regex chains | Simple `.text().trim()` + whitespace normalization | Cheerio's `.text()` already handles entity decoding |

## Common Pitfalls

### Pitfall 1: Edge Function Timeout
**What goes wrong:** Adding detail page fetches (1.5s each) on top of list page fetches causes the Edge Function to exceed Supabase's execution limit (~50s wall-clock before fire-and-forget, but background can run longer with `EdgeRuntime.waitUntil`).
**Why it happens:** Each detail page fetch adds ~1.5-3s (network + politeness delay). 20 new events = 30-60s of additional detail scraping.
**How to avoid:** Limit detail page scraping to a maximum of 10-15 pages per source per run. Events that don't get detail-scraped in this run will be caught in subsequent runs by querying for events with `source_url IS NOT NULL AND source_description IS NULL`.
**Warning signs:** Scrape logs showing increasing `duration_ms` values or intermittent errors.

### Pitfall 2: Stale or Changed HTML Selectors
**What goes wrong:** Source sites change their HTML structure, breaking Cheerio selectors.
**Why it happens:** External websites are not under our control; they redesign, update CMS versions, etc.
**How to avoid:** Use resilient selectors (multiple fallback selectors per field). Log when extraction returns empty for detail pages that should have content. Use broad selectors like `div.content p` rather than deeply nested specific paths.
**Warning signs:** Scrape runs succeeding but returning empty menu/orari for all events from a source.

### Pitfall 3: Duplicate Detail Content on Merge
**What goes wrong:** When an event exists from multiple sources, detail content from one source overwrites another.
**Why it happens:** The `upsertEvent()` function merges missing fields from duplicate events.
**How to avoid:** Only update detail fields (`source_description`, `menu_text`, `orari_text`) if they are currently NULL in the database. Don't overwrite existing detail content with potentially lower-quality content from a different source.

### Pitfall 4: Encoding Issues with Italian Text
**What goes wrong:** Accented characters (e, a, o, u with accents common in Italian) appear garbled in stored text.
**Why it happens:** Some sites serve ISO-8859-1 or Windows-1252 encoding despite declaring UTF-8.
**How to avoid:** Cheerio handles most encoding automatically. For edge cases, normalize unicode after extraction: `.normalize("NFC")`.

### Pitfall 5: Menu/Orari Text Too Long
**What goes wrong:** Some sources have extremely long menus (20+ dishes with prices and descriptions) that overwhelm the detail page UI.
**Why it happens:** Different sagre have different menu complexity. Some list every dish, others just mention cuisine type.
**How to avoid:** Truncate `menu_text` and `orari_text` to reasonable limits (e.g., 2000 chars for menu, 500 chars for orari). Display with `whitespace-pre-line` for line breaks.

## Source Site Analysis

### Source 1: AsseSagre (assosagre.it)
**Detail page URL pattern:** `calendario_sagre.php?id_sagra={id}&id_provincia={id}`
**Available content (HIGH confidence -- verified via live fetch):**
- **Menu:** Full structured menu with categories (Primi, Secondi, Contorni, Dolci). Appears as plain text with category headers in bold. No consistent HTML container -- content is within main body text.
- **Orari:** Opening hours like "Apertura ore 19.30 - Domeniche a pranzo dalle ore 12.00". Embedded in address/venue text section.
- **Description:** Event name + date range + venue information. Limited narrative description.
- **Contact:** Phone numbers, email, social media links.
- **Extraction strategy:** Main content is largely unstructured text. Use broad text extraction from the main content area, then split menu/orari using keyword detection ("Primi:", "Secondi:", "Apertura ore", etc.).

### Source 2: VenetoInFesta (venetoinfesta.it)
**Detail page URL pattern:** `/evento/{id}/{slug}.html`
**Available content (HIGH confidence -- verified via live fetch):**
- **Description:** Full event narrative in `<div>` content area. References food offerings, activities, entertainment.
- **Orari:** In structured `<td>` with label "data:" -- includes specific times like "dalle 09:00 alle 19:00".
- **Menu:** Not structured separately; food info embedded in description text.
- **Contact:** Phone, email, organizer name in labeled table rows.
- **Extraction strategy:** Table-based layout with labeled rows (`<td>` labels like "dove:", "data:", "tel:"). Parse table structure for structured fields, grab description from main content div.

### Source 3: Itinerari nel Gusto (itinerarinelgusto.it)
**Detail page URL pattern:** `/sagre-e-feste/{slug}-{id}`
**Available content (HIGH confidence -- verified via live fetch):**
- **Description:** Rich narrative in `<div class="FullNews">` describing event history and traditions.
- **Menu:** Menu items sometimes listed as `<ul><li>` lists (e.g., "Cena Bavarese", "Cena del Baccala"). Not always present.
- **Orari:** Specific times per day listed in event details (e.g., "Venerdi 13 marzo - 19:30").
- **Schema.org:** JSON-LD with `@type: "FoodEvent"` including `startDate`, `location.address.streetAddress`, `organizer`.
- **Extraction strategy:** Use `.FullNews` for description. Parse JSON-LD for structured data. Look for `<ul>` lists within content for menu items.

### Source 4: Sagritaly (sagritaly.com)
**Detail page URL pattern:** `/territorio/eventi-e-sagre/{slug}/` (WordPress)
**Available content (MEDIUM confidence -- site was unreachable during research, based on search results):**
- **Description:** Event description with food specialties, activities.
- **Menu:** Specific food offerings mentioned (polenta variations, grilled items, local specialties).
- **Orari:** Event timing and hours.
- **Extraction strategy:** WordPress structure. Likely `.entry-content` or similar for main content. Need to verify selectors at implementation time.

### Source 5: SoloSagre (solosagre.it)
**Detail page URL pattern:** `/sagre/{region}/{province}/{city}/{slug}.html`
**Available content (MEDIUM confidence -- detail page returned 404 during research, likely URL format varies):**
- **Menu:** External link to Facebook for menu details ("cliccando QUI"). Menu text sometimes embedded in body.
- **Orari:** Opening times with seating info (e.g., "Friday/Saturday: 19:00 first seating, 21:00 second").
- **Description:** Event history and food focus description.
- **Extraction strategy:** Main content in `<article>` or similar container. Need to verify selectors at implementation time.

## Database Schema Changes

### New Columns (Migration 013)

```sql
ALTER TABLE public.sagre
  ADD COLUMN IF NOT EXISTS source_description TEXT,  -- raw description from source site
  ADD COLUMN IF NOT EXISTS menu_text TEXT,            -- menu/food offerings from source
  ADD COLUMN IF NOT EXISTS orari_text TEXT;           -- opening hours/schedule from source
```

**Why three separate columns instead of one JSON blob:**
1. Each field has distinct UI treatment (menu needs different formatting than orari)
2. Partial population is common (source may have menu but no orari)
3. Simpler to query and display
4. `source_description` vs `enhanced_description` distinction: source is real data, enhanced is LLM-generated

### TypeScript Type Update

```typescript
// src/types/database.ts - add to Sagra interface
export interface Sagra {
  // ... existing fields ...
  source_description: string | null;
  menu_text: string | null;
  orari_text: string | null;
}
```

## UI Display Strategy

### Description Priority Chain
1. `source_description` -- real content from organizer (highest priority)
2. `enhanced_description` -- LLM-generated summary (current fallback)
3. `description` -- original raw description (last resort)

### Detail Page New Sections

```tsx
// Menu section (only if menu_text exists)
{sagra.menu_text && (
  <div className="space-y-2">
    <h2 className="text-lg font-semibold flex items-center gap-2">
      <UtensilsCrossed className="size-4" />
      Menu
    </h2>
    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
      {sagra.menu_text}
    </p>
  </div>
)}

// Orari section (only if orari_text exists)
{sagra.orari_text && (
  <div className="space-y-2">
    <h2 className="text-lg font-semibold flex items-center gap-2">
      <Clock className="size-4" />
      Orari
    </h2>
    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
      {sagra.orari_text}
    </p>
  </div>
)}
```

## Edge Function Timeout Budget

Current scrape-sagre uses `EdgeRuntime.waitUntil()` for background execution. Estimated time budget:

| Activity | Current Time | With Detail Scraping |
|----------|-------------|---------------------|
| Load sources from DB | ~100ms | ~100ms |
| List page fetches (5 sources x 3 pages) | ~25s | ~25s |
| Item processing | ~5s | ~5s |
| Detail page fetches (max 10-15 per source) | 0s | ~25-35s |
| **Total** | **~30s** | **~55-65s** |

**Risk:** Tight on Edge Function limits. Mitigations:
1. Only scrape details for newly inserted events (not existing/merged)
2. Cap at 10 detail pages per source per run
3. Events missing details will be caught in subsequent cron runs (query: `source_url IS NOT NULL AND source_description IS NULL`)
4. Consider a "detail backfill" approach: separate query for events needing details, processed in later runs

### Alternative: Separate Detail Scraping Pass
If timeout is a concern, consider a separate approach:
- `scrape-sagre` continues to only scrape list pages (no timeout risk)
- Add a `scrape-details` Edge Function that runs after scrape-sagre (30 min offset)
- Queries for events with `source_url IS NOT NULL AND source_description IS NULL`
- Fetches detail pages in a dedicated time window

This separation is cleaner but adds deployment complexity (new Edge Function, new cron job).

## Code Examples

### AsseSagre Detail Extraction (verified from live HTML)
```typescript
function extractAssosagreDetail($: cheerio.CheerioAPI): DetailContent {
  // AsseSagre puts all content in the main body as plain text
  // Menu categories are marked with bold text like "Primi:", "Secondi:", etc.
  const bodyText = $('body').text();

  // Extract menu: look for food category headers
  const menuMatch = bodyText.match(
    /((?:Primi|Antipasti|Secondi|Contorni|Dolci|Grigliate|Bevande)[\s\S]*?)(?=Apertura|Prenotaz|Info|Contatt|$)/i
  );
  const menu = menuMatch ? menuMatch[1].trim().slice(0, 2000) : null;

  // Extract orari: look for "Apertura ore" pattern
  const orariMatch = bodyText.match(
    /(?:Apertura\s+ore|Orari|Orario)[\s\S]*?(?=\n\n|Prenotaz|Menu|Info|$)/i
  );
  const orari = orariMatch ? orariMatch[0].trim().slice(0, 500) : null;

  // Description: grab the main event narrative
  const descMatch = bodyText.match(
    /(?:La sagra|L'evento|Vi aspettiamo)[\s\S]*?(?=Primi:|Apertura|Menu|Info|$)/i
  );
  const description = descMatch ? descMatch[0].trim().slice(0, 1000) : null;

  return { description, menu, orari };
}
```

### VenetoInFesta Detail Extraction (verified from live HTML)
```typescript
function extractVenetoInFestaDetail($: cheerio.CheerioAPI): DetailContent {
  // VenetoInFesta uses a table layout with labeled rows
  let description: string | null = null;
  let orari: string | null = null;

  // Description: main content div (look for longest paragraph)
  const paragraphs = $('div p, div td').map((_, el) => $(el).text().trim()).get();
  const longestParagraph = paragraphs
    .filter(p => p.length > 50)
    .sort((a, b) => b.length - a.length)[0] ?? null;
  description = longestParagraph?.slice(0, 1000) ?? null;

  // Orari: look for table cells with time patterns
  $('td').each((_, el) => {
    const text = $(el).text().trim();
    if (/\b\d{1,2}:\d{2}\b/.test(text) && /dalle|ore|apertura/i.test(text)) {
      orari = text.slice(0, 500);
    }
  });

  return { description, menu: null, orari };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| List-page-only scraping | Detail page scraping for rich content | Phase 23 (now) | Replaces LLM summaries with real organizer content |
| Single `description` field | Three fields: source_description, enhanced_description, description | Phase 23 (now) | Clear priority chain for display |
| Generic LLM descriptions only | Source descriptions > LLM fallback | Phase 23 (now) | More accurate, more detailed event info |

## Open Questions

1. **Edge Function timeout tolerance**
   - What we know: `EdgeRuntime.waitUntil()` allows background execution beyond the initial response, but there's a hard limit (likely ~5-10 minutes for Supabase Free tier).
   - What's unclear: Exact hard timeout limit for background execution on the project's Supabase tier.
   - Recommendation: Start with inline detail scraping (capped at 10 pages per source), monitor `duration_ms` in scrape_logs. If timeouts occur, split into separate Edge Function.

2. **SoloSagre and Sagritaly detail page selectors**
   - What we know: These sites have detail pages with menus, orari, descriptions.
   - What's unclear: Exact HTML selectors (sagritaly.com was unreachable during research; solosagre detail page returned 404).
   - Recommendation: Implement extractors for assosagre, venetoinfesta, and itinerarinelgusto first (verified). Add sagritaly and solosagre extractors iteratively after manual inspection.

3. **Backfill vs forward-only**
   - What we know: There are likely 100+ existing events in DB with `source_url` but no detail content.
   - What's unclear: Whether to backfill all existing events or only scrape details for new events going forward.
   - Recommendation: Forward-only in the initial scrape run, then add a "backfill query" that finds events with `source_url IS NOT NULL AND source_description IS NULL` and processes them in subsequent runs (max 10-15 per run).

## Sources

### Primary (HIGH confidence)
- Live HTML fetch of assosagre.it detail page (`/calendario_sagre.php?id_sagra=52&id_provincia=18`) - menu structure, orari, contact info verified
- Live HTML fetch of venetoinfesta.it detail page (`/evento/13089/primavera-sulla-lia.html`) - table layout, time info, description structure verified
- Live HTML fetch of itinerarinelgusto.it detail page (`/sagre-e-feste/sagra-di-san-giuseppe-cassola-2233`) - JSON-LD FoodEvent schema, menu lists, orari verified
- Existing codebase: `supabase/functions/scrape-sagre/index.ts` - current scraper architecture, extractRawEvent pattern, source-specific branches
- Existing codebase: `src/components/detail/SagraDetail.tsx` - current detail page UI structure
- Existing codebase: `src/types/database.ts` - current Sagra type definition

### Secondary (MEDIUM confidence)
- WebSearch for eventiesagre.it detail page (`/Eventi_Sagre/21194807_La+Sagra+Della+Porchetta+A+Genova.html`) - JSON-LD Event schema, unstructured content
- WebSearch for sagritaly.com structure - WordPress CMS, `.entry-content` pattern likely but not verified
- WebSearch for solosagre.it structure - menu sometimes external (Facebook link), body text content

### Tertiary (LOW confidence)
- Sagritaly.com exact HTML selectors (site unreachable during research) -- flagged for manual verification during implementation
- SoloSagre.it detail page URL patterns (404 on tested URL) -- flagged for manual verification during implementation
- Edge Function hard timeout limit for `EdgeRuntime.waitUntil()` background execution

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - uses existing libraries (Cheerio, Supabase JS), no new dependencies
- Architecture: HIGH - follows established extractRawEvent pattern, extends existing Edge Function
- Source site selectors (assosagre, venetoinfesta, itinerarinelgusto): HIGH - verified from live HTML
- Source site selectors (sagritaly, solosagre): LOW - could not verify during research
- Pitfalls: MEDIUM-HIGH - timeout concerns are real but mitigations are well-understood
- UI changes: HIGH - straightforward extension of existing SagraDetail component

**Research date:** 2026-03-12
**Valid until:** 2026-03-26 (14 days -- source site HTML may change)
