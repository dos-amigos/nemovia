-- Migration 031: Dedup logging + geographic proximity matching
--
-- CHANGES:
-- 1. dedup_logs table — tracks every merge so admin sees what happened
-- 2. deduplicate_sagre() — adds Method C: geographic proximity (ST_DWithin 15km)
--    + title similarity >0.5 + date ±7 days. Catches multi-venue events like
--    "Rassegna Asparago Bianco" across Bassano/Romano D'Ezzelino.
-- 3. All merges logged to dedup_logs with method used.

-- =============================================================================
-- Section 1: dedup_logs table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dedup_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merged_at    TIMESTAMPTZ DEFAULT NOW(),
  keeper_id    UUID NOT NULL,
  keeper_title TEXT NOT NULL,
  keeper_location TEXT,
  deleted_id   UUID NOT NULL,
  deleted_title TEXT NOT NULL,
  deleted_location TEXT,
  method       TEXT,  -- 'title_province', 'title_city', 'city_date', 'geo_proximity'
  similarity   REAL  -- pg_trgm similarity score between titles
);

CREATE INDEX IF NOT EXISTS idx_dedup_logs_merged_at ON public.dedup_logs (merged_at DESC);

-- =============================================================================
-- Section 2: deduplicate_sagre() — with geo proximity + logging
-- =============================================================================

CREATE OR REPLACE FUNCTION public.deduplicate_sagre()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
  v_total INTEGER := 0;
