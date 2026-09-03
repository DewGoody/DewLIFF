# Flex Card Structures — Hardcoded Event Map
## ทุก flex card · โครงสร้าง · แหล่งข้อมูล · สถานะ asset

---

## แผนการ implement

**Phase 1 (ทำก่อน) — LIFF → Chat (shareTargetPicker)**
> ผู้ใช้กดปุ่ม → LIFF สร้าง flex → ส่งเข้าแชท LINE เอง

| ลำดับ | Card | trigger |
|-------|------|---------|
| 1 | **F-01** ลิงก์ชวนเพื่อน | ปุ่ม "ชวนเพื่อน" ใน Share tab |
| 2 | **F-02** การ์ดผู้รอดชีวิต | ปุ่ม "แชร์ผลเดี่ยว" ใน Summary |
| 3 | **F-10** ชวนเข้าทีม | ปุ่ม "ชวนเข้าทีม" ใน Share tab / Group |
| 4 | **F-03** ผลกลุ่ม | ปุ่ม "แชร์ผลกลุ่ม" ใน Group screen |

**Phase 2 — Backend → OA Push**
> event เกิด → backend build flex → push ผ่าน LINE Bot API

| ลำดับ | Card | trigger event |
|-------|------|---------------|
| 5 | **F-04** เพื่อนตอบแล้ว | Q-2: pair_matched → push A |
| 6 | **F-05** ผลคู่ | Q-2: pair_matched → push A & B |
| 7 | **F-08** ปลดล็อกสัญลักษณ์ | Q-5: group_shared → push sharer |
| 8 | **F-06** เตือนจัดทีม | C-1: cron 48h → push user |

---

## ระบบ ↔ LIFF สัมพันธ์กันยังไงในส่วนนี้

```
                    ┌──────────────────────────────────────────┐
                    │  Campaign Config (Supabase DB)            │
                    │                                           │
                    │  assets (upload ครั้งเดียว):              │
                    │   • axes[].image_url     (axis cards)     │
                    │   • results[].image_url  (pair results)   │
                    │   • archetypes[].image_url (group symbol) │
                    │   • appearance.images.kv-intro            │
                    │   • appearance.liff_id                    │
                    │   • brand.primary  (accent color)         │
                    │   • copy.*         (text ทุก slot)         │
                    └──────────────────┬───────────────────────┘
                                       │  GET /config/:cid
                           ┌───────────┼───────────┐
                           ▼           ▼           ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │  LIFF    │ │ Backend  │ │  Admin   │
                    │ (React)  │ │  (API)   │ │   UI     │
                    └────┬─────┘ └────┬─────┘ └──────────┘
                         │            │
              build flex │            │ build flex
              (Phase 1)  │            │ (Phase 2)
                         │            │
                    shareTargetPicker │ pushMessage()
                         │            │
                         ▼            ▼
                    ┌──────────────────────┐
                    │    LINE Chat         │
                    └──────────────────────┘
```

**กฎ:** LIFF และ Backend อ่าน config เดียวกัน → asset เดียวกัน
- LIFF อ่านผ่าน `GET /api/config/:cid` → `toPublicConfig()`
- Backend อ่านผ่าน `getConfig()` โดยตรง

---

## Asset slots ที่มีใน Config ตอนนี้ (schema)

| slot | schema path | ใช้ใน flex |
|------|------------|-----------|
| Axis card image | `axes[].image_url` | F-02, F-04, F-05 hero, F-10 slots |
| Pair result image | `results[].image_url` | (ยังไม่ได้ใช้ใน flex — ใช้ใน LIFF เท่านั้น) |
| Group archetype image | `group.archetypes[].image_url` | F-03 hero, F-08 hero |
| KV intro image | `appearance.images['kv-intro']` | F-01 hero |
| Named images (free slots) | `appearance.images['{key}']` | ใส่อะไรก็ได้ |
| Brand color | `brand.primary` | ทุก CTA button |
| LIFF ID | `appearance.liff_id` | ทุก button URL |
| Copy text | `copy['{key}']` | ทุก text slot |

