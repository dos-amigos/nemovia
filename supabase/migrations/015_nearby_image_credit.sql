-- Migration 015: Add image_credit to find_nearby_sagre RPC
-- The SagraCardData type expects image_credit but the RPC didn't return it.

CREATE OR REPLACE FUNCTION public.find_nearby_sagre(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 50000,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  location_text TEXT,
  province TEXT,
  start_date DATE,
  end_date DATE,
  enhanced_description TEXT,
  food_tags TEXT[],
  feature_tags TEXT[],
  image_url TEXT,
  image_credit TEXT,
  is_free BOOLEAN,
  price_info TEXT,
  distance_km NUMERIC
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    s.slug,
    s.location_text,
    s.province,
    s.start_date,
    s.end_date,
    s.enhanced_description,
    s.food_tags,
    s.feature_tags,
    s.image_url,
    s.image_credit,
    s.is_free,
    s.price_info,
    ROUND(
      (extensions.st_distance(
        s.location::extensions.geography,
        extensions.st_point(user_lng, user_lat)::extensions.geography
      ) / 1000.0)::NUMERIC,
      1
    ) AS distance_km
  FROM public.sagre s
  WHERE s.is_active = true
    AND s.location IS NOT NULL
    AND extensions.st_dwithin(
      s.location::extensions.geography,
      extensions.st_point(user_lng, user_lat)::extensions.geography,
      radius_meters
    )
  ORDER BY s.location OPERATOR(extensions.<->) extensions.st_point(user_lng, user_lat)
  LIMIT max_results;
END;
$$;
