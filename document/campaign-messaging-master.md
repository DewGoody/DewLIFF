# Campaign Quiz — Messaging Master Doc
## Events · Flex Cards · LIFF · การสื่อสารระหว่างระบบ
**อัปเดตล่าสุด:** 2026-08-25

---

## 1. ภาพรวมระบบ

```
┌─────────────────────────────────────────────────────────────────┐
│                    Campaign Config (Supabase)                    │
│  assets: axis images · archetype images · KV image · symbol     │
│  config: brand color · LIFF URL · copy text · messages on/off   │
└──────────────┬──────────────────────────┬───────────────────────┘
               │ GET /api/config/:cid      │ getConfig()
               ▼                           ▼
       ┌───────────────┐          ┌────────────────┐
       │  LIFF (React) │          │ Backend (API)  │
       │               │  event   │                │
       │  UI + router  │ ───────► │  handler +     │
       │  flex builder │          │  flex builder  │
       └───────┬───────┘          └───────┬────────┘
               │                          │
        shareTargetPicker          pushMessage()
        (user ส่งเอง)              (ระบบส่ง)
               │                          │
               └──────────┬───────────────┘
                           ▼
                   ┌──────────────┐
                   │  LINE Chat   │
                   │  (OA / DM)   │
                   └──────────────┘
```

**หลักการ:**
- LIFF และ Backend อ่าน **config เดียวกัน** → asset เดียวกันทุกใบ
- **LIFF ส่ง ID ไม่ส่งข้อมูล** → backend ดึงรายละเอียดจาก DB เอง
- LIFF ใหม่ที่มาต่อ → รู้แค่ `groupId / pairId / axisId` → flex ถูกต้องทุกใบ

---

## 2. Events ทั้งหมด (16 events)

### กลุ่ม W — LINE Webhook (reply ฟรี ≤1 นาที)

| ID | Event | Trigger | Message Out |
|----|-------|---------|-------------|
| W-1 | `follow` | user add OA | Welcome reply (flex หรือ text) |
| W-2 | `unfollow` | user block OA | — ไม่มี — (mark is_friend=false) |
| W-3 | `message` keyword | user พิมพ์ keyword | keyword auto-reply (text / flex) |
| W-4 | `message` #ref:pairId | LIFF sendMessages() | Result card reply |
| W-5 | `message` #ref:share | LIFF sendMessages() | Campaign intro card reply |

### กลุ่ม Q — API Events (LIFF → Backend → Push)

| ID | Event | API Endpoint | Trigger | Message Out |
|----|-------|-------------|---------|-------------|
| Q-1 | `answers_saved` | POST /quiz/answers | ผู้ใช้ตอบ quiz ครบ | — ไม่มี — |
| Q-2 | `pair_matched` | POST /quiz/match | B ตอบ quiz ครบ → match | **F-04** push → A · **F-05** push → B |
| Q-3 | `group_created` | POST /group/create | ผู้ใช้สร้างกลุ่ม | — ไม่มี — |
| Q-4 | `group_joined` | POST /group/join | เพื่อนเข้ากลุ่ม | Group update push → creator |
| Q-5 | `group_shared` | POST /group/share | ผู้ใช้แชร์ผลกลุ่ม | **F-08** push → ผู้แชร์ |

### กลุ่ม C — Scheduled (cron / delayed push)

| ID | Event | Trigger | เงื่อนไข | Message Out |
|----|-------|---------|---------|-------------|
| C-1 | `team_reminder` | cron ทุก 1h | มี pairs ≥ 2 แต่ไม่ได้สร้างกลุ่มใน 48h | **F-06** push → user |

### กลุ่ม S — User-initiated Share (LIFF shareTargetPicker)

| ID | Event | Trigger | Message Out |
|----|-------|---------|-------------|
| S-1 | share duo invite | ปุ่ม "ชวนเพื่อน" | **F-01** → chat |
| S-2 | share solo result | ปุ่ม "แชร์ผลเดี่ยว" | **F-02** → chat |
| S-3 | share group result | ปุ่ม "แชร์ผลกลุ่ม" | **F-03** → chat |
| S-4 | share group invite | ปุ่ม "ชวนเข้าทีม" | **F-10** → chat |
| S-5 | fallback share | push A ล้ม (ไม่ follow OA) → B แชร์แทน | F-05 structure → chat |