---

## สิ่งที่ยังขาดในฝั่ง Config / Admin UI

| ขาด | ทำไมต้องการ | แนวทาง |
|-----|------------|--------|
| **Symbol image แยกจาก archetype image** | F-08 ใช้ภาพ symbol (icon เล็ก บน yellow bg) แต่ `archetype.image_url` ถูกใช้เป็น hero ขนาดใหญ่ด้วย — อาจเป็นภาพคนละแบบ | เพิ่ม `symbol_url` ใน GroupArchetype schema |
| **Admin UI สำหรับ upload appearance.images** | ตอนนี้ต้องแก้ JSON ตรง ไม่มี UI อัปโหลด KV image | เพิ่ม image uploader ใน admin Appearance tab |
| **Pair result page image** | `results[].image_url` มีใน schema แต่ admin ยังไม่มี UI upload | เพิ่ม image upload ใน Results section |
| **F-05 hero (2 cards ±8°)** | ต้อง server-render ก่อน เพราะ Flex หมุน image ไม่ได้ | `GET /api/og?type=pair-hero&a={axisId}&b={axisId}` → PNG → ใช้เป็น hero image URL |

---

## โครงสร้าง Flex Card แต่ละใบ (Hardcoded)

---

### F-01 — ลิงก์ชวนเพื่อน
**ส่งจาก:** LIFF (shareTargetPicker) · **size:** mega · **trigger:** S-1

```
bubble
├── hero
│   └── image: appearance.images['kv-intro']
│              aspectRatio: 20:13, mode: cover
├── body
│   ├── badge:  "DUO QUIZ · 6 ข้อ"  [yellow pill]
│   ├── title:  copy['F01_title']   — "โลกแตกแล้ว เราสองคนรอดด้วยกันกี่วัน?"
│   ├── body1:  copy['F01_body1']   — "ตอบ 6 ข้อใน 1 นาที รู้สายเอาตัวรอดของคุณ"
│   └── body2:  copy['F01_body2']   — "แล้วระบบจะจับคู่ผลกับ {inviterName} ให้ทันที"
└── footer
    ├── btn1 [primary]:   "เริ่มตอบ · 1 นาที"  → liff_url?cid={cid}&inv={userId}
    └── btn2 [secondary]: "ดูแคมเปญก่อน"       → liff_url?cid={cid}

altText: "{inviterName}ชวนคุณเล่น DUO QUIZ — โลกแตกแล้วเราสองคนรอดกี่วัน"

dynamic params จาก LIFF:
  userId      (ของคนส่ง — เป็น inviter)
  inviterName (display name ของคนส่ง)
  cid         (campaignId)
```

---

### F-02 — การ์ดผู้รอดชีวิต (solo share)
**ส่งจาก:** LIFF (shareTargetPicker) · **size:** mega · **trigger:** S-2

```
bubble
├── hero
│   ├── background: #F5E14B  [hardcoded]
│   └── axis card image: axes[axisId].image_url  (centered, contain)
├── body
│   ├── eyebrow: copy['F02_eyebrow'] — "สายของฉันคือ"
│   ├── title:   axes[axisId].label
│   └── body:    axes[axisId].body
└── footer
    ├── btn1 [primary]:   "เล่นดูว่าคุณสายไหน"  → liff_url?cid={cid}
    └── btn2 [secondary]: "ดูผลคู่กับฉัน"       → liff_url?cid={cid}&inv={userId}

altText: "ผลของฉัน: {axisLabel} — มาดูว่าคุณสายไหน"

dynamic params จาก LIFF:
  axisId      (dominant axis ของ user)
  userId      (ของคนส่ง)
  cid
```

---

### F-03 — ผลกลุ่ม / ปลดล็อกสัญลักษณ์
**ส่งจาก:** LIFF (shareTargetPicker) · **size:** mega · **trigger:** S-3

