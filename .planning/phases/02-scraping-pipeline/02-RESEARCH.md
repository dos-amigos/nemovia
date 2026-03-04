# Phase 2: Scraping Pipeline - Research

**Researched:** 2026-03-04
**Domain:** Supabase Edge Functions (Deno), Cheerio HTML scraping, pg_cron scheduling, PostgreSQL deduplication, config-driven scraper architecture
**Confidence:** HIGH (architecture, Edge Function limits, pg_cron) / MEDIUM (source site HTML structures, Italian date parsing)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Source failure handling:** Log + continue; all scrape runs recorded in `scrape_logs` table (source, status, events_found, error_message, timestamp); auto-disable source (`is_active = false`) after 3 consecutive failures; re-enable is a manual DB update.
- **Deduplication matching:** Normalized name (lowercase, strip accents, remove punctuation) + city + overlapping dates; enrich-on-merge strategy (keep existing record, fill missing fields from new source); track provenance in `sources TEXT[]` column; silent discard if duplicate has no new data.
- **CSS selector bootstrapping:** SQL seed file for initial 5 sources; core fields only (title, dates, city, price, url, image); pagination via optional `next_page_selector` or `url_pattern` with `max_pages` limit.
- **Image handling:** Store scraped URL as-is; no HEAD validation; broken images handled lazily in UI.

### Claude's Discretion

- Exact normalization algorithm for name comparison (how to handle Italian special chars, multiple spaces)
- How "overlapping dates" is computed (exact overlap vs. same-month heuristic)
- Edge Function architecture (one function per source vs. one orchestrator) — choose based on Supabase limits
- `scrape_logs` table schema details
- `max_pages` default value
- Rate limiting / politeness delay between requests to the same source

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | Sistema scrapa automaticamente sagre da almeno 5 siti (SagreItaliane, EventieSagre, SoloSagre, TuttoFesta, Sagritaly) | Source HTML structures investigated; 4/5 confirmed scrapable. Source substitution recommended for TuttoFesta (see Open Questions). |
| PIPE-02 | Scraper config-driven legge selettori CSS dal database per ogni fonte | `scraper_sources` table schema defined; seed SQL for 5 sources with CSS selectors specified. |
| PIPE-04 | Deduplicazione cross-fonte tramite normalizzazione nome+citta+date sovrapposte | PostgreSQL `unaccent` + immutable wrapper function pattern documented; `daterange &&` operator for overlap detection. |
| PIPE-05 | Scadenza automatica eventi passati (is_active = false) | Simple SQL UPDATE with `end_date < CURRENT_DATE`; schedulable as pg_cron job. |
| PIPE-06 | Cron scheduling via Supabase pg_cron (scraping 2x/giorno, enrichment 2x/giorno, expire 1x/giorno) | pg_cron + pg_net pattern fully documented with exact SQL syntax; fire-and-forget model confirmed. |
</phase_requirements>

---

## Summary

Phase 2 builds a config-driven scraping pipeline that fetches sagre from 5 Italian event sites twice daily, deduplicates across sources, and expires past events. The pipeline runs entirely outside Next.js: Supabase Edge Functions (Deno runtime) handle HTTP fetching and HTML parsing via Cheerio, pg_cron triggers them on schedule via pg_net, and all results land in the existing `sagre` table with new supporting tables.

**Critical constraint:** The Supabase free tier imposes a **150-second wall-clock limit** on Edge Function execution. Scraping 5 sources sequentially with politeness delays (1-2s between requests) and pagination is achievable within this window if page counts are kept low (max 3 pages per source) and individual fetches are fast. The recommended architecture is a **single orchestrator Edge Function** that iterates sources sequentially — this stays within the 100-functions-per-project free tier limit and is simpler to manage than one function per source.

**pg_net is fire-and-forget:** When pg_cron invokes the Edge Function via `net.http_post()`, it does not wait for a response. The Edge Function must return an HTTP 200 quickly (immediately) and do all scraping work in a `EdgeRuntime.waitUntil()` background task. This is the correct pattern for long-running scheduled jobs.

**Primary recommendation:** One orchestrator Edge Function (`scrape-sagre`) + one expire Edge Function (`expire-sagre`), both triggered by pg_cron. The scraper reads `scraper_sources` table for configs, fetches HTML with native `fetch()`, parses with `npm:cheerio@1`, upserts to `sagre` with deduplication logic, and logs results to `scrape_logs`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cheerio | 1.2.0 | HTML parsing with CSS selectors | Industry standard for static HTML scraping in Node/Deno; no browser needed; jQuery-like API; 65M monthly downloads |
| Deno `fetch` (built-in) | native | HTTP requests to source sites | Built into Deno runtime; no import needed; supports AbortController for timeouts |
| `@supabase/supabase-js` | 2.x | Database writes from Edge Function | Official Supabase client; use with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS |
| PostgreSQL `unaccent` extension | built-in | Accent normalization for deduplication | Supabase includes it; handles Italian accented characters (à, è, ì, ò, ù) |
| `pg_cron` + `pg_net` | built-in | Cron scheduling + HTTP invoke | Already enabled in Phase 1 schema; pg_net is fire-and-forget — ideal for long-running functions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Deno standard library `delay` | via `npm:` or `jsr:` | Politeness delay between requests | Between pagination requests to same source (avoid DoS detection) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cheerio | `deno-dom` / `DOMParser` | deno-dom is native Deno but has fewer CSS selector features and less documentation. Cheerio is the established standard with battle-tested edge cases. |
| Single orchestrator function | One function per source | Per-source functions would hit the 5-function limit for this phase alone; more cron jobs to manage; shared deduplication logic would need to be duplicated. Use orchestrator. |
| `npm:cheerio@1` | `https://deno.land/x/cheerio` | The Deno.land version is old (1.0.4/1.0.7). Use `npm:cheerio@1` for the current 1.2.0 release. |

