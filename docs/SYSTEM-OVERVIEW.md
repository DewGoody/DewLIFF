# ลานกิจกรรม — System Overview

เอกสารนี้อธิบายการทำงานทั้งหมดของระบบ ใช้ประกอบการออกแบบหน้าจอ

อัปเดตล่าสุด: 16 สิงหาคม 2026

---

## 1. ภาพรวมระบบ

```
┌─ Admin Console (เว็บ) ──────────────────────────────────────────┐
│                                                                 │
│  Campaigns  →  Config Playground  →  Message Manager            │
│  Reply Designer  →  Rich Menu Manager  →  Dashboard             │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ API
                           ▼
┌─ Backend (Express + pg-boss) ───────────────────────────────────┐
│                                                                 │
│  Auth  →  Quiz Engine  →  Push/Reply  →  Webhook  →  Events    │
│                                                                 │
└──────────┬──────────────┬──────────────┬────────────────────────┘
           │              │              │
     ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
     │  Supabase  │  │  LINE   │  │  LIFF       │
     │  (Postgres) │  │  API    │  │  (browser   │
     │            │  │         │  │   ใน LINE)   │
     └────────────┘  └─────────┘  └─────────────┘
```

---

## 2. Admin Console — หน้าจอทั้งหมด

### 2.1 หน้า Campaigns (รายการแคมเปญ)

**URL:** `/admin.html`
**หน้าที่:** hub หลัก — เห็นทุก campaign, สถานะ, สร้างใหม่

```
┌─ Header ─────────────────────────────────────────────────┐
│  Krob · Host Console    Campaigns       [+ สร้าง Campaign] │
└──────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  🎯 คู่หูสายไหน                                     │
│  buddy_demo · จับคู่ · v1                    LIVE  │ →
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  🧠 MBTI Quiz                                      │
│  mbti_demo · เดี่ยว · v1                    DRAFT  │ →
└────────────────────────────────────────────────────┘

[ว่าง = "ยังไม่มี campaign"]
```

**สร้าง Campaign — Dialog:**
- ใส่ Campaign ID (lowercase + _ เท่านั้น)
- เลือก Mode: จับคู่ (pair) / เดี่ยว (solo)
- กดสร้าง → ได้ campaign พร้อม default config

**แต่ละ Campaign card แสดง:**
- Brand name (จาก config)
- Campaign ID
- Mode (จับคู่/เดี่ยว)
- Version ปัจจุบัน
- สถานะ: DRAFT / LIVE / ENDED

---

### 2.2 Config Playground (ตั้งค่าแคมเปญ)

**URL:** `/admin.html?id=buddy_demo`
**หน้าที่:** ตั้งค่าทุกอย่างของ campaign — คำถาม, แกน, ผลลัพธ์, brand, copy

**2 โหมด:** `ตั้งค่า` / `ลองเล่น`

#### โหมดตั้งค่า — Layout

```
┌─ Header ─────────────────────────────────────────────────────┐
│  [←] Krob · Host Console  Config  [buddy_demo] [pair] [LIVE] │
│                     [ตั้งค่า] [ลองเล่น]  [JSON] [Export] [Save] │
└──────────────────────────────────────────────────────────────┘

┌─ Sidebar (280px, sticky) ─┬─ Main ───────────────────────────┐
│                           │                                   │
│  ภาพรวม                    │  Step 1: ตั้งแกนบุคลิก             │
│  ┌───┬───┬───┐            │  [สายลุย ●] [สายนิ่ง ●] [+ เพิ่ม]  │
│  │ 3 │ 5 │ 6 │            │                                   │
│  │แกน│ถาม│ผล │            │  Step 2: เขียนคำถาม                │
│  └───┴───┴───┘            │  ┌─ ข้อ 1 ──────────────────────┐ │
│                           │  │ เช้าวันจันทร์...               │ │
│  Pair Matrix              │  │ ○ ลุยต่อทันที                  │ │
│  ● ● ●                    │  │   สายลุย  ●●○○○  +2           │ │
│  ● ● ●                    │  │   สายนิ่ง  ○○○○○   0           │ │
│  ● ● ●                    │  │ ○ หากาแฟก่อน                  │ │
│                           │  │   สายลุย  ○○○○○   0           │ │
│  ✓ พร้อมใช้งาน             │  │   สายนิ่ง  ●●○○○  +2           │ │
│                           │  └──────────────────────────────┘ │
│  [▶ ลองเล่น]              │                                   │
│                           │  Step 3: ตั้งผลลัพธ์                │
│                           │  ┌─ Grid ────┬─ Editor ──────┐   │
│                           │  │ลุย นิ่ง ละเอียด│ Title:       │   │
│                           │  │ ✅  ✅  ✅  │ [คู่หูสาย...]  │   │
│                           │  │ ──  ✅  ✅  │ Body:        │   │
│                           │  │ ──  ──  ✅  │ [สองคนนี้...] │   │
│                           │  └───────────┴──────────────┘   │
│                           │                                   │
│                           │  ⚙ ตั้งค่าเพิ่มเติม (collapsed)    │
│                           │  ├── 01 Brand (ชื่อ·โลโก้·สี)     │
│                           │  ├── 02 Copy (ข้อความทุกหน้าจอ)   │
│                           │  ├── 03 Rules (TTL·โควตา·friend)  │
│                           │  ├── 04 Messages (push template)  │
│                           │  └── 05 Chat Trigger              │
│                           │                                   │
└───────────────────────────┴───────────────────────────────────┘
```

