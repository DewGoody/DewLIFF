import { useState } from 'react';
import type { AppearanceConfig } from '../../types';
import ImageUploader from '../ImageUploader';

interface Props {
  appearance: AppearanceConfig;
  onChange: (a: AppearanceConfig) => void;
}

// ── Presets ────────────────────────────────────────────────────────────

const PRESETS: Record<string, Partial<AppearanceConfig>> = {
  Codera: {
    colors: {
      primary: '#2A9D8F', on_primary: '#FFFFFF', surface: '#FFFFFF',
      on_surface: '#1F3A37', muted: '#5F726F', accent: '#E0A6B5',
      success: '#2A9D8F', danger: '#C0392B', overlay: 'rgba(0,0,0,.45)',
      background: '#F4F4F2', highlight: '#DFF3EF',
    },
    font_display: 'Noto Sans Thai', font_body: 'Noto Sans Thai', font_accent: '',
    font_scale: 1,
    radius: 16, border_width: 1, shadow: 'soft', shadow_offset: 4,
    tilt: 'off', texture: 'none',
    screen_config: {
      cover: 'center', result_solo: 'emblem', invite: 'plain',
      result_pair: 'stack', pair_waiting: 'avatars', result_team: 'banner',
      team_lobby: 'list', share: 'card', calculating: 'center',
      choice_style: 'text', choice_layout: 'list', question_progress: 'bar',
    },
  },
  Apocalypse: {
    colors: {
      primary: '#E8354F', on_primary: '#FFFDF6', surface: '#FFFDF6',
      on_surface: '#1C1A17', muted: '#6B655C', accent: '#7AC4D6',
      success: '#2A9D8F', danger: '#C0392B', overlay: 'rgba(28,26,23,.55)',
      background: '#EFE9DC', highlight: '#F5E14B',
    },
    font_display: 'Bangers', font_body: 'Bai Jamjuree', font_accent: 'Gloria Hallelujah',
    font_scale: 1.05,
    radius: 14, border_width: 2.5, shadow: 'hard', shadow_offset: 4,
    tilt: 'playful', texture: 'paper',
    screen_config: {
      cover: 'overlap', result_solo: 'overlap', invite: 'overlap',
      result_pair: 'versus', pair_waiting: 'cards', result_team: 'emblem',
      team_lobby: 'grid', share: 'poster', calculating: 'full-bleed',
      choice_style: 'text', choice_layout: 'list', question_progress: 'dots',
    },
  },
};

// ── Screen layout options ──────────────────────────────────────────────

type Block = [number, number, number, number, 'a' | 'b' | 'c', 'r' | 'c' | 'ring'];
interface LayoutOpt { value: string; title: string; desc: string; blocks: Block[] }

