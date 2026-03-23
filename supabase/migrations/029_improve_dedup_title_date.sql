-- Migration 029: Improve dedup — add Method 3: high title similarity + same date
--
-- ROOT CAUSE of current duplicates:
-- Same sagra scraped from 2 sources with slightly different city names
-- (e.g. "Negrar" vs "Negrar di Valpolicella", "Torri" vs "Torri del Benaco").
-- Method 1 (title+city) fails because city similarity < 0.5.
-- Method 2 (city+date) fails because city similarity < 0.7.
-- Neither method catches: same title + same date + different city spelling.
--
-- FIX: Add Method 3 — high title similarity (>0.7) + exact date match.
-- This catches the common case of the same sagra from different sources where
-- the city text differs but the title and dates are the same.
-- Title threshold 0.7 (stricter than Method 1's 0.6) to avoid false positives
-- between genuinely different sagre like "Sagra del Pesce" in two different towns.
--
-- ALSO: One-time dedup of existing duplicates matching these patterns.

-- =============================================================================
-- Section 1: Upgrade find_duplicate_sagra with Method 3
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_duplicate_sagra(
  p_normalized_title TEXT,
  p_city TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE (id UUID, image_url TEXT, price_info TEXT, is_free BOOLEAN, sources TEXT[])
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.image_url, s.price_info, s.is_free, s.sources
    FROM public.sagre s
    WHERE
      -- Method 1: Title similar + city similar (original logic)
      (
        (
          s.normalized_title = p_normalized_title
          OR extensions.similarity(s.normalized_title, p_normalized_title) > 0.6
        )
        AND (
          lower(s.location_text) = lower(p_city)
          OR extensions.similarity(lower(s.location_text), lower(p_city)) > 0.5
        )
      )
      OR
      -- Method 2: Same city + same dates = same sagra (regardless of title)
      (
        p_start_date IS NOT NULL
        AND s.start_date IS NOT NULL
        AND (
          lower(s.location_text) = lower(p_city)
          OR extensions.similarity(lower(s.location_text), lower(p_city)) > 0.7
        )
        AND s.start_date = p_start_date
        AND COALESCE(s.end_date, s.start_date) = COALESCE(p_end_date, p_start_date)
      )
      OR
      -- Method 3 (NEW): High title similarity + same date (relaxed city requirement)
      -- Catches: same sagra from different sources with different city spellings
      -- Requires stricter title match (0.7) since city is not verified
      (
        p_start_date IS NOT NULL
        AND s.start_date IS NOT NULL
        AND s.start_date = p_start_date
        -- Only compare start_date — end_date often differs between sources
        AND extensions.similarity(s.normalized_title, p_normalized_title) > 0.7
      )
    ORDER BY
      -- Prefer exact title match, then location+date match, then title+date match
      CASE WHEN s.normalized_title = p_normalized_title THEN 0
           WHEN s.start_date = p_start_date AND lower(s.location_text) = lower(p_city) THEN 1
           WHEN s.start_date = p_start_date THEN 2
           ELSE 3 END,
      extensions.similarity(s.normalized_title, p_normalized_title) DESC
    LIMIT 1;
END;
$$;

-- =============================================================================
-- Section 2: One-time retroactive dedup of existing duplicates
-- Deactivates the NEWER duplicate (higher created_at) for pairs that match on:
--   (a) title similarity > 0.7 + same start_date + same end_date
--   AND at least one of:
--     - same province
--     - city similarity > 0.3 (very loose, just to avoid completely unrelated cities)
-- This handles the known duplicates:
--   "Sagra del Broccolo" x2 (VR, 2026-03-27)
--   "Palio del Recioto e dell'Amarone" x2 (VR, 2026-04-04)
-- =============================================================================

-- DRY-RUN first (uncomment SELECT, comment UPDATE):
-- SELECT a.id, a.title, a.location_text, a.province, a.start_date,
--        b.id as dup_id, b.title as dup_title, b.location_text as dup_city,
--        extensions.similarity(a.normalized_title, b.normalized_title) as title_sim
-- FROM sagre a JOIN sagre b ON a.id < b.id
-- WHERE a.is_active = true AND b.is_active = true
--   AND a.start_date IS NOT NULL AND b.start_date IS NOT NULL
--   AND a.start_date = b.start_date
--   AND COALESCE(a.end_date, a.start_date) = COALESCE(b.end_date, b.start_date)
--   AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.7
--   AND (a.province = b.province
--        OR extensions.similarity(lower(a.location_text), lower(b.location_text)) > 0.3)
-- ORDER BY title_sim DESC;

WITH dupes AS (
  SELECT DISTINCT ON (LEAST(a.id, b.id), GREATEST(a.id, b.id))
    -- Keep the one with more data (image, sources, enrichment), tie-break by older created_at
    CASE
      WHEN a.review_status IN ('auto_approved', 'admin_approved')
           AND b.review_status NOT IN ('auto_approved', 'admin_approved') THEN b.id
      WHEN b.review_status IN ('auto_approved', 'admin_approved')
           AND a.review_status NOT IN ('auto_approved', 'admin_approved') THEN a.id
      WHEN a.image_url IS NOT NULL AND b.image_url IS NULL THEN b.id
      WHEN b.image_url IS NOT NULL AND a.image_url IS NULL THEN a.id
      WHEN array_length(a.sources, 1) >= array_length(b.sources, 1) THEN b.id
      ELSE a.id
    END AS dup_id,
    -- Also merge sources array into the keeper
    CASE
      WHEN a.review_status IN ('auto_approved', 'admin_approved')
           AND b.review_status NOT IN ('auto_approved', 'admin_approved') THEN a.id
      WHEN b.review_status IN ('auto_approved', 'admin_approved')
           AND a.review_status NOT IN ('auto_approved', 'admin_approved') THEN b.id
      WHEN a.image_url IS NOT NULL AND b.image_url IS NULL THEN a.id
      WHEN b.image_url IS NOT NULL AND a.image_url IS NULL THEN b.id
      WHEN array_length(a.sources, 1) >= array_length(b.sources, 1) THEN a.id
      ELSE b.id
    END AS keeper_id,
    -- Combine sources from both
    CASE
      WHEN a.review_status IN ('auto_approved', 'admin_approved')
           AND b.review_status NOT IN ('auto_approved', 'admin_approved') THEN b.sources
      WHEN b.review_status IN ('auto_approved', 'admin_approved')
           AND a.review_status NOT IN ('auto_approved', 'admin_approved') THEN a.sources
      WHEN a.image_url IS NOT NULL AND b.image_url IS NULL THEN b.sources
      WHEN b.image_url IS NOT NULL AND a.image_url IS NULL THEN a.sources
      WHEN array_length(a.sources, 1) >= array_length(b.sources, 1) THEN b.sources
      ELSE a.sources
    END AS extra_sources
  FROM sagre a
  JOIN sagre b ON a.id < b.id
  WHERE a.is_active = true AND b.is_active = true
    AND a.start_date IS NOT NULL AND b.start_date IS NOT NULL
    AND a.start_date = b.start_date
    AND COALESCE(a.end_date, a.start_date) = COALESCE(b.end_date, b.start_date)
    AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.7
    AND (
      a.province = b.province
      OR extensions.similarity(lower(a.location_text), lower(b.location_text)) > 0.3
    )
),
-- Step 1: Merge sources into keeper
merged AS (
  UPDATE sagre SET
    sources = (
      SELECT array(SELECT DISTINCT unnest(sagre.sources || d.extra_sources))
    ),
    updated_at = NOW()
  FROM dupes d
  WHERE sagre.id = d.keeper_id
  RETURNING sagre.id
)
-- Step 2: Deactivate the duplicate
UPDATE sagre SET is_active = false, updated_at = NOW()
WHERE id IN (SELECT dup_id FROM dupes);
