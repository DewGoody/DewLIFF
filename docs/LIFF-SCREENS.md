# LIFF Frontend — Screen Spec

ข้อมูลทั้งหมดสำหรับออกแบบหน้าจอ LIFF ของควิซคู่หู
เปิดใน LINE browser เท่านั้น (LIFF size = Full)

---

## Brand tokens (จาก config)

| Token | ค่า | ใช้ทำอะไร |
|-------|-----|-----------|
| `primary` | `#FF3D8B` | ปุ่ม CTA, accent |
| `surface` | `#1B1430` | พื้นหลังหลัก |
| `on_surface` | `#FFF3E4` | ตัวอักษรบน surface |

โลโก้: `brand.logo_url` (ถ้ามี) แสดงมุมบนซ้ายหรือกลางหน้า intro

> ค่าสีทุกตัวมาจาก config — ห้าม hardcode ลูกค้ารายถัดไปจะเปลี่ยน

---

## ภาพรวม flow

```
                    ┌──────────────┐
           ┌──────►│   Intro (A)  │──── เริ่มตอบ ────►┐
           │       └──────────────┘                   │
           │       ┌──────────────┐                   ▼
 เปิดด้วย  │       │  Invited (B) │──── ตอบเลย ──►┌──────────┐
 token ────┘       └──────────────┘               │ Question │
           │                                      │  1 → 5   │
           │       ┌──────────────┐               └────┬─────┘
           └──────►│   Error      │                    │
                   └──────────────┘          ┌─────────┼──────────┐
                                             ▼         ▼          ▼
                                        ┌────────┐ ┌────────┐ ┌────────┐
                                        │ Share  │ │Waiting │ │ Result │
                                        │(A ตอบ  │ │(A รอ B)│ │(B ตอบ  │
                                        │ เสร็จ)  │ │        │ │ ครบคู่) │
                                        └───┬────┘ └────────┘ └────────┘
                                            │
                                            ▼
                                       ┌─────────┐
                                       │ Waiting │
                                       │ (A รอ B) │
                                       └─────────┘
```

---

## 1. Intro — หน้าเริ่มเกม

**ใครเห็น:** ผู้เล่น A ที่เปิด LIFF โดยไม่มี token
**API call:** `GET /api/campaign/:id` → ได้ public config

### เนื้อหา (จาก `copy`)
- **หัวข้อ:** `intro_title` → "คู่หูสายไหน"
- **คำอธิบาย:** `intro_body` → "ตอบ 5 ข้อ แล้วส่งให้เพื่อนร่วมงานตอบ จะได้รู้ว่าทำงานด้วยกันแล้วเป็นคู่แบบไหน"

### ปุ่ม
- **CTA หลัก:** `intro_cta` → "เริ่มตอบ"
  - กด → `POST /api/quiz/start` → ไปหน้า Question 1
- **CTA รอง:** `demo_cta` → "ลองกับคู่หูตัวอย่าง"
  - กด → `POST /api/quiz/start` พร้อม `demo: true` → ไปหน้า Question 1

### Layout
- จัดกลาง, แนวตั้ง
- โลโก้ (ถ้ามี) → หัวข้อ → คำอธิบาย → CTA หลัก → CTA รอง
- พื้นหลัง `surface`, ตัวอักษร `on_surface`, ปุ่ม `primary`

### หมายเหตุ
- ปุ่ม demo ต้องเด่นพอให้เห็น แต่แยกออกจากปุ่มหลักชัดเจน (เช่น text button หรือ outline)
- ไม่ต้องแสดง friend gate ตรงนี้ — จะเช็กทีหลังตอนจะส่ง push

---

## 2. Invited — คนถูกชวน

**ใครเห็น:** ผู้เล่น B ที่เปิด LIFF ผ่าน share link ที่มี `?token=xxx`
**API call:** `POST /api/quiz/join` พร้อม token → ได้ public config