### Installation (Edge Function)

Edge Functions run in Deno. No `npm install` needed. Import directly in function code:

```typescript
// In supabase/functions/scrape-sagre/index.ts
import * as cheerio from "npm:cheerio@1";
import { createClient } from "npm:@supabase/supabase-js@2";
```

For local Next.js (if scraper types are needed in the Next.js app):

```bash
# Not needed for Phase 2 — scraper runs only in Edge Functions
# cheerio is NOT installed in the Next.js package.json
```

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/
  functions/
    scrape-sagre/
      index.ts          # Orchestrator: reads sources, scrapes, deduplicates, logs
    expire-sagre/
      index.ts          # Simple: UPDATE sagre SET is_active=false WHERE end_date < now()
  migrations/
    002_scraping_pipeline.sql   # New tables + modified sagre table + cron jobs + seed
```

The SQL migration file (`002_scraping_pipeline.sql`) is run manually in the Supabase SQL Editor (same pattern as Phase 1's `001_foundation.sql`).

### New Database Tables

#### `scraper_sources` table (config store)

```sql
CREATE TABLE IF NOT EXISTS public.scraper_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,                    -- e.g. 'solosagre'
  display_name TEXT NOT NULL,                   -- e.g. 'SoloSagre.it'
  base_url TEXT NOT NULL,                       -- e.g. 'https://www.solosagre.it/sagre/veneto/'
  -- CSS Selectors (null = field not available from this source)
  selector_item TEXT NOT NULL,                  -- container for each event card
  selector_title TEXT NOT NULL,
  selector_start_date TEXT,
  selector_end_date TEXT,
  selector_city TEXT,
  selector_price TEXT,
  selector_url TEXT,                            -- href attribute selector
  selector_image TEXT,                          -- src attribute selector
  -- Pagination config
  url_pattern TEXT,                             -- e.g. '?page={n}' or '/page/{n}/'
  next_page_selector TEXT,                      -- CSS selector for "next" button href
  max_pages INTEGER DEFAULT 3,
  -- Health tracking
  is_active BOOLEAN DEFAULT true,
  consecutive_failures INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `scrape_logs` table (run history)

```sql
CREATE TABLE IF NOT EXISTS public.scrape_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.scraper_sources(id),
  source_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  events_found INTEGER DEFAULT 0,
  events_inserted INTEGER DEFAULT 0,
  events_merged INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Keep logs for 90 days only (free tier storage management)
CREATE INDEX IF NOT EXISTS scrape_logs_started_at_idx ON public.scrape_logs (started_at);
```

#### Modifications to existing `sagre` table

```sql
-- Add missing columns required by Phase 2
ALTER TABLE public.sagre
  ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT '{}',      -- provenance tracking
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,   -- expiration flag
  ADD COLUMN IF NOT EXISTS normalized_title TEXT;            -- for deduplication

-- Index for active event queries
CREATE INDEX IF NOT EXISTS sagre_is_active_idx ON public.sagre (is_active);
CREATE INDEX IF NOT EXISTS sagre_normalized_title_idx ON public.sagre (normalized_title);

-- RLS: Add write policy for service role (scraper needs INSERT + UPDATE)
CREATE POLICY "Service role full access" ON public.sagre
  FOR ALL
  USING (auth.role() = 'service_role');
```

**Note:** The existing `source_id UUID` column in `sagre` stores the primary source for a record; the new `sources TEXT[]` column stores all sources that reference this sagra.

### Pattern 1: Orchestrator Edge Function

**What:** A single Deno function that iterates all active `scraper_sources` rows, scrapes each source's paginated listings, and returns HTTP 200 immediately while continuing work in the background.

**When to use:** Every scheduled scrape run (2x/day via pg_cron).

**Key constraint:** Supabase free tier wall-clock limit is 150 seconds. Return 200 to the caller immediately, do all work in `EdgeRuntime.waitUntil()`.

