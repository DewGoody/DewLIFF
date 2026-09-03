# E2E Test Cases — LIFF Survivor Quiz

> **Scope:** End-to-end behavioral tests ครอบคลุมทุก flow หลักและ edge case
> **Platform:** LINE LIFF (ทดสอบใน LINE app เท่านั้น)
> **ระดับความสำคัญ:** 🔴 Critical / 🟡 High / 🟢 Normal

---

## สารบัญ

- [TC-AUTH] Authentication & Initialization
- [TC-A] Flow A — Quiz คนแรก (Inviter)
- [TC-B] Flow B — Invitee (กดลิงก์ invite จากเพื่อน)
- [TC-C] Flow C — Group Join (กดลิงก์กลุ่ม)
- [TC-D] Rewards & Milestones
- [TC-E] Symbol Collection
- [TC-SHARE] Message Sharing (Flex Cards)
- [TC-ERR] Error Handling & Edge Cases
- [TC-PREV] Preview Mode (Admin)

---

## [TC-AUTH] Authentication & Initialization

### TC-AUTH-001 🔴 เปิดใน LINE app — ไม่ได้ login
| | |
|---|---|
| **Pre-condition** | User ยังไม่ได้ login LINE |
| **Steps** | เปิด LIFF URL ใน LINE app |
| **Expected** | `liff.login()` ถูกเรียก → redirect ไปหน้า LINE login |
| **Edge case** | — |

### TC-AUTH-002 🔴 เปิดใน external browser
| | |
|---|---|
| **Pre-condition** | User copy URL ไปเปิดใน Safari/Chrome |
| **Steps** | เปิด LIFF URL ใน browser ธรรมดา |
| **Expected** | แสดงหน้า "เปิดในแอป LINE" พร้อมปุ่มสีเขียว → กดแล้ว redirect ไปยัง `liff.line.me/...` |
| **Edge case** | `liff.isInClient()` returns false |

### TC-AUTH-003 🔴 ยังไม่ได้ add OA เป็นเพื่อน
| | |
|---|---|
| **Pre-condition** | Login แล้ว แต่ `getFriendship().friendFlag = false` |
| **Steps** | เปิด LIFF URL ปกติ |
| **Expected** | แสดงหน้า FriendGate → ปุ่ม "เพิ่มเพื่อน OA" เปิด LINE OA profile |
| **Verify** | กดปุ่ม "เพิ่มแล้ว?" → check friendship อีกครั้ง → ถ้า friendFlag = true → reload |

### TC-AUTH-004 🟡 getFriendship() throw error (API issue)
| | |
|---|---|
| **Pre-condition** | `getFriendship()` ส่ง exception (ไม่ใช่ friendFlag = false) |
| **Steps** | Mock ให้ getFriendship throw |
| **Expected** | App allow ผ่านได้ (ไม่ block user) → console.warn ออก → โหลด flow ปกติ |
| **Note** | "ไม่ใช่เพื่อน" returns `{ friendFlag: false }` ไม่ใช่ error — ดังนั้น exception = API issue |

### TC-AUTH-005 🟡 campaignId parsing — จาก liff.state
| | |
|---|---|
| **Pre-condition** | URL มี `?liff.state=%2F%3FcampaignId%3Dtest123` |
| **Steps** | เปิด URL ที่ encode campaignId ใน liff.state |
| **Expected** | `parseCampaignId()` decode ถูกต้อง → ใช้ `test123` ใน API calls |
| **Edge case** | liff.state อยู่ใน hash (`#liff.state=...`) แทน query string |

### TC-AUTH-006 🟡 ไม่มี campaignId ในทุก source
| | |
|---|---|
| **Pre-condition** | URL ไม่มี campaignId, liff.state, หรือ path pattern |
| **Steps** | เปิด LIFF URL ล้วนๆ |
| **Expected** | Fallback เป็น `'buddy_demo'` → โหลด campaign `buddy_demo` |

### TC-AUTH-007 🟢 set-name — บันทึก displayName
| | |
|---|---|
| **Pre-condition** | Login สำเร็จ |
| **Steps** | Init สำเร็จ |
| **Expected** | `POST /api/quiz/set-name` ถูกเรียกพร้อม `displayName` และ `pictureUrl` |
| **Edge case** | set-name fail → App ไม่ crash (fire-and-forget) |

