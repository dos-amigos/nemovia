-- =============================================================================
-- 018_custom_scraper_cron_jobs.sql — Dedicated cron jobs for custom scrapers
-- Moves sagretoday, trovasagre, sagriamo from the main scrape-sagre function
-- to individual edge functions with their own schedules.
--
-- sagretoday: runs every 30 minutes (chunked by province, 1 province per run)
-- trovasagre: runs 2x/day (single API call, fast)
-- sagriamo: runs 2x/day (paginated API, fast)
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-sagretoday: every 30 minutes ---
-- Each invocation scrapes 1 province (all 5 pages), rotating through 7 provinces.
-- Full cycle = 7 provinces * 30 min = 3.5 hours.
SELECT cron.schedule(
  'scrape-sagretoday',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-sagretoday',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- --- scrape-trovasagre: 2x/day (morning + evening) ---
-- Single JSON API call, typically completes in ~5 seconds.
SELECT cron.schedule(
  'scrape-trovasagre-morning',
  '15 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-trovasagre',
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
  'scrape-trovasagre-evening',
  '15 19 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-trovasagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- --- scrape-sagriamo: 2x/day (morning + evening) ---
-- Paginated JSON API, typically completes in ~10-15 seconds.
SELECT cron.schedule(
  'scrape-sagriamo-morning',
  '20 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-sagriamo',
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
  'scrape-sagriamo-evening',
  '20 19 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-sagriamo',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-%';
-- Expected new rows:
--   scrape-sagretoday          */30 * * * *   true
--   scrape-trovasagre-morning  15 7 * * *     true
--   scrape-trovasagre-evening  15 19 * * *    true
--   scrape-sagriamo-morning    20 7 * * *     true
--   scrape-sagriamo-evening    20 19 * * *    true
