# Color Token Audit — LIFF Colors tab vs. real LIFF app

**Status:** ตรวจสอบเสร็จ (audit only) — **ยังไม่ได้แก้โค้ดใดๆ**
**ขอบเขตที่เช็ค:** `liff/src/App.tsx`, `liff/src/styles.css`, `liff/src/screens/*.tsx`
**ไม่รวม:** โค้ด flex-message JSON (การ์ดที่ส่งเข้าแชท LINE) นับแยกเป็นหัวข้อท้ายไฟล์ เพราะเป็นคนละ surface กับ LIFF webview

## ที่มา

ระหว่างแก้ label ให้อ่านง่ายขึ้นใน `admin/src/components/sections/LiffSection.tsx` (Colors tab → COLOR SPECIMEN) พบว่าแถวตัวอย่าง contrast (pairDefs) ไม่ครอบคลุมสีทั้ง 10 ตัวที่โชว์เป็น swatch — เช็คแล้วพบว่าไม่ใช่แค่การ curate ไม่ครบ แต่มีสีที่ **ไม่ได้เชื่อมกับ LIFF จริงเลย** และมีสีที่เชื่อมแล้วแต่ **ถูก bypass ด้วย hex ตรงๆ** กระจายอยู่หลายหน้าจอ

## วิธีเช็ค

1. อ่าน `App.tsx` หาบรรทัดที่ `root.style.setProperty('--xxx', ...)` เพื่อดูว่าสีไหน "ถูกเชื่อม" เป็น CSS variable จริง
2. `grep` หา hex code ของแต่ละสี (ค่า default ของแต่ละ token) ทั่ว `liff/src/` เพื่อดูว่ามีจุดไหน hardcode ค่าตรงๆ แทนที่จะใช้ `var(--xxx)`

## ผลตรวจ — รายสี

### เชื่อมกับ config จริง (มี CSS var ใน App.tsx) แต่ถูก bypass ด้วย hex ตรงๆ

| Token (label ในแอดมิน) | CSS var | ตั้งค่าใน | จุด hardcode เด่นๆ ที่เจอ |
|---|---|---|---|
| Primary | `--ac` | `App.tsx:231` | `App.tsx:1014` (progress bar เวอร์ชัน inline), `screens/Group.tsx` (406, 342, 350, 596, 643, 656, 783 — ปุ่มแชร์, ปุ่มย้อนกลับ, spinner, ฯลฯ), `screens/ErrorScreen.tsx:18` (ปุ่มลองใหม่), `screens/SoloShare.tsx:151,204-205` |
| On Primary / Surface | `--on-ac` / `--card` | `App.tsx:234,240` | `#FFFDF6` hardcode เป็นพื้นหลังการ์ดแทบทุกจอ: `Group.tsx`, `Rewards.tsx`, `SoloShare.tsx`, `SymbolCollection.tsx`, `FriendGate.tsx`, `AddFriendNudge.tsx`, `ErrorScreen.tsx` |
| Background | `--bg` | `App.tsx:237` | `Group.tsx` (หลายจุด), `Intro.tsx:48`, `Invited.tsx:67`, `PairResult.tsx:163`, `ErrorScreen.tsx:8`, `FriendGate.tsx:45`, `SymbolCollection.tsx:44,46` — **บั๊กเพิ่ม**: `Rewards.tsx:340` เขียน `var(--surface, #F7F1E3)` แต่ `--surface` ไม่มีจริงในระบบ (ของจริงคือ `--bg`) เลย fallback ไป hex ตลอด |
| On Surface (ตัวอักษร/เส้นขอบ/เงา) | `--ink` (+ `--border`, `--shadow`) | `App.tsx:244,262,266` | **หนักสุดในทุกสี** — `Group.tsx` เพียงไฟล์เดียวมี `#1C1A17` hardcode ทับ `var(--ink)`/`var(--border)`/`var(--shadow)` เกือบ 40 จุด และกระจายอยู่แทบทุกไฟล์ (`Rewards.tsx`, `SoloShare.tsx`, `FriendGate.tsx`, `AddFriendNudge.tsx`, `SymbolCollection.tsx`, `ErrorScreen.tsx`) |
| Muted | `--ink2` / `--ink3` | `App.tsx:254-255` | ค่า `rgba(28,26,23,.XX)` แบบ literal กระจายอยู่หลายจุด (border/shadow แบบจาง) แทนที่จะใช้ `var(--ink2)`/`var(--ink3)` — ไม่ได้ไล่นับทีละบรรทัดในรอบนี้ เพราะปะปนกับการใช้ opacity เฉพาะจุดจำนวนมาก |
| Highlight | `--hl` | `App.tsx:258` | `Group.tsx` (spinner bg, badge, avatar chip, toast bg), `Rewards.tsx` (code box, reward badge), `SoloShare.tsx`, `PairResult.tsx`, `FriendGate.tsx`, `AddFriendNudge.tsx` — การ์ด/badge เกือบทั้งหมดใช้ `#F5E14B` ตรงๆ |

