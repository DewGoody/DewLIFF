-- Seed demo buddy user
INSERT INTO users (line_user_id, display_name, is_friend)
VALUES ('__demo_buddy__', 'Demo Buddy', false)
ON CONFLICT (line_user_id) DO NOTHING;

-- Campaign configs are seeded via: npm run seed:campaigns
-- This populates both `campaigns` and `campaign_versions` from campaigns/*.json