---

## 3. Flex Cards ทั้ง 8 ใบ (Design Sheet v1)

| ID | ชื่อ | size | ช่องทาง | Event | สถานะ |
|----|------|------|---------|-------|-------|
| **F-01** | ลิงก์ชวนเพื่อน | mega | shareTargetPicker | S-1 | ⚠️ มี / ไม่ตรง spec |
| **F-02** | การ์ดผู้รอดชีวิต (solo) | mega | shareTargetPicker | S-2 | ⬜ ยังไม่มี |
| **F-03** | ผลกลุ่ม / ปลดล็อก | mega | shareTargetPicker | S-3 | ⚠️ มี / ขาด fan cards |
| **F-04** | เพื่อนตอบแล้ว → A | kilo | OA Push | Q-2 | ⚠️ มี / layout ผิด |
| **F-05** | ผลคู่ → A และ B | mega | OA Push | Q-2 | ⚠️ มี / ขาด hero+rank |
| **F-06** | เตือนกลับมาจัดทีม | kilo | OA Push (cron) | C-1 | ⬜ ยังไม่มี |
| **F-08** | ปลดล็อกสัญลักษณ์ | kilo | OA Push | Q-5 | ⬜ ยังไม่มี |
| **F-10** | ชวนเข้าทีม (team board) | mega | shareTargetPicker | S-4 | ⚠️ มี / ขาด slot grid |

---

## 4. Flex Card ↔ LIFF สื่อสารกันยังไง

### 4.1 Button Action — เชื่อม LINE → LIFF

```
ปุ่มใน flex card
  action: { type: 'uri', uri: '{liff_url}{params}' }
                                ↑
                    ตั้งค่าใน config.appearance.liff_id
                    backend แปลงเป็น https://liff.line.me/{liffId}
                    เปลี่ยน liff_id ครั้งเดียว → ทุก card อัปเดตทันที
```

### 4.2 URL Scheme — params ที่ LIFF ต้องรองรับ

```
{liff_url}?cid={cid}                          → Intro (default)
{liff_url}?cid={cid}&inv={userId}             → Invited / duo quiz flow
{liff_url}?cid={cid}&pid={pairId}&view=pair   → PairResult screen
{liff_url}?cid={cid}&gid={groupId}&view=join  → Group join flow
{liff_url}?cid={cid}&gid={groupId}&view=group → Group result (read-only)
{liff_url}?cid={cid}&view=summary             → Summary screen
{liff_url}?cid={cid}&view=summary&tab=symbols → Summary (symbols tab)
```

| Flex | Button | URL params |
|------|--------|------------|
| F-01 | เริ่มตอบ | `?cid=X&inv={inviterUserId}` |
| F-01 | ดูแคมเปญก่อน | `?cid=X` |
| F-02 | เล่นดูว่าคุณสายไหน | `?cid=X` |
| F-02 | ดูผลคู่กับฉัน | `?cid=X&inv={userId}` |
| F-03 | จัดทีมของคุณเอง | `?cid=X&view=summary` |
| F-04 | ดูผลคู่ + จัดทีม | `?cid=X&pid={pairId}&view=pair` |
| F-05 | ดูผลคู่แบบเต็ม | `?cid=X&pid={pairId}&view=pair` |
| F-05 | ชวนคนต่อไป | `?cid=X&inv={myUserId}` |
| F-06 | กลับไปจัดทีม | `?cid=X&view=summary` |
| F-08 | ดูสัญลักษณ์ที่เหลือ | `?cid=X&view=summary&tab=symbols` |
| F-10 | ตอบ 6 ข้อ แล้วเข้าทีมนี้ | `?cid=X&gid={groupId}&view=join` |
| F-10 | ดูผลของทีมตอนนี้ | `?cid=X&gid={groupId}&view=group` |