```
bubble
├── hero
│   └── image: archetype.image_url
│              aspectRatio: 20:13, mode: cover
├── body
│   ├── eyebrow: "ทีมนี้เป็นสาย"
│   ├── title:   archetype.title
│   ├── survival: archetype.primary_text  (large bold)
│   ├── body:    archetype.body
│   └── fan cards row (max 5, horizontal):
│         members[].axisId → axes[id].image_url  (38×52px each)
└── footer
    └── btn1 [primary]: "จัดทีมของคุณเอง" → liff_url?cid={cid}&view=summary

altText: "ทีมของฉันคือ {archetypeTitle} รอด {survival}"

dynamic params จาก LIFF:
  groupId     → backend ดึง archetype + members ให้เอง
  cid
```

---

### F-04 — เพื่อนตอบแล้ว → A
**ส่งจาก:** Backend (OA Push) · **size:** kilo · **trigger:** Q-2 → push A

```
bubble  [kilo — ไม่มี hero]
├── body  (layout: horizontal)
│   ├── left:  axes[partnerAxisId].image_url  (52×70px)
│   └── right: (layout: vertical)
│       ├── eyebrow: "เพื่อนใหม่ในรายชื่อ"
│       ├── title:   "{partnerName} ตอบจบแล้ว"
│       └── subtitle: "{partnerAxisLabel} · หยิบเข้าทีมได้เลย"
└── footer
    └── btn1 [primary]: "ดูผลคู่ + จัดทีม" → liff_url?cid={cid}&pid={pairId}&view=pair

altText: "{partnerName}ตอบแล้ว — ผลคู่ของคุณพร้อมดู"

dynamic data (backend มีครบจาก pair event):
  partnerName, partnerAxisId, partnerAxisLabel, pairId, cid
```

---

### F-05 — ผลคู่ → A และ B
**ส่งจาก:** Backend (OA Push) · **size:** mega · **trigger:** Q-2 → push ทั้งคู่

```
bubble
├── hero
│   └── image: /api/og?type=pair-hero&a={axisIdA}&b={axisIdB}
│              [server-render: 2 cards ±8°, yellow bg]
│              aspectRatio: 20:13, mode: cover
├── body
│   ├── eyebrow: "คู่นี้รอดได้"
│   ├── title:   result.primary_text  (large — "8 เดือน")
│   ├── rank:    "อันดับ {rank} จาก {totalPairs} คู่"  [sm, gray]
│   └── body:    result.body
└── footer
    ├── btn1 [primary]:   "ดูผลคู่แบบเต็ม"  → liff_url?cid={cid}&pid={pairId}&view=pair
    └── btn2 [secondary]: "ชวนคนต่อไป"       → liff_url?cid={cid}&inv={myUserId}

altText: "คุณกับ{buddyName}รอดด้วยกัน{survival}"

หมายเหตุ: ส่งการ์ดเดียวกันให้ทั้ง A และ B แต่สลับ:
  → A ได้: myUserId=A, buddyName=B's name
  → B ได้: myUserId=B, buddyName=A's name

dynamic data (backend มีครบ):
  axisIdA, axisIdB, result.primary_text, result.body
  rank, totalPairs, pairId, cid
  myUserId, buddyName (สลับตาม recipient)
```

---

### F-06 — เตือนกลับมาจัดทีม
**ส่งจาก:** Backend (Scheduled Push) · **size:** kilo · **trigger:** C-1 (cron 48h)

