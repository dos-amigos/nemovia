# Phase 14: Data Quality Heuristic Filters - Research

**Researched:** 2026-03-09
**Domain:** Data pipeline validation, heuristic text/date filtering, SQL retroactive cleanup
**Confidence:** HIGH

## Summary

Phase 14 addresses five concrete data quality problems visible in production: garbage calendar-spam titles passing the noise filter, month-long date ranges that are clearly not real sagre, events with absurd durations (>7 days), expired 2025 events still showing, and the need to retroactively clean existing dirty data. All five requirements are solvable with deterministic heuristic filters -- no ML, no LLM, no external dependencies.

The current pipeline already has the architectural hooks for these filters. The `isNoiseTitle()` function in `scrape-sagre/index.ts` (line 172) provides the interception point for title validation. Date validation can be added as a parallel filter after `normalizeRawEvent()` produces parsed dates. The `expire-sagre-daily` pg_cron job (migration 002, section 9) already handles expiration but has a gap for year-based filtering. The retroactive cleanup follows the exact pattern established in `005_data_quality.sql`.

**Primary recommendation:** Add new validation functions to the scrape pipeline (after normalization, before upsert), strengthen the noise title regex, fix the expire cron to handle year boundaries, and run a one-time SQL cleanup migration for existing dirty data.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DQ-01 | Pipeline rifiuta titoli spazzatura generici (es. "Calendario mensile eventi sagre...") tramite filtro noise migliorato | Existing `isNoiseTitle()` at line 172 of scrape-sagre/index.ts needs expanded regex patterns; current pattern `calendario\s.*(mensile\|regioni\|italian)` is too narrow |
| DQ-02 | Pipeline rifiuta eventi con date calendario (range mensili tipo 1 gen -> 31 gen) che non rappresentano sagre reali | No date range validation exists today; add `isCalendarDateRange()` check after `parseItalianDateRange()` produces start/end dates |
| DQ-03 | Pipeline rifiuta eventi con durata assurda (>7 giorni) | No duration check exists today; add `isExcessiveDuration()` computing day diff between start_date and end_date |
| DQ-04 | Pipeline rimuove eventi passati del 2025 e precedenti | Current expire cron only checks `end_date < CURRENT_DATE`; needs additional check for `start_date` year < current year when end_date is null, plus explicit year < 2026 check |
| DQ-05 | Cleanup retroattivo dei dati esistenti in produzione che violano i nuovi filtri | Follow exact pattern from `005_data_quality.sql`; SQL UPDATE setting is_active = false for rows matching new filter criteria |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. All work is pure TypeScript heuristic logic + SQL.

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `scrape-sagre/index.ts` | `supabase/functions/scrape-sagre/index.ts` | Scraping Edge Function where all validation filters live | Existing pipeline entry point; filters must run here to prevent dirty data from being inserted |
| `src/lib/scraper/` | `src/lib/scraper/normalize.ts`, `date-parser.ts` | Canonical source-of-truth for pure functions | Tests exist here; Edge Function copies inline (known tech debt) |
| pg_cron | `002_scraping_pipeline.sql` section 9 | Expire cron job `expire-sagre-daily` | Already deployed, just needs SQL update |
| SQL migration | `supabase/migrations/006_heuristic_filters.sql` | Retroactive cleanup of existing dirty data | Follows established pattern from `005_data_quality.sql` |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Vitest | Unit tests for new filter functions | Test every heuristic in `src/lib/scraper/` before copying to Edge Function |
| Supabase SQL Editor | Run cleanup migration + verify results | One-time retroactive data cleanup (DQ-05) |
| Supabase Dashboard | Update pg_cron job SQL | Modify expire-sagre-daily cron expression |

### Alternatives Considered

None. This phase is purely deterministic filter logic -- no library decisions to make.

## Architecture Patterns

### Recommended Project Structure

