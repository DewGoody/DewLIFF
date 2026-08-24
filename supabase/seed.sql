-- Seed demo buddy user
INSERT INTO users (line_user_id, display_name, is_friend)
VALUES ('__demo_buddy__', 'Demo Buddy', false)
ON CONFLICT (line_user_id) DO NOTHING;

-- Seed campaign
INSERT INTO campaigns (id, type, status, current_version)
VALUES ('buddy_demo', 'buddy_quiz', 'live', 1)
ON CONFLICT (id) DO NOTHING;
