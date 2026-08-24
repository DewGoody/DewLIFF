import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchSettings,
  saveSetting,
  fetchKeywords,
  updateKeyword,
  type KeywordRule,
} from '../api';

const SURFACES: Record<string, { label: string; who: string; note: string }> = {
  oa: { label: 'แชท OA', who: 'Krob OA', note: 'อยู่ในแชทระหว่าง user กับ OA' },
  friend: { label: 'แชทเพื่อน', who: 'พลอย', note: 'ส่งในนาม user → ไปอยู่ในแชท 1:1 ของเพื่อน ไม่ใช่แชท OA' },
  push: { label: 'Notification + แชท OA', who: 'Krob OA', note: 'A ปิดแอปไปแล้ว — banner คือสิ่งเดียวที่เห็นตอนแรก' },
};

interface TriggerLine { mark: string; text: string; }
interface FieldDef { k: string; label: string; type: 'text' | 'area' | 'bool'; hint: string; }

interface FlowDef {
  id: string;
  mark: string;
  title: string;
  channel: 'reply' | 'share' | 'push';
  surface: 'oa' | 'friend' | 'push';
  picker?: boolean;
  keywords?: boolean;
  incoming?: string;
  trigger: TriggerLine[];
  api: string;
  preview: 'text' | 'flex';
  fields: FieldDef[];
  note: string;
}

