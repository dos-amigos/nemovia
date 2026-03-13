-- Migration 017: Add unsplash_query column for Gemini-generated image search queries
-- Gemini generates a specific 2-3 word English food photo query during enrichment (Pass 2)
-- which is then used in Pass 3 for more relevant Unsplash image assignment.

ALTER TABLE sagre ADD COLUMN IF NOT EXISTS unsplash_query text;