```
src/lib/scraper/
  normalize.ts          # existing -- no changes needed
  date-parser.ts        # existing -- no changes needed
  filters.ts            # NEW -- all heuristic filter functions
  __tests__/
    normalize.test.ts   # existing
    date-parser.test.ts # existing
    filters.test.ts     # NEW -- comprehensive tests for filters

supabase/functions/scrape-sagre/
  index.ts              # MODIFIED -- add filter calls after normalization

supabase/migrations/
  006_heuristic_filters.sql  # NEW -- retroactive cleanup + expire fix
```

### Pattern 1: Filter Functions as Pure Predicates

**What:** Each filter is a pure function returning `boolean` (true = reject this event).
**When to use:** Every new validation rule.
**Why:** Pure functions are trivially testable, easy to copy to Edge Function, and composable.

```typescript
// src/lib/scraper/filters.ts

/**
 * Enhanced noise title detection.
 * Returns true if the title should be REJECTED.
 */
export function isNoiseTitle(title: string): boolean {
  if (!title || title.length < 5 || title.length > 150) return true;
  const t = title.toLowerCase();

  // Calendar/navigation noise - EXPANDED patterns
  if (/calendario\s.*(mensile|regioni|italian|eventi|sagre)/i.test(t)) return true;
  if (/cookie|privacy\s*policy|termini\s*(e\s*)?condizion/i.test(t)) return true;
  if (/cerca\s+sagr|ricerca\s+event/i.test(t)) return true;
  if (/^(menu|navigazione|home)\b/i.test(t)) return true;
  if (/^[\d\s\-\/\.]+$/.test(title.trim())) return true;
  if (/tutte le sagre|elenco sagre|lista sagre/i.test(t)) return true;
  if (/gennaio.*dicembre|dicembre.*gennaio/i.test(t)) return true;

  // NEW: Additional spam patterns from production data analysis
  if (/calendario\b/i.test(t) && /eventi|sagre|feste/i.test(t)) return true;
  if (/programma\s+(completo|mensile|settimanale)/i.test(t)) return true;
  if (/scopri\s+tutt[ei]|vedi\s+tutt[ei]/i.test(t)) return true;
  if (/newsletter|iscriviti|registrati/i.test(t)) return true;

  return false;
}

/**
 * Detect calendar-spam date ranges (whole month or near-whole month).
 * A date range starting on day 1 and ending on day 28-31 of ANY month = calendar spam.
 * Returns true if the date range should be REJECTED.
 */
export function isCalendarDateRange(
  startDate: string | null,
  endDate: string | null
): boolean {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if range spans ~full month: starts on 1st, ends on 28th-31st
  if (start.getDate() === 1 && end.getDate() >= 28) {
    return true;
  }

  return false;
}

/**
 * Detect events with unreasonable duration (>7 days).
 * Real sagre last 1-3 days, occasionally up to a week.
 * Returns true if the duration should be REJECTED.
 */
export function isExcessiveDuration(
  startDate: string | null,
  endDate: string | null,
  maxDays: number = 7
): boolean {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > maxDays;
}

/**
 * Detect events from past years (2025 and earlier).
 * Returns true if the event should be REJECTED.
 */
export function isPastYearEvent(
  startDate: string | null,
  endDate: string | null
): boolean {
  const currentYear = new Date().getFullYear();

  if (startDate) {
    const startYear = new Date(startDate).getFullYear();
    if (startYear < currentYear) return true;
  }

  if (endDate) {
    const endYear = new Date(endDate).getFullYear();
    if (endYear < currentYear) return true;
  }

  return false;
}
```

### Pattern 2: Filter Integration in Scrape Pipeline

**What:** Call filter functions between normalization and upsert in the scraping loop.
**When to use:** In `scrapeSource()` function of `scrape-sagre/index.ts`.

