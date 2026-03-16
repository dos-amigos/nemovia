-- =============================================================================
-- Migration 019: Fix expire-sagre-daily — grace period for sagre without end_date
-- Problem: sagre with null end_date were being expired the day after start_date,
-- killing multi-day sagre whose scrapers didn't extract an end date.
-- Fix: give 14 days of grace when end_date is null (start_date + 14 < today).
-- Also reactivate sagre that were wrongly expired by the old logic.
-- =============================================================================

-- Step 1: Reactivate sagre wrongly expired (null end_date, started within last 14 days)
UPDATE public.sagre
SET is_active = true, updated_at = NOW()
WHERE is_active = false
  AND end_date IS NULL
  AND start_date IS NOT NULL
  AND start_date >= CURRENT_DATE - INTERVAL '14 days'
  AND status NOT IN ('classified_non_sagra', 'geocode_failed');

-- Step 2: Replace the expire cron job with grace-period logic
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
        -- Single-day or no-end-date events: expire 14 days after start_date
        OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE - INTERVAL '14 days')
        -- Historical events from previous years
        OR (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
      );
  $$
);
