-- =============================================================================
-- 043_4jesoloevents_cron_source.sql — pg_cron job for scrape-4jesoloevents
-- Scrapes 4jesoloevents.it (Jesolo/Venezia province events).
-- Runs 1x/day (morning). Homepage listing + detail pages, ~40+ events.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-4jesoloevents: 1x/day (morning) ---
SELECT cron.schedule(
  'scrape-4jesoloevents-daily',
  '45 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-4jesoloevents',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-4jesoloevents%';
-- Expected:
--   scrape-4jesoloevents-daily  45 8 * * *   true