const FLOWS: FlowDef[] = [
  {
    id: 'welcome', mark: '01', title: 'ข้อความต้อนรับ', channel: 'reply', surface: 'oa',
    trigger: [
      { mark: '✓', text: 'User กด "เพิ่มเพื่อน" กับ OA — LINE ยิง follow event เข้า webhook' },
      { mark: '⚙', text: 'ตอบด้วย replyToken ภายใน 1 นาที ไม่นับ quota' },
    ],
    api: 'POST /api/webhook/line · event: follow → oa_settings.welcome',
    preview: 'text',
    fields: [
      { k: 'enabled', label: 'เปิดใช้งาน', type: 'bool', hint: 'ปิดแล้ว user ที่ add friend จะไม่ได้รับอะไรเลย' },
      { k: 'body', label: 'ข้อความ', type: 'area', hint: 'บอกวิธีเริ่มเล่นให้ชัด — คนส่วนใหญ่อ่านแค่บรรทัดนี้' },
    ],
    note: 'Text message ธรรมดา · ไม่มีปุ่ม ต้องพิมพ์ keyword เอง',
  },
  {
    id: 'invite', mark: '02', title: 'การ์ดชวนเพื่อน', channel: 'share', surface: 'friend', picker: true,
    trigger: [
      { mark: '✓', text: 'A ตอบครบแล้วกด "เลือกเพื่อนแล้วส่ง" ในหน้า Share' },
      { mark: '⚙', text: 'liff.shareTargetPicker() — ส่งในนาม user ฟรี' },
    ],
    api: 'POST /api/quiz/start → invite token → Flex ผูก ?token=xxx',
    preview: 'flex',
    fields: [
      { k: 'altText', label: 'Alt text', type: 'text', hint: 'ข้อความที่โผล่ในรายการแชทและ notification ของเพื่อน — LINE บังคับมีทุก Flex' },
      { k: 'title', label: 'หัวการ์ด', type: 'text', hint: 'ใช้ {inviter} แทนชื่อคนชวน' },
      { k: 'body', label: 'บรรทัดรอง', type: 'text', hint: 'บอกว่าใช้เวลาสั้น ช่วยเพิ่ม conversion' },
      { k: 'cta', label: 'ปุ่ม', type: 'text', hint: 'กดแล้วเปิด LIFF พร้อม token ของ pair นี้' },
    ],
    note: 'B เห็นการ์ดนี้ในแชทของ A · token อายุตาม Rules',
  },
  {
    id: 'chat_result', mark: '03', title: 'ผลลัพธ์ใน Chat', channel: 'reply', surface: 'oa',
    trigger: [
      { mark: '✓', text: 'ตอบครบข้อสุดท้ายแล้วเห็นผลลัพธ์บน LIFF' },
      { mark: '⚙', text: 'liff.sendMessages() ส่ง text แทน user → webhook จับ #ref → reply Flex กลับฟรี' },
    ],
    api: 'liff.sendMessages() → POST /api/webhook/line · event: message',
    preview: 'flex',
    fields: [
      { k: 'enabled', label: 'เปิดใช้งาน', type: 'bool', hint: 'ปิด = เสีย re-engagement ฟรีที่แรงที่สุดของ flow นี้' },
      { k: 'userText', label: 'ข้อความที่ user ส่ง', type: 'text', hint: 'ระบบต่อท้ายด้วย #ref:pairId อัตโนมัติ' },
      { k: 'title', label: 'หัวการ์ด', type: 'text', hint: 'ปกติใช้ชื่อผลลัพธ์จาก config' },
      { k: 'cta', label: 'ปุ่ม', type: 'text', hint: 'ชวนต่อ — ปุ่มนี้พา user ไป share ให้คนอื่น' },
    ],
    note: 'การ์ดค้างในแชทถาวร กลับมากดได้เรื่อย ๆ',
  },
  {
    id: 'partner_done', mark: '04', title: 'แจ้งคู่หูตอบแล้ว', channel: 'push', surface: 'push',
    trigger: [
      { mark: '✓', text: 'B ตอบครบ → queue job ยิง push หา A' },
      { mark: '⚠', text: 'Push นับ quota ทุกข้อความ — 1 pair = 1 push' },
    ],
    api: 'pg-boss: push-notification · retry 3 ครั้ง',
    preview: 'flex',
    fields: [
      { k: 'altText', label: 'Alt text · บรรทัดใน notification', type: 'text', hint: 'A เห็นแค่บรรทัดนี้บนหน้า lock — ตัดที่ประมาณ 40 ตัวอักษร' },
      { k: 'title', label: 'หัวการ์ด', type: 'text', hint: 'A ปิดแอปไปแล้ว ข้อความนี้คือสิ่งเดียวที่ดึงกลับมา' },
      { k: 'body', label: 'บรรทัดรอง', type: 'text', hint: 'สั้น ๆ พอ — คนอ่านจาก notification' },
      { k: 'cta', label: 'ปุ่ม', type: 'text', hint: 'เปิด LIFF ด้วย pairId ไปหน้า Result ตรง ๆ' },
    ],
    note: 'จุดเดียวใน flow ที่กิน quota · A ที่ไม่ได้ add friend จะส่งไม่ได้',
  },
  {
    id: 'keyword_card', mark: '05', title: 'Keyword → Campaign Card', channel: 'reply', surface: 'oa', keywords: true, incoming: 'ควิซ',
    trigger: [
      { mark: '✓', text: 'User พิมพ์ keyword ในแชทของ OA' },
      { mark: '⚙', text: 'match แล้ว reply Flex ของ campaign นี้ — priority สูงชนะ' },
    ],
    api: 'POST /api/webhook/line · event: message → keyword_rules',
    preview: 'flex',
    fields: [
      { k: 'title', label: 'หัวการ์ด', type: 'text', hint: 'ควรตรงกับชื่อแคมเปญที่โปรโมทข้างนอก' },
      { k: 'body', label: 'บรรทัดรอง', type: 'text', hint: 'บอกจำนวนข้อ + สิ่งที่จะได้' },
      { k: 'cta', label: 'ปุ่ม', type: 'text', hint: 'เปิด LIFF แบบไม่มี token — เข้าหน้า Intro' },
    ],
    note: 'ทางเข้าหลักจาก poster / QR / ปากต่อปาก',
  },
  {
    id: 'share_result', mark: '06', title: 'แชร์ผลลัพธ์', channel: 'share', surface: 'friend', picker: true,
    trigger: [
      { mark: '✓', text: 'กด "อวดผลให้คนอื่น" ในหน้า Result' },
      { mark: '⚙', text: 'liff.shareTargetPicker() ส่งการ์ดผล + ปุ่มชวนเล่น' },
    ],
    api: 'POST /api/quiz/share · log share event',
    preview: 'flex',
    fields: [
      { k: 'altText', label: 'Alt text', type: 'text', hint: 'โผล่ในรายการแชทของเพื่อน — ทำให้อยากกดเปิด' },
      { k: 'title', label: 'หัวการ์ด', type: 'text', hint: 'ใช้ชื่อผลลัพธ์ — คนกดเพราะอยากรู้ว่าตัวเองได้อะไร' },
      { k: 'body', label: 'บรรทัดรอง', type: 'text', hint: 'สั้นกว่า body ในหน้า Result' },
      { k: 'cta', label: 'ปุ่ม', type: 'text', hint: 'พาคนใหม่เข้า flow — วง loop ปิดที่นี่' },
    ],
    note: 'ตัวคูณยอดเล่น · วัดจาก share event ใน Dashboard',
  },
];

