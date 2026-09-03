# Quiz Campaign — Messaging Architecture
## สรุปสถาปัตยกรรมและแนวทางพัฒนา

---

## 1. ภาพรวมระบบ

```
┌─────────────┐    event     ┌─────────────────┐    push/reply    ┌──────────────┐
│    USER      │ ──────────► │   BACKEND        │ ───────────────► │  LINE Chat   │
│  (LIFF app) │             │  (Vercel API)    │                  │  (OA / DM)   │
└─────────────┘             └─────────────────┘                  └──────────────┘
       ▲                            │
       │    open LIFF URL           │ URI action button
       └────────────────────────────┘
```

ระบบมี 3 ส่วนหลัก:

| ส่วน | หน้าที่ | เทคโนโลยี |
|------|---------|-----------|
| **LIFF** | UI + event sender | React, Vite, LINE LIFF SDK |
| **Backend** | event handler + message builder | Node.js, Vercel, Supabase |
| **LINE Platform** | delivery channel | OA Push / Reply / shareTargetPicker |

---

## 2. Events ทั้งหมดใน Quiz Campaign

### กลุ่ม A — LINE Platform Events (webhook)
webhook รับ event จาก LINE → backend ตอบ

| # | Event | trigger | ข้อมูลที่ได้ | message out |
|---|-------|---------|------------|-------------|
| W-1 | `follow` | user add OA | userId | Welcome message (reply) |
| W-2 | `unfollow` | user block OA | userId | mark is_friend=false (ไม่มี message) |
| W-3 | `message` (keyword) | user พิมพ์ text | text, userId | keyword auto-reply (reply) |
| W-4 | `message` (#ref:pairId) | LIFF sendMessages() | pairId | Result card (reply) |
| W-5 | `message` (#ref:share:cid) | LIFF sendMessages() | campaignId | Campaign intro card (reply) |

### กลุ่ม B — API Events (LIFF → Backend → Push)
LIFF เรียก API → backend ประมวลผล → push message

| # | Event | API endpoint | trigger | message out |
|---|-------|-------------|---------|-------------|
| Q-1 | `quiz_answers_saved` | POST /quiz/answers | ผู้ใช้ตอบ quiz ครบ | ไม่มี push (แค่ save) |
| Q-2 | `pair_matched` | POST /quiz/match | B ตอบ quiz ครบ | **F-04** push → A · **F-05** push → B |
| Q-3 | `group_created` | POST /group/create | ผู้ใช้สร้างกลุ่ม | ไม่มี push |
| Q-4 | `group_joined` | POST /group/join | เพื่อนเข้ากลุ่ม | push update → creator |
| Q-5 | `group_shared` | POST /group/share | ผู้ใช้แชร์ผลกลุ่ม | **F-08** push → ผู้แชร์ |

### กลุ่ม C — Scheduled Events (cron/delayed)
backend ยิง push ตามเวลา ไม่มี user action

| # | Event | trigger | เงื่อนไข | message out |
|---|-------|---------|---------|-------------|
| C-1 | `team_reminder` | 48h หลัง pair แรก | มี pending pairs ≥ 2 แต่ไม่ได้สร้างกลุ่ม | **F-06** push → user |

### กลุ่ม D — User-initiated Share (LIFF ส่งเอง)
ไม่ผ่าน backend — LIFF ใช้ shareTargetPicker ส่งตรงเข้าแชท

| # | Event | trigger | message out |
|---|-------|---------|-------------|
| S-1 | user กด "ชวนเพื่อน" | Share tab | **F-01** duo invite flex |
| S-2 | user กด "แชร์ผลเดี่ยว" | Summary screen | **F-02** solo result flex |
| S-3 | user กด "แชร์ผลกลุ่ม" | Group screen | **F-03** group result flex |
| S-4 | user กด "ชวนเข้าทีม" | Share tab / Group | **F-10** group invite flex |
| S-5 | push A ล้ม → B แชร์แทน | หลัง match | Fallback pair result flex |

**รวมทั้งหมด: 18 events · 8 flex card designs**

---

## 3. Flex Cards ทั้ง 8 ใบ (ตาม Design Sheet v1)

| ID | ชื่อ | กลุ่ม | size | trigger event |
|----|------|-------|------|---------------|
| **F-01** | ลิงก์ชวนเพื่อน | D (user share) | mega | S-1 |
| **F-02** | การ์ดผู้รอดชีวิต (solo) | D (user share) | mega | S-2 |
| **F-03** | ผลกลุ่ม / ปลดล็อกสัญลักษณ์ | D (user share) | mega | S-3 |
| **F-04** | เพื่อนตอบแล้ว → A | B (OA push) | kilo | Q-2 |
| **F-05** | ผลคู่ → A และ B | B (OA push) | mega | Q-2 |
| **F-06** | เตือนกลับมาจัดทีม | C (scheduled) | kilo | C-1 |
| **F-08** | ปลดล็อกสัญลักษณ์ใหม่ | B (OA push) | kilo | Q-5 |
| **F-10** | ชวนเข้าทีม (team board) | D (user share) | mega | S-4 |

---

## 4. Flex Card ↔ LIFF — คุยกันยังไง

### 4.1 หลักการ

```
Flex Card button
      │  action: { type: 'uri', uri: LIFF_URL + params }
      ▼
LINE เปิด browser → โหลด LIFF URL
      │
      ▼
LIFF SDK init → liff.ready
      │
      ▼
App.tsx อ่าน URL params → ตัดสินใจ render screen
      │
      ▼
Fetch data จาก backend ด้วย params
      │
      ▼
Render ผลลัพท์บนหน้าจอ
```

### 4.2 LIFF URL Structure

```
Base:  https://liff.line.me/{liffId}
                                    └── ตั้งค่าใน campaign config ครั้งเดียว
                                        env: LIFF_URL
```

**URL Scheme — params ที่ LIFF ต้องรองรับ:**

```
?cid={campaignId}                          → Intro (default)
?cid={campaignId}&inv={userId}             → Invited / duo quiz flow
?cid={campaignId}&pid={pairId}&view=pair   → PairResult screen
?cid={campaignId}&gid={groupId}&view=join  → Group join flow
?cid={campaignId}&gid={groupId}&view=group → Group result (read-only)
?cid={campaignId}&view=summary             → Summary screen
?cid={campaignId}&view=summary&tab=symbols → Summary (symbols tab)
```

**Flex card button ต่อท้าย Base URL ด้วย params เหล่านี้:**

| Flex | button | params ที่ต่อ |
|------|--------|--------------|
| F-01 | "เริ่มตอบ" | `?cid=X&inv={inviterUserId}` |
| F-01 | "ดูแคมเปญก่อน" | `?cid=X` |
| F-02 | "เล่นดูว่าคุณสายไหน" | `?cid=X` |
| F-02 | "ดูผลคู่กับฉัน" | `?cid=X&inv={sharerUserId}` |
| F-03 | "จัดทีมของคุณเอง" | `?cid=X&view=summary` |
| F-04 | "ดูผลคู่ + จัดทีม" | `?cid=X&pid={pairId}&view=pair` |
| F-05 | "ดูผลคู่แบบเต็ม" | `?cid=X&pid={pairId}&view=pair` |
| F-05 | "ชวนคนต่อไป" | `?cid=X&inv={userId}` |
| F-06 | "กลับไปจัดทีม" | `?cid=X&view=summary` |
| F-08 | "ดูสัญลักษณ์ที่เหลือ" | `?cid=X&view=summary&tab=symbols` |
| F-10 | "ตอบ 6 ข้อ แล้วเข้าทีมนี้" | `?cid=X&gid={groupId}&view=join` |
| F-10 | "ดูผลของทีมตอนนี้" | `?cid=X&gid={groupId}&view=group` |

### 4.3 LIFF ต้องตั้งค่าอะไร

```
LINE Developers Console:
  LIFF ID:       2011037337-KlqFK4LM  (เปลี่ยนได้)
  Endpoint URL:  https://laan-kijjakam.vercel.app/liff-app/  (domain ของ frontend)
  Scope:         profile, openid, chat_message.write
  BLE:           off
  Module mode:   off
```

**ถ้าเปลี่ยน LIFF หรือ Domain:**
1. สร้าง LIFF ใหม่ใน Console → ได้ LIFF ID ใหม่
2. อัป `LIFF_URL` ใน Vercel env vars → backend push cards ทุกใบอัปเดตทันที
3. อัป `liffId` ใน frontend config → shareTargetPicker cards ทุกใบอัปเดต
4. ไม่ต้องแตะ flex card JSON เลย

---

## 5. Config Architecture — ตั้งค่าที่เดียว กระจายทุก card

```
campaigns.config (JSON)
├── brand
│   ├── primary          → สี CTA ทุกปุ่มใน flex
│   └── name             → ชื่อแคมเปญ ใน altText
├── liff
│   └── url              → base URL ทุก button action ใน flex
├── copy                 → text สำหรับแต่ละ card slot
│   ├── F01_title
│   ├── F01_body
│   ├── F04_cta
│   └── ...
└── messages             → เปิด/ปิดแต่ละ event + delay config
    ├── F04_partner_answered: { enabled: true }
    ├── F05_pair_result:      { enabled: true }
    ├── F06_team_reminder:    { enabled: true, delay_hours: 48 }
    └── F08_symbol_unlocked:  { enabled: true }
```

---

## 6. LIFF Router — App.tsx

```tsx
// อ่าน params ทั้งหมด ตรงกลาง
const p     = new URLSearchParams(window.location.search)
const cid   = p.get('cid') || p.get('campaignId')
const view  = p.get('view')
const pid   = p.get('pid') || p.get('pairId')
const gid   = p.get('gid') || p.get('groupId')
const inv   = p.get('inv') || p.get('inviterId')
const tab   = p.get('tab')

// Router
if      (view === 'pair'    && pid) → PairResult
else if (view === 'join'    && gid) → Group (join mode)
else if (view === 'group'   && gid) → Group (result mode)
else if (view === 'summary')        → Summary (tab=symbols?)
else if (inv)                       → Invited → quiz flow
else                                → Intro
```

---

## 7. แนวทางพัฒนา — ลำดับขั้น

### Phase 1 — Foundation (ทำก่อน)
- [ ] ตกลง URL scheme → อัป App.tsx router ให้รองรับ params ใหม่
- [ ] เพิ่ม `messages` section ใน campaign config schema
- [ ] เพิ่ม `liff.url` ใน config แทน env var fallback

### Phase 2 — Redesign Flex Cards
ทำตามลำดับความสำคัญ:
- [ ] **F-05** Pair result (OA push ที่ทุกคนเห็น — core)
- [ ] **F-04** Partner answered (redesign เป็น kilo)
- [ ] **F-01** Duo invite (เพิ่ม 2nd button)
- [ ] **F-10** Group invite (เพิ่ม slot grid + progress bar)
- [ ] **F-02** Solo result share (ยังไม่มีเลย — ต้องสร้างใหม่)
- [ ] **F-03** Group result share (เพิ่ม fan cards row)

### Phase 3 — Missing Events
- [ ] **F-08** Symbol unlock push — เพิ่มใน `shareGroup()` (เล็กน้อย)
- [ ] **F-06** Team reminder — cron job + delay push system (ซับซ้อน)

### Phase 4 — Admin Config UI
- [ ] หน้า Replies Setup ใน admin → ตั้งค่า enabled/disabled ต่อ event
- [ ] Preview flex card JSON ต่อ event
- [ ] แก้ copy text ต่อ event

---

## 8. Flex Card Data Contract — Static vs Dynamic

แนวคิดหลัก: แต่ละ flex card มี **2 ชั้นข้อมูล** ที่แยกออกจากกันชัดเจน

```
┌─────────────────────────────────────────────────────┐
│  STATIC (อัปโหลดล่วงหน้า ใน campaign config)        │
│  → hero images, axis card images, brand colors       │
│  → copy text, CTA labels, altText templates          │
│  → LIFF URL base                                     │
├─────────────────────────────────────────────────────┤
│  DYNAMIC (ส่งมาตอน build card จาก LIFF/event)       │
│  → user names, axis IDs, scores, survival time       │
│  → pair ID, group ID (สำหรับ button URL)             │
│  → member list, rank, symbol count                   │
└─────────────────────────────────────────────────────┘
```

Backend รับ dynamic params → ดึง static config → ประกอบ flex JSON → ส่ง

---

### F-01 — ลิงก์ชวนเพื่อน

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| hero image | **static** | `config.appearance.images['kv-intro']` | อัปโหลดใน config |
| badge text | **static** | `"DUO QUIZ · 6 ข้อ"` หรือ copy | config.copy |
| title | **static** | copy `F01_title` | config.copy |
| body line 1 | **static** | copy `F01_body1` | config.copy |
| body line 2 | **static** | copy `F01_body2` | config.copy |
| CTA 1 label | **static** | `"เริ่มตอบ · 1 นาที"` | config.copy |
| CTA 1 url | **dynamic** | `liff_url?cid={cid}&inv={userId}` | LIFF ส่ง userId |
| CTA 2 label | **static** | `"ดูแคมเปญก่อน"` | config.copy |
| CTA 2 url | **dynamic** | `liff_url?cid={cid}` | cid |
| altText | **dynamic** | `"{inviterName}ชวนคุณเล่น DUO QUIZ"` | LIFF ส่ง inviterName |

---

### F-02 — การ์ดผู้รอดชีวิต (solo share)

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| hero bg color | **static** | `#F5E14B` | hardcoded |
| hero axis card image | **dynamic** | `axes[axisId].image_url` | LIFF ส่ง axisId |
| eyebrow | **static** | `"สายของฉันคือ"` | config.copy |
| axis label | **dynamic** | `axes[axisId].label` | axisId → lookup |
| axis body | **dynamic** | `axes[axisId].body` | axisId → lookup |
| CTA 1 label | **static** | `"เล่นดูว่าคุณสายไหน"` | config.copy |
| CTA 1 url | **dynamic** | `liff_url?cid={cid}` | cid |
| CTA 2 label | **static** | `"ดูผลคู่กับฉัน"` | config.copy |
| CTA 2 url | **dynamic** | `liff_url?cid={cid}&inv={userId}` | LIFF ส่ง userId |
| altText | **dynamic** | `"ผลของฉัน: {axisLabel} — มาดูว่าคุณสายไหน"` | dynamic |

---

### F-03 — ผลกลุ่ม / ปลดล็อกสัญลักษณ์

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| hero image | **dynamic** | `archetype.image_url` | group archetype |
| eyebrow | **static** | `"ทีมนี้เป็นสาย"` | config.copy |
| archetype title | **dynamic** | `archetype.title` | group result |
| survival time | **dynamic** | `archetype.primary_text` | group result |
| body | **dynamic** | `archetype.body` | group result |
| fan cards (max 5) | **dynamic** | `members[].axisId → image_url` | LIFF ส่ง memberAxes[] |
| CTA label | **static** | `"จัดทีมของคุณเอง"` | config.copy |
| CTA url | **dynamic** | `liff_url?cid={cid}&view=summary` | cid |
| altText | **dynamic** | `"ทีมของฉันคือ {title} รอด {survival}"` | dynamic |

---

### F-04 — เพื่อนตอบแล้ว → A (OA Push)

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| partner axis card | **dynamic** | `axes[partnerAxisId].image_url` | event: partnerAxisId |
| eyebrow | **static** | `"เพื่อนใหม่ในรายชื่อ"` | config.copy |
| title | **dynamic** | `"{partnerName} ตอบจบแล้ว"` | event: partnerName |
| subtitle | **dynamic** | `"{partnerAxisLabel} · หยิบเข้าทีมได้เลย"` | event: partnerAxisId |
| CTA label | **static** | `"ดูผลคู่ + จัดทีม"` | config.copy |
| CTA url | **dynamic** | `liff_url?cid={cid}&pid={pairId}&view=pair` | event: pairId |
| altText | **dynamic** | `"{partnerName}ตอบแล้ว — ผลคู่ของคุณพร้อมดู"` | dynamic |

---

### F-05 — ผลคู่ → ทั้ง A และ B (OA Push)

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| hero image | **dynamic** | server-render: 2 axis cards ±8° เป็น 1 PNG | event: axisMe, axisBuddy |
| eyebrow | **static** | `"คู่นี้รอดได้"` | config.copy |
| survival time | **dynamic** | `result.primary_text` | pair result |
| rank | **dynamic** | `"อันดับ {rank} จาก {total} คู่"` | event: rank, total |
| body | **dynamic** | `result.body` | pair result |
| CTA 1 label | **static** | `"ดูผลคู่แบบเต็ม"` | config.copy |
| CTA 1 url | **dynamic** | `liff_url?cid={cid}&pid={pairId}&view=pair` | event: pairId |
| CTA 2 label | **static** | `"ชวนคนต่อไป"` | config.copy |
| CTA 2 url | **dynamic** | `liff_url?cid={cid}&inv={myUserId}` | event: userId |
| altText | **dynamic** | `"คุณกับ{buddyName}รอดด้วยกัน{survival}"` | dynamic |

> **หมายเหตุ:** hero image ต้อง server-side render เพราะ LINE Flex หมุนภาพไม่ได้
> endpoint: `GET /api/og?type=pair-hero&axisA={id}&axisB={id}` → PNG

---

### F-06 — เตือนกลับมาจัดทีม (Scheduled Push)

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| eyebrow | **static** | `"ทีมของคุณยังไม่ครบ"` | config.copy |
| title | **dynamic** | `"มี {pendingCount} คนรออยู่ในรายชื่อ"` | cron: นับ pairs ที่ยังไม่อยู่ในกลุ่ม |
| subtitle | **dynamic** | `"ครบ 5 สายจะได้ {bestArchetypeTitle}"` | config: archetypes |
| axis slots bar | **dynamic** | ช่อง filled/empty ตาม existing axes | cron: pending pairs |
| CTA label | **static** | `"กลับไปจัดทีม"` | config.copy |
| CTA url | **dynamic** | `liff_url?cid={cid}&view=summary` | cid |
| altText | **dynamic** | `"มีเพื่อน {count} คนรอเข้าทีมคุณอยู่"` | dynamic |

---

### F-08 — ปลดล็อกสัญลักษณ์ใหม่ (OA Push)

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| hero image | **dynamic** | `archetype.image_url` (symbol image) | event: archetypeCode |
| hero bg | **static** | `#F5E14B` | hardcoded |
| eyebrow | **static** | `"ดวงใหม่รอบนี้"` | config.copy |
| symbol name | **dynamic** | `archetype.title` | event: archetypeCode |
| progress | **dynamic** | `"{collected}/{total} ดวง · เหลือ {remaining}"` | event: collected, total |
| progress dots | **dynamic** | filled dots = collected | dynamic |
| CTA label | **static** | `"ดูสัญลักษณ์ที่เหลือ"` | config.copy |
| CTA url | **dynamic** | `liff_url?cid={cid}&view=summary&tab=symbols` | cid |
| altText | **dynamic** | `"ปลดล็อก {symbolName} แล้ว {collected}/{total}"` | dynamic |

---

### F-10 — ชวนเข้าทีม / Team Board (User Share)

| slot | ประเภท | ค่า | แหล่งที่มา |
|------|--------|-----|------------|
| header label | **static** | `"ทีมนี้มีที่ว่าง"` | config.copy |
| member count | **dynamic** | `"{filled} / {max} คน"` | LIFF ส่ง memberCount, maxMembers |
| member slots (filled) | **dynamic** | axis card + name ต่อสมาชิก | LIFF ส่ง members[]{axisId, name} |
| member slots (empty) | **dynamic** | `?` placeholder | max - filled |
| archetype icon | **dynamic** | `archetype.image_url` (small) | LIFF ส่ง archetypeCode |
| archetype title | **dynamic** | `archetype.title` | archetypeCode → lookup |
| archetype status | **dynamic** | `"ผลชั่วคราวจาก {count} คน"` หรือ `"ทีมครบแล้ว"` | dynamic |
| survival time | **dynamic** | `archetype.primary_text` | archetype |
| progress bar | **dynamic** | filled% = filled/max | dynamic |
| body | **static** | copy `F10_body` (`"อีก {n} คนจะครบ 5 สาย…"`) | config.copy (template) |
| CTA 1 label | **dynamic** | filled < max → `"ตอบ 6 ข้อ แล้วเข้าทีมนี้"` / filled = max → `"ดูผลทีม"` | logic |
| CTA 1 url | **dynamic** | `liff_url?cid={cid}&gid={groupId}&view=join` | LIFF ส่ง groupId |
| CTA 2 label | **static** | `"ดูผลของทีมตอนนี้"` | config.copy |
| CTA 2 url | **dynamic** | `liff_url?cid={cid}&gid={groupId}&view=group` | groupId |
| altText | **dynamic** | `"ทีมนี้ {filled}/{max} คน — มาเติมทีม {archetypeTitle}"` | dynamic |

---

### สรุป: Dynamic Params ที่ LIFF/Event ต้องส่งให้ backend

```
F-01  { userId, inviterName, cid }
F-02  { userId, axisId, cid }
F-03  { groupId, cid }  → backend ดึง archetype + members เอง
F-04  backend มีครบ (จาก pair event)
F-05  backend มีครบ (จาก pair event)
F-06  backend มีครบ (จาก cron query)
F-08  { archetypeCode, userId, cid }  → backend คำนวณ progress
F-10  { groupId, cid }  → backend ดึง members + archetype เอง
```

**หลักการ: LIFF ส่ง ID ไม่ส่งข้อมูล** — backend ดึงรายละเอียดเองจาก DB
LIFF ใหม่ที่มาต่อ → รู้แค่ groupId / pairId / axisId → flex card ถูกต้องทุกใบ

---

## 9. ข้อจำกัดที่กระทบดีไซน์

| ข้อจำกัด | ผลกระทบ | แนวทาง |
|---------|---------|--------|
| Flex ไม่รองรับฟอนต์ custom | Bangers/Gloria ไม่ได้ | ฝังตัวอักษรใน hero image |
| Flex หมุนภาพไม่ได้ | F-05 hero 2 cards ±8° | server-side render เป็น 1 PNG |
| hero = 1 image เท่านั้น | axis pair ต้องอยู่ใน body | ทำ pair image บน server แทน |
| OA push ต้องเป็น follower | บางคนไม่ได้รับ push | fallback shareTargetPicker (S-5) |
| Reply token หมดใน 1 นาที | W-3/W-4/W-5 ต้องเร็ว | ไม่ทำ heavy DB ops ก่อน reply |
