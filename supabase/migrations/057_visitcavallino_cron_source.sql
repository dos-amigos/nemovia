-- =============================================================================
-- 057_visitcavallino_cron_source.sql — pg_cron job for scrape-visitcavallino
-- Scrapes visitcavallino.com for sagre/events in Cavallino-Treporti (VE province).
-- Tourism portal for the Cavallino-Treporti area near Venice.
-- Runs 1x/day (08:15 UTC). Tourism portal = moderate updates.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-visitcavallino: 1x/day (08:15 UTC) ---
SELECT cron.schedule(
  'scrape-visitcavallino-daily',
  '15 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-visitcavallino',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-visitcavallino%';
-- Expected:
--   scrape-visitcavallino-daily  15 8 * * *   true