const CHANNELS: Record<string, { label: string; color: string; bg: string }> = {
  reply: { label: 'Reply · ฟรี', color: '#16A34A', bg: 'rgba(22,163,74,.08)' },
  share: { label: 'ShareTargetPicker', color: '#2563EB', bg: 'rgba(37,99,235,.08)' },
  push: { label: 'Push · นับ quota', color: '#D97706', bg: 'rgba(217,119,6,.10)' },
};

const DEFAULT_VALS: Record<string, Record<string, string | boolean>> = {
  welcome: { enabled: true, body: 'ยินดีต้อนรับ! 🎯\nพิมพ์ "ควิซ" เพื่อเริ่มเล่นควิซคู่หู' },
  invite: { altText: 'พลอยชวนคุณตอบควิซคู่หู 🎯', title: '{inviter} ชวนคุณตอบควิซคู่หู', body: 'ตอบ 5 ข้อ แล้วดูว่าคุณสองคนเข้ากันแบบไหน', cta: 'ตอบควิซ' },
  chat_result: { enabled: true, userText: '✨ ฉันเล่นควิซคู่หูมา ผลออกมาแบบนี้', title: 'คู่หูสายไฟลุก', body: 'สองคนนี้เจอกันแล้วไฟติดทั้งวง', cta: 'ชวนเพื่อนเล่น' },
  partner_done: { altText: 'คู่หูของคุณตอบแล้ว มาดูผลกัน 🎯', title: 'คู่หูตอบแล้ว มาดูผลกัน', body: 'ผลของคุณสองคนพร้อมแล้ว', cta: 'ดูผลลัพธ์' },
  keyword_card: { title: 'คู่หูสายไหน', body: 'ตอบ 5 ข้อ ชวนเพื่อนมาตอบ แล้วดูผลด้วยกัน', cta: 'เริ่มตอบ' },
  share_result: { altText: 'เราได้ผลว่า "คู่หูสายไฟลุก" 🔥', title: 'คู่หูสายไฟลุก', body: 'ผลของเรากับเพื่อน — ลองดูว่าคุณได้อะไร', cta: 'เล่นด้วยกัน' },
};

const pickerFriends = [
  { name: 'ก้อง', bg: '#E5E5E3' }, { name: 'พลอย', bg: '#111111' },
  { name: 'เบล', bg: '#E5E5E3' }, { name: 'ตูน', bg: '#E5E5E3' },
];

