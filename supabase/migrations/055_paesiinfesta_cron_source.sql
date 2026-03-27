-- =============================================================================
-- 055_paesiinfesta_cron_source.sql — pg_cron job for scrape-paesiinfesta
-- Scrapes paesiinfesta.com WordPress site for sagre in Veneto orientale (VE/TV).
-- Uses WP REST API with HTML fallback.
-- Covers: VE/TV border area (San Donà, Portogruaro, Jesolo, Oderzo, etc.)
-- Runs 1x/day (07:30 UTC). WordPress = moderate updates.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-paesiinfesta: 1x/day (07:30 UTC) ---
SELECT cron.schedule(
  'scrape-paesiinfesta-daily',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-paesiinfesta',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-paesiinfesta%';
-- Expected:
--   scrape-paesiinfesta-daily  30 7 * * *   true
