# Flex Card Inventory — Codera OA Campaign Quiz

ทุก flex card / message ที่ระบบส่งให้ผู้ใช้งาน
จัดแบ่งเป็น 3 กลุ่ม: **OA Push · OA Reply · Chat Share (shareTargetPicker)**

---

## กลุ่ม A — OA Push (หักโควต้า)

ส่งจาก server ผ่าน LINE Bot API `pushMessage()`
ผู้รับต้องเป็น OA follower ถึงจะได้รับ

---

### A-1 · Match Result Card → ส่งให้ B (ผู้รับเชิญ)

**Trigger:** B ตอบ quiz เสร็จ → `matchAndCompute()` เสร็จ
**ส่งถึง:** B (ผู้รับเชิญ)
**ไฟล์:** `src/services/match.ts` → `buildMatchResultCard()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | `result.image_url` (ถ้ามี) — full width 20:13 cover | ✅ |
| Eyebrow | `"คุณสองคนคือ"` (หรือ config copy `result_eyebrow`) | ✅ |
| Title | ชื่อผลลัพท์คู่ (result.title) — bold xl สี primary | ✅ |
| Body text | result.body (ถ้ามี) — sm สี #666 | ✅ |
| Axis pair box | การ์ดคู่ซ้าย-ขวา: คุณ (axis A) + ชื่อคู่หู (axis B) พร้อม label | ✅ |
| CTA | `"ดูผลลัพธ์"` → LIFF `?pairId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] ออกแบบ layout ใหม่ให้ไม่โล่ง — เพิ่ม rank badge หรือ survival score
- [ ] เพิ่ม eyebrow ที่ชัดเจนกว่านี้ว่า "ผลคู่ของคุณกับ {buddyName}"

---

### A-2 · Partner Answered Card → ส่งให้ A (ผู้ชวน)

**Trigger:** B ตอบ quiz เสร็จ → แจ้ง A ว่ามีผลแล้ว
**ส่งถึง:** A (ผู้ชวน/inviter)
**ไฟล์:** `src/services/match.ts` → `buildPartnerAnsweredCard()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | ไม่มี (hero = single image เท่านั้น) | — |
| Body top | Axis pair box: คุณ (axis A) + ชื่อ B (axis B) — อยู่บนสุด | ✅ อัปเดตแล้ว |
| Title | `"{partnerName} ตอบแล้ว!"` — bold md | ✅ |
| Sub-label | `"ผลลัพท์คู่ของคุณ"` — xs สี #888 | ✅ |
| Result title | result.title — bold xl สี primary | ✅ |
| Result body | result.body — sm สี #666 | ✅ |
| CTA | `"ดูผลลัพท์"` → LIFF `?pairId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] ยังไม่มี hero image — พิจารณาใช้ result.image_url เป็น hero ถ้ามี
- [ ] Axis card size อาจเล็กไป เพราะ box อยู่ใน body ไม่ใช่ hero

---

### A-3 · Group Update Card → ส่งให้ creator

**Trigger:** มีสมาชิกใหม่ join group (`joinGroup()`)
**ส่งถึง:** creator ของกลุ่ม
**ไฟล์:** `src/services/group.ts` → `pushGroupUpdateToCreator()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | `archetype.image_url` (ถ้ามี) — 20:13 cover | ✅ |
| Eyebrow | `"ผลกลุ่ม · GRP-XXXX"` | ✅ |
| Title | `"มีสมาชิกเข้าร่วมทีม!"` — bold lg | ✅ |
| Archetype name | archetype.title — bold xl สี primary | ✅ |
| Archetype body | archetype.body — sm สี #666 | ✅ |
| Survival line | `primary_text` + badge `N คน` (horizontal box) | ✅ |
| Fallback (ยังไม่ครบ) | `"N คนในทีม — รอสมาชิกเพิ่ม"` | ✅ |
| CTA | `"ดูผลทีม"` → LIFF `?groupId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] บอกว่าใครเพิ่งเข้าร่วม (ชื่อสมาชิกใหม่) ยังไม่มี
- [ ] ยังไม่ได้ระบุชื่อกลุ่มหรือ archetype icon

---

## กลุ่ม B — OA Reply (ฟรี — ต้องตอบภายใน 1 นาที)