export default function ReplyDesigner() {
  const navigate = useNavigate();
  const { id: campaignId } = useParams<{ id: string }>();
  const cid = campaignId || 'buddy_demo';
  const accent = '#E63B2E';

  const [openFlow, setOpenFlow] = useState<string>('chat_result');
  const [vals, setVals] = useState<Record<string, Record<string, string | boolean>>>(DEFAULT_VALS);
  const [keywords, setKeywords] = useState<KeywordRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);

  const showNote = (msg: string, err = false) => {
    setNote(msg); setNoteError(err);
    setTimeout(() => { setNote(''); setNoteError(false); }, 4500);
  };

  // Load from API
  useEffect(() => {
    const settingsKey = `reply_flows_${cid}`;
    Promise.all([fetchSettings(), fetchKeywords()])
      .then(([settings, kws]) => {
        // Welcome — from welcome_message setting
        const wm = settings.welcome_message as { text?: string; enabled?: boolean } | undefined;
        const welcomeVals: Record<string, string | boolean> = {
          enabled: wm?.enabled !== false,
          body: wm?.text || DEFAULT_VALS.welcome.body as string,
        };
        // Other flows — from reply_flows_{cid} setting
        const savedFlows = (settings[settingsKey] as Record<string, Record<string, string | boolean>> | undefined) || {};
        const merged: Record<string, Record<string, string | boolean>> = { ...DEFAULT_VALS };
        for (const flowId of Object.keys(savedFlows)) {
          merged[flowId] = { ...DEFAULT_VALS[flowId], ...savedFlows[flowId] };
        }
        merged.welcome = welcomeVals;
        setVals(merged);
        // Keywords — all enabled for this campaign
        setKeywords(kws.filter((k) => k.campaign_id === cid || k.campaign_id === null));
      })
      .catch((err: unknown) => showNote('โหลดไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)), true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  const setVal = (flowId: string, key: string, val: string | boolean) => {
    setVals((prev) => ({ ...prev, [flowId]: { ...prev[flowId], [key]: val } }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      // Save welcome separately
      await saveSetting('welcome_message', { text: vals.welcome?.body || '', enabled: vals.welcome?.enabled !== false });
      // Save other flows together
      const otherFlows: Record<string, Record<string, string | boolean>> = {};
      for (const flowId of Object.keys(vals)) {
        if (flowId !== 'welcome') otherFlows[flowId] = vals[flowId];
      }
      await saveSetting(`reply_flows_${cid}`, otherFlows);
      setDirty(false);
      showNote('บันทึกข้อความทั้ง 6 จุดแล้ว · webhook ใช้เวอร์ชันใหม่ทันที');
    } catch (err) {
      showNote('บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)), true);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleKeyword = async (kw: KeywordRule) => {
    try {
      const updated = await updateKeyword(kw.id, { enabled: !kw.enabled });
      setKeywords((prev) => prev.map((k) => k.id === updated.id ? updated : k));
    } catch (err) {
      showNote('อัปเดต keyword ไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)), true);
    }
  };

  const freeCount = FLOWS.filter((f) => f.channel !== 'push').length;
  const pushCount = FLOWS.filter((f) => f.channel === 'push').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9B9B98', fontSize: 14 }}>
        กำลังโหลด...
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', borderBottom: '1px solid #E5E5E3', position: 'sticky', top: 0, background: '#fff', zIndex: 40 }}>
        <button
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 99, padding: '5px 12px 5px 9px', background: '#fff', cursor: 'pointer' }}
        >
          ← แคมเปญ
        </button>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>Krob · Host Console</span>
        <span style={{ width: 1, height: 16, background: '#E5E5E3' }} />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>Reply Designer</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid #E5E5E3', background: '#F7F7F5', padding: '3px 8px' }}>{cid}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate('/campaign/' + cid)} style={{ fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}>Config Playground</button>
        <button
          onClick={handleSave}
          style={{
            padding: '9px 16px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: dirty ? 'pointer' : 'default',
            background: dirty ? '#111111' : '#F0F0EE',
            color: dirty ? '#fff' : '#9B9B98',
          }}
        >
          {saving ? 'กำลังบันทึก…' : dirty ? 'Save · มีการแก้' : 'Saved'}
        </button>
      </div>

      {/* Note bar */}
      {note && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px', borderBottom: '1px solid #E5E5E3', fontSize: 13,
          background: noteError ? 'rgba(230,59,46,.08)' : 'rgba(22,163,74,.08)',
        }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: noteError ? '#E63B2E' : '#16A34A' }}>
            {noteError ? 'Error' : 'Saved'}
          </span>
          <span>{note}</span>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #E5E5E3' }}>
        <div style={{ padding: '18px 28px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>จุดที่ส่งข้อความ</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6 }}>{FLOWS.length}</div>
        </div>
        <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#16A34A' }}>ฟรี · ไม่นับ quota</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6, color: '#16A34A' }}>{freeCount}</div>
        </div>
        <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3', background: 'rgba(217,119,6,.06)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#D97706' }}>Push · นับ quota</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6, color: '#D97706' }}>{pushCount}</div>
        </div>
      </div>

      {/* Flow cards */}
      <div style={{ padding: '24px 28px 60px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FLOWS.map((f) => {
          const v = vals[f.id] || {};
          const ch = CHANNELS[f.channel];
          const isOpen = openFlow === f.id;
          const off = v.enabled === false;
          const sf = SURFACES[f.surface] || SURFACES.oa;
          const isText = f.preview === 'text';
          const incoming = (typeof v.userText === 'string' ? v.userText : '') || f.incoming || '';

          return (
            <div key={f.id} style={{ border: '1px solid ' + (isOpen ? '#111111' : '#E5E5E3'), background: '#fff' }}>
              {/* Card header */}
              <button
                onClick={() => setOpenFlow(isOpen ? '' : f.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '15px 18px', border: 0, background: 'transparent', cursor: 'pointer' }}
              >
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.06em', color: '#9B9B98' }}>{f.mark}</span>
                <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', textAlign: 'left' }}>{f.title}</span>
                <span style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase',
                  padding: '3px 8px', border: '1px solid ' + ch.color, background: ch.bg, color: ch.color,
                }}>
                  {ch.label}
                </span>
                {v.enabled !== undefined && (
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: off ? '#9B9B98' : '#111111' }}>
                    {off ? 'ปิด' : 'เปิด'}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: '#9B9B98' }}>{isOpen ? '▼' : '›'}</span>
              </button>

              {/* Card body */}
              {isOpen && (
                <div style={{ borderTop: '1px solid #E5E5E3', padding: '20px 22px', background: '#FAFAF9' }}>
                  {/* Trigger */}
                  <div style={{ border: '1px solid #E5E5E3', background: '#fff', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Trigger</div>
                    {f.trigger.map((t, ti) => (
                      <div key={ti} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 9, alignItems: 'start', fontSize: 13.5, lineHeight: 1.55 }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#9B9B98', paddingTop: 2 }}>{t.mark}</span>
                        <span>{t.text}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 2, fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#5C5C58', background: '#F7F7F5', border: '1px solid #E5E5E3', padding: '7px 9px' }}>{f.api}</div>
                  </div>

                  {/* Keywords — from DB */}
                  {f.keywords && (
                    <div style={{ border: '1px solid #E5E5E3', borderTop: 0, background: '#fff', padding: '14px 16px' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 10 }}>Keywords ที่ผูก</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                        {keywords.length === 0 && (
                          <span style={{ fontSize: 12.5, color: '#9B9B98' }}>ยังไม่มี keyword ที่ผูกกับแคมเปญนี้</span>
                        )}
                        {keywords.map((k) => (
                          <span
                            key={k.id}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 99, fontSize: 12.5,
                              border: '1px solid #E5E5E3',
                              background: k.enabled ? '#fff' : '#F7F7F5',
                              color: k.enabled ? '#111' : '#9B9B98',
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: k.enabled ? '#16A34A' : '#C9C9C6' }} />
                            <span>{k.keyword}</span>
                            <button
                              onClick={() => handleToggleKeyword(k)}
                              title="เปิด/ปิด"
                              style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#9B9B98', padding: '0 0 0 2px' }}
                            >
                              {k.enabled ? '⏸' : '▶'}
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => navigate('/message-manager')}
                          style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#2563EB', padding: '5px 10px', border: '1px dashed #C9C9C6', borderRadius: 99, background: 'transparent', cursor: 'pointer' }}
                        >
                          + จัดการ keyword
                        </button>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 12.5, color: '#9B9B98' }}>keyword ซ้ำกับ campaign อื่นไม่ได้ · ปิดแล้วระบบจะไม่ตอบคำนั้น</div>
                    </div>
                  )}

                  {/* Editor + Preview */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', border: '1px solid #E5E5E3', borderTop: 0, background: '#fff' }}>
                    {/* Editor */}
                    <div style={{ padding: '18px 18px 22px', display: 'flex', flexDirection: 'column', gap: 16, borderRight: '1px solid #E5E5E3' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Editor</div>
                      {f.fields.map((fd) => {
                        const rawVal = v[fd.k];
                        const isBool = fd.type === 'bool';
                        const boolVal = isBool ? (rawVal !== false) : false;
                        const strVal = isBool ? '' : (typeof rawVal === 'string' ? rawVal : '');
                        return (
                          <div key={fd.k}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{fd.label}</span>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#C0C0BD' }}>{fd.k}</span>
                            </div>
                            {fd.type === 'text' && (
                              <input
                                value={strVal}
                                onChange={(e) => setVal(f.id, fd.k, e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, background: '#fff', fontSize: 13.5, outline: 'none' }}
                              />
                            )}
                            {fd.type === 'area' && (
                              <textarea
                                value={strVal}
                                onChange={(e) => setVal(f.id, fd.k, e.target.value)}
                                rows={3}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, background: '#fff', fontSize: 13.5, lineHeight: 1.55, outline: 'none', resize: 'vertical' }}
                              />
                            )}
                            {isBool && (
                              <button
                                onClick={() => setVal(f.id, fd.k, !boolVal)}
                                style={{
                                  padding: '7px 16px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                  border: '1px solid ' + (boolVal ? '#16A34A' : '#E5E5E3'),
                                  background: boolVal ? 'rgba(22,163,74,.08)' : '#F7F7F5',
                                  color: boolVal ? '#16A34A' : '#9B9B98',
                                }}
                              >
                                {boolVal ? 'เปิด' : 'ปิด'}
                              </button>
                            )}
                            <div style={{ fontSize: 12.5, color: '#9B9B98', lineHeight: 1.5, marginTop: 7 }}>{fd.hint}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Preview */}
                    <div style={{ padding: '18px 18px 22px', background: '#F7F7F5', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Preview</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#111' }}>{sf.label}</span>
                      </div>

                      {/* Push banner */}
                      {!off && f.surface === 'push' && (
                        <div style={{ border: '1px solid #E5E5E3', background: '#111111', padding: '11px 12px', display: 'grid', gridTemplateColumns: '26px 1fr', gap: 10, alignItems: 'start' }}>
                          <span style={{ width: 26, height: 26, borderRadius: 7, background: '#fff', opacity: .9, display: 'block' }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#fff' }}>{sf.who}</span>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: 'rgba(255,255,255,.5)' }}>ตอนนี้</span>
                            </div>
                            <div style={{ fontSize: 11.5, lineHeight: 1.45, color: 'rgba(255,255,255,.82)', marginTop: 3 }}>
                              {typeof v.altText === 'string' ? v.altText.slice(0, 44) + (v.altText.length > 44 ? '…' : '') : ''}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ShareTargetPicker */}
                      {!off && f.picker && (
                        <div style={{ border: '1px solid #E5E5E3', background: '#fff', padding: '11px 12px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 9 }}>ShareTargetPicker</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {pickerFriends.map((p) => (
                              <div key={p.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <span style={{
                                  width: 30, height: 30, borderRadius: 99, background: p.bg, display: 'block',
                                  ...(p.bg === '#111111' ? { boxShadow: '0 0 0 2px #16A34A' } : {}),
                                }} />
                                <span style={{ fontSize: 9.5, color: '#9B9B98' }}>{p.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chat header */}
                      <div style={{ border: '1px solid #E5E5E3', borderBottom: 0, background: '#fff', padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 99, flexShrink: 0, display: 'block', background: f.surface === 'friend' ? '#E5E5E3' : accent }} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{sf.who}</span>
                      </div>

                      {/* Chat bubble area */}
                      <div style={{ border: '1px solid #E5E5E3', background: '#EDEDEA', padding: '13px 12px', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 172 }}>
                        {!off && incoming && (
                          <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: '#16A34A', color: '#fff', padding: '9px 12px', borderRadius: '14px 14px 4px 14px', fontSize: 12.5, lineHeight: 1.45 }}>{incoming}</div>
                        )}
                        {!off && isText && (
                          <div style={{ alignSelf: 'flex-start', maxWidth: '86%', background: '#fff', border: '1px solid #E5E5E3', padding: '10px 12px', borderRadius: '4px 14px 14px 14px', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                            {typeof v.body === 'string' ? v.body : ''}
                          </div>
                        )}
                        {!off && !isText && (
                          <div style={{ alignSelf: 'flex-start', width: '84%', border: '1px solid #E5E5E3', background: '#fff', borderRadius: '4px 14px 14px 14px', overflow: 'hidden' }}>
                            <div style={{ height: 46, background: accent, opacity: .9 }} />
                            <div style={{ padding: '11px 12px 13px' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                                {typeof v.title === 'string' ? v.title.replace('{inviter}', 'พลอย') : ''}
                              </div>
                              <div style={{ fontSize: 11.5, color: '#5C5C58', lineHeight: 1.5, marginTop: 5 }}>
                                {typeof v.body === 'string' ? v.body : ''}
                              </div>
                              <div style={{ marginTop: 9, padding: 8, borderRadius: 6, background: accent, color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                                {typeof v.cta === 'string' ? v.cta : ''}
                              </div>
                            </div>
                          </div>
                        )}
                        {off && (
                          <div style={{ alignSelf: 'center', margin: 'auto', textAlign: 'center', fontSize: 12.5, color: '#9B9B98', lineHeight: 1.6 }}>ปิดอยู่<br />ไม่มีข้อความเข้าแชทจุดนี้</div>
                        )}
                      </div>

                      {/* Alt text preview (friend surface) */}
                      {typeof v.altText === 'string' && v.altText && f.surface === 'friend' && (
                        <div style={{ border: '1px solid #E5E5E3', background: '#fff', padding: '9px 11px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>ในรายการแชท</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'center' }}>
                            <span style={{ width: 20, height: 20, borderRadius: 99, background: '#E5E5E3', display: 'block' }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600 }}>{sf.who}</div>
                              <div style={{ fontSize: 11, color: '#9B9B98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.altText as string}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: 12, color: '#9B9B98', lineHeight: 1.5 }}>{sf.note}</div>
                      <div style={{ fontSize: 12, color: '#9B9B98', lineHeight: 1.5 }}>{f.note}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Quota note */}
        <div style={{ border: '1px solid #E5E5E3', background: '#F7F7F5', padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>กติกา quota</div>
            <div style={{ fontSize: 13, lineHeight: 1.65, color: '#5C5C58' }}>Reply กับ ShareTargetPicker ส่งฟรีไม่จำกัด — Push นับ quota ทุกข้อความ · ระบบออกแบบให้ 5 ใน 6 จุดเป็นฟรี เหลือ Push เฉพาะจุดที่ต้องดึงคนกลับมา</div>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>ต่อไปที่ไหน</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => navigate('/')} style={{ fontSize: 12.5, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 99, padding: '6px 13px', cursor: 'pointer' }}>Campaigns</button>
              <button onClick={() => navigate('/campaign/' + cid)} style={{ fontSize: 12.5, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 99, padding: '6px 13px', cursor: 'pointer' }}>Config Playground</button>
              <button onClick={() => navigate('/message-manager')} style={{ fontSize: 12.5, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 99, padding: '6px 13px', cursor: 'pointer' }}>Message Manager</button>
              <button onClick={() => navigate('/rich-menu-manager')} style={{ fontSize: 12.5, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 99, padding: '6px 13px', cursor: 'pointer' }}>Rich Menu Manager</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
