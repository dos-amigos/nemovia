-- =============================================================================
-- 048_visitfeltre_cron_source.sql — pg_cron job for scrape-visitfeltre Edge Function
-- Scrapes visitfeltre.info WordPress REST API (custom "evento" post type,
-- category "manifestazioni" ID 39). Province always BL.
-- Runs 1x/day at 06:15 UTC.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-visitfeltre: 1x/day ---
SELECT cron.schedule(
  'scrape-visitfeltre-daily',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-visitfeltre',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-visitfeltre%';
-- Expected:
--   scrape-visitfeltre-daily  15 6 * * *   true