#### Step 1: ตั้งแกนบุคลิก
- **Pair mode:** แกนอิสระ เช่น สายลุย, สายนิ่ง, สายละเอียด
- **Solo/MBTI mode:** แกนมี 2 ขั้ว (poles) เช่น E/I, S/N, T/F, J/P
- เพิ่ม/ลบ/แก้ได้ สีจาก palette อัตโนมัติ

#### Step 2: เขียนคำถาม
- แก้ข้อความ inline
- Score dots: กดวงกลมให้คะแนนแกน (1-5), กดซ้ำ = ล้าง
- Solo mode: scores เป็น +/- (บวก = ขั้วแรก, ลบ = ขั้วหลัง)
- ปุ่ม: ↑↓ สลับลำดับ, ⧉ ทำซ้ำ, ✕ ลบ
- badge: "scored" / "ยังไม่ให้คะแนน"

#### Step 3: ตั้งผลลัพธ์
- **Pair:** ตาราง grid แกน×แกน (ครึ่งบน สามเหลี่ยม) กดช่อง = เปิด editor
- **Solo:** 1 แกน = 1 ผลลัพธ์ / MBTI = 16 types (2⁴)
- Editor: Title, Body (300 ตัวอักษร), Image URL
- Fallback result สำหรับกรณีไม่ match

#### ⚙ ตั้งค่าเพิ่มเติม (Accordion)

| Section | Fields | ส่งผลตรงไหน |
|---------|--------|------------|
| **01 Brand** | name, logo_url, primary, surface, on_surface | LIFF ทุกหน้า + Flex Message |
| **02 Copy** | ข้อความ 22+ keys จัดกลุ่มตาม Intro/Question/Share/Waiting/Result/Error | LIFF ทุกหน้า |
| **03 Rules** | invite_ttl_hours, max_pairs_per_day, require_friend, allow_self_pair | Backend บังคับใช้ LIFF ไม่เห็น |
| **04 Messages** | invite (title/body/cta), partner_done (title/body/cta) | LINE chat (Flex Message) |
| **05 Chat Trigger** | enabled (bool), text (ข้อความที่ user เห็นใน chat) | LINE chat เมื่อเล่นเสร็จ |

แต่ละ field แสดง: key | input | "ส่งผลตรงไหน"
Color fields แสดง swatch + hex
Bool fields แสดง toggle pill (true/false)

#### โหมดลองเล่น

```
┌─ Phone (340×700) ──────────┬─ Panel (400px) ────────────────┐
│                            │                                │
│  หน้า Intro / Question /    │  Player A                     │
│  Wait / Result              │  สายลุย  ████████  8           │
│                            │  สายนิ่ง  ██░░░░░░  2           │
│  ใช้สีจาก brand config      │  แกนเด่น: สายลุย               │
│                            │                                │
│  เริ่มตอบ                   │  Player B                     │
│  ลองกับคู่หูตัวอย่าง         │  (จำลองคู่หู / ตอบเองเป็น B)    │
│                            │                                │
│                            │  ผลลัพธ์ที่ match               │
│                            │  fire_calm                     │
│                            │  คู่หูสายคันเร่งกับเบรก          │
│                            │                                │
└────────────────────────────┴────────────────────────────────┘
```

