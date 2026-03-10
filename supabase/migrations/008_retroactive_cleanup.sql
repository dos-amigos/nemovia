-- =============================================================================
-- 008_retroactive_cleanup.sql -- Retroactive cleanup for all 3 reported issues
-- 1. Expire past events (Jan/Feb 2026 + 2025)
-- 2. Upgrade image URLs (WordPress thumbnails + query params)
-- 3. Deactivate non-sagre (mostre, mercati, antiquariato, etc.)
-- Run in Supabase SQL Editor (manual execution, one section at a time).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Section 1: Expire ALL past events (covers Jan/Feb 2026 + anything older)
-- Any event whose end_date (or start_date if no end_date) is before today.
-- Also catches 2025 events that Section 3 of 006 should have caught.
-- Safe to re-run even if 006 was already executed.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    (end_date IS NOT NULL AND end_date < CURRENT_DATE)
    OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE)
  );

-- Verify: How many were deactivated?
-- SELECT count(*) FROM sagre WHERE is_active = false AND updated_at > NOW() - INTERVAL '1 minute';

-- -----------------------------------------------------------------------------
-- Section 2: Fix expire cron (idempotent — safe if 006 already ran)
-- Unschedule + reschedule with enhanced logic.
-- -----------------------------------------------------------------------------
SELECT cron.unschedule('expire-sagre-daily');

SELECT cron.schedule(
  'expire-sagre-daily',
  '0 1 * * *',
  $$
  UPDATE public.sagre
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
    AND (
      (end_date IS NOT NULL AND end_date < CURRENT_DATE)
      OR (end_date IS NULL AND start_date IS NOT NULL AND start_date < CURRENT_DATE)
      OR (start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) < EXTRACT(YEAR FROM CURRENT_DATE))
    );
  $$
);

-- -----------------------------------------------------------------------------
-- Section 3: Upgrade image URLs retroactively
-- 3a: sagritaly — strip WordPress thumbnail suffix (-150x150.jpg -> .jpg)
-- 3b: solosagre — strip w/h/resize query params
-- -----------------------------------------------------------------------------

-- 3a: sagritaly WordPress thumbnails
UPDATE public.sagre
SET image_url = regexp_replace(image_url, '-\d+x\d+(\.\w+)$', '\1'),
    updated_at = NOW()
WHERE is_active = true
  AND 'sagritaly' = ANY(sources)
  AND image_url ~ '-\d+x\d+\.\w+$';

-- 3b: solosagre query params (remove ?w=...&h=...&resize=...)
UPDATE public.sagre
SET image_url = regexp_replace(image_url, '\?[whresize=&0-9]+$', ''),
    updated_at = NOW()
WHERE is_active = true
  AND 'solosagre' = ANY(sources)
  AND image_url ~ '\?(w|h|resize)=';

-- Verify: Check upgraded images
-- SELECT image_url, sources FROM sagre WHERE is_active = true AND ('sagritaly' = ANY(sources) OR 'solosagre' = ANY(sources)) LIMIT 10;

-- -----------------------------------------------------------------------------
-- Section 4: Deactivate non-sagre events (heuristic keyword filter)
-- Matches titles containing keywords typical of non-sagra events.
-- Uses \y word boundary (PostgreSQL POSIX regex) to avoid false positives.
-- -----------------------------------------------------------------------------
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    lower(title) ~ '\y(mostra|mostre)\y'
    OR lower(title) ~ '\yantiquariato\y'
    OR lower(title) ~ '\y(mercato|mercatino|mercatini)\y'
    OR lower(title) ~ '\yfiera\y'
    OR lower(title) ~ '\yesposizione\y'
    OR lower(title) ~ '\yrassegna\y'
    OR lower(title) ~ '\yconcerto\y'
    OR lower(title) ~ '\yspettacolo\y'
    OR lower(title) ~ '\yteatro\y'
    OR lower(title) ~ '\ycinema\y'
    OR lower(title) ~ '\yconvegno\y'
    OR lower(title) ~ '\yconferenza\y'
    OR lower(title) ~ '\ycorso\y.*\y(yoga|fitness|cucina|pittura)\y'
    OR lower(title) ~ '\ymaratona\y'
    OR lower(title) ~ '\ygara\s+(ciclistica|podistica)\y'
  );

-- Verify: What was deactivated?
-- SELECT title FROM sagre WHERE is_active = false AND updated_at > NOW() - INTERVAL '1 minute' ORDER BY title LIMIT 30;

-- -----------------------------------------------------------------------------
-- Section 5: Also re-run heuristic filters from 006 (safe if already done)
-- Calendar spam, excessive duration, noise titles.
-- -----------------------------------------------------------------------------

-- Calendar-spam date ranges (day 1 to day 28+)
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND start_date IS NOT NULL AND end_date IS NOT NULL
  AND EXTRACT(DAY FROM start_date) = 1
  AND EXTRACT(DAY FROM end_date) >= 28;

-- Excessive duration (>7 days)
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND start_date IS NOT NULL AND end_date IS NOT NULL
  AND (end_date - start_date) > 7;

-- Noise titles
UPDATE public.sagre
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    lower(title) ~ 'calendario\y.*\y(eventi|sagre|feste)'
    OR lower(title) ~ 'programma\s+(completo|mensile|settimanale)'
    OR lower(title) ~ 'scopri\s+tutt[ei]|vedi\s+tutt[ei]'
    OR lower(title) ~ 'newsletter|iscriviti|registrati'
  );

-- -----------------------------------------------------------------------------
-- Section 6: Final verification
-- -----------------------------------------------------------------------------
-- SELECT count(*) FROM sagre WHERE is_active = true;
-- SELECT count(*) FROM sagre WHERE is_active = false;
-- SELECT title, start_date, end_date, sources FROM sagre WHERE is_active = true ORDER BY start_date LIMIT 20;
