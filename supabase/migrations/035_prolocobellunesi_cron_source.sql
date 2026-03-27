-- =============================================================================
-- 035_prolocobellunesi_cron_source.sql — Source + pg_cron for scrape-prolocobellunesi
-- Scrapes prolocobellunesi.it via WordPress Events Calendar REST API.
-- Province always BL (Belluno). Runs 2x/day.
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
  'prolocobellunesi', 'Pro Loco Bellunesi',
  'https://prolocobellunesi.it/wp-json/tribe/events/v1/events',
  'json',  -- REST API, no CSS selectors
  'json',
  'json',
  'json',
  'json',
  'json',
  'json',
  'json',
  '?per_page=50&page={n}&start_date=now',
  5
)
ON CONFLICT (name) DO NOTHING;

-- --- scrape-prolocobellunesi: 2x/day (morning + evening) ---
SELECT cron.schedule(
  'scrape-prolocobellunesi-morning',
  '45 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-prolocobellunesi',
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
  'scrape-prolocobellunesi-evening',
  '45 19 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-prolocobellunesi',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-prolocobellunesi%';
-- Expected:
--   scrape-prolocobellunesi-morning  45 7 * * *   true
--   scrape-prolocobellunesi-evening  45 19 * * *  true
