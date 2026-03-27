-- =============================================================================
-- 052_primarovigo_cron_source.sql — pg_cron job for scrape-primarovigo
-- Scrapes primarovigo.it local news portal for sagre in Rovigo province.
-- Covers: all Rovigo province towns (Adria, Loreo, Porto Viro, etc.)
-- Runs 1x/day (06:30 UTC). News portal = few sagra articles per run.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-primarovigo: 1x/day (06:30 UTC) ---
SELECT cron.schedule(
  'scrape-primarovigo-daily',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-primarovigo',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-primarovigo%';
-- Expected:
--   scrape-primarovigo-daily  30 6 * * *   true
