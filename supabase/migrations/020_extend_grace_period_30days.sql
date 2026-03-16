-- =============================================================================
-- Migration 020: Extend grace period from 14 to 30 days
-- Problem: sagre with null end_date were expiring too early (14 days),
-- causing many multi-day/multi-week sagre to disappear from the homepage.
-- Fix: extend grace period to 30 days + re-activate wrongly expired sagre.
-- =============================================================================

-- Step 1: Reactivate sagre wrongly expired (null end_date, started within last 30 days)
UPDATE public.sagre
SET is_active = true, updated_at = NOW()
WHERE is_active = false
  AND end_date IS NULL
  AND start_date IS NOT NULL
  AND start_date >= CURRENT_DATE - INTERVAL '30 days'
  AND status NOT IN ('classified_non_sagra', 'geocode_failed');

-- Step 2: Also reactivate sagre wrongly deactivated by heuristic filters
-- (migration 008 deactivated fiera/mercato/rassegna, migration 009 only re-enabled future ones)
UPDATE public.sagre
SET is_active = true, updated_at = NOW()
WHERE is_active = false
  AND province IS NOT NULL
  AND (
    end_date >= CURRENT_DATE
    OR (end_date IS NULL AND start_date >= CURRENT_DATE - INTERVAL '30 days')
  )
  AND (
    lower(title) ~ '\y(sagra|sagre|festa|feste|gastronomic)\y'
    OR lower(title) ~ '(degustazion|polenta|baccal|pesce|gnocch|risott|formagg|vino|birra|zucca|radicchio|bisi|asparag)'
  )
  AND status NOT IN ('classified_non_sagra', 'geocode_failed');

-- Step 3: Replace the expire cron job with 30-day grace period
SELECT cron.unschedule('expire-sagre-daily');

SELECT cron.schedule(
  'expire-sagre-daily',
  '0 1 * * *',
  $$
    UPDATE public.sagre
    SET is_active = false, updated_at = NOW()
    WHERE is_active = true
      AND (
        -- Multi-day events with explicit end_date in the past
        (end_date IS NOT NULL AND end_date < CURRENT_DATE)
        -- Single-day or no-end-date events: expire 30 days after start_date
        OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE - INTERVAL '30 days')
        -- Historical events from previous years
        OR (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
      );
  $$
);
