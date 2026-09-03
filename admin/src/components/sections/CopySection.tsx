import { useState } from 'react';

interface Props {
  copy: Record<string, string>;
  onChange: (copy: Record<string, string>) => void;
}

interface FieldDef {
  path: string;
  effect: string;
}

interface GroupDef {
  label: string;
  rows: FieldDef[];
}

const COPY_GROUPS: GroupDef[] = [
  {
    label: 'Intro',
    rows: [
      { path: 'intro_body', effect: 'คำอธิบายใต้หัวข้อ' },
      { path: 'intro_cta', effect: 'ปุ่มเริ่มเกม' },
      { path: 'intro_quiz_label', effect: 'label เล็กๆ บอก type quiz — default "DUO QUIZ · N ข้อ"' },
      { path: 'intro_time', effect: 'ข้อความเวลา — default "1 นาที"' },
      { path: 'intro_loading', effect: 'ปุ่มกำลังโหลด — default "กำลังโหลด..."' },
      { path: 'intro_note', effect: 'ข้อความเล็กใต้ปุ่ม (ไม่แสดงถ้าว่าง)' },
    ],
  },
  {
    label: 'Question',
    rows: [
      { path: 'question_progress', effect: 'ตัวนับ — ใช้ {current}/{total} — default "ข้อ {current} / {total}"' },
      { path: 'question_back', effect: 'ปุ่มย้อนกลับ — default "← ย้อนกลับ"' },
      { path: 'question_calculating', effect: 'ข้อความขณะคำนวณผล — default "กำลังคำนวณผล..."' },
    ],
  },
  {
    label: 'Summary — Survivor Card',
    rows: [
      { path: 'summary_card_eyebrow', effect: 'label เล็กมุมบนของการ์ด — default "SURVIVOR CARD"' },
      { path: 'summary_card_eyebrow_mbti', effect: 'label สำหรับ MBTI mode — default "TYPE CARD"' },
      { path: 'summary_card_valid', effect: 'badge มุมบนขวา — default "VALID"' },
      { path: 'stat_best_label', effect: 'คำนำหน้าคู่ที่รอดนานสุด — default "คู่ที่รอดนานสุด"' },
      { path: 'stat_worst_label', effect: 'คำนำหน้าคู่ที่ไม่ควรเจอ — default "คู่ที่ไม่ควรเจอ"' },
      { path: 'summary_retake_btn', effect: 'ปุ่มตอบใหม่ — default "↺ ตอบแบบทดสอบใหม่"' },
    ],
  },
  {
    label: 'Summary — Actions',
    rows: [
      { path: 'share_btn', effect: 'ปุ่มแชร์ผล — default "↗ แชร์ผล"' },
      { path: 'share_btn_sent', effect: 'หลังแชร์สำเร็จ — default "✓ แชร์แล้ว!"' },
      { path: 'share_btn_sending', effect: 'ระหว่างส่ง — default "กำลังส่ง..."' },
      { path: 'share_btn_error', effect: 'เกิด error — default "เกิดข้อผิดพลาด"' },
      { path: 'invite_btn', effect: 'ปุ่มเชิญเพื่อน — default "เชิญเพื่อน ▾"' },
    ],
  },
  {
    label: 'Summary — Teams',
    rows: [
      { path: 'summary_teams_header', effect: 'หัวข้อ section ทีม — default "ทีมของฉัน"' },
      { path: 'summary_new_team_btn', effect: 'ปุ่มสร้างทีมใหม่ — default "+ สร้างทีมใหม่"' },
      { path: 'summary_teams_loading', effect: 'ข้อความโหลดทีม — default "กำลังโหลด..."' },
      { path: 'team_survived_prefix', effect: 'คำนำหน้าผลทีม — default "รอดได้"' },
      { path: 'team_waiting_prefix', effect: 'นำหน้าจำนวนรอสมาชิก — default "รอสมาชิกอีก"' },
      { path: 'team_waiting_suffix', effect: 'ตามหลังจำนวนรอสมาชิก — default "คน"' },
      { path: 'team_view_result_btn', effect: 'ปุ่มดูผลทีม (ครบแล้ว) — default "ดูผล"' },
      { path: 'team_view_btn', effect: 'ปุ่มดูทีม (ยังไม่ครบ) — default "ดูทีม"' },
      { path: 'team_leave_btn', effect: 'ปุ่มออกจากทีม — default "ออก"' },
      { path: 'team_leave_confirm', effect: 'ข้อความยืนยันออกทีม — default "ออกจากทีมนี้?"' },
      { path: 'summary_no_teams_title', effect: 'หัวข้อเมื่อยังไม่มีทีม — default "ยังไม่มีทีม"' },
      { path: 'summary_no_teams_body', effect: 'คำอธิบายเมื่อยังไม่มีทีม — default "รวม 5 คน ดูผลทีมวันสิ้นโลก"' },
      { path: 'group_cta', effect: 'ปุ่มสร้างทีม (ตอนยังไม่มี) — default "สร้างทีมวันสิ้นโลก"' },
    ],
  },
  {
    label: 'Summary — Pair Log',
    rows: [
      { path: 'pair_log_label', effect: 'หัวข้อ section คู่หู — default "คู่หูของฉัน"' },
      { path: 'unit_pair', effect: 'หน่วยคู่ — default "คู่"' },
      { path: 'summary_no_pairs_title', effect: 'ยังไม่มีคู่ — default "ยังไม่มีคู่"' },
      { path: 'summary_no_pairs_body', effect: 'คำแนะนำเมื่อยังไม่มีคู่ — default \'กด "เชิญเพื่อน" เพื่อชวนเพื่อนมาจับคู่\'' },
      { path: 'pair_status_waiting', effect: 'สถานะรอคู่ตอบ — default "รอคู่หู..."' },
      { path: 'pair_status_expired', effect: 'สถานะหมดเวลา — default "หมดเวลา"' },
      { path: 'pair_status_done', effect: 'สถานะสำเร็จ (fallback) — default "ดูผล"' },
    ],
  },
  {
    label: 'Invite Sheet (bottom sheet)',
    rows: [
      { path: 'invite_sheet_title', effect: 'ชื่อ bottom sheet — default "เชิญเพื่อน"' },
      { path: 'invite_duo_label', effect: 'ปุ่มจับคู่ 1:1 — default "จับคู่ 1:1"' },
      { path: 'invite_duo_sub', effect: 'คำอธิบายปุ่ม duo — default "ส่งลิงก์เชิญมาดูผลคู่กับฉัน"' },
      { path: 'invite_team_label', effect: 'ปุ่มสร้างทีม — default "สร้างทีมวันสิ้นโลก"' },
      { path: 'invite_team_sub', effect: 'คำอธิบายปุ่มทีม — default "รวม 5 คน ดูผลทีมรอดโลก"' },
      { path: 'invite_btn_sent', effect: 'หลังส่งสำเร็จ — default "✓ ส่งแล้ว!"' },
      { path: 'invite_btn_sending', effect: 'ระหว่างส่ง — default "กำลังส่ง..."' },
    ],
  },
  {
    label: 'Pair Popup',
    rows: [
      { path: 'pair_popup_header', effect: 'หัว popup — default "ผลคู่สำเร็จ"' },
      { path: 'pair_partner_label', effect: 'label คู่หู (fallback) — default "คู่หู"' },
      { path: 'pair_me_label', effect: 'label ฉัน — default "คุณ"' },
      { path: 'pair_popup_view_btn', effect: 'ปุ่มดูผลแบบเต็ม — default "ดูผลคู่แบบเต็ม"' },
      { path: 'pair_popup_skip_btn', effect: 'ปุ่มข้าม — default "ดูผลของฉันก่อน"' },
    ],
  },
  {
    label: 'Pair Result',
    rows: [
      { path: 'pair_result_badge', effect: 'badge บนการ์ดผล — default "คู่นี้รอดได้"' },
      { path: 'pair_rank_text', effect: 'ข้อความอันดับ — ใช้ {rank}/{total} — default "อันดับที่ {rank} จาก {total} คู่"' },
      { path: 'pair_share_cta', effect: 'ปุ่มแชร์ไปไลน์ — default "แชร์ผลไปไลน์"' },
      { path: 'pair_native_share_btn', effect: 'ปุ่ม native share — default "แชร์ผลคู่นี้"' },
      { path: 'pair_back_btn', effect: 'ปุ่มกลับดูผลเดี่ยว — default "ดูผลของฉัน"' },
      { path: 'pair_result_cta', effect: 'ปุ่มใน Flex Card — default "ดูผลคู่แบบเต็ม"' },
      { path: 'pair_invite_cta', effect: 'ปุ่มชวนคนอื่นใน Flex Card — default "จับคู่กับฉันดู · ตอบ 1 นาที"' },
    ],
  },
  {
    label: 'Solo Share',
    rows: [
      { path: 'solo_share_eyebrow', effect: 'eyebrow text — default "แชร์ผลของคุณ"' },
      { path: 'solo_share_title', effect: 'หัวข้อ — default "การ์ดนี้จะถูกส่งเข้าแชท"' },
      { path: 'solo_share_send', effect: 'ปุ่มส่ง LINE — default "ส่งผ่าน LINE"' },
      { path: 'solo_share_sending', effect: 'ระหว่างส่ง — default "กำลังส่ง..."' },
      { path: 'solo_share_hint', effect: 'คำแนะนำใต้ปุ่ม — default "เลือกเพื่อนหรือกลุ่มปลายทางในหน้าต่อไป"' },
      { path: 'solo_share_back', effect: 'ปุ่มกลับ — default "ไปหน้าสรุปผลรวม"' },
      { path: 'share_other_label', effect: 'label section อื่นๆ — default "แชร์ไปที่อื่น"' },
      { path: 'ig_story_btn', effect: 'ปุ่มแชร์ IG — default "แชร์ผลเดี่ยว"' },
      { path: 'ig_story_loading', effect: 'ระหว่างโหลดรูป — default "กำลังโหลด..."' },
      { path: 'ig_story_retry', effect: 'ลองใหม่หลัง error — default "ลองใหม่"' },
    ],
  },
  {
    label: 'Invited Screen',
    rows: [
      { path: 'invited_duo_badge', effect: 'badge คำเชิญ 1:1 — default "คำเชิญ!"' },
      { path: 'invited_team_badge', effect: 'badge เชิญเข้าทีม — default "เชิญเข้าทีม!"' },
      { path: 'invited_team_full_badge', effect: 'badge ทีมเต็ม — default "ทีมเต็มแล้ว!"' },
      { path: 'invited_fallback_name', effect: 'ชื่อ fallback เมื่อไม่มีชื่อผู้เชิญ — default "เพื่อน"' },
      { path: 'invited_team_pending_title', effect: 'หัวข้อรอผลทีม — default "ผลทีมรอเผย"' },
      { path: 'invited_team_pending_sub', effect: 'ใต้หัวข้อรอผล — ใช้ {n} — default "ครบ {n} คน ถึงจะรู้ผล"' },
      { path: 'invited_team_full_title', effect: 'หัวข้อทีมเต็ม — ใช้ {n} — default "ทีมนี้ครบ {n} คนแล้ว"' },
      { path: 'invited_team_full_body', effect: 'คำอธิบายทีมเต็ม — ใช้ {name}' },
      { path: 'team_invite_body', effect: 'ข้อความชวนเข้าทีม — default " ชวนคุณมาเข้าทีม..."' },
      { path: 'invite_cta', effect: 'ปุ่ม CTA หน้า invited (duo) — default "ตอบเลย!"' },
      { path: 'team_answer_first_cta', effect: 'ปุ่ม CTA ก่อนตอบ (team) — default "ตอบก่อนเข้าทีม"' },
      { path: 'team_join_cta', effect: 'ปุ่ม CTA หลังตอบ (team) — default "เข้าร่วมทีมเลย"' },
      { path: 'view_campaign_cta', effect: 'ปุ่มดูแคมเปญก่อน — default "ดูแคมเปญก่อน"' },
      { path: 'team_full_view_cta', effect: 'ปุ่มดูผลทีม (ทีมเต็ม) — default "ดูผลลัพท์เต็ม"' },
      { path: 'team_full_own_cta', effect: 'ปุ่มดูผลเดี่ยว (ทีมเต็ม) — default "ดูผลของฉัน"' },
      { path: 'team_full_answer_cta', effect: 'ปุ่มตอบ (ทีมเต็ม ยังไม่ตอบ) — default "ตอบแบบทดสอบ"' },
    ],
  },
  {
    label: 'Group Screen',
    rows: [
      { path: 'group_page_title', effect: 'หัว nav bar — default "ผลกลุ่ม"' },
      { path: 'group_loading', effect: 'ข้อความโหลด — default "กำลังโหลดผลกลุ่ม..."' },
      { path: 'group_back', effect: 'ปุ่มกลับเมื่อ error — default "← กลับ"' },
      { path: 'group_title', effect: 'label บน card — default "ผลกลุ่ม"' },
      { path: 'group_locked_badge', effect: 'badge ล็อกแล้ว — default "LOCKED"' },
      { path: 'group_unlocked_badge', effect: 'badge ยังเปลี่ยนได้ — default "ยังเปลี่ยนได้"' },
      { path: 'group_name_placeholder', effect: 'placeholder input ชื่อทีม — default "ตั้งชื่อทีม..."' },
      { path: 'group_name_save_btn', effect: 'ปุ่มบันทึกชื่อทีม — default "บันทึก"' },
      { path: 'group_pending_title', effect: 'ชื่อทีม fallback ระหว่างรอ — default "รอทีมครบก่อน"' },
      { path: 'group_survived', effect: 'label เหนือจำนวนวัน — default "กลุ่มนี้อยู่รอดได้"' },
      { path: 'group_members', effect: 'หัวข้อ section สมาชิก — default "สมาชิก"' },
      { path: 'group_member_prefix', effect: 'ชื่อ fallback สมาชิก — default "สมาชิก"' },
      { path: 'group_remaining_label', effect: 'ข้อความรอสมาชิก — ใช้ {n} — default "อีก {n} คน ผลทีมก็เปิด"' },
      { path: 'group_view_pair_btn', effect: 'badge ดูผลคู่ — default "ดูผลคู่ →"' },
      { path: 'group_invite_cta', effect: 'ปุ่มชวนเพิ่ม — default "ชวนเพิ่ม · ยังว่างอีก N คน"' },
      { path: 'group_invite_sending', effect: 'ระหว่างส่ง — default "กำลังส่ง..."' },
      { path: 'group_invite_sent', effect: 'หลังส่งสำเร็จ — default "✓ ส่งคำเชิญแล้ว"' },
      { path: 'group_invite_retry', effect: 'หลัง error — default "ลองใหม่"' },
      { path: 'group_share_cta', effect: 'ปุ่มแชร์ผล — default "แชร์ผลลัพท์เพื่อรับสัญลักษณ์"' },
      { path: 'group_share_unlocked', effect: 'หลังแชร์แล้ว — default "✓ ปลดล็อกสัญลักษณ์แล้ว"' },
      { path: 'group_unlocked_toast', effect: 'toast ปลดล็อก — default "🔓 ปลดล็อกสัญลักษณ์แล้ว!"' },
      { path: 'group_native_share_btn', effect: 'ปุ่ม native share การ์ดกลุ่ม — default "แชร์การ์ดกลุ่ม"' },
      { path: 'group_back_solo', effect: 'ปุ่มกลับดูผลเดี่ยว — default "ผลเดี่ยว"' },
      { path: 'unit_days', effect: 'หน่วยวัน — default "วัน"' },
      { path: 'unit_person', effect: 'หน่วยคน — default "คน"' },
    ],
  },
  {
    label: 'Team Complete! Screen',
    rows: [
      { path: 'team_full_push', effect: 'ข้อความ mock push notification — ใช้ N คน' },
      { path: 'team_full_title', effect: 'หัวข้อใหญ่ — default "TEAM COMPLETE!"' },
      { path: 'team_full_sub', effect: 'ข้อความใต้หัวข้อ — default "ทุกคนได้แจ้งเตือนพร้อมกัน..."' },
      { path: 'team_full_cta', effect: 'ปุ่ม CTA — default "เปิดผลทีม →"' },
    ],
  },
  {
    label: 'Add Friend Nudge',
    rows: [
      { path: 'nudge_title', effect: 'หัวข้อ nudge — default "เพิ่มเพื่อน OA ก่อนนะ"' },
      { path: 'nudge_body_invite', effect: 'ข้อความ nudge ตอนกดเชิญ' },
      { path: 'nudge_body_share', effect: 'ข้อความ nudge ตอนกดแชร์' },
      { path: 'nudge_body_addfriend', effect: 'ข้อความ nudge ตอนกด add friend' },
      { path: 'nudge_add_btn', effect: 'ปุ่มเพิ่มเพื่อน — default "เพิ่มเพื่อน LINE OA"' },
      { path: 'nudge_skip_btn', effect: 'ปุ่มข้าม (generic) — default "ข้ามไปก่อน"' },
      { path: 'nudge_skip_share', effect: 'ปุ่มข้ามตอน share — default "ข้ามไป แชร์เลย"' },
      { path: 'nudge_skip_invite', effect: 'ปุ่มข้ามตอน invite — default "ข้ามไป เชิญเพื่อนเลย"' },
      { path: 'nudge_skip_accept', effect: 'ปุ่มข้ามตอน accept invite — default "ข้ามไป รับคำเชิญเลย"' },
    ],
  },
  {
    label: 'Error · Open in LINE',
    rows: [
      { path: 'error_heading', effect: 'หัวข้อหน้า error — default "อ๊ะ! สัญญาณหลุด"' },
      { path: 'error_body_default', effect: 'ข้อความ default ถ้าไม่มี error จาก server — default "โลกกำลังจะแตก..."' },
      { path: 'error_retry_btn', effect: 'ปุ่มลองใหม่ — default "ลองอีกครั้ง"' },
      { path: 'error_close_btn', effect: 'ปุ่มกลับหน้าแรก — default "กลับหน้าแรก"' },
      { path: 'open_in_line_title', effect: 'หัวข้อหน้า open in LINE — default "เปิดในแอป LINE"' },
      { path: 'open_in_line_body', effect: 'คำอธิบาย — default "กรุณาเปิดลิงก์นี้ผ่านแอป LINE..."' },
      { path: 'open_in_line_btn', effect: 'ปุ่มเปิด LINE — default "เปิดใน LINE"' },
    ],
  },
  {
    label: 'General',
    rows: [
      { path: 'me', effect: 'คำแทนตัวเอง — default "คุณ"' },
      { path: 'unit_questions', effect: 'หน่วยข้อ — default "ข้อ"' },
      { path: 'copy_link_btn', effect: 'ปุ่มคัดลอกลิงก์ (ใช้หลายหน้า) — default "คัดลอกลิงก์เชิญ"' },
      { path: 'copy_link_done', effect: 'หลังคัดลอกสำเร็จ — default "✓ คัดลอกแล้ว"' },
    ],
  },
  {
    label: 'Flex Card — F01 Duo Invite',
    rows: [
      { path: 'F01_alt', effect: 'altText — ใช้ {name} — default "{name}ชวนคุณเล่น Duo Quiz"' },
      { path: 'F01_eyebrow', effect: 'ข้อความเล็กด้านบน — default "DUO QUIZ · 6 ข้อ"' },
      { path: 'F01_title', effect: 'หัวข้อ Flex Card — default "มาดูว่าถ้าโลกแตก..."' },
      { path: 'F01_body', effect: 'ข้อความ body — ใช้ {name}' },
      { path: 'F01_cta1', effect: 'ปุ่มหลัก — default "เริ่มตอบ · 1 นาที"' },
      { path: 'F01_cta2', effect: 'ปุ่มรอง — default "ดูผลคู่กับฉัน"' },
      { path: 'F01_campaign_url', effect: 'override URL ปุ่มรอง (optional)' },
    ],
  },
  {
    label: 'Flex Card — F02 Solo Share',
    rows: [
      { path: 'F02_eyebrow', effect: 'badge บน bubble — default "สายของฉันคือ"' },
      { path: 'F02_cta1', effect: 'ปุ่มหลัก — default "เล่นดูว่าคุณสายไหน"' },
      { path: 'F02_cta2', effect: 'ปุ่มรอง — default "ดูผลคู่กับฉัน"' },
    ],
  },
  {
    label: 'Flex Card — F10 Team Invite',
    rows: [
      { path: 'F10_header', effect: 'หัว bubble — ใช้ {n} — default "อีก {n} คน ผลทีมจะเปิด"' },
      { path: 'F10_locked_title', effect: 'หัวข้อ locked box — default "ผลของทีมนี้ยังไม่เปิด"' },
      { path: 'F10_locked_body', effect: 'ข้อความ locked box — default "ครบ N คนแล้วเปิดพร้อมกัน"' },
      { path: 'F10_body', effect: 'ข้อความอธิบายด้านล่าง' },
      { path: 'F10_cta1', effect: 'ปุ่มหลัก — default "ตอบ 6 ข้อ แล้วเข้าทีมนี้"' },
      { path: 'F10_cta2', effect: 'ปุ่มรอง — default "ดูผล"' },
      { path: 'F10_lock_icon_url', effect: 'URL รูปไอคอนกุญแจ (optional)' },
    ],
  },
  {
    label: 'Flex Card — Group Share',
    rows: [
      { path: 'group_share_badge', effect: 'eyebrow — default "ทีมนี้เป็นสาย"' },
      { path: 'group_share_alt', effect: 'altText fallback — default "มาเข้ากลุ่มกัน!"' },
      { path: 'group_fallback_title', effect: 'title fallback — default "ผลกลุ่ม"' },
      { path: 'group_pending_survival', effect: 'survival text ตอนยังไม่ครบ — default "รอสมาชิกเพิ่ม"' },
      { path: 'group_share_cta_complete', effect: 'ปุ่มหลัก (ทีมครบ) — default "จัดทีมของคุณเอง"' },
      { path: 'group_join_cta', effect: 'ปุ่มหลัก (ทีมยังว่าง) — default "มาเข้าทีมนี้"' },
    ],
  },
  {
    label: 'Chat Trigger',
    rows: [
      { path: 'chat_trigger_text', effect: 'ข้อความที่ user เห็นใน chat ก่อน bot ตอบ Flex Card' },
    ],
  },
  {
    label: 'Result Screen',
    rows: [
      { path: 'result_share_btn', effect: 'ปุ่มแชร์ผลเดี่ยว — default "อวดผลให้คนอื่น"' },
      { path: 'result_retry_btn', effect: 'ปุ่มตอบใหม่ — default "ลองทำอีกครั้ง"' },
      { path: 'result_invite_btn', effect: 'ปุ่มชวนเพื่อน — default "ชวนอีกคน"' },
    ],
  },
  {
    label: 'Waiting Screen',
    rows: [
      { path: 'waiting_title', effect: 'หัวข้อหน้ารอคู่ — default "รอคู่หูตอบอยู่"' },
      { path: 'waiting_body', effect: 'คำอธิบายหน้ารอ — default "ปิดหน้านี้ได้เลย เราจะแจ้งเตือนเมื่อมีผลลัพธ์"' },
      { path: 'waiting_close', effect: 'ปุ่มปิดหน้าต่าง — default "ปิดหน้าต่าง"' },
    ],
  },
  {
    label: 'Symbol Collection',
    rows: [
      { path: 'symbols_title', effect: 'หัวข้อ section สัญลักษณ์ — default "สะสมสัญลักษณ์"' },
      { path: 'symbols_sub', effect: 'คำอธิบายใต้หัวข้อ (Summary) — default "แชร์ผลกลุ่มเพื่อปลดล็อกสัญลักษณ์"' },
      { path: 'symbols_empty', effect: 'ข้อความเมื่อยังไม่มีสัญลักษณ์ — default "ยังไม่มีสัญลักษณ์ในแคมเปญนี้"' },
      { path: 'symbols_hint', effect: 'คำแนะนำวิธีปลดล็อก — default "สร้างทีมครบ 5 คน แล้วแชร์ผล เพื่อปลดล็อกสัญลักษณ์ใหม่"' },
      { path: 'symbols_complete', effect: 'ข้อความครบทุกดวง — default "🎉 สะสมครบทุกดวงแล้ว!"' },
    ],
  },
  {
    label: 'Rewards Screen',
    rows: [
      { path: 'rewards_title', effect: 'หัวข้อหน้ารางวัล (Summary button + หัวหน้าจอ) — default "รางวัลของฉัน"' },
      { path: 'rewards_eyebrow', effect: 'ข้อความเล็กใต้ปุ่มใน Summary — default "ดูสิทธิ์และรางวัลที่ได้รับ"' },
      { path: 'rewards_empty', effect: 'ข้อความเมื่อยังไม่มีรางวัล — default "ยังไม่มีรางวัลในขณะนี้"' },
      { path: 'rewards_back', effect: 'ปุ่มกลับ — default "← กลับ"' },
      { path: 'rewards_exhausted', effect: 'badge เมื่อของหมด — default "หมดแล้ว"' },
      { path: 'rewards_default_label', effect: 'label trigger fallback — default "ทำภารกิจสำเร็จ"' },
      { path: 'claim_btn', effect: 'ปุ่มรับรางวัล — default "รับรางวัล"' },
    ],
  },
  {
    label: 'Gate · Error (legacy)',
    rows: [
      { path: 'result_eyebrow', effect: 'บรรทัดเล็กเหนือชื่อผลลัพธ์' },
      { path: 'friend_gate_title', effect: 'bottom sheet ที่กั้นก่อน add friend' },
      { path: 'expired_title', effect: 'HTTP 410 — token หมดอายุ' },
      { path: 'limit_title', effect: 'HTTP 409 — เกินโควตาต่อวัน' },
    ],
  },
];

export default function CopySection({ copy, onChange }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    COPY_GROUPS.forEach((g) => { init[g.label] = false; });
    return init;
  });

  const set = (key: string, val: string) => onChange({ ...copy, [key]: val });

  return (
    <div className="section" id="sec-copy">
      <div className="section-head">
        <span className="section-num">Copy</span>
        <span className="section-title">ข้อความทุกหน้าจอ</span>
      </div>

      {COPY_GROUPS.map((group) => {
        const isOpen = openGroups[group.label] !== false;
        return (
          <div className="adv-section" key={group.label}>
            <div
              className={`adv-header${isOpen ? ' open' : ''}`}
              onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !isOpen }))}
            >
              <span className="atitle">{group.label}</span>
              <span className="achevron">▾</span>
            </div>
            <div className={`adv-body${isOpen ? ' open' : ''}`}>
              {group.rows.map((row) => (
                <div className="adv-row" key={row.path}>
                  <div className="akey">{row.path}</div>
                  <div>
                    <input
                      type="text"
                      value={copy[row.path] || ''}
                      onChange={(e) => set(row.path, e.target.value)}
                    />
                  </div>
                  <div className="aeffect">{row.effect}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
