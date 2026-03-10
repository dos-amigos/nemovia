-- =============================================================================
-- 009_filter_recalibration.sql -- Recalibrate overly aggressive filters from 008
-- 1. Re-activate false positives (sagre with secondary activity keywords)
-- 2. Retroactive smart non-sagra cleanup (whitelist-aware)
-- Run in Supabase SQL Editor (manual execution, one section at a time).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Section 1: DRY RUN — Count false positives from migration 008
-- Events that were deactivated by 008's keyword filter but are legitimate sagre
-- because they contain sagra/festa/gastronomic indicators alongside the
-- secondary activity keywords.
-- UNCOMMENT to run before Section 2.
-- -----------------------------------------------------------------------------
-- SELECT count(*), title
-- FROM public.sagre
-- WHERE is_active = false
--   AND (
--     lower(title) ~ '\y(mercato|mercatino|mercatini)\y'
--     OR lower(title) ~ '\yfiera\y'
--     OR lower(title) ~ '\yconcerto\y'
--     OR lower(title) ~ '\yspettacolo\y'
--     OR lower(title) ~ '\y(mostra|mostre)\y'
--     OR lower(title) ~ '\yrassegna\y'
--     OR lower(title) ~ '\yesposizione\y'
--     OR lower(title) ~ '\yteatro\y'
--     OR lower(title) ~ '\ycinema\y'
--     OR lower(title) ~ '\yconvegno\y'
--     OR lower(title) ~ '\yconferenza\y'
--   )
--   AND (
--     lower(title) ~ '\y(sagra|sagre)\y'
--     OR lower(title) ~ '\y(festa|feste)\y'
--     OR lower(title) ~ '\y(gastronomic|enogastronomic)\y'
--     OR lower(title) ~ '(degustazion|polenta|baccal|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)'
--   )
--   AND start_date >= CURRENT_DATE
-- GROUP BY title
-- ORDER BY title;

-- -----------------------------------------------------------------------------
-- Section 2: RE-ACTIVATE FALSE POSITIVES from migration 008
-- Re-activate events that were deactivated by 008's blunt keyword filter
-- but contain sagra/festa/gastronomic indicators (whitelist match).
-- Only re-activates future events in Veneto (province IS NOT NULL).
-- Includes dedup guard: skip if an active event with same normalized_title exists.
-- -----------------------------------------------------------------------------
UPDATE public.sagre s
SET is_active = true, updated_at = NOW()
WHERE s.is_active = false
  -- Match secondary-activity keywords (the ones 008 used to deactivate)
  AND (
    lower(s.title) ~ '\y(mercato|mercatino|mercatini)\y'
    OR lower(s.title) ~ '\yfiera\y'
    OR lower(s.title) ~ '\yconcerto\y'
    OR lower(s.title) ~ '\yspettacolo\y'
    OR lower(s.title) ~ '\y(mostra|mostre)\y'
    OR lower(s.title) ~ '\yrassegna\y'
    OR lower(s.title) ~ '\yesposizione\y'
    OR lower(s.title) ~ '\yteatro\y'
    OR lower(s.title) ~ '\ycinema\y'
    OR lower(s.title) ~ '\yconvegno\y'
    OR lower(s.title) ~ '\yconferenza\y'
  )
  -- AND title also contains sagra/festa/gastronomic/food indicators (whitelist)
  AND (
    lower(s.title) ~ '\y(sagra|sagre)\y'
    OR lower(s.title) ~ '\y(festa|feste)\y'
    OR lower(s.title) ~ '\y(gastronomic|enogastronomic)\y'
    OR lower(s.title) ~ '(degustazion|polenta|baccal|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)'
  )
  -- Only re-activate future events
  AND s.start_date >= CURRENT_DATE
  -- Only Veneto-gated events (province IS NOT NULL)
  AND s.province IS NOT NULL
  -- Dedup guard: don't re-activate if an active event with same normalized_title exists
  AND NOT EXISTS (
    SELECT 1 FROM public.sagre d
    WHERE d.is_active = true
      AND d.id != s.id
      AND d.normalized_title = s.normalized_title
  );

-- Verify: How many were re-activated?
-- SELECT count(*) FROM sagre WHERE is_active = true AND updated_at > NOW() - INTERVAL '1 minute';
-- SELECT title FROM sagre WHERE is_active = true AND updated_at > NOW() - INTERVAL '1 minute' ORDER BY title;

-- -----------------------------------------------------------------------------
-- Section 3: RETROACTIVE SMART NON-SAGRA CLEANUP
-- Deactivate active events that match non-sagra patterns but do NOT match
-- the whitelist. Mirrors isNonSagraTitle() logic from filters.ts in SQL.
-- This replaces 008's Section 4 with a smarter, whitelist-aware approach.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  -- Matches non-sagra patterns
  AND (
    lower(title) ~ '\y(passeggiata|camminata|marcia)\y'
    OR lower(title) ~ '\ycarnevale\y'
    OR lower(title) ~ '\y(concerto|concerti|recital)\y'
    OR lower(title) ~ '\y(mostra|mostre|esposizione)\y'
    OR lower(title) ~ '\y(antiquariato|collezionismo)\y'
    OR lower(title) ~ '\y(teatro|teatrale|commedia|spettacolo)\y'
    OR lower(title) ~ '\y(maratona|corsa)\y'
    OR lower(title) ~ '\ygara\s+(ciclistica|podistica)\y'
    OR lower(title) ~ '\y(convegno|conferenza|seminario)\y'
    OR lower(title) ~ '\y(cinema|cineforum|proiezione)\y'
    OR lower(title) ~ '\y(yoga|fitness|pilates)\y'
    OR lower(title) ~ '\y(mercato|mercatino|mercatini)\y'
    OR lower(title) ~ '\yfiera\y'
    OR lower(title) ~ '\yrassegna\y'
  )
  -- EXCLUDE from deactivation: titles containing sagra/festa/gastronomic/food keywords
  AND NOT (
    lower(title) ~ '\y(sagra|sagre)\y'
    OR lower(title) ~ '\y(festa|feste)\y'
    OR lower(title) ~ '\y(gastronomic|enogastronomic)\y'
    OR lower(title) ~ '(degustazion|polenta|baccal|pesce|gnocch|risott|tortel|formagg|asparag|radicchi|funghi|vino|birra|griglia)'
  );

-- -----------------------------------------------------------------------------
-- Section 4: VERIFICATION QUERIES (uncomment to run)
-- -----------------------------------------------------------------------------
-- Total active events
-- SELECT count(*) AS active_count FROM sagre WHERE is_active = true;

-- Active by source
-- SELECT unnest(sources) AS source, count(*) AS cnt
-- FROM sagre WHERE is_active = true
-- GROUP BY source ORDER BY cnt DESC;

-- Sample re-activated titles
-- SELECT title, start_date, province, sources
-- FROM sagre WHERE is_active = true
-- ORDER BY updated_at DESC LIMIT 20;
