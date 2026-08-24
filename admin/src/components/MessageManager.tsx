import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchKeywords,
  fetchSettings,
  saveSetting,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  previewKeyword,
  type KeywordRule,
} from '../api';

const CAMPAIGN_CARDS: Record<string, { title: string; body: string; cta: string; color: string }> = {
  buddy_demo: { title: 'คู่หูสายไหน', body: 'ตอบ 5 ข้อ ชวนเพื่อนมาตอบ แล้วดูผลด้วยกัน', cta: 'เริ่มตอบ', color: '#E63B2E' },
  mbti_demo: { title: 'MBTI Quiz', body: 'ตอบ 8 ข้อ รู้ว่าคุณเป็นคนแบบไหน', cta: 'เริ่มตอบ', color: '#2563EB' },
  know_me: { title: 'รู้จักกันแค่ไหน', body: 'ทายว่าเพื่อนตอบอะไร แล้วดูว่าเข้าใจกันกี่ %', cta: 'เริ่มทาย', color: '#16A34A' },
};

export default function MessageManager() {
  const navigate = useNavigate();

  const [welcome, setWelcome] = useState({ on: true, text: '' });
  const [welcomeDirty, setWelcomeDirty] = useState(false);
  const [welcomeSaving, setWelcomeSaving] = useState(false);

  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [testText, setTestText] = useState('ควิซ');
  const [previewResult, setPreviewResult] = useState<{ match: boolean; rule?: KeywordRule } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newType, setNewType] = useState<'flex_campaign' | 'text'>('flex_campaign');
  const [newTarget, setNewTarget] = useState('buddy_demo');
  const [newPriority, setNewPriority] = useState('5');
  const [addError, setAddError] = useState('');

  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);

  const showNote = (msg: string, err = false) => {
    setNote(msg); setNoteError(err);
    setTimeout(() => { setNote(''); setNoteError(false); }, 4500);
  };

  // Load on mount
  useEffect(() => {
    Promise.all([fetchSettings(), fetchKeywords()])
      .then(([settings, kws]) => {
        const wm = settings.welcome_message as { text?: string; enabled?: boolean } | undefined;
        setWelcome({ on: wm?.enabled !== false, text: wm?.text || '' });
        setRules(kws);
      })
      .catch((err: unknown) => showNote('โหลดไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)), true))
      .finally(() => setLoading(false));
  }, []);

  // Live keyword preview against API (debounced 400ms)
  useEffect(() => {
    if (!testText.trim()) { setPreviewResult(null); return; }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      previewKeyword(testText)
        .then((r) => setPreviewResult(r))
        .catch(() => setPreviewResult(null));
    }, 400);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [testText]);

  // Save welcome message
  const handleSaveWelcome = async () => {
    if (!welcomeDirty || welcomeSaving) return;
    setWelcomeSaving(true);
    try {
      await saveSetting('welcome_message', { text: welcome.text, enabled: welcome.on });
      setWelcomeDirty(false);
      showNote('บันทึกข้อความต้อนรับแล้ว · มีผลทันทีกับ follower ใหม่');
    } catch (err) {
      showNote('บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)), true);
    } finally {
      setWelcomeSaving(false);
    }
  };

  // Toggle rule enabled/disabled
  const handleToggle = async (rule: KeywordRule) => {
    try {
      const updated = await updateKeyword(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    } catch (err) {
      showNote('อัปเดตไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)), true);
    }
  };

  // Delete rule
  const handleDelete = async (rule: KeywordRule) => {
    try {
      await deleteKeyword(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err) {
      showNote('ลบไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)), true);
    }
  };

  // Add new rule
  const newDup = rules.some((r) => r.keyword.toLowerCase() === newWord.trim().toLowerCase());
  const canAdd = !!newWord.trim() && !newDup;

  const handleAdd = async () => {
    if (!canAdd) return;
    setAddError('');
    try {
      const created = await createKeyword({
        keyword: newWord.trim(),
        replyType: newType,
        campaignId: newType === 'flex_campaign' ? newTarget || null : null,
        replyText: newType === 'text' ? newTarget || null : null,
        priority: parseInt(newPriority, 10) || 1,
      });
      setRules((prev) => [...prev, created]);
      setAddOpen(false);
      setNewWord('');
      setNewPriority('5');
      setNewTarget('buddy_demo');
      setNewType('flex_campaign');
    } catch (err) {
      setAddError((err instanceof Error ? err.message : String(err)));
    }
  };

  const welcomeLen = welcome.text.length;
  const over = welcomeLen > 300;

  const hit = previewResult;
  const hitRule = hit?.rule;
  const card = hitRule && hitRule.reply_type === 'flex_campaign'
    ? (CAMPAIGN_CARDS[hitRule.campaign_id || ''] || CAMPAIGN_CARDS.buddy_demo)
    : null;

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
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>Message Manager</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate('/campaign/buddy_demo/replies')} style={{ fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}>Reply Designer</button>
        <button
          onClick={handleSaveWelcome}
          style={{
            padding: '9px 16px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: welcomeDirty ? 'pointer' : 'default',
            background: welcomeDirty ? '#111111' : '#F0F0EE',
            color: welcomeDirty ? '#fff' : '#9B9B98',
          }}
        >
          {welcomeSaving ? 'กำลังบันทึก…' : welcomeDirty ? 'Save Welcome' : 'Saved'}
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

      {/* 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px' }}>

        {/* Left main */}
        <div style={{ borderRight: '1px solid #E5E5E3' }}>

          {/* Section 01 — Welcome */}
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #E5E5E3' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>01 · ข้อความต้อนรับ</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid #16A34A', background: 'rgba(22,163,74,.08)', color: '#16A34A' }}>Reply · ฟรี</span>
            </div>
            <div style={{ fontSize: 13.5, color: '#5C5C58', lineHeight: 1.6, marginBottom: 16 }}>ส่งอัตโนมัติเมื่อ user กดเพิ่มเพื่อน OA — ไม่นับ quota · บอกวิธีเริ่มเล่นให้ชัดในบรรทัดนี้</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: 18, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>welcome.text</span>
                  <button
                    onClick={() => { setWelcome((w) => ({ ...w, on: !w.on })); setWelcomeDirty(true); }}
                    style={{
                      padding: '4px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (welcome.on ? '#16A34A' : '#E5E5E3'),
                      background: welcome.on ? 'rgba(22,163,74,.08)' : '#F7F7F5',
                      color: welcome.on ? '#16A34A' : '#9B9B98',
                    }}
                  >
                    {welcome.on ? 'เปิด' : 'ปิด'}
                  </button>
                </div>
                <textarea
                  value={welcome.text}
                  onChange={(e) => { setWelcome((w) => ({ ...w, text: e.target.value })); setWelcomeDirty(true); }}
                  rows={4}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, lineHeight: 1.6, outline: 'none', resize: 'vertical' }}
                />
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, marginTop: 7, color: over ? '#E63B2E' : '#9B9B98' }}>
                  {welcomeLen} / 300 ตัวอักษร
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>Preview</div>
                <div style={{ border: '1px solid #E5E5E3', background: '#EDEDEA', padding: 12, minHeight: 96, display: 'flex' }}>
                  {welcome.on ? (
                    <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: '#fff', border: '1px solid #E5E5E3', padding: '10px 12px', borderRadius: '4px 14px 14px 14px', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{welcome.text}</div>
                  ) : (
                    <div style={{ margin: 'auto', textAlign: 'center', fontSize: 12.5, color: '#9B9B98', lineHeight: 1.55 }}>ปิดอยู่<br />user ที่ add friend จะไม่ได้รับอะไร</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 02 — Keyword Auto-Reply */}
          <div style={{ padding: '24px 28px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>02 · Keyword Auto-Reply</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid #16A34A', background: 'rgba(22,163,74,.08)', color: '#16A34A' }}>Reply · ฟรี</span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setAddOpen(true)}
                style={{ padding: '8px 14px', border: 0, borderRadius: 9, background: '#111111', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                + เพิ่ม Keyword
              </button>
            </div>
            <div style={{ fontSize: 13.5, color: '#5C5C58', lineHeight: 1.6, marginBottom: 16 }}>User พิมพ์คำตรงกับ keyword → ระบบตอบทันที · priority สูงชนะเมื่อชนกัน · บันทึกทันทีทุก action</div>

            <div style={{ border: '1px solid #E5E5E3' }}>
              {/* Table head */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.1fr 70px 118px', background: '#F7F7F5', borderBottom: '1px solid #E5E5E3' }}>
                {['Keyword', 'ตอบด้วย', 'Campaign', 'Prio', ''].map((h, i) => (
                  <div key={i} style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{h}</div>
                ))}
              </div>

              {/* Rules */}
              {rules.map((r) => {
                const isFlex = r.reply_type === 'flex_campaign' || r.reply_type === 'flex_custom';
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.1fr 70px 118px',
                      borderTop: '1px solid #F0F0EE',
                      background: r.enabled ? '#fff' : '#FAFAF9',
                    }}
                  >
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, flexShrink: 0, background: r.enabled ? '#16A34A' : '#C9C9C6' }} />
                      <span style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.enabled ? '#111' : '#9B9B98' }}>{r.keyword}</span>
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minWidth: 0 }}>
                      <span style={{
                        fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase',
                        padding: '2px 7px', flexShrink: 0, border: '1px solid ' + (isFlex ? '#2563EB' : '#9B9B98'),
                        color: isFlex ? '#2563EB' : '#9B9B98',
                      }}>
                        {isFlex ? 'Flex' : 'Text'}
                      </span>
                      <span style={{ color: '#9B9B98', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isFlex ? 'การ์ดแคมเปญ' : (r.reply_text || '—')}
                      </span>
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: '#5C5C58' }}>
                      {isFlex ? (r.campaign_id || '—') : '—'}
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: '#9B9B98' }}>
                      {r.priority}
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => handleToggle(r)} title="เปิด/ปิด" style={{ flexShrink: 0, width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>{r.enabled ? '⏸' : '▶'}</button>
                      <button onClick={() => setTestText(r.keyword)} title="ทดสอบคำนี้" style={{ flexShrink: 0, width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>▶</button>
                      <button onClick={() => handleDelete(r)} title="ลบ" style={{ flexShrink: 0, width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 10, cursor: 'pointer', color: '#E63B2E' }}>✕</button>
                    </div>
                  </div>
                );
              })}

              {rules.length === 0 && !addOpen && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9B9B98', fontSize: 13 }}>ยังไม่มี keyword · กด + เพิ่ม Keyword</div>
              )}

              {/* Add form */}
              {addOpen && (
                <div style={{ borderTop: '1px solid #111111', background: '#FAFAF9', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.1fr 70px', gap: 10, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>Keyword</div>
                      <input
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        placeholder="ควิซ"
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 9, fontSize: 13, outline: 'none',
                          border: '1px solid ' + (!newWord ? '#E5E5E3' : newDup ? '#E63B2E' : '#16A34A'),
                          background: !newWord ? '#fff' : newDup ? 'rgba(230,59,46,.08)' : 'rgba(22,163,74,.06)',
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>ตอบด้วย</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['flex_campaign', 'text'] as const).map((id) => (
                          <button
                            key={id}
                            onClick={() => { setNewType(id); setNewTarget(id === 'flex_campaign' ? 'buddy_demo' : ''); }}
                            style={{
                              flex: 1, padding: '10px 8px', borderRadius: 9, fontSize: 12.5, cursor: 'pointer',
                              border: '1px solid ' + (newType === id ? '#111111' : '#E5E5E3'),
                              background: newType === id ? '#111111' : '#fff',
                              color: newType === id ? '#fff' : '#5C5C58',
                              fontWeight: newType === id ? 600 : 400,
                            }}
                          >
                            {id === 'flex_campaign' ? 'Flex Card' : 'ข้อความ'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>
                        {newType === 'flex_campaign' ? 'Campaign ID' : 'ข้อความ'}
                      </div>
                      <input
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        placeholder={newType === 'flex_campaign' ? 'buddy_demo' : 'พิมพ์ข้อความตอบกลับ'}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>Priority</div>
                      <input
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value.replace(/[^0-9]/g, ''))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #E5E5E3', borderRadius: 9, fontFamily: "'DM Mono',monospace", fontSize: 13, outline: 'none' }}
                      />
                    </div>
                  </div>
                  {addError && (
                    <div style={{ fontSize: 12.5, color: '#E63B2E' }}>{addError}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 12.5, color: !newWord ? '#9B9B98' : newDup ? '#E63B2E' : '#16A34A' }}>
                      {!newWord ? 'พิมพ์ keyword ที่อยากให้ระบบจับ' : newDup ? 'keyword นี้ถูกใช้แล้ว' : 'ใช้ได้ · จะ match เมื่อ user พิมพ์ตรงคำนี้'}
                    </div>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => { setAddOpen(false); setNewWord(''); setAddError(''); }} style={{ padding: '9px 14px', border: '1px solid #E5E5E3', background: '#fff', borderRadius: 9, fontSize: 12.5, cursor: 'pointer', color: '#5C5C58' }}>ยกเลิก</button>
                    <button
                      onClick={handleAdd}
                      style={{
                        padding: '9px 18px', border: 0, borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                        cursor: canAdd ? 'pointer' : 'default',
                        background: canAdd ? '#111111' : '#F0F0EE',
                        color: canAdd ? '#fff' : '#9B9B98',
                      }}
                    >
                      เพิ่ม
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12.5, color: '#9B9B98' }}>
              <span>{rules.length} keyword ทั้งหมด</span>
              <span>{rules.filter((r) => !r.enabled).length} ปิดอยู่</span>
            </div>
          </div>
        </div>

        {/* Right sidebar — Section 03 */}
        <aside style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 22, alignSelf: 'start', position: 'sticky', top: 60 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>03 · ทดสอบ Keyword</div>
            <div style={{ fontSize: 13, color: '#5C5C58', lineHeight: 1.6, marginBottom: 12 }}>ทดสอบจาก DB จริง · กฎที่บันทึกแล้วเท่านั้น</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="ควิซ"
                style={{ flex: 1, minWidth: 0, padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
              />
              <button onClick={() => { setTestText(''); setPreviewResult(null); }} style={{ padding: '11px 14px', border: '1px solid #E5E5E3', background: '#fff', borderRadius: 9, fontSize: 12.5, cursor: 'pointer', color: '#5C5C58' }}>ล้าง</button>
            </div>
          </div>

          <div>
            <div style={{
              fontSize: 13, padding: '11px 13px', border: '1px solid ' + (
                !testText.trim() ? '#E5E5E3' : hit?.match ? '#16A34A' : '#E63B2E'
              ),
              background: !testText.trim() ? '#F7F7F5' : hit?.match ? 'rgba(22,163,74,.08)' : 'rgba(230,59,46,.08)',
              color: !testText.trim() ? '#9B9B98' : '#111',
            }}>
              {!testText.trim() ? 'พิมพ์อะไรก็ได้เพื่อทดสอบ'
                : hit === null ? 'กำลังตรวจสอบ...'
                : hit.match && hitRule ? '✓ match "' + hitRule.keyword + '" → ' + (hitRule.reply_type === 'flex_campaign' ? 'Flex ' + (hitRule.campaign_id || '') : 'ข้อความ')
                : '✕ ไม่ match — ระบบจะไม่ตอบ'}
            </div>

            <div style={{ border: '1px solid #E5E5E3', background: '#EDEDEA', padding: '13px 12px', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 150, marginTop: 12 }}>
              {testText.trim() && (
                <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: '#16A34A', color: '#fff', padding: '9px 12px', borderRadius: '14px 14px 4px 14px', fontSize: 12.5, lineHeight: 1.45 }}>{testText}</div>
              )}

              {card && (
                <div style={{ alignSelf: 'flex-start', width: '84%', border: '1px solid #E5E5E3', background: '#fff', borderRadius: '4px 14px 14px 14px', overflow: 'hidden' }}>
                  <div style={{ height: 46, opacity: .9, background: card.color }} />
                  <div style={{ padding: '11px 12px 13px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{card.title}</div>
                    <div style={{ fontSize: 11.5, color: '#5C5C58', lineHeight: 1.5, marginTop: 5 }}>{card.body}</div>
                    <div style={{ marginTop: 9, padding: 8, borderRadius: 6, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#fff', background: card.color }}>{card.cta}</div>
                  </div>
                </div>
              )}

              {hit?.match && hitRule?.reply_type === 'text' && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '88%', background: '#fff', border: '1px solid #E5E5E3', padding: '10px 12px', borderRadius: '4px 14px 14px 14px', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{hitRule.reply_text}</div>
              )}

              {(!hit || !hit.match) && testText.trim() && (
                <div style={{ margin: 'auto', textAlign: 'center', fontSize: 12.5, color: '#9B9B98', lineHeight: 1.6 }}>
                  {hit === null ? '' : 'ไม่มีกฎไหน match\nแชทจะเงียบ — ไม่เสีย quota'}
                </div>
              )}

              {!testText.trim() && (
                <div style={{ margin: 'auto', textAlign: 'center', fontSize: 12.5, color: '#9B9B98', lineHeight: 1.6 }}>ยังไม่ได้ทดสอบ</div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E5E5E3', paddingTop: 18 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 10 }}>กฎการ match</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5, color: '#5C5C58', lineHeight: 1.55 }}>
              {[
                'ตัดช่องว่างหัวท้าย แล้วเทียบแบบไม่สนตัวพิมพ์เล็กใหญ่',
                'ต้องตรงทั้งคำ — "ควิซคู่หู" ไม่ match "ควิซ"',
                'ชนกันหลายกฎ → priority สูงชนะ',
                'ไม่ match เลย → ไม่ตอบอะไร (ไม่เสีย quota)',
              ].map((rule, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 9 }}>
                  <span style={{ color: '#9B9B98' }}>{i + 1}</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
