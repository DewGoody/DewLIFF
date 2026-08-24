import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchRichMenus,
  createRichMenu,
  updateRichMenu,
  deleteRichMenu,
  deployRichMenu,
  type RichMenu,
  type RichMenuArea,
} from '../api';

// ── Layout definitions ──

const LAYOUTS: { id: RichMenu['layout']; label: string; cols: number; rows: number; size: RichMenu['size'] }[] = [
  { id: '3x2', label: '3×2', cols: 3, rows: 2, size: 'full' },
  { id: '3x1', label: '3×1', cols: 3, rows: 1, size: 'compact' },
  { id: '2x2', label: '2×2', cols: 2, rows: 2, size: 'full' },
  { id: '2x1', label: '2×1', cols: 2, rows: 1, size: 'compact' },
];

function getCellCount(layout: RichMenu['layout']): number {
  switch (layout) {
    case '3x2': return 6;
    case '3x1': return 3;
    case '2x2': return 4;
    case '2x1': return 2;
  }
}

function getLayoutDef(layout: RichMenu['layout']) {
  return LAYOUTS.find((l) => l.id === layout) || LAYOUTS[0];
}

// ── Tiny helpers ──

function fmt(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function blankArea(cell: number): RichMenuArea {
  return { cell, label: `ปุ่ม ${cell + 1}`, action: { type: 'uri', uri: 'https://line.me' } };
}

// ── Create Dialog ──

interface CreateDialogProps {
  onClose: () => void;
  onCreate: (menu: RichMenu) => void;
}

function CreateDialog({ onClose, onCreate }: CreateDialogProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [layout, setLayout] = useState<RichMenu['layout']>('3x2');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const aliasId = id ? `richmenu-${id}` : '';
  const layoutDef = getLayoutDef(layout);

  const handleCreate = async () => {
    if (!id.trim() || !name.trim()) { setErr('กรุณากรอก ID และชื่อเมนู'); return; }
    if (!/^[a-z0-9_-]+$/.test(id)) { setErr('ID ใช้ได้เฉพาะตัวเล็ก ตัวเลข _ -'); return; }
    setSaving(true);
    setErr('');
    try {
      const menu = await createRichMenu({ id, name, alias_id: aliasId, size: layoutDef.size, layout });
      onCreate(menu);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'สร้างไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', width: 480, border: '1px solid #E5E5E3', padding: '28px 28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.015em' }}>สร้าง Rich Menu ใหม่</span>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#9B9B98' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>ID (slug)</div>
            <input
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="main, campaign_hub, settings"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #E5E5E3', fontSize: 13, fontFamily: "'DM Mono',monospace", outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>ชื่อเมนู</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เมนูหลัก"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #E5E5E3', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 5 }}>Alias ID (LINE)</div>
            <div style={{ padding: '9px 12px', border: '1px solid #E5E5E3', fontSize: 13, fontFamily: "'DM Mono',monospace", background: '#F7F7F5', color: '#5C5C58' }}>
              {aliasId || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>Layout</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  style={{
                    padding: '10px 6px', border: '1px solid ' + (layout === l.id ? '#111' : '#E5E5E3'),
                    background: layout === l.id ? '#111' : '#fff',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <LayoutThumb cols={l.cols} rows={l.rows} selected={layout === l.id} />
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: layout === l.id ? '#fff' : '#111' }}>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {err && <div style={{ fontSize: 12.5, color: '#E63B2E', padding: '8px 10px', background: 'rgba(230,59,46,.06)', border: '1px solid rgba(230,59,46,.2)' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '9px 16px', border: '1px solid #E5E5E3', background: '#fff', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{ padding: '9px 18px', border: 0, background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? .6 : 1 }}
            >
              {saving ? 'กำลังสร้าง…' : 'สร้างเมนู'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Layout Thumbnail ──

function LayoutThumb({ cols, rows, selected }: { cols: number; rows: number; selected: boolean }) {
  const cells = cols * rows;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols},1fr)`,
      gap: 2,
      width: 48, height: rows === 2 ? 32 : 18,
    }}>
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} style={{ background: selected ? 'rgba(255,255,255,.35)' : '#E5E5E3', border: selected ? '1px solid rgba(255,255,255,.5)' : '1px solid #C9C9C6' }} />
      ))}
    </div>
  );
}

// ── Visual Grid ──

interface GridPreviewProps {
  layout: RichMenu['layout'];
  areas: RichMenuArea[];
  selectedCell: number | null;
  onCellClick: (cell: number) => void;
}

function GridPreview({ layout, areas, selectedCell, onCellClick }: GridPreviewProps) {
  const def = getLayoutDef(layout);
  const cellCount = getCellCount(layout);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${def.cols},1fr)`,
      border: '1px solid #E5E5E3',
      background: '#F7F7F5',
      aspectRatio: `2500 / ${def.size === 'full' ? 1686 : 843}`,
    }}>
      {Array.from({ length: cellCount }).map((_, cell) => {
        const area = areas.find((a) => a.cell === cell);
        const isSelected = selectedCell === cell;
        return (
          <button
            key={cell}
            onClick={() => onCellClick(cell)}
            style={{
              border: 0,
              borderRight: cell % def.cols < def.cols - 1 ? '1px solid #E5E5E3' : '0',
              borderBottom: Math.floor(cell / def.cols) < def.rows - 1 ? '1px solid #E5E5E3' : '0',
              background: isSelected ? 'rgba(17,17,17,.06)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 8,
              outline: isSelected ? '2px solid #111' : 'none',
              outlineOffset: -2,
            }}
          >
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#9B9B98' }}>
              {cell}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#111', textAlign: 'center', wordBreak: 'break-all' }}>
              {area?.label || `ปุ่ม ${cell + 1}`}
            </span>
            {area && (
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: 8, letterSpacing: '.04em', textTransform: 'uppercase',
                padding: '2px 5px', border: '1px solid #E5E5E3', background: '#fff', color: '#5C5C58',
              }}>
                {area.action.type}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Cell Editor ──

interface CellEditorProps {
  cell: number;
  area: RichMenuArea;
  allMenus: RichMenu[];
  currentMenuId: string;
  onChange: (area: RichMenuArea) => void;
}

function CellEditor({ cell, area, allMenus, currentMenuId, onChange }: CellEditorProps) {
  const otherMenus = allMenus.filter((m) => m.id !== currentMenuId);

  const update = (patch: Partial<RichMenuArea>) => onChange({ ...area, ...patch });
  const updateAction = (patch: Partial<RichMenuArea['action']>) => onChange({ ...area, action: { ...area.action, ...patch } });

  return (
    <div style={{ border: '1px solid #111', background: '#FAFAF9', padding: '16px 16px 18px' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 12 }}>
        เซลล์ {cell} — แก้ไข
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Label */}
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>Label</div>
          <input
            value={area.label}
            onChange={(e) => update({ label: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', fontSize: 13, outline: 'none' }}
          />
        </div>

        {/* Action type */}
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>Action type</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['uri', 'message', 'postback', 'richmenuswitch'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateAction({ type: t })}
                style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 10.5, padding: '5px 10px',
                  border: '1px solid ' + (area.action.type === t ? '#111' : '#E5E5E3'),
                  background: area.action.type === t ? '#111' : '#fff',
                  color: area.action.type === t ? '#fff' : '#5C5C58',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional fields */}
        {area.action.type === 'uri' && (
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>URL</div>
            <input
              value={area.action.uri || ''}
              onChange={(e) => updateAction({ uri: e.target.value })}
              placeholder="https://..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', fontSize: 13, outline: 'none' }}
            />
          </div>
        )}

        {area.action.type === 'message' && (
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>ข้อความที่ส่ง</div>
            <input
              value={area.action.text || ''}
              onChange={(e) => updateAction({ text: e.target.value })}
              placeholder="ข้อความที่ user จะส่ง"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', fontSize: 13, outline: 'none' }}
            />
          </div>
        )}

        {area.action.type === 'postback' && (
          <>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>Data</div>
              <input
                value={area.action.data || ''}
                onChange={(e) => updateAction({ data: e.target.value })}
                placeholder="action=open&menu=main"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', fontSize: 13, fontFamily: "'DM Mono',monospace", outline: 'none' }}
              />
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>Display text (optional)</div>
              <input
                value={area.action.displayText || ''}
                onChange={(e) => updateAction({ displayText: e.target.value })}
                placeholder="ข้อความที่แสดงในแชท"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', fontSize: 13, outline: 'none' }}
              />
            </div>
          </>
        )}

        {area.action.type === 'richmenuswitch' && (
          <>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>เปลี่ยนไปเมนู</div>
              {otherMenus.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#9B9B98', padding: '8px 10px', border: '1px solid #E5E5E3', background: '#F7F7F5' }}>
                  ยังไม่มีเมนูอื่น — สร้างเมนูเพิ่มก่อน
                </div>
              ) : (
                <select
                  value={area.action.richMenuAliasId || ''}
                  onChange={(e) => updateAction({ richMenuAliasId: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', fontSize: 13, background: '#fff', outline: 'none' }}
                >
                  <option value="">— เลือกเมนู —</option>
                  {otherMenus.map((m) => (
                    <option key={m.id} value={m.alias_id}>{m.name} ({m.alias_id})</option>
                  ))}
                </select>
              )}
              <div style={{ fontSize: 11.5, color: '#9B9B98', marginTop: 5 }}>→ richMenuAliasId: {area.action.richMenuAliasId || '—'}</div>
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>Switch data</div>
              <input
                value={area.action.switchData || ''}
                onChange={(e) => updateAction({ switchData: e.target.value })}
                placeholder="switch_to_main"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', fontSize: 13, fontFamily: "'DM Mono',monospace", outline: 'none' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──

export default function RichMenuManager() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<RichMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RichMenu | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showNote = (msg: string, err = false) => {
    setNote(msg); setNoteError(err);
    setTimeout(() => { setNote(''); setNoteError(false); }, 4500);
  };

  const load = async () => {
    try {
      const data = await fetchRichMenus();
      setMenus(data);
    } catch (e) {
      showNote('โหลดไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleSelect = (menu: RichMenu) => {
    setSelected({ ...menu });
    setSelectedCell(null);
    setDirty(false);
    setDeployResult(null);
  };

  const handleFieldChange = (patch: Partial<RichMenu>) => {
    if (!selected) return;
    setSelected((prev) => prev ? { ...prev, ...patch } : prev);
    setDirty(true);
    setDeployResult(null);
  };

  const handleCellClick = (cell: number) => {
    if (!selected) return;
    setSelectedCell(cell);
    // Ensure area exists for this cell
    const exists = selected.areas.some((a) => a.cell === cell);
    if (!exists) {
      const newAreas = [...selected.areas, blankArea(cell)];
      handleFieldChange({ areas: newAreas });
    }
  };

  const handleAreaChange = (area: RichMenuArea) => {
    if (!selected) return;
    const newAreas = selected.areas.map((a) => a.cell === area.cell ? area : a);
    handleFieldChange({ areas: newAreas });
  };

  const handleSave = async () => {
    if (!selected || !dirty || saving) return;
    setSaving(true);
    try {
      const updated = await updateRichMenu(selected.id, {
        name: selected.name,
        areas: selected.areas,
        is_default: selected.is_default,
        image_url: selected.image_url ?? undefined,
        layout: selected.layout,
        size: selected.size,
      });
      setMenus((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      setSelected(updated);
      setDirty(false);
      showNote('บันทึกแล้ว');
    } catch (e) {
      showNote('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!selected || deploying) return;
    // Save first if dirty
    if (dirty) await handleSave();
    setDeploying(true);
    setDeployResult(null);
    try {
      const result = await deployRichMenu(selected.id);
      setDeployResult(result.lineId);
      // Refresh menu
      const updated = await fetchRichMenus();
      setMenus(updated);
      const refreshed = updated.find((m) => m.id === selected.id);
      if (refreshed) setSelected(refreshed);
      showNote('เผยแพร่บน LINE แล้ว · Rich Menu ID: ' + result.lineId);
    } catch (e) {
      showNote('Deploy ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRichMenu(id);
      setMenus((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) { setSelected(null); setDirty(false); }
      setConfirmDelete(null);
      showNote('ลบเมนูแล้ว');
    } catch (e) {
      showNote('ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)), true);
      setConfirmDelete(null);
    }
  };

  const handleQuickDeploy = async (id: string) => {
    const menu = menus.find((m) => m.id === id);
    if (!menu) return;
    try {
      const result = await deployRichMenu(id);
      const updated = await fetchRichMenus();
      setMenus(updated);
      if (selected?.id === id) {
        const refreshed = updated.find((m) => m.id === id);
        if (refreshed) setSelected(refreshed);
      }
      showNote('Deploy สำเร็จ · ' + result.lineId);
    } catch (e) {
      showNote('Deploy ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)), true);
    }
  };

  const selectedArea = selected && selectedCell !== null
    ? selected.areas.find((a) => a.cell === selectedCell) || blankArea(selectedCell)
    : null;

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
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>Rich Menu Manager</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '9px 16px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600, background: '#111111', color: '#fff', cursor: 'pointer' }}
        >
          + สร้าง Rich Menu
        </button>
      </div>

      {/* Note bar */}
      {note && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px', borderBottom: '1px solid #E5E5E3', fontSize: 13,
          background: noteError ? 'rgba(230,59,46,.08)' : 'rgba(22,163,74,.08)',
        }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: noteError ? '#E63B2E' : '#16A34A' }}>
            {noteError ? 'Error' : 'OK'}
          </span>
          <span>{note}</span>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', border: '1px solid #E5E5E3', padding: '24px 28px', width: 380 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>ยืนยันการลบ?</div>
            <div style={{ fontSize: 13, color: '#5C5C58', marginBottom: 18 }}>
              หากเมนูนี้ถูก deploy บน LINE แล้ว ระบบจะลบออกจาก LINE ด้วย
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 14px', border: '1px solid #E5E5E3', background: '#fff', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '8px 14px', border: 0, background: '#E63B2E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>ลบเมนู</button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9B9B98', fontSize: 14 }}>
          กำลังโหลด...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 'calc(100vh - 57px)' }}>
          {/* Left: menu list */}
          <div style={{ borderRight: '1px solid #E5E5E3', padding: '20px 0', overflowY: 'auto' }}>
            {menus.length === 0 && (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: '#9B9B98', fontSize: 13 }}>
                ยังไม่มีเมนู<br />กด "สร้าง Rich Menu" เพื่อเริ่ม
              </div>
            )}
            {menus.map((menu) => {
              const isDeployed = !!menu.deployed_at;
              const isSelected = selected?.id === menu.id;
              return (
                <div
                  key={menu.id}
                  onClick={() => handleSelect(menu)}
                  style={{
                    padding: '14px 20px', borderBottom: '1px solid #E5E5E3', cursor: 'pointer',
                    background: isSelected ? '#FAFAF9' : '#fff',
                    borderLeft: isSelected ? '3px solid #111' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{menu.name}</span>
                        {menu.is_default && (
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', background: '#111', color: '#fff' }}>default</span>
                        )}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: '#9B9B98', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menu.alias_id}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, padding: '2px 7px', border: '1px solid #E5E5E3', background: '#F7F7F5', color: '#5C5C58' }}>{menu.layout}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, padding: '2px 7px', border: '1px solid #E5E5E3', background: '#F7F7F5', color: '#5C5C58' }}>{menu.size}</span>
                    {isDeployed ? (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, padding: '2px 7px', border: '1px solid #16A34A', background: 'rgba(22,163,74,.06)', color: '#16A34A' }}>
                        เผยแพร่แล้ว
                      </span>
                    ) : (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, padding: '2px 7px', border: '1px solid #E5E5E3', background: '#F7F7F5', color: '#9B9B98' }}>
                        แบบร่าง
                      </span>
                    )}
                  </div>

                  {isDeployed && (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: '#9B9B98', marginBottom: 8 }}>
                      {fmt(menu.deployed_at)}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleSelect(menu)}
                      style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid #E5E5E3', background: '#fff', cursor: 'pointer' }}
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleQuickDeploy(menu.id)}
                      style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid #E5E5E3', background: '#fff', cursor: 'pointer' }}
                    >
                      Deploy →
                    </button>
                    <button
                      onClick={() => setConfirmDelete(menu.id)}
                      style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid #E5E5E3', background: '#fff', color: '#E63B2E', cursor: 'pointer' }}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: editor panel */}
          <div style={{ overflowY: 'auto' }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9B9B98', fontSize: 13 }}>
                เลือกเมนูทางซ้ายเพื่อแก้ไข
              </div>
            ) : (
              <div style={{ padding: '24px 28px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Editor header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: '#9B9B98', marginTop: 2 }}>{selected.alias_id}</div>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    style={{
                      padding: '9px 16px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600,
                      cursor: dirty ? 'pointer' : 'default',
                      background: dirty ? '#111111' : '#F0F0EE',
                      color: dirty ? '#fff' : '#9B9B98',
                      opacity: saving ? .7 : 1,
                    }}
                  >
                    {saving ? 'กำลังบันทึก…' : dirty ? 'Save · มีการแก้' : 'Saved'}
                  </button>
                </div>

                {/* Section A: ข้อมูลทั่วไป */}
                <div style={{ border: '1px solid #E5E5E3' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E3', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>
                    A — ข้อมูลทั่วไป
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>ชื่อเมนู</div>
                      <input
                        value={selected.name}
                        onChange={(e) => handleFieldChange({ name: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #E5E5E3', fontSize: 13, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 4 }}>Alias ID</div>
                      <div style={{ padding: '9px 12px', border: '1px solid #E5E5E3', background: '#F7F7F5', fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#5C5C58' }}>
                        {selected.alias_id}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#9B9B98', marginTop: 4 }}>LINE ใช้ชื่อนี้ในการ switch</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginBottom: 8 }}>Layout</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                        {LAYOUTS.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => handleFieldChange({ layout: l.id, size: l.size })}
                            style={{
                              padding: '10px 6px', border: '1px solid ' + (selected.layout === l.id ? '#111' : '#E5E5E3'),
                              background: selected.layout === l.id ? '#111' : '#fff',
                              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            }}
                          >
                            <LayoutThumb cols={l.cols} rows={l.rows} selected={selected.layout === l.id} />
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: selected.layout === l.id ? '#fff' : '#111' }}>{l.label}</span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: selected.layout === l.id ? 'rgba(255,255,255,.6)' : '#9B9B98' }}>{l.size}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section B: Tap Areas */}
                <div style={{ border: '1px solid #E5E5E3' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E3', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>
                    B — ตั้งค่า Tap Area
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 12.5, color: '#9B9B98' }}>คลิกเซลล์เพื่อแก้ไข action</div>
                    <GridPreview
                      layout={selected.layout}
                      areas={selected.areas}
                      selectedCell={selectedCell}
                      onCellClick={handleCellClick}
                    />

                    {selectedCell !== null && selectedArea && (
                      <CellEditor
                        cell={selectedCell}
                        area={selectedArea}
                        allMenus={menus}
                        currentMenuId={selected.id}
                        onChange={handleAreaChange}
                      />
                    )}
                  </div>
                </div>

                {/* Section C: Deploy */}
                <div style={{ border: '1px solid #E5E5E3' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E3', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>
                    C — Deploy
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, color: '#5C5C58', lineHeight: 1.6 }}>
                      กดปุ่ม Deploy เพื่อส่งเมนูขึ้น LINE — ระบบจะสร้าง rich menu และผูก alias <span style={{ fontFamily: "'DM Mono',monospace" }}>{selected.alias_id}</span> ให้อัตโนมัติ
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        onClick={() => handleFieldChange({ is_default: !selected.is_default })}
                        style={{
                          padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                          border: '1px solid ' + (selected.is_default ? '#16A34A' : '#E5E5E3'),
                          background: selected.is_default ? 'rgba(22,163,74,.08)' : '#F7F7F5',
                          color: selected.is_default ? '#16A34A' : '#9B9B98',
                        }}
                      >
                        {selected.is_default ? 'ตั้งเป็น Default แล้ว' : 'ตั้งเป็น Default'}
                      </button>
                      <span style={{ fontSize: 12.5, color: '#9B9B98' }}>ส่งเมนูนี้ไปทุก user อัตโนมัติ</span>
                    </div>

                    <button
                      onClick={handleDeploy}
                      disabled={deploying}
                      style={{
                        padding: '12px 20px', border: 0, background: deploying ? '#9B9B98' : '#111111',
                        color: '#fff', fontSize: 14, fontWeight: 700, cursor: deploying ? 'default' : 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {deploying ? 'กำลัง Deploy…' : 'Deploy ขึ้น LINE →'}
                    </button>

                    {/* After deploy — show LINE ID and alias */}
                    {(selected.line_id || deployResult) && (
                      <div style={{ border: '1px solid #16A34A', background: 'rgba(22,163,74,.06)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#16A34A' }}>เผยแพร่แล้ว</span>
                          <span style={{ fontSize: 12.5, color: '#5C5C58' }}>{fmt(selected.deployed_at)}</span>
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: '#5C5C58' }}>
                          LINE ID: {selected.line_id || deployResult}
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: '#5C5C58' }}>
                          Alias: {selected.alias_id}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          onCreate={(menu) => {
            setMenus((prev) => [menu, ...prev]);
            setShowCreate(false);
            handleSelect(menu);
          }}
        />
      )}
    </>
  );
}