### 4.3 LIFF Router (App.tsx)

```tsx
const p    = new URLSearchParams(window.location.search)
const cid  = p.get('cid') || p.get('campaignId')
const view = p.get('view')
const pid  = p.get('pid') || p.get('pairId')
const gid  = p.get('gid') || p.get('groupId')
const inv  = p.get('inv') || p.get('inviterId')
const tab  = p.get('tab')

// Router
view === 'pair'    && pid  →  PairResult
view === 'join'    && gid  →  Group (join mode)
view === 'group'   && gid  →  Group (result mode)
view === 'summary'         →  Summary (tab === 'symbols' → symbols tab)
inv                        →  Invited → quiz flow
(ไม่มี)                    →  Intro
```

### 4.4 ถ้าเปลี่ยน LIFF

```
1. สร้าง LIFF ใหม่ใน LINE Developers Console → ได้ liffId ใหม่
2. อัป config.appearance.liff_id → backend push cards ทุกใบอัปเดต
3. อัป liffId ใน frontend env → shareTargetPicker cards ทุกใบอัปเดต
   ✅ ไม่ต้องแตะ flex JSON เลย
```

---

## 5. Assets — หลักการและสถานะ

### หลักการ: Upload = Flex Card Assets เท่านั้น

```
Flex Card  → ส่งผ่าน LINE → ทุก LIFF เห็นเหมือนกัน → ต้อง standardized → upload
LIFF UI    → แต่ละเจ้า implement เอง → หน้าตาต่างได้   → ไม่ต้อง upload
```

### Asset slots ที่ไหลจาก Config → LIFF → Flex Cards

| Asset | Config path | ใช้ใน flex | Schema | Admin UI |
|-------|------------|-----------|--------|----------|
| Axis card images | `axes[].image_url` | F-02, F-04, F-05 hero, F-10 | ✅ | ⬜ |
| KV / hero image | `appearance.images['kv-intro']` | F-01 hero | ✅ | ⬜ |
| Group archetype image | `group.archetypes[].image_url` | F-03 hero | ✅ | ⬜ |
| Pair result image | `results[].image_url` | (LIFF only ตอนนี้) | ✅ | ⬜ |
| Symbol icon image | `group.archetypes[].symbol_url` | F-08 icon | ❌ ต้องเพิ่ม | ⬜ |
| Brand color | `brand.primary` | ทุก CTA | ✅ | ✅ |
| LIFF ID | `appearance.liff_id` | ทุก button URL | ✅ | ⬜ |
| Copy text | `copy['{key}']` | ทุก text slot | ✅ | ⬜ |

### สิ่งที่ยังขาด
| ขาด | กระทบ | แนวทาง |
|-----|-------|--------|
| `symbol_url` field | F-08 hero icon แยกจาก result hero | เพิ่มใน GroupArchetype schema |
| Admin UI อัปโหลด images | ต้องแก้ JSON ตรง | image uploader ใน admin |
| `/api/og?type=pair-hero` endpoint | F-05 hero (2 cards ±8°) | server-render → PNG URL |

---

## 6. โครงสร้างแต่ละ Flex Card

### F-01 — ลิงก์ชวนเพื่อน · mega · shareTargetPicker
```
hero:   appearance.images['kv-intro']  (20:13 cover)
body:   badge "DUO QUIZ · 6 ข้อ"
        title:  copy['F01_title']  "โลกแตกแล้ว เราสองคนรอดด้วยกันกี่วัน?"
        body1:  copy['F01_body1']  "ตอบ 6 ข้อใน 1 นาที รู้สายเอาตัวรอดของคุณ"
        body2:  "แล้วระบบจะจับคู่ผลกับ {inviterName} ให้ทันที"  ← dynamic
footer: [primary]   "เริ่มตอบ · 1 นาที"  → ?cid&inv={inviterUserId}
        [secondary] "ดูแคมเปญก่อน"        → ?cid
altText: "{inviterName}ชวนคุณเล่น DUO QUIZ"
dynamic: inviterName, inviterUserId, cid
```

