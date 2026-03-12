-- Phase 23: Scraping Completeness
-- Add columns for detail page content extracted from source sites
ALTER TABLE public.sagre
  ADD COLUMN IF NOT EXISTS source_description TEXT,
  ADD COLUMN IF NOT EXISTS menu_text TEXT,
  ADD COLUMN IF NOT EXISTS orari_text TEXT;

-- Comment for documentation
COMMENT ON COLUMN public.sagre.source_description IS 'Raw description from source site detail page (higher priority than enhanced_description)';
COMMENT ON COLUMN public.sagre.menu_text IS 'Menu/food offerings extracted from source site detail page';
COMMENT ON COLUMN public.sagre.orari_text IS 'Opening hours/schedule extracted from source site detail page';
