# Reply Flows Per Mode

แต่ละ campaign type + mode มีเหตุการณ์ต่างกัน Reply Designer ต้องแสดงเฉพาะ flow ที่เกี่ยวข้อง

---

## Flow Events ตาม Type + Mode

### Quiz — Pair Mode (6 events)

```
01  ข้อความต้อนรับ         Reply · ฟรี      follow event
02  การ์ดชวนเพื่อน         ShareTargetPicker  A กด share
03  ผลลัพธ์ใน Chat         Reply · ฟรี      liff.sendMessages → webhook
04  แจ้งคู่หูตอบแล้ว        Push · quota     B ตอบเสร็จ → push หา A
05  Keyword → Card        Reply · ฟรี      user พิมพ์ keyword
06  แชร์ผลลัพธ์            ShareTargetPicker  กดอวดผลให้คนอื่น
```

### Quiz — Solo Mode (4 events)

```
01  ข้อความต้อนรับ         Reply · ฟรี      follow event
02  ผลลัพธ์ใน Chat         Reply · ฟรี      liff.sendMessages → webhook
03  Keyword → Card        Reply · ฟรี      user พิมพ์ keyword
04  แชร์ผลลัพธ์            ShareTargetPicker  กดอวดผลให้คนอื่น
```

**ไม่มี:** การ์ดชวนเพื่อน (ไม่ต้อง share ก่อนเล่น), แจ้งคู่หูตอบแล้ว (ไม่มีคู่หู)

### Lucky Draw (4 events)

```
01  ข้อความต้อนรับ         Reply · ฟรี      follow event
02  Keyword → Imagemap    Reply · ฟรี      user พิมพ์ keyword
03  ผลสุ่มรางวัล           Reply · ฟรี      กดช่องใน Imagemap → webhook
04  แชร์ผลสุ่ม             ShareTargetPicker  กดแชร์ผลรางวัล
```

**ไม่มี push เลย — ทุกจุดฟรี!**

### Stamp Card (5 events)

```
01  ข้อความต้อนรับ         Reply · ฟรี      follow event
02  Keyword → Card        Reply · ฟรี      user พิมพ์ keyword
03  สะสมครบ milestone      Reply · ฟรี      scan QR / check-in → webhook
04  สะสมครบทั้งหมด → รางวัล Reply · ฟรี      ครบตาม config
05  แชร์ให้เพื่อน           ShareTargetPicker  กดแชร์
```

---

## Flow Event Registry

ระบบเก็บ flow template ต่อ type:

