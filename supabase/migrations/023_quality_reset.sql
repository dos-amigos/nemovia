-- =============================================================================
-- 023_quality_reset.sql — Quality reset: new columns + archive all existing data
--
-- New columns:
--   confidence (0-100): how sure AI is this is a real sagra
--   review_status: pending, auto_approved, needs_review, admin_approved, admin_rejected, discarded
--
-- Archives ALL existing sagre to start fresh with higher quality data.
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- New columns ---

ALTER TABLE sagre ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT NULL;
ALTER TABLE sagre ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending';

-- Add check constraint for review_status
DO $$ BEGIN
  ALTER TABLE sagre ADD CONSTRAINT check_review_status
    CHECK (review_status IN ('pending', 'auto_approved', 'needs_review', 'admin_approved', 'admin_rejected', 'discarded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_sagre_review_status ON sagre(review_status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sagre_confidence ON sagre(confidence) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sagre_needs_review ON sagre(review_status) WHERE review_status = 'needs_review';

-- --- Archive ALL existing sagre ---
-- We keep the data but mark it inactive. Fresh scraping will repopulate.

UPDATE sagre SET
  is_active = false,
  review_status = 'discarded',
  updated_at = NOW()
WHERE is_active = true;

-- Reset scrape logs to track fresh runs
-- (keep old logs for reference but don't delete)

-- --- Verification ---
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE is_active) AS active,
--        count(*) FILTER (WHERE review_status = 'discarded') AS discarded
-- FROM sagre;
-- Expected: active=0, discarded=all previous active sagre