---

## [TC-A] Flow A — Quiz คนแรก (Inviter)

### TC-A-001 🔴 Happy path — ทำ quiz จบครั้งแรก
| | |
|---|---|
| **Pre-condition** | User login แล้ว, เป็น OA friend, ยังไม่เคยตอบ campaign นี้ |
| **Steps** | 1. เปิด LIFF URL (ไม่มี inviterId/groupId) <br>2. หน้า Intro โหลด <br>3. กดปุ่มเริ่ม <br>4. ตอบคำถามทุกข้อ <br>5. หน้า Matching แสดง |
| **Expected** | `POST /api/quiz/save-answers` → `GET /api/quiz/my-summary` → แสดงหน้า Summary พร้อม archetype card + pair list |
| **Verify** | archetype label แสดงถูกต้อง, ปุ่ม invite เพื่อน active |

### TC-A-002 🔴 กลับมาเปิดใหม่ — ตอบแล้ว
| | |
|---|---|
| **Pre-condition** | User ตอบ campaign นี้แล้ว |
| **Steps** | เปิด LIFF URL ใหม่ (ไม่มี params พิเศษ) |
| **Expected** | `GET /api/quiz/my-answers` → answered = true → ข้าม Intro → โหลด Summary โดยตรง |

### TC-A-003 🟡 กดปุ่ม Back ระหว่างตอบคำถาม
| | |
|---|---|
| **Pre-condition** | อยู่ที่คำถามข้อ 3 (index 2) |
| **Steps** | กดปุ่ม Back |
| **Expected** | กลับไปคำถามข้อ 2 (index 1), คำตอบเดิมยังเก็บอยู่ใน `answers[]` |

### TC-A-004 🟡 กดปุ่ม Back ที่คำถามแรก
| | |
|---|---|
| **Pre-condition** | อยู่ที่คำถามข้อแรก (index 0), ไม่มี inviterId |
| **Steps** | กดปุ่ม Back |
| **Expected** | กลับไปหน้า Intro |

### TC-A-005 🟡 กดปุ่ม Back ที่คำถามแรก — มี inviterId
| | |
|---|---|
| **Pre-condition** | อยู่ที่คำถามข้อแรก, มี `pendingInviterId` ใน state |
| **Steps** | กดปุ่ม Back |
| **Expected** | กลับไปหน้า Invited (ไม่ใช่ Intro) |

### TC-A-006 🟡 save-answers fail → retry
| | |
|---|---|
| **Pre-condition** | ตอบคำถามข้อสุดท้าย |
| **Steps** | Mock `POST /api/quiz/save-answers` ให้ return 500 |
| **Expected** | แสดงหน้า Error พร้อมปุ่ม Retry → กดแล้วกลับไปคำถามข้อสุดท้าย พร้อม answers เดิม (ยกเว้นตัวสุดท้ายที่เพิ่งตอบ) |

### TC-A-007 🟢 Demo mode
| | |
|---|---|
| **Pre-condition** | กดปุ่ม Demo (ถ้ามี) |
| **Steps** | 1. กด Demo <br>2. ตอบคำถามทุกข้อ |
| **Expected** | `POST /api/quiz/start` (demo:true) → `POST /api/quiz/answer` → แสดง popup result → กลับไปหน้า Intro (ไม่ใช่ Summary) |

### TC-A-008 🟢 my-answers check fail → ไม่ block
| | |
|---|---|
| **Pre-condition** | Default flow, `GET /api/quiz/my-answers` throw error |
| **Steps** | Mock my-answers ให้ fail |
| **Expected** | console.warn ออก, App แสดงหน้า Intro ปกติ (ไม่ error) |

---

## [TC-B] Flow B — Invitee (กดลิงก์ invite)