ใช้ `replyMessage()` ตอบกลับ event จาก LINE Webhook
**ไม่หักโควต้า** แต่ต้องมี replyToken ที่ยังไม่หมดอายุ

---

### B-1 · Welcome Message (Follow Event)

**Trigger:** ผู้ใช้กด Follow OA
**ส่งถึง:** ผู้ใช้ที่เพิ่งกด Follow
**ไฟล์:** `src/routes/webhook.ts` → `autoReply.ts` `getWelcomeMessage()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Type | Text message | — |
| Content | ตั้งค่าใน DB table `oa_settings` | ✅ |
| Default | `"ยินดีต้อนรับ! 🎯\nพิมพ์ 'ควิซ' เพื่อเริ่มเล่น"` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] ควรเป็น Flex card แทน text — มี KV image + CTA "เริ่มเล่น"
- [ ] Admin ตั้งค่าได้ผ่าน `oa_settings` table แต่ยังเป็น text เท่านั้น

---

### B-2 · Keyword Auto-Reply

**Trigger:** ผู้ใช้พิมพ์ข้อความที่ match keyword ใน DB
**ส่งถึง:** ผู้ใช้ที่พิมพ์
**ไฟล์:** `src/services/autoReply.ts` → `handleTextMessage()`

| Type | รูปแบบ |
|------|--------|
| `text` | ส่ง text message ตามที่กำหนดใน DB |
| `flex_campaign` | Campaign intro card (brand name + intro body + CTA) |
| `flex_custom` | JSON flex ที่ admin upload ตรงๆ ใน DB |

**ตั้งค่าใน:** DB table `keyword_rules` (keyword, priority, enabled, reply_type, reply_text, reply_flex, campaign_id)

**ปัญหา / ต้องปรับ:**
- [ ] `flex_campaign` card ยังโล่ง — ไม่มี hero image, แค่ชื่อ brand + body + CTA
- [ ] Admin UI ยังต้องแก้ไขตรงใน DB ยังไม่มี UI ตั้งค่า

---

### B-3 · Result Trigger Reply

**Trigger:** LIFF ส่ง `liff.sendMessages()` → ข้อความมี `#ref:{pairId}`
**ส่งถึง:** ผู้ใช้ที่เล่น (reply ใน OA chat)
**ไฟล์:** `src/services/triggerReply.ts` → `handleResultTrigger()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | result.image_url (ถ้ามี) — 20:13 cover | ✅ |
| Eyebrow | `"คุณสองคนคือ"` / `"คุณคือ"` | ✅ |
| Title | result.title — bold xl | ✅ |
| Body | result.body | ✅ |
| Axis tags | pill badges: `"คุณ · {label}"` + `"คู่หู · {label}"` | ✅ |
| CTA 1 | `"ชวนเพื่อนเล่น"` → LIFF campaign URL | ✅ |
| CTA 2 | `"ดูผลอีกครั้ง"` → LIFF `?pairId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] Axis tags เป็น pill เล็ก — ควรเปลี่ยนเป็น axis card images แบบ pair result
- [ ] CTA 1 label ใช้ config copy `result_share_cta` — ควรตรวจว่า config ตั้งไว้ถูกต้อง

---

### B-4 · Share Trigger Reply

