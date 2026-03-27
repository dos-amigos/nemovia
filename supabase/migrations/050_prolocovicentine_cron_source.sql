-- =============================================================================
-- 050_prolocovicentine_cron_source.sql — pg_cron job for scrape-prolocovicentine
-- Scrapes prolocovicentine.it (UNPLI Vicenza) via WordPress REST API.
-- Runs 1x/day at 06:45 UTC. Province always VI.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-prolocovicentine: 1x/day ---
SELECT cron.schedule(
  'scrape-prolocovicentine-daily',
  '45 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-prolocovicentine',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-prolocovicentine%';
-- Expected:
--   scrape-prolocovicentine-daily  45 6 * * *   true