```javascript
const FLOW_REGISTRY = {

  // ── Quiz Pair ──
  'buddy_quiz:pair': [
    {
      id: 'welcome',
      title: 'ข้อความต้อนรับ',
      channel: 'reply',       // reply | push | share
      trigger: 'User กด Follow OA → webhook follow event',
      api: 'POST /api/webhook/line → replyToken',
      fields: [
        { key: 'enabled', type: 'bool' },
        { key: 'body', type: 'textarea' }
      ]
    },
    {
      id: 'invite',
      title: 'การ์ดชวนเพื่อน',
      channel: 'share',
      trigger: 'A กด "เลือกเพื่อนแล้วส่ง" → shareTargetPicker',
      api: 'liff.shareTargetPicker()',
      fields: [
        { key: 'alt_text', type: 'text' },
        { key: 'title', type: 'text', vars: ['{inviter}'] },
        { key: 'body', type: 'text' },
        { key: 'cta', type: 'text' }
      ]
    },
    {
      id: 'chat_result',
      title: 'ผลลัพธ์ใน Chat',
      channel: 'reply',
      trigger: 'ตอบครบ → liff.sendMessages → webhook จับ #ref',
      api: 'liff.sendMessages() → webhook → replyToken',
      fields: [
        { key: 'enabled', type: 'bool' },
        { key: 'user_text', type: 'text' },
        { key: 'eyebrow', type: 'text' },
        { key: 'cta', type: 'text' }
      ]
    },
    {
      id: 'partner_done',
      title: 'แจ้งคู่หูตอบแล้ว',
      channel: 'push',
      trigger: 'B ตอบครบ → pg-boss queue → push หา A',
      api: 'pg-boss: push-notification',
      fields: [
        { key: 'alt_text', type: 'text' },
        { key: 'title', type: 'text' },
        { key: 'body', type: 'text' },
        { key: 'cta', type: 'text' }
      ]
    },
    {
      id: 'keyword_card',
      title: 'Keyword → Campaign Card',
      channel: 'reply',
      trigger: 'User พิมพ์ keyword → match → reply',
      api: 'POST /api/webhook/line → keyword_rules',
      showKeywords: true,
      fields: [
        { key: 'title', type: 'text' },
        { key: 'body', type: 'text' },
        { key: 'cta', type: 'text' }
      ]
    },
    {
      id: 'share_result',
      title: 'แชร์ผลลัพธ์',
      channel: 'share',
      trigger: 'กด "อวดผลให้คนอื่น" → shareTargetPicker',
      api: 'liff.shareTargetPicker()',
      fields: [
        { key: 'alt_text', type: 'text' },
        { key: 'title', type: 'text' },
        { key: 'body', type: 'text' },
        { key: 'cta', type: 'text' }
      ]
    }
  ],

  // ── Quiz Solo ──
  'buddy_quiz:solo': [
    // welcome — เหมือน pair
    { id: 'welcome', title: 'ข้อความต้อนรับ', channel: 'reply',
      trigger: 'User กด Follow OA',
      fields: [{ key: 'enabled', type: 'bool' }, { key: 'body', type: 'textarea' }] },

    // chat_result — เหมือน pair แต่ไม่มี partner
    { id: 'chat_result', title: 'ผลลัพธ์ใน Chat', channel: 'reply',
      trigger: 'ตอบครบ → liff.sendMessages → webhook',
      fields: [
        { key: 'enabled', type: 'bool' },
        { key: 'user_text', type: 'text' },
        { key: 'cta', type: 'text' }
      ] },

    // keyword
    { id: 'keyword_card', title: 'Keyword → Campaign Card', channel: 'reply',
      trigger: 'User พิมพ์ keyword', showKeywords: true,
      fields: [{ key: 'title', type: 'text' }, { key: 'body', type: 'text' }, { key: 'cta', type: 'text' }] },

    // share
    { id: 'share_result', title: 'แชร์ผลลัพธ์', channel: 'share',
      trigger: 'กด "อวดผลให้คนอื่น"',
      fields: [{ key: 'alt_text', type: 'text' }, { key: 'cta', type: 'text' }] }
  ],

  // ── Lucky Draw ──
  'lucky_draw': [
    { id: 'welcome', title: 'ข้อความต้อนรับ', channel: 'reply',
      trigger: 'User กด Follow OA',
      fields: [{ key: 'enabled', type: 'bool' }, { key: 'body', type: 'textarea' }] },

    { id: 'keyword_imagemap', title: 'Keyword → Imagemap สุ่ม', channel: 'reply',
      trigger: 'User พิมพ์ keyword → ส่ง Imagemap 9 ช่อง', showKeywords: true,
      fields: [
        { key: 'image_url', type: 'text', hint: 'รูป 1040×1040 สำหรับ 9 ช่อง' },
        { key: 'alt_text', type: 'text' }
      ] },

    { id: 'draw_result', title: 'ผลสุ่มรางวัล', channel: 'reply',
      trigger: 'กดช่องใน Imagemap → postback/message → webhook สุ่ม+ตอบ',
      fields: [
        { key: 'win_title', type: 'text', hint: 'ยินดีด้วย! คุณได้ {prize}' },
        { key: 'win_cta', type: 'text', hint: 'ปุ่ม เช่น "ใช้สิทธิ์"' },
        { key: 'lose_title', type: 'text', hint: 'เสียใจด้วย' },
        { key: 'lose_body', type: 'text' },
        { key: 'used_title', type: 'text', hint: 'วันนี้สุ่มแล้ว' }
      ] },

    { id: 'share_result', title: 'แชร์ผลสุ่ม', channel: 'share',
      trigger: 'กดแชร์ผลรางวัล',
      fields: [{ key: 'alt_text', type: 'text' }, { key: 'cta', type: 'text' }] }
  ]
};
```