### TC-B-001 🔴 Happy path — B ยังไม่เคยตอบ
| | |
|---|---|
| **Pre-condition** | URL มี `?inviterId=userA&campaignId=xxx`, B ยังไม่ได้ตอบ |
| **Steps** | 1. เปิด URL <br>2. หน้า Invited แสดง (avatar + ชื่อ A + archetype A) <br>3. กดเริ่ม <br>4. ตอบคำถามทุกข้อ |
| **Expected** | `POST /api/quiz/match` (inviterId: A) → Matching animation → Summary พร้อม popup pair result |
| **Verify** | popup แสดง: survival title, body, ชื่อ A, axis ทั้งสอง |

### TC-B-002 🔴 B ตอบแล้ว — auto-match
| | |
|---|---|
| **Pre-condition** | URL มี `?inviterId=userA`, B ตอบแล้ว |
| **Steps** | เปิด URL |
| **Expected** | `GET /api/quiz/my-answers` → answered=true → แสดง Matching animation ทันที → `POST /api/quiz/match` → Summary + popup |
| **Verify** | ข้าม Invited/Question screen ไปเลย |

### TC-B-003 🔴 B กดลิงก์ invite ของตัวเอง
| | |
|---|---|
| **Pre-condition** | inviterId = B's own userId |
| **Steps** | เปิด URL ที่ inviterId ตรงกับ userId ของตัวเอง |
| **Expected** | `POST /api/quiz/match` return error "ตัวเอง" → App โหลด Summary แทน (ถ้ามี) หรือกลับ Intro |

### TC-B-004 🟡 inviterId ไม่มีในระบบ / ไม่เคยตอบ
| | |
|---|---|
| **Pre-condition** | `GET /api/quiz/inviter/{id}` return 404 |
| **Steps** | เปิด URL ที่ inviterId ไม่ valid |
| **Expected** | `showError('ลิงก์ไม่ถูกต้อง', ...)` → หน้า Error |

### TC-B-005 🟡 OA push ไม่สำเร็จ → B ส่ง Flex card เอง
| | |
|---|---|
| **Pre-condition** | `POST /api/quiz/match` return `pushSentToInviter: false, inviterShareUrl: '...'` |
| **Steps** | B ตอบครบ → match สำเร็จแต่ push ล้มเหลว |
| **Expected** | `liff.shareTargetPicker()` ถูกเรียกโดยอัตโนมัติ พร้อม Flex card ที่มี: survival title, axis boxes (A gray, B yellow), footer CTA |
| **Verify** | Flex card altText ไม่เกิน 400 ตัวอักษร |

### TC-B-006 🟡 OA push ไม่สำเร็จ แต่ `inviterShareUrl` ว่าง
| | |
|---|---|
| **Pre-condition** | `pushSentToInviter: false, inviterShareUrl: undefined` |
| **Steps** | เหมือน TC-B-005 |
| **Expected** | **ไม่** เรียก shareTargetPicker → ไปหน้า Summary ปกติ |

### TC-B-007 🟢 B ตอบแล้ว + auto-match fail (ไม่ใช่ self-invite)
| | |
|---|---|
| **Pre-condition** | B ตอบแล้ว, แต่ match API fail ด้วย error อื่น (เช่น inviter ไม่มีคำตอบ) |
| **Steps** | Mock match API ให้ throw error ที่ไม่มีคำว่า "ตัวเอง" |
| **Expected** | แสดงหน้า Invited (ให้ B เริ่มใหม่) |

### TC-B-008 🟢 liff.state encoding — inviterId อยู่ใน hash
| | |
|---|---|
| **Pre-condition** | URL: `https://liff.line.me/xxx#liff.state=%2F%3FinviterId%3DuserA` |
| **Steps** | เปิด URL |
| **Expected** | `resolveParams()` decode จาก hash ได้ถูกต้อง → โหลด Invited screen |

---

## [TC-C] Flow C — Group Join

### TC-C-001 🔴 Happy path — C ยังไม่ตอบ + join group
| | |
|---|---|
| **Pre-condition** | URL มี `?groupId=gXXX`, C ยังไม่ได้ตอบ |
| **Steps** | 1. เปิด URL <br>2. หน้า Invited (team mode) แสดง progress bar สมาชิก <br>3. กดเริ่ม <br>4. ตอบคำถามทุกข้อ |
| **Expected** | `POST /api/group/{gid}/join` → Matching animation กับ creator → background match สมาชิกคนอื่น → หน้า Group |