```typescript
// In scrapeSource() loop, after normalizeRawEvent() and before upsertEvent():

const normalized = normalizeRawEvent(raw, source.name);

// NEW: Date quality filters
if (isCalendarDateRange(normalized.startDate, normalized.endDate)) continue;
if (isExcessiveDuration(normalized.startDate, normalized.endDate, 7)) continue;
if (isPastYearEvent(normalized.startDate, normalized.endDate)) continue;

const result = await upsertEvent(supabase, normalized, source.name);
```

### Pattern 3: Edge Function Inline Copy

**What:** Pure functions defined in `src/lib/scraper/filters.ts` must be copied inline into the Edge Function.
**When to use:** Every time filters.ts changes.
**Why:** Deno Edge Functions cannot import from Next.js `src/` directory (documented tech debt in PROJECT.md).

The Edge Function already has inline copies of `normalizeText`, `generateSlug`, `generateContentHash`, `parseItalianDateRange`, and `isNoiseTitle`. The new filter functions follow the same pattern.

### Pattern 4: SQL Retroactive Cleanup Migration

**What:** A new SQL migration file that deactivates existing rows violating the new heuristic filters.
**When to use:** One-time execution after deploying the updated Edge Function.
**Why:** New filters only prevent future dirty data; existing data needs cleanup.

```sql
-- 006_heuristic_filters.sql

-- Step 1: Deactivate calendar-spam date ranges (full month ranges)
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL
  AND EXTRACT(DAY FROM start_date) = 1
  AND EXTRACT(DAY FROM end_date) >= 28;

-- Step 2: Deactivate events with duration > 7 days
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL
  AND (end_date - start_date) > 7;

-- Step 3: Deactivate events from 2025 and earlier
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < 2026)
    OR (end_date IS NOT NULL AND EXTRACT(YEAR FROM end_date) < 2026)
  );

-- Step 4: Enhanced noise title cleanup (expanded patterns)
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    lower(title) ~ 'calendario\b.*\b(eventi|sagre|feste)'
    OR lower(title) ~ 'programma\s+(completo|mensile|settimanale)'
    OR lower(title) ~ 'scopri\s+tutt[ei]|vedi\s+tutt[ei]'
    OR lower(title) ~ 'newsletter|iscriviti|registrati'
  );
```

### Pattern 5: Expire Cron Fix

**What:** Update the `expire-sagre-daily` cron job to also catch events with null end_date whose start_date is past, and events from previous years.
**Current SQL (from 002):**
```sql
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE end_date < CURRENT_DATE AND is_active = true;
```

**Updated SQL:**
```sql
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    -- Original: end_date in the past
    (end_date IS NOT NULL AND end_date < CURRENT_DATE)
    -- NEW: start_date in the past with no end_date (single-day events)
    OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE)
    -- NEW: events from previous years (catch-all safety net)
    OR (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
  );
```

### Anti-Patterns to Avoid

- **LLM-based filtering for this phase:** These are deterministic rules. Using Gemini for "is this a real sagra" is Phase 15 (DQ-07). Do not conflate the two.
- **Regex-only without date math:** Calendar spam detection needs actual date arithmetic (day-of-month checks, duration calculation), not just text pattern matching.
- **Deleting rows instead of deactivating:** Always `SET is_active = false` -- never DELETE. Historical data may be useful for debugging.
- **Modifying `src/lib/scraper/date-parser.ts`:** The date parser's job is to PARSE dates, not validate them. Validation is a separate concern that belongs in filters.ts.
- **Forgetting the Edge Function copy:** If you only update `src/lib/scraper/filters.ts` but forget to copy the functions into `scrape-sagre/index.ts`, the production pipeline will not use the new filters.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic | Custom date math with milliseconds | Standard `Date` constructor + getTime() diff | JS Date handles leap years, month lengths, timezone correctly |
| Regex optimization | Complex single regex for all noise patterns | Multiple simple regex checks with early return | Maintainability >>> micro-performance for <1000 events/run |
| Year boundary detection | Hardcoded 2025/2026 check | `new Date().getFullYear()` comparison | Automatically correct when crossing into 2027 |
| SQL date extraction | String manipulation on date columns | `EXTRACT(DAY/MONTH/YEAR FROM date)` | PostgreSQL built-in, index-friendly, handles edge cases |