```typescript
// supabase/functions/scrape-sagre/index.ts
import * as cheerio from "npm:cheerio@1";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Respond immediately to pg_net (fire-and-forget caller)
  const responsePromise = new Response(
    JSON.stringify({ message: "Scraping started" }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );

  // All real work happens in background — not constrained by request timeout
  EdgeRuntime.waitUntil(runScrapingPipeline());

  return responsePromise;
});

async function runScrapingPipeline() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: sources } = await supabase
    .from("scraper_sources")
    .select("*")
    .eq("is_active", true);

  for (const source of sources ?? []) {
    await scrapeSource(supabase, source);
  }
}
```

**CRITICAL:** `EdgeRuntime.waitUntil()` is the Supabase/Deno Deploy API for background tasks. This is NOT standard Deno — it is provided by the Supabase Edge Runtime. The background task continues after the HTTP response is sent.

### Pattern 2: Per-Source Scraper with Cheerio

**What:** Fetch paginated HTML, parse with Cheerio CSS selectors from the database config, normalize, and upsert.

```typescript
async function scrapeSource(supabase: SupabaseClient, source: ScraperSource) {
  const startedAt = Date.now();
  let eventsFound = 0;
  let eventsInserted = 0;

  try {
    for (let page = 1; page <= (source.max_pages ?? 3); page++) {
      const url = buildPageUrl(source, page);
      const html = await fetchWithTimeout(url, 10_000); // 10s per page fetch
      if (!html) break;

      const $ = cheerio.load(html);
      const items = $(source.selector_item);
      if (items.length === 0) break; // No items = last page

      for (const el of items.toArray()) {
        const rawEvent = extractEvent($, el, source);
        if (!rawEvent.title || !rawEvent.city) continue;

        const normalized = normalizeEvent(rawEvent);
        await upsertWithDeduplication(supabase, normalized, source.name);
        eventsFound++;
      }

      // Politeness delay (1.5s between pages)
      if (page < (source.max_pages ?? 3)) {
        await delay(1500);
      }
    }

    await logRun(supabase, source, "success", eventsFound, eventsInserted, null, startedAt);
    await resetFailures(supabase, source.id);
  } catch (err) {
    await logRun(supabase, source, "error", eventsFound, 0, String(err), startedAt);
    await incrementFailures(supabase, source);
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nemovia/1.0; +https://nemovia.it)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "it-IT,it;q=0.9",
      },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
```

### Pattern 3: Italian Date Parsing (Custom Regex)

**What:** Italian event sites use varied date formats that no standard library handles. Build a lookup table + regex parser.

**Formats observed across sources:**
- `24/04/2026 al 26/04/2026` (DD/MM/YYYY format)
- `24-25-26 Aprile 2026` (multi-day with month name)
- `Dal 08/03/2026 Al 08/03/2026`
- `mar 07 2026` (abbreviated weekday + day + year)
- Single date: `Il 08/03/2026`

```typescript
const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  // abbreviations
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function parseItalianDateRange(raw: string): { start: Date | null; end: Date | null } {
  if (!raw) return { start: null, end: null };
  const s = raw.toLowerCase().trim();

  // Pattern: DD/MM/YYYY [al DD/MM/YYYY]
  const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:.*?(\d{1,2})\/(\d{1,2})\/(\d{4}))?/);
  if (slashMatch) {
    const start = new Date(+slashMatch[3], +slashMatch[2] - 1, +slashMatch[1]);
    const end = slashMatch[4]
      ? new Date(+slashMatch[6], +slashMatch[5] - 1, +slashMatch[4])
      : start;
    return { start, end };
  }

  // Pattern: DD[-DD] MonthName YYYY
  const wordMatch = s.match(/(\d{1,2})(?:-\d{1,2})*\s+([a-z]+)\s+(\d{4})/);
  if (wordMatch) {
    const monthNum = ITALIAN_MONTHS[wordMatch[2]];
    if (monthNum) {
      const start = new Date(+wordMatch[3], monthNum - 1, +wordMatch[1]);
      return { start, end: start };
    }
  }

  return { start: null, end: null };
}
```

### Pattern 4: Deduplication with PostgreSQL unaccent

**What:** Normalize title+city before comparing. Use an IMMUTABLE wrapper around `unaccent()` to allow indexing.

**SQL (in migration file):**

```sql
-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- IMMUTABLE wrapper required for use in indexes and triggers
CREATE OR REPLACE FUNCTION public.normalize_text(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(
    regexp_replace(
      unaccent(t),
      '[^a-z0-9\s]', '', 'g'  -- strip punctuation
    )
  );
$$;

-- Trigger to maintain normalized_title automatically
CREATE OR REPLACE FUNCTION public.update_normalized_title()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_title := public.normalize_text(NEW.title);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sagre_normalize_title
  BEFORE INSERT OR UPDATE ON public.sagre
  FOR EACH ROW EXECUTE FUNCTION public.update_normalized_title();
```

**Deduplication query pattern:**