### TC-C-002 🔴 C ตอบแล้ว + join group (skip quiz)
| | |
|---|---|
| **Pre-condition** | URL มี `?groupId=gXXX`, C ตอบแล้ว (`my-answers.answered = true`) |
| **Steps** | เปิด URL |
| **Expected** | ข้ามหน้า Question → `POST /api/group/{gid}/join` → Matching animation → Group screen |

### TC-C-003 🔴 C เป็นสมาชิกกลุ่มอยู่แล้ว
| | |
|---|---|
| **Pre-condition** | URL มี `?groupId=gXXX`, C อยู่ใน `members[]` แล้ว |
| **Steps** | เปิด URL |
| **Expected** | Skip ทุกอย่าง → ถ้าตอบแล้วโหลด Summary → setScreen('group') |
| **Verify** | ไม่มีการ join ซ้ำ |

### TC-C-004 🟡 กลุ่มเต็มแล้ว (isFull = true) — C เป็นสมาชิก
| | |
|---|---|
| **Pre-condition** | `memberCount >= maxMembers`, C เป็นสมาชิก |
| **Steps** | เปิด URL |
| **Expected** | setScreen('group') โดยตรง |

### TC-C-005 🟡 กลุ่มเต็มแล้ว — C ไม่ใช่สมาชิก, ตอบแล้ว
| | |
|---|---|
| **Pre-condition** | `groupIsFull = true`, C ไม่ใช่สมาชิก, C ตอบแล้ว |
| **Steps** | กด Start ใน Invited screen |
| **Expected** | โหลด Summary → แสดงหน้า Summary (ไม่ join กลุ่ม) |

### TC-C-006 🟡 Batch matching — match creator visible, match คนอื่น background
| | |
|---|---|
| **Pre-condition** | กลุ่มมี 3 สมาชิก: creator + memberB + memberC, C เป็นคนเข้าใหม่ |
| **Steps** | C join group |
| **Expected** | Match กับ creator แสดง Matching animation → match กับ memberB และ memberC แบบ background (ไม่มี animation) → Group screen |
| **Verify** | `POST /api/quiz/match` ถูกเรียก 3 ครั้ง (1 visible + 2 background) |

### TC-C-007 🟡 `GET /api/group/{gid}` fail ตอน init
| | |
|---|---|
| **Pre-condition** | Group API throw error |
| **Steps** | เปิด URL ที่มี groupId |
| **Expected** | App ไม่ crash → แสดงหน้า Invited ต่อได้ (group info เป็น null) |
| **Note** | Error ถูก catch ด้วย `catch { /* non-critical */ }` |

### TC-C-008 🟡 Group.tsx — rename group (creator เท่านั้น)
| | |
|---|---|
| **Pre-condition** | User เป็น creator ของกลุ่ม |
| **Steps** | แก้ชื่อกลุ่มในช่อง input → กด save |
| **Expected** | `PATCH /api/group/{gid}/name` → ชื่อกลุ่มอัปเดต |
| **Edge case** | User ที่ไม่ใช่ creator → field เป็น read-only |

### TC-C-009 🟢 `viewOnly: true` — join สำเร็จแต่เป็น view only
| | |
|---|---|
| **Pre-condition** | `POST /api/group/{gid}/join` returns `{ ok: true, viewOnly: true }` |
| **Steps** | C join group ขณะที่ตอบแล้ว |
| **Expected** | ไม่แสดง Matching animation → ข้ามไป Group screen โดยตรง |

---

## [TC-D] Rewards & Milestones

### TC-D-001 🔴 เปิดหน้า Rewards — milestone ยังไม่ถึง
| | |
|---|---|
| **Pre-condition** | pairsDone = 1, milestone trigger_pairs = 3 |
| **Steps** | กดปุ่ม Rewards จาก Summary |
| **Expected** | `GET /api/quiz/rewards/my/{campaignId}` → แสดง milestone พร้อม progress bar (1/3) → ปุ่ม Claim disabled |