ปุ่มพิเศษ:
- "จำลองให้คู่หูตอบ" — auto buddy
- "ตอบเองเป็น B" — ตอบอีกรอบเป็น player B
- "เริ่มใหม่" — reset

#### JSON Drawer
- เปิดจากปุ่ม `{ } JSON` ใน header
- Panel ขวา 520px + overlay
- แสดง formatted JSON ของ campaign config
- Copy to clipboard

#### Save
- กด 💾 Save → PUT /api/admin/campaign/:id
- Validate ด้วย Zod schema
- Insert version ใหม่ (immutable) + bump current_version
- Clear cache → LIFF ครั้งถัดไปใช้ config ใหม่ทันที

---

### 2.3 Message Manager (จัดการ keyword + ข้อความต้อนรับ)

**URL:** `/messages.html`
**หน้าที่:** ตั้ง keyword auto-reply + welcome message
**UI คล้าย OA Manager:** หน้า "ตอบกลับอัตโนมัติ" → "ข้อความตอบกลับอัตโนมัติ"

```
┌─ Header ─────────────────────────────────────────────────┐
│  [←] Krob · Host Console   Message Manager               │
└──────────────────────────────────────────────────────────┘

┌─ ข้อความต้อนรับ ─────────────────────────────────────────┐
│  👋 ส่งอัตโนมัติเมื่อ user follow OA (ฟรี ไม่นับ quota)    │
│                                                          │
│  ┌──────────────────────────────────────┐                │
│  │ ยินดีต้อนรับ! 🎯                     │                │
│  │ พิมพ์ "ควิซ" เพื่อเริ่มเล่นควิซคู่หู    │                │
│  └──────────────────────────────────────┘                │
│  [แก้ข้อความ]                                            │
└──────────────────────────────────────────────────────────┘

┌─ Keyword Auto-Reply ─────────────────────────────────────┐
│  🔑 User พิมพ์ keyword → ตอบกลับอัตโนมัติ (ฟรี)           │
│                                                          │
│  ┌──────────┬───────────────┬───────────┬──────┬───┐    │
│  │ KEYWORD  │ ตอบด้วย        │ CAMPAIGN │ สถานะ │   │    │
│  ├──────────┼───────────────┼───────────┼──────┼───┤    │
│  │ ควิซ     │ 📋 Flex Card  │ buddy_demo│  ✅  │⏸✎✕│    │
│  │ quiz     │ 📋 Flex Card  │ buddy_demo│  ✅  │⏸✎✕│    │
│  │ คู่หู     │ 📋 Flex Card  │ buddy_demo│  ✅  │⏸✎✕│    │
│  │ mbti     │ 📋 Flex Card  │ mbti_demo │  ✅  │⏸✎✕│    │
│  │ สวัสดี    │ 💬 Text       │ —        │  ✅  │⏸✎✕│    │
│  │ เมนู     │ 💬 Text       │ —        │  ✅  │⏸✎✕│    │
│  └──────────┴───────────────┴───────────┴──────┴───┘    │
│  [+ เพิ่ม Keyword]                                       │
│                                                          │
│  ⚠️ keyword ซ้ำ → error "ถูกใช้แล้ว"                      │
└──────────────────────────────────────────────────────────┘

┌─ ทดสอบ Keyword ──────────────────────────────────────────┐
│  🔍 พิมพ์ข้อความทดสอบ ดูว่าจะตอบอะไร                       │
│  [ควิซ              ] [ทดสอบ]                             │
│                                                          │
│  ✅ match: "ควิซ" → Flex Card buddy_demo                  │
│  ┌──────────────────────┐                                │
│  │ คู่หูสายไหน            │                                │
│  │ ตอบ 5 ข้อ...          │                                │
│  │ [เริ่มตอบ]             │                                │
│  └──────────────────────┘                                │
└──────────────────────────────────────────────────────────┘
```