const SCREEN_LAYOUTS: Record<string, LayoutOpt[]> = {
  cover: [
    { value: 'hero-bottom', title: 'KV บน + เนื้อหาล่าง', desc: 'ภาพนำสายตา ข้อความอยู่ล่าง', blocks: [[8,6,84,52,'a','r'],[8,64,60,8,'b','r'],[8,76,84,14,'c','r']] },
    { value: 'center',      title: 'ข้อความกลางจอ',       desc: 'เน้นตัวหนังสือ ใช้พื้นหลังภาพ', blocks: [[16,32,68,9,'a','r'],[24,46,52,7,'b','r'],[20,62,60,14,'c','r']] },
    { value: 'split',       title: 'ภาพ 4:3 + เนื้อหา',    desc: 'ภาพไม่เต็มจอ อ่านง่ายสุด', blocks: [[8,8,84,34,'a','r'],[8,50,66,8,'b','r'],[8,76,84,14,'c','r']] },
    { value: 'overlap',     title: 'KV เต็มขอบ + การ์ดซ้อน', desc: 'การ์ดกินขอบภาพขึ้นมา — ลุคสติกเกอร์', blocks: [[0,0,100,52,'a','r'],[8,42,84,40,'c','r'],[14,62,62,6,'b','r']] },
  ],
  result_solo: [
    { value: 'card',       title: 'การ์ดผล + เนื้อหา',    desc: 'เหมือนการ์ดสะสม แชร์สวย', blocks: [[14,6,72,48,'a','r'],[14,60,54,8,'b','r'],[14,72,72,16,'c','r']] },
    { value: 'full-bleed', title: 'ภาพเต็มจอ + overlay', desc: 'ดราม่าสุด ตัวหนังสือทับภาพ', blocks: [[6,4,88,74,'a','r'],[12,58,50,7,'c','r'],[12,68,70,6,'c','r']] },
    { value: 'split',      title: 'ภาพเล็ก เน้นข้อความ', desc: 'อ่านง่าย เหมาะกับผลที่มีคำอธิบายยาว', blocks: [[8,14,34,56,'a','r'],[48,16,44,8,'b','r'],[48,40,38,6,'c','r']] },
    { value: 'emblem',     title: 'ตราวงกลม',             desc: 'ไม่ผูกกับการ์ด ใช้โลโก้/ตราได้', blocks: [[34,10,32,44,'a','ring'],[22,62,56,8,'b','r'],[16,76,68,12,'c','r']] },
    { value: 'overlap',    title: 'KV เต็มขอบ + การ์ดซ้อน', desc: 'โครงเดียวกับหน้าแรก ต่อเนื่องทั้งแอป', blocks: [[0,0,100,50,'a','r'],[8,40,84,44,'c','r'],[14,60,64,6,'b','r']] },
  ],
  result_pair: [
    { value: 'side',    title: 'การ์ดคู่ + กล่องคะแนน', desc: 'เห็นทั้งสองคนและคำอธิบาย', blocks: [[14,8,32,40,'a','r'],[54,8,32,40,'b','r'],[10,56,80,34,'c','r']] },
    { value: 'stack',   title: 'ตัวเลขใหญ่นำ',           desc: 'เน้นคะแนน แชร์แล้วอ่านออกทันที', blocks: [[24,10,52,24,'a','r'],[12,44,34,34,'c','r'],[54,44,34,34,'c','r']] },
    { value: 'versus',  title: 'ปะทะกัน VS',             desc: 'สนุก เหมาะกับแคมเปญแข่งกัน', blocks: [[14,16,34,50,'a','r'],[52,16,34,50,'b','r'],[38,34,24,24,'a','c']] },
  ],
  result_team: [
    { value: 'emblem', title: 'ตราของกลุ่ม',       desc: 'ให้ความรู้สึกเป็นของสะสม', blocks: [[34,8,32,42,'a','ring'],[22,58,56,9,'b','r'],[30,74,40,12,'c','r']] },
    { value: 'grid',   title: 'การ์ดสมาชิกทั้งทีม', desc: 'เห็นว่าใครอยู่ในทีม', blocks: [[10,10,24,30,'a','r'],[38,10,24,30,'b','r'],[66,10,24,30,'c','r'],[10,48,80,10,'b','r']] },
    { value: 'banner', title: 'แถบสีแบรนด์',        desc: 'สีแบรนด์เต็มพื้นที่ผล', blocks: [[8,10,84,46,'a','r'],[14,20,44,6,'c','r'],[14,34,34,12,'c','r']] },
  ],
  share: [
    { value: 'card',    title: 'การ์ด 1:1',  desc: 'ส่งในแชทได้พอดี', blocks: [[16,10,68,52,'a','r'],[16,68,68,18,'c','r']] },
    { value: 'poster',  title: 'โปสเตอร์ 9:16', desc: 'ลงสตอรี่ได้เลย', blocks: [[30,4,40,82,'a','r'],[36,62,28,6,'c','r']] },
    { value: 'compact', title: 'แถวเตี้ย',    desc: 'เห็นปุ่มส่งพร้อมกันในจอเดียว', blocks: [[8,26,26,34,'a','r'],[40,30,52,8,'b','r'],[40,44,40,6,'c','r']] },
  ],
  calculating: [
    { value: 'center',     title: 'วงแหวนหมุน',      desc: 'คลาสสิก อ่านง่าย ใช้ได้ทุกธีม', blocks: [[38,26,24,34,'a','ring'],[30,70,40,7,'b','r']] },
    { value: 'full-bleed', title: 'ภาพแบรนด์เต็มจอ', desc: 'ได้แบรนด์มากสุด ต้องมีไฟล์ภาพ', blocks: [[8,6,84,62,'a','r'],[24,78,52,8,'b','r']] },
    { value: 'minimal',    title: 'ข้อความเดี่ยว',    desc: 'รู้สึกเร็วที่สุด เหมาะกับเน็ตช้า', blocks: [[22,44,56,9,'a','r'],[34,60,32,5,'c','r']] },
  ],
  pair_waiting: [
    { value: 'cards',   title: 'การ์ดคู่ + ช่องว่าง', desc: 'เห็นชัดว่ายังขาดอีกคน', blocks: [[14,22,32,46,'a','r'],[54,22,32,46,'c','r']] },
    { value: 'avatars', title: 'อวาตาร์เชื่อมกัน',   desc: 'เน้นความเป็นคู่ ไม่ผูกกับการ์ด', blocks: [[16,30,26,34,'a','c'],[45,44,10,4,'b','r'],[58,30,26,34,'c','c']] },
    { value: 'brand',   title: 'ภาพแบรนด์เต็มพื้น', desc: 'ใช้ช่วงรอเป็นสื่อของแบรนด์', blocks: [[8,8,84,60,'a','r'],[26,78,48,7,'b','r']] },
  ],
};