BEGIN
  LOOP
    WITH quality AS (
      SELECT id, normalized_title, location_text, province, start_date, end_date,
             sources, title, location,
        (CASE WHEN review_status IN ('auto_approved','admin_approved') THEN 25 ELSE 0 END
         + CASE WHEN is_active THEN 10 ELSE 0 END
         + CASE WHEN image_url IS NOT NULL THEN 20 ELSE 0 END
         + CASE WHEN enhanced_description IS NOT NULL THEN 15 ELSE 0 END
         + COALESCE(confidence, 0) / 5
         + COALESCE(array_length(sources, 1), 0) * 5
        ) AS score
      FROM sagre
      WHERE normalized_title IS NOT NULL
    ),
    best_match AS (
      SELECT DISTINCT ON (a.id)
        a.id AS dup_id,
        a.sources AS dup_sources,
        a.title AS dup_title,
        a.location_text AS dup_location,
        b.id AS keeper_id,
        b.title AS keeper_title,
        b.location_text AS keeper_location,
        extensions.similarity(a.normalized_title, b.normalized_title) AS title_sim,
        CASE
          -- Method A: Very similar titles (>0.7) + province match
          WHEN extensions.similarity(a.normalized_title, b.normalized_title) > 0.7
               AND (a.province = b.province
                    OR extensions.similarity(lower(COALESCE(a.location_text,'')), lower(COALESCE(b.location_text,''))) > 0.3)
          THEN 'title_province'
          -- Method A2: Similar titles (>0.5) + city match
          WHEN extensions.similarity(a.normalized_title, b.normalized_title) > 0.5
               AND extensions.similarity(lower(COALESCE(a.location_text,'')), lower(COALESCE(b.location_text,''))) > 0.4
          THEN 'title_city'
          -- Method B: Same city + exact dates
          WHEN extensions.similarity(lower(COALESCE(a.location_text,'')), lower(COALESCE(b.location_text,''))) > 0.5
               AND a.start_date IS NOT NULL AND b.start_date IS NOT NULL
               AND a.start_date = b.start_date
               AND COALESCE(a.end_date, a.start_date) = COALESCE(b.end_date, b.start_date)
               AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.2
          THEN 'city_date'
          -- Method C: Geographic proximity (<15km) + similar title + close dates
          WHEN a.location IS NOT NULL AND b.location IS NOT NULL
               AND extensions.ST_DWithin(a.location::extensions.geography, b.location::extensions.geography, 15000)
               AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.5
               AND a.start_date IS NOT NULL AND b.start_date IS NOT NULL
               AND ABS(a.start_date - b.start_date) <= 7
          THEN 'geo_proximity'
          ELSE NULL
        END AS match_method
      FROM quality a
      JOIN quality b ON a.id != b.id
        AND (b.score > a.score OR (b.score = a.score AND b.id::text < a.id::text))
      WHERE
        -- Method A: Very similar titles (>0.7) — province match
        (
          extensions.similarity(a.normalized_title, b.normalized_title) > 0.7
          AND (a.province = b.province
               OR extensions.similarity(lower(COALESCE(a.location_text,'')), lower(COALESCE(b.location_text,''))) > 0.3)
          AND ((a.start_date IS NOT NULL AND b.start_date IS NOT NULL AND ABS(a.start_date - b.start_date) <= 14)
               OR (a.start_date IS NULL AND b.start_date IS NULL))
        )
        OR
        -- Method A2: Similar titles (>0.5) — city match required
        (
          extensions.similarity(a.normalized_title, b.normalized_title) > 0.5
          AND extensions.similarity(lower(COALESCE(a.location_text,'')), lower(COALESCE(b.location_text,''))) > 0.4
          AND ((a.start_date IS NOT NULL AND b.start_date IS NOT NULL AND ABS(a.start_date - b.start_date) <= 14)
               OR (a.start_date IS NULL AND b.start_date IS NULL))
        )
        OR
        -- Method B: Same city + exact dates
        (
          extensions.similarity(lower(COALESCE(a.location_text,'')), lower(COALESCE(b.location_text,''))) > 0.5
          AND a.start_date IS NOT NULL AND b.start_date IS NOT NULL
          AND a.start_date = b.start_date
          AND COALESCE(a.end_date, a.start_date) = COALESCE(b.end_date, b.start_date)
          AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.2
        )
        OR
        -- Method C: Geographic proximity (<15km) + similar title (>0.5) + close dates (±7 days)
        -- Catches multi-venue events like "Rassegna Asparago Bianco" in Bassano vs Romano D'Ezzelino
        (
          a.location IS NOT NULL AND b.location IS NOT NULL
          AND extensions.ST_DWithin(a.location::extensions.geography, b.location::extensions.geography, 15000)
          AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.5
          AND a.start_date IS NOT NULL AND b.start_date IS NOT NULL
          AND ABS(a.start_date - b.start_date) <= 7
        )
      ORDER BY a.id, b.score DESC, b.id
    ),
    safe_deletes AS (
      SELECT dup_id, dup_sources, dup_title, dup_location,
             keeper_id, keeper_title, keeper_location, title_sim, match_method
      FROM best_match
      WHERE match_method IS NOT NULL
        AND keeper_id NOT IN (SELECT dup_id FROM best_match WHERE match_method IS NOT NULL)
    ),
    -- Log merges BEFORE deleting
    do_log AS (
      INSERT INTO dedup_logs (keeper_id, keeper_title, keeper_location, deleted_id, deleted_title, deleted_location, method, similarity)
      SELECT keeper_id, keeper_title, keeper_location, dup_id, dup_title, dup_location, match_method, title_sim
      FROM safe_deletes
      RETURNING 1
    ),
    -- Merge sources + expand date range from deleted into keeper
    do_merge AS (
      UPDATE sagre SET
        sources = (
          SELECT array(SELECT DISTINCT unnest(sagre.sources || sd.dup_sources))
        ),
        -- Expand date range: keep earliest start_date and latest end_date
        start_date = LEAST(sagre.start_date, sd_dates.min_start),
        end_date = GREATEST(COALESCE(sagre.end_date, sagre.start_date), sd_dates.max_end),
        updated_at = NOW()
      FROM safe_deletes sd
      -- Aggregate dates per keeper (a keeper may absorb multiple dups)
      JOIN LATERAL (
        SELECT MIN(s2.start_date) AS min_start, MAX(COALESCE(s2.end_date, s2.start_date)) AS max_end
        FROM sagre s2
        WHERE s2.id = sd.dup_id
      ) sd_dates ON true
      WHERE sagre.id = sd.keeper_id
      RETURNING 1
    )
    DELETE FROM sagre WHERE id IN (SELECT dup_id FROM safe_deletes);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total := v_total + v_count;
    EXIT WHEN v_count = 0;
  END LOOP;

  RETURN v_total;
END;
$$;

-- =============================================================================
-- Section 3: Run dedup to test (logs will be populated)
-- =============================================================================

SELECT public.deduplicate_sagre();