```
bubble  [kilo]
├── body
│   ├── eyebrow: "ทีมของคุณยังไม่ครบ"
│   ├── title:   "มี {pendingCount} คนรออยู่ในรายชื่อ"
│   ├── subtitle: "ครบ 5 สายจะได้ {bestArchetypeTitle} ที่รอดนานสุด"
│   ├── hint:    "ตอนนี้ยังขาดสาย {missingAxisLabel}"
│   └── axis slots bar (5 ช่อง horizontal):
│         filled = existing member axes  [colored boxes]
│         empty  = remaining slots       [dashed ? box]
└── footer
    └── btn1 [primary]: "กลับไปจัดทีม" → liff_url?cid={cid}&view=summary

altText: "มีเพื่อน {count} คนรอเข้าทีมคุณอยู่ — ไปจัดทีมกัน"

dynamic data (cron query):
  pendingCount    (pairs ที่ยังไม่อยู่ในกลุ่ม)
  existingAxes[]  (axes ที่มีแล้วในรายชื่อ)
  missingAxisLabel (axis ที่ยังขาด)
  bestArchetypeTitle (archetype ที่ได้ถ้าครบ 5 สาย)
  cid
```

---

### F-08 — ปลดล็อกสัญลักษณ์ใหม่
**ส่งจาก:** Backend (OA Push) · **size:** kilo · **trigger:** Q-5 (shareGroup สำเร็จ)

```
bubble  [kilo]
├── hero
│   ├── background: #F5E14B  [hardcoded]
│   └── image: archetype.symbol_url || archetype.image_url  (96px, contain)
├── body
│   ├── eyebrow:  "ดวงใหม่รอบนี้"
│   ├── title:    archetype.title
│   ├── progress: "สะสมแล้ว {collected}/{total} ดวง · เหลือ {remaining}"
│   └── dots row: filled=red ●  empty=dark ●  (total dots = total archetypes)
└── footer
    └── btn1 [secondary]: "ดูสัญลักษณ์ที่เหลือ" → liff_url?cid={cid}&view=summary&tab=symbols

altText: "ปลดล็อกสัญลักษณ์ {archetypeTitle} แล้ว {collected}/{total}"

dynamic data:
  archetypeCode   → ดึง title + image จาก config
  collected       (จำนวน archetype ที่ user ปลดล็อกแล้ว)
  total           (จำนวน archetype ทั้งหมดใน campaign)
  cid
```

---

### F-10 — ชวนเข้าทีม (Team Board)
**ส่งจาก:** LIFF (shareTargetPicker) · **size:** mega · **trigger:** S-4

```
bubble
├── body section 1  [team board]
│   ├── header-left:  "ทีมนี้มีที่ว่าง"  [accent, small]
│   ├── header-right: "{filled} / {max} คน"
│   └── member slots row (max 5 ช่อง):
│         filled slot: axis card image + name (9px bold)
│         empty slot:  dashed border + "?"
│
├── body section 2  [archetype info]
│   ├── archetype icon:  archetype.image_url  (44×44px)
│   ├── archetype title: archetype.title
│   ├── status:          "ผลชั่วคราวจาก {count} คน"  หรือ "ทีมครบแล้ว"
│   ├── survival:        archetype.primary_text  (large, accent)
│   ├── progress bar:    filled% = filled/max  [accent color]
│   └── body:            "อีก {n} คนจะครบ 5 สาย = ผลสมบูรณ์…"
│
└── footer
    ├── btn1 [primary]:
    │     filled < max → "ตอบ 6 ข้อ แล้วเข้าทีมนี้" → liff_url?cid={cid}&gid={groupId}&view=join
    │     filled = max → "ดูผลทีม"                   → liff_url?cid={cid}&gid={groupId}&view=group
    └── btn2 [secondary]: "ดูผลของทีมตอนนี้"         → liff_url?cid={cid}&gid={groupId}&view=group

altText: "ทีมนี้ {filled}/{max} คน — ตอบ 6 ข้อแล้วมาเติมทีม {archetypeTitle}"

dynamic params จาก LIFF:
  groupId  → backend ดึง members + archetype ให้เอง
  cid
```

---

## หลักการ: Upload = Flex Card Assets เท่านั้น

