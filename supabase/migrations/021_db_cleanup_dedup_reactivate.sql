-- =============================================================================
-- Migration 021: DB cleanup — dedup, re-activate food fiere, filter non-sagre
--
-- Problems:
--   1. Massive duplicates (e.g. "Fiera di Santa Sofia" x6)
--   2. Legitimate food fiere deactivated by migration 008 "fiera" keyword filter
--   3. Non-sagre events active (visita guidata, tasting, tour, etc.)
--   4. Non-Veneto sagre somehow active (Toscana, etc.)
--   5. Province not normalized (some have full names instead of 2-letter codes)
-- =============================================================================

-- Step 0: Normalize province values to 2-letter codes
UPDATE public.sagre
SET province = normalize_province_code(province), updated_at = NOW()
WHERE province IS NOT NULL
  AND province NOT IN ('BL', 'PD', 'RO', 'TV', 'VE', 'VR', 'VI');

-- Step 1: Deactivate non-Veneto sagre (province set but not a valid Veneto code)
UPDATE public.sagre
SET is_active = false, status = 'classified_non_sagra', updated_at = NOW()
WHERE province IS NOT NULL
  AND province NOT IN ('BL', 'PD', 'RO', 'TV', 'VE', 'VR', 'VI')
  AND is_active = true;

-- Step 2: Deduplicate — keep the most enriched version (with most data), delete exact dupes
-- First mark duplicates (keep the one with most non-null fields and earliest created_at)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_title
      ORDER BY
        -- Prefer enriched status
        CASE WHEN status = 'enriched' THEN 0 ELSE 1 END,
        -- Prefer with end_date
        CASE WHEN end_date IS NOT NULL THEN 0 ELSE 1 END,
        -- Prefer with image
        CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END,
        -- Prefer with description
        CASE WHEN source_description IS NOT NULL THEN 0 ELSE 1 END,
        -- Prefer with province
        CASE WHEN province IS NOT NULL THEN 0 ELSE 1 END,
        -- Oldest created wins (original)
        created_at ASC
    ) AS rn
  FROM public.sagre
  WHERE normalized_title IS NOT NULL
)
UPDATE public.sagre
SET is_active = false, status = 'duplicate', updated_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
  AND is_active = true;

-- Step 3: Re-activate wrongly filtered food fiere/mercati
-- Migration 008 killed events with "fiera"/"mercato" but many are food events
UPDATE public.sagre
SET is_active = true, updated_at = NOW()
WHERE is_active = false
  AND status NOT IN ('classified_non_sagra', 'geocode_failed', 'duplicate')
  AND province IS NOT NULL
  AND province IN ('BL', 'PD', 'RO', 'TV', 'VE', 'VR', 'VI')
  AND (
    end_date >= CURRENT_DATE
    OR (end_date IS NULL AND start_date >= CURRENT_DATE - INTERVAL '30 days')
    OR (end_date IS NULL AND start_date IS NULL)
  )
  AND (
    -- Food-related fiere/events
    lower(title) ~ '(riso|pesce|baccal|polenta|gnocch|risott|formagg|vino|birra|zucca|radicchio|bisi|asparag|carne|salsiccia|prosciutt|salame|fungh|tartufo|castagne|mela|ciliegia|fragola|maiale|cinghiale|porchetta|broccol|fagioli|formaggio|olio|olive|dolci|tiramisu|fritto|grigliat)'
    OR lower(title) ~ '\y(sagra|sagre|festa|feste|gastronomic)\y'
  );

-- Step 4: Deactivate non-sagre events (tours, tastings, guided visits, etc.)
UPDATE public.sagre
SET is_active = false, status = 'classified_non_sagra', updated_at = NOW()
WHERE is_active = true
  AND (
    lower(title) ~ '\y(visita guidata|guided tour|escursion|passeggiata|trekking)\y'
    OR lower(title) ~ '\y(tasting|degustazione vini|wine tasting)\y'
    OR lower(title) ~ '\y(convegno|conferenza|seminario|workshop|corso|lezione)\y'
    OR lower(title) ~ '\y(mostra fotografica|esposizione|galleria|museo)\y'
    OR lower(title) ~ '\y(concerto|spettacolo teatrale|recital|opera lirica)\y'
    OR lower(title) ~ '\y(maratona|corsa|gara ciclistica|torneo|campionato)\y'
    OR lower(title) ~ '\y(vinitaly|wine show|expo vini)\y'
  )
  -- Protect legitimate sagre that happen to contain these words
  AND NOT (
    lower(title) ~ '\y(sagra|sagre|festa|feste|gastronomic|culinari)\y'
    OR lower(title) ~ '(polenta|gnocch|risott|baccal|pesce|carne|porchetta|grigliat)'
  );

-- Step 5: Force re-enrichment of sagre without province that have location_text
-- Set status to 'new' so the enrich-sagre pipeline picks them up again
UPDATE public.sagre
SET status = 'new', updated_at = NOW()
WHERE is_active = true
  AND province IS NULL
  AND location IS NULL
  AND location_text IS NOT NULL
  AND location_text != ''
  AND status NOT IN ('new', 'pending_geocode');
