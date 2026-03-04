---
phase: 02-scraping-pipeline
verified: 2026-03-04T22:48:00Z
status: human_needed
score: 9/10 must-haves verified
human_verification:
  - test: "Confirm scraper_sources has 5 rows in Supabase"
    expected: "SELECT count(*) FROM scraper_sources returns 5 with names: solosagre, eventiesagre, sagritaly, assosagre, venetoinfesta"
    why_human: "No direct DB access from CLI; migration applied in Supabase SQL Editor. SUMMARY reports user confirmed ('tutto corretto') but this is the primary success criterion for PIPE-01 and PIPE-02 and must be independently re-confirmed."
  - test: "Confirm 3 pg_cron jobs are active in Supabase"
    expected: "SELECT jobname, schedule, active FROM cron.job returns 3 rows: expire-sagre-daily (0 1 * * *), scrape-sagre-morning (0 6 * * *), scrape-sagre-evening (0 18 * * *) — all active=true"
    why_human: "pg_cron state is not verifiable from the file system. SUMMARY reports user confirmed but this must be re-checked to close PIPE-06."
  - test: "Confirm sagre table has the new columns added by the migration"
    expected: "SELECT sources, is_active, normalized_title FROM sagre LIMIT 1 returns no error"
    why_human: "Column additions are DB state. SUMMARY reports user confirmed but necessary for PIPE-05 to function."
  - test: "Confirm Edge Function deployed and reachable at Supabase Edge Functions"
    expected: "Invoking scrape-sagre via Supabase Dashboard returns HTTP 200 with body {\"status\":\"started\",\"timestamp\":\"...\"} within 1-2 seconds"
    why_human: "Deployment is a manual Supabase Dashboard action. SUMMARY reports user confirmed ('ok tutto corretto') but live invocability is a runtime truth not verifiable from git."
  - test: "Confirm at least 1 source produced scrape_logs status=success with events inserted into sagre"
    expected: "SELECT source_name, status, events_inserted FROM scrape_logs ORDER BY started_at DESC shows at least one row with status='success' and events_inserted > 0"
    why_human: "Runtime result of actual scraping run. CSS selectors are noted as 'starting templates' — at least 1 source succeeding is required for PIPE-01."
---

# Phase 2: Scraping Pipeline Verification Report

**Phase Goal:** Automated data collection that scrapes sagre from 5+ Veneto sources twice daily, deduplicates entries, and expires past events
**Verified:** 2026-03-04T22:48:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Running the scraper populates the database with sagre from at least 5 distinct sources | ? HUMAN | Edge Function file verified substantive; DB state requires human confirmation |
| 2  | Adding a new source requires only a database config entry, not code changes | VERIFIED | scraper_sources schema + Edge Function reads from DB: `supabase.from("scraper_sources").select("*").eq("is_active", true)` — all scraping logic is selector-driven |
| 3  | Duplicate sagre from different sources are merged into a single record | VERIFIED | `upsertEvent()` calls `find_duplicate_sagra` RPC; on match appends sourceName to `sources` array rather than inserting; `find_duplicate_sagra()` SQL function uses normalized_title + city + date overlap |
| 4  | Past events are automatically marked inactive and excluded from queries | VERIFIED | SQL in migration: `UPDATE public.sagre SET is_active = false, updated_at = NOW() WHERE end_date < CURRENT_DATE AND is_active = true` wired to `expire-sagre-daily` pg_cron job; DB state confirmed by human per SUMMARY |
| 5  | Scraping runs automatically on schedule via pg_cron + Supabase Edge Functions | ? HUMAN | `cron.schedule()` statements exist in migration SQL for both 06:00 and 18:00 UTC; actual DB cron.job state requires human confirmation |