### TC-D-002 🔴 Claim reward — ถึง milestone แล้ว
| | |
|---|---|
| **Pre-condition** | pairsDone = 3, milestone trigger_pairs = 3, ยังไม่ได้ claim |
| **Steps** | กดปุ่ม Claim |
| **Expected** | `POST /api/quiz/rewards/claim` → refresh claims → ปุ่มเปลี่ยนเป็น "รับแล้ว" พร้อม code |

### TC-D-003 🟡 Claim แล้ว — กลับมาดูอีกครั้ง
| | |
|---|---|
| **Pre-condition** | milestone ถูก claim แล้ว (`claims[]` มี entry) |
| **Steps** | เปิดหน้า Rewards |
| **Expected** | ปุ่ม Claim แสดงเป็น "รับแล้ว" พร้อม code ทันที (ไม่ต้องกดอีก) |

### TC-D-004 🟡 Rewards API fail
| | |
|---|---|
| **Pre-condition** | `GET /api/quiz/rewards/my/{campaignId}` throw error |
| **Steps** | กดปุ่ม Rewards |
| **Expected** | `rewardClaims = []` (fallback) → ยังเปิดหน้า Rewards ได้ |

### TC-D-005 🟡 rewards.enabled = false ใน config
| | |
|---|---|
| **Pre-condition** | config.rewards.enabled = false |
| **Steps** | แสดงหน้า Summary |
| **Expected** | ปุ่ม Rewards ไม่แสดง |

### TC-D-006 🟢 ไม่มี milestones config — แสดง legacy card
| | |
|---|---|
| **Pre-condition** | `config.rewards` มี enabled=true แต่ไม่มี milestones[] |
| **Steps** | เปิดหน้า Rewards |
| **Expected** | แสดง legacy card "ครบ 3 คู่ = ลุ้นรางวัล" |

---

## [TC-E] Symbol Collection

### TC-E-001 🔴 Share group → unlock symbol
| | |
|---|---|
| **Pre-condition** | อยู่หน้า Group, ยังไม่เคย share |
| **Steps** | กดปุ่ม Share กลุ่ม |
| **Expected** | `liff.shareTargetPicker()` เรียก → user เลือก chat → `POST /api/group/{gid}/share` → toast "symbol unlocked" แสดง |

### TC-E-002 🟡 ครบทุก symbol → collector bonus unlock
| | |
|---|---|
| **Pre-condition** | Unlock symbol ครบทุก archetype |
| **Steps** | หน้า Rewards — symbol grid |
| **Expected** | แสดง bonus reward (sticker pack / rich menu / certificate) |

### TC-E-003 🟡 share group แล้ว — กดอีกครั้ง
| | |
|---|---|
| **Pre-condition** | `hasShared = true` |
| **Steps** | กดปุ่ม Share กลุ่มอีกครั้ง |
| **Expected** | เรียก shareTargetPicker ได้อีก แต่ `POST /api/group/{gid}/share` อาจ return ว่า already shared (backend handle idempotency) |

### TC-E-004 🟢 shareTargetPicker ถูก cancel โดย user
| | |
|---|---|
| **Pre-condition** | อยู่หน้า Group |
| **Steps** | กดปุ่ม Share → ปิด picker โดยไม่เลือก chat |
| **Expected** | App ไม่ crash, `setShareError` หรือ silent fail, ไม่เรียก `/api/group/{gid}/share` |

---

## [TC-SHARE] Message Sharing (Flex Cards)

### TC-SHARE-001 🔴 F-01: Duo Invite จาก Summary
| | |
|---|---|
| **Pre-condition** | อยู่หน้า Summary |
| **Steps** | กดปุ่ม Invite เพื่อน |
| **Expected** | `liff.shareTargetPicker()` ถูกเรียกพร้อม Flex card ที่มี: KV hero image, ชื่อ inviter, archetype label, CTA "Match กับฉัน" |
| **Verify** | CTA URI มี `campaignId` และ `inviterId` ถูกต้อง |