const SCREEN_LABELS: Record<string, string> = {
  cover: 'Cover', result_solo: 'Result Solo', result_pair: 'Result Pair',
  result_team: 'Result Team', share: 'Share', calculating: 'Calculating', pair_waiting: 'Pair Waiting',
};

// ── Color tokens ───────────────────────────────────────────────────────

const COLOR_FIELDS: [keyof NonNullable<AppearanceConfig['colors']>, string, string][] = [
  ['primary',    'Primary',    'ปุ่มหลัก, CTA'],
  ['on_primary', 'On Primary', 'ตัวอักษรบนปุ่มหลัก'],
  ['surface',    'Surface',    'พื้นหลังการ์ด/กล่อง'],
  ['on_surface', 'On Surface', 'ตัวอักษรหลักบน surface'],
  ['muted',      'Muted',      'ตัวอักษรรอง, เส้นแบ่ง'],
  ['accent',     'Accent',     'สีเน้นจุดสนใจ, badge'],
  ['highlight',  'Highlight',  'สีเน้น (เหลือง/สว่าง)'],
  ['background', 'Background', 'พื้นหลังทั้งแอป'],
  ['overlay',    'Overlay',    'สีทับโปร่งใส (rgba)'],
  ['danger',     'Danger',     'สีข้อผิดพลาด'],
];

// ── Shared UI helpers ──────────────────────────────────────────────────

const LABEL: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#333' };
const HINT: React.CSSProperties  = { fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#aaa', marginTop: 3 };
const SEC: React.CSSProperties   = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: '#111', letterSpacing: '.06em',
  padding: '14px 20px 10px', borderTop: '1.5px solid #E5E5E3', background: '#F7F7F5',
};
const BODY: React.CSSProperties = { padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 };

