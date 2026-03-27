-- =============================================================================
-- 044_invenicetoday_cron_source.sql — pg_cron job for scrape-invenicetoday
-- Scrapes invenicetoday.com single listing page for Venice food festivals.
-- Runs 1x/week (Wednesday morning). Single page = fast scrape (~5-10s).
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-invenicetoday: 1x/week (Wednesday 06:30 UTC) ---
SELECT cron.schedule(
  'scrape-invenicetoday-weekly',
  '30 6 * * 3',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-invenicetoday',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-invenicetoday%';
-- Expected:
--   scrape-invenicetoday-weekly  30 6 * * 3   true