**Trigger:** LIFF ส่ง `#ref:share:{campaignId}`
**ส่งถึง:** ผู้ใช้
**ไฟล์:** `src/services/triggerReply.ts` → `handleShareTrigger()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | ไม่มี | ❌ โล่ง |
| Title | cfg.brand.name — bold xl | — |
| Body | cfg.copy `intro_body` | — |
| CTA | `"เริ่มเลย"` (หรือ `intro_cta`) → LIFF URL | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] ไม่มี hero image — ควรใส่ KV image หรือ axis card
- [ ] Content โล่งมาก — ควรบอก concept ของ campaign ให้ชัดขึ้น

---

### B-5 · Random Trigger Reply

**Trigger:** LIFF ส่ง `#ref:random:{campaignId}:{seed}`
**ส่งถึง:** ผู้ใช้
**ไฟล์:** `src/services/triggerReply.ts` → `handleRandomTrigger()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | result.image_url (ถ้ามี) — 20:13 cover | ✅ |
| Eyebrow | `"🎲 ผลสุ่มของคุณ"` | — |
| Title | result.title — bold xl สี primary | ✅ |
| Body | result.body | ✅ |
| CTA | `"เล่นอีกครั้ง"` → LIFF URL | ✅ |

**หมายเหตุ:** การ์ดนี้ยังไม่ได้ใช้งานใน campaign ปัจจุบัน

---

## กลุ่ม C — Chat Share (shareTargetPicker)

ผู้ใช้เป็นคนส่งเองเข้าแชท LINE
**ไม่หักโควต้า** แต่ต้องรอผู้ใช้กดปุ่ม

---

### C-1 · Duo Invite Flex (ชวนจับคู่)

**Trigger:** ผู้ใช้กด "ส่งลิงก์ชวนเพื่อนผ่าน LINE" ใน Share tab
**ไฟล์:** `liff/src/screens/Share.tsx` → `handleShareDuo()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | KV image (`kv-intro`) — 20:14 fit | ✅ |
| Badge | `"DUO QUIZ"` — yellow pill | ✅ |
| Title | `"ถ้าโลกแตกพรุ่งนี้ คุณกับฉันจะรอดได้กี่วัน?"` | ✅ |
| Body 1 | `"ตอบ 6 ข้อ เผยสายรอดของคุณ"` | ✅ |
| Body 2 | `"แล้วดูผลคู่ว่าเราสองคนจะรอดได้นานแค่ไหน"` | ✅ |
| CTA | `"ตอบรับคำเชิญ"` → LIFF `?inviterId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] KV image ขนาดดูเล็กเพราะ `fit` mode — พิจารณา `cover` แต่ต้องการภาพที่เหมาะสม
- [ ] Copy ทั้งหมดตั้งได้ผ่าน campaign config `copy.*`

---

### C-2 · Group Invite Flex (เชิญเข้าทีม)

**Trigger:** ผู้ใช้กด "ส่งลิงก์เชิญทีมผ่าน LINE" ใน Share tab
**ไฟล์:** `liff/src/screens/Share.tsx` → `handleShareGroup()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | axis card ของสมาชิกคนแรก — 20:13 cover | ✅ |
| Badge | `"เชิญเข้าทีม"` — yellow pill | ✅ |
| Title | `"คุณถูกชวนให้ร่วมกลุ่มผู้รอดวันสิ้นโลก!"` | ✅ อัปเดตแล้ว |
| Body | `"มาดูกันว่าถ้าโลกแตก ทีมของเราจะเป็นกลุ่มผู้รอดประเภทไหน"` | ✅ อัปเดตแล้ว |
| Info row | archetype title + badge `"รอด X วัน · N คน"` | ✅ |
| CTA | `"เข้าร่วมทีม"` → LIFF `?groupId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] Hero ใช้ axis card ของสมาชิก — ควรพิจารณาใช้ archetype image แทน
- [ ] ยังไม่บอกชื่อคนชวน (ผู้ส่ง)

---

### C-3 · Pair Result Share (แชร์ผลคู่)

**Trigger:** ผู้ใช้กด "แชร์การ์ดคู่นี้" ใน PairResult screen
**ไฟล์:** `liff/src/screens/PairResult.tsx` → `handleShare()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | OG image URL (generated) — 20:13 cover | ✅ |
| Body | `"คู่นี้รอดได้ {survival}"` — eyebrow | — |
| Axis boxes | สองกล่อง: buddy (น้ำเงิน) + me (เหลือง) พร้อม axis card thumbnail | ✅ |
| CTA | `"ตอบคำถาม"` (copy `pair_invite_cta`) → LIFF URL | ⚠️ ควรเปลี่ยน label |

**ปัญหา / ต้องปรับ:**
- [ ] CTA label `"ตอบคำถาม"` — ควรเป็น `"ดูผลคู่ของคุณ"` หรือ `"ชวนมาจับคู่กัน"`
- [ ] Body ของ card ค่อนข้างเบา ยังไม่มี result title ที่ชัดเจน

---

### C-4 · Group Result Share (แชร์ผลทีม)

