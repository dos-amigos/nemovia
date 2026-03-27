-- =============================================================================
-- 051_panesalamina_cron_source.sql — pg_cron job for scrape-panesalamina
-- Scrapes panesalamina.com (WordPress site) covering Verona south/west area.
-- Runs 1x/day at 08:15 UTC.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-panesalamina: 1x/day ---
SELECT cron.schedule(
  'scrape-panesalamina-daily',
  '15 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-panesalamina',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-panesalamina%';
-- Expected:
--   scrape-panesalamina-daily  15 8 * * *  true
