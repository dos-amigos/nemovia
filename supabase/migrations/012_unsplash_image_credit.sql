-- Migration 012: Add image_credit column for Unsplash photographer attribution
-- Part of Phase 19: Image Quality Foundation

ALTER TABLE public.sagre ADD COLUMN IF NOT EXISTS image_credit TEXT;
COMMENT ON COLUMN public.sagre.image_credit IS 'Unsplash photographer attribution. Format: "Photographer Name|profile_url". Null for source-provided images.';
