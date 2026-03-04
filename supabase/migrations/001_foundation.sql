-- Nemovia Foundation Schema -- Run in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Core sagre table
CREATE TABLE IF NOT EXISTS public.sagre (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location_text TEXT NOT NULL,
  location extensions.geography(POINT, 4326),
  province TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  enhanced_description TEXT,
  food_tags TEXT[],
  feature_tags TEXT[],
  image_url TEXT,
  source_url TEXT,
  is_free BOOLEAN,
  price_info TEXT,
  status TEXT DEFAULT 'pending_geocode',
  content_hash TEXT NOT NULL,
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS sagre_location_idx ON public.sagre USING GIST (location);
CREATE INDEX IF NOT EXISTS sagre_status_idx ON public.sagre (status);
CREATE INDEX IF NOT EXISTS sagre_dates_idx ON public.sagre (start_date, end_date);
CREATE INDEX IF NOT EXISTS sagre_province_idx ON public.sagre (province);
CREATE INDEX IF NOT EXISTS sagre_slug_idx ON public.sagre (slug);
CREATE UNIQUE INDEX IF NOT EXISTS sagre_content_source_idx ON public.sagre (content_hash, source_id);

-- Enable Row Level Security (read-only public access)
ALTER TABLE public.sagre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.sagre
  FOR SELECT
  USING (true);
