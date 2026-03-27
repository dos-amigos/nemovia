-- =============================================================================
-- 047_visitchioggia_cron_source.sql — pg_cron job for scrape-visitchioggia
-- Scrapes visitchioggia.com /it/eventi/feste-e-sagre/ (official Chioggia tourism).
-- Runs 1x/day (morning). Small site (~3 events), single daily run is sufficient.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-visitchioggia: 1x/day ---
SELECT cron.schedule(
  'scrape-visitchioggia-daily',
  '20 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-visitchioggia',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-visitchioggia%';
-- Expected:
--   scrape-visitchioggia-daily  20 8 * * *  true
