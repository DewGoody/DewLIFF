import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCampaigns, createCampaign, setCampaignStatus } from '../api';
import type { CampaignMeta } from '../types';

const TOP_TYPES: Record<string, { label: string; note: string; color?: string }> = {
  quiz:       { label: 'ควิซ',          note: 'Solo · Pair · Group · MBTI' },
  lucky_draw: { label: 'สุ่มรับรางวัล', note: 'Lucky Draw · จับฉลาก', color: '#D97706' },
};

const QUIZ_MODES: Record<string, { label: string; note: string }> = {
  pair:  { label: 'Pair',  note: 'A ชวน B · ผลร่วมกัน' },
  solo:  { label: 'Solo',  note: 'ตอบคนเดียว · เห็นผลทันที' },
  group: { label: 'Group', note: 'ผลรวมกลุ่ม · archetypes' },
  mbti:  { label: 'MBTI',  note: 'ผล 4 สาย bipolar axes' },
};

const LUCKY_DRAW_SUBS: Record<string, { label: string; note: string }> = {
  mobile:  { label: 'รับรางวัลบนมือถือ',     note: 'โค้ด / voucher · แสดงผลใน LIFF' },
  address: { label: 'รับรางวัลที่บ้าน',       note: 'กรอกที่อยู่ · admin จัดการจัดส่ง' },
  webhook: { label: 'ส่งผลรางวัลไปเว็บอื่น', note: 'ยิง webhook ไประบบภายนอก' },
};

const MODES: Record<string, { label: string; note: string; color: string }> = {
  pair:       { label: 'จับคู่',  note: 'A ชวน B · ผลร่วม',         color: '#E63B2E' },
  solo:       { label: 'เดี่ยว',  note: 'ตอบคนเดียว เห็นผลทันที',  color: '#2563EB' },
  guess:      { label: 'ทายใจ',  note: 'B ทายว่า A ตอบอะไร',        color: '#16A34A' },
  mbti:       { label: 'MBTI',   note: 'ผล 4 สาย bipolar',          color: '#0EA5E9' },
  group:      { label: 'กลุ่ม',  note: 'ผลรวมกลุ่ม · archetypes',   color: '#7C3AED' },
  lucky_draw: { label: 'สุ่ม',   note: 'Lucky Draw',                color: '#D97706' },
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  live: { label: 'LIVE', color: '#16A34A', bg: 'rgba(22,163,74,.08)' },
  draft: { label: 'DRAFT', color: '#9B9B98', bg: '#F7F7F5' },
  ended: { label: 'ENDED', color: '#E63B2E', bg: 'rgba(230,59,46,.08)' },
};

type Filter = 'all' | 'live' | 'draft' | 'ended';

interface LocalCampaign {
  id: string;
  name: string;
  mode: string;
  status: 'draft' | 'live' | 'ended';
  version: number;
  axes: number;
  questions: number;
  results: number;
  missing: number;
  plays: number;
  updated: string;
}

const SEED_LOCAL: LocalCampaign[] = [];

