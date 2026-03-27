-- Migration 034: Fix itinerarinelgusto selectors after site redesign
-- The site still uses .row.tile.post.pad containers and Schema.org microdata,
-- but title moved from h2.events to p.events-list-title and city from
-- h3.event-header to p.event-header. Also increase max_pages to scrape
-- all 150 events (10 pages x 15 per page).
--
-- Selectors verified from live HTML on 2026-03-27.
-- IMPORTANT: Run this in Supabase SQL Editor.

UPDATE public.scraper_sources
SET
  selector_title = 'p.events-list-title a',
  selector_city = 'p.event-header a',
  selector_url = 'p.events-list-title a',
  max_pages = 10
WHERE name = 'itinerarinelgusto';

-- Verification query:
-- SELECT name, selector_item, selector_title, selector_city, selector_url, max_pages
-- FROM scraper_sources
-- WHERE name = 'itinerarinelgusto';
