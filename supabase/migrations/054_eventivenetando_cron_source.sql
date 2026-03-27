-- =============================================================================
-- 054_eventivenetando_cron_source.sql — pg_cron job for scrape-eventivenetando
-- Scrapes eventivenetando.it HTML listing for feste/sagre in Marca Trevigiana.
-- Covers: northern Treviso province (Marca Trevigiana area).
-- Runs 1x/day (07:15 UTC). HTML listing = moderate updates.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-eventivenetando: 1x/day (07:15 UTC) ---
SELECT cron.schedule(
  'scrape-eventivenetando-daily',
  '15 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-eventivenetando',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-eventivenetando%';
-- Expected:
--   scrape-eventivenetando-daily  15 7 * * *   true