### F-02 — การ์ดผู้รอดชีวิต · mega · shareTargetPicker
```
hero:   bg #F5E14B + axes[axisId].image_url (centered contain)
body:   eyebrow "สายของฉันคือ"
        title:  axes[axisId].label
        body:   axes[axisId].body
footer: [primary]   "เล่นดูว่าคุณสายไหน"  → ?cid
        [secondary] "ดูผลคู่กับฉัน"        → ?cid&inv={userId}
altText: "ผลของฉัน: {axisLabel} — มาดูว่าคุณสายไหน"
dynamic: axisId, userId, cid
```

### F-03 — ผลกลุ่ม / ปลดล็อกสัญลักษณ์ · mega · shareTargetPicker
```
hero:   archetype.image_url  (20:13 cover)
body:   eyebrow "ทีมนี้เป็นสาย"
        title:    archetype.title
        survival: archetype.primary_text  (large bold)
        body:     archetype.body
        fan cards row (max 5):  members[].axisId → axes[id].image_url  (38×52)
footer: [primary] "จัดทีมของคุณเอง"  → ?cid&view=summary
altText: "ทีมของฉันคือ {title} รอด {survival}"
dynamic: groupId → backend ดึง archetype + members
```

### F-04 — เพื่อนตอบแล้ว → A · kilo · OA Push
```
hero:   — ไม่มี (kilo) —
body:   [horizontal layout]
        left:  axes[partnerAxisId].image_url  (52×70)
        right: eyebrow "เพื่อนใหม่ในรายชื่อ"
               title   "{partnerName} ตอบจบแล้ว"
               sub     "{partnerAxisLabel} · หยิบเข้าทีมได้เลย"
footer: [primary] "ดูผลคู่ + จัดทีม"  → ?cid&pid={pairId}&view=pair
altText: "{partnerName}ตอบแล้ว — ผลคู่ของคุณพร้อมดู"
dynamic: backend มีครบจาก pair event
```

### F-05 — ผลคู่ → A และ B · mega · OA Push
```
hero:   /api/og?type=pair-hero&a={axisA}&b={axisB}  (server-render 2 cards ±8°)
body:   eyebrow  "คู่นี้รอดได้"
        title:   result.primary_text  (large — "8 เดือน")
        rank:    "อันดับ {rank} จาก {total} คู่"  (sm gray)
        body:    result.body
footer: [primary]   "ดูผลคู่แบบเต็ม"  → ?cid&pid={pairId}&view=pair
        [secondary] "ชวนคนต่อไป"       → ?cid&inv={myUserId}
altText: "คุณกับ{buddyName}รอดด้วยกัน{survival}"
หมายเหตุ: ส่งการ์ดเดียวกันให้ A และ B แต่สลับ myUserId / buddyName
dynamic: backend มีครบจาก pair event
```

### F-06 — เตือนกลับมาจัดทีม · kilo · OA Push (cron)
```
hero:   — ไม่มี (kilo) —
body:   eyebrow  "ทีมของคุณยังไม่ครบ"
        title:   "มี {pendingCount} คนรออยู่ในรายชื่อ"
        sub:     "ครบ 5 สายจะได้ {bestArchetypeTitle} ที่รอดนานสุด"
        hint:    "ตอนนี้ยังขาดสาย {missingAxisLabel}"
        slots:   5 ช่อง → filled=existing axes, empty=dashed ?
footer: [primary] "กลับไปจัดทีม"  → ?cid&view=summary
altText: "มีเพื่อน {count} คนรอเข้าทีมคุณอยู่"
dynamic: cron query → pendingCount, existingAxes[], missingAxisLabel, bestArchetypeTitle
```

