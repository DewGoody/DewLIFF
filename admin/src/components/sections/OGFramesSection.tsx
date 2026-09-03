/**
 * OGFramesSection — canvas-based OG image layout editor
 * Phase 1: shell + canvas + mode / size / sample switching
 * Phase 2: layer system — palette, layer list, basic canvas rendering, selection, delete
 * Phase 3: drag/resize/rotate — snap grid, center guides, selection handles
 * Phase 4: numeric inspector — X/Y/W/H/Z/rotate, text style, align, members
 * Phase 5: frame slots — upload/clear/thumbnail, above/below toggle, scope selector
 * Phase 6+: rich layer rendering, og_layout JSON export, save to config
 */
import { useState, useRef, useEffect, useCallback } from 'react';

// ── Design tokens ──────────────────────────────────────────────────────────

const T = {
  bg:      '#F4F4F2',
  panel:   '#FFFFFF',
  border:  '1px solid #DEDEDA',
  divider: '#EFEFEC',
  text:    '#16181A',
  mid:     '#5F6469',
  dim:     '#A0A5AA',
  faint:   '#C9CCCE',
  active:  '#E8354F',
  canvas:  '#E7E7E3',
};
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono','JetBrains Mono',monospace" };
const BODY_F: React.CSSProperties = { fontFamily: "'Noto Sans Thai','Bai Jamjuree',sans-serif" };
const ACC = '#E8354F';

// ── Constants ──────────────────────────────────────────────────────────────

export const SIZES = [
  { k: '1080x1920', w: 1080, h: 1920, dim: '1080×1920', use: 'IG / LINE Story' },
  { k: '1080x1080', w: 1080, h: 1080, dim: '1080×1080', use: 'feed สี่เหลี่ยม' },
  { k: '1200x630',  w: 1200, h: 630,  dim: '1200×630',  use: 'OG link preview' },
  { k: '1000x650',  w: 1000, h: 650,  dim: '1000×650',  use: 'hero ใน Flex' },
];

export type FieldType = 'text' | 'image' | 'avatar' | 'bars' | 'chips' | 'members' | 'qr';
export type FieldDef  = [string, string, FieldType, Record<string, unknown>];

export const CAT: Record<string, FieldDef[]> = {
  common: [
    ['logo',        'โลโก้',        'image',   { w: 300, h: 90 }],
    ['qr',          'QR / ลิงก์',   'qr',      { w: 190, h: 190 }],
    ['played_at',   'วันที่เล่น',   'text',    { w: 380, h: 46,  size: 30, weight: 600, color: '#8A8F94', ls: '.06em' }],
    ['custom_text', 'ข้อความเอง',   'text',    { w: 620, h: 60,  size: 34, weight: 600 }],
  ],
  solo: [
    ['badge',        'badge / eyebrow', 'text',   { w: 460, h: 50,  size: 30,  weight: 700, ls: '.14em', color: ACC }],
    ['result_title', 'ชื่อสาย',         'text',   { w: 820, h: 130, size: 92,  weight: 700, font: 'display' }],
    ['result_body',  'คำอธิบายผล',      'text',   { w: 800, h: 230, size: 34,  weight: 500, lh: 1.65, maxLines: 4 }],
    ['result_image', 'การ์ดตัวละคร',    'image',  { w: 520, h: 680 }],
    ['user_avatar',  'avatar',          'avatar', { w: 130, h: 130 }],
    ['user_name',    'ชื่อผู้เล่น',     'text',   { w: 440, h: 58,  size: 38,  weight: 600 }],
    ['axis_bars',    'แต้มต่อสาย',      'bars',   { w: 620, h: 210 }],
  ],
  pair: [
    ['badge',       'badge ผลคู่',     'text',   { w: 520, h: 50,  size: 30,  weight: 700, ls: '.14em', color: ACC }],
    ['pair_title',  'ชื่อผลคู่',       'text',   { w: 860, h: 120, size: 78,  weight: 700, font: 'display' }],
    ['big_number',  'ตัวเลขวันรอด',    'text',   { w: 420, h: 170, size: 140, weight: 700, font: 'display' }],
    ['rank',        'อันดับ x/15',     'text',   { w: 430, h: 50,  size: 32,  weight: 600, color: '#5F6469' }],
    ['reason_body', 'เหตุผล',          'text',   { w: 830, h: 210, size: 33,  weight: 500, lh: 1.65, maxLines: 4 }],
    ['a_card',      'การ์ด A',         'image',  { w: 340, h: 440 }],
    ['a_avatar',    'avatar A',        'avatar', { w: 110, h: 110 }],
    ['a_name',      'ชื่อ A',          'text',   { w: 340, h: 50,  size: 32,  weight: 600 }],
    ['b_card',      'การ์ด B',         'image',  { w: 340, h: 440 }],
    ['b_avatar',    'avatar B',        'avatar', { w: 110, h: 110 }],
    ['b_name',      'ชื่อ B',          'text',   { w: 340, h: 50,  size: 32,  weight: 600 }],
  ],
  group: [
    ['badge',        'badge กลุ่ม',    'text',    { w: 560, h: 50,  size: 30,  weight: 700, ls: '.14em', color: ACC }],
    ['group_symbol', 'สัญลักษณ์กลุ่ม', 'image',   { w: 420, h: 420 }],
    ['group_name',   'ชื่อกลุ่ม',      'text',    { w: 880, h: 120, size: 84,  weight: 700, font: 'display' }],
    ['big_number',   'จำนวนวันรอด',    'text',    { w: 420, h: 170, size: 140, weight: 700, font: 'display' }],
    ['group_body',   'คำอธิบายกลุ่ม',  'text',    { w: 840, h: 210, size: 33,  weight: 500, lh: 1.65, maxLines: 4 }],
    ['members',      'สมาชิกกลุ่ม',    'members', { w: 900, h: 300, gap: 24, tilt: 0 }],
    ['axis_chips',   'chip สรุปสาย',   'chips',   { w: 780, h: 90 }],
  ],
};