### เนื้อหา (จาก `copy`)
- **หัวข้อ:** `invited_title` → "{inviter} ชวนคุณมาตอบ"
  - `{inviter}` แทนด้วยชื่อ display name ของ A (backend ส่งมาให้)
- **คำอธิบาย:** `invited_body` → "ตอบ 5 ข้อ แล้วดูว่าคุณสองคนเป็นคู่หูแบบไหน"

### ปุ่ม
- **CTA:** `invited_cta` → "ตอบเลย"
  - กด → ไปหน้า Question 1

### Layout
- เหมือน Intro แต่ไม่มีปุ่ม demo
- อาจแสดงรูปโปรไฟล์ A ถ้ามี (เพิ่มความน่าเชื่อถือ)

---

## 3. Question — ตอบคำถาม (1 หน้าต่อข้อ)

**ใครเห็น:** ทั้ง A และ B
**ข้อมูลมาจาก:** `config.questions[]` ที่ได้ตอน start/join (เก็บใน client state)

### เนื้อหา
- **ตัวนับ:** `question_counter` → "ข้อ {current} จาก {total}" (เช่น "ข้อ 1 จาก 5")
- **คำถาม:** `question.text`
- **ตัวเลือก:** `question.options[]` แต่ละอันแสดง `option.label`

### พฤติกรรม
- กดตัวเลือก → เก็บคำตอบ `{questionId, optionId}` ใน local state
- เลื่อนไปข้อถัดไปอัตโนมัติ (มี transition animation สั้น ๆ)
- **ข้อสุดท้าย:** กดแล้ว → submit ทุกคำตอบพร้อมกัน `POST /api/quiz/answer`
- ระหว่างรอ response → แสดง loading

### Layout
- ตัวนับ อยู่บนสุด (เล็ก ๆ)
- คำถามอยู่กลางหน้า
- ตัวเลือก 2–4 อัน เรียงแนวตั้ง เป็นปุ่มเต็มความกว้าง
- ตัวเลือกที่กดแล้ว → highlight ด้วย `primary` ก่อน transition ไปข้อถัดไป
- **ไม่มีปุ่มย้อนกลับ** — เลือกแล้วเลือกเลย ลดความซับซ้อนและป้องกันเกม

### Progress indicator
- แถบบาง ๆ ด้านบน หรือ dots — แสดงว่าอยู่ข้อไหน
- เติมสี `primary` ตามจำนวนข้อที่ตอบแล้ว

---

## 4. Share — ส่งให้คู่หู

**ใครเห็น:** ผู้เล่น A หลังตอบครบ 5 ข้อ (เมื่อ response = `{status: 'waiting'}`)
**ไม่แสดงหน้านี้ถ้า:** เป็น demo mode หรือ pair เสร็จแล้ว

### เนื้อหา (จาก `copy`)
- **หัวข้อ:** `share_title` → "ส่งให้คู่หูตอบ"
- **คำอธิบาย:** `share_body` → "อีกคนตอบเสร็จเมื่อไหร่ เราจะส่งผลไปให้ทั้งคู่"

### ปุ่ม
- **CTA หลัก:** `share_cta` → "เลือกเพื่อนแล้วส่ง"
  - กด → เรียก `liff.shareTargetPicker()` พร้อม Flex Message ที่มี invite link
  - สำเร็จ → `POST /api/quiz/share` (log event) → ไปหน้า Waiting
  - ยกเลิก → อยู่หน้าเดิม ไม่ต้องทำอะไร

### Flex Message ที่ส่งผ่าน shareTargetPicker

