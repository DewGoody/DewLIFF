# Codera Solutions — Product Plan
**Version:** 1.0 · August 2026

---

## 1. Vision

ช่วยแบรนด์สร้าง LINE Quiz Experience ที่ผู้ใช้อยากแชร์ต่อเอง
โดยไม่ต้องพึ่ง media budget — growth มาจาก mechanic ที่ build-in อยู่ในตัวสินค้า

---

## 2. Product Line — 3 Tiers

### 2.1 Solo Quiz — "รู้จักตัวเอง"

> ตอบคำถาม → ได้ผลลัพธ์ที่ personalized → แชร์เอง

**User Flow:**
```
Rich Menu / Link → Intro → 6 คำถาม → ผล (Archetype) → แชร์ผล → เพื่อนคลิก → loop
```

**Brand ได้อะไร:**
- First-party data (personality type ของ user)
- Organic reach จากการแชร์ — acquisition cost = 0
- User รู้สึก "ใช่เลย" → จดจำแบรนด์

**เหมาะกับ:** แคมเปญ brand awareness, event pre-launch, loyalty program

---

### 2.2 Duo Quiz — "รู้จักกันและกัน"

> Solo + matching กับเพื่อน → ผลคู่ที่เป็นของสองคนนี้เท่านั้น

**User Flow:**
```
A ตอบ → แชร์ลิงก์ให้ B → B ตอบ → Matching → ผลคู่ (unique) → ทั้งคู่อยากแชร์ → C, D เข้ามา
```

**Brand ได้อะไร:**
- Viral loop ที่ build-in — B กลายเป็น A ใหม่ทุกครั้ง
- User ไม่ได้มาเอง เพื่อนพามา → acquisition cost = 0
- Pair result unique ต่อคู่ = แรงจูงใจแชร์สูง

**เหมาะกับ:** แคมเปญ friendship, seasonal campaign, product launch ที่ต้องการ reach สูง

---

### 2.3 Team Quiz — "พลังของกลุ่ม"

> Duo + team formation → ผลทีมที่ unlock ได้เมื่อครบ

**User Flow:**
```
Creator ตอบ → สร้างทีม → แชร์ invite → สมาชิกเข้าร่วม → รอครบ (progress bar)
→ ทีมครบ → push ถึงทุกคนพร้อมกัน → Team Archetype unlock → แชร์ผลทีม
```

**Brand ได้อะไร:**
- Retention สูง — user มี reason to return (รอทีมครบ)
- Repeat session ต่อ user มากกว่า Solo/Duo
- Community moment — ทุกคนในทีมได้ผลพร้อมกัน
- Push notification ที่ user รอรับ (ไม่ใช่ spam)

**เหมาะกับ:** แคมเปญ community building, CRM retention, workplace engagement

---

## 3. Differentiation Matrix

| Feature | Solo | Duo | Team |
|---------|------|-----|------|
| Personalized result | ✅ | ✅ | ✅ |
| Social matching | ❌ | ✅ | ✅ |
| Viral loop (built-in) | Weak | ✅ Strong | ✅ Strong |
| Repeat sessions | Low | Medium | High |
| Community moment | ❌ | ❌ | ✅ |
| Push notification trigger | ❌ | ✅ (pair result) | ✅ (team full) |
| Data richness | Individual | Pair | Group |

---

## 4. Pricing Model

### Package

| Tier | Setup (one-time) | Monthly | รวม 3 เดือนแรก |
|------|-----------------|---------|----------------|
| Solo Quiz | 20,000 บาท | 5,000 บาท | 35,000 บาท |
| Duo Quiz | 35,000 บาท | 8,000 บาท | 59,000 บาท |
| Team Quiz | 50,000 บาท | 15,000 บาท | 95,000 บาท |

### รายละเอียด Setup

ครอบคลุม:
- Config campaign ทั้งหมด (คำถาม, ผลลัพธ์, สี, ข้อความ)
- Integration กับ LINE OA ของลูกค้า
- Flex card ทุกใบตามธีม
- Rich menu + auto-reply setup
- ทดสอบ E2E ก่อน launch
- Handoff + คู่มือ admin

### รายละเอียด Monthly

ครอบคลุม:
- Hosting (Vercel + Supabase)
- Support ไม่เกิน 5 change requests/เดือน
- Campaign data report รายเดือน
- Monitoring + incident response

### Volume Add-on (ถ้า scale)

- User > 5,000: +3,000 บาท/เดือน
- User > 20,000: custom pricing

---

## 5. What's Customizable (ผ่าน CMS — ไม่ต้องแตะโค้ด)

| ส่วน | รายละเอียด |
|------|-----------|
| คำถาม | เพิ่ม/ลด/แก้ข้อความ, จำนวนข้อ |
| ผลลัพธ์ (Archetype) | ชื่อ, คำอธิบาย, รูปการ์ด, สูตรคำนวณ |
| สี + Brand | Primary color, font, logo |
| ข้อความทุกจุด | CTA, title, body ในทุก flex card |
| Rich menu | Layout, ปุ่ม, ลิงก์ |
| Auto-reply | Keyword triggers + response |
| Notification | เปิด/ปิด + timing แต่ละ event |

---

## 6. Demo Flow ต่อ Tier (สำหรับ Sales)

### จุดประสงค์ demo
ไม่ใช่แค่ "ดูว่าหน้าตาเป็นยังไง"
แต่ให้ลูกค้าเข้าใจ **ว่า user รู้สึกอะไร** และ **แบรนด์ได้อะไรกลับมา**

