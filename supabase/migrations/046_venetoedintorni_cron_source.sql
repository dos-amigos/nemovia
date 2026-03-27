-- =============================================================================
-- 046_venetoedintorni_cron_source.sql — pg_cron job for scrape-venetoedintorni
-- Scrapes venetoedintorni.it sagre listing page (all Veneto, single page).
-- Runs 1x/day (morning). ~18 cards, detail fetch takes ~30-45s typically.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-venetoedintorni: 1x/day (morning) ---
SELECT cron.schedule(
  'scrape-venetoedintorni-daily',
  '20 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-venetoedintorni',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-venetoedintorni%';
-- Expected:
--   scrape-venetoedintorni-daily  20 8 * * *  true
