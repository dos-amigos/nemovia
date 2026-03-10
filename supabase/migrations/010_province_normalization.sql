-- =============================================================================
-- Migration 010: Province Code Normalization
-- Normalizes province values from Nominatim raw text to 2-letter codes.
-- Run manually in Supabase SQL Editor.
-- =============================================================================

-- Section 1: CREATE FUNCTION
-- Maps all 14 Nominatim province name variants to 2-letter codes.
-- Returns NULL for unrecognized values (non-Veneto provinces).
CREATE OR REPLACE FUNCTION public.normalize_province_code(raw_province TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(raw_province))
    WHEN 'belluno'              THEN 'BL'
    WHEN 'provincia di belluno' THEN 'BL'
    WHEN 'padova'               THEN 'PD'
    WHEN 'provincia di padova'  THEN 'PD'
    WHEN 'rovigo'               THEN 'RO'
    WHEN 'provincia di rovigo'  THEN 'RO'
    WHEN 'treviso'              THEN 'TV'
    WHEN 'provincia di treviso' THEN 'TV'
    WHEN 'venezia'              THEN 'VE'
    WHEN 'provincia di venezia' THEN 'VE'
    WHEN 'verona'               THEN 'VR'
    WHEN 'provincia di verona'  THEN 'VR'
    WHEN 'vicenza'              THEN 'VI'
    WHEN 'provincia di vicenza' THEN 'VI'
    ELSE NULL
  END
$$;

-- Section 2: RETROACTIVE NORMALIZATION
-- Convert existing "Padova", "Provincia di Padova" etc. to "PD" format.
UPDATE sagre
SET province = normalize_province_code(province),
    updated_at = NOW()
WHERE province IS NOT NULL
  AND province NOT IN ('BL', 'PD', 'RO', 'TV', 'VE', 'VR', 'VI');

-- Section 3: DEACTIVATE NON-VENETO
-- Catch any events with non-Veneto province values that slipped through.
UPDATE sagre
SET is_active = false,
    updated_at = NOW()
WHERE province IS NOT NULL
  AND normalize_province_code(province) IS NULL
  AND is_active = true;

-- Section 4: VERIFICATION QUERIES (run manually to confirm)
-- SELECT DISTINCT province, COUNT(*) FROM sagre WHERE province IS NOT NULL GROUP BY province ORDER BY province;
-- Expected output: only BL, PD, RO, TV, VE, VR, VI