export default function CampaignList() {
  const navigate = useNavigate();
  const [apiCampaigns, setApiCampaigns] = useState<CampaignMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newTopType, setNewTopType] = useState<'quiz' | 'lucky_draw'>('quiz');
  const [newQuizMode, setNewQuizMode] = useState<'pair' | 'solo' | 'group' | 'mbti'>('pair');
  const [newLuckySub, setNewLuckySub] = useState<'mobile' | 'address' | 'webhook'>('mobile');
  const [creating, setCreating] = useState(false);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  };

  useEffect(() => {
    fetchCampaigns()
      .then(setApiCampaigns)
      .catch(() => showToast('ไม่สามารถโหลด campaigns ได้'))
      .finally(() => setLoading(false));
  }, []);

  // Merge API campaigns into LocalCampaign shape for display
  const campaigns: LocalCampaign[] = apiCampaigns.map((c) => ({
    id: c.id,
    name: c.brandName || c.id,
    mode: c.mode,
    status: c.status,
    version: c.currentVersion,
    axes: 0,
    questions: 0,
    results: 0,
    missing: 0,
    plays: 0,
    updated: '',
  })).concat(SEED_LOCAL);

  const idValid = (id: string) => /^[a-z][a-z0-9_]{2,}$/.test(id);
  const isDup = campaigns.some((c) => c.id === newId);
  const idOk = idValid(newId) && !isDup;

  const filteredRows = campaigns
    .filter((c) => filter === 'all' || c.status === filter)
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || c.id.includes(q) || c.name.toLowerCase().includes(q);
    });

  const nLive = campaigns.filter((c) => c.status === 'live').length;
  const nDraft = campaigns.filter((c) => c.status === 'draft').length;
  const nPlays = campaigns.reduce((s, c) => s + c.plays, 0);

  const handleCreate = async () => {
    if (!idOk) return;
    setCreating(true);
    try {
      let mode: string, type: string;
      if (newTopType === 'lucky_draw') {
        mode = 'lucky_draw_' + newLuckySub;
        type = 'lucky_draw';
      } else if (newQuizMode === 'group') {
        mode = 'group';
        type = 'group';
      } else {
        mode = newQuizMode;
        type = 'buddy_quiz';
      }
      await createCampaign(newId, mode, type);
      setShowDialog(false);
      setNewName(''); setNewId(''); setNewTopType('quiz'); setNewQuizMode('pair'); setNewLuckySub('mobile');
      const updated = await fetchCampaigns();
      setApiCampaigns(updated);
      navigate('/campaign/' + newId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setCreating(false);
    }
  };

  const handleCycle = async (c: LocalCampaign) => {
    const order: Array<'draft' | 'live' | 'ended'> = ['draft', 'live', 'ended'];
    const current = order.indexOf(c.status as 'draft' | 'live' | 'ended');
    const next = order[(current + 1) % 3];
    try {
      await setCampaignStatus(c.id, next);
      const updated = await fetchCampaigns();
      setApiCampaigns(updated);
    } catch {
      showToast('ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  const filterBtns: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'live', label: 'Live' },
    { id: 'draft', label: 'Draft' },
    { id: 'ended', label: 'Ended' },
  ];

  const idNote = !newId
    ? 'a-z, 0-9 และ _ เท่านั้น · เปลี่ยนภายหลังไม่ได้'
    : isDup ? 'id นี้ถูกใช้แล้ว'
    : idOk ? 'ใช้ได้ · LIFF จะอยู่ที่ /quiz/' + newId
    : 'ต้องเริ่มด้วยตัวอักษร และยาว 3 ตัวขึ้นไป';
  const idNoteColor = !newId ? '#9B9B98' : idOk ? '#16A34A' : '#E63B2E';

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', borderBottom: '1px solid #E5E5E3', position: 'sticky', top: 0, background: '#fff', zIndex: 40 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>Krob · Host Console</span>
        <span style={{ width: 1, height: 16, background: '#E5E5E3' }} />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>Campaigns</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/message-manager')}
          style={{ fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}
        >
          Message Manager
        </button>
        <button
          onClick={() => navigate('/rewards')}
          style={{ fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}
        >
          Rewards / คูปอง
        </button>
        <button
          onClick={() => navigate('/reports')}
          style={{ fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}
        >
          Reports
        </button>
        <button
          onClick={() => { setShowDialog(true); setNewName(''); setNewId(''); setNewTopType('quiz'); setNewQuizMode('pair'); setNewLuckySub('mobile'); }}
          style={{ padding: '9px 16px', border: 0, borderRadius: 9, background: '#111111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + สร้าง Campaign
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid #E5E5E3' }}>
        <div style={{ padding: '18px 28px' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>ทั้งหมด</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6 }}>{campaigns.length}</div>
        </div>
        <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#16A34A' }}>Live</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6, color: '#16A34A' }}>{nLive}</div>
        </div>
        <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Draft</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6, color: '#9B9B98' }}>{nDraft}</div>
        </div>
        <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>คนเล่นรวม</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6 }}>{nPlays.toLocaleString('en-US')}</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderBottom: '1px solid #E5E5E3' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {filterBtns.map((fb) => (
            <button
              key={fb.id}
              onClick={() => setFilter(fb.id)}
              style={{
                padding: '7px 14px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer',
                border: '1px solid ' + (filter === fb.id ? '#111111' : '#E5E5E3'),
                background: filter === fb.id ? '#111111' : '#fff',
                color: filter === fb.id ? '#fff' : '#5C5C58',
                fontWeight: filter === fb.id ? 600 : 400,
              }}
            >
              {fb.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อหรือ campaign id"
          style={{ width: 260, padding: '9px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Campaign rows */}
      <div style={{ padding: '24px 28px 60px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: '#9B9B98' }}>กำลังโหลด...</div>
        ) : filteredRows.length > 0 ? (
          <div style={{ border: '1px solid #E5E5E3' }}>
            {filteredRows.map((c, i) => {
              const m = MODES[c.mode] || MODES.pair;
              const s = STATUS[c.status] || STATUS.draft;
              const ready = c.missing === 0;
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '3px 1fr',
                    borderTop: i ? '1px solid #E5E5E3' : undefined,
                    background: c.status === 'ended' ? '#FAFAF9' : '#fff',
                  }}
                >
                  <div style={{ background: c.status === 'ended' ? '#E5E5E3' : m.color }} />
                  <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-.015em' }}>{c.name}</span>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase',
                          padding: '3px 8px', border: '1px solid ' + m.color, color: m.color,
                        }}>
                          {m.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#9B9B98' }}>
                        <span>{c.id}</span>
                        <span>·</span>
                        <span>v{c.version}</span>
                        {c.questions > 0 && <><span>·</span><span>{c.questions} คำถาม · {c.results} ผลลัพธ์</span></>}
                        {c.updated && <><span>·</span><span>{c.updated}</span></>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: ready ? '#16A34A' : '#E63B2E' }}>
                        {ready ? '✓ พร้อมใช้งาน' : '✕ ขาด ' + c.missing + ' อย่าง'}
                      </span>
                      <button
                        onClick={() => handleCycle(c)}
                        title="กดเพื่อสลับสถานะ"
                        style={{
                          fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', fontWeight: 500,
                          padding: '5px 10px', borderRadius: 99, cursor: 'pointer',
                          border: '1px solid ' + s.color, background: s.bg, color: s.color,
                        }}
                      >
                        {s.label}
                      </button>
                      <button
                        onClick={() => navigate('/campaign/' + c.id + '/replies')}
                        style={{ fontSize: 12.5, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 8, padding: '7px 12px', background: '#fff', cursor: 'pointer' }}
                      >
                        Replies
                      </button>
                      <button
                        onClick={() => navigate('/campaign/' + c.id)}
                        style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid #111111', background: '#111111', color: '#fff', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}
                      >
                        ตั้งค่า →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ border: '1px dashed #C9C9C6', padding: '64px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>ไม่พบ campaign</div>
            <div style={{ fontSize: 14.5, color: '#5C5C58', lineHeight: 1.6, maxWidth: 340 }}>
              {campaigns.length === 0
                ? 'ยังไม่มี campaign — สร้างอันแรกแล้วระบบจะให้ config เริ่มต้นมาให้พร้อมแก้'
                : 'ไม่มี campaign ที่ตรงกับตัวกรองหรือคำค้นนี้'}
            </div>
            <button
              onClick={() => { setShowDialog(true); setNewName(''); setNewId(''); setNewTopType('quiz'); setNewQuizMode('pair'); setNewLuckySub('mobile'); }}
              style={{ marginTop: 4, padding: '11px 20px', border: 0, borderRadius: 9, background: '#111111', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              + สร้าง Campaign
            </button>
          </div>
        )}
      </div>

      {/* Create Dialog Overlay */}
      {showDialog && (
        <div
          onClick={() => setShowDialog(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.42)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, background: '#fff', border: '1px solid #111111' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E5E3' }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.015em' }}>สร้าง Campaign ใหม่</span>
              <button onClick={() => setShowDialog(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#9B9B98' }}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Name */}
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>ชื่อแคมเปญ</div>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น คู่หูสายไหน"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
                />
              </div>

              {/* ID */}
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>Campaign ID</div>
                <input
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="buddy_demo"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 9,
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, outline: 'none',
                    border: '1px solid ' + (!newId ? '#E5E5E3' : idOk ? '#16A34A' : '#E63B2E'),
                    background: !newId ? '#fff' : idOk ? 'rgba(22,163,74,.06)' : 'rgba(230,59,46,.08)',
                  }}
                />
                <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6, color: idNoteColor }}>{idNote}</div>
              </div>

              {/* Top-level type */}
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>ประเภท</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                  {(['quiz', 'lucky_draw'] as const).map((k) => {
                    const on = newTopType === k;
                    const accent = TOP_TYPES[k].color;
                    return (
                      <button
                        key={k}
                        onClick={() => setNewTopType(k)}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', textAlign: 'left',
                          padding: '12px 14px', borderRadius: 9, cursor: 'pointer',
                          border: '1.5px solid ' + (on ? (accent ?? '#111111') : '#E5E5E3'),
                          background: on ? (accent ? accent + '0D' : '#F7F7F5') : '#fff',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: on && accent ? accent : '#111' }}>{TOP_TYPES[k].label}</span>
                        <span style={{ fontSize: 10.5, lineHeight: 1.45, color: on ? '#5C5C58' : '#9B9B98' }}>{TOP_TYPES[k].note}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quiz sub-modes */}
              {newTopType === 'quiz' && (
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>โหมด</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {(['pair', 'solo', 'group', 'mbti'] as const).map((k) => {
                      const on = newQuizMode === k;
                      return (
                        <button key={k} onClick={() => setNewQuizMode(k)} style={{
                          display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', textAlign: 'left',
                          padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                          border: '1px solid ' + (on ? '#111111' : '#E5E5E3'),
                          background: on ? '#F7F7F5' : '#fff',
                        }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{QUIZ_MODES[k].label}</span>
                          <span style={{ fontSize: 10.5, lineHeight: 1.45, color: on ? '#5C5C58' : '#9B9B98' }}>{QUIZ_MODES[k].note}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lucky Draw sub-types */}
              {newTopType === 'lucky_draw' && (
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>รูปแบบ</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(['mobile', 'address', 'webhook'] as const).map((k) => {
                      const on = newLuckySub === k;
                      return (
                        <button key={k} onClick={() => setNewLuckySub(k)} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                          border: '1px solid ' + (on ? '#D97706' : '#E5E5E3'),
                          background: on ? '#FFFBEB' : '#fff', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                        }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', border: on ? '4px solid #D97706' : '1.5px solid #C9C9C6', background: '#fff', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: on ? '#92400E' : '#111' }}>{LUCKY_DRAW_SUBS[k].label}</div>
                            <div style={{ fontSize: 10.5, color: '#9B9B98', marginTop: 1 }}>{LUCKY_DRAW_SUBS[k].note}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#A0A5AA', fontStyle: 'italic' }}>เร็วๆ นี้ · ฟีเจอร์นี้อยู่ระหว่างพัฒนา</div>
                </div>
              )}

              {/* Summary */}
              <div style={{ border: '1px solid #E5E5E3', background: '#F7F7F5', padding: '12px 14px', fontSize: 12.5, color: '#5C5C58', lineHeight: 1.6 }}>
                {newTopType === 'lucky_draw'
                  ? `Lucky Draw · ${LUCKY_DRAW_SUBS[newLuckySub].label} · สถานะ DRAFT · ฟีเจอร์อยู่ระหว่างพัฒนา`
                  : `ควิซโหมด ${QUIZ_MODES[newQuizMode].label} · สถานะ DRAFT · ยังไม่มีใครเห็นจนกด LIVE`}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #E5E5E3' }}>
              <button
                onClick={() => setShowDialog(false)}
                style={{ padding: '10px 16px', border: '1px solid #E5E5E3', background: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#5C5C58' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !idOk}
                style={{
                  padding: '10px 20px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600,
                  cursor: idOk && !creating ? 'pointer' : 'default',
                  background: idOk && !creating ? '#111111' : '#F0F0EE',
                  color: idOk && !creating ? '#fff' : '#9B9B98',
                }}
              >
                {creating ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`toast${toast ? ' visible' : ''}`}>{toast}</div>
    </>
  );
}
