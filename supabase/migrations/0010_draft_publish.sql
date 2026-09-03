-- Add draft_version column to campaigns (nullable; null = no unpublished draft)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS draft_version INTEGER;
