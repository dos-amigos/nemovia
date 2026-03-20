-- Migration 028: Improve dedup — same city + same dates = same sagra regardless of title
-- Previous logic required title similarity + city + date overlap.
-- New logic: match if EITHER (title similar + city similar) OR (exact city + exact date overlap).
-- This catches cases like "Festa dell'Olio Olivum" vs "Olivum Bardolino - Festa dell'Olio"

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
    ORDER BY
      -- Prefer exact title match, then location+date match
      CASE WHEN s.normalized_title = p_normalized_title THEN 0
           WHEN s.start_date = p_start_date AND lower(s.location_text) = lower(p_city) THEN 1
           ELSE 2 END,
      extensions.similarity(s.normalized_title, p_normalized_title) DESC
    LIMIT 1;
END;
$$;