```
Flex Card  →  ส่งผ่าน LINE Platform  →  ทุก LIFF เห็นเหมือนกัน
                                          ต้องการ asset ที่ standardized → ต้อง upload

LIFF UI    →  แต่ละเจ้า implement เอง  →  หน้าตาต่างกันได้
                                          ไม่ต้องอยู่ใน upload system
```

**Upload เฉพาะ asset ที่ไปใช้ใน flex card:**

| Asset | schema path | ใช้ใน flex | สถานะ |
|-------|------------|-----------|-------|
| Axis card images (5 ใบ) | `axes[].image_url` | F-02, F-04, F-05 hero, F-10 slots | ✅ schema + flow พร้อม / UI ยังขาด |
| KV / hero image | `appearance.images['kv-intro']` | F-01 hero | ✅ schema พร้อม / UI ยังขาด |
| Group archetype image | `group.archetypes[].image_url` | F-03 hero | ✅ schema + flow พร้อม / UI ยังขาด |
| Pair result image | `results[].image_url` | F-05 (static alt) | ✅ schema พร้อม / UI ยังขาด |
| Symbol image (icon) | `group.archetypes[].symbol_url` | F-08 icon | ❌ schema ยังไม่มี / ต้องเพิ่ม |

**ไม่ต้อง upload (LIFF จัดการเอง — หน้าตาต่างกันได้ตามเจ้า):**
- Background colors, fonts, screen layouts
- Button styles, LIFF-only illustrations
- Loading animations, transition effects

### asset ที่ไหลจาก config ถึง LIFF อยู่แล้ว (toPublicConfig)
- `axes[].image_url` ✅
- `results[].image_url` ✅
- `group.archetypes[].image_url` ✅
- `appearance.images.*` ✅
- `brand.primary` ✅

### สิ่งที่ยังขาด
| ขาด | ผลกระทบ | แนวทาง |
|-----|---------|--------|
| `symbol_url` ใน GroupArchetype | F-08 ต้องใช้ภาพ icon เล็ก (แตกต่างจาก hero ขนาดใหญ่) | เพิ่ม field ใน schema + upload UI |
| Admin UI upload สำหรับ axes[].image_url | ต้องแก้ JSON ตรง | เพิ่ม image uploader ใน Axes section |
| Admin UI upload สำหรับ results[].image_url | ต้องแก้ JSON ตรง | เพิ่ม image uploader ใน Results section |
| Admin UI upload สำหรับ appearance.images | ต้องแก้ JSON ตรง | เพิ่ม image uploader ใน Appearance tab |
| /api/og pair-hero endpoint | F-05 hero = 2 cards ±8° ต้อง server-render | สร้าง endpoint ใหม่ → PNG URL |

---

## สรุป: อะไรต้อง implement

### ทำทันที (Phase 1 — LIFF flex)
- [ ] F-01: เพิ่ม 2nd button "ดูแคมเปญก่อน" + dynamic inviterName ใน body
- [ ] F-02: สร้างใหม่ทั้งหมด (solo share ยังไม่มี)
- [ ] F-10: redesign ใหม่ — เพิ่ม slot grid + progress bar
- [ ] F-03: เพิ่ม fan cards row (max 5 ใบ)

### ทำต่อ (Phase 2 — Backend push)
- [ ] F-04: redesign เป็น kilo + horizontal layout
- [ ] F-05: เพิ่ม /api/og pair-hero endpoint + ใช้เป็น hero
- [ ] F-08: เพิ่ม push call ใน shareGroup() + schema symbol_url
- [ ] F-06: cron job + delay push system

### ทำใน Admin (Phase 3)
- [ ] เพิ่ม image upload UI สำหรับ appearance.images['kv-intro']
- [ ] เพิ่ม image upload UI สำหรับ axes[].image_url ใน Axes section
- [ ] เพิ่ม image upload UI สำหรับ results[].image_url
- [ ] เพิ่ม `symbol_url` ใน GroupArchetype schema + admin UI