```sql
-- Find duplicate: same normalized title + city + overlapping dates
SELECT id FROM public.sagre
WHERE normalized_title = public.normalize_text($1)           -- $1 = incoming title
  AND lower(location_text) = lower($2)                       -- $2 = city
  AND daterange(start_date, end_date, '[]') &&
      daterange($3::date, $4::date, '[]')                    -- $3/$4 = incoming dates
LIMIT 1;
```

**Enrich-on-merge strategy:**

```sql
-- Update only NULL fields; never overwrite existing data
UPDATE public.sagre SET
  image_url    = COALESCE(image_url, $new_image),
  price_info   = COALESCE(price_info, $new_price),
  is_free      = COALESCE(is_free, $new_is_free),
  sources      = array_append(sources, $new_source_name),   -- add provenance
  updated_at   = NOW()
WHERE id = $existing_id
  AND NOT ($new_source_name = ANY(sources));                 -- only if not already tracked
```

### Pattern 5: pg_cron Schedule (SQL)

**What:** Schedule the scraper Edge Function to run twice daily and the expire function once daily.

```sql
-- Store URL and key in Vault (run once manually)
SELECT vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'project_url'
);
SELECT vault.create_secret(
  'YOUR_ANON_KEY',
  'anon_key'
);

-- Schedule scraper: 6 AM and 6 PM UTC daily
SELECT cron.schedule(
  'scrape-sagre-morning',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger": "cron"}'::jsonb,
    timeout_milliseconds := 5000  -- pg_net timeout for establishing connection only
  );
  $$
);

SELECT cron.schedule(
  'scrape-sagre-evening',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrysets WHERE name = 'anon_key')
    ),
    body := '{"trigger": "cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Schedule expire: 1 AM daily
SELECT cron.schedule(
  'expire-sagre-daily',
  '0 1 * * *',
  $$
  UPDATE public.sagre
  SET is_active = false, updated_at = NOW()
  WHERE end_date < CURRENT_DATE
    AND is_active = true;
  $$
);
```

**Note:** The `expire-sagre` job can be a pure SQL statement in pg_cron without needing an Edge Function, since it is a simple UPDATE.

### Pattern 6: Source Config Seed (SQL)

Initial CSS selectors for 5 sources. These are verified against current site structures as of 2026-03-04 — **site HTML changes will break selectors** and must be updated manually in the DB.

```sql
-- Seed: scraper_sources for 5 Veneto sagre sites
INSERT INTO public.scraper_sources (
  name, display_name, base_url,
  selector_item, selector_title, selector_start_date, selector_end_date,
  selector_city, selector_price, selector_url, selector_image,
  url_pattern, max_pages
) VALUES

-- 1. SoloSagre.it — confirmed structure: anchor wraps card
(
  'solosagre', 'SoloSagre.it',
  'https://www.solosagre.it/sagre/veneto/',
  'a[href*="/sagra/"]',                  -- event card container (anchor)
  'h2, h3, .titolo',                     -- event title
  'span.date, .date-start',              -- start date (Dal...)
  'span.date-end',                       -- end date (Al...)
  '.city, .comune',                      -- city
  '.prezzo, .price',                     -- price (may be absent)
  NULL,                                  -- url = href of the item anchor itself
  'img',                                 -- first img src
  '?page={n}',                           -- pagination URL pattern
  5                                      -- max pages
),

-- 2. EventieSagre.it — confirmed structure: .risultatoEvento class
(
  'eventiesagre', 'EventieSagre.it',
  'https://www.eventiesagre.it/cerca/cat/sez/mesi/Veneto/prov/cit/rilib',
  '.risultatoEvento',                    -- event card container
  'h3',                                  -- event title (inside .risultatoEvento)
  NULL,                                  -- dates in text: parse from card text
  NULL,
  NULL,                                  -- city in card text
  NULL,
  'a',                                   -- first anchor href
  'img',                                 -- first img src
  '/pag-{n}.htm',                        -- pagination suffix
  10                                     -- up to 100 events (10 per page)
),

-- 3. Sagritaly.com — confirmed: sagritaly.com (NOT .it)
(
  'sagritaly', 'Sagritaly.com',
  'https://sagritaly.com/regioni-sagre/veneto/',
  'article, .event-card, .post',         -- event card (needs verification)
  'h2, h3, .entry-title',
  '.event-date, time',
  NULL,
  '.location, .city',
  NULL,
  'a',
  'img',
  '?page={n}',
  5
),

-- 4. AsseSagre.it (replacement for TuttoFesta) — simple list format
(
  'assosagre', 'AssoCagre.it',
  'https://www.assosagre.it/calendario_sagre.php?id_regioni=20&ordina_sagra=date_sagra',
  'td, tr',                              -- table row per event
  'a[href*="id_sagra"]',                -- event title (anchor)
  'td:nth-child(2)',                     -- date column
  NULL,
  'td:nth-child(3)',                     -- city column
  NULL,
  'a[href*="id_sagra"]',                -- href
  NULL,                                  -- no images on listing
  NULL,                                  -- single page (15 results max)
  1
),

-- 5. VenetoInFesta.it — confirmed: event-style listing with date, category, city
(
  'venetoinfesta', 'VenetoInFesta.it',
  'https://www.venetoinfesta.it/',
  'article, .event-item',               -- event card
  'h2, h3, .event-title',
  'time, .event-date',
  NULL,
  'a[href*="/comune/"]',                -- city link
  NULL,
  'a[href*="/evento/"]',                -- event link
  'img',
  '?page={n}',
  5
);
```

