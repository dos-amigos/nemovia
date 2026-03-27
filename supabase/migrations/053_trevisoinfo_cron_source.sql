-- =============================================================================
-- 053_trevisoinfo_cron_source.sql — pg_cron job for scrape-trevisoinfo
-- Scrapes trevisoinfo.it static HTML listing of feste/sagre in Treviso province.
-- Covers: all Treviso province towns.
-- Runs 1x/day (07:00 UTC). Static page = few updates per run.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-trevisoinfo: 1x/day (07:00 UTC) ---
SELECT cron.schedule(
  'scrape-trevisoinfo-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-trevisoinfo',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-trevisoinfo%';
-- Expected:
--   scrape-trevisoinfo-daily  0 7 * * *   true
