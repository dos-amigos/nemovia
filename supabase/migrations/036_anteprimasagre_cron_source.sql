-- =============================================================================
-- 036_anteprimasagre_cron_source.sql — pg_cron job for scrape-anteprimasagre
-- Scrapes anteprimasagre.it (WordPress REST API) for Veneto sagre.
-- Covers primarily Treviso (194 posts), Venezia (103), Padova (4), Vicenza (1).
-- Runs 2x/day (morning + evening).
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
  'anteprimasagre', 'Anteprima Sagre',
  'https://www.anteprimasagre.it',
  'article', 'h2.entry-title a', 'time.entry-date', 'time.entry-date',
  '.entry-content', '.entry-content', 'h2.entry-title a', '.post-thumbnail img',
  '/le-sagre-in-provincia-di-treviso/page/{n}/',
  5
)
ON CONFLICT (name) DO NOTHING;

-- --- scrape-anteprimasagre: 2x/day (morning + evening) ---
SELECT cron.schedule(
  'scrape-anteprimasagre-morning',
  '45 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-anteprimasagre',
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
  'scrape-anteprimasagre-evening',
  '45 18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-anteprimasagre',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-anteprimasagre%';
-- Expected:
--   scrape-anteprimasagre-morning  45 6 * * *   true
--   scrape-anteprimasagre-evening  45 18 * * *  true
