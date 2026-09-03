import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// ---------- default campaign config ----------
export const mockConfig = {
  id: 'buddy_demo',
  mode: 'pair',
  brand: { name: 'BuddyTest', primary: '#E8354F' },
  copy: {},
  axes: [
    { id: 'prep', label: 'เตรียมพร้อม', label_en: 'Prepper',     image_url: 'https://example.com/prep.png' },
    { id: 'live', label: 'ไลฟ์สด',     label_en: 'Influencer',   image_url: 'https://example.com/live.png' },
    { id: 'mu',   label: 'มูเตลู',      label_en: 'Mystic',       image_url: 'https://example.com/mu.png'  },
    { id: 'chill',label: 'ปลงแล้ว',     label_en: 'Chiller',      image_url: 'https://example.com/chill.png' },
    { id: 'line', label: 'วิเคราะห์',   label_en: 'Analyst',      image_url: 'https://example.com/line.png' },
  ],
  questions: [
    { id: 'q1', text: 'คำถาม 1', options: [{ id: 'q1_prep', label: 'ตัวเลือก A' }, { id: 'q1_live', label: 'ตัวเลือก B' }] },
    { id: 'q2', text: 'คำถาม 2', options: [{ id: 'q2_prep', label: 'ตัวเลือก A' }, { id: 'q2_live', label: 'ตัวเลือก B' }] },
  ],
  rewards: { enabled: true, points_per_pair: 50 },
  group:   { enabled: true, max_members: 5, min_members: 3 },
};

// ---------- default summary ----------
export const mockSummary = {
  myArchetype: 'prep',
  myArchetypeLabel: 'เตรียมพร้อม',
  myArchetypeBody: 'คุณเป็นคนเตรียมพร้อมเสมอ',
  myArchetypeEn: 'Prepper',
  pairsDone: 1,
  shareUrl: 'https://liff.line.me/mock?inviterId=Umock123&campaignId=buddy_demo',
  pairs: [
    { pairId: 'pair-001', role: 'inviter', partnerName: 'Partner A', status: 'completed', resultTitle: 'รอด 7 วัน' },
  ],
};

// ---------- default handlers — use wildcard prefix to match any origin ----------
export const handlers = [
  http.get('*/api/campaign/:id',        () => HttpResponse.json(mockConfig)),
  http.get('*/api/quiz/my-answers',     () => HttpResponse.json({ answered: false })),
  http.get('*/api/quiz/my-summary',     () => HttpResponse.json(mockSummary)),
  http.get('*/api/quiz/my-symbols',     () => HttpResponse.json({ unlockedSymbols: [] })),
  http.get('*/api/group/my-groups',     () => HttpResponse.json({ groups: [] })),
  http.post('*/api/quiz/save-answers',  () => HttpResponse.json({
    ok: true, myArchetype: 'prep', myArchetypeLabel: 'เตรียมพร้อม',
    inviterUrl: 'https://liff.line.me/mock',
  })),
  http.post('*/api/quiz/set-name',      () => HttpResponse.json({ ok: true })),
  http.get('*/api/quiz/inviter/:id',    () => HttpResponse.json({
    displayName: 'Partner A', pictureUrl: '', archLabel: 'ไลฟ์สด', archEn: 'Influencer',
  })),
  http.post('*/api/quiz/match',         () => HttpResponse.json({
    pairId: 'pair-001',
    result: { title: 'รอด 7 วัน', body: 'คู่ที่ดี' },
    axisMe: 'เตรียมพร้อม', axisBuddy: 'ไลฟ์สด',
    pushSentToInviter: true, inviterShareUrl: '',
  })),
];

export const server = setupServer(...handlers);