**เพิ่ม Keyword — Dialog:**
- Keyword input (1 keyword ต่อ 1 rule)
- ตอบด้วย: dropdown
  - 📋 Flex Card จาก Campaign → เลือก campaign
  - 💬 ข้อความ → พิมพ์ text
- Priority (สูง = match ก่อน)
- ตรวจซ้ำอัตโนมัติ

---

### 2.4 Reply Designer (ดู/แก้ข้อความตอบกลับทุก flow)

**URL:** `/replies.html?id=buddy_demo`
**หน้าที่:** เห็นทุกจุดที่ระบบส่งข้อความ + แก้ + preview
**UI คล้าย OA Manager:** หน้า "เมสเสจประเภทต่างๆ" แต่ผูกกับ flow

```
┌─ Header ─────────────────────────────────────────────────┐
│  [←] Krob · Host Console  Reply Designer [buddy_demo]    │
│                                  [Keyword Manager] [Save] │
└──────────────────────────────────────────────────────────┘

แต่ละ flow เป็น card พับได้:

┌─ 01 ข้อความต้อนรับ ──── Reply · ฟรี ──── › ──────────────┐
│  (พับ/กาง)                                                │
└──────────────────────────────────────────────────────────┘

┌─ 02 การ์ดชวนเพื่อน ──── ShareTargetPicker ──── › ────────┐
└──────────────────────────────────────────────────────────┘

┌─ 03 ผลลัพธ์ใน Chat ──── Reply · ฟรี ──── ▼ ─────────────┐
│                                                          │
│  ┌─ Trigger ─────────────────────────────────────┐       │
│  │ ✅ LIFF: ตอบครบข้อสุดท้าย + เห็นผลลัพธ์         │       │
│  │    LIFF ส่งข้อความแทน user → webhook จับ       │       │
│  │ ⚙️ ใช้ liff.sendMessages()                    │       │
│  └───────────────────────────────────────────────┘       │
│                                                          │
│  ┌─ Editor ──────────────┬─ Preview ─────────────┐      │
│  │ เปิดใช้งาน: [✅ เปิด]   │ ┌─ LINE Chat ──────┐│      │
│  │ ข้อความ: [✨ ฉันเล่น...]│ │ ✨ ฉันเล่นควิซ... ││      │
│  │ Eyebrow: [คุณสองคนคือ] │ │ ┌────────────┐  ││      │
│  │ CTA: [ชวนเพื่อนเล่น]   │ │ │คู่หูสายไฟลุก │  ││      │
│  │                       │ │ │[ชวนเพื่อนเล่น]│  ││      │
│  │                       │ │ └────────────┘  ││      │
│  └───────────────────────┴─└─────────────────┘┘      │
└──────────────────────────────────────────────────────────┘

┌─ 04 แจ้งคู่หูตอบแล้ว ──── Push · นับ quota ──── › ───────┐
└──────────────────────────────────────────────────────────┘

┌─ 05 Keyword → Campaign Card ──── Reply · ฟรี ──── ▼ ─────┐
│                                                          │
│  ┌─ Trigger ─────────────────────────────────────┐       │
│  │ ⌨️ User พิมพ์ keyword ใน chat ของ OA           │       │
│  └───────────────────────────────────────────────┘       │
│                                                          │
│  ┌─ Keywords ที่ผูก ─────────────────────────────┐       │
│  │ ✅ ควิซ   ✅ quiz   ✅ คู่หู   [+ จัดการ keyword] │       │
│  └───────────────────────────────────────────────┘       │
│                                                          │
│  Editor + Preview...                                     │
└──────────────────────────────────────────────────────────┘

┌─ 06 แชร์ผลลัพธ์ ──── ShareTargetPicker ──── › ───────────┐
└──────────────────────────────────────────────────────────┘
```

**ทุก flow แสดง:**
- **Trigger** — อะไรทำให้ส่ง (action บน LIFF / webhook event)
- **Keywords** — keyword ที่ผูกอยู่ (ถ้ามี)
- **Editor** — แก้ข้อความ/ปุ่ม
- **Preview** — เห็นหน้าตาใน LINE chat แบบ realtime
- **Badge** — ฟรี (Reply/ShareTargetPicker) หรือนับ quota (Push)

