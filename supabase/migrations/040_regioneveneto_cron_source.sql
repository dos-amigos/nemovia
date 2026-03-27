-- =============================================================================
-- 040_regioneveneto_cron_source.sql — pg_cron job for scrape-regioneveneto
-- Parses the official Regione Veneto XLSX with ALL registered sagre (~1,123).
-- Runs 1x/week (Monday morning) — data changes rarely.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-regioneveneto: 1x/week (Monday at 06:15 UTC) ---
SELECT cron.schedule(
  'scrape-regioneveneto-weekly',
  '15 6 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-regioneveneto',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-regioneveneto%';
-- Expected:
--   scrape-regioneveneto-weekly  15 6 * * 1  true