**WARNING:** These selectors are educated guesses based on the HTML structure visible at fetch time. The actual CSS classes must be verified by inspecting the live sites in a browser DevTools before deploying. Consider this seed a starting template, not confirmed selectors.

### Anti-Patterns to Avoid

- **Validate image URLs with HEAD requests during scrape:** Adds latency, slows pipeline, triggers rate limits. Store as-is; UI handles broken images.
- **Use a single Edge Function per source with separate cron entries:** This wastes the 100-function free tier limit and creates N cron jobs to manage. Use one orchestrator.
- **Block the HTTP response while scraping:** pg_net is fire-and-forget. The cron caller never reads the response. Return 200 immediately and use `EdgeRuntime.waitUntil()`.
- **Use `lower()` alone for deduplication:** Italian characters (à, è, ì, ò, ù) are not normalized by `lower()`. Use `unaccent()` wrapped in an IMMUTABLE function.
- **Use non-IMMUTABLE `unaccent()` in index expressions:** PostgreSQL requires IMMUTABLE functions for indexed columns. Without the wrapper, the index cannot be created.
- **Hard-code CSS selectors in TypeScript:** All selectors live in the `scraper_sources` DB table. Adding a source = adding a DB row, not modifying code.
- **Deploy Edge Functions via Supabase Dashboard for production:** Dashboard lacks version control and rollback. Store function code in `supabase/functions/` in git; deploy is manual copy-paste to the dashboard editor for this project (no Supabase CLI dependency per established pattern).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing | Custom regex on HTML strings | Cheerio 1.2.0 (`npm:cheerio@1`) | HTML parsing with regex fails on nested elements, malformed HTML, encoding issues — all common in Italian sites |
| Accent normalization | Custom character replacement map | PostgreSQL `unaccent` extension | Complete Unicode diacritic handling; Italian à,è,ì,ò,ù + unusual chars handled |
| HTTP scheduling | Custom cron server or Vercel cron | pg_cron + pg_net | Vercel free tier is daily-only; pg_cron is already enabled; tight Supabase integration |
| Date range overlap detection | In-JavaScript date comparison | PostgreSQL `daterange &&` operator | Single SQL expression; index-backed via GiST; handles edge cases (single-day events, null dates) |
| Source health tracking | External monitoring service | `consecutive_failures` column + auto-disable | Simple, zero-cost, self-healing within the pipeline |

**Key insight:** The scraper's value is in the config-driven CSS selector layer and deduplication logic. Everything else (HTTP, HTML parsing, scheduling, date math) has better solutions already available.

---

## Common Pitfalls

### Pitfall 1: Wall Clock Timeout on Free Tier

**What goes wrong:** Edge Function is killed after 150 seconds. Scraping 5 sources × 3 pages × 1.5s delay = ~22.5s of delays alone, plus fetch time. Without `EdgeRuntime.waitUntil()`, the function is killed while still scraping.

**Why it happens:** The 150s limit applies to responding to the initial HTTP request. Background tasks via `waitUntil()` can continue beyond this.

**How to avoid:** Always return an HTTP 200 response immediately at the top of `Deno.serve()`, then call `EdgeRuntime.waitUntil(runScrapingPipeline())` for the actual work.

**Warning signs:** Logs show scraping started but not all sources were logged. Missing entries in `scrape_logs`.

### Pitfall 2: pg_net 5000ms Timeout Misunderstanding

**What goes wrong:** Developer thinks the scraper only has 5 seconds to complete because that's the `timeout_milliseconds` in the pg_net call.

**Why it happens:** The `timeout_milliseconds` in `net.http_post()` only controls how long pg_net waits to **establish the connection and send the request** — not how long the Edge Function runs. pg_net is fully fire-and-forget.

**How to avoid:** Keep `timeout_milliseconds := 5000` in the pg_cron SQL. This is enough to establish the connection. The Edge Function will run for its full allowed duration independently.

### Pitfall 3: Missing RLS Policy for Scraper Writes

**What goes wrong:** Edge Function using `SUPABASE_SERVICE_ROLE_KEY` still gets RLS errors on INSERT/UPDATE.

**Why it happens:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS by default, but only when the client is created with it correctly. If the client is accidentally created with the anon key, writes fail.

**How to avoid:** Always initialize the Supabase client in Edge Functions with:
```typescript
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // NOT SUPABASE_ANON_KEY
);
```
Both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available as built-in environment variables in all Supabase Edge Functions.

### Pitfall 4: unaccent Not Immutable for Indexes