---

### 2.5 Rich Menu Manager (ยังไม่ได้ทำ)

**URL:** `/menus.html`
**หน้าที่:** สร้าง/จัดการ Rich Menu หลายตัว + สลับตาม user state
**UI คล้าย OA Manager:** หน้า "ริชเมนู" แต่มีหลายตัว + auto-switch

```
┌─ Header ─────────────────────────────────────────────────┐
│  [←] Krob · Host Console   Rich Menu Manager             │
│                                        [+ สร้าง Rich Menu] │
└──────────────────────────────────────────────────────────┘

┌─ Rich Menu List ─────────────────────────────────────────┐
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │ 📋 เมนูหลัก (default)                          │      │
│  │ ใช้กับ: user ทั่วไป                    [แก้ไข]  │      │
│  │ ┌──────┬──────┐                                │      │
│  │ │ เล่น  │ ดู   │  ← preview ย่อ                 │      │
│  │ │ ควิซ  │ ผล   │                                │      │
│  │ └──────┴──────┘                                │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │ 📋 เมนูหลังเล่นเสร็จ                           │      │
│  │ ใช้กับ: user ที่เล่นเสร็จแล้ว            [แก้ไข]  │      │
│  │ ┌──────┬──────┐                                │      │
│  │ │ ดูผล  │ ชวน  │                                │      │
│  │ │ ลัพธ์  │ เพื่อน │                                │      │
│  │ └──────┴──────┘                                │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ Auto-Switch Rules ──────────────────────────────────────┐
│                                                          │
│  เมื่อ              │ เปลี่ยนเป็น                         │
│  ─────────────────┼──────────────────────               │
│  Follow OA        │ เมนูหลัก (default)                   │
│  เล่นควิซเสร็จ      │ เมนูหลังเล่นเสร็จ                    │
│  ทุก campaign เสร็จ │ เมนูรอกิจกรรมใหม่                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**แก้ Rich Menu:**
- อัปโหลดรูป (2500×843 หรือ 2500×1686)
- เลือก template (กี่ช่อง: 1-6)
- ตั้ง action ต่อช่อง:
  - URL → เปิด LIFF / เว็บ
  - Text → ส่งข้อความ (จับ keyword ได้)
  - Postback → ส่ง data กลับ webhook

---

### 2.6 Message Library (ยังไม่ได้ทำ)

**URL:** `/library.html`
**หน้าที่:** สร้าง/เก็บ message template ทุกประเภท เพื่อเอาไปใช้ในจุดต่าง ๆ
**UI คล้าย OA Manager:** หน้า "เมสเสจประเภทต่างๆ" → "ริชเมสเสจ" / "การ์ดเมสเสจ"

```
┌─ Header ─────────────────────────────────────────────────┐
│  [←] Krob · Host Console   Message Library               │
│                                    [+ สร้างข้อความใหม่]    │
└──────────────────────────────────────────────────────────┘

┌─ Filter ─────────────────────────────────────────────────┐
│  [ทั้งหมด] [💬 Text] [📋 Flex] [🗺️ Imagemap] [🖼️ Image]  │
└──────────────────────────────────────────────────────────┘

┌──────┬──────────────┬──────────┬──────────┬─────────────┐
│ ID   │ Preview      │ ชื่อ      │ ประเภท    │ ใช้ในจุด     │
├──────┼──────────────┼──────────┼──────────┼─────────────┤
│ 001  │ [card]       │ แนะนำควิซ │ 📋 Flex  │ Keyword     │
│ 002  │ [card]       │ ผลลัพธ์   │ 📋 auto  │ Chat Trigger│
│ 003  │ [image]      │ เมนูหลัก  │ 🗺️ Imap  │ Rich Menu   │
│ 004  │ สวัสดี! 🎯   │ ต้อนรับ   │ 💬 Text  │ Welcome     │
└──────┴──────────────┴──────────┴──────────┴─────────────┘
```

**สร้างข้อความ — เลือกประเภท:**

| ประเภท | สิ่งที่ตั้ง | ส่งผ่าน API |
|--------|-----------|-----------|
| 💬 Text | พิมพ์ข้อความ | ✅ |
| 🖼️ Image | URL รูป + alt text | ✅ |
| 📋 Flex Card | Title, Body, Image, Buttons, สี | ✅ |
| 🗺️ Imagemap | รูปพื้นหลัง + กำหนดพื้นที่กด (เหมือน Rich Message) | ✅ |
| 📹 Video | URL วิดีโอ + preview image | ✅ |

---

### 2.7 Dashboard (ยังไม่ได้ทำ — Phase 5)

**URL:** `/dashboard.html`
**หน้าที่:** ดูข้อมูลกิจกรรมสด — กี่คนเล่น, กี่คู่, กี่ share, follow/unfollow

```
┌─ ตัวเลขรวม ──────────────────────────────────────────────┐
│  👤 Users    🎯 Pairs    📤 Shares    👥 Follows          │
│  127        89          234          112                 │
└──────────────────────────────────────────────────────────┘

