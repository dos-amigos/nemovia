-- =============================================================================
-- 006_heuristic_filters.sql -- Phase 14: Heuristic Data Quality Filters
-- Retroactive cleanup of existing dirty data + expire cron fix.
-- Run in Supabase SQL Editor (manual execution, one section at a time).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Section 1: Deactivate calendar-spam date ranges (DQ-02 retroactive)
-- Events with date ranges spanning a full month (day 1 to day 28+) are
-- calendar-page artifacts, not real sagre. Real sagre last 1-3 days.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL
  AND EXTRACT(DAY FROM start_date) = 1
  AND EXTRACT(DAY FROM end_date) >= 28;

-- -----------------------------------------------------------------------------
-- Section 2: Deactivate excessive duration events (DQ-03 retroactive)
-- Events lasting more than 7 days are not real sagre. Even the largest
-- sagre (e.g. Festa del Redentore) last at most a week.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL
  AND (end_date - start_date) > 7;

-- -----------------------------------------------------------------------------
-- Section 3: Deactivate events from 2025 and earlier (DQ-04 retroactive)
-- Past-year events should not appear in the app. The scraper may have
-- picked up historical listings from source sites.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < 2026)
    OR (end_date IS NOT NULL AND EXTRACT(YEAR FROM end_date) < 2026)
  );

-- -----------------------------------------------------------------------------
-- Section 4: Enhanced noise title cleanup (DQ-01 retroactive, new patterns only)
-- Only the NEW patterns added in Phase 14 that were not already covered
-- by 005_data_quality.sql. Uses \y for word boundary (PostgreSQL POSIX regex).
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    lower(title) ~ 'calendario\y.*\y(eventi|sagre|feste)'
    OR lower(title) ~ 'programma\s+(completo|mensile|settimanale)'
    OR lower(title) ~ 'scopri\s+tutt[ei]|vedi\s+tutt[ei]'
    OR lower(title) ~ 'newsletter|iscriviti|registrati'
  );

-- -----------------------------------------------------------------------------
-- Section 5: Update expire cron job (DQ-04 ongoing)
-- The original cron only checked: end_date < CURRENT_DATE
-- This misses: (a) events with null end_date, (b) events from previous years.
-- Must unschedule BEFORE rescheduling (pg_cron has no UPDATE semantics).
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Verification queries (run after cleanup):
-- SELECT count(*) FROM sagre WHERE is_active = true;
-- SELECT count(*) FROM sagre WHERE is_active = false AND updated_at > NOW() - INTERVAL '5 minutes';
-- SELECT title, start_date, end_date FROM sagre WHERE is_active = false AND updated_at > NOW() - INTERVAL '5 minutes' LIMIT 30;
-- -----------------------------------------------------------------------------