### Solo — 4 tap
| Tap | หน้าจอ | สิ่งที่อธิบายให้ลูกค้า |
|-----|--------|----------------------|
| 1 | Intro | "User เข้ามาจาก rich menu หรือลิงก์แชร์ต่อ" |
| 2 | Question | "คำถามออกแบบตามธีมแบรนด์คุณ เปลี่ยนได้ทั้งหมด" |
| 3 | Result | "Personalized → user รู้สึก seen → แชร์เอง" |
| 4 | Share | "ทุกการแชร์ = traffic ใหม่กลับมา OA โดยไม่ซื้อ ads" |

### Duo — 5 tap
| Tap | หน้าจอ | สิ่งที่อธิบายให้ลูกค้า |
|-----|--------|----------------------|
| 1 | Invited | "User ไม่ได้มาเอง เพื่อนพาเข้ามา → acquisition cost = 0" |
| 2 | Question | "ตอบในบริบทที่มีเพื่อนรอ → completion rate สูงกว่า solo" |
| 3 | Matching | "ช่วงรอผล = engagement peak — user จดจำแบรนด์ตอนนี้" |
| 4 | Pair Result | "ผลที่เป็นของสองคนนี้เท่านั้น → เหตุผลที่ต้องแชร์" |
| 5 | ชวนต่อ | "B กลายเป็น A ใหม่ → ชวน C → ชวน D → loop ไม่หยุด" |

### Team — 5 tap
| Tap | หน้าจอ | สิ่งที่อธิบายให้ลูกค้า |
|-----|--------|----------------------|
| 1 | Team Invite | "User ลงทุน (ตอบ + เข้าทีม) → committed → retention สูง" |
| 2 | Progress bar | "การรอให้ทีมครบ = reason to return กลับมา OA หลายครั้ง" |
| 3 | สมาชิกเข้าร่วม | "แต่ละคนที่เข้าทีม = push notification ถึง creator" |
| 4 | ทีมครบ | "Push ถึงทุกคนพร้อมกัน = moment ร่วมกันที่แบรนด์สร้างได้" |
| 5 | Team Result | "ผลที่เกิดได้เฉพาะกลุ่มนี้ → community ที่แบรนด์ own" |

### จบทุก demo ด้วย
> "ทุกอย่างที่เห็น — ปรับธีม คำถาม ผลลัพธ์ สีแบรนด์ได้หมด
> ผ่าน CMS ไม่ต้องแตะโค้ด ไม่ต้องรอ dev"

---

## 7. Development Tracks

### Track A — Demo Product (Apocalypse Squad)
ใช้ showcase ให้ลูกค้า — พัฒนาแล้ว deploy จริง

| งาน | Status |
|-----|--------|
| LIFF app (Solo/Duo/Team flow) | ✅ Done |
| Backend API + DB | ✅ Done |
| Flex cards (F-01 ถึง F-10) | ✅ Done |
| Friend gate + Open-in-LINE | ✅ Done |
| Cron jobs (expire, remind) | ✅ Done |
| E2E test | 🔴 Pending |
| UAT 10 users | 🔴 Pending |
| OA auto-reply setup | 🔴 Pending |
| Rich menu | 🔴 Pending |
| Hero banner (3 product) | 🔴 Pending |

### Track B — Codera Solutions OA (Platform)
ใช้ขายให้ลูกค้า — Dew เป็น owner หลัก

| งาน | Status |
|-----|--------|
| Basic OA features | ✅ Done |
| Quiz LIFF structure (solo/duo/team config) | 🟡 In Progress |
| CMS (question/answer/result) | 🔴 Pending |
| Auto-reply setup UI | 🔴 Pending |
| Standard LIFF template | 🔴 Pending |
| Imitate Codera Solutions OA | 🔴 Pending |
| E2E test | 🔴 Pending |

---

## 8. Go-to-Market — ก่อน Monday

### เป้าหมาย
ส่ง demo + proposal ให้ p'jeed + p'mg ก่อน Monday เพื่อ:
- Validate product-market fit กับ real prospect
- ได้ feedback ปรับ pricing / positioning ก่อน launch
- ปิด deal แรก (Duo หรือ Team tier)

### Timeline
```
วันนี้–พรุ่งนี้   E2E test + fix bugs
                  OA auto-reply + rich menu setup
พรุ่งนี้–มะรืน   UAT 10 users + collect feedback
                  Hero banner 3 product
มะรืน (เย็น)      ส่ง invitation + demo link ให้ p'jeed + p'mg
```

### สิ่งที่ส่งให้ prospect
1. ลิงก์เล่น Apocalypse Squad (Duo demo จริง)
2. เอกสาร product plan นี้ (ปรับ format ให้ clean)
3. Pricing proposal ตาม tier ที่เหมาะกับธุรกิจเขา

---

## 9. คำถามที่ต้องตัดสินใจก่อน Monday

1. **p'jeed + p'mg ธุรกิจประเภทไหน?** → จะได้ pitch tier ที่ใช่
2. **Landing page** → ตอนนี้ยังไม่มี ใช้ LINE OA chat แทนก่อนได้ไหม
3. **Pricing** → ยืนยันตัวเลขก่อน เพราะอาจโดนถามตอน demo
4. **Solo demo** → ชี้ไป Apocalypse Squad (ปรับ mode) หรือสร้าง campaign ใหม่แยก?
