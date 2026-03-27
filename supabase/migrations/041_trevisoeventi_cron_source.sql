-- =============================================================================
-- 041_trevisoeventi_cron_source.sql — pg_cron job for scrape-trevisoeventi
-- Scrapes trevisoeventi.com calendar page (static HTML, single page).
-- Province always TV. Runs 1x/day.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-trevisoeventi: 1x/day at 07:30 UTC ---
SELECT cron.schedule(
  'scrape-trevisoeventi-daily',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-trevisoeventi',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-trevisoeventi%';
-- Expected:
--   scrape-trevisoeventi-daily  30 7 * * *  true