┌─ Timeline ───────────────────────────────────────────────┐
│  กราฟเส้น: events ต่อชั่วโมง/วัน                           │
└──────────────────────────────────────────────────────────┘

┌─ ผลลัพธ์ยอดนิยม ─────────────────────────────────────────┐
│  🔥 คู่หูสายไฟลุก        34 คู่ (38%)                      │
│  ⚡ คู่หูสายคันเร่ง       21 คู่ (24%)                      │
│  🧊 คู่หูสายนิ่งคูณสอง    18 คู่ (20%)                      │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

---

## 3. LIFF Frontend — หน้าจอทั้งหมด

**เปิดใน LINE browser (LIFF Full)**
**URL pattern:** `/quiz/{campaignId}`

### 3.1 Flow — Pair Mode

```
เปิด LIFF (ไม่มี token)          เปิด LIFF (มี ?token=xxx)
       │                               │
       ▼                               ▼
   Intro (A)                    Friend Gate (B)
       │                           (ถ้ายังไม่ add friend)
       ├── เริ่มตอบ                     │
       ├── ลองกับคู่หูตัวอย่าง            ▼
       │                          Invited (B)
       ▼                               │
   Question (1→5)                      ▼
       │                          Question (1→5)
       ├── pair: ไปหน้า Share           │
       └── demo: ไปหน้า Result          ▼
             ▼                    Result (B)
         Share (A)                + Flex Card เข้า chat
             │
             ▼
         Waiting (A)
             │
     (B ตอบเสร็จ → push)
             │
             ▼
         Result (A)
         + Flex Card เข้า chat


เปิด LIFF (มี ?pairId=xxx)
       │
       ▼
   Result / Waiting
   (ขึ้นอยู่กับ pair status)
```

### 3.2 Flow — Solo Mode

```
เปิด LIFF
    │
    ▼
Intro (ไม่มีปุ่ม demo)
    │
    ▼
Question (1→5)
    │
    ▼
Result + Flex Card เข้า chat
(เห็นผลทันที ไม่ต้องรอใคร)
```

### 3.3 หน้าจอแต่ละหน้า

| หน้า | เมื่อไหร่ | เนื้อหา | ข้อมูลจาก |
|------|----------|---------|----------|
| **Loading** | เปิด LIFF | spinner + "กำลังเตรียม..." | — |
| **Intro** | A เปิดตรง (ไม่มี token) | title, body, CTA, demo button | `config.copy` |
| **Invited** | B เปิดจาก share link | avatar A + "{name} ชวนคุณ" | `config.copy` + inviter name |
| **Friend Gate** | B ยังไม่ add friend | "เพิ่มเพื่อนก่อนเริ่ม" + ปุ่ม | `config.copy` |
| **Question** | ทั้ง A+B ตอบ | progress bar + dots + text + options | `config.questions` |
| **Share** | A ตอบเสร็จ (pair) | share icon + Flex preview + CTA | `config.copy` + `messages.invite` |
| **Waiting** | A หลัง share | pulse animation + "ปิดได้เลย" | `config.copy` |
| **Result** | ทั้งคู่ตอบเสร็จ | image + eyebrow + title + body + axis tags | `result` from API |
| **Error** | ผิดพลาด | icon + title + body | `config.copy` (5 variants) |

### 3.4 Error States

