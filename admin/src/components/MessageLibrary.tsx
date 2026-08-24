import { useState, useEffect, useCallback } from 'react';
import ImageUploader from './ImageUploader';
import { useNavigate } from 'react-router-dom';
import {
  fetchLibrary,
  createLibraryMsg,
  updateLibraryMsg,
  deleteLibraryMsg,
  type LibraryMsg,
} from '../api';

const TYPES = [
  { id: 'text', code: 'text', label: 'Text', fields: 'พิมพ์ข้อความล้วน · จับ keyword ได้' },
  { id: 'image', code: 'image', label: 'Image', fields: 'URL รูป + alt text' },
  { id: 'flex', code: 'flex', label: 'Flex Card', fields: 'Title · Body · รูป · ปุ่ม · สี' },
  { id: 'imagemap', code: 'imagemap', label: 'Imagemap', fields: 'รูปพื้นหลัง + พื้นที่กด' },
  { id: 'video', code: 'video', label: 'Video', fields: 'URL วิดีโอ + preview image' },
];

const USAGES = ['Keyword', 'Chat Trigger', 'Rich Menu', 'Welcome', 'Push'];
const ACCENT = '#2563EB';

function typeColor(id: string): string {
  if (id === 'flex') return '#2563EB';
  if (id === 'text') return '#111111';
  if (id === 'imagemap') return '#F5B800';
  if (id === 'image') return '#16A34A';
  return '#E63B2E';
}