### TC-SHARE-002 🔴 F-02: Solo Share จาก Summary
| | |
|---|---|
| **Pre-condition** | อยู่หน้า Summary |
| **Steps** | กดปุ่ม Share ผลตัวเอง |
| **Expected** | Flex card มี: axis card image, archetype name (Thai + English), body text, CTA ไปที่ quiz |

### TC-SHARE-003 🔴 F-03: Pair Result Share จาก PairResult
| | |
|---|---|
| **Pre-condition** | อยู่หน้า PairResult |
| **Steps** | กดปุ่ม Share |
| **Expected** | OG image ถูก generate (`/api/og?type=pair&...`) + Flex card มี: rank (X/15), reason, "Invite to quiz" CTA |

### TC-SHARE-004 🟡 F-10: Group Invite จาก Group screen
| | |
|---|---|
| **Pre-condition** | อยู่หน้า Group |
| **Steps** | กดปุ่ม Invite more |
| **Expected** | Flex card มี: fan cards (สูงสุด 5 สมาชิก), archetype result, progress bar, CTA "Join group" พร้อม `groupId` |

### TC-SHARE-005 🟡 shareTargetPicker ไม่ support (ไม่ได้อยู่ใน LINE client)
| | |
|---|---|
| **Pre-condition** | `liff.isInClient() = false` (เช่น external browser ที่ bypass ผ่านได้) |
| **Steps** | กดปุ่ม Share |
| **Expected** | ปุ่ม disabled หรือ error toast — ไม่ crash |

### TC-SHARE-006 🟢 Flex altText ยาวเกิน 400 ตัวอักษร
| | |
|---|---|
| **Pre-condition** | inviterName ยาวมาก |
| **Steps** | B match กับ A (TC-B-005) |
| **Expected** | altText ถูก `.slice(0, 400)` → ไม่ overflow |

---

## [TC-ERR] Error Handling & Edge Cases

### TC-ERR-001 🔴 Network error ระหว่าง init
| | |
|---|---|
| **Pre-condition** | ไม่มีอินเทอร์เน็ต |
| **Steps** | เปิด app |
| **Expected** | แสดงหน้า Error: "เครือข่ายมีปัญหา กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" |

### TC-ERR-002 🔴 500 error จาก backend
| | |
|---|---|
| **Pre-condition** | API return 500 |
| **Steps** | ทำ action ใดก็ตามที่เรียก API |
| **Expected** | แสดง "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" (ไม่แสดง raw error) |

### TC-ERR-003 🔴 401 / token หมดอายุ
| | |
|---|---|
| **Pre-condition** | Token หมดอายุ, API return 401 |
| **Steps** | เรียก API ใดก็ตาม |
| **Expected** | แสดง "เซสชันหมดอายุ กรุณาเปิดลิงก์ใหม่" |

### TC-ERR-004 🟡 Error message ภาษาอังกฤษ / technical string
| | |
|---|---|
| **Pre-condition** | Error message มี "undefined", "null", "Error:", หรือยาวกว่า 80 ตัวอักษร |
| **Steps** | เกิด error จาก API |
| **Expected** | แสดง "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" (ไม่แสดง raw string) |

### TC-ERR-005 🟡 ErrorScreen retry button
| | |
|---|---|
| **Pre-condition** | มีการเรียก showError() พร้อม retryFn |
| **Steps** | แสดงหน้า Error → กดปุ่ม Retry |
| **Expected** | retryFn ถูกเรียก → กลับไปสถานะก่อน error |

### TC-ERR-006 🟡 pairId จาก push notification — ไม่ใช่ participant
| | |
|---|---|
| **Pre-condition** | URL มี `?pairId=pXXX`, user ไม่ได้อยู่ใน pair นั้น |
| **Steps** | เปิด URL |
| **Expected** | `GET /api/quiz/my-summary` fail → setScreen('intro') |

### TC-ERR-007 🟡 pairId จาก push — pair status ≠ 'completed'
| | |
|---|---|
| **Pre-condition** | URL มี `?pairId=pXXX`, pair.status = 'waiting' |
| **Steps** | เปิด URL |
| **Expected** | โหลด Summary ปกติ แต่ **ไม่** มี initialPopup |