| สถานการณ์ | HTTP | copy key |
|-----------|------|----------|
| Token หมดอายุ | 410 | `expired_title` / `expired_body` |
| Token ถูกใช้แล้ว | 410 | `used_title` / `used_body` |
| จับคู่กับตัวเอง | 400 | `self_pair_title` / `self_pair_body` |
| ครบโควตา | 409 | `limit_title` / `limit_body` |
| Error ทั่วไป | 5xx | `error_title` / `error_body` |

---

## 4. Backend — API ทั้งหมด

### 4.1 Public APIs (LIFF เรียก)

| Method | Path | Auth | หน้าที่ |
|--------|------|------|---------|
| GET | `/api/campaign/:id` | LINE ID token | โหลด public config |
| POST | `/api/quiz/start` | LINE ID token | สร้าง pair + invite token |
| POST | `/api/quiz/join` | LINE ID token | B เข้า pair ด้วย token |
| POST | `/api/quiz/answer` | LINE ID token | ส่งคำตอบ + resolve ถ้าครบ |
| POST | `/api/quiz/share` | LINE ID token | log share event |
| GET | `/api/pair/:pairId` | LINE ID token | ดูสถานะ/ผลลัพธ์ |
| POST | `/api/solo/start` | LINE ID token | สร้าง solo session |
| POST | `/api/solo/answer` | LINE ID token | ส่งคำตอบ + resolve ทันที |

### 4.2 Admin APIs

| Method | Path | หน้าที่ |
|--------|------|---------|
| GET | `/api/admin/campaigns` | list ทุก campaign |
| POST | `/api/admin/campaigns` | สร้าง campaign ใหม่ |
| GET | `/api/admin/campaign/:id` | โหลด config |
| PUT | `/api/admin/campaign/:id` | save config (new version) |
| PUT | `/api/admin/campaign/:id/status` | เปลี่ยนสถานะ |

### 4.3 Message APIs

| Method | Path | หน้าที่ |
|--------|------|---------|
| GET | `/api/admin/messages/keywords` | list keyword rules |
| POST | `/api/admin/messages/keywords` | เพิ่ม keyword |
| PUT | `/api/admin/messages/keywords/:id` | แก้ keyword |
| DELETE | `/api/admin/messages/keywords/:id` | ลบ keyword |
| GET | `/api/admin/messages/settings` | โหลด OA settings |
| PUT | `/api/admin/messages/settings/:key` | แก้ setting |
| GET | `/api/admin/messages/preview?text=` | ทดสอบ keyword match |

### 4.4 Webhook

| Method | Path | หน้าที่ |
|--------|------|---------|
| POST | `/api/webhook/line` | รับ LINE events (follow/unfollow/message) |

### 4.5 Static files

| Path | ไฟล์ |
|------|------|
| `/` | LIFF frontend (index.html) |
| `/quiz/:campaignId` | LIFF frontend (route by campaign) |
| `/admin.html` | Admin Console |
| `/messages.html` | Message Manager |
| `/replies.html` | Reply Designer |

---

## 5. ข้อความที่ส่งในแต่ละจุด

### 5.1 Reply Message (ฟรี ไม่นับ quota)

ใช้ `replyToken` จาก webhook event — ต้องตอบภายใน 1 นาที

| จุด | Trigger | ตอบด้วย |
|-----|---------|---------|
| Welcome | `follow` event | 💬 Text (จาก oa_settings) |
| Keyword match | `message` event (text) | 📋 Flex Card หรือ 💬 Text (จาก keyword_rules) |
| Chat Trigger result | `message` event (จาก liff.sendMessages) | 📋 Flex Card ผลลัพธ์ |

### 5.2 Push Message (นับ quota)

ส่งเมื่อไหร่ก็ได้ ไม่ต้องมี event

| จุด | Trigger | ส่งอะไร |
|-----|---------|---------|
| Partner done | B ตอบเสร็จ (queue job) | 📋 Flex Card "คู่หูตอบแล้ว มาดูผล" |
| Result card | เล่นเสร็จ (pair + solo) | 📋 Flex Card ผลลัพธ์เข้า chat |

### 5.3 ShareTargetPicker (ส่งในนาม user)