**Trigger:** ผู้ใช้กด "แชร์ผลกลุ่มนี้" ใน Group screen
**ไฟล์:** `liff/src/screens/Group.tsx` → `handleShareGroup()`

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | archetype.image_url หรือ fanCards[0] — 20:13 cover | ✅ |
| Header | `"ผลกลุ่ม · GRP-XXXX"` + `"ยังเปลี่ยนได้ / LOCKED"` | ✅ |
| Body | archetype title + survival score + badge `N คน` | ✅ |
| CTA | `"เข้าร่วมกลุ่ม"` → LIFF `?groupId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] CTA label — ผู้รับอาจไม่เข้าใจว่า "เข้าร่วมกลุ่ม" หมายถึงอะไร ควรเป็น "ดูผลทีม / เข้าร่วม"
- [ ] ไม่มีคำอธิบายว่านี่คือ apocalypse survival quiz

---

### C-5 · Auto Fallback Share (กรณี push A ล้มเหลว)

**Trigger:** หลัง B ตอบ quiz เสร็จ แต่ push ถึง A ไม่ได้ (A ไม่ได้ follow OA) → B ถูก prompt ให้แชร์เอง
**ไฟล์:** `liff/src/App.tsx` (inline ใน match completion flow)

| ส่วน | Content ปัจจุบัน | สถานะ |
|------|-----------------|--------|
| Hero | ไม่มี (basic bubble) | ❌ โล่ง |
| Title | `"ฉันตอบแล้ว! ดูผลของเราด้วยกันเลย"` | — |
| CTA | `"ดูผลคู่"` → LIFF `?pairId=...` | ✅ |

**ปัญหา / ต้องปรับ:**
- [ ] โล่งมาก ไม่มี axis cards หรือ hero image
- [ ] ควรใช้ content เดียวกับ A-2 (Partner Answered Card) แต่ส่งผ่าน shareTargetPicker

---

## สรุปสถานะ / Priority แก้ไข

| การ์ด | ปัญหาหลัก | Priority |
|--------|-----------|----------|
| **A-1** Match Result → B | Layout โล่ง ไม่มี rank/survival info | 🔴 สูง |
| **A-2** Partner Answered → A | ยังไม่มี hero image | 🟡 กลาง |
| **A-3** Group Update → creator | ไม่บอกชื่อคนใหม่ | 🟡 กลาง |
| **B-1** Welcome Message | ยังเป็น text, ควรเป็น Flex | 🔴 สูง |
| **B-3** Result Trigger Reply | Axis tags เป็น pill เล็ก | 🟡 กลาง |
| **B-4** Share Trigger Reply | ไม่มี hero, โล่ง | 🔴 สูง |
| **C-1** Duo Invite | KV image ดูเล็ก | 🟢 ต่ำ |
| **C-2** Group Invite | ✅ อัปเดตแล้ว | 🟢 |
| **C-3** Pair Result Share | CTA label ผิด | 🔴 สูง |
| **C-4** Group Result Share | CTA ไม่ชัด | 🟡 กลาง |
| **C-5** Auto Fallback Share | โล่งมาก ไม่มี axis cards | 🔴 สูง |

---

## Admin Reply Setup ที่มีอยู่แล้ว

### ตั้งค่าได้ผ่าน DB (ยังไม่มี UI)

| Table | ใช้ทำ | ตั้งค่า |
|-------|--------|---------|
| `oa_settings` | Welcome message text | key-value ใน DB |
| `keyword_rules` | Auto-reply keyword → text / flex | แก้ตรงใน DB |
| `campaigns.config` | copy.* สำหรับทุก card label/body | campaign config JSON |

### Copy Keys ที่ใช้ใน flex cards

```
result_eyebrow       — eyebrow บน result card ("คุณสองคนคือ")
result_share_cta     — CTA บน result trigger reply
intro_body           — body บน share trigger reply
intro_cta            — CTA บน share trigger reply ("เริ่มเลย")
share_invite_title   — title บน duo invite flex
share_invite_body1   — body line 1 บน duo invite flex
share_invite_body2   — body line 2 บน duo invite flex
share_cta            — CTA บน duo invite flex ("ตอบรับคำเชิญ")
group_join_cta       — CTA บน group invite flex
pair_invite_cta      — CTA บน pair result share flex
group_share_alt      — altText บน group result share
group_flex_sub       — subtitle บน group share widget
group_flex_need_more — text เมื่อยังขาดสมาชิก
```