### ไม่เชื่อมกับ LIFF จริงเลย

| Token | สถานะ |
|---|---|
| **Accent** (`#7AC4D6`) | หา hex `#7AC4D6` ทั้ง repo ไม่เจอเลยสักที่ จุดเดียวที่อ้างถึงคือ `Rewards.tsx` ใช้ `var(--accent, #E8354F)` — **`--accent` ไม่เคยถูก `setProperty` ใน `App.tsx` เลย** และค่า fallback ที่เขียนไว้ยังผิดอีก (เป็นสี Primary/แดง ไม่ใช่สี Accent/ฟ้าเอง) เท่ากับ token นี้ตัดขาดจากของจริง 100% |
| **Accent Soft** (`#E6F1F5`) | เจอ hex ใช้จริง 1 จุด: `PairResult.tsx:187` (กล่อง "สายวางแผน") แต่เขียนเป็น hex ตรงๆ ไม่ได้อ่านจาก `colors.accent_soft` หรือ CSS var ใดๆ — บังเอิญค่าตรงกับ default เฉยๆ |
| **LINE Green** (`#06C755`) | hardcode กระจายอยู่ใน `App.tsx` (1141, 1158), `PairResult.tsx:212,226`, `SoloShare.tsx:183,189`, `FriendGate.tsx:222`, `AddFriendNudge.tsx:82`, `Summary.tsx:308,319`, `Group.tsx:735,747,762` — ปุ่มแชร์ไลน์ทุกจอ ไม่มีจุดไหนอ่านจาก `colors.line_green` เลย |

## หมายเหตุแถม — Flex Message JSON ก็เจอปัญหาเดียวกัน

Flex Card (การ์ดที่ส่งเข้าแชท LINE เวลาแชร์ผล — คุมแยกที่ tab "Flex Cards") ก็ hardcode สีเช่นกัน ไม่เชื่อมกับ config สี:
- `Group.tsx` (231, 269, 287, 510, 515, 516, 531 ฯลฯ), `Summary.tsx:138,192,200`, `SoloShare.tsx:99`, `PairResult.tsx:150` — ใช้ `color: '#E8354F'` ตรงๆ ใน object ของ Flex Message
- `screens/SymbolCollection.tsx:29` มีทางแยกของตัวเองอยู่แล้ว: `const primary = config.brand?.primary || '#E8354F'` (อ่านจาก `brand.primary` ไม่ใช่ `appearance.colors.primary` — คนละ field กับที่ Colors tab แก้)

เป็นปัญหาแบบเดียวกัน (hardcode แทนอ่าน config) แต่คนละ surface กับ LIFF webview จึงแยกเป็นงานคนละก้อน

## ไฟล์ที่ hardcode หนักที่สุด (เรียงตามผลกระทบ)

1. **`screens/Group.tsx`** — แทบไม่ใช้ CSS var เลย มี hardcode ครบทุกสี (~40+ จุดสำหรับ ink อย่างเดียว)
2. **`screens/Rewards.tsx`** — hardcode หนักรองลงมา + เป็นจุดเดียวที่อ้างถึง `--accent` (ผิด fallback)
3. ไฟล์อื่น (`Intro`, `Question`, `Summary`, `PairResult`, `Loading`) ใช้ `var(--xx)` เป็นหลักแล้ว แต่ยังมีจุดหลุดประปราย

## แนะนำลำดับการแก้ (ยังไม่ได้ทำ — รอ confirm)

1. แก้ `Group.tsx` ก่อน (หนักสุด, ไฟล์เดียวกระทบกว้างสุด)
2. แก้ `Rewards.tsx`
3. เชื่อม Accent / Accent Soft / LINE Green เข้า `App.tsx` (`setProperty('--accent', ...)`, `--accent-soft`, `--line-green`) แล้วไล่แก้จุดที่ hardcode ให้อ่านจาก var ใหม่
4. (แยกงาน) แก้ Flex Message JSON ให้อ่านจาก config เช่นกัน