**Score:** 3/5 truths fully verified by code analysis + 2 flagged for human confirmation (runtime/DB state)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vitest.config.ts` | Vitest config, node env, src/**/*.test.ts | VERIFIED | Exists, node environment, reporters: ["verbose"], correct include pattern |
| `src/lib/scraper/types.ts` | ScraperSource, RawEvent, NormalizedEvent, ScrapeSummary exports | VERIFIED | All 4 interfaces exported; 58 lines substantive |
| `src/lib/scraper/normalize.ts` | normalizeText, generateSlug, generateContentHash | VERIFIED | All 3 functions exported; accent map + djb2 hash; mirrors SQL normalize_text() |
| `src/lib/scraper/date-parser.ts` | parseItalianDateRange | VERIFIED | Exported; handles DD/MM/YYYY, DD MonthName YYYY, multi-day, null cases |
| `src/lib/scraper/__tests__/normalize.test.ts` | Unit tests for normalize helpers | VERIFIED | 9 tests; all pass (18/18 total suite passing) |
| `src/lib/scraper/__tests__/date-parser.test.ts` | Unit tests for Italian date parsing | VERIFIED | 9 tests; all pass |
| `supabase/migrations/002_scraping_pipeline.sql` | Full DDL for Phase 2 DB objects | VERIFIED | 313 lines; all 10 sections present: CREATE TABLE scraper_sources, CREATE TABLE scrape_logs, normalize_text(), update_normalized_title trigger, find_duplicate_sagra(), ALTER sagre, RLS policy, 3 cron.schedule() calls, 5-row seed INSERT |
| `supabase/functions/scrape-sagre/index.ts` | Orchestrator Edge Function | VERIFIED | 422 lines; all required sections present and wired (see Key Links) |
| `supabase/functions/scrape-sagre/deno.json` | Deno config | VERIFIED | Exists with empty imports map (npm: specifiers inline) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scrape-sagre/index.ts` | `public.scraper_sources` (DB) | `supabase.from("scraper_sources").select("*").eq("is_active", true)` | WIRED | Line 393-397 in `runPipeline()` |
| `scrape-sagre/index.ts` | `public.find_duplicate_sagra` (RPC) | `supabase.rpc("find_duplicate_sagra", {...})` | WIRED | Line 234-239 in `upsertEvent()` |
| `scrape-sagre/index.ts` | `public.sagre` (INSERT) | `supabase.from("sagre").insert({...})` | WIRED | Lines 259-273 and 278-292 in `upsertEvent()` |
| `scrape-sagre/index.ts` | `public.sagre` (UPDATE for merge) | `supabase.from("sagre").update({...}).eq("id", existing.id)` | WIRED | Lines 248-254 in `upsertEvent()` |
| `scrape-sagre/index.ts` | `public.scrape_logs` (INSERT) | `supabase.from("scrape_logs").insert({...})` | WIRED | Lines 308-318 in `logRun()` |
| `scrape-sagre/index.ts` | `public.scraper_sources` (UPDATE failures) | `supabase.from("scraper_sources").update({consecutive_failures, ...})` | WIRED | Lines 383-387 in `scrapeSource()` catch block |
| `normalize_text()` SQL | `normalizeText()` JS | Both: lowercase + strip non-alphanumeric + handle accents | WIRED | SQL: `lower(regexp_replace(extensions.unaccent(t), '[^a-z0-9\s]', '', 'g'))` mirrors JS accent map + `.replace(/[^a-z0-9\s]/g, "")` |
| `cron.schedule('expire-sagre-daily')` | `public.sagre.is_active` | Direct SQL UPDATE in pg_cron body | WIRED (code-level) | Migration SQL line 177-185; DB state confirmed by human per SUMMARY |
| `cron.schedule('scrape-sagre-morning/evening')` | `supabase/functions/scrape-sagre` | `net.http_post()` to `/functions/v1/scrape-sagre` via Vault secrets | WIRED (code-level) | Migration SQL lines 194-226; DB state of cron.job requires human confirmation |
| `Deno.serve` entry point | `EdgeRuntime.waitUntil()` | `EdgeRuntime.waitUntil(runPipeline(supabase))` | WIRED | Line 416 — returns 200 immediately while pipeline runs in background |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| PIPE-01 | 02-01, 02-03 | Sistema scrapa automaticamente sagre da almeno 5 siti | HUMAN | 5 source configs seeded in SQL; Edge Function file verified; actual scraping result requires DB confirmation |
| PIPE-02 | 02-01, 02-02, 02-03 | Scraper config-driven legge selettori CSS dal database per ogni fonte | VERIFIED | `scraper_sources` table drives all CSS selectors; `extractRawEvent()` uses `source.selector_*` fields throughout; no hard-coded selectors in Edge Function |
| PIPE-04 | 02-01, 02-02, 02-03 | Deduplicazione cross-fonte tramite normalizzazione nome+citta+date sovrapposte | VERIFIED | `find_duplicate_sagra()` SQL function uses normalized_title + lower(location_text) + daterange overlap; `upsertEvent()` correctly calls it and merges sources array |
| PIPE-05 | 02-02, 02-04 | Scadenza automatica eventi passati (is_active = false) | VERIFIED (code); HUMAN (runtime) | SQL UPDATE logic in pg_cron body is correct; DB cron state confirmed by human per SUMMARY |
| PIPE-06 | 02-02, 02-04 | Cron scheduling via Supabase pg_cron (scraping 2x/giorno, expire 1x/giorno) | VERIFIED (code); HUMAN (runtime) | All 3 `cron.schedule()` calls present in migration SQL; actual cron.job DB state confirmed by human per SUMMARY |

