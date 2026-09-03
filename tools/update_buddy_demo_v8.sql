-- update_buddy_demo_v8.sql
-- Merges group + rewards config into buddy_demo campaign, creating version 8.

BEGIN;

-- ── 1. Verify we're merging into the right base ──────────────────────────────
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM campaign_versions
    WHERE campaign_id = 'buddy_demo' AND version = 7
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Base version buddy_demo v7 not found — aborting.';
  END IF;
END $$;

-- ── 2. Insert new version 8 with group + rewards merged in ───────────────────
INSERT INTO campaign_versions (campaign_id, version, config, published_at, created_at)
SELECT
  'buddy_demo',
  8,
  config
    || jsonb_build_object(
        'group', '{
          "enabled": true,
          "result_mode": "match",
          "min_members": 2,
          "reward_members": 5,
          "max_members": 50,
          "overflow_mode": "hard_cap",
          "result_locks_at": 0,
          "archetypes": [
            {
              "code": "council",
              "title": "สภาโลกแตก",
              "primary_text": "1 ปี 2 เดือน",
              "body": "ครบทั้ง 5 สาย นั่งประชุมกันไม่จบ แต่ก็ไม่มีใครขาดอะไรเลย — กลุ่มที่รอดนานสุดในบรรดาทุกกลุ่ม",
              "min_group_size": 2,
              "fallback": false,
              "condition": {
                "has_axes": ["chill","mu","live","prep","line"],
                "has_mode": "all"
              }
            },
            {
              "code": "bunker",
              "title": "ก๊วนบังเกอร์ศักดิ์สิทธิ์",
              "primary_text": "8 เดือน",
              "body": "เป้หนัก 20 กิโลพร้อมผ้ายันต์ผูกหน้ากระเป๋า เตรียมของครบและออกเดินทางถูกฤกษ์ด้วย",
              "min_group_size": 2,
              "condition": {
                "has_axes": ["mu","prep"],
                "has_mode": "all"
              }
            },
            {
              "code": "chill_group",
              "title": "ก๊วนปลงแล้วจ้า",
              "primary_text": "6 เดือน",
              "body": "สายปลงเป็นใหญ่ ไม่มีใครตื่นเต้น ไม่มีใครทะเลาะ มีชานมและเปลญวนก็พอแล้ว",
              "min_group_size": 2,
              "condition": {
                "top_axes": ["chill"],
                "top_n": 1
              }
            },
            {
              "code": "warroom",
              "title": "ก๊วนวอร์รูม",
              "primary_text": "11 วัน",
              "body": "กางแผนที่ปักหมุดครบทุกจุด แล้วเปลี่ยนแผนใหม่ทุกครั้งที่มีคนส่งข้อมูลเข้ากลุ่ม",
              "min_group_size": 2,
              "condition": {
                "has_axes": ["prep","line"],
                "has_mode": "all"
              }
            },
            {
              "code": "drama",
              "title": "ก๊วนโรงปั่นดราม่า",
              "primary_text": "40 ชั่วโมง",
              "body": "ข่าวไหลเร็วกว่าไฟไหม้ ปั่นกันเองในกลุ่มจนเชื่อว่าจริง แล้วไลฟ์ต่อให้คนนอกดู",
              "min_group_size": 2,
              "condition": {
                "has_axes": ["live","line"],
                "has_mode": "all"
              }
            },
            {
              "code": "muviral",
              "title": "ก๊วนมูไวรัล",
              "primary_text": "5 วัน",
              "body": "ไลฟ์พิธีขอฝนแล้วยอดวิวขึ้น ฝนไม่ตกแต่กำลังใจมา — กลุ่มนี้เชื่อทั้งดวงและอัลกอริทึม",
              "min_group_size": 2,
              "condition": {
                "has_axes": ["mu","live"],
                "has_mode": "all"
              }
            },
            {
              "code": "clone",
              "title": "ก๊วนสายเลือดเดียว",
              "primary_text": "9 วัน",
              "body": "ทุกคนเป็นสายเดียวกันหมด เข้ากันเป๊ะไม่มีเถียง และไม่มีใครทำสิ่งที่กลุ่มขาดเลยด้วย",
              "min_group_size": 2,
              "condition": {
                "is_balanced": false,
                "dominant_threshold": 0.9
              }
            },
            {
              "code": "brake",
              "title": "ก๊วนเบรกมือ",
              "primary_text": "3 สัปดาห์",
              "body": "มีคนคอยดึงสติกลุ่มไว้ไม่ให้ไปไกลเกิน — ช้าหน่อยแต่ไม่มีใครหลุดจากกลุ่มเลย",
              "min_group_size": 2,
              "condition": {
                "has_axes": ["chill"],
                "has_mode": "any"
              }
            },
            {
              "code": "chaos",
              "title": "ก๊วนมั่วซั่ว",
              "primary_text": "12 ชั่วโมง",
              "body": "ไม่มีสายไหนนำ ทุกการตัดสินใจเหมือนทอยลูกเต๋า — ชวนเพื่อนเข้ามาอีก ผลจะเปลี่ยนทุกครั้ง",
              "min_group_size": 2,
              "fallback": true
            }
          ],
          "fallback_archetype": "chaos"
        }'::jsonb,
        'rewards', '{
          "enabled": true,
          "points_per_pair": 50,
          "milestones": [
            {
              "key": "trio",
              "trigger_pairs": 3,
              "reward_pool_id": "00000000-0000-0000-0000-000000000001",
              "label": "ครบ 3 คู่ ลุ้นคูปอง 200.-",
              "icon": "🎁"
            }
          ]
        }'::jsonb
    ),
  now(),
  now()
FROM campaign_versions
WHERE campaign_id = 'buddy_demo' AND version = 7;

-- ── 3. Bump campaigns.current_version to 8 ───────────────────────────────────
UPDATE campaigns
SET current_version = 8
WHERE id = 'buddy_demo';

-- ── 4. Verify ────────────────────────────────────────────────────────────────
SELECT
  campaign_id,
  version,
  config ? 'group'   AS has_group,
  config ? 'rewards' AS has_rewards,
  (config -> 'group' -> 'archetypes') IS NOT NULL AS has_archetypes,
  jsonb_array_length(config -> 'group' -> 'archetypes') AS archetype_count,
  jsonb_array_length(config -> 'rewards' -> 'milestones') AS milestone_count,
  created_at
FROM campaign_versions
WHERE campaign_id = 'buddy_demo' AND version = 8;

COMMIT;
