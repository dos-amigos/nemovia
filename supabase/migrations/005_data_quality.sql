-- =============================================================================
-- 005_data_quality.sql -- Phase 10: Data Quality Filters
-- Retroactive cleanup of existing dirty data in the sagre table.
-- Run in Supabase SQL Editor (manual execution via REST API).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Deactivate non-Veneto sagre
-- Sagre with a province value that is NOT a Veneto province.
-- Province values come from Nominatim geocoding (county/province/state_district).
-- We keep the data but mark is_active = false so they don't appear in the UI.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND province IS NOT NULL
  AND lower(trim(province)) NOT IN (
    'belluno', 'padova', 'rovigo', 'treviso', 'venezia', 'verona', 'vicenza',
    'provincia di belluno', 'provincia di padova', 'provincia di rovigo',
    'provincia di treviso', 'provincia di venezia', 'provincia di verona',
    'provincia di vicenza'
  );

-- -----------------------------------------------------------------------------
-- Step 2: Deactivate noise-title sagre
-- Titles that match known noise patterns (calendar pages, navigation text, etc.)
-- Same patterns as isNoiseTitle() in scrape-sagre Edge Function.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    -- Too short or too long
    length(title) < 5 OR length(title) > 150
    -- Calendar/navigation noise
    OR lower(title) ~ 'calendario\s.*(mensile|regioni|italian)'
    OR lower(title) ~ 'cookie|privacy\s*policy|termini\s*(e\s*)?condizion'
    OR lower(title) ~ 'cerca\s+sagr|ricerca\s+event'
    OR lower(title) ~ '^(menu|navigazione|home)\b'
    OR title ~ '^[-0-9\s/\.]+$'
    OR lower(title) ~ 'tutte le sagre|elenco sagre|lista sagre'
    OR (lower(title) ~ 'gennaio' AND lower(title) ~ 'dicembre')
  );

-- -----------------------------------------------------------------------------
-- Verification queries (run after cleanup):
-- SELECT count(*) FROM sagre WHERE is_active = true;
-- SELECT province, count(*) FROM sagre WHERE is_active = true GROUP BY province ORDER BY count DESC;
-- SELECT title FROM sagre WHERE is_active = false AND updated_at > NOW() - INTERVAL '5 minutes' LIMIT 20;
-- -----------------------------------------------------------------------------
