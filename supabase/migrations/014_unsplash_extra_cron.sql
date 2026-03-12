-- =============================================================================
-- 014_unsplash_extra_cron.sql — Additional enrichment cron runs for image backlog
-- Adds midday and midnight enrichment runs (4x/day total instead of 2x/day)
-- to clear the Unsplash image backlog faster.
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- Midday enrichment (12:30)
SELECT cron.schedule(
  'enrich-sagre-midday',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/enrich-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Midnight enrichment (00:30)
SELECT cron.schedule(
  'enrich-sagre-midnight',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/enrich-sagre',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'enrich-%';
-- Expected: 4 rows — enrich-sagre-morning (06:30), enrich-sagre-midday (12:30),
--                     enrich-sagre-evening (18:30), enrich-sagre-midnight (00:30)
