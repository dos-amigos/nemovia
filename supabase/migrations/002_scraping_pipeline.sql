-- Nemovia Scraping Pipeline Schema -- Run in Supabase SQL Editor
-- Phase 2: New tables, sagre alterations, functions, triggers, pg_cron schedules, seed data

-- ============================================================
-- Section 1 — Extensions
-- ============================================================

-- Enable unaccent for Italian text normalization
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;


-- ============================================================
-- Section 2 — normalize_text() function
-- ============================================================

-- IMMUTABLE wrapper around unaccent() — required for indexing.
-- Equivalent to JS normalizeText() in src/lib/scraper/normalize.ts.
-- Both must produce equivalent output:
--   JS version used in Edge Function, SQL version used for dedup query index.
CREATE OR REPLACE FUNCTION public.normalize_text(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(
    regexp_replace(
      extensions.unaccent(t),
      '[^a-z0-9\s]', '', 'g'
    )
  );
$$;


-- ============================================================
-- Section 3 — scraper_sources table
-- ============================================================

-- Config-driven source registry: one row per scraping target.
-- CSS selectors are starting templates — verify in browser DevTools before first scrape.
CREATE TABLE IF NOT EXISTS public.scraper_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  selector_item TEXT NOT NULL,
  selector_title TEXT NOT NULL,
  selector_start_date TEXT,
  selector_end_date TEXT,
  selector_city TEXT,
  selector_price TEXT,
  selector_url TEXT,
  selector_image TEXT,
  url_pattern TEXT,
  next_page_selector TEXT,
  max_pages INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  consecutive_failures INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- Section 4 — scrape_logs table
-- ============================================================

-- Audit log for every scraping run (success, error, or skipped).
-- After 3 consecutive failures the Edge Function sets is_active = false on the source.
CREATE TABLE IF NOT EXISTS public.scrape_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.scraper_sources(id),
  source_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  events_found INTEGER DEFAULT 0,
  events_inserted INTEGER DEFAULT 0,
  events_merged INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scrape_logs_started_at_idx ON public.scrape_logs (started_at);
CREATE INDEX IF NOT EXISTS scrape_logs_source_id_idx ON public.scrape_logs (source_id);


-- ============================================================
-- Section 5 — Alter existing sagre table
-- ============================================================

-- Add Phase 2 columns (ADD IF NOT EXISTS is idempotent on re-run)
ALTER TABLE public.sagre
  ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS normalized_title TEXT;

CREATE INDEX IF NOT EXISTS sagre_is_active_idx ON public.sagre (is_active);
CREATE INDEX IF NOT EXISTS sagre_normalized_title_idx ON public.sagre (normalized_title);


-- ============================================================
-- Section 6 — Trigger to auto-populate normalized_title
-- ============================================================

-- Trigger function: populate normalized_title on every INSERT or title UPDATE
CREATE OR REPLACE FUNCTION public.update_normalized_title()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_title := public.normalize_text(NEW.title);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sagre_normalize_title ON public.sagre;
CREATE TRIGGER sagre_normalize_title
  BEFORE INSERT OR UPDATE OF title ON public.sagre
  FOR EACH ROW EXECUTE FUNCTION public.update_normalized_title();


-- ============================================================
-- Section 7 — RLS policy for scraper writes (service role)
-- ============================================================

-- Existing sagre table already has public read SELECT policy from 001_foundation.sql.
-- Add write policy so the Edge Function (service role key) can INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "Service role full access" ON public.sagre;
CREATE POLICY "Service role full access" ON public.sagre
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- Section 8 — find_duplicate_sagra RPC function
-- ============================================================

-- Used by the Edge Function for deduplication lookup.
-- Returns matching sagra id and existing field values for merge decision.
-- Matching logic: normalized_title + city (case-insensitive) + overlapping date range.
-- If either side has no dates, falls back to name+city match only.
CREATE OR REPLACE FUNCTION public.find_duplicate_sagra(
  p_normalized_title TEXT,
  p_city TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  price_info TEXT,
  is_free BOOLEAN,
  sources TEXT[]
)
LANGUAGE sql STABLE AS $$
  SELECT id, image_url, price_info, is_free, sources
  FROM public.sagre
  WHERE normalized_title = p_normalized_title
    AND lower(location_text) = lower(p_city)
    AND (
      -- Both have dates: check overlap using daterange operator
      (p_start_date IS NOT NULL AND start_date IS NOT NULL
       AND daterange(start_date, COALESCE(end_date, start_date), '[]')
           && daterange(p_start_date, COALESCE(p_end_date, p_start_date), '[]'))
      OR
      -- Either side has no dates: match on name+city alone (fallback)
      (p_start_date IS NULL OR start_date IS NULL)
    )
  LIMIT 1;
$$;


-- ============================================================
-- Section 9 — pg_cron schedules
-- ============================================================

-- Expire past events daily at 1 AM UTC (pure SQL — no Edge Function needed)
SELECT cron.schedule(
  'expire-sagre-daily',
  '0 1 * * *',
  $$
  UPDATE public.sagre
  SET is_active = false, updated_at = NOW()
  WHERE end_date < CURRENT_DATE AND is_active = true;
  $$
);

-- Scraper cron jobs — require Vault secrets to be set manually first.
-- Instructions for setting Vault secrets in the Supabase Dashboard:
--   Database -> Vault -> Add secret: name='project_url', value='https://YOUR_REF.supabase.co'
--   Database -> Vault -> Add secret: name='anon_key', value='YOUR_ANON_KEY'
-- (Find YOUR_ANON_KEY under Project Settings -> API)
-- After Vault secrets are set, run these cron.schedule() calls:

SELECT cron.schedule(
  'scrape-sagre-morning',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

SELECT cron.schedule(
  'scrape-sagre-evening',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);


-- ============================================================
-- Section 10 — Seed data for scraper_sources
-- ============================================================

-- WARNING: CSS selectors below are starting templates.
-- Verify against live site HTML in browser DevTools before first scrape.
-- Update rows in scraper_sources directly in Supabase Dashboard if selectors need correction.

INSERT INTO public.scraper_sources (
  name, display_name, base_url,
  selector_item, selector_title, selector_start_date, selector_end_date,
  selector_city, selector_price, selector_url, selector_image,
  url_pattern, max_pages
) VALUES
(
  'solosagre', 'SoloSagre.it',
  'https://www.solosagre.it/sagre/veneto/',
  'a[href*="/sagra/"]',
  'h2, h3, .titolo',
  'span.date, .date-start',
  'span.date-end',
  '.city, .comune',
  '.prezzo, .price',
  NULL,
  'img',
  '?page={n}',
  5
),
(
  'eventiesagre', 'EventieSagre.it',
  'https://www.eventiesagre.it/cerca/cat/sez/mesi/Veneto/prov/cit/rilib',
  '.risultatoEvento',
  'h3',
  NULL,
  NULL,
  NULL,
  NULL,
  'a',
  'img',
  '/pag-{n}.htm',
  10
),
(
  'sagritaly', 'Sagritaly.com',
  'https://sagritaly.com/regioni-sagre/veneto/',
  'article, .event-card, .post',
  'h2, h3, .entry-title',
  '.event-date, time',
  NULL,
  '.location, .city',
  NULL,
  'a',
  'img',
  '?page={n}',
  5
),
(
  'assosagre', 'AsseSagre.it',
  'https://www.assosagre.it/calendario_sagre.php?id_regioni=20&ordina_sagra=date_sagra',
  'tr',
  'a[href*="id_sagra"]',
  'td:nth-child(2)',
  NULL,
  'td:nth-child(3)',
  NULL,
  'a[href*="id_sagra"]',
  NULL,
  NULL,
  1
),
(
  'venetoinfesta', 'VenetoInFesta.it',
  'https://www.venetoinfesta.it/',
  'article, .event-item',
  'h2, h3, .event-title',
  'time, .event-date',
  NULL,
  'a[href*="/comune/"]',
  NULL,
  'a[href*="/evento/"]',
  'img',
  '?page={n}',
  5
)
ON CONFLICT (name) DO NOTHING;