### TC-ERR-008 🟢 create group fail
| | |
|---|---|
| **Pre-condition** | `POST /api/group/create` throw error |
| **Steps** | กดปุ่ม Create group จาก Summary |
| **Expected** | showError('สร้างกลุ่มไม่สำเร็จ', ...) |

### TC-ERR-009 🟢 handleViewPair — pair status = waiting
| | |
|---|---|
| **Pre-condition** | กด pair ที่ status = 'waiting' |
| **Steps** | คลิก pair ใน list |
| **Expected** | `GET /api/pair/{id}` return status='waiting' → **ไม่** navigate ไป PairResult (condition `status === 'completed'` ไม่ผ่าน) |

---

## [TC-PREV] Preview Mode (Admin)

### TC-PREV-001 🟡 Preview mode — receive config from parent
| | |
|---|---|
| **Pre-condition** | URL มี `?preview=1` |
| **Steps** | Parent postMessage `{ type: 'preview_config', config: {...}, startScreen: 'summary' }` |
| **Expected** | App apply config + theme → setScreen('summary') |
| **Verify** | Screen ที่ไม่ valid (เช่น 'matching') → fallback เป็น 'intro' |

### TC-PREV-002 🟡 Preview mode — skip real LIFF init
| | |
|---|---|
| **Pre-condition** | `?preview=1` |
| **Steps** | โหลด app |
| **Expected** | `liff.init()` **ไม่** ถูกเรียก, ไม่มี API call ไป backend จริง |

### TC-PREV-003 🟡 Preview mode — screen change postMessage
| | |
|---|---|
| **Pre-condition** | Preview mode |
| **Steps** | เปลี่ยน screen ใดก็ตาม |
| **Expected** | `window.parent.postMessage({ type: 'preview_screen', screen }, '*')` ถูกส่งทุกครั้ง |

### TC-PREV-004 🟢 Preview mode — ตอบคำถามจบ
| | |
|---|---|
| **Pre-condition** | Preview mode, อยู่หน้า Question |
| **Steps** | ตอบคำถามทุกข้อ |
| **Expected** | ไม่เรียก API → set mock summaryData → แสดงหน้า Summary |

---

## Summary Matrix

| ID | Flow | Priority | Category |
|---|---|---|---|
| TC-AUTH-001 | Redirect to LINE login | 🔴 | Auth |
| TC-AUTH-002 | External browser gate | 🔴 | Auth |
| TC-AUTH-003 | Friend gate | 🔴 | Auth |
| TC-AUTH-004 | getFriendship error fallthrough | 🟡 | Auth / Edge |
| TC-AUTH-005 | liff.state campaignId decode | 🟡 | URL Parsing |
| TC-A-001 | First quiz — happy path | 🔴 | Flow A |
| TC-A-002 | Return user — skip to summary | 🔴 | Flow A |
| TC-A-003 | Back button mid-quiz | 🟡 | Flow A |
| TC-A-006 | save-answers fail + retry | 🟡 | Flow A / Error |
| TC-B-001 | Invitee — first time | 🔴 | Flow B |
| TC-B-002 | Invitee — already answered | 🔴 | Flow B |
| TC-B-003 | Self-invite | 🔴 | Flow B / Edge |
| TC-B-005 | Push fail → B sends Flex | 🟡 | Flow B / Share |
| TC-C-001 | Group join — first time | 🔴 | Flow C |
| TC-C-002 | Group join — already answered | 🔴 | Flow C |
| TC-C-003 | Already a group member | 🔴 | Flow C |
| TC-C-006 | Batch matching | 🟡 | Flow C |
| TC-D-001 | Rewards — milestone not reached | 🔴 | Rewards |
| TC-D-002 | Claim reward | 🔴 | Rewards |
| TC-E-001 | Share group → symbol unlock | 🔴 | Symbol |
| TC-SHARE-001 | F-01 Duo invite card | 🔴 | Share |
| TC-SHARE-002 | F-02 Solo share card | 🔴 | Share |
| TC-ERR-001 | Network error | 🔴 | Error |
| TC-ERR-002 | 500 error friendly message | 🔴 | Error |
| TC-ERR-003 | 401 token expired | 🔴 | Error |