| จุด | Trigger | ส่งอะไร |
|-----|---------|---------|
| Invite | A กดปุ่ม "เลือกเพื่อนแล้วส่ง" | 📋 Flex Card ชวนตอบควิซ |
| Share result | A กดปุ่ม "อวดผลให้คนอื่น" | 📋 Flex Card ผลลัพธ์ |

### 5.4 liff.sendMessages (ส่งเข้า OA chat ในนาม user)

| จุด | Trigger | ส่งอะไร | แล้วยังไง |
|-----|---------|---------|----------|
| Chat Trigger | เล่นเสร็จเห็นผลบน LIFF | 💬 Text ข้อความ + #ref:id | webhook จับ → reply Flex Card ผลลัพธ์กลับ (ฟรี) |

---

## 6. Database — Tables

| Table | หน้าที่ | Rows ต่อ |
|-------|---------|---------|
| `users` | LINE user ที่เข้าระบบ | ต่อ user |
| `campaigns` | รายการ campaign | ต่อ campaign |
| `campaign_versions` | config แต่ละ version (immutable) | ต่อ version |
| `pairs` | pair/session ของการเล่น | ต่อครั้งเล่น |
| `answers` | คำตอบแต่ละข้อ | ต่อข้อ × user |
| `invite_tokens` | token สำหรับชวนเพื่อน (hash only) | ต่อ pair |
| `events` | log ทุก action | ต่อ event |
| `webhook_seen` | dedup webhook | ต่อ webhook |
| `keyword_rules` | keyword → auto-reply | ต่อ keyword |
| `oa_settings` | ตั้งค่า OA (welcome message ฯลฯ) | ต่อ key |

---

## 7. Queue Jobs (pg-boss)

| Job | Trigger | ทำอะไร | Retry |
|-----|---------|--------|-------|
| `push-notification` | B ตอบเสร็จ | Push Flex "คู่หูตอบแล้ว" หา A | 3 ครั้ง |
| `expire-pairs` | Cron ทุกชั่วโมง | UPDATE pairs waiting → expired | — |

---

## 8. LINE Setup ที่ต้องมี

```
Provider: CODERA
├── Messaging API channel (OA)
│   ├── Channel Secret → LINE_CHANNEL_SECRET
│   ├── Channel Access Token (long-lived) → LINE_CHANNEL_ACCESS_TOKEN
│   ├── Webhook URL → https://{domain}/api/webhook/line
│   └── Response settings: Bot mode, Webhooks ON, Auto-response OFF
│
└── LINE Login channel (Codera Solutions)
    ├── Channel ID → LINE_CHANNEL_ID
    ├── Status: Published
    └── LIFF apps
        ├── Buddy Quiz (Full, openid+profile+chat_message.write)
        ├── MBTI (Full, ...) — อนาคต
        └── ... (ได้ถึง 30 ตัว)
```

---

## 9. Environment Variables

```env
PORT=8080
NODE_ENV=production

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# LINE
LINE_CHANNEL_ID=2011037337
LINE_CHANNEL_SECRET=3f2d...
LINE_CHANNEL_ACCESS_TOKEN=iB3m...
LINE_API_BASE=https://api.line.me

# App
LIFF_URL=https://liff.line.me/2011037337-KlqFK4LM
ALLOWED_ORIGINS=https://liff.line.me
```

---

## 10. Navigation ระหว่างหน้า Admin

```
                    ┌──────────────┐
                    │  Campaigns   │ ← hub หลัก
                    │  /admin.html │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  Config    │ │  Messages  │ │  Replies   │
     │ Playground │ │  Manager   │ │  Designer  │
     │ ?id=xxx   │ │            │ │ ?id=xxx    │
     └────────────┘ └────────────┘ └────────────┘
                                         │
                                         ▼
                                  ┌────────────┐
                                  │ Rich Menu  │
                                  │  Manager   │ (ยังไม่ได้ทำ)
                                  └────────────┘
                                         │
                                         ▼
                                  ┌────────────┐
                                  │ Dashboard  │ (ยังไม่ได้ทำ)
                                  └────────────┘
```

ลิงก์ข้ามหน้า:
- Campaign card → Config Playground (`?id=xxx`)
- Config header ← → Campaigns
- Config header → Reply Designer
- Reply Designer → Keyword Manager
- Keyword Manager ← → Reply Designer
