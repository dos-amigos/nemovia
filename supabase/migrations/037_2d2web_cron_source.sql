-- =============================================================================
-- 037_2d2web_cron_source.sql — pg_cron job for scrape-2d2web Edge Function
-- Scrapes 2d2web.com for all 7 Veneto provinces (paginated listing pages).
-- Runs 2x/day (morning + evening). Static HTML, fast scraping.
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
  '2d2web', '2d2web.com',
  'https://www.2d2web.com/sagre-feste/',
  'div.evento', 'h3 a', 'span.date-from', 'span.date-to',
  'span.city', 'span.price', 'h3 a', 'img.evento-img',
  'padova?pg={n}',
  5
)
ON CONFLICT (name) DO NOTHING;

-- --- scrape-2d2web: 2x/day (morning + evening) ---
SELECT cron.schedule(
  'scrape-2d2web-morning',
  '25 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-2d2web',
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
  'scrape-2d2web-evening',
  '25 20 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-2d2web',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-2d2web%';
-- Expected:
--   scrape-2d2web-morning  25 8 * * *   true
--   scrape-2d2web-evening  25 20 * * *  true
