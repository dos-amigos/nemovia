-- =============================================================================
-- 056_eventideltapo_cron_source.sql — pg_cron job for scrape-eventideltapo
-- Scrapes eventideltapo.it for sagre in the Delta del Po area (RO province).
-- Covers: Adria, Ariano nel Polesine, Porto Tolle, Porto Viro, Rosolina, Taglio di Po.
-- Runs 1x/day (08:00 UTC). Small local portal = low update frequency.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-eventideltapo: 1x/day (08:00 UTC) ---
SELECT cron.schedule(
  'scrape-eventideltapo-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-eventideltapo',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-eventideltapo%';
-- Expected:
--   scrape-eventideltapo-daily  0 8 * * *   true