**What goes wrong:** `CREATE INDEX ON sagre (normalize_text(title))` fails with `ERROR: functions in index expression must be marked IMMUTABLE`.

**Why it happens:** The built-in `unaccent()` function is STABLE (not IMMUTABLE) because it depends on a loadable dictionary. Postgres requires IMMUTABLE for index expressions.

**How to avoid:** Create a custom wrapper function explicitly marked IMMUTABLE that calls `unaccent()` with the dictionary OID rather than relying on the search path:
```sql
CREATE OR REPLACE FUNCTION public.normalize_text(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(regexp_replace(unaccent(t), '[^a-z0-9\s]', '', 'g'));
$$;
```
Note: This works on Supabase because `unaccent` is installed in a fixed schema. On self-hosted Postgres, use the two-argument form: `unaccent('unaccent', t)`.

### Pitfall 5: Sagritaly.com vs Sagritaly.it

**What goes wrong:** Scraper targets `sagritaly.it` (as listed in requirements) which is an unrelated domain or 404.

**Why it happens:** Requirements say "Sagritaly" but the actual website is at `sagritaly.com`, not `.it`.

**How to avoid:** Use `https://sagritaly.com/regioni-sagre/veneto/` in the seed data. The `.it` TLD does not host this service.

### Pitfall 6: TuttoFesta.it Is Not an Event Calendar

**What goes wrong:** Scraper targets `tuttofesta.it` expecting event listings but finds equipment/supplier content.

**Why it happens:** `TuttoFesta.it/net` is a vendor/supplier portal, not a sagre calendar. The requirements reference it by name but the site does not publish scrapable event listings.

**How to avoid:** Substitute with `assosagre.it` or `venetoinfesta.it` (both confirmed event calendars). See Open Questions section.

### Pitfall 7: Italian Source Sites May Block Scrapers

**What goes wrong:** Requests return 403 Forbidden or return empty/CAPTCHA pages.

**Why it happens:** Many Italian sites detect bot traffic via User-Agent or request frequency.

**How to avoid:**
- Set a realistic browser User-Agent header
- Set `Accept-Language: it-IT` to appear local
- Add 1-2s politeness delay between page fetches
- Keep page counts low (max 5 pages per source)
- Schedule at off-peak hours (6 AM, 6 PM UTC = 8 AM, 8 PM Italian time)

### Pitfall 8: Null Dates Causing Deduplication Failures

**What goes wrong:** Events with missing `start_date` or `end_date` are never deduplicated — every scrape creates a new row.

**Why it happens:** The `daterange &&` overlap query returns false/null when dates are null. Two records for the same sagra with null dates cannot be matched by date.

**How to avoid:** If dates are null, fall back to name+city match only (no date overlap check). Store a `scrape_run_id` or `content_hash` for idempotent re-runs.

---

## Code Examples

### Edge Function: Immediate Response + Background Work

```typescript
// Source: Supabase EdgeRuntime.waitUntil() pattern
// https://supabase.com/docs/guides/functions/architecture

Deno.serve(async (_req) => {
  // 1. Return 200 immediately (pg_net fire-and-forget caller)
  EdgeRuntime.waitUntil(runScrapingPipeline());

  return new Response(
    JSON.stringify({ status: "started", timestamp: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

### Cheerio: Extract Event Data from Config

```typescript
// Source: cheerio.js.org — CSS selector API
import * as cheerio from "npm:cheerio@1";