function Swatch({ color, onChange }: { color: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <div style={{ width: 32, height: 32, borderRadius: 6, border: '1.5px solid #E5E5E3', background: color || '#eee', flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
        <input type="color" value={color?.startsWith('#') ? color : '#888888'} onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, width: '200%', height: '200%', opacity: 0, cursor: 'pointer', top: '-50%', left: '-50%' }} />
      </div>
      <input type="text" value={color || ''} onChange={e => onChange(e.target.value)} placeholder="#000000 or rgba(...)"
        style={{ flex: 1, padding: '6px 9px', border: '1.5px solid #E5E5E3', borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, outline: 'none', boxSizing: 'border-box' as const }} />
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '5px 11px', border: '1.5px solid', borderRadius: 6, cursor: 'pointer',
          borderColor: value === o.v ? '#111' : '#E5E5E3',
          background: value === o.v ? '#111' : '#fff',
          color: value === o.v ? '#fff' : '#555',
          fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: value === o.v ? 700 : 400,
        }}>{o.label}</button>
      ))}
    </div>
  );
}

/** Visual thumbnail for layout option */
function Thumb({ blocks, primary, accent }: { blocks: Block[]; primary: string; accent: string }) {
  const toneColor = (t: 'a' | 'b' | 'c') =>
    t === 'a' ? (primary || '#333') : t === 'b' ? (accent || '#aaa') : '#e0e0e0';
  return (
    <div style={{ width: '100%', aspectRatio: '9/16', border: '1.5px solid #E5E5E3', borderRadius: 6, background: '#F4F4F2', position: 'relative', overflow: 'hidden' }}>
      {blocks.map((b, i) => {
        const [l, t, w, h, tone, shape] = b;
        const base = { position: 'absolute' as const, left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, background: toneColor(tone) };
        if (shape === 'ring') return <div key={i} style={{ ...base, borderRadius: '50%', background: 'transparent', border: `2.5px solid ${toneColor(tone)}`, boxSizing: 'border-box' as const }} />;
        if (shape === 'c') return <div key={i} style={{ ...base, borderRadius: '50%' }} />;
        return <div key={i} style={{ ...base, borderRadius: 3 }} />;
      })}
    </div>
  );
}