type SampleRecord = Record<string, unknown>;
export const SAMPLES: Record<string, SampleRecord[]> = {
  solo: [
    { badge: 'SOLO RESULT · 6 ข้อ', result_title: 'สายไฟลุก', result_body: 'ตัดสินใจเร็วกว่าคิด พาทีมรอดได้ 3 วันแรกเพราะไม่มีใครกล้าเถียง แต่วันที่ 4 คือปัญหา', user_name: 'Ploy', played_at: '01 SEP 2026', custom_text: 'apocalypse-squad.line' },
    { badge: 'SOLO RESULT · 6 ข้อ', result_title: 'สายลมเปลี่ยว', result_body: 'ไม่ผูกกับใคร เลยรอดคนเดียวได้นานที่สุด — แต่ไม่มีใครจำได้ว่าคุณอยู่ในทีม', user_name: 'Beam', played_at: '01 SEP 2026', custom_text: 'apocalypse-squad.line' },
  ],
  pair: [
    { badge: 'คู่นี้รอดได้', pair_title: 'คู่หูไฟลุก × น้ำนิ่ง', big_number: '17 วัน', rank: 'อันดับ 3 จาก 15 คู่', reason_body: 'คนหนึ่งวิ่งเข้าไปก่อน อีกคนตามไปเก็บศพ — ระบบนี้ทำงานได้ดีจนน่าเป็นห่วง', a_name: 'Ploy', b_name: 'Tar', played_at: '01 SEP 2026', custom_text: 'ลองเล่นดู' },
    { badge: 'คู่นี้ไม่ควรเจอกัน', pair_title: 'คู่หูดินแน่น × ลมเปลี่ยว', big_number: '4 วัน', rank: 'อันดับ 14 จาก 15 คู่', reason_body: 'คนหนึ่งอยากตั้งฐาน อีกคนอยากเดินต่อ สรุปไม่ได้ทำอะไรเลยสามวัน', a_name: 'Nan', b_name: 'Beam', played_at: '01 SEP 2026', custom_text: 'ลองเล่นดู' },
  ],
  group: [
    { badge: 'ทีมนี้เป็นสาย', group_name: 'ทีมนรกแตก', big_number: '9 วัน', group_body: 'สามคนสายไฟลุกกับหนึ่งคนสายน้ำนิ่ง — เถียงกันจนลืมหาน้ำ', played_at: '01 SEP 2026', custom_text: 'จัดทีมของคุณ', chips: ['ไฟลุก ×2', 'น้ำนิ่ง ×1', 'เหล็กเย็น ×1'], members: [['Ploy', 'ไฟลุก'], ['Tar', 'ไฟลุก'], ['Nan', 'น้ำนิ่ง'], ['Beam', 'เหล็กเย็น']] },
    { badge: 'ทีมนี้เป็นสาย', group_name: 'ทีมแสงสุดท้าย', big_number: '21 วัน', group_body: 'ห้าคนที่ไม่มีใครเก่งเป็นพิเศษ แต่ไม่มีใครทิ้งกัน — เลยรอดนานที่สุด', played_at: '01 SEP 2026', custom_text: 'จัดทีมของคุณ', chips: ['ดินแน่น ×2', 'ลมเปลี่ยว ×2', 'น้ำนิ่ง ×1'], members: [['Ploy', 'ดินแน่น'], ['Tar', 'ลมเปลี่ยว'], ['Nan', 'ดินแน่น'], ['Beam', 'ลมเปลี่ยว'], ['Ink', 'น้ำนิ่ง']] },
  ],
};

// Default layer positions in 1080×1920 space — seed() scales to actual size
export const DEFAULTS: Record<string, Array<[string, number, number]>> = {
  solo:  [['badge', 130, 1180], ['result_title', 130, 1240], ['result_body', 130, 1400], ['result_image', 280, 380], ['user_avatar', 130, 1690], ['user_name', 282, 1712], ['logo', 130, 120]],
  pair:  [['badge', 100, 1140], ['pair_title', 100, 1200], ['big_number', 100, 1330], ['rank', 100, 1510], ['reason_body', 100, 1580], ['a_card', 100, 420], ['b_card', 640, 420], ['a_name', 100, 880], ['b_name', 640, 880], ['logo', 100, 120]],
  group: [['badge', 100, 1080], ['group_name', 100, 1130], ['big_number', 100, 1260], ['group_body', 100, 1440], ['group_symbol', 330, 300], ['members', 90, 1660], ['logo', 100, 120]],
};

export const GRID = 8;

// ── OGLayer type ───────────────────────────────────────────────────────────

export interface OGLayer {
  id: string;
  field: string;
  type: FieldType;
  x: number; y: number; w: number; h: number;
  z: number;
  rotate: number;
  align: 'left' | 'center' | 'right';
  inherit: boolean;
  font: string;       // 'body' | 'display'
  size: number;
  weight: number;
  color: string;
  lh: number;
  ls: string;
  maxLines: number;
  gap: number;
  tilt: number;
}

// ── Pure helpers ───────────────────────────────────────────────────────────

function metaFor(m: string, key: string): FieldDef {
  return [...(CAT[m] ?? []), ...CAT.common].find(f => f[0] === key) ?? ['?', key, 'text', {}];
}

function seed(m: string, sz: string): OGLayer[] {
  const sd   = SIZES.find(s => s.k === sz) ?? SIZES[0];
  const base = SIZES[0]; // 1080×1920
  const rx   = sd.w / base.w;
  const ry   = sd.h / base.h;
  const rs   = Math.min(rx, ry);
  return (DEFAULTS[m] ?? []).map(([key, x, y], i) => {
    const meta = metaFor(m, key);
    const d    = meta[3];
    return {
      id: `${m}_${key}`, field: key, type: meta[2], z: i,
      x: Math.round(x * rx), y: Math.round(y * ry),
      w: Math.round(((d.w as number) || 400) * rs),
      h: Math.round(((d.h as number) || 80)  * rs),
      size:     Math.round(((d.size   as number) || 34)   * rs),
      weight:   (d.weight   as number) || 500,
      color:    (d.color    as string) || '#16181A',
      lh:       (d.lh       as number) || 1.2,
      ls:       (d.ls       as string) || '0',
      maxLines: (d.maxLines as number) || 1,
      align: 'left', rotate: 0, inherit: true,
      font: (d.font as string) || 'body',
      gap:  (d.gap  as number) || 24,
      tilt: (d.tilt as number) || 0,
    };
  });
}

function kindLabel(t: FieldType): string {
  return ({ text:'T', image:'IMG', avatar:'AV', bars:'BAR', chips:'CHIP', members:'REP', qr:'QR' })[t] ?? 'T';
}

function fam(font: string): string {
  return font === 'display'
    ? "'Bai Jamjuree','Noto Sans Thai',sans-serif"
    : "'Noto Sans Thai',sans-serif";
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Axis { id: string; label: string }

interface Props {
  mode: string;
  axes: Axis[];
  appearance: object;
  onChange: (appearance: object) => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.09em', color: T.dim, textTransform: 'uppercase' as const }}>
      {children}
    </span>
  );
}

function SegBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, border: 'none', borderRadius: 7, padding: '6px 4px', cursor: 'pointer',
      ...BODY_F, fontSize: 11, fontWeight: active ? 700 : 400,
      background: active ? T.text : 'transparent',
      color: active ? '#FFFFFF' : T.mid,
    }}>{label}</button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OGFramesSection({ mode: propMode, axes, appearance, onChange }: Props) {
  const [mode, setMode]       = useState<'solo' | 'pair' | 'group'>(
    propMode === 'solo' || propMode === 'group' ? (propMode as 'solo' | 'group') : 'pair'
  );
  const [size, setSize]       = useState('1080x1920');
  const [sample, setSample]   = useState(0);
  const [zoom, setZoom]       = useState(1);
  const [boxW, setBoxW]       = useState(924);
  const [boxH, setBoxH]       = useState(560);
  const [layouts, setLayouts] = useState<Record<string, OGLayer[]>>({});
  const [sel, setSel]         = useState<string | null>(null);
  const [guide, setGuide]       = useState<{ v: boolean; h: boolean } | null>(null);
  const [frameScope, setFrameScope] = useState<'shared' | 'per_result'>('shared');
  const [frames, setFrames]     = useState<Record<string, string>>({});   // slot key → data URL
  const [frameAbove, setFrameAbove] = useState(false);                    // true = frame renders above layers

  const wsRef        = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSlot   = useRef<string | null>(null);

  // ── ResizeObserver ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width  > 0) setBoxW(r.width);
      if (r.height > 0) setBoxH(r.height);
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    if (r.width  > 0) setBoxW(r.width);
    if (r.height > 0) setBoxH(r.height);
    return () => ro.disconnect();
  }, []);

  // Sync mode from prop
  useEffect(() => {
    if (propMode === 'solo' || propMode === 'pair' || propMode === 'group') {
      setMode(propMode as 'solo' | 'pair' | 'group');
    }
  }, [propMode]);

  // Reset sample on mode switch
  useEffect(() => { setSample(0); setSel(null); }, [mode]);

  // ── Keyboard: Delete/Backspace removes selected layer ────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        removeLayer(sel);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scale ─────────────────────────────────────────────────────────────────
  const sizeDef   = SIZES.find(s => s.k === size) ?? SIZES[0];
  const layoutKey = `${mode}/${size}`;

  const sc = (() => {
    const availW = Math.max(220, boxW - 250 - 268 - 56);
    const availH = Math.max(200, boxH - 52);
    const fit    = Math.min(availW / sizeDef.w, availH / sizeDef.h);
    return Math.max(0.04, fit * zoom);
  })();

  // ── Layout helpers ────────────────────────────────────────────────────────
  const currLayout = layouts[layoutKey] ?? seed(mode, size);

  const setLayout = useCallback((list: OGLayer[]) => {
    setLayouts(prev => ({ ...prev, [layoutKey]: list }));
  }, [layoutKey]);

  const removeLayer = useCallback((id: string) => {
    setLayouts(prev => ({ ...prev, [layoutKey]: (prev[layoutKey] ?? seed(mode, size)).filter(l => l.id !== id) }));
    setSel(s => s === id ? null : s);
  }, [layoutKey, mode, size]);

  const patch = useCallback((id: string, p: Partial<OGLayer>) => {
    setLayouts(prev => {
      const list = prev[layoutKey] ?? seed(mode, size);
      return { ...prev, [layoutKey]: list.map(l => l.id === id ? { ...l, ...p } : l) };
    });
  }, [layoutKey, mode, size]);

  const addField = useCallback((key: string) => {
    const list = layouts[layoutKey] ?? seed(mode, size);
    const existing = list.find(l => l.field === key);
    if (existing) { setSel(existing.id); return; }
    const meta = metaFor(mode, key);
    const d    = meta[3];
    const rs   = Math.min(sizeDef.w / 1080, sizeDef.h / 1920);
    const nl: OGLayer = {
      id: `${mode}_${key}_${Date.now()}`, field: key, type: meta[2],
      z: list.length,
      x: Math.round(sizeDef.w * 0.12), y: Math.round(sizeDef.h * 0.5),
      w: Math.round(((d.w as number) || 400) * rs),
      h: Math.round(((d.h as number) || 80)  * rs),
      size:     Math.round(((d.size   as number) || 34)   * rs),
      weight:   (d.weight   as number) || 500,
      color:    (d.color    as string) || '#16181A',
      lh:       (d.lh       as number) || 1.2,
      ls:       (d.ls       as string) || '0',
      maxLines: (d.maxLines as number) || 1,
      align: 'left', rotate: 0, inherit: true,
      font: (d.font as string) || 'body',
      gap:  (d.gap  as number) || 24,
      tilt: (d.tilt as number) || 0,
    };
    setLayouts(prev => ({ ...prev, [layoutKey]: (prev[layoutKey] ?? seed(mode, size)).concat([nl]) }));
    setSel(nl.id);
  }, [layouts, layoutKey, mode, size, sizeDef]);

  // ── Z-order helpers ───────────────────────────────────────────────────────

  const bringForward = useCallback((id: string) => {
    setLayouts(prev => {
      const list = [...(prev[layoutKey] ?? seed(mode, size))].sort((a, b) => a.z - b.z);
      const idx  = list.findIndex(l => l.id === id);
      if (idx < list.length - 1) {
        const tmpZ = list[idx + 1].z;
        list[idx + 1] = { ...list[idx + 1], z: list[idx].z };
        list[idx]     = { ...list[idx],     z: tmpZ };
      }
      return { ...prev, [layoutKey]: list };
    });
  }, [layoutKey, mode, size]);

  const sendBack = useCallback((id: string) => {
    setLayouts(prev => {
      const list = [...(prev[layoutKey] ?? seed(mode, size))].sort((a, b) => a.z - b.z);
      const idx  = list.findIndex(l => l.id === id);
      if (idx > 0) {
        const tmpZ = list[idx - 1].z;
        list[idx - 1] = { ...list[idx - 1], z: list[idx].z };
        list[idx]     = { ...list[idx],     z: tmpZ };
      }
      return { ...prev, [layoutKey]: list };
    });
  }, [layoutKey, mode, size]);

  // ── Drag / Resize ─────────────────────────────────────────────────────────

  function startDrag(l: OGLayer, e: React.MouseEvent, dragMode: 'move' | 'resize') {
    e.preventDefault(); e.stopPropagation();
    setSel(l.id);
    const capturedSc    = sc;
    const capturedPatch = patch;
    const ox = e.clientX, oy = e.clientY;
    const o  = { x: l.x, y: l.y, w: l.w, h: l.h };
    const sd = sizeDef;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - ox) / capturedSc;
      const dy = (ev.clientY - oy) / capturedSc;
      if (dragMode === 'resize') {
        capturedPatch(l.id, {
          w: Math.max(40, Math.round((o.w + dx) / GRID) * GRID),
          h: Math.max(30, Math.round((o.h + dy) / GRID) * GRID),
        });
      } else {
        const nx = Math.round((o.x + dx) / GRID) * GRID;
        const ny = Math.round((o.y + dy) / GRID) * GRID;
        const cv = Math.abs(nx + o.w / 2 - sd.w / 2) < 10;
        const ch = Math.abs(ny + o.h / 2 - sd.h / 2) < 10;
        capturedPatch(l.id, { x: nx, y: ny });
        setGuide({ v: cv, h: ch });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setGuide(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Rotate ────────────────────────────────────────────────────────────────

  function startRotate(l: OGLayer, e: React.MouseEvent<HTMLElement>) {
    e.preventDefault(); e.stopPropagation();
    setSel(l.id);
    const capturedPatch = patch;
    // parentElement is the layer div; getBoundingClientRect is in screen-space (accounts for CSS scale)
    const box = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top  + box.height / 2;
    const getAngle = (ev: MouseEvent) => Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    const a0 = getAngle(e.nativeEvent);
    const r0 = l.rotate || 0;

    const onMove = (ev: MouseEvent) => {
      let nr = r0 + (getAngle(ev) - a0);
      nr = ev.shiftKey ? Math.round(nr / 15) * 15 : Math.round(nr);
      capturedPatch(l.id, { rotate: Math.max(-180, Math.min(180, nr)) });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Frame helpers ─────────────────────────────────────────────────────────

  function triggerUpload(slot: string) {
    uploadSlot.current = slot;
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slot = uploadSlot.current;
    if (!file || !slot) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setFrames(prev => ({ ...prev, [slot]: url }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function clearFrame(slot: string) {
    setFrames(prev => { const n = { ...prev }; delete n[slot]; return n; });
  }

  // Axis list for solo frame slots (fallback to 5 demo axes)
  const axesList = axes.length > 0 ? axes : Array.from({ length: 5 }, (_, i) => ({ id: `axis_${i}`, label: `สาย ${i + 1}` }));

  // Frame slots for current mode + scope
  const resultCount = mode === 'pair' ? 15 : 9;
  const frameSlots: Array<{ key: string; label: string }> = mode === 'solo'
    ? axesList.map((a, i) => ({ key: `${layoutKey}/${a.id}`, label: a.label || `สาย ${i + 1}` }))
    : frameScope === 'shared'
      ? [{ key: `${layoutKey}/shared`, label: 'เฟรมร่วม (ทุกผล)' }]
      : Array.from({ length: resultCount }, (_, i) => ({ key: `${layoutKey}/result_${i}`, label: `ผล ${i + 1}` }));

  // Which slot is currently previewed on the canvas
  const currentFrameSlot = mode === 'solo'
    ? `${layoutKey}/${axesList[sample]?.id ?? `axis_${sample}`}`
    : frameScope === 'shared' ? `${layoutKey}/shared` : `${layoutKey}/result_${sample}`;
  const currentFrameUrl = frames[currentFrameSlot];

  const sampleData    = SAMPLES[mode][sample] ?? SAMPLES[mode][0];
  const fieldsForMode = [...CAT[mode], ...CAT.common];

  // ── Layer content renderer ────────────────────────────────────────────────
  const textFor = (l: OGLayer): string => {
    const val = sampleData[l.field];
    return val != null ? String(val) : metaFor(mode, l.field)[1];
  };

  const renderLayerContent = (l: OGLayer) => {
    if (l.type === 'text') {
      return (
        <div style={{
          width: '100%', height: '100%', overflow: 'hidden',
          fontFamily: fam(l.font), fontSize: l.size, fontWeight: l.weight,
          lineHeight: l.lh, letterSpacing: l.ls, color: l.color,
          textAlign: l.align,
          display: '-webkit-box' as React.CSSProperties['display'],
          WebkitLineClamp: l.maxLines,
          WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
        }}>
          {textFor(l)}
        </div>
      );
    }
    if (l.type === 'avatar') {
      return (
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: 'repeating-linear-gradient(135deg,#D8D8D3 0 8px,#E8E8E3 8px 16px)',
          border: '2px solid #C4C4BF', boxSizing: 'border-box',
        }} />
      );
    }
    if (l.type === 'qr') {
      return (
        <div style={{
          width: '100%', height: '100%',
          background: 'conic-gradient(#16181A 0 25%,#FFFFFF 0 50%,#16181A 0 75%,#FFFFFF 0)',
          backgroundSize: '24px 24px',
          border: '8px solid #FFFFFF', boxSizing: 'border-box',
        }} />
      );
    }
    // ── image ──────────────────────────────────────────────────────────────
    if (l.type === 'image') {
      return (
        <div style={{
          width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden',
          background: 'repeating-linear-gradient(135deg,#D8D8D3 0 8px,#E8E8E3 8px 16px)',
          border: '2px solid #C4C4BF', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ ...MONO, fontSize: Math.min(28, l.h * 0.18), fontWeight: 600, color: '#8A8F94' }}>
            {metaFor(mode, l.field)[1]}
          </span>
        </div>
      );
    }

    // ── bars ───────────────────────────────────────────────────────────────
    if (l.type === 'bars') {
      const barAxes = axes.length > 0 ? axes.slice(0, 6)
        : [{ id: 'a0', label: 'ไฟลุก' }, { id: 'a1', label: 'น้ำนิ่ง' }, { id: 'a2', label: 'ดินแน่น' }, { id: 'a3', label: 'ลมเปลี่ยว' }];
      const pcts   = [72, 45, 88, 60, 35, 55];
      const rowH   = Math.floor((l.h - 8) / barAxes.length);
      const barH   = Math.max(8, Math.min(32, rowH * 0.55));
      const labelW = Math.round(l.w * 0.28);
      const numW   = Math.round(l.w * 0.10);
      const fSz    = Math.max(14, Math.min(28, barH * 0.9));
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0', boxSizing: 'border-box' }}>
          {barAxes.map((ax, i) => {
            const pct = pcts[i % pcts.length];
            return (
              <div key={ax.id} style={{ display: 'flex', alignItems: 'center', gap: Math.round(l.w * 0.02), height: rowH }}>
                <span style={{ ...BODY_F, fontSize: fSz, fontWeight: 600, color: '#5F6469', width: labelW, flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ax.label}
                </span>
                <div style={{ flex: 1, height: barH, background: '#E0E0DC', borderRadius: barH }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: ACC, borderRadius: barH }} />
                </div>
                <span style={{ ...MONO, fontSize: fSz, fontWeight: 700, color: T.text, width: numW, textAlign: 'right', flexShrink: 0 }}>
                  {pct}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    // ── chips ──────────────────────────────────────────────────────────────
    if (l.type === 'chips') {
      const chipData = (sampleData.chips as string[] | undefined) ?? ['ไฟลุก ×2', 'น้ำนิ่ง ×1', 'ดินแน่น ×1'];
      const chipH    = Math.max(24, Math.min(l.h * 0.75, 72));
      const fSz      = Math.round(chipH * 0.46);
      const px2      = Math.round(chipH * 0.5);
      const py2      = Math.round(chipH * 0.18);
      const chipColors = [ACC, '#4A7FD4', '#2EA07A', '#D48A1C', '#8E44AD'];
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap', gap: l.gap || 16, alignContent: 'center' }}>
          {chipData.map((c, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center',
              background: chipColors[i % chipColors.length],
              color: '#fff',
              borderRadius: chipH / 2, padding: `${py2}px ${px2}px`,
              ...BODY_F, fontSize: fSz, fontWeight: 700, whiteSpace: 'nowrap',
              letterSpacing: '.02em',
            }}>{c}</span>
          ))}
        </div>
      );
    }

    // ── members ────────────────────────────────────────────────────────────
    if (l.type === 'members') {
      const memberData = (sampleData.members as [string, string][] | undefined) ?? [['Pl', 'A'], ['Ta', 'B'], ['Na', 'C']];
      const cirD  = Math.max(40, Math.min(l.h * 0.85, 180));
      const gap   = l.gap ?? 24;
      const overlap = Math.max(0, cirD - gap);
      const memberColors = [ACC, '#4A7FD4', '#2EA07A', '#D48A1C', '#8E44AD', '#16A085', '#C0392B'];
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {memberData.slice(0, 7).map(([name], i) => {
            const tiltDeg = l.tilt ? l.tilt * (i % 2 === 0 ? 1 : -1) * Math.min(i * 0.4, 1) : 0;
            const ini = name.slice(0, 2);
            return (
              <div key={i} style={{
                width: cirD, height: cirD, flexShrink: 0,
                borderRadius: '50%',
                background: memberColors[i % memberColors.length],
                border: `${Math.max(3, cirD * 0.04)}px solid #fff`,
                marginLeft: i === 0 ? 0 : -overlap,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: tiltDeg ? `rotate(${tiltDeg}deg)` : undefined,
                ...BODY_F, fontSize: Math.round(cirD * 0.35), fontWeight: 700, color: '#fff',
                boxSizing: 'border-box', zIndex: i, position: 'relative',
              }}>{ini}</div>
            );
          })}
        </div>
      );
    }

    // fallback — should not reach here
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F0EC', borderRadius: 4 }}>
        <span style={{ ...MONO, fontSize: 20, color: T.dim }}>{metaFor(mode, l.field)[1]}</span>
      </div>
    );
  };

  // ── Left panel ────────────────────────────────────────────────────────────

  const renderLeft = () => {
    const usedFields = new Set(currLayout.map(l => l.field));
    const layersSorted = [...currLayout].reverse(); // show topmost first

    return (
      <div style={{
        width: 250, flexShrink: 0, borderRight: T.border, background: T.panel,
        display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto',
        padding: 11, boxSizing: 'border-box',
      }}>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 3, border: T.border, borderRadius: 9, background: T.bg, padding: 3 }}>
          {(['solo', 'pair', 'group'] as const).map(m => (
            <SegBtn key={m} label={m === 'solo' ? 'Solo' : m === 'pair' ? 'Pair' : 'Group'} active={mode === m} onClick={() => setMode(m)} />
          ))}
        </div>

        {/* ชุดเฟรม */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SecLabel>ชุดเฟรม</SecLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {mode === 'solo' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid #16181A', borderRadius: 9, background: T.bg, padding: '8px 9px', boxSizing: 'border-box' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#16181A', flexShrink: 0, display: 'inline-block' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ ...BODY_F, fontSize: 11.5, fontWeight: 700 }}>1 เฟรมต่อ 1 สาย</span>
                  <span style={{ ...BODY_F, fontSize: 10, color: T.dim }}>Solo — {axesList.length} สาย</span>
                </div>
              </div>
            ) : (
              ([
                ['shared',     'เฟรมเดียวใช้ทุกผล', '1 ไฟล์ · เลย์เอาต์ชุดเดียว'] as const,
                ['per_result', 'แยกเฟรมตามผลลัพธ์', mode === 'pair' ? '15 คู่' : '9 กลุ่ม'] as const,
              ] as const).map(([k, label, hint]) => {
                const on = frameScope === k;
                return (
                  <button key={k} onClick={() => setFrameScope(k)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    border: `1.5px solid ${on ? T.text : T.faint}`,
                    borderRadius: 9, background: on ? T.bg : T.panel,
                    padding: '8px 9px', boxSizing: 'border-box', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', border: `3px solid ${on ? T.text : T.faint}`, background: on ? T.text : 'transparent', flexShrink: 0, display: 'inline-block', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ ...BODY_F, fontSize: 11.5, fontWeight: 700, color: on ? T.text : T.mid }}>{label}</span>
                      <span style={{ ...BODY_F, fontSize: 10, color: T.dim }}>{hint}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ไฟล์เฟรม */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SecLabel>ไฟล์เฟรม PNG</SecLabel>
            {/* above/below toggle */}
            <div style={{ marginLeft: 'auto', display: 'flex', border: T.border, borderRadius: 7, overflow: 'hidden' }}>
              {([false, true] as const).map(above => (
                <button key={String(above)} onClick={() => setFrameAbove(above)} style={{
                  border: 'none', padding: '3px 7px',
                  background: frameAbove === above ? T.text : T.panel,
                  color: frameAbove === above ? '#fff' : T.dim,
                  ...MONO, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                }}>{above ? '↑ บน' : '↓ ล่าง'}</button>
              ))}
            </div>
          </div>

          {/* Slot list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: T.border, borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
            {frameSlots.map((slot, i) => {
              const url = frames[slot.key];
              const isCurrentPreview = slot.key === currentFrameSlot;
              return (
                <div key={slot.key} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 8px',
                  borderBottom: i < frameSlots.length - 1 ? `1px solid ${T.divider}` : 'none',
                  background: isCurrentPreview ? '#FFF8F8' : T.panel,
                }}>
                  {/* Thumbnail */}
                  <div style={{
                    width: 36, height: 36, flexShrink: 0, borderRadius: 5,
                    border: T.border, background: T.bg, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {url
                      ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ ...MONO, fontSize: 16, color: T.faint }}>□</span>
                    }
                    {isCurrentPreview && (
                      <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: ACC }} />
                    )}
                  </div>

                  {/* Label */}
                  <span style={{ flex: 1, ...BODY_F, fontSize: 10.5, fontWeight: isCurrentPreview ? 700 : 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {slot.label}
                  </span>

                  {/* Action */}
                  {url ? (
                    <button onClick={() => clearFrame(slot.key)} title="ลบเฟรมนี้" style={{
                      flexShrink: 0, border: '1px solid #F0C9CF', borderRadius: 6,
                      background: '#FFF5F6', width: 24, height: 24, padding: 0,
                      ...MONO, fontSize: 10, color: '#C22A42', cursor: 'pointer', lineHeight: 1,
                    }}>✕</button>
                  ) : (
                    <button onClick={() => triggerUpload(slot.key)} title="อัปโหลด PNG" style={{
                      flexShrink: 0, border: T.border, borderRadius: 6,
                      background: T.bg, width: 24, height: 24, padding: 0,
                      ...MONO, fontSize: 11, color: T.mid, cursor: 'pointer', lineHeight: 1,
                    }}>↑</button>
                  )}
                </div>
              );
            })}
          </div>
          <span style={{ ...BODY_F, fontSize: 10, color: T.dim, lineHeight: 1.5 }}>
            PNG โปร่งใส · เฟรมวางทับ canvas · แดงจุดเล็ก = preview ปัจจุบัน
          </span>
        </div>

        <div style={{ height: 1, background: T.divider }} />

        {/* คลัง field — click to add */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SecLabel>คลัง field — คลิกเพื่อวาง</SecLabel>
          {[
            { name: mode === 'solo' ? 'ผลเดี่ยว / MBTI' : mode === 'pair' ? 'ผลคู่' : 'ผลกลุ่ม', items: CAT[mode] },
            { name: 'ใช้ร่วมทุกโหมด', items: CAT.common },
          ].map(g => (
            <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ ...BODY_F, fontSize: 10, fontWeight: 600, color: T.mid }}>{g.name}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {g.items.map(f => {
                  const on = usedFields.has(f[0]);
                  return (
                    <button key={f[0]} onClick={() => addField(f[0])} style={{
                      border: `1px ${on ? 'solid' : 'dashed'} ${on ? 'transparent' : '#C9CCCE'}`,
                      borderRadius: 7,
                      background: on ? T.bg : T.panel,
                      color: on ? T.dim : T.text,
                      padding: '5px 8px', ...BODY_F, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {on ? '✓ ' : '+ '}{f[1]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* เลเยอร์ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SecLabel>เลเยอร์</SecLabel>
          {layersSorted.length === 0 ? (
            <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, padding: '4px 0' }}>
              ยังไม่มีเลเยอร์
            </div>
          ) : (
            layersSorted.map(l => {
              const active = sel === l.id;
              return (
                <div key={l.id} onClick={() => setSel(l.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  border: `1.5px solid ${active ? T.text : 'transparent'}`,
                  borderRadius: 8,
                  background: active ? T.bg : T.panel,
                  padding: '5px 6px', cursor: 'pointer', boxSizing: 'border-box',
                }}>
                  <span style={{ ...MONO, fontSize: 8.5, padding: '2px 5px', border: T.border, borderRadius: 5, background: '#F7F7F5', color: T.mid, flexShrink: 0 }}>
                    {kindLabel(l.type)}
                  </span>
                  <span style={{ flex: 1, ...BODY_F, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                    {metaFor(mode, l.field)[1]}
                  </span>
                  <span style={{ ...MONO, fontSize: 9.5, color: T.faint }}>{l.x},{l.y}</span>
                  <button onClick={e => { e.stopPropagation(); removeLayer(l.id); }} style={{
                    flexShrink: 0, border: '1px solid #EFEFEC', borderRadius: 6, background: T.panel,
                    width: 19, height: 19, padding: 0, ...MONO, fontSize: 10, color: '#C22A42', cursor: 'pointer', lineHeight: 1,
                  }}>✕</button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ── Canvas ────────────────────────────────────────────────────────────────

  const renderCanvas = () => {
    const marginR = Math.round(-sizeDef.w * (1 - sc));
    const marginB = Math.round(-sizeDef.h * (1 - sc));
    const sortedLayers = [...currLayout].sort((a, b) => a.z - b.z);

    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px 8px', boxSizing: 'border-box', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* OG canvas */}
          <div
            onMouseDown={() => setSel(null)}
            style={{
              position: 'relative',
              width: sizeDef.w, height: sizeDef.h, flexShrink: 0,
              background: '#FBFBF9',
              transform: `scale(${sc})`, transformOrigin: 'top left',
              marginRight: marginR, marginBottom: marginB,
              boxShadow: '0 10px 40px rgba(22,24,26,.18)',
              backgroundImage: [
                'linear-gradient(rgba(22,24,26,.05) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(22,24,26,.05) 1px, transparent 1px)',
              ].join(','),
              backgroundSize: `${GRID * 10}px ${GRID * 10}px`,
              cursor: 'default',
            }}
          >
            {/* Faint center guides */}
            <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(22,24,26,.06)', pointerEvents: 'none', zIndex: 0 }} />
            <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(22,24,26,.06)', pointerEvents: 'none', zIndex: 0 }} />

            {/* Active snap guides */}
            {guide?.v && (
              <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, marginLeft: -1, background: ACC, opacity: 0.75, pointerEvents: 'none', zIndex: 9999 }} />
            )}
            {guide?.h && (
              <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, marginTop: -1, background: ACC, opacity: 0.75, pointerEvents: 'none', zIndex: 9999 }} />
            )}

            {/* Frame — below layers */}
            {currentFrameUrl && !frameAbove && (
              <img src={currentFrameUrl} alt="frame" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', zIndex: 0 }} />
            )}

            {/* Empty state */}
            {sortedLayers.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'none' }}>
                <span style={{ ...MONO, fontSize: 32, fontWeight: 700, color: 'rgba(22,24,26,.14)' }}>{sizeDef.dim}</span>
                <span style={{ ...BODY_F, fontSize: 22, color: 'rgba(22,24,26,.10)' }}>เพิ่ม field จากคลังซ้ายเพื่อเริ่มออกแบบ</span>
              </div>
            )}

            {/* Layers */}
            {sortedLayers.map(l => {
              const active = sel === l.id;
              return (
                <div
                  key={l.id}
                  data-layer="true"
                  onMouseDown={e => { e.stopPropagation(); startDrag(l, e, 'move'); }}
                  style={{
                    position: 'absolute',
                    left: l.x, top: l.y, width: l.w, height: l.h,
                    transform: l.rotate ? `rotate(${l.rotate}deg)` : undefined,
                    boxSizing: 'border-box',
                    cursor: 'move',
                    outline: active ? 'none' : '1px dashed rgba(22,24,26,.20)',
                    outlineOffset: 0,
                  }}
                >
                  {renderLayerContent(l)}

                  {/* Selection ring */}
                  {active && (
                    <span style={{
                      position: 'absolute', inset: -4,
                      border: `3px solid ${ACC}`, borderRadius: 4, pointerEvents: 'none',
                    }} />
                  )}

                  {/* Rotate stem */}
                  {active && (
                    <span style={{
                      position: 'absolute', left: 'calc(50% - 1px)', top: -50,
                      width: 2, height: 46, background: ACC, pointerEvents: 'none',
                    }} />
                  )}

                  {/* Rotate handle */}
                  {active && (
                    <span
                      onMouseDown={e => startRotate(l, e)}
                      title="ลากเพื่อหมุน · Shift = snap 15°"
                      style={{
                        position: 'absolute', left: 'calc(50% - 16px)', top: -82,
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#FFFFFF', border: `3px solid ${ACC}`,
                        boxSizing: 'border-box', cursor: 'crosshair',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: ACC }} />
                    </span>
                  )}

                  {/* Rotate degree badge */}
                  {active && (
                    <span style={{
                      position: 'absolute', left: 'calc(50% + 22px)', top: -74,
                      background: ACC, color: '#FFFFFF',
                      ...MONO, fontSize: 18, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 6,
                      whiteSpace: 'nowrap', pointerEvents: 'none',
                    }}>
                      {l.rotate || 0}°
                    </span>
                  )}

                  {/* Tag badge */}
                  {active && (
                    <span style={{
                      position: 'absolute', left: 0, top: -100,
                      whiteSpace: 'nowrap', borderRadius: 6,
                      background: T.text, color: '#FFFFFF',
                      padding: '4px 8px', fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 18, fontWeight: 700, pointerEvents: 'none',
                    }}>
                      {metaFor(mode, l.field)[1]} · {l.x},{l.y}
                    </span>
                  )}

                  {/* Resize handle — bottom-right corner */}
                  {active && (
                    <span
                      onMouseDown={e => { e.stopPropagation(); startDrag(l, e, 'resize'); }}
                      style={{
                        position: 'absolute', right: -13, bottom: -13,
                        width: 26, height: 26,
                        background: '#FFFFFF', border: `3px solid ${ACC}`,
                        borderRadius: 5, boxSizing: 'border-box', cursor: 'nwse-resize',
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Frame — above layers */}
            {currentFrameUrl && frameAbove && (
              <img src={currentFrameUrl} alt="frame" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', zIndex: 500 }} />
            )}
          </div>

          {/* Zoom controls + metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', paddingTop: 9 }}>
            <button onClick={() => setZoom(z => Math.max(0.3, +(z / 1.25).toFixed(3)))}
              style={{ border: '1px solid #D6D6D1', borderRadius: 6, background: T.panel, width: 22, height: 22, padding: 0, ...MONO, fontSize: 14, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>−</button>
            <button onClick={() => setZoom(1)}
              style={{ border: '1px solid #D6D6D1', borderRadius: 6, background: T.panel, padding: '3px 8px', ...MONO, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>fit</button>
            <button onClick={() => setZoom(z => Math.min(3, +(z * 1.25).toFixed(3)))}
              style={{ border: '1px solid #D6D6D1', borderRadius: 6, background: T.panel, width: 22, height: 22, padding: 0, ...MONO, fontSize: 14, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>+</button>
            <span style={{ ...MONO, fontSize: 10.5, color: '#8A8F94' }}>
              {sizeDef.dim} · zoom {Math.round(sc * 100)}% · snap {GRID}px · {currLayout.length} layers
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ── Right panel ───────────────────────────────────────────────────────────

  const renderRight = () => {
    const selLayer = currLayout.find(l => l.id === sel) ?? null;

    // Shared input styles
    const numSt: React.CSSProperties = {
      border: T.border, borderRadius: 7, padding: '5px 7px',
      ...MONO, fontSize: 11.5, color: T.text, background: T.bg,
      width: '100%', boxSizing: 'border-box', outline: 'none',
    };
    const txtSt: React.CSSProperties = { ...numSt };

    const NumIn = ({ label, val, k, min, max, step }: { label: string; val: number; k: keyof OGLayer; min?: number; max?: number; step?: number }) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ ...MONO, fontSize: 10, color: T.mid }}>{label}</span>
        <input type="number" value={val} min={min} max={max} step={step ?? 1}
          onChange={e => { const n = +e.target.value; if (!isNaN(n)) patch(selLayer!.id, { [k]: n } as Partial<OGLayer>); }}
          style={numSt} />
      </div>
    );

    const segBtn = (label: string, active: boolean, onClick: () => void, danger = false) => (
      <button onClick={onClick} style={{
        flex: 1, border: `1.5px solid ${active ? (danger ? '#C22A42' : T.text) : T.faint}`,
        borderRadius: 7, padding: '5px 0',
        background: active ? (danger ? '#C22A42' : T.text) : T.panel,
        color: active ? '#fff' : T.mid,
        ...BODY_F, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
      }}>{label}</button>
    );

    return (
      <div style={{
        width: 268, flexShrink: 0, borderLeft: T.border, background: T.panel,
        display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto',
        padding: 11, boxSizing: 'border-box',
      }}>

        {/* ขนาดภาพ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SecLabel>ขนาดภาพ</SecLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {SIZES.map(s => (
              <button key={s.k} onClick={() => { setSize(s.k); setSel(null); }} style={{
                display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
                border: `1.5px solid ${size === s.k ? T.text : '#DEDEDA'}`,
                borderRadius: 8, background: size === s.k ? T.bg : T.panel,
                padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ ...MONO, fontSize: 10.5, fontWeight: 700 }}>{s.dim}</span>
                <span style={{ ...BODY_F, fontSize: 9.5, color: T.dim }}>{s.use}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ข้อมูลตัวอย่าง */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SecLabel>ข้อมูลตัวอย่าง</SecLabel>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SAMPLES[mode].map((s, i) => {
              const label = mode === 'solo' ? (s.result_title as string)
                          : mode === 'pair' ? (s.pair_title as string)
                          : (s.group_name as string);
              return (
                <button key={i} onClick={() => setSample(i)} style={{
                  border: `1.5px solid ${sample === i ? T.text : '#DEDEDA'}`,
                  borderRadius: 7,
                  background: sample === i ? T.text : T.panel,
                  color: sample === i ? '#FFFFFF' : T.mid,
                  padding: '6px 9px', ...BODY_F, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                }}>{label}</button>
              );
            })}
          </div>
        </div>

        <div style={{ height: 1, background: T.divider }} />

        {/* ── Inspector ── */}
        {!selLayer ? (
          <div style={{ padding: '14px 4px', display: 'flex', flexDirection: 'column', gap: 8, ...BODY_F, fontSize: 11.5, lineHeight: 1.7, color: T.dim }}>
            <span>คลิกหรือลากเลเยอร์บนภาพ · snap ทุก {GRID}px · จับมุมขวาล่างเพื่อย่อ-ขยาย · จับวงกลมบนเพื่อหมุน (Shift = 15°)</span>
            <span><b style={{ color: T.mid }}>เอา field ออก:</b> กด ✕ ท้ายแถวในลิสต์เลเยอร์ หรือเลือกบนภาพแล้วกด Delete</span>
          </div>
        ) : (
          <div key={selLayer.id} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ ...MONO, fontSize: 9.5, padding: '3px 6px', border: T.border, borderRadius: 6, background: '#F7F7F5', color: T.mid }}>
                {kindLabel(selLayer.type)}
              </span>
              <span style={{ ...BODY_F, fontSize: 13, fontWeight: 700 }}>{metaFor(mode, selLayer.field)[1]}</span>
              <button onClick={() => removeLayer(selLayer.id)} style={{ marginLeft: 'auto', border: '1px solid #F0C9CF', borderRadius: 7, background: '#FFF5F6', padding: '5px 8px', ...BODY_F, fontSize: 10.5, fontWeight: 600, color: '#C22A42', cursor: 'pointer' }}>ลบ</button>
            </div>
            <span style={{ ...MONO, fontSize: 9, color: T.faint }}>og_layout.{layoutKey}.{selLayer.field}</span>

            {/* Position & size */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SecLabel>ตำแหน่ง & ขนาด</SecLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <NumIn label="X" val={selLayer.x} k="x" min={-sizeDef.w} max={sizeDef.w * 2} />
                <NumIn label="Y" val={selLayer.y} k="y" min={-sizeDef.h} max={sizeDef.h * 2} />
                <NumIn label="W" val={selLayer.w} k="w" min={20} max={sizeDef.w} />
                <NumIn label="H" val={selLayer.h} k="h" min={10} max={sizeDef.h} />
              </div>
            </div>

            {/* Z order */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SecLabel>ลำดับชั้น (Z)</SecLabel>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <button onClick={() => sendBack(selLayer.id)} style={{ border: T.border, borderRadius: 7, background: T.bg, padding: '5px 10px', ...MONO, fontSize: 11, cursor: 'pointer', color: T.mid }}>↓ หลัง</button>
                <span style={{ flex: 1, textAlign: 'center', ...MONO, fontSize: 12, fontWeight: 700, color: T.text }}>{selLayer.z}</span>
                <button onClick={() => bringForward(selLayer.id)} style={{ border: T.border, borderRadius: 7, background: T.bg, padding: '5px 10px', ...MONO, fontSize: 11, cursor: 'pointer', color: T.mid }}>↑ หน้า</button>
              </div>
            </div>

            {/* Rotate */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SecLabel>หมุน</SecLabel>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="number" value={selLayer.rotate} min={-180} max={180} step={1}
                  onChange={e => { const n = +e.target.value; if (!isNaN(n)) patch(selLayer.id, { rotate: Math.max(-180, Math.min(180, n)) }); }}
                  style={{ ...numSt, width: 64, flexShrink: 0 }} />
                <span style={{ ...MONO, fontSize: 11, color: T.mid }}>°</span>
                {([0, 90, -90, 180] as const).map(deg => (
                  <button key={deg} onClick={() => patch(selLayer.id, { rotate: deg })} style={{
                    flex: 1, border: `1.5px solid ${selLayer.rotate === deg ? T.text : T.faint}`,
                    borderRadius: 6, padding: '4px 0',
                    background: selLayer.rotate === deg ? T.text : T.panel,
                    color: selLayer.rotate === deg ? '#fff' : T.mid,
                    ...MONO, fontSize: 10, cursor: 'pointer',
                  }}>{deg}°</button>
                ))}
              </div>
            </div>

            {/* ── Text style ── */}
            {selLayer.type === 'text' && (
              <>
                <div style={{ height: 1, background: T.divider }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <SecLabel>สไตล์ข้อความ</SecLabel>

                  {/* Font family */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ ...MONO, fontSize: 10, color: T.mid }}>Font</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {segBtn('Body', selLayer.font !== 'display', () => patch(selLayer.id, { font: 'body' }))}
                      {segBtn('Display', selLayer.font === 'display', () => patch(selLayer.id, { font: 'display' }))}
                    </div>
                  </div>

                  {/* Size + Weight */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <NumIn label="Size (px)" val={selLayer.size} k="size" min={8} max={400} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ ...MONO, fontSize: 10, color: T.mid }}>Weight</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                        {([400, 500, 600, 700] as const).map(w => (
                          <button key={w} onClick={() => patch(selLayer.id, { weight: w })} style={{
                            border: `1.5px solid ${selLayer.weight === w ? T.text : T.faint}`,
                            borderRadius: 6, padding: '4px 0',
                            background: selLayer.weight === w ? T.text : T.panel,
                            color: selLayer.weight === w ? '#fff' : T.mid,
                            ...MONO, fontSize: 10, fontWeight: w, cursor: 'pointer',
                          }}>{w}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Color */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ ...MONO, fontSize: 10, color: T.mid }}>Color</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="color" value={selLayer.color} onChange={e => patch(selLayer.id, { color: e.target.value })}
                        style={{ width: 34, height: 30, border: T.border, borderRadius: 7, padding: 2, cursor: 'pointer', background: T.bg, flexShrink: 0 }} />
                      <input type="text" value={selLayer.color}
                        onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) patch(selLayer.id, { color: e.target.value }); }}
                        style={{ ...txtSt, flex: 1 }} />
                    </div>
                  </div>

                  {/* Align */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ ...MONO, fontSize: 10, color: T.mid }}>Align</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['left', 'center', 'right'] as const).map(a => (
                        segBtn(a === 'left' ? '← ซ้าย' : a === 'center' ? '— กลาง' : 'ขวา →', selLayer.align === a, () => patch(selLayer.id, { align: a }))
                      ))}
                    </div>
                  </div>

                  {/* Line height + Letter spacing */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <NumIn label="Line height" val={selLayer.lh} k="lh" min={0.8} max={4} step={0.05} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ ...MONO, fontSize: 10, color: T.mid }}>Letter spacing</span>
                      <input type="text" value={selLayer.ls}
                        onChange={e => patch(selLayer.id, { ls: e.target.value })}
                        placeholder="0 / .12em"
                        style={txtSt} />
                    </div>
                  </div>

                  {/* Max lines */}
                  <NumIn label="Max lines" val={selLayer.maxLines} k="maxLines" min={1} max={20} />
                </div>
              </>
            )}

            {/* ── Members config ── */}
            {selLayer.type === 'members' && (
              <>
                <div style={{ height: 1, background: T.divider }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <SecLabel>สมาชิก</SecLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <NumIn label="Gap (px)" val={selLayer.gap} k="gap" min={0} max={200} />
                    <NumIn label="Tilt (deg)" val={selLayer.tilt} k="tilt" min={-45} max={45} />
                  </div>
                </div>
              </>
            )}

          </div>
        )}

        {/* ── Export / Save ── */}
        <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 1, background: T.divider }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={exportJSON} style={{
              flex: 1, border: T.border, borderRadius: 8,
              background: T.bg, padding: '8px 0',
              ...BODY_F, fontSize: 11, fontWeight: 600, color: T.mid, cursor: 'pointer',
            }}>↓ JSON</button>
            <button onClick={saveConfig} style={{
              flex: 2, border: 'none', borderRadius: 8,
              background: T.text, padding: '8px 0',
              ...BODY_F, fontSize: 11.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}>บันทึก og_layout</button>
          </div>
          <span style={{ ...MONO, fontSize: 9, color: T.faint, textAlign: 'center' as const, lineHeight: 1.5 }}>
            บันทึก = เขียนลง appearance config · JSON = download og_layout.json
          </span>
        </div>

      </div>
    );
  };

  // ── Export / Save ─────────────────────────────────────────────────────────

  function exportJSON() {
    // Serialize all edited layouts; seed any un-touched layouts so they still export
    const allLayouts: Record<string, OGLayer[]> = {};
    const modeSizes = SIZES.map(s => ({ mode: 'solo', size: s.k }))
      .concat(SIZES.map(s => ({ mode: 'pair', size: s.k })))
      .concat(SIZES.map(s => ({ mode: 'group', size: s.k })));
    for (const { mode: m, size: sz } of modeSizes) {
      const k = `${m}/${sz}`;
      if (layouts[k]) allLayouts[k] = layouts[k];
    }
    const data = {
      og_layout:      allLayouts,
      og_frame_scope: { pair: frameScope, group: frameScope },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'og_layout.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function saveConfig() {
    const base = appearance as Record<string, unknown>;
    onChange({
      ...base,
      og_layout:      layouts,
      og_frame_scope: { pair: frameScope, group: frameScope },
    } as object);
  }

  // ── Root ──────────────────────────────────────────────────────────────────

  void setLayout;
  void fieldsForMode;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Hidden file input for frame upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {renderLeft()}
      <div ref={wsRef} style={{ flex: 1, minWidth: 0, position: 'relative', background: T.canvas, overflow: 'hidden' }}>
        {renderCanvas()}
      </div>
      {renderRight()}
    </div>
  );
}