## Common Pitfalls

### Pitfall 1: Timezone Confusion in Date Comparison

**What goes wrong:** `new Date("2026-03-09")` in JavaScript creates a date at midnight UTC, but PostgreSQL `CURRENT_DATE` uses the database server's timezone.
**Why it happens:** The scraper stores dates as `DATE` type (no timezone), but JS Date constructor interprets ISO strings as UTC.
**How to avoid:** Use date-only string comparison (YYYY-MM-DD) whenever possible. In SQL, use `CURRENT_DATE` which is date-only. In JS, use `new Date().toISOString().split('T')[0]` for today's date.
**Warning signs:** Events appearing/disappearing at midnight, off-by-one-day filtering.

### Pitfall 2: Overly Aggressive Noise Filtering

**What goes wrong:** A regex like `/calendario/i` would match legitimate titles like "Sagra della Polenta - Calendario 2026" which might be a real event page.
**Why it happens:** Noise patterns overlap with real content.
**How to avoid:** Use multi-word patterns (`calendario\b.*\b(eventi|sagre|feste)`) not single-word matches. Test against real production titles before deploying.
**Warning signs:** Legitimate sagre disappearing from the app after filter deployment.

### Pitfall 3: NULL Date Handling

**What goes wrong:** Events with NULL start_date or end_date bypass all date-based filters.
**Why it happens:** Some scraped events have unparseable date text, resulting in NULL dates.
**How to avoid:** Each filter function must explicitly handle NULL dates (return false = don't reject). The expire cron must handle the NULL end_date case separately.
**Warning signs:** Events with no dates persisting forever in the app.

### Pitfall 4: Edge Function Deployment Forgetting

**What goes wrong:** Filters work perfectly in local tests but production pipeline keeps inserting dirty data.
**Why it happens:** Updated `src/lib/scraper/filters.ts` but forgot to copy changes into `supabase/functions/scrape-sagre/index.ts` and redeploy the Edge Function.
**How to avoid:** Implementation plan must have explicit "copy to Edge Function" and "deploy Edge Function" steps. Verify by triggering a manual scrape run after deployment.
**Warning signs:** New dirty data appearing in production after "deploying" filters.

### Pitfall 5: Calendar Range False Positives

**What goes wrong:** A real multi-day sagra starting on the 1st of a month gets rejected as "calendar spam".
**Why it happens:** The `isCalendarDateRange` check only looks at day-of-month boundaries.
**How to avoid:** Combine the day-1-to-28+ check WITH a duration check. A real sagra starting on the 1st would only span 2-3 days, not 28+. The combined filter (day-1 start AND end >= day 28) has very low false positive risk because no real sagra spans 28 days.
**Warning signs:** Legitimate June 1-3 sagra being filtered out (it won't be, because end_date day = 3, not >= 28).

### Pitfall 6: Cron Job Update Requires Unschedule + Reschedule

**What goes wrong:** Trying to `cron.schedule('expire-sagre-daily', ...)` when it already exists creates a duplicate or errors.
**Why it happens:** pg_cron does not have UPDATE semantics -- you must unschedule then reschedule.
**How to avoid:** Always `SELECT cron.unschedule('expire-sagre-daily')` before `SELECT cron.schedule(...)`.
**Warning signs:** SQL error on cron.schedule, or two cron jobs with the same name running simultaneously.

## Code Examples

### Filter Function Tests (verified patterns from existing test structure)

```typescript
// src/lib/scraper/__tests__/filters.test.ts
import { describe, it, expect } from "vitest";
import {
  isNoiseTitle,
  isCalendarDateRange,
  isExcessiveDuration,
  isPastYearEvent,
} from "../filters";

describe("isNoiseTitle", () => {
  it("rejects calendar spam titles", () => {
    expect(isNoiseTitle("Calendario mensile eventi sagre Gennaio 2026")).toBe(true);
    expect(isNoiseTitle("Calendario eventi e sagre in Veneto")).toBe(true);
  });

  it("accepts legitimate sagra titles", () => {
    expect(isNoiseTitle("Sagra del Baccala alla Vicentina")).toBe(false);
    expect(isNoiseTitle("Festa della Polenta")).toBe(false);
  });
});

describe("isCalendarDateRange", () => {
  it("rejects full month range", () => {
    expect(isCalendarDateRange("2026-01-01", "2026-01-31")).toBe(true);
    expect(isCalendarDateRange("2026-02-01", "2026-02-28")).toBe(true);
  });

  it("accepts normal sagra ranges", () => {
    expect(isCalendarDateRange("2026-04-24", "2026-04-26")).toBe(false);
    expect(isCalendarDateRange("2026-06-01", "2026-06-03")).toBe(false);
  });

  it("handles null dates", () => {
    expect(isCalendarDateRange(null, null)).toBe(false);
    expect(isCalendarDateRange("2026-01-01", null)).toBe(false);
  });
});

describe("isExcessiveDuration", () => {
  it("rejects events longer than 7 days", () => {
    expect(isExcessiveDuration("2026-01-01", "2026-01-15")).toBe(true);
  });

  it("accepts events up to 7 days", () => {
    expect(isExcessiveDuration("2026-04-24", "2026-04-26")).toBe(false);
    expect(isExcessiveDuration("2026-04-24", "2026-05-01")).toBe(false); // exactly 7
  });
});

describe("isPastYearEvent", () => {
  it("rejects 2025 events", () => {
    expect(isPastYearEvent("2025-08-15", "2025-08-17")).toBe(true);
  });

  it("accepts 2026 events", () => {
    expect(isPastYearEvent("2026-04-24", "2026-04-26")).toBe(false);
  });
});
```

### Integration Point in scrape-sagre/index.ts

```typescript
// Line ~527 in scrapeSource(), after normalization, before upsert:

const normalized = normalizeRawEvent(raw, source.name);

// Date quality gates (NEW)
if (isCalendarDateRange(normalized.startDate, normalized.endDate)) continue;
if (isExcessiveDuration(normalized.startDate, normalized.endDate, 7)) continue;
if (isPastYearEvent(normalized.startDate, normalized.endDate)) continue;

const result = await upsertEvent(supabase, normalized, source.name);
```

### Cron Job Update SQL

```sql
-- Must unschedule first, then reschedule with new SQL
SELECT cron.unschedule('expire-sagre-daily');

SELECT cron.schedule(
  'expire-sagre-daily',
  '0 1 * * *',
  $$
  UPDATE public.sagre
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
    AND (
      (end_date IS NOT NULL AND end_date < CURRENT_DATE)
      OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE)
      OR (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
    );
  $$
);
```

## State of the Art

| Old Approach (v1.1) | Current Approach (v1.3) | When Changed | Impact |
|---------------------|------------------------|--------------|--------|
| Basic noise regex (6 patterns) | Expanded noise regex (10+ patterns) | Phase 14 | Catches "Calendario mensile eventi sagre..." spam |
| No date range validation | Calendar range + duration checks | Phase 14 | Eliminates month-long fake events |
| Expire cron: end_date only | Expire cron: end_date + start_date + year check | Phase 14 | Catches 2025 events and single-day past events |
| Retroactive SQL cleanup (v1.1 style) | Same pattern, expanded rules | Phase 14 | Cleans existing production data matching new filters |

**What has NOT changed:**
- Date parser (`date-parser.ts`) -- works correctly, not the problem
- Normalize functions (`normalize.ts`) -- stable, no changes needed
- Upsert logic (`upsertEvent`) -- no changes needed
- Edge Function architecture (inline copies) -- known tech debt, NOT addressed this phase

## Open Questions

1. **Exact spam title patterns in production**
   - What we know: User reported "Calendario mensile eventi sagre..." as a specific example
   - What's unclear: The full set of garbage titles currently in production data
   - Recommendation: Before writing final regex patterns, run `SELECT title FROM sagre WHERE is_active = true ORDER BY title` via Supabase SQL Editor to identify ALL noise patterns. This can be done as part of Plan 14-01 implementation.

2. **Events with NULL dates: keep or reject?**
   - What we know: Some events have NULL start_date (unparseable date text). They bypass all date filters.
   - What's unclear: How many NULL-date events exist and whether they represent real sagre
   - Recommendation: Keep them for now (they pass through to enrichment and display). If they are problematic, a separate filter for "NULL dates = likely garbage" can be added later. This is a conservative approach -- better to show a real sagra with no date than to hide it.

3. **Edge Function deployment method**
   - What we know: PROJECT.md says "Deploy to Supabase Dashboard"
   - What's unclear: Whether the team uses CLI (`npx supabase functions deploy`) or Dashboard copy-paste
   - Recommendation: Plan should include explicit deployment step. The `.env` file has `SUPABASE_ACCESS_TOKEN` for CLI auth, and `supabase link` is configured, so CLI deployment is available.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/lib/scraper/__tests__/filters.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DQ-01 | Expanded noise title patterns reject garbage titles | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isNoiseTitle"` | No -- Wave 0 |
| DQ-02 | Calendar date ranges (1st to 28th+) rejected | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isCalendarDateRange"` | No -- Wave 0 |
| DQ-03 | Events with duration >7 days rejected | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isExcessiveDuration"` | No -- Wave 0 |
| DQ-04 | Events from 2025 and earlier rejected | unit | `npx vitest run src/lib/scraper/__tests__/filters.test.ts -t "isPastYearEvent"` | No -- Wave 0 |
| DQ-05 | Retroactive cleanup SQL deactivates dirty data | manual-only | Run SQL in Supabase SQL Editor, verify with `SELECT count(*) FROM sagre WHERE is_active = true` | N/A -- SQL migration, not unit-testable |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/scraper/__tests__/filters.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual verification of production data counts

### Wave 0 Gaps

- [ ] `src/lib/scraper/filters.ts` -- new module with all filter functions
- [ ] `src/lib/scraper/__tests__/filters.test.ts` -- covers DQ-01 through DQ-04
- No framework install needed (Vitest already configured and working)

## Sources

### Primary (HIGH confidence)

- **Direct codebase analysis** -- read all relevant source files:
  - `supabase/functions/scrape-sagre/index.ts` -- current noise filter at line 172, scraping loop at line 524
  - `supabase/functions/enrich-sagre/index.ts` -- enrichment pipeline (not modified this phase)
  - `src/lib/scraper/normalize.ts` -- normalization functions (not modified this phase)
  - `src/lib/scraper/date-parser.ts` -- date parsing (not modified this phase)
  - `supabase/migrations/002_scraping_pipeline.sql` -- pg_cron expire job (section 9, line 177)
  - `supabase/migrations/005_data_quality.sql` -- existing retroactive cleanup pattern
  - `src/lib/queries/sagre.ts` -- all queries filter by `is_active = true`
  - `src/types/database.ts` -- Sagra type definition (start_date, end_date are string | null)

### Secondary (MEDIUM confidence)

- **PROJECT.md Key Decisions table** -- confirms "Noise title heuristic filter" pattern, "Inline pure function copy for Deno Edge Functions" tech debt
- **MEMORY.md user-reported problems** -- specific examples of garbage data (7 categories listed)
- **REQUIREMENTS.md** -- exact wording of DQ-01 through DQ-05

### Tertiary (LOW confidence)

- None. All research is based on direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all changes to existing files
- Architecture: HIGH -- follows established patterns (pure functions + inline copy + SQL migration)
- Pitfalls: HIGH -- identified from direct code analysis of existing edge cases (NULL dates, cron update, timezone)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- deterministic logic, no external dependencies to go stale)