export default function StyleSection({ appearance, onChange }: Props) {
  const [cssOpen, setCssOpen] = useState(false);

  const set = <K extends keyof AppearanceConfig>(k: K, v: AppearanceConfig[K]) =>
    onChange({ ...appearance, [k]: v });

  const colors = appearance.colors ?? {};
  const setColor = (k: keyof NonNullable<AppearanceConfig['colors']>, v: string) =>
    onChange({ ...appearance, colors: { ...colors, [k]: v } });

  const sc = appearance.screen_config ?? {};
  const setSc = (k: string, v: string) =>
    onChange({ ...appearance, screen_config: { ...sc, [k]: v } });

  const applyPreset = (name: keyof typeof PRESETS) =>
    onChange({ ...appearance, ...PRESETS[name] });

  const primaryColor = colors.primary || '#2A9D8F';
  const accentColor  = colors.accent  || '#E0A6B5';

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* ── Presets ── */}
      <div style={{ padding: '12px 20px', borderBottom: '1.5px solid #E5E5E3', display: 'flex', gap: 8, alignItems: 'center', background: '#FFFBF0' }}>
        <span style={{ ...LABEL, color: '#888', fontSize: 10 }}>PRESETS</span>
        {Object.keys(PRESETS).map(name => (
          <button key={name} onClick={() => applyPreset(name as keyof typeof PRESETS)} style={{
            padding: '6px 14px', border: '1.5px solid #D0CECC', borderRadius: 6, background: '#fff',
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#333',
          }}>{name}</button>
        ))}
        <span style={{ ...HINT, marginTop: 0 }}>ใช้ค่าตั้งต้นทั้งหมดของธีมนี้ทีเดียว</span>
      </div>

      {/* ── Color Palette ── */}
      <div style={SEC}>COLOR PALETTE</div>
      <div style={BODY}>
        {COLOR_FIELDS.map(([k, label, hint]) => (
          <div key={k}>
            <label style={LABEL}>{label}</label>
            <div style={HINT}>{hint}</div>
            <Swatch color={colors[k] || ''} onChange={v => setColor(k, v)} />
          </div>
        ))}
      </div>

      {/* ── Typography ── */}
      <div style={SEC}>TYPOGRAPHY</div>
      <div style={BODY}>
        <div>
          <label style={LABEL}>Display Font Family</label>
          <div style={HINT}>ใช้กับ heading · ใส่ชื่อ Google Font หรือ system font</div>
          <input type="text" value={appearance.font_display || ''} onChange={e => set('font_display', e.target.value)}
            placeholder="Noto Sans Thai" style={{ marginTop: 6, width: '100%', padding: '7px 10px', border: '1.5px solid #E5E5E3', borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, boxSizing: 'border-box' as const, outline: 'none' }} />
        </div>
        <div>
          <label style={LABEL}>Body Font Family</label>
          <div style={HINT}>ใช้กับ paragraph · default = Noto Sans Thai</div>
          <input type="text" value={appearance.font_body || ''} onChange={e => set('font_body', e.target.value)}
            placeholder="Noto Sans Thai" style={{ marginTop: 6, width: '100%', padding: '7px 10px', border: '1.5px solid #E5E5E3', borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, boxSizing: 'border-box' as const, outline: 'none' }} />
        </div>
        <div>
          <label style={LABEL}>Accent Font Family</label>
          <div style={HINT}>ใช้กับ score/badge/highlight — optional</div>
          <input type="text" value={appearance.font_accent || ''} onChange={e => set('font_accent', e.target.value)}
            placeholder="Gloria Hallelujah" style={{ marginTop: 6, width: '100%', padding: '7px 10px', border: '1.5px solid #E5E5E3', borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, boxSizing: 'border-box' as const, outline: 'none' }} />
        </div>
        <div>
          <label style={LABEL}>Display Font URL</label>
          <div style={HINT}>woff2 URL ถ้าใช้ font ที่ไม่ใช่ Google Fonts · เว้นว่างถ้า Google Fonts โหลดให้แล้ว</div>
          <input type="text" value={appearance.font_display_url || ''} onChange={e => set('font_display_url', e.target.value)}
            placeholder="https://..." style={{ marginTop: 6, width: '100%', padding: '7px 10px', border: '1.5px solid #E5E5E3', borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, boxSizing: 'border-box' as const, outline: 'none' }} />
        </div>
        <div>
          <label style={LABEL}>Body Font URL</label>
          <input type="text" value={appearance.font_body_url || ''} onChange={e => set('font_body_url', e.target.value)}
            placeholder="https://..." style={{ marginTop: 6, width: '100%', padding: '7px 10px', border: '1.5px solid #E5E5E3', borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, boxSizing: 'border-box' as const, outline: 'none' }} />
        </div>
        <div>
          <label style={LABEL}>Font Scale — {(appearance.font_scale ?? 1).toFixed(2)}×</label>
          <div style={HINT}>ขนาด font โดยรวม · 0.8 เล็ก, 1.0 ปกติ, 1.2 ใหญ่</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <input type="range" min={0.8} max={1.4} step={0.05} value={appearance.font_scale ?? 1}
              onChange={e => set('font_scale', parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#111' }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, border: '1px solid #E5E5E3', borderRadius: 5, padding: '4px 8px', background: '#F7F7F5' }}>{(appearance.font_scale ?? 1).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── Shape & Feel ── */}
      <div style={SEC}>SHAPE & FEEL</div>
      <div style={BODY}>
        <div>
          <label style={LABEL}>Card Radius — {appearance.radius ?? 16}px</label>
          <div style={HINT}>ความโค้งมนของการ์ดและกล่อง</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <input type="range" min={0} max={32} step={1} value={appearance.radius ?? 16}
              onChange={e => set('radius', parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#111' }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, border: '1px solid #E5E5E3', borderRadius: 5, padding: '4px 8px', background: '#F7F7F5' }}>{appearance.radius ?? 16}px</span>
          </div>
        </div>
        <div>
          <label style={LABEL}>Button Radius</label>
          <div style={HINT}>999 = pill shape, 8 = rounded, 0 = square</div>
          <Seg value={String(appearance.radius ?? 999)} options={[{ v: '999', label: 'Pill' }, { v: '12', label: 'Rounded' }, { v: '6', label: 'Square' }]}
            onChange={v => set('radius', parseInt(v))} />
        </div>
        <div>
          <label style={LABEL}>Border Width — {appearance.border_width ?? 1}px</label>
          <div style={HINT}>เส้นขอบการ์ดและปุ่ม</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <input type="range" min={0} max={4} step={0.5} value={appearance.border_width ?? 1}
              onChange={e => set('border_width', parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#111' }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, border: '1px solid #E5E5E3', borderRadius: 5, padding: '4px 8px', background: '#F7F7F5' }}>{appearance.border_width ?? 1}px</span>
          </div>
        </div>
        <div>
          <label style={LABEL}>Shadow Style</label>
          <div style={HINT}>soft = เงาปกติ, hard = offset solid shadow, none = ไม่มีเงา</div>
          <Seg value={appearance.shadow ?? 'soft'} options={[{ v: 'none', label: 'None' }, { v: 'soft', label: 'Soft' }, { v: 'hard', label: 'Hard' }]}
            onChange={v => set('shadow', v as AppearanceConfig['shadow'])} />
        </div>
        {appearance.shadow === 'hard' && (
          <div>
            <label style={LABEL}>Shadow Offset — {appearance.shadow_offset ?? 4}px</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <input type="range" min={1} max={12} step={1} value={appearance.shadow_offset ?? 4}
                onChange={e => set('shadow_offset', parseInt(e.target.value))}
                style={{ flex: 1, accentColor: '#111' }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, border: '1px solid #E5E5E3', borderRadius: 5, padding: '4px 8px', background: '#F7F7F5' }}>{appearance.shadow_offset ?? 4}px</span>
            </div>
          </div>
        )}
        <div>
          <label style={LABEL}>Card Tilt</label>
          <div style={HINT}>ความเอียงของการ์ด — playful = เหมาะกับธีม fun</div>
          <Seg value={appearance.tilt ?? 'off'} options={[{ v: 'off', label: 'Off' }, { v: 'subtle', label: 'Subtle' }, { v: 'playful', label: 'Playful' }]}
            onChange={v => set('tilt', v as AppearanceConfig['tilt'])} />
        </div>
        <div>
          <label style={LABEL}>Texture</label>
          <div style={HINT}>texture กระดาษบาง ๆ บนพื้นหลัง</div>
          <Seg value={appearance.texture === 'paper' ? 'on' : 'off'} options={[{ v: 'off', label: 'Off' }, { v: 'on', label: 'On (paper)' }]}
            onChange={v => set('texture', v === 'on' ? 'paper' : 'none')} />
        </div>
      </div>

      {/* ── Logo ── */}
      <div style={SEC}>LOGO</div>
      <div style={BODY}>
        <div>
          <label style={LABEL}>Logo Image</label>
          <div style={HINT}>SVG หรือ PNG โปร่งใส · แนะนำความสูง 48-64px · แสดงมุมบนจอ</div>
          <div style={{ marginTop: 8 }}>
            <ImageUploader value={appearance.logo_url ?? null} onChange={url => set('logo_url', url ?? undefined)} aspectRatio="4:1" hint="แนะนำ SVG หรือ PNG โปร่งใส" />
          </div>
        </div>
        <div>
          <label style={LABEL}>Logo Position</label>
          <Seg value={appearance.logo_position ?? 'top-left'} options={[{ v: 'top-left', label: 'Top Left' }, { v: 'top-center', label: 'Top Center' }, { v: 'hidden', label: 'Hidden' }]}
            onChange={v => set('logo_position', v as AppearanceConfig['logo_position'])} />
        </div>
        <div>
          <label style={LABEL}>Logo Height — {appearance.logo_height ?? 28}px</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <input type="range" min={16} max={56} step={2} value={appearance.logo_height ?? 28}
              onChange={e => set('logo_height', parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#111' }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, border: '1px solid #E5E5E3', borderRadius: 5, padding: '4px 8px', background: '#F7F7F5' }}>{appearance.logo_height ?? 28}px</span>
          </div>
        </div>
      </div>

      {/* ── Per-Screen Layouts ── */}
      <div style={SEC}>SCREEN LAYOUTS</div>
      {Object.entries(SCREEN_LAYOUTS).map(([screenKey, opts]) => (
        <div key={screenKey} style={{ padding: '12px 20px 16px', borderTop: '1px solid #F0EEEC' }}>
          <div style={{ ...LABEL, marginBottom: 10 }}>{SCREEN_LABELS[screenKey] || screenKey}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {opts.map(opt => {
              const selected = (sc[screenKey] as string) === opt.value;
              return (
                <button key={opt.value} onClick={() => setSc(screenKey, opt.value)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 5,
                  border: `1.5px solid ${selected ? '#111' : '#E5E5E3'}`,
                  borderRadius: 8, padding: 8, background: selected ? '#FFFDF8' : '#fff',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <Thumb blocks={opt.blocks} primary={primaryColor} accent={accentColor} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: selected ? 700 : 500, color: selected ? '#111' : '#555', lineHeight: 1.3 }}>{opt.title}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#aaa', lineHeight: 1.3 }}>{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Custom CSS ── */}
      <div
        onClick={() => setCssOpen(v => !v)}
        style={{ ...SEC, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
      >
        <span>CUSTOM CSS</span>
        <span style={{ fontSize: 10, color: '#888' }}>{cssOpen ? '▲' : '▼'}</span>
      </div>
      {cssOpen && (
        <div style={{ padding: '12px 20px 16px' }}>
          <div style={HINT}>ใช้ #app-root เป็น selector หลัก · CSS ที่ผิดกฎจะบล็อกการ publish</div>
          <textarea
            value={appearance.custom_css || ''}
            onChange={e => set('custom_css', e.target.value)}
            rows={10}
            placeholder={`/* example */\n#app-root .result-card {\n  background: var(--t-accent);\n}`}
            style={{ marginTop: 8, width: '100%', boxSizing: 'border-box' as const, border: '1.5px solid #E5E5E3', borderRadius: 6, padding: '10px 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, lineHeight: 1.6, resize: 'vertical', outline: 'none', background: '#16181A', color: '#C9D1D9' }}
          />
          <div style={{ ...HINT, marginTop: 6 }}>Max 4 KB · ไม่รองรับ @import</div>
        </div>
      )}

      {/* ── Notes ── */}
      <div style={SEC}>NOTES (internal)</div>
      <div style={{ padding: '12px 20px 40px' }}>
        <div style={HINT}>บันทึกภายใน ไม่ส่งไปที่ LIFF · ใส่ feedback ของ designer หรือ brief</div>
        <textarea
          value={appearance.notes || ''}
          onChange={e => set('notes', e.target.value)}
          rows={5}
          placeholder="หมายเหตุสำหรับทีม..."
          style={{ marginTop: 8, width: '100%', boxSizing: 'border-box' as const, border: '1.5px solid #E5E5E3', borderRadius: 6, padding: '10px 12px', fontFamily: "'Bai Jamjuree',sans-serif", fontSize: 13, lineHeight: 1.65, resize: 'vertical', outline: 'none' }}
        />
      </div>
    </div>
  );
}
