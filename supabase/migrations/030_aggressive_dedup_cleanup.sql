-- Migration 030: Aggressive dedup — DELETE duplicates, auto-expire past needs_review, daily cron
--
-- PROBLEM: Current dedup (029) only deactivates duplicates and requires exact date match.
-- Result: 5x "Sagra del Brocolo/Broccolo", 3x "Festa delle Rane", 3x "Festa della Zucca"
-- still active in DB. Also 51 needs_review sagre with past dates cluttering the DB.
--
-- FIX:
-- 1. deduplicate_sagre() function: finds clusters, keeps best, DELETES the rest
-- 2. Improved matching: title similarity 0.5, date tolerance ±14 days, city+date fallback
-- 3. One-time cleanup of existing duplicates + past needs_review
-- 4. Daily pg_cron job to prevent future accumulation
-- 5. Improved find_duplicate_sagra() RPC: lower threshold to 0.5

-- =============================================================================
-- Section 1: deduplicate_sagre() — the core dedup engine
-- =============================================================================

CREATE OR REPLACE FUNCTION public.deduplicate_sagre()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
  v_total INTEGER := 0;
BEGIN
  -- Loop: each pass deletes the worse half of duplicate pairs.
  -- Multiple passes handle transitive chains (A matches B matches C).
  -- With ~300 rows, converges in 2-3 passes.
  LOOP
    -- CTE: score all sagre, find pairs, delete worse ones
    WITH quality AS (
      SELECT id, normalized_title, location_text, province, start_date, end_date, sources,
        -- Quality score: higher = more complete, keep this one
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
    -- For each sagra, find its BEST duplicate (= the one with higher score)
    -- If no one has higher score, this sagra is a keeper (not in result set)
    best_match AS (
      SELECT DISTINCT ON (a.id)
        a.id AS dup_id,
        a.sources AS dup_sources,
        b.id AS keeper_id
      FROM quality a
      JOIN quality b ON a.id != b.id
        AND (b.score > a.score OR (b.score = a.score AND b.id::text < a.id::text))
      WHERE
        -- Method A: Very similar titles (>0.7) — province match is enough
        -- Catches: "Sagra del Brocolo" vs "Sagra del Broccolo" in same province
        (
          extensions.similarity(a.normalized_title, b.normalized_title) > 0.7
          AND (
            a.province = b.province
            OR extensions.similarity(
              lower(COALESCE(a.location_text, '')),
              lower(COALESCE(b.location_text, ''))
            ) > 0.3
          )
          AND (
            (a.start_date IS NOT NULL AND b.start_date IS NOT NULL
             AND ABS(a.start_date - b.start_date) <= 14)
            OR (a.start_date IS NULL AND b.start_date IS NULL)
          )
        )
        OR
        -- Method A2: Somewhat similar titles (>0.5) — require CITY match (not just province)
        -- Avoids false positives like "Festa del Papà" vs "Festa del Vino" in same province
        (
          extensions.similarity(a.normalized_title, b.normalized_title) > 0.5
          AND extensions.similarity(
            lower(COALESCE(a.location_text, '')),
            lower(COALESCE(b.location_text, ''))
          ) > 0.4
          AND (
            (a.start_date IS NOT NULL AND b.start_date IS NOT NULL
             AND ABS(a.start_date - b.start_date) <= 14)
            OR (a.start_date IS NULL AND b.start_date IS NULL)
          )
        )
        OR
        -- Method B: Same city + exact dates (catches title variants like
        -- "Sagra del 1° De Majo" vs "Sagra del 1° Maggio - Mostra dei Vini")
        (
          extensions.similarity(
            lower(COALESCE(a.location_text, '')),
            lower(COALESCE(b.location_text, ''))
          ) > 0.5
          AND a.start_date IS NOT NULL AND b.start_date IS NOT NULL
          AND a.start_date = b.start_date
          AND COALESCE(a.end_date, a.start_date) = COALESCE(b.end_date, b.start_date)
          -- Require minimal title overlap to avoid merging unrelated events in same town
          AND extensions.similarity(a.normalized_title, b.normalized_title) > 0.2
        )
      ORDER BY a.id, b.score DESC, b.id
    ),
    -- Safety: only delete dups whose keeper is NOT itself being deleted this pass
    safe_deletes AS (
      SELECT dup_id, dup_sources, keeper_id
      FROM best_match
      WHERE keeper_id NOT IN (SELECT dup_id FROM best_match)
    ),
    -- Merge sources from deleted dups into their keepers
    do_merge AS (
      UPDATE sagre SET
        sources = (
          SELECT array(SELECT DISTINCT unnest(sagre.sources || sd.dup_sources))
        ),
        updated_at = NOW()
      FROM safe_deletes sd
      WHERE sagre.id = sd.keeper_id
      RETURNING 1
    )
    -- DELETE the duplicates (not just deactivate — clean the DB)
    DELETE FROM sagre WHERE id IN (SELECT dup_id FROM safe_deletes);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total := v_total + v_count;
    EXIT WHEN v_count = 0;
  END LOOP;

  RETURN v_total;
END;
$$;


-- =============================================================================
-- Section 2: Cleanup needs_review with past dates (DELETE, not deactivate)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_stale_sagre()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM sagre
  WHERE review_status IN ('needs_review', 'discarded')
    AND (
      -- Past events: end_date (or start_date if no end) is before today
      (end_date IS NOT NULL AND end_date < CURRENT_DATE)
      OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE - INTERVAL '14 days')
      -- Events from previous years
      OR (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
      -- No date + not enriched + older than 30 days = stale
      OR (start_date IS NULL AND enhanced_description IS NULL AND created_at < NOW() - INTERVAL '30 days')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- =============================================================================
-- Section 3: Upgrade find_duplicate_sagra() — lower threshold to 0.5
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
      -- Method 1: Title similar (0.5) + city similar (0.4)
      (
        (
          s.normalized_title = p_normalized_title
          OR extensions.similarity(s.normalized_title, p_normalized_title) > 0.5
        )
        AND (
          lower(s.location_text) = lower(p_city)
          OR extensions.similarity(lower(s.location_text), lower(p_city)) > 0.4
        )
      )
      OR
      -- Method 2: Same city + same dates (regardless of title)
      (
        p_start_date IS NOT NULL
        AND s.start_date IS NOT NULL
        AND (
          lower(s.location_text) = lower(p_city)
          OR extensions.similarity(lower(s.location_text), lower(p_city)) > 0.6
        )
        AND s.start_date = p_start_date
        AND COALESCE(s.end_date, s.start_date) = COALESCE(p_end_date, p_start_date)
      )
      OR
      -- Method 3: High title similarity + close date (±14 days, relaxed city)
      (
        p_start_date IS NOT NULL
        AND s.start_date IS NOT NULL
        AND ABS(s.start_date - p_start_date) <= 14
        AND extensions.similarity(s.normalized_title, p_normalized_title) > 0.6
      )
    ORDER BY
      CASE WHEN s.normalized_title = p_normalized_title THEN 0
           WHEN s.start_date = p_start_date AND lower(s.location_text) = lower(p_city) THEN 1
           WHEN s.start_date = p_start_date THEN 2
           ELSE 3 END,
      extensions.similarity(s.normalized_title, p_normalized_title) DESC
    LIMIT 1;
END;
$$;


-- =============================================================================
-- Section 4: One-time execution — clean up existing mess
-- =============================================================================

-- Step 1: Delete stale needs_review and discarded sagre
SELECT public.cleanup_stale_sagre();

-- Step 2: Deduplicate remaining sagre
SELECT public.deduplicate_sagre();


-- =============================================================================
-- Section 5: pg_cron — daily dedup + cleanup at 02:00 UTC
-- =============================================================================

-- Remove old expire job (replaced by comprehensive cleanup)
SELECT cron.unschedule('expire-sagre-daily');

-- New combined job: expire + cleanup stale + dedup
SELECT cron.schedule(
  'cleanup-and-dedup-daily',
  '0 2 * * *',
  $$
    -- Step 1: Expire active sagre with past dates
    UPDATE public.sagre
    SET is_active = false, updated_at = NOW()
    WHERE is_active = true
      AND (
        (end_date IS NOT NULL AND end_date < CURRENT_DATE)
        OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE - INTERVAL '14 days')
        OR (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
      );

    -- Step 2: Delete stale needs_review/discarded
    SELECT public.cleanup_stale_sagre();

    -- Step 3: Deduplicate
    SELECT public.deduplicate_sagre();
  $$
);
