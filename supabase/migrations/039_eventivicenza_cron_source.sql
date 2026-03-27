-- =============================================================================
-- 039_eventivicenza_cron_source.sql — pg_cron job for scrape-eventivicenza
-- Scrapes eventi.comune.vicenza.it OpenData API for food/sagra events.
-- Province always VI. Uses JSON REST API (no HTML scraping).
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
  'eventivicenza', 'Eventi Comune Vicenza',
  'https://eventi.comune.vicenza.it',
  'searchHits[]', 'data.ita-IT.event_title', 'data.ita-IT.time_interval.input.startDateTime', 'data.ita-IT.time_interval.input.endDateTime',
  'data.ita-IT.takes_place_in[0].name.ita-IT', 'data.ita-IT.cost_notes', 'extradata.ita-IT.urlAlias', 'data.ita-IT.image[0].link',
  'opendata/api/content/search?q=classes+[event]+sort+[time_interval=>desc]+offset+{n}',
  10
)
ON CONFLICT (name) DO NOTHING;

-- --- scrape-eventivicenza: 2x/day (morning + evening) ---
SELECT cron.schedule(
  'scrape-eventivicenza-morning',
  '35 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-eventivicenza',
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
  'scrape-eventivicenza-evening',
  '35 19 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-eventivicenza',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-eventivicenza%';
-- Expected:
--   scrape-eventivicenza-morning  35 7 * * *   true
--   scrape-eventivicenza-evening  35 19 * * *  true
