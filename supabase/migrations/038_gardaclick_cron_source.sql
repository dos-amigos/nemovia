-- =============================================================================
-- 038_gardaclick_cron_source.sql — pg_cron job for scrape-gardaclick Edge Function
-- Scrapes gardaclick.com events calendar for Lake Garda area (VR province).
-- Single static HTML page with event table — lightweight scraping.
-- Runs 1x/day (morning). Content updates infrequently.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- Insert scraper source ---
INSERT INTO public.scraper_sources (
  name, display_name, base_url,
  selector_item, selector_title, selector_start_date, selector_end_date,
  selector_city, selector_price, selector_url, selector_image,
  url_pattern, max_pages
) VALUES (
  'gardaclick', 'GardaClick.com',
  'https://www.gardaclick.com/eventi-fiere-mercati-lago-di-garda',
  'table.table tbody tr', 'td:nth-child(3) a', 'td:nth-child(1)', 'td:nth-child(1)',
  'td:nth-child(2)', NULL, 'td:nth-child(3) a', NULL,
  NULL,
  1
)
ON CONFLICT (name) DO NOTHING;

-- --- scrape-gardaclick: 1x/day (morning) ---
SELECT cron.schedule(
  'scrape-gardaclick-morning',
  '35 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-gardaclick',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-gardaclick%';
-- Expected:
--   scrape-gardaclick-morning  35 7 * * *   true
