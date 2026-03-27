-- =============================================================================
-- 058_cittadiverona_cron_source.sql — pg_cron job for scrape-cittadiverona
-- Scrapes cittadiverona.it (WordPress) for sagre in Verona area (VR province).
-- Tries WP REST API (/wp-json/wp/v2/lsvr_event/) first, falls back to HTML scraping.
-- Runs 1x/day (08:30 UTC). WordPress site = moderate updates.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-cittadiverona: 1x/day (08:30 UTC) ---
SELECT cron.schedule(
  'scrape-cittadiverona-daily',
  '30 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-cittadiverona',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-cittadiverona%';
-- Expected:
--   scrape-cittadiverona-daily  30 8 * * *   true
