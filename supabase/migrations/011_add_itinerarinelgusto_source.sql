-- Migration 011: Add itinerarinelgusto.it as a new scraper source
-- Phase 18 Plan 03: New scraper source investigation
--
-- itinerarinelgusto.it serves ~150 Veneto sagre in server-rendered HTML
-- with Schema.org microdata. Selectors verified from live HTML analysis.
--
-- IMPORTANT: Run this in Supabase SQL Editor (established project pattern)

-- Section 1: Add new scraper source
INSERT INTO public.scraper_sources (
  name, display_name, base_url,
  selector_item, selector_title, selector_start_date, selector_end_date,
  selector_city, selector_url, selector_image, selector_price,
  url_pattern, next_page_selector, max_pages, is_active
) VALUES (
  'itinerarinelgusto',
  'Itinerari nel Gusto',
  'https://www.itinerarinelgusto.it/sagre-e-feste/veneto',
  '.row.tile.post.pad',              -- event card container (Schema.org Event)
  'h2.events a',                     -- title with link
  'meta[itemprop="startDate"]',      -- ISO datetime in content attr
  'meta[itemprop="endDate"]',        -- ISO datetime in content attr
  'h3.event-header a',               -- city name (may include "Provincia di" prefix)
  'h2.events a',                     -- event detail URL (same as title link)
  'meta[itemprop="image"]',          -- full-size CDN image URL in content attr
  NULL,                              -- no price info available
  '?sagre-e-feste_pg_from={n}',     -- offset-based: buildPageUrl calculates (page-1)*15
  NULL,                              -- no next-page selector needed (offset calc handles it)
  3,                                 -- conservative: 3 pages x 15 events = 45 events
  true                               -- active from start
)
ON CONFLICT (name) DO NOTHING;       -- safe to re-run

-- Section 2: Verification query (run after INSERT)
-- SELECT name, display_name, base_url, max_pages, is_active
-- FROM scraper_sources
-- WHERE name = 'itinerarinelgusto';
