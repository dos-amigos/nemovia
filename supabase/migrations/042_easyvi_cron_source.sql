-- =============================================================================
-- 042_easyvi_cron_source.sql — pg_cron job for scrape-easyvi
-- Scrapes easyvi.it AJAX endpoint for Vicenza province events (sagre/feste).
-- Runs 1x/day at 07:30 UTC.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-easyvi: 1x/day at 07:30 UTC ---
SELECT cron.schedule(
  'scrape-easyvi-daily',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-easyvi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Verification query (run after applying migration):
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-easyvi%';
-- Expected:
--   scrape-easyvi-daily  30 7 * * *  true