### F-08 — ปลดล็อกสัญลักษณ์ · kilo · OA Push
```
hero:   bg #F5E14B + archetype.symbol_url || image_url  (96px contain)
body:   eyebrow  "ดวงใหม่รอบนี้"
        title:   archetype.title
        progress: "สะสมแล้ว {collected}/{total} ดวง · เหลือ {remaining}"
        dots:    ● filled=red  ● empty=dark  (total = จำนวน archetypes)
footer: [secondary] "ดูสัญลักษณ์ที่เหลือ"  → ?cid&view=summary&tab=symbols
altText: "ปลดล็อก {title} แล้ว {collected}/{total}"
dynamic: archetypeCode, collected, total  (push หลัง shareGroup() สำเร็จ)
```

### F-10 — ชวนเข้าทีม (Team Board) · mega · shareTargetPicker
```
hero:   — ไม่มี (ใช้ body section แรกเป็น visual anchor) —
body section 1 [team board]:
        header: "ทีมนี้มีที่ว่าง"  |  "{filled}/{max} คน"
        slots:  filled → axis card + name (9px)
                empty  → dashed border + "?"
body section 2 [archetype]:
        icon:     archetype.image_url  (44×44)
        title:    archetype.title
        status:   "ผลชั่วคราวจาก {n} คน"  หรือ  "ทีมครบแล้ว"
        survival: archetype.primary_text  (large accent)
        progress: bar  filled% = filled/max
        body:     "อีก {n} คนจะครบ 5 สาย = ผลสมบูรณ์…"
footer: [primary]   filled<max → "ตอบ 6 ข้อ แล้วเข้าทีมนี้" → ?cid&gid&view=join
                    filled=max → "ดูผลทีม"                   → ?cid&gid&view=group
        [secondary] "ดูผลของทีมตอนนี้"  → ?cid&gid&view=group
altText: "ทีมนี้ {filled}/{max} คน — มาเติมทีม {archetypeTitle}"
dynamic: groupId → backend ดึง members + archetype
```

---

## 7. Implementation Checklist

### Phase 1 — LIFF shareTargetPicker
- [ ] **F-01** เพิ่ม 2nd button + dynamic `{inviterName}` ใน body · `Share.tsx`
- [ ] **F-02** สร้างใหม่ทั้งหมด ใน Summary screen · `Summary.tsx`
- [ ] **F-10** redesign slot grid + progress bar · `Share.tsx` / `Group.tsx`
- [ ] **F-03** เพิ่ม fan cards row (max 5) · `Group.tsx`
- [ ] **S-5** fallback ใช้ F-05 structure · `App.tsx`

### Phase 2 — Backend OA Push
- [ ] **F-04** redesign kilo + horizontal layout · `match.ts`
- [ ] **F-05** `/api/og` pair-hero endpoint + ส่ง A และ B การ์ดเดียวกัน · `match.ts` + `api/og.ts`
- [ ] **F-08** push ใน `shareGroup()` + เพิ่ม `symbol_url` schema · `group.ts`

### Phase 3 — Scheduled
- [ ] **F-06** cron + delay push system · ใหม่

### Phase 4 — Admin Config
- [ ] Image upload UI: axes, results, appearance.images, symbol_url
- [ ] เพิ่ม `symbol_url` ใน GroupArchetype schema

---

## 8. ข้อจำกัด LINE Flex ที่ต้อง concern

| ข้อจำกัด | กระทบการ์ด | แนวทาง |
|---------|-----------|--------|
| ฟอนต์ custom ไม่ได้ (Bangers/Gloria) | F-01, F-03, F-10 | ฝัง text ใน hero image |
| หมุนภาพไม่ได้ | F-05 hero (2 cards ±8°) | server-render PNG |
| hero = 1 image เท่านั้น | ทุกใบ | composite image ถ้าต้องการหลาย element |
| OA push ต้องเป็น follower | F-04, F-05, F-06, F-08 | fallback shareTargetPicker (S-5) |
| Reply token หมดใน 1 นาที | W-3, W-4, W-5 | ไม่ทำ heavy DB ops ก่อน reply |
| ส่งไม่ซ้ำ > 1 ใบ/event | F-04, F-05, F-08 | guard ใน push logic |
| bubble size: mega vs kilo | ทุกใบ | F-04, F-06, F-08 = kilo · ที่เหลือ = mega |
