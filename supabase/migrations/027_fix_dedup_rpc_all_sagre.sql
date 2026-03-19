-- Migration 027: Fix find_duplicate_sagra to search ALL sagre, not just active
-- Bug: RPC had `WHERE s.is_active = true` but scrapers insert with is_active=false.
-- Result: second scrape run can't find the first copy → inserts duplicate.
-- Fix: remove is_active filter. Dedup should match against entire DB.

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
    WHERE (
        s.normalized_title = p_normalized_title
        OR extensions.similarity(s.normalized_title, p_normalized_title) > 0.6
      )
      AND (
        lower(s.location_text) = lower(p_city)
        OR extensions.similarity(lower(s.location_text), lower(p_city)) > 0.5
      )
      AND (
        (p_start_date IS NOT NULL AND s.start_date IS NOT NULL
         AND daterange(s.start_date, COALESCE(s.end_date, s.start_date), '[]')
             && daterange(p_start_date, COALESCE(p_end_date, p_start_date), '[]'))
        OR (p_start_date IS NULL OR s.start_date IS NULL)
      )
    ORDER BY extensions.similarity(s.normalized_title, p_normalized_title) DESC
    LIMIT 1;
END;
$$;
