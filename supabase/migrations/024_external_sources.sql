-- =============================================================================
-- 024_external_sources.sql — Configurable external source registry
-- Stores Instagram profiles, Facebook pages, and other external sources
-- that can be managed from the admin dashboard.
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.external_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('instagram', 'facebook', 'rss', 'other')),
  name TEXT NOT NULL,              -- display name (e.g. "Pro Loco Treviso")
  url TEXT NOT NULL UNIQUE,        -- profile/page URL
  notes TEXT,                      -- admin notes
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  last_result JSONB,               -- {found, inserted, merged, errors} from last run
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS external_sources_type_idx ON public.external_sources (type);
CREATE INDEX IF NOT EXISTS external_sources_active_idx ON public.external_sources (is_active);

-- Seed with current hardcoded sources
INSERT INTO public.external_sources (type, name, url) VALUES
  -- Instagram profiles (currently in scrape-instagram.mjs)
  ('instagram', 'Sagre Veneto', 'https://www.instagram.com/sagreveneto/'),
  ('instagram', 'Sagre in Veneto', 'https://www.instagram.com/sagreinveneto/'),
  ('instagram', 'UNPLI Veneto', 'https://www.instagram.com/unpliveneto/'),
  ('instagram', 'Veneto in Festa', 'https://www.instagram.com/venetoinfesta/'),
  -- Facebook pages (currently in scrape-facebook.mjs)
  ('facebook', 'Sagre Veneto (74K)', 'https://www.facebook.com/sagre.veneto/events'),
  ('facebook', 'Sagre nel Veneto (35K)', 'https://www.facebook.com/SagrenelVeneto/events'),
  ('facebook', 'UNPLI Veneto Pro Loco', 'https://www.facebook.com/unpliveneto.proloco/events'),
  ('facebook', 'Pro Loco Verona', 'https://www.facebook.com/prolocoverona/events')
ON CONFLICT (url) DO NOTHING;