function typeOf(id: string) {
  return TYPES.find((t) => t.id === id) || TYPES[0];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'เมื่อกี้';
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} วัน`;
  return `${Math.floor(d / 7)} สัปดาห์`;
}

export default function MessageLibrary() {
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<LibraryMsg[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load from API
  useEffect(() => {
    fetchLibrary()
      .then((data) => {
        setMsgs(data);
        if (data.length > 0) setSelId(data[0].id);
      })
      .catch((err: unknown) => setNote('โหลดไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err))))
      .finally(() => setLoading(false));
  }, []);

  const selMsg = msgs.find((m) => m.id === selId) || msgs[0] || null;

  const patch = useCallback((fields: Partial<LibraryMsg>) => {
    setMsgs((prev) => prev.map((m) => m.id === selId ? { ...m, ...fields } : m));
    setDirty(true);
  }, [selId]);

  const showNote = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(''), 4000);
  };

  const addType = async (typeId: string) => {
    const t = typeOf(typeId);
    try {
      const created = await createLibraryMsg({
        name: 'ข้อความใหม่ ' + t.label,
        type: typeId,
        body: typeId === 'text' ? 'พิมพ์ข้อความที่นี่' : 'คำอธิบายสั้น ๆ',
        title: typeId === 'flex' ? 'หัวการ์ด' : '',
        cta: typeId === 'flex' ? 'กดดูเลย' : '',
        action: typeId === 'flex' ? 'uri · liff' : '',
        image_url: '',
        usage: [],
        areas: typeId === 'imagemap' ? [{ label: 'ช่อง 1', action: 'uri' }, { label: 'ช่อง 2', action: 'uri' }] : null,
      });
      setMsgs((prev) => [created, ...prev]);
      setSelId(created.id);
      setFilter('all');
      setNewOpen(false);
      setDirty(false);
    } catch (err) {
      showNote('สร้างไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const doSave = async () => {
    if (!selMsg || !dirty) return;
    setSaving(true);
    try {
      const updated = await updateLibraryMsg(selMsg.id, {
        name: selMsg.name,
        type: selMsg.type,
        body: selMsg.body,
        title: selMsg.title,
        cta: selMsg.cta,
        action: selMsg.action,
        image_url: selMsg.image_url,
        usage: selMsg.usage,
        areas: selMsg.areas,
      });
      setMsgs((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      setDirty(false);
      showNote('บันทึก "' + updated.name + '" แล้ว · เอาไปผูกใน Reply Designer ได้ทันที');
    } catch (err) {
      showNote('บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const doDuplicate = async () => {
    if (!selMsg) return;
    try {
      const created = await createLibraryMsg({
        name: selMsg.name + ' (copy)',
        type: selMsg.type,
        body: selMsg.body,
        title: selMsg.title,
        cta: selMsg.cta,
        action: selMsg.action,
        image_url: selMsg.image_url,
        usage: selMsg.usage,
        areas: selMsg.areas ?? null,
      });
      setMsgs((prev) => [created, ...prev]);
      setSelId(created.id);
      setDirty(false);
    } catch (err) {
      showNote('ทำซ้ำไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const doDelete = async () => {
    if (!selMsg || msgs.length <= 1) return;
    try {
      await deleteLibraryMsg(selMsg.id);
      const next = msgs.find((m) => m.id !== selMsg.id);
      setMsgs((prev) => prev.filter((m) => m.id !== selMsg.id));
      setSelId(next?.id ?? null);
      setDirty(false);
    } catch (err) {
      showNote('ลบไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const q = query.trim();
  const visible = msgs.filter((m) =>
    (filter === 'all' || m.type === filter) &&
    (!q || (m.name + ' ' + m.body + ' ' + m.title).toLowerCase().includes(q.toLowerCase()))
  );

  const selType = selMsg?.type || 'text';
  const isText = selType === 'text';
  const isFlex = selType === 'flex';
  const isMap = selType === 'imagemap';
  const isImg = selType === 'image';
  const isVid = selType === 'video';
  const isPaid = selMsg?.usage.includes('Push') ?? false;

  const gridCols = '52px 84px 1fr 104px 122px 78px';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', borderBottom: '1px solid #111111', position: 'sticky', top: 0, background: '#fff', zIndex: 40, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 99, padding: '5px 12px 5px 9px', background: '#fff', cursor: 'pointer' }}
        >
          ← แคมเปญ
        </button>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>Krob · Host Console</span>
        <span style={{ width: 1, height: 16, background: '#E5E5E3' }} />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>Message Library</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', border: '1px solid #E5E5E3', background: '#F7F7F5', padding: '3px 8px' }}>
          {msgs.length} messages
        </span>
        <div style={{ flex: 1, minWidth: 12 }} />
        <button onClick={() => navigate('/campaign/buddy_demo/replies')} style={{ flexShrink: 0, fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}>Reply Designer</button>
        <button onClick={() => navigate('/message-manager')} style={{ flexShrink: 0, fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}>Message Manager</button>
        <button onClick={() => setNewOpen(true)} style={{ flexShrink: 0, padding: '9px 16px', border: 0, borderRadius: 9, background: '#111111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ สร้างข้อความใหม่</button>
      </div>

      {/* Saved note */}
      {note && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px', borderBottom: '1px solid #E5E5E3', background: note.includes('ไม่สำเร็จ') ? 'rgba(230,59,46,.08)' : 'rgba(22,163,74,.08)', fontSize: 13 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: note.includes('ไม่สำเร็จ') ? '#E63B2E' : '#16A34A' }}>
            {note.includes('ไม่สำเร็จ') ? 'Error' : 'Saved'}
          </span>
          <span>{note}</span>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderBottom: '1px solid #E5E5E3', background: '#F7F7F5', flexWrap: 'wrap' }}>
        {[{ id: 'all', label: 'ทั้งหมด' }, ...TYPES.map((x) => ({ id: x.id, label: x.label }))].map((f) => {
          const n = f.id === 'all' ? msgs.length : msgs.filter((m) => m.type === f.id).length;
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 99, cursor: 'pointer',
                fontSize: 12.5, border: '1px solid ' + (on ? '#111' : '#E5E5E3'),
                background: on ? '#111' : '#fff', color: on ? '#fff' : '#5C5C58',
              }}
            >
              {f.label}
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: on ? 'rgba(255,255,255,.6)' : '#9B9B98' }}>{n}</span>
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อ / เนื้อหา"
          style={{ width: 230, padding: '8px 12px', border: '1px solid #E5E5E3', borderRadius: 8, background: '#fff', fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', minHeight: '74vh' }}>

        {/* Left: table */}
        <div style={{ borderRight: '1px solid #E5E5E3' }}>
          {/* Head row */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 14, padding: '11px 16px', borderBottom: '1px solid #E5E5E3', background: '#fff', fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#C0C0BD' }}>
            <span>ID</span><span>Preview</span><span>ชื่อ</span><span>ประเภท</span><span>ใช้ในจุด</span><span>แก้ล่าสุด</span>
          </div>

          {/* Rows */}
          {visible.map((m) => {
            const on = m.id === selId;
            const tt = typeOf(m.type);
            return (
              <div
                key={m.id}
                onClick={() => { setSelId(m.id); setDirty(false); }}
                style={{
                  display: 'grid', gridTemplateColumns: gridCols, gap: 14, alignItems: 'center',
                  padding: '14px 16px', borderBottom: '1px solid #F0F0EE', cursor: 'pointer',
                  background: on ? '#F7F7F5' : '#fff',
                  boxShadow: on ? 'inset 3px 0 0 #111' : undefined,
                }}
              >
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#9B9B98' }}>{String(m.id).padStart(3, '0')}</span>
                <div style={{
                  height: 44, border: '1px solid #E5E5E3',
                  background: m.type === 'text' ? '#fff' : '#F7F7F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 6px', textAlign: 'center', overflow: 'hidden',
                  fontSize: 9.5, lineHeight: 1.25, color: '#9B9B98',
                  fontFamily: m.type === 'text' ? undefined : "'DM Mono',monospace",
                  letterSpacing: m.type === 'text' ? undefined : '.06em',
                  textTransform: m.type === 'text' ? undefined : 'uppercase',
                }}>
                  {m.type === 'text' ? m.body.slice(0, 18) : tt.label}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-.01em' }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: '#9B9B98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {m.type === 'flex' ? (m.title + ' · ' + m.body) : m.body}
                  </div>
                </div>
                <span style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase',
                  padding: '3px 8px', justifySelf: 'start', border: '1px solid ' + typeColor(m.type), color: typeColor(m.type),
                }}>
                  {tt.label}
                </span>
                <span style={{ fontSize: 11.5, color: m.usage.length ? '#5C5C58' : '#C0C0BD' }}>
                  {m.usage.length ? m.usage.join(' · ') : 'ยังไม่ผูก'}
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: '#9B9B98' }}>{relativeTime(m.updated_at)}</span>
              </div>
            );
          })}

          {visible.length === 0 && (
            <div style={{ padding: '60px 28px', textAlign: 'center', color: '#9B9B98' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>ไม่มีข้อความที่ตรงเงื่อนไข</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>ลองเปลี่ยนตัวกรอง หรือสร้างข้อความใหม่</div>
            </div>
          )}

          {/* Type reference table */}
          <div style={{ padding: '22px 28px 34px', borderTop: '1px solid #E5E5E3' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 12 }}>ประเภทที่ส่งได้ผ่าน Messaging API</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', border: '1px solid #E5E5E3' }}>
              {TYPES.map((t, i) => (
                <div key={t.id} style={{ padding: '14px 14px 16px', borderRight: i < TYPES.length - 1 ? '1px solid #E5E5E3' : undefined }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98' }}>{t.code}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: '#5C5C58', lineHeight: 1.5, marginTop: 5 }}>{t.fields}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: editor panel */}
        <aside style={{ display: 'flex', flexDirection: 'column' }}>
          {selMsg ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '16px 22px', borderBottom: '1px solid #E5E5E3' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>
                  #{selMsg.id} · {typeOf(selType).label}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={doDuplicate} title="ทำซ้ำ" style={{ width: 28, height: 28, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#5C5C58' }}>⧉</button>
                  <button onClick={doDelete} title="ลบ" style={{ width: 28, height: 28, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#E63B2E' }}>✕</button>
                </div>
              </div>

              <div style={{ padding: '20px 22px', borderBottom: '1px solid #E5E5E3', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Name */}
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>ชื่อข้อความ</div>
                  <input
                    value={selMsg.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 14.5, fontWeight: 600, outline: 'none' }}
                  />
                </div>

                {/* Body */}
                {(isText || isFlex) && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>ข้อความ</div>
                    <textarea
                      value={selMsg.body}
                      onChange={(e) => patch({ body: e.target.value })}
                      rows={4}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, lineHeight: 1.55, resize: 'vertical', outline: 'none' }}
                    />
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginTop: 5 }}>{selMsg.body.length} / 5000</div>
                  </div>
                )}

                {/* Title (flex) */}
                {isFlex && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>Title</div>
                    <input
                      value={selMsg.title}
                      onChange={(e) => patch({ title: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 14, fontWeight: 600, outline: 'none' }}
                    />
                  </div>
                )}

                {/* Image Upload */}
                {(isFlex || isImg) && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>
                      Image
                    </div>
                    <ImageUploader
                      value={selMsg.image_url}
                      onChange={(url) => patch({ image_url: url })}
                      aspectRatio={isFlex ? '2:1' : '1:1'}
                      hint={isFlex ? 'hero 1040×520 px' : '1040×1040 px · jpg/png'}
                    />
                  </div>
                )}
                {isVid && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>
                      Video URL
                    </div>
                    <input
                      value={selMsg.image_url}
                      onChange={(e) => patch({ image_url: e.target.value })}
                      placeholder="https://…mp4"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontFamily: "'DM Mono',monospace", fontSize: 12, outline: 'none' }}
                    />
                    <div style={{ marginTop: 6, fontSize: 11, color: '#9B9B98' }}>mp4 · ≤ 200mb</div>
                  </div>
                )}

                {/* CTA button (flex) */}
                {isFlex && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>ปุ่มบนการ์ด</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 118px', gap: 8 }}>
                      <input
                        value={selMsg.cta}
                        onChange={(e) => patch({ cta: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
                      />
                      <input
                        value={selMsg.action}
                        onChange={(e) => patch({ action: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 10px', border: '1px solid #E5E5E3', borderRadius: 9, fontFamily: "'DM Mono',monospace", fontSize: 11.5, outline: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {/* Imagemap areas */}
                {isMap && (
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 7 }}>พื้นที่กด</div>
                    <div style={{ border: '1px solid #E5E5E3' }}>
                      {(selMsg.areas || []).map((a, ai) => (
                        <div key={ai} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 96px', gap: 10, alignItems: 'center', padding: '9px 11px', borderBottom: ai < (selMsg.areas?.length || 0) - 1 ? '1px solid #F0F0EE' : undefined }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: '#9B9B98' }}>{String(ai + 1).padStart(2, '0')}</span>
                          <input
                            value={a.label}
                            onChange={(e) => {
                              const v = e.target.value;
                              patch({ areas: (selMsg.areas || []).map((x, j) => j === ai ? { ...x, label: v } : x) });
                            }}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 13, outline: 'none' }}
                          />
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: '#5C5C58' }}>{a.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Usage chips */}
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 7 }}>ใช้ในจุด</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {USAGES.map((u) => {
                      const on = selMsg.usage.includes(u);
                      return (
                        <button
                          key={u}
                          onClick={() => patch({ usage: on ? selMsg.usage.filter((x) => x !== u) : [...selMsg.usage, u] })}
                          style={{
                            padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontSize: 12,
                            border: '1px solid ' + (on ? ACCENT : '#E5E5E3'),
                            background: on ? ACCENT : '#fff',
                            color: on ? '#fff' : '#5C5C58',
                          }}
                        >
                          {u}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Preview panel */}
              <div style={{ padding: '20px 22px 28px', background: '#F7F7F5', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Preview ใน LINE</span>
                  <span style={{
                    fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 7px',
                    border: '1px solid ' + (isPaid ? '#D97706' : '#16A34A'),
                    color: isPaid ? '#D97706' : '#16A34A',
                    background: isPaid ? 'rgba(217,119,6,.08)' : 'rgba(22,163,74,.08)',
                  }}>
                    {isPaid ? 'push · นับ quota' : 'reply · ฟรี'}
                  </span>
                </div>

                <div style={{ border: '1px solid #E5E5E3', background: '#fff', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 99, background: '#F0F0EE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#9B9B98' }}>OA</span>
                    <div style={{
                      border: '1px solid #E5E5E3', overflow: 'hidden', borderRadius: '4px 14px 14px 14px', background: '#fff',
                      ...(isText ? { maxWidth: 250, padding: '10px 12px' } : { width: 250, flexShrink: 0 }),
                    }}>
                      {isText && <span style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{selMsg.body}</span>}
                      {isFlex && (
                        <>
                          <div style={{
                            height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', color: '#fff',
                            background: selMsg.image_url ? `center/cover no-repeat url("${selMsg.image_url}")` : ACCENT,
                          }}>
                            {selMsg.image_url ? '' : 'HERO 1040×520'}
                          </div>
                          <div style={{ padding: '11px 12px 12px' }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{selMsg.title}</div>
                            <div style={{ fontSize: 12, color: '#5C5C58', lineHeight: 1.5, marginTop: 4 }}>{selMsg.body}</div>
                            {selMsg.cta && (
                              <div style={{ marginTop: 9, padding: 9, borderRadius: 7, textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: '#fff', background: ACCENT }}>{selMsg.cta}</div>
                            )}
                          </div>
                        </>
                      )}
                      {(isImg || isVid) && (
                        <div style={{
                          width: '100%', height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', color: '#9B9B98',
                          background: selMsg.image_url ? `center/cover no-repeat url("${selMsg.image_url}")` : 'repeating-linear-gradient(135deg,#F7F7F5 0 8px,#EFEFEC 8px 16px)',
                        }}>
                          {selMsg.image_url ? '' : (isVid ? 'VIDEO PREVIEW' : 'IMAGE 1040×1040')}
                        </div>
                      )}
                      {isMap && (
                        <div style={{ height: 150, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#E5E5E3' }}>
                          {(selMsg.areas || []).map((a, ai) => (
                            <span key={ai} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5', fontSize: 11.5, color: '#5C5C58' }}>{a.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#C0C0BD', textAlign: 'right' }}>
                    {typeOf(selType).label} · altText {selMsg.name.length + 8} chars
                  </div>
                </div>

                <button
                  onClick={doSave}
                  disabled={!dirty || saving}
                  style={{
                    width: '100%', marginTop: 14, padding: 13, border: 0, borderRadius: 9, fontSize: 14, fontWeight: 600,
                    cursor: dirty && !saving ? 'pointer' : 'default',
                    background: dirty && !saving ? '#111111' : '#EDEDEA',
                    color: dirty && !saving ? '#fff' : '#9B9B98',
                  }}
                >
                  {saving ? 'กำลังบันทึก...' : dirty ? 'บันทึกข้อความนี้' : 'บันทึกแล้ว'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9B9B98', fontSize: 14 }}>
              เลือกข้อความจากรายการ
            </div>
          )}
        </aside>
      </div>

      {/* New message dialog */}
      {newOpen && (
        <>
          <div onClick={() => setNewOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.45)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 620, maxWidth: '92vw', background: '#fff', border: '1px solid #111', zIndex: 201,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E5E3' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>เลือกประเภทข้อความ</span>
              <button onClick={() => setNewOpen(false)} style={{ border: 0, background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#9B9B98' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {TYPES.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => addType(t.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
                    padding: 18, border: 0, borderBottom: '1px solid #E5E5E3',
                    borderRight: i % 2 === 0 ? '1px solid #E5E5E3' : undefined,
                    background: '#fff', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98' }}>{t.code}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{t.label}</span>
                  <span style={{ fontSize: 12, color: '#5C5C58', lineHeight: 1.5, marginTop: 4 }}>{t.fields}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
