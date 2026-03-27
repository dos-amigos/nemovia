-- =============================================================================
-- 032_insagra_cron_job.sql — pg_cron job for scrape-insagra Edge Function
-- Scrapes insagra.it Veneto listing pages (paginated) + detail pages with JSON-LD.
-- Runs 2x/day (morning + evening). Detail page scraping takes ~60-90s typically.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-insagra: 2x/day (morning + evening) ---
SELECT cron.schedule(
  'scrape-insagra-morning',
  '35 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-insagra',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

SELECT cron.schedule(
  'scrape-insagra-evening',
  '35 19 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-insagra',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-insagra%';
-- Expected:
--   scrape-insagra-morning  35 7 * * *   true
--   scrape-insagra-evening  35 19 * * *  true
