# Flex Card — Implementation Checklist
## ทุก event × ทุก flex card ที่ต้องทำตาม Design Sheet v1

---

## Map: Event → Flex Card

| Event | trigger | Flex Card | ช่องทาง | สถานะ |
|-------|---------|-----------|---------|-------|
| W-1 follow | user add OA | **Welcome** (ไม่อยู่ใน design sheet — TBD) | OA Reply | ✅ มีแล้ว (text, ไม่บอกพิมพ์ quiz) |
| W-2 unfollow | user block | — ไม่มี message — | — | — |
| W-3 keyword | user พิมพ์ keyword | keyword auto-reply (configurable per keyword_rules) | OA Reply | ✅ มีแล้ว |
| W-4 #ref:pairId | LIFF sendMessages | Result trigger reply (similar F-05 แต่ via reply) | OA Reply | ✅ มีแล้ว / ยังไม่ redesign |
| W-5 #ref:share | LIFF sendMessages | Campaign intro card | OA Reply | ✅ มีแล้ว / โล่ง ไม่มี hero |
| Q-1 answers saved | POST /quiz/answers | — ไม่มี message — | — | — |
| **Q-2 pair matched** | POST /quiz/match | **F-04** → push A | OA Push | ✅ kilo + horizontal layout |
| **Q-2 pair matched** | POST /quiz/match | **F-05** → push B และ A | OA Push | ✅ mega, OG hero, rank, ส่งทั้ง A และ B |
| Q-3 group created | POST /group/create | — ไม่มี message — | — | — |
| Q-4 group joined | POST /group/join | Group update → creator | OA Push | ✅ มีแล้ว |
| **Q-5 group shared** | POST /group/share | **F-08** → push sharer | OA Push | ✅ kilo, symbol icon, push ใน shareGroup() |
| **C-1 cron 48h** | cron job (hourly) | **F-06** → push user | OA Push | ✅ kilo + horizontal, 48–49h window |
| **S-1 share duo** | ปุ่ม "ชวนเพื่อน" | **F-01** → shareTargetPicker | Chat | ✅ mega, 2 buttons, dynamic inviter name |
| **S-2 share solo** | ปุ่ม "แชร์ผลเดี่ยว" | **F-02** → shareTargetPicker | Chat | ✅ mega, axis card hero, 2 CTAs |
| **S-3 share group result** | ปุ่ม "แชร์ผลกลุ่ม" | **F-03** → shareTargetPicker | Chat | ✅ mega, fan cards row (max 5), lock badge |
| **S-4 share group invite** | ปุ่ม "ชวนเข้าทีม" | **F-10** → shareTargetPicker | Chat | ✅ mega, slot grid, progress bar, conditional CTAs |
| S-5 fallback share | push A ล้ม → B แชร์ | โครงสร้าง F-05 | Chat | ✅ mega, OG hero, axis pair box, rank |

---

## Flex Cards ที่ทำเสร็จแล้ว (Design Sheet v1)

| # | Card | Size | ไฟล์ | หมายเหตุ |
|---|------|------|------|---------|
| **F-01** | ลิงก์ชวนเพื่อน | mega | `liff/src/screens/Share.tsx` → `handleShareDuo` | KV hero, 2 buttons, body ใส่ชื่อ inviter |
| **F-02** | การ์ดผู้รอดชีวิต (solo) | mega | `liff/src/screens/Summary.tsx` → `handleShareSolo` | axis card hero 3:4, 2 CTAs |
| **F-03** | ผลกลุ่ม | mega | `liff/src/screens/Group.tsx` → `handleShareGroup` | fan cards row max 5, lock badge, size mega |
| **F-04** | เพื่อนตอบแล้ว → A | kilo | `src/services/match.ts` → `buildPartnerAnsweredCard` | horizontal: buddy card + text, height sm button |
| **F-05** | ผลคู่ → A และ B | mega | `src/services/match.ts` → `buildMatchResultCard` | OG hero (2 cards ±9°), rank badge, ส่งทั้ง A+B |
| **F-06** | เตือนกลับมาจัดทีม | kilo | `src/routes/cron.ts` → `sendF06Reminder` | horizontal: my card + text, hourly cron, 48–49h window |
| **F-08** | ปลดล็อกสัญลักษณ์ | kilo | `src/services/group.ts` → `pushSymbolUnlockedToUser` | symbol_url icon (circle), fire-and-forget |
| **F-10** | ชวนเข้าทีม | mega | `liff/src/screens/Share.tsx` → `handleShareGroup` | slot grid (filled axis card + empty ?), progress bar, conditional CTAs |
| **S-5** | Fallback share (B→A) | mega | `liff/src/App.tsx` → fallback shareTargetPicker | โครงสร้าง F-05: OG hero, axis pair box, rank |

---

## ยังไม่ได้ทำ / Backlog

| รายการ | สถานะ | หมายเหตุ |
|--------|-------|---------|
| W-4 result trigger reply redesign | ⬜ backlog | ยัง spec เก่า อาจ redesign ให้ตรง F-05 |
| W-5 campaign intro card (hero) | ⬜ backlog | ปัจจุบันโล่ง ไม่มี hero |
| F-04/F-06 batch logic (≤10 min window) | ⬜ backlog | รวบหลายคนตอบพร้อมกันเป็นใบเดียว |
| Admin: image upload สำหรับ symbol_url | ⬜ backlog | F-08 schema มีแล้ว แต่ admin UI ยังไม่มี field |

---

## สิ่งที่ Design Sheet บอกไว้และต้อง concern

| ประเด็น | กระทบการ์ด | สถานะ |
|---------|-----------|-------|
| bubble ทุกใบ = **mega** ยกเว้น F-04, F-06, F-08 = **kilo** | ทุกใบ | ✅ ทำถูกทุกใบแล้ว |
| Flex หมุนภาพไม่ได้ | F-05 hero (2 cards ±9°) | ✅ ใช้ `/api/og?type=pair` → SVG แทน |
| Flex คุมฟอนต์ไม่ได้ | ทุกใบที่ใช้ Bangers | ⚠️ ฝัง text ใน hero SVG แล้ว (sans-serif) |
| ส่งไม่ซ้ำเกิน 1 ใบ/event | F-04, F-05, F-08 | ✅ F-06 ใช้ 48–49h sliding window |
| F-04/F-06: batch logic | F-04, F-06 | ⬜ ยังไม่ทำ (backlog) |
