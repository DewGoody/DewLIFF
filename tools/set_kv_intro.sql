-- set_kv_intro.sql
-- Sets kv-intro image URL in buddy_demo campaign config (appearance.images)

BEGIN;

UPDATE campaign_versions
SET config = jsonb_set(
  config,
  '{appearance,images,kv-intro}',
  '"https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/kv-intro.png"',
  true   -- create key if missing
)
WHERE campaign_id = 'buddy_demo'
  AND version = (SELECT current_version FROM campaigns WHERE id = 'buddy_demo');

-- Verify
SELECT
  campaign_id, version,
  config #>> '{appearance,images,kv-intro}' AS kv_intro_url
FROM campaign_versions
WHERE campaign_id = 'buddy_demo'
  AND version = (SELECT current_version FROM campaigns WHERE id = 'buddy_demo');

COMMIT;