**Orphaned requirements (Phase 2 mapped, not in any plan):** None — REQUIREMENTS.md traceability table maps PIPE-01/02/04/05/06 to Phase 2 and all appear in at least one plan's `requirements` field.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/functions/scrape-sagre/index.ts` | 149, 152 | `return null` | Info | Legitimate: `fetchWithTimeout()` returns null on non-OK HTTP response and network abort — not a stub pattern |

No TODO, FIXME, XXX, HACK, PLACEHOLDER comments found in any phase 2 file. No empty implementations or stub handlers detected. The two `return null` occurrences are intentional error-path values in the HTTP fetch helper.

---

### Human Verification Required

#### 1. Database migration applied — 5 sources seeded

**Test:** Run `SELECT name, is_active FROM scraper_sources ORDER BY name;` in Supabase SQL Editor
**Expected:** 5 rows returned with names: assosagre, eventiesagre, sagritaly, solosagre, venetoinfesta — all is_active=true
**Why human:** DB state cannot be verified from the repository; SUMMARY reports user confirmed ("tutto corretto") during plan execution on 2026-03-04 but independent re-confirmation is required.

#### 2. sagre table has the 3 new columns

**Test:** Run `SELECT sources, is_active, normalized_title FROM sagre LIMIT 1;` in Supabase SQL Editor
**Expected:** Query executes without error; normalized_title column populated for existing rows (trigger fires on UPDATE)
**Why human:** Column additions are DB state not visible in files.

#### 3. 3 pg_cron jobs active

**Test:** Run `SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;` in Supabase SQL Editor
**Expected:** 3 rows — expire-sagre-daily (0 1 * * *), scrape-sagre-morning (0 6 * * *), scrape-sagre-evening (0 18 * * *) all with active=true
**Why human:** pg_cron state is a live DB record; SUMMARY reports confirmed but this underpins PIPE-06.

#### 4. Edge Function deployed and returns HTTP 200

**Test:** Invoke scrape-sagre via Supabase Dashboard -> Edge Functions -> Invoke with empty body `{}`
**Expected:** HTTP 200 within 1-2 seconds with body `{"status":"started","timestamp":"..."}`
**Why human:** Deployment is a Supabase Dashboard action; cannot be verified from git state.

#### 5. At least 1 source produces successful scrape results

**Test:** After invocation, wait ~60 seconds then run: `SELECT source_name, status, events_found, events_inserted FROM scrape_logs ORDER BY started_at DESC LIMIT 5;`
**Expected:** At least 1 row with status='success' and events_inserted > 0; check `SELECT count(*) FROM sagre WHERE sources IS NOT NULL;` returns > 0
**Why human:** Runtime result of actual scraping. CSS selectors in scraper_sources are documented as "starting templates" — at least one source must succeed to satisfy PIPE-01. If all sources return errors, selectors need updating via Supabase Table Editor (no code change needed per the config-driven design).

---

### Gaps Summary

No code-level gaps were found. All phase 2 artifacts exist, are substantive (not stubs), and are properly wired. The `return human_needed` status reflects that 2 of the 5 success criteria (PIPE-01: actual data in DB; PIPE-06: live pg_cron jobs) are runtime/DB truths that cannot be confirmed from the codebase alone.

The 5 human verification items above map directly to the ROADMAP.md success criteria. All code needed to satisfy them is correctly in place. The questions are whether the deployment steps were completed and have remained in the expected state since plan execution on 2026-03-04.

---

_Verified: 2026-03-04T22:48:00Z_
_Verifier: Claude (gsd-verifier)_
