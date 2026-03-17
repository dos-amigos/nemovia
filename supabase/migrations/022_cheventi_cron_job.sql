-- =============================================================================
-- 022_cheventi_cron_job.sql — pg_cron job for scrape-cheventi Edge Function
-- Scrapes cheventi.it JSON-LD events for 7 Veneto provinces.
-- Runs 2x/day (morning + evening), typically completes in ~20-30 seconds.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-cheventi: 2x/day (morning + evening) ---
SELECT cron.schedule(
  'scrape-cheventi-morning',
  '25 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-cheventi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

SELECT cron.schedule(
  'scrape-cheventi-evening',
  '25 19 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-cheventi',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-cheventi%';
-- Expected:
--   scrape-cheventi-morning  25 7 * * *   true
--   scrape-cheventi-evening  25 19 * * *  true
