-- =============================================================================
-- 049_caorle_cron_source.sql — pg_cron job for scrape-caorle
-- Scrapes caorle.eu official tourism site for sagre and food festivals.
-- Covers: Caorle (VE) — Festa del Pesce, Sagra di Sansonessa, etc.
-- Runs 1x/day (07:00 UTC). Few pages = fast scrape (~15-30s).
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-caorle: 1x/day (07:00 UTC) ---
SELECT cron.schedule(
  'scrape-caorle-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-caorle',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-caorle%';
-- Expected:
--   scrape-caorle-daily  0 7 * * *   true