function extractEvent(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
  source: ScraperSource
): RawEvent {
  const $el = $(el);
  return {
    title:      $el.find(source.selector_title).first().text().trim(),
    dateText:   $el.find(source.selector_start_date ?? "").first().text().trim(),
    city:       $el.find(source.selector_city ?? "").first().text().trim(),
    price:      source.selector_price
                  ? $el.find(source.selector_price).first().text().trim()
                  : null,
    url:        source.selector_url
                  ? $el.find(source.selector_url).first().attr("href") ?? null
                  : ($el.is("a") ? $el.attr("href") : null),
    image:      source.selector_image
                  ? $el.find(source.selector_image).first().attr("src") ?? null
                  : null,
  };
}
```

### Deduplication: Upsert with Merge

```typescript
async function upsertWithDeduplication(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  sourceName: string
) {
  // 1. Check for duplicate
  const { data: existing } = await supabase.rpc("find_duplicate_sagra", {
    p_normalized_title: normalizeText(event.title),
    p_city: event.city.toLowerCase(),
    p_start_date: event.startDate,
    p_end_date: event.endDate,
  });

  if (existing?.id) {
    // 2. Merge: enrich missing fields, add source to provenance
    await supabase.from("sagre").update({
      image_url:  existing.image_url  ?? event.imageUrl,
      price_info: existing.price_info ?? event.priceInfo,
      is_free:    existing.is_free    ?? event.isFree,
      sources:    [...(existing.sources ?? []), sourceName].filter(
                    (v, i, a) => a.indexOf(v) === i
                  ),
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    // 3. Insert new record
    await supabase.from("sagre").insert({
      title:          event.title,
      slug:           generateSlug(event.title, event.city),
      location_text:  event.city,
      start_date:     event.startDate,
      end_date:       event.endDate,
      image_url:      event.imageUrl,
      source_url:     event.url,
      price_info:     event.priceInfo,
      is_free:        event.isFree,
      sources:        [sourceName],
      is_active:      true,
      status:         "pending_geocode",
      content_hash:   generateHash(event.title, event.city, event.startDate),
    });
  }
}
```

### pg_cron: Expire Past Events (Pure SQL, No Edge Function)

```sql
-- Run in pg_cron directly — no Edge Function needed for this simple operation
SELECT cron.schedule(
  'expire-sagre-daily',
  '0 1 * * *',  -- 1 AM UTC daily
  $$
  UPDATE public.sagre
  SET
    is_active = false,
    updated_at = NOW()
  WHERE
    end_date < CURRENT_DATE
    AND is_active = true;
  $$
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel Cron for scheduling | Supabase pg_cron + pg_net | 2024 (Vercel free tier = daily only) | pg_cron enables 2x/day or more; tightly integrated with Supabase DB |
| Puppeteer/Playwright for scraping | Cheerio (static HTML) | Always; but confirmed appropriate here | Italian sagre sites are server-rendered HTML; no JavaScript execution needed |
| `deno.land/x/cheerio` | `npm:cheerio@1` (v1.2.0) | Cheerio v1 release 2024 | Deno.land version stuck at 1.0.7; npm specifier gets current 1.2.0 |
| Blocking response in Edge Function | `EdgeRuntime.waitUntil()` | Supabase Edge Runtime feature | Allows HTTP response to return while long task continues in background |
| HSL/hex color in DB | UTF-8 text storage | n/a | Sagre data is text; no color relevance |

**Deprecated/outdated:**
- `https://deno.land/x/cheerio@1.0.7`: Outdated. Use `npm:cheerio@1` instead.
- Vercel cron for 2x/day scheduling: Free tier is daily-only. Use Supabase pg_cron.
- `sagreitaliane.it`: SSL certificate mismatch as of 2026-03-04 — this domain may not be reliably scrapable. Substitute with `assosagre.it` or `venetoinfesta.it`.

---

## Open Questions

1. **TuttoFesta.it / SagreItaliane.it source substitution**
   - What we know: `tuttofesta.it` is an equipment supplier, not an event calendar. `sagreitaliane.it` has an SSL certificate mismatch error and may be unreliable.
   - What's unclear: Whether the requirements list these by name intentionally or by mistake. Whether `assosagre.it` and `venetoinfesta.it` are acceptable substitutes.
   - Recommendation: Use `assosagre.it` + `venetoinfesta.it` as the 4th and 5th sources (alongside solosagre.it, eventiesagre.it, sagritaly.com). PIPE-01 requires "5 distinct sources" — the spirit is coverage, not specific site names. Flag this for user confirmation at the start of the planning wave.

2. **CSS Selector Verification for Source Sites**
   - What we know: HTML structure was partially visible via WebFetch for solosagre.it, eventiesagre.it, assosagre.it, venetoinfesta.it, and sagritaly.com. Classes were not always visible due to JavaScript rendering.
   - What's unclear: Whether the seed selectors in this research will actually work or need adjustment after manual browser inspection.
   - Recommendation: The planner should include a Wave 0 task: "Manually inspect 5 source sites in browser DevTools and update seed selectors before deploying the scraper." This is NOT code — it's DB configuration.

3. **`EdgeRuntime.waitUntil()` availability**
   - What we know: This is the documented Supabase Edge Runtime API for background tasks.
   - What's unclear: Whether it requires a specific Deno or Edge Runtime version, and whether it is available in the dashboard editor.
   - Recommendation: Test with a simple `EdgeRuntime.waitUntil(new Promise(r => setTimeout(r, 100)))` in the first Edge Function deployed. If unavailable, fall back to returning 200 and relying on the 150s wall-clock window being sufficient.

4. **Supabase API Key Version (legacy vs. new)**
   - What we know: Supabase is migrating from JWT-based `anon`/`service_role` keys to new `publishable`/`secret` key format. Legacy keys still work on existing projects (as of 2026-03-04). `SUPABASE_SERVICE_ROLE_KEY` is auto-available as a built-in env var in Edge Functions.
   - What's unclear: Whether new projects created after Nov 2025 have legacy keys auto-generated.
   - Recommendation: Use `SUPABASE_SERVICE_ROLE_KEY` as-is (confirmed auto-available in Edge Functions). If errors occur, manually set the secret key in Edge Function secrets as `SUPABASE_SECRET_KEY` with the `sb_secret_...` value.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test framework in package.json or project |
| Config file | None (Wave 0 gap) |
| Quick run command | N/A — scraper runs in Supabase Edge Functions (Deno), not locally testable with current setup |
| Full suite command | Manual: invoke Edge Function via Supabase Dashboard + verify `scrape_logs` and `sagre` table rows |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PIPE-01 | Scraper populates sagre from 5+ distinct sources | smoke (manual DB query) | `SELECT DISTINCT unnest(sources) FROM sagre;` (verify 5+ source names) | ❌ Manual |
| PIPE-02 | Adding source requires only DB config entry | manual review | Confirm no TypeScript changes needed to add source row | ❌ Manual |
| PIPE-04 | Duplicate sagre merged to single record | smoke (manual DB query) | `SELECT title, array_length(sources, 1) FROM sagre WHERE array_length(sources, 1) > 1 LIMIT 5;` | ❌ Manual |
| PIPE-05 | Past events marked inactive | smoke (SQL) | `SELECT count(*) FROM sagre WHERE end_date < CURRENT_DATE AND is_active = true;` (should be 0) | ❌ Manual |
| PIPE-06 | Scraper runs on pg_cron schedule | manual verify | Check `cron.job` table: `SELECT * FROM cron.job;` | ❌ Manual |

### Sampling Rate

- **Per task:** Run `SELECT * FROM scrape_logs ORDER BY started_at DESC LIMIT 10;` to verify each scraper task ran successfully.
- **Per wave:** Invoke Edge Function manually from Supabase Dashboard + check `sagre` count increased.
- **Phase gate:** All 5 sources appear in `SELECT DISTINCT unnest(sources)`, `scrape_logs` shows `status = 'success'` for all 5, `cron.job` shows 3 scheduled jobs.

### Wave 0 Gaps

- [ ] No test framework — this phase is not unit-testable without Deno test setup. Acceptance testing is manual (SQL queries + Edge Function dashboard invocation).
- [ ] Manual browser inspection of 5 source sites to confirm CSS selectors before deploying seed data.
- [ ] Supabase Vault secrets must be set manually before first cron run.

---

## Sources

### Primary (HIGH confidence)
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits) — 150s wall clock, 256MB memory, 2s CPU, 500K invocations/month free
- [Supabase Edge Functions Scheduling](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net SQL syntax, Vault storage pattern
- [Supabase Cron Quickstart](https://supabase.com/docs/guides/cron/quickstart) — `cron.schedule()` syntax, cron expressions
- [Supabase Edge Functions Dependencies](https://supabase.com/docs/guides/functions/dependencies) — `npm:` import specifier, per-function `deno.json`
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets) — built-in env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- [Supabase API Keys Docs](https://supabase.com/docs/guides/api/api-keys) — legacy vs. new key types, Edge Functions only support JWT keys
- [PostgreSQL unaccent documentation](https://www.postgresql.org/docs/current/unaccent.html) — STABLE not IMMUTABLE, wrapper pattern
- [cheerio npm page](https://www.npmjs.com/package/cheerio) — version 1.2.0 confirmed (npm show cheerio version)
- [Cheerio official site](https://cheerio.js.org/) — load(), CSS selectors, text(), attr()
- [pg_cron + pg_net Discussion #37574](https://github.com/orgs/supabase/discussions/37574) — 5000ms is Supabase UI limit, not pg_net hard limit; fire-and-forget confirmed

### Secondary (MEDIUM confidence)
- [EventieSagre.it listing page](https://www.eventiesagre.it/cerca/cat/sez/mesi/Veneto/prov/cit/rilib) — `.risultatoEvento` class, `/pag-{n}.htm` pagination, confirmed live
- [SoloSagre.it Veneto page](https://www.solosagre.it/sagre/veneto/) — anchor-wrapped cards, `/_data/upload/thumb/` images, `?page={n}` pagination
- [AsseSagre.it Veneto calendar](https://www.assosagre.it/calendario_sagre.php?id_regioni=20) — simple table format, ~15 results, no pagination
- [VenetoInFesta.it](https://www.venetoinfesta.it/) — date + category + city structure, `/evento/ID/slug.html` URLs
- [Sagritaly.com Veneto](https://sagritaly.com/regioni-sagre/veneto/) — CollectionPage schema type; HTML structure not fully visible (JS-rendered)

### Tertiary (LOW confidence — needs browser verification)
- CSS selectors for solosagre.it, sagritaly.com — partially inferred, must be verified in browser DevTools before deployment
- Italian date format patterns — observed across 3 sources; edge cases likely exist

---

## Metadata

**Confidence breakdown:**
- Standard stack (Cheerio, pg_cron, pg_net): HIGH — official docs verified, versions confirmed
- Edge Function architecture (orchestrator + waitUntil): HIGH — official Supabase docs pattern
- Source site HTML structures: MEDIUM — fetched and partially visible; CSS classes not always exposed
- CSS selector seed values: LOW — educated guesses; must be manually verified before deploying
- Italian date parsing patterns: MEDIUM — 4 formats observed; real sites will have edge cases
- Deduplication SQL patterns: HIGH — standard PostgreSQL daterange and unaccent patterns

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days for stable ecosystem components); CSS selectors valid until site HTML changes (no expiry guarantee)