---

## Reply Designer — แสดงตาม mode

```
เปิด Reply Designer (?id=buddy_demo)
    │
    ▼
โหลด campaign config → ดู type + mode
    │
    ├── type: buddy_quiz, mode: pair → แสดง 6 flows
    ├── type: buddy_quiz, mode: solo → แสดง 4 flows
    ├── type: lucky_draw             → แสดง 4 flows
    └── type: stamp_card             → แสดง 5 flows
```

### UI ที่แตกต่าง

```
┌─ Reply Designer ─── buddy_demo ─── pair ─────────────────┐
│                                                          │
│  จุดที่ส่งข้อความ: 6      ฟรี: 5      Push: 1             │
│                                                          │
│  01 ข้อความต้อนรับ          Reply · ฟรี                   │
│  02 การ์ดชวนเพื่อน          ShareTargetPicker             │
│  03 ผลลัพธ์ใน Chat          Reply · ฟรี                   │
│  04 แจ้งคู่หูตอบแล้ว         Push · นับ quota   ← pair only │
│  05 Keyword → Card         Reply · ฟรี                   │
│  06 แชร์ผลลัพธ์             ShareTargetPicker             │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ Reply Designer ─── mbti_demo ─── solo ──────────────────┐
│                                                          │
│  จุดที่ส่งข้อความ: 4      ฟรี: 4      Push: 0    ← ฟรีหมด! │
│                                                          │
│  01 ข้อความต้อนรับ          Reply · ฟรี                   │
│  02 ผลลัพธ์ใน Chat          Reply · ฟรี                   │
│  03 Keyword → Card         Reply · ฟรี                   │
│  04 แชร์ผลลัพธ์             ShareTargetPicker             │
│                                                          │
│  ไม่มี "การ์ดชวนเพื่อน" เพราะไม่ต้อง share ก่อนเล่น       │
│  ไม่มี "แจ้งคู่หูตอบแล้ว" เพราะไม่มีคู่หู                  │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ Reply Designer ─── lucky_001 ─── lucky_draw ────────────┐
│                                                          │
│  จุดที่ส่งข้อความ: 4      ฟรี: 4      Push: 0             │
│                                                          │
│  01 ข้อความต้อนรับ          Reply · ฟรี                   │
│  02 Keyword → Imagemap     Reply · ฟรี    ← ส่ง 9 ช่อง   │
│  03 ผลสุ่มรางวัล            Reply · ฟรี    ← ชนะ/แพ้/หมดสิทธิ์ │
│  04 แชร์ผลสุ่ม              ShareTargetPicker             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Channel Types (วิธีส่ง)

| Channel | ค่าใช้จ่าย | ใช้ตอน | API |
|---------|-----------|--------|-----|
| `reply` | **ฟรี** | มี event เข้ามา (พิมพ์/follow/postback) | replyToken |
| `share` | **ฟรี** | user กดปุ่มบน LIFF | shareTargetPicker |
| `push` | **นับ quota** | ไม่มี event จาก user ที่จะส่งหา | push API |

---

## Surface (ข้อความไปอยู่ที่ไหน)

| Surface | อธิบาย | เห็นอะไร |
|---------|--------|---------|
| `oa` | แชทระหว่าง user กับ OA | การ์ด/ข้อความใน chat OA |
| `friend` | แชท 1:1 ระหว่าง user กับเพื่อน | เพื่อนเห็นการ์ดเหมือนได้จาก user |
| `push` | Notification + แชท OA | Banner notification + การ์ดใน chat |

---

## สรุป

- Reply Designer ดึง flow template จาก `FLOW_REGISTRY[type:mode]`
- แต่ละ type มี events ต่างกัน — admin เห็นเฉพาะ event ที่เกี่ยวข้อง
- เพิ่ม campaign type ใหม่ = เพิ่ม entry ใน FLOW_REGISTRY
- ทุก flow มี: trigger (อะไรเกิดขึ้น), channel (ส่งยังไง), fields (ตั้งค่าอะไรได้), preview (หน้าตาใน chat)
