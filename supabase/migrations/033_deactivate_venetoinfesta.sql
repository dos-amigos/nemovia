-- Deactivate venetoinfesta source: site redesigned, selectors broken, only 2 events returned.
-- The auto-disable mechanism (3 consecutive failures) may have already disabled it,
-- but this migration makes it explicit and permanent.
UPDATE scraper_sources
SET is_active = false,
    consecutive_failures = 99
WHERE name = 'venetoinfesta';