```
┌─────────────────────────────┐
│  {ชื่อคนส่ง} ชวนคุณตอบ       │
│  ควิซคู่หู                    │
│                             │
│  ตอบ 5 ข้อ แล้วดูว่าเราสอง     │
│  คนทำงานด้วยกันแล้วเป็น       │
│  คู่แบบไหน                   │
│                             │
│  ┌─────────────────────┐    │
│  │     ตอบควิซ          │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

- ปุ่ม "ตอบควิซ" → URI action → `{LIFF_URL}?token={inviteToken}`
- ข้อความมาจาก `config.messages.invite.slots`

### Layout
- ไอคอน/ภาพแสดงความหมาย "ส่งให้เพื่อน" (เช่น paper plane)
- หัวข้อ → คำอธิบาย → ปุ่ม CTA

---

## 5. Waiting — รอคู่หูตอบ

**ใครเห็น:** ผู้เล่น A หลังแชร์สำเร็จ (หรือกดปิดหน้า Share)
**ไม่ต้อง poll** — A จะได้ push notification เมื่อ B ตอบเสร็จ

### เนื้อหา (จาก `copy`)
- **หัวข้อ:** `waiting_title` → "รอคู่หูตอบอยู่"
- **คำอธิบาย:** `waiting_body` → "ปิดหน้านี้ได้เลย พอเขาตอบเสร็จเราจะส่งข้อความไปบอก"

### ปุ่ม
- **CTA:** `waiting_close` → "ปิดหน้าต่าง"
  - กด → `liff.closeWindow()`

### Layout
- animation เบา ๆ (เช่น dots กระพริบ, pulse, hourglass) สื่อว่ากำลังรอ
- หัวข้อ → คำอธิบาย → ปุ่มปิด
- โทนสงบ ไม่เร่ง — คนจะปิดไปทำอย่างอื่น

---

## 6. Result — ผลลัพธ์

**ใครเห็น:**
- ผู้เล่น B ทันทีหลังตอบครบ (response = `{status: 'completed', result: ...}`)
- ผู้เล่น A เมื่อกด push notification กลับมา → `GET /api/pair/:pairId`

### เนื้อหา
- **Eyebrow:** `result_eyebrow` → "คุณสองคนคือ"
- **หัวข้อ:** `result.title` — เช่น "คู่หูสายไฟลุก"
- **คำอธิบาย:** `result.body` — เช่น "สองคนนี้เจอกันเมื่อไหร่..."
- **รูป:** `result.image_url` (ถ้ามี) — รูปประกอบผลลัพธ์

### ข้อมูลเสริม
- แสดง axis ของแต่ละคน: "คุณ: สายลุย / คู่หู: สายนิ่ง"
  - ดึงจาก response `axisMe` / `axisBuddy` → map กับ `config.axes[].label`

### ปุ่ม
- **CTA หลัก:** `result_share_cta` → "อวดผลให้คนอื่น"
  - กด → `liff.shareTargetPicker()` พร้อม Flex Message ที่โชว์ผลลัพธ์
- **CTA รอง:** `result_again_cta` → "ชวนอีกคน"
  - กด → กลับไปหน้า Intro เริ่ม pair ใหม่

### Layout
- เน้นสุด — นี่คือหน้าที่คนจะ screenshot แชร์
- รูป (ถ้ามี) ใหญ่ → eyebrow → หัวข้อ (ใหญ่สุดในหน้า) → body → axis tags → ปุ่ม
- พิจารณาใช้สีพื้นหลังที่ต่างจากหน้าอื่น เพื่อให้รู้สึกเหมือน "เฉลย"
- ต้อง screenshot-friendly: จัดให้เนื้อหาหลักอยู่ใน viewport เดียวไม่ต้อง scroll

---

## 7. Error states — หน้า error ต่าง ๆ

ทุกหน้าใช้ layout เดียวกัน: ไอคอน → หัวข้อ → คำอธิบาย → ปุ่ม (ถ้ามี)

| สถานการณ์ | หัวข้อ (copy key) | คำอธิบาย (copy key) | ปุ่ม |
|-----------|------------------|--------------------|----|
| Token หมดอายุ | `expired_title` "คำเชิญหมดอายุแล้ว" | `expired_body` "ลองขอให้เพื่อนส่งใหม่อีกครั้ง" | ปิดหน้าต่าง |
| Token ถูกใช้แล้ว | `used_title` "คำเชิญนี้ถูกใช้ไปแล้ว" | `used_body` "แต่ละคำเชิญตอบได้คนเดียว..." | ปิดหน้าต่าง |
| จับคู่กับตัวเอง | `self_pair_title` "จับคู่กับตัวเองไม่ได้" | `self_pair_body` "ส่งให้เพื่อนสักคน..." | ปิดหน้าต่าง |
| ครบโควตา | `limit_title` "วันนี้ครบโควตาแล้ว" | `limit_body` "พรุ่งนี้กลับมาชวน..." | ปิดหน้าต่าง |
| Error ทั่วไป | `error_title` "เปิดไม่สำเร็จ" | `error_body` "ลองปิดแล้วเปิดใหม่..." | ปิดหน้าต่าง |

### หมายเหตุ
- ปุ่มปิดทุกอัน → `liff.closeWindow()`
- แต่ละ error มาจาก HTTP status code ที่ต่างกัน:
  - 410 Gone → expired / used
  - 400 Bad Request → self_pair
  - 409 Conflict → limit
  - อื่น ๆ → error ทั่วไป

---

## 8. Friend Gate (popup/modal)

**เมื่อไหร่:** ก่อน share ถ้า `config.rules.require_friend === true` และ user ยังไม่ได้ add friend
**เช็กจาก:** `liff.getFriendship()` → `{friendFlag: boolean}`

### เนื้อหา (จาก `copy`)
- **หัวข้อ:** `friend_gate_title` → "เพิ่มเพื่อนก่อนดูผล"
- **คำอธิบาย:** `friend_gate_body` → "เราจะส่งผลลัพธ์ให้ทางแชท เลยต้องเป็นเพื่อนกันก่อน"

### พฤติกรรม
- แสดงเป็น bottom sheet หรือ modal
- มีปุ่ม "เพิ่มเพื่อน" → เปิด add friend URL หรือใช้ LIFF API
- หลัง add friend → ปิด modal แล้วดำเนินการต่อ

---

## 9. LIFF initialization flow

```
เปิด LIFF
  │
  ├─ liff.init()
  │
  ├─ liff.isLoggedIn()?
  │   ├─ ไม่ → liff.login() (redirect กลับมา)
  │   └─ ใช่ → ดึง id_token จาก liff.getIDToken()
  │
  ├─ ดู URL params
  │   ├─ มี ?token=xxx    → POST /api/quiz/join  → หน้า Invited
  │   ├─ มี ?pairId=xxx   → GET /api/pair/:id    → หน้า Result หรือ Waiting
  │   └─ ไม่มี            → GET /api/campaign/:id → หน้า Intro
  │
  └─ ทุก API call ส่ง header: Authorization: Bearer {id_token}
```

---

## 10. หมายเหตุสำหรับดีไซน์

**Viewport:**
- LIFF Full size = เต็มจอมือถือ
- Safe area: เลี่ยง notch/home indicator
- Target: 375×812 (iPhone X) เป็นหลัก

**Typography:**
- ข้อความทุกตัวมาจาก config — ดีไซน์ต้องรองรับความยาวที่ต่างกัน
- หัวข้อผลลัพธ์ยาวสุด 60 ตัวอักษร, body ยาวสุด 300

**Animation:**
- Question transition: slide หรือ fade สั้น ๆ (< 300ms)
- Waiting: subtle pulse/dots ไม่กวนตา
- Result reveal: อาจมี confetti หรือ scale-up เล็กน้อย

**Performance:**
- ทุก copy + questions โหลดมาพร้อมกันตอน start/join — ไม่ต้อง fetch ระหว่างตอบ
- ตอบ 5 ข้อส่งทีเดียว ไม่ส่งทีละข้อ

**สิ่งที่ไม่ต้องออกแบบตอนนี้:**
- หน้า admin/CMS (Phase 7)
- Dashboard (Phase 5)
- หน้า "ดูเบื้องหลัง" (Phase 6)
