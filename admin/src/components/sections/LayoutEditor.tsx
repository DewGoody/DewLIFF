// ── LayoutEditor.tsx ──────────────────────────────────────────────────────
// Phone preview component — renders LIFF screen blocks inside a phone frame
// Phase 1: full block renderer + drag-reorder + chip overlay
// Phase 2: per-block pattern state (solo/pair/group/chip tiles)

import React, { useState } from 'react';

// ── Shared types ───────────────────────────────────────────────────────────

export interface BlockItem {
  id: string;
  uid: string;
  show: boolean;
  geo: Record<string, string | number>;
}

/** Resolved design tokens computed by LiffSection from appearance + brand */
export interface TokTokens {
  primary: string;
  onPrimary: string;
  bg: string;
  card: string;
  ink: string;
  ink2: string;
  ink3: string;
  hl: string;
  accent: string;
  soft: string;
  line: string;
  danger: string;
  shadow: string;
  offset: number;
  fontBody: string;
  fontDisplay: string;
  fontAccent?: string;
  scale: number;
  cardR: number;
  radius: number;
  borderW: number;
  tilt: string;
  texture: string;
  artShape?: string;
  artFrame?: string;
  artHero?: string;
}

interface Row {
  text: string;
  style: string;
  items?: Row[];
}

/** Pattern state: outer key = uid, inner key = family (solo|pair|group|chip), value = pattern name */
export type PatState = Record<string, Record<string, string>>;

export interface LayoutEditorProps {
  tok: TokTokens;
  copy: Record<string, string>;
  blockImages: Record<string, string>;
  screen: string;
  oaTitle: string;
  layout: BlockItem[];
  sel: string | null;
  drag: { uid?: string; newSlot?: string } | null;
  over: string | null;
  /** Per-block pattern overrides, keyed by uid */
  pat?: PatState;
  onSelect: (uid: string) => void;
  onDragStart: (uid: string, e: React.DragEvent) => void;
  onDragOver: (uid: string) => void;
  onDrop: (e: React.DragEvent, toUid: string | null) => void;
  onDragEnd: () => void;
  onToggleShow: (uid: string) => void;
  onRemove: (uid: string) => void;
  onMoveUp: (uid: string) => void;
  onMoveDown: (uid: string) => void;
  /** Per-block float position: key = uid, value = {x, y, w} */
  pos?: Record<string, { x: number; y: number; w: number }>;
  /** Snap guides enabled */
  snap?: boolean;
  /** Called when user drags a float block to new position */
  onMoveFloat?: (uid: string, x: number, y: number) => void;
}

/** Default pattern per family */
export const DEFAULT_PAT: Record<string, string> = {
  solo:'portrait', pair:'tilt', group:'fan', chip:'pill',
};

// ── Constants (mirrors LiffSection — update both when LIFF slots change) ───

const SLOTS: Record<string, { label: string; kind: string; bind: string; geo?: string[]; copy?: [string, string, string?][]; img?: string }> = {
  loadArt:     { label:'ภาพ / สปินเนอร์',           kind:'image',  bind:"images['loading']",                geo:['h','style'], img:'loading' },
  loadCopy:    { label:'หัวเรื่อง + ข้อความรอง',     kind:'text',   bind:'copy.loading_*',                   geo:['align'], copy:[['loading_title','หัวเรื่อง'],['loading_body','ข้อความรอง']] },
  loadBar:     { label:'แถบโหลด',                   kind:'meta',   bind:'liff.init progress',               geo:['style'] },
  kv:          { label:'KV / ภาพหัวจอ',             kind:'image',  bind:"images['kv-intro']",               geo:['h','fit'], img:'kv-intro' },
  infoCard:    { label:'การ์ดข้อมูลควิซ',            kind:'card',   bind:'questions.length · axes.length',  geo:['pad'], copy:[['intro_quiz_label','label เล็ก'],['intro_body','หัวข้อหลัก','area'],['intro_time','ข้อความเวลา']] },
  cta:         { label:'ปุ่มหลัก',                  kind:'action', bind:'onStart() → Question',             geo:['color','sticky'], copy:[['intro_cta','ข้อความปุ่ม']] },
  note:        { label:'โน้ตใต้ปุ่ม',               kind:'text',   bind:'copy.intro_note',                  geo:[], copy:[['intro_note','ข้อความ']] },
  invitedHero: { label:'Hero หน้าเชิญ',             kind:'image',  bind:"images['invited_hero']",           geo:['h','fit'], img:'invited_hero' },
  inviterCard: { label:'การ์ดผู้เชิญ',              kind:'card',   bind:'inviterName / inviterArchLabel',   geo:['pad','overlap','badge'], copy:[['invited_duo_badge','badge'],['invited_body','ข้อความเชิญ','area']] },
  progress:    { label:'ตัวนับ + progress bar',     kind:'meta',   bind:'questionIndex / questions.length', geo:['style'], copy:[['question_progress','ตัวนับ']] },
  qCard:       { label:'การ์ดคำถาม',               kind:'card',   bind:'questions[i].text',               geo:['pad','size'] },
  options:     { label:'ตัวเลือกคำตอบ',             kind:'list',   bind:'questions[i].options → onAnswer()',geo:['optH','keyShape'] },
  backRow:     { label:'ปุ่มย้อนกลับ + จุด',       kind:'meta',   bind:'onBack()',                         geo:[], copy:[['question_back','ข้อความปุ่ม']] },
  matArt:      { label:'ภาพระหว่างจับคู่',          kind:'image',  bind:'axes[me] / axes[buddy]',           geo:['h','style'] },
  survivorCard:{ label:'บัตรผู้รอด',                kind:'card',   bind:'summary.myArchetype*',             geo:['pad','artW','dir'], copy:[['summary_card_eyebrow','eyebrow'],['summary_card_valid','badge มุมขวา']] },
  retake:      { label:'ปุ่มตอบใหม่',              kind:'action', bind:'onRetake()',                        geo:[], copy:[['summary_retake_btn','ข้อความ']] },
  actionRow:   { label:'ปุ่มแชร์ + เชิญเพื่อน',    kind:'action', bind:'onSoloShare() · invite sheet',     geo:['dir'], copy:[['share_btn','ปุ่มแชร์'],['invite_btn','ปุ่มเชิญ']] },
  teamSection: { label:'section ทีมของฉัน',         kind:'list',   bind:'GET /api/group/my-groups',         geo:['style'], copy:[['summary_teams_header','หัวข้อ'],['team_view_btn','ปุ่มดูทีม']] },
  symbolsRow:  { label:'ปุ่มสะสมสัญลักษณ์',         kind:'action', bind:'onGoSymbols() → Symbols',          geo:[], copy:[['symbols_title','หัวข้อ'],['symbols_sub','คำอธิบาย']] },
  pairLog:     { label:'รายการคู่ของฉัน',           kind:'list',   bind:'summary.pairs[]',                  geo:['style'], copy:[['pair_log_label','หัวข้อ']] },
  hero2:       { label:'Hero การ์ด 2 ใบ',           kind:'image',  bind:'axes[me].image + axes[buddy].image',geo:['h','tilt'] },
  resultCard:  { label:'การ์ดผลคู่',               kind:'card',   bind:'pairResult.title / body',          geo:['pad','overlap'], copy:[['pair_result_badge','badge']] },
  axisChips:   { label:'ชิปสายของ 2 คน',           kind:'meta',   bind:'axisMe / axisBuddy',               geo:['dir'] },
  shareRow:    { label:'ปุ่มแชร์ (LINE / copy)',    kind:'action', bind:'shareTargetPicker() · /api/og',    geo:['dir'], copy:[['pair_share_cta','ปุ่มแชร์ไลน์'],['copy_link_btn','ปุ่มคัดลอกลิงก์']] },
  topNav:      { label:'top nav (✕ + ชื่อหน้า)',   kind:'meta',   bind:'onBack()',                          geo:[], copy:[['group_page_title','ชื่อหน้า']] },
  grpHero:     { label:'Hero ผลกลุ่ม',             kind:'image',  bind:'group archetype / การ์ดสมาชิก',    geo:['h','reveal'], img:'group_hero' },
  grpCard:     { label:'การ์ดผลกลุ่ม + กล่องล็อค', kind:'card',   bind:'group.result / archetype',         geo:['pad','locked'], copy:[['group_title','kicker'],['F10_locked_title','หัวข้อกล่องล็อค'],['F10_locked_body','คำอธิบายกล่องล็อค','area'],['group_remaining_label','ข้อความยังไม่ครบ']] },
  memberList:  { label:'ลิสต์สมาชิก',              kind:'list',   bind:'group.members[] → onViewPair()',   geo:['style'], copy:[['group_members','หัวข้อ']] },
  axisCounts:  { label:'ชิปสัดส่วนสาย',            kind:'meta',   bind:'นับจาก members[].topAxis',          geo:[] },
  inviteMore:  { label:'ปุ่มชวนเพิ่มสมาชิก',        kind:'action', bind:'F-10 shareTargetPicker()',          geo:[], copy:[['group_invite_cta','ข้อความปุ่ม']] },
  symGrid:     { label:'กริดสัญลักษณ์',             kind:'list',   bind:'GET /api/symbols',                 geo:['cols'] },
  errArt:      { label:'ภาพประกอบ error',           kind:'image',  bind:'axes[last].image',                 geo:['h'] },
  errCopy:     { label:'หัวเรื่อง + คำอธิบาย',     kind:'text',   bind:'copy.error_*',                     geo:['align'], copy:[['error_title','หัวเรื่อง'],['error_body','คำอธิบาย','area']] },
  errRetry:    { label:'ปุ่มลองใหม่',              kind:'action', bind:'onRetry()',                         geo:[], copy:[['error_retry','ข้อความปุ่ม']] },
  xImage:      { label:'ภาพตกแต่ง',               kind:'extra',  bind:'',                                  geo:['h','fit'], img:'x_image' },
  xText:       { label:'ข้อความอิสระ',             kind:'extra',  bind:'',                                  geo:['size','align'], copy:[['x_text','ข้อความ','area']] },
  xSpacer:     { label:'ช่องว่าง',                 kind:'extra',  bind:'',                                  geo:['h'] },
  xDivider:    { label:'เส้นคั่น',                 kind:'extra',  bind:'',                                  geo:[] },
  xBox:        { label:'กล่องพื้นหลัง',            kind:'extra',  bind:'',                                  geo:['h','xbgColor','xRadius'] },
  xCard:       { label:'การ์ดผลลัพธ์ (DATA CARD)', kind:'extra',  bind:'',                                  geo:['pad'] },
  xRow:        { label:'แถวรายการ (LIST ITEM)',     kind:'extra',  bind:'',                                  geo:['style'] },
  xChip:       { label:'chip / badge',              kind:'extra',  bind:'',                                  geo:['align'] },
};

const KIND: Record<string, { c: string; label: string; icon: string }> = {
  image:  { c:'#B4552C', label:'ภาพ',         icon:'▣' },
  card:   { c:'#1C1A17', label:'การ์ด',        icon:'▤' },
  action: { c:'#E8354F', label:'ปุ่ม',         icon:'⬤' },
  list:   { c:'#1F7A6F', label:'ลิสต์',        icon:'☰' },
  meta:   { c:'#6F757A', label:'ข้อมูลประกอบ', icon:'—' },
  text:   { c:'#5F6469', label:'ข้อความ',      icon:'T' },
  extra:  { c:'#B07B12', label:'ตกแต่ง',       icon:'✦' },
};

const ART_SHAPES: Record<string, { r: number; radius: number }> = {
  card:   { r:4/3,  radius:8 },
  circle: { r:1,    radius:999 },
  square: { r:1,    radius:10 },
  wide:   { r:9/16, radius:10 },
  none:   { r:1,    radius:8 },
};

const DEFAULT_GEO: Record<string, string | number> = {
  h:200, pad:16, fit:'cover', dir:'row', style:'default', cols:'3', artW:92,
  tilt:8, overlap:24, sticky:'off', color:'highlight', keyShape:'circle', size:14, optH:56,
  reveal:'members', locked:'dark', badge:'show', align:'center',
  xbgColor:'highlight', xRadius:8,
};

const DEFAULT_COPY: Record<string, string> = {
  intro_quiz_label:'DUO QUIZ · 6 ข้อ',
  intro_body:'คุณกับเพื่อนจะรอดกี่วันถ้าโลกแตกพรุ่งนี้?',
  intro_time:'1 นาที', intro_cta:'เริ่มตอบ', intro_note:'ตอบ 6 ข้อ ไม่ถึงนาที',
  question_progress:'ข้อ 3 / 6', question_back:'← ย้อนกลับ',
  loading_title:'LOADING', loading_body:'กำลังโหลด...',
  matching_title:'MATCHING...', matching_sub:'กำลังคำนวณผลคู่...',
  invited_duo_badge:'คำเชิญ!', invited_body:'ชวนคุณมาดูว่าเราสองคนจะรอดกี่วัน',
  invite_cta:'ตอบให้มีน',
  summary_card_eyebrow:'SURVIVOR CARD · NO.03', summary_card_valid:'VALID',
  summary_retake_btn:'↺ ตอบแบบทดสอบใหม่', share_btn:'↗ แชร์ผล', invite_btn:'เชิญเพื่อน ▾',
  summary_teams_header:'ทีมของฉัน', team_view_btn:'ดูทีม',
  symbols_title:'สะสมสัญลักษณ์', symbols_sub:'แชร์ผลกลุ่มเพื่อปลดล็อกสัญลักษณ์',
  pair_log_label:'คู่หูของฉัน', pair_result_badge:'คู่นี้รอดได้',
  pair_share_cta:'แชร์ผลไปไลน์', copy_link_btn:'คัดลอกลิงก์เชิญ',
  group_page_title:'ผลกลุ่ม', group_title:'ผลกลุ่ม',
  F10_locked_title:'ผลของทีมนี้ยังไม่เปิด',
  F10_locked_body:'ครบ 5 คนแล้วเปิดพร้อมกันทุกคน',
  group_remaining_label:'อีก 2 คน ผลทีมก็เปิด',
  group_members:'สมาชิก', group_invite_cta:'ชวนเพื่อนเพิ่ม',
  error_title:'เกิดข้อผิดพลาด', error_body:'ลองใหม่อีกครั้ง หรือเข้ามาจากลิงก์เดิม', error_retry:'ลองอีกครั้ง',
  x_text:'ข้อความตกแต่ง',
};

// ── UI style constants ─────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };
const BODY_F: React.CSSProperties = { fontFamily: "'Noto Sans Thai','Bai Jamjuree',sans-serif" };

// ── CSS string → React.CSSProperties ──────────────────────────────────────

function css2obj(css: string): React.CSSProperties {
  const result: Record<string, string> = {};
  css.split(';').forEach(decl => {
    const ci = decl.indexOf(':');
    if (ci < 0) return;
    const prop = decl.slice(0, ci).trim();
    const val  = decl.slice(ci + 1).trim();
    if (!prop || !val) return;
    result[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = val;
  });
  return result as React.CSSProperties;
}

// ── RenderRows — recursive row tree renderer ───────────────────────────────

function RenderRows({ rows }: { rows: Row[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <span key={i} style={css2obj(r.style)}>
          {r.text}
          {r.items && <RenderRows rows={r.items} />}
        </span>
      ))}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LayoutEditor({
  tok,
  copy,
  blockImages,
  screen,
  oaTitle,
  layout,
  sel,
  drag,
  over,
  pat,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleShow,
  onRemove,
  onMoveUp,
  onMoveDown,
  pos,
  snap,
  onMoveFloat,
}: LayoutEditorProps) {

  const { ink, ink2, ink3, card, bg, hl, soft, primary, onPrimary, line,
          shadow, offset, fontBody, fontDisplay, scale, cardR, radius, borderW,
          tilt, texture, artShape, artFrame, artHero } = tok;

  // ── Float drag state ──────────────────────────────────────────────────────
  const [floatDrag, setFloatDrag] = useState<{ uid: string; startX: number; startY: number; startPx: number; startPy: number } | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }[]>([]);

  // ── Phone body size constants ─────────────────────────────────────────────
  const PHONE_W = 394;
  const SNAP_POSITIONS_X = [18, Math.floor(PHONE_W / 2), PHONE_W - 18];
  const SNAP_POSITIONS_Y = [20, 380];
  const SNAP_THRESHOLD = 14;

  const snapVal = (v: number, positions: number[], threshold: number): { v: number; snapped: boolean } => {
    for (const p of positions) {
      if (Math.abs(v - p) <= threshold) return { v: p, snapped: true };
    }
    return { v, snapped: false };
  };

  const onFloatPointerDown = (uid: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const p = pos?.[uid] ?? { x: 20, y: 120, w: 240 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFloatDrag({ uid, startX: e.clientX, startY: e.clientY, startPx: p.x, startPy: p.y });
  };

  const onFloatPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!floatDrag) return;
    const { uid, startX, startY, startPx, startPy } = floatDrag;
    const p = pos?.[uid] ?? { x: 20, y: 120, w: 240 };
    let nx = startPx + (e.clientX - startX);
    let ny = startPy + (e.clientY - startY);
    const newGuides: { x?: number; y?: number }[] = [];
    if (snap) {
      const sx = snapVal(nx, SNAP_POSITIONS_X, SNAP_THRESHOLD);
      const sy = snapVal(ny, SNAP_POSITIONS_Y, SNAP_THRESHOLD);
      if (sx.snapped) { nx = sx.v; newGuides.push({ x: sx.v }); }
      if (sy.snapped) { ny = sy.v; newGuides.push({ y: sy.v }); }
    }
    nx = Math.max(0, Math.min(PHONE_W - p.w, nx));
    ny = Math.max(0, ny);
    setGuides(newGuides);
    onMoveFloat?.(uid, nx, ny);
  };

  const onFloatPointerUp = () => {
    setFloatDrag(null);
    setGuides([]);
  };

  /** Resolve per-block pattern with fallback to DEFAULT_PAT */
  const patOf = (uid: string, fam: string): string =>
    pat?.[uid]?.[fam] ?? DEFAULT_PAT[fam];

  // ── Derived computed tokens (same as tokC in LiffSection) ─────────────
  const sh = shadow === 'none' ? 'none'
    : shadow === 'soft' ? `0 ${(offset / 2 + 2)}px ${(offset * 2 + 8)}px rgba(28,26,23,.18)`
    : `${offset}px ${offset + 1}px 0 ${ink}`;
  const sh2 = shadow === 'none' ? 'none'
    : shadow === 'soft' ? '0 3px 8px rgba(28,26,23,.16)'
    : `2px 3px 0 ${ink}`;
  const tiltDeg = tilt === 'off' ? 0 : tilt === 'subtle' ? 0.6 : 1.4;
  const bd  = `${borderW}px solid ${ink}`;
  const bd2 = `2px solid ${ink}`;
  const px  = (n: number) => `${Math.round(n * scale)}px`;
  const fb  = `'${fontBody}','Noto Sans Thai',sans-serif`;
  const fd  = `'${fontDisplay}','Noto Sans Thai',sans-serif`;

  const artStyleFn = (w: number, artBg: string, extra = ''): string => {
    const A = ART_SHAPES[artShape || 'card'] || ART_SHAPES.card;
    if (artShape === 'none') return 'display:none';
    const frame = artFrame === 'flat' ? ''
      : artFrame === 'soft' ? 'box-shadow:0 4px 10px rgba(28,26,23,.2);'
      : `border:2px solid ${ink};`;
    return `display:block;flex:none;width:${w}px;height:${Math.round(w * A.r)}px;border-radius:${Math.min(A.radius, w)}px;background:${artBg};${frame}${extra}`;
  };

  const geoVal = (b: BlockItem, k: string): string | number =>
    b.geo[k] !== undefined ? b.geo[k] : DEFAULT_GEO[k];

  const cpVal = (k: string): string =>
    copy[k] !== undefined ? copy[k] : (DEFAULT_COPY[k] || '');

  // ── Block row renderer — mirrors renderBlockRows in LiffSection ────────
  const renderRows = (b: BlockItem): Row[] => {
    const g  = (k: string) => geoVal(b, k);
    const IM = blockImages;
    const txt = (t: string, st: string): Row => ({ text: t, style: st });

    const bgOf = (key: string, h: number | string, label: string): Row => ({
      text: IM[key] ? '' : label,
      style: `display:flex;align-items:center;justify-content:center;height:${h}px;font:500 10px 'JetBrains Mono',monospace;color:${ink3};background:linear-gradient(180deg,#FCEFE0,${bg})` +
        (IM[key] ? `;background-image:url(${IM[key]});background-size:${g('fit') === 'contain' ? 'contain' : g('fit') === 'stretch' ? '100% 100%' : 'cover'};background-position:center;background-repeat:no-repeat` : ''),
    });

    const cardWrap = (inner: (Row | null)[], pad: number): Row[] => [{
      text: '',
      style: `display:flex;flex-direction:column;gap:6px;background:${card};border:${bd};border-radius:${cardR}px;padding:${pad}px;box-shadow:${sh}` +
        (tiltDeg ? `;transform:rotate(-${tiltDeg}deg)` : ''),
      items: inner.filter(Boolean) as Row[],
    }];

    const btn = (t: string, bgC: string, fgC: string): Row =>
      txt(t, `display:block;text-align:center;padding:14px 18px;background:${bgC};color:${fgC};border:${bd};border-radius:${radius}px;box-shadow:${sh};font:700 ${px(16)} ${fb}`);

    switch (b.id) {
      // ── Images ─────────────────────────────────────────────────────────
      case 'kv':          return [bgOf('kv-intro',   g('h'), 'KV IMAGE')];
      case 'invitedHero': return [bgOf('invited_hero', g('h'), 'INVITED HERO')];

      case 'grpHero': {
        if (g('reveal') === 'result') return [bgOf('group_hero', g('h'), 'GROUP RESULT ART')];
        const grpPat = patOf(b.uid, 'group');
        const n = 4;
        const mid = (n - 1) / 2;
        const heroBg = `linear-gradient(#FCEFE0,${bg})`;
        if (grpPat === 'grid') {
          return [{ text: '', style: `display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-content:center;height:${g('h')}px;padding:0 4px;background:${heroBg}`,
            items: [0,1,2,3].map(i => txt('', `display:block;width:100%;height:74px;border:${bd2};border-radius:8px;background:${i % 2 ? soft : hl}`)) }];
        }
        if (grpPat === 'stack') {
          return [{ text: '', style: `display:flex;align-items:flex-end;justify-content:center;height:${g('h')}px;background:${heroBg}`,
            items: [0,1,2,3].map(i => txt('', `display:block;flex:none;width:70px;height:88px;border:${bd2};border-radius:7px;background:${i % 2 ? soft : hl};margin-left:${i ? -40 : 0}px;box-shadow:${sh2}`)) }];
        }
        // fan (default)
        return [{ text: '', style: `display:flex;align-items:flex-end;justify-content:center;height:${g('h')}px;background:${heroBg}`,
          items: [0,1,2,3].map(i => txt('', `display:block;flex:none;width:64px;height:88px;border:${bd2};border-radius:7px;background:${i % 2 ? soft : hl};transform:rotate(${Math.round((i - mid) * 8)}deg);margin-left:${i ? -14 : 0}px`)) }];
      }

      case 'loadArt': return [{
        text: IM['loading'] ? '' : 'LOADING ART',
        style: `display:flex;align-items:center;justify-content:center;align-self:center;width:${Math.min(Number(g('h')),150)}px;height:${Math.min(Number(g('h')),150)}px;border:1.5px dashed rgba(28,26,23,.2);border-radius:12px;font:500 10px 'JetBrains Mono',monospace;color:${ink3}` +
          (IM['loading'] ? `;background-image:url(${IM['loading']});background-size:contain;background-position:center;background-repeat:no-repeat` : ''),
      }];

      case 'matArt': {
        const pairPat = patOf(b.uid, 'pair');
        let matItems: Row[];
        if (pairPat === 'side') {
          matItems = [
            txt('', artStyleFn(104, soft, '')),
            txt('', artStyleFn(104, hl, '')),
          ];
          return [{ text: '', style: `display:flex;align-items:center;justify-content:center;gap:12px;height:${g('h')}px`, items: matItems }];
        }
        if (pairPat === 'overlap') {
          matItems = [
            txt('', artStyleFn(104, soft, 'margin-right:-44px;')),
            txt('', artStyleFn(104, hl, '')),
          ];
          return [{ text: '', style: `display:flex;align-items:center;justify-content:center;height:${g('h')}px`, items: matItems }];
        }
        // tilt (default)
        matItems = [
          txt('', artStyleFn(104, soft, 'transform:rotate(-7deg);margin-right:-22px;')),
          txt('', artStyleFn(104, hl,   'transform:rotate(7deg);margin-left:-22px;')),
        ];
        return [{ text: '', style: `display:flex;align-items:center;justify-content:center;height:${g('h')}px`, items: matItems }];
      }

      case 'errArt': return [txt('', artStyleFn(96, soft, 'align-self:center;transform:rotate(-4deg);'))];

      // ── Loading / Matching ─────────────────────────────────────────────
      case 'loadCopy': return [
        txt(cpVal(screen === 'Matching' ? 'matching_title' : 'loading_title'), `display:block;text-align:${g('align')};font-family:${fd};font-size:${px(26)};letter-spacing:.06em;color:${ink}`),
        txt(cpVal(screen === 'Matching' ? 'matching_sub' : 'loading_body'), `display:block;text-align:${g('align')};font:500 ${px(13)} ${fb};color:${ink2}`),
      ];

      case 'loadBar': return [{ text: '', style: `display:block;align-self:center;width:190px;height:12px;border:${bd2};border-radius:8px;overflow:hidden;background:${card}`,
        items: [txt('', `display:block;height:100%;width:${g('style') === 'compact' ? '45%' : '82%'};background:${g('style') === 'bar' ? primary : `repeating-linear-gradient(115deg,${primary} 0 10px,${hl} 10px 18px)`}`)] }];

      // ── Intro ──────────────────────────────────────────────────────────
      case 'infoCard': return cardWrap([
        txt(cpVal('intro_quiz_label'), `display:block;font:700 ${px(11)} ${fb};letter-spacing:.1em;color:${primary}`),
        txt(cpVal('intro_body'), `display:block;font:700 ${px(19)}/1.35 ${fb};color:${ink}`),
        txt(`6 ข้อ · ${cpVal('intro_time')} · 5 สาย`, `display:block;font:600 ${px(11)} ${fb};color:${ink3}`),
      ], Number(g('pad')));

      case 'cta': return [btn(cpVal(screen === 'Invited' ? 'invite_cta' : 'intro_cta'), g('color') === 'primary' ? primary : hl, g('color') === 'primary' ? onPrimary : ink)];
      case 'note': return [txt(cpVal('intro_note'), `display:block;text-align:center;font:400 ${px(11)} ${fb};color:${ink3}`)];

      // ── Invited ────────────────────────────────────────────────────────
      case 'inviterCard': return cardWrap([
        (artShape === 'none' || g('badge') === 'hide') ? null : txt(cpVal('invited_duo_badge'), `align-self:flex-start;background:${hl};border:${bd2};padding:2px 9px;font-family:${fd};font-size:${px(14)}`),
        { text: '', style: 'display:flex;align-items:center;gap:10px', items: [
          txt('', artStyleFn(40, soft)),
          txt('มีน · สายวางแผน', `font:700 ${px(15)} ${fb};color:${ink}`),
        ]},
        txt(cpVal('invited_body'), `display:block;font:500 ${px(13.5)}/1.7 ${fb};color:${ink2}`),
      ], Number(g('pad')));

      // ── Question ───────────────────────────────────────────────────────
      case 'progress': return [
        { text: '', style: 'display:flex;align-items:center;justify-content:space-between', items: [
          txt(cpVal('question_progress'), `font:700 ${px(16)} ${fb};color:${ink}`),
          txt('50%', `background:${hl};border:${bd2};padding:1px 8px;font:700 ${px(11)} ${fb};transform:rotate(1.5deg)`),
        ]},
        { text: '', style: `display:block;height:12px;border:${bd2};border-radius:8px;overflow:hidden;background:${card}`,
          items: [txt('', `display:block;height:100%;width:50%;background:${primary}`)] },
      ];

      case 'qCard': return cardWrap([
        txt('ไฟดับทั้งเมือง 3 วัน สิ่งแรกที่คุณทำคือ?', `display:block;font:700 ${px(Math.max(14, Number(g('size')) + 5))}/1.35 ${fb};color:${ink}`),
      ], Number(g('pad')));

      case 'options': {
        const keyBox = (ch: string): Row | null => g('keyShape') === 'none' ? null
          : txt(ch, `display:flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;border:${bd2};border-radius:${g('keyShape') === 'square' ? '6px' : '50%'};background:${card};font-family:${fd};font-size:${px(14)}`);
        return ([
          ['A','ออกไปหาน้ำกับอาหารก่อนเลย',false],
          ['B','โทรตามเพื่อนในทีมให้มารวมกัน',true],
          ['C','อยู่บ้าน ประหยัดพลังงานไว้ก่อน',false],
        ] as [string,string,boolean][]).map(([ch, label, on]) => ({
          text: '',
          style: `display:flex;gap:12px;align-items:center;min-height:${g('optH')}px;padding:0 12px;border-radius:12px;background:${on ? hl : card};border:${on ? bd : bd2};box-shadow:${on ? `3px 4px 0 ${ink}` : sh2}`,
          items: [keyBox(ch), txt(label, `font:500 ${px(14)}/1.7 ${fb};color:${ink}`)].filter(Boolean) as Row[],
        }));
      }

      case 'backRow': return [{ text: '', style: 'display:flex;align-items:center;gap:12px', items: [
        txt(cpVal('question_back'), `font:600 ${px(12)} ${fb};color:${ink3}`),
        { text: '', style: 'margin-left:auto;display:flex;gap:5px',
          items: [0,1,2,3,4,5].map(i => txt('', `width:6px;height:6px;border-radius:50%;display:block;background:${i < 3 ? primary : 'rgba(28,26,23,.2)'}`)) },
      ]}];

      // ── Summary ────────────────────────────────────────────────────────
      case 'survivorCard': {
        const soloPat = patOf(b.uid, 'solo');
        const soloShape = soloPat === 'circle' ? 'circle' : soloPat === 'square' ? 'square' : 'card';
        const artW = Number(g('artW'));
        const AS = ART_SHAPES[soloShape] || ART_SHAPES.card;
        const soloFrame = artFrame === 'flat' ? ''
          : artFrame === 'soft' ? 'box-shadow:0 4px 10px rgba(28,26,23,.2);'
          : `border:2px solid ${ink};`;
        const artSolo = `display:block;flex:none;width:${artW}px;height:${Math.round(artW * AS.r)}px;border-radius:${Math.min(AS.radius, artW)}px;background:${hl};${soloFrame}`;
        return cardWrap([
          { text: '', style: 'display:flex;align-items:center;justify-content:space-between', items: [
            txt(cpVal('summary_card_eyebrow'), `font:700 ${px(10)} ${fb};letter-spacing:.12em;color:${ink3}`),
            txt(cpVal('summary_card_valid'), `background:${hl};border:1.5px solid ${ink};padding:1px 7px;font:700 ${px(9.5)} ${fb}`),
          ]},
          { text: '', style: `display:flex;${g('dir') === 'column' ? 'flex-direction:column;align-items:flex-start;' : 'align-items:center;'}gap:14px`, items: [
            txt('', artSolo),
            { text: '', style: 'display:flex;flex-direction:column;gap:3px;min-width:0', items: [
              txt('THE SCOUT', `font-family:${fd};font-size:${px(22)};color:${primary}`),
              txt('สายเอาตัวรอด', `font:700 ${px(18)} ${fb};color:${ink}`),
              txt('ไปก่อน คิดทีหลัง แต่กลับมาพร้อมของที่ทีมต้องใช้', `font:400 ${px(12)}/1.6 ${fb};color:${ink2}`),
            ]},
          ]},
        ], Number(g('pad')));
      }

      case 'retake': return [txt(cpVal('summary_retake_btn'), `display:block;font:600 ${px(11)} ${fb};color:${ink3}`)];

      case 'actionRow': return [{ text: '', style: `display:flex;${g('dir') === 'column' ? 'flex-direction:column;' : ''}gap:8px`, items: [
        txt(cpVal('share_btn'), `flex:1;text-align:center;padding:13px 14px;background:${card};color:${ink};border:${bd2};border-radius:12px;font:600 ${px(13)} ${fb}`),
        txt(cpVal('invite_btn'), `flex:1;text-align:center;padding:13px 14px;background:${primary};color:${onPrimary};border:${bd};border-radius:12px;font:700 ${px(13)} ${fb};box-shadow:3px 3px 0 ${ink}`),
      ]}];

      case 'teamSection': return [
        txt(cpVal('summary_teams_header'), `display:block;font-family:${fd};font-size:${px(22)};letter-spacing:.05em;color:${ink}`),
        { text: '', style: `display:flex;align-items:center;gap:10px;background:${card};border:${bd2};border-radius:12px;padding:12px 14px;box-shadow:${sh2}`, items: [
          g('style') === 'bar'
            ? { text: '', style: `display:block;flex:none;width:56px;height:8px;border:1.5px solid ${ink};border-radius:9px;overflow:hidden;background:${bg}`, items: [txt('', `display:block;height:100%;width:60%;background:${primary}`)] }
            : { text: '', style: 'display:flex;gap:4px;flex:none;flex-wrap:wrap;max-width:60px', items: [0,1,2,3,4].map(i => txt('', `width:8px;height:8px;border-radius:50%;display:block;border:1.5px solid rgba(28,26,23,.2);background:${i < 3 ? primary : 'rgba(28,26,23,.15)'}`)) },
          { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items: [
            txt('3/5 คน', `font:700 ${px(13)} ${fb};color:${ink}`),
            txt('รอสมาชิกอีก 2 คน', `font:500 ${px(11)} ${fb};color:${ink3}`),
          ]},
          txt(cpVal('team_view_btn'), `flex:none;padding:8px 12px;background:${ink};color:${card};border-radius:8px;font:600 ${px(11)} ${fb}`),
        ]},
      ];

      case 'symbolsRow': return [{ text: '', style: `display:flex;align-items:center;gap:10px;padding:14px 16px;background:${card};border:${bd2};border-radius:${radius}px;box-shadow:${sh2}`, items: [
        txt('✦', `display:flex;align-items:center;justify-content:center;width:36px;height:36px;flex:none;border-radius:8px;background:${hl};font-size:17px`),
        { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items: [
          txt(cpVal('symbols_title'), `font:700 ${px(13)} ${fb};color:${ink}`),
          txt(cpVal('symbols_sub'), `font:500 ${px(11)} ${fb};color:${ink3}`),
        ]},
        txt('›', `flex:none;font-size:18px;color:${ink3}`),
      ]}];

      case 'pairLog': return [
        txt(cpVal('pair_log_label'), `display:block;font-family:${fd};font-size:${px(22)};letter-spacing:.05em;color:${ink}`),
        ...[['มีน','สายเอาตัวรอด × สายวางแผน','12 วัน'],['ต้าร์','สายเอาตัวรอด','รอคู่หู...']].map(([n, ax, v]) => ({
          text: '', style: g('style') === 'compact'
            ? `display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1.5px solid rgba(28,26,23,.14)`
            : `display:flex;align-items:center;gap:10px;background:${card};border:${bd2};border-radius:12px;padding:10px 12px;box-shadow:${sh2}`,
          items: [
            g('style') === 'compact' ? txt('', `width:28px;height:28px;flex:none;border-radius:50%;background:rgba(28,26,23,.08)`) : txt('', artStyleFn(34, soft)),
            { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items: [
              txt(n, `font:700 ${px(13)} ${fb};color:${ink}`),
              txt(ax, `font:400 ${px(10.5)} ${fb};color:${ink2}`),
            ]},
            txt(v, `flex:none;font:700 ${px(13)} ${fb};color:${v === 'รอคู่หู...' ? primary : ink}`),
          ],
        })),
      ];

      // ── Pair Result ────────────────────────────────────────────────────
      case 'hero2': {
        const heroStyle = artHero;
        let hero2Items: Row[];
        if (heroStyle === 'band') {
          hero2Items = [txt('', `display:block;width:78%;height:46px;border-radius:${radius}px;background:${primary}`)];
        } else if (heroStyle === 'single') {
          hero2Items = [txt('', artStyleFn(150, hl))];
        } else {
          const pairPat2 = patOf(b.uid, 'pair');
          if (pairPat2 === 'side') {
            hero2Items = [
              txt('', artStyleFn(130, soft, 'margin-right:8px;')),
              txt('', artStyleFn(130, hl, '')),
            ];
          } else if (pairPat2 === 'overlap') {
            hero2Items = [
              txt('', artStyleFn(130, soft, 'margin-right:-50px;')),
              txt('', artStyleFn(130, hl, '')),
            ];
          } else {
            // tilt (default)
            hero2Items = [
              txt('', artStyleFn(130, soft, `transform:rotate(-${g('tilt')}deg);margin-right:-30px;`)),
              txt('', artStyleFn(130, hl,   `transform:rotate(${g('tilt')}deg);margin-left:-30px;`)),
            ];
          }
        }
        return [{ text: '', style: `display:flex;align-items:center;justify-content:center;height:${g('h')}px;background:linear-gradient(#FCEFE0,${bg})`, items: hero2Items }];
      }

      case 'resultCard': return cardWrap([
        txt(cpVal('pair_result_badge'), `align-self:flex-start;background:${hl};border:${bd2};padding:3px 10px;font:700 ${px(11)} ${fb}`),
        txt('12 วัน', `display:block;font-family:${fd};font-size:${px(38)};line-height:1.1;color:${ink}`),
        txt('คนหนึ่งกล้าเสี่ยง อีกคนคิดก่อนทำ — เสบียงพอถึงวันที่ 12', `display:block;font:500 ${px(13.5)}/1.7 ${fb};color:${ink2}`),
      ], Number(g('pad')));

      case 'axisChips': {
        const chipPat = patOf(b.uid, 'chip');
        const chipR = chipPat === 'pill' ? 18 : chipPat === 'cut' ? 2 : 9;
        return [{ text: '', style: `display:flex;${g('dir') === 'column' ? 'flex-direction:column;' : ''}gap:8px`, items: [
          { text: '', style: `flex:1;display:flex;flex-direction:column;gap:2px;border:${bd2};border-radius:${chipR}px;padding:9px;background:${soft}`, items: [
            txt('มีน', `font:600 ${px(9.5)} ${fb};color:${ink3}`),
            txt('สายวางแผน', `font:700 ${px(12)} ${fb}`),
          ]},
          { text: '', style: `flex:1;display:flex;flex-direction:column;gap:2px;border:${bd2};border-radius:${chipR}px;padding:9px;background:${hl}`, items: [
            txt('คุณ', `font:600 ${px(9.5)} ${fb};color:${ink3}`),
            txt('สายเอาตัวรอด', `font:700 ${px(12)} ${fb}`),
          ]},
        ]}];
      }

      case 'shareRow': return [
        btn(cpVal('pair_share_cta'), line, '#FFFFFF'),
        txt(cpVal('copy_link_btn'), `display:block;text-align:center;padding:13px 18px;background:${card};color:${ink};border:${bd};border-radius:${radius}px;box-shadow:${sh};font:700 ${px(15)} ${fb}`),
      ];

      // ── Group ──────────────────────────────────────────────────────────
      case 'topNav': return [{ text: '', style: `display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1.5px solid rgba(28,26,23,.1)`, items: [
        txt(`✕  ${cpVal(screen === 'Symbols' ? 'symbols_title' : 'group_page_title')}`, `font:700 ${px(14)} ${fb};color:${ink}`),
        txt('LIFF', `font:700 ${px(12)} ${fb};letter-spacing:.1em;color:${ink3}`),
      ]}];

      case 'grpCard': return cardWrap([
        { text: '', style: 'display:flex;align-items:flex-start;gap:12px', items: [
          txt('?', `display:flex;align-items:center;justify-content:center;width:66px;height:66px;flex:none;border:${bd};border-radius:50%;background:${hl};font:700 ${px(18)} ${fb}`),
          { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px', items: [
            txt(cpVal('group_title'), `font:700 ${px(10.5)} ${fb};letter-spacing:.08em;color:${primary}`),
            txt('ทีมรอดโลก', `font:700 ${px(17)} ${fb};color:${ink}`),
          ]},
        ]},
        { text: '', style: `display:flex;align-items:center;gap:12px;padding:12px;border:${bd2};border-radius:10px;background:${g('locked') === 'plain' ? bg : ink}`, items: [
          txt('LOCK', `display:flex;align-items:center;justify-content:center;width:34px;height:34px;flex:none;border-radius:8px;border:2px solid ${g('locked') === 'plain' ? 'rgba(28,26,23,.35)' : '#55504A'};background:${g('locked') === 'plain' ? card : '#2A2724'};font:700 ${px(9)} ${fb};color:${g('locked') === 'plain' ? ink : hl}`),
          { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px', items: [
            txt(cpVal('F10_locked_title'), `font:700 ${px(13)} ${fb};color:${g('locked') === 'plain' ? ink : card}`),
            txt(cpVal('F10_locked_body'), `font:400 ${px(10.5)}/1.5 ${fb};color:${g('locked') === 'plain' ? ink2 : '#B8B2A8'}`),
          ]},
        ]},
        { text: '', style: 'display:flex;align-items:center;gap:8px', items: [
          { text: '', style: `flex:1;height:8px;border-radius:4px;overflow:hidden;background:rgba(28,26,23,.1)`, items: [txt('', `display:block;height:100%;width:60%;background:${primary}`)] },
          txt('3/5', `flex:none;font:700 ${px(11)} ${fb}`),
        ]},
        txt(cpVal('group_remaining_label'), `display:block;font:500 ${px(12)} ${fb};color:${ink2}`),
      ], Number(g('pad')));

      case 'memberList': return [
        txt(cpVal('group_members'), `display:block;font:700 ${px(16)} ${fb};color:${ink}`),
        ...(g('style') === 'compact'
          ? [{ text: '', style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px', items: [0,1,2].map(i => ({
              text: '', style: `display:flex;flex-direction:column;align-items:center;gap:5px;background:${card};border:${bd2};border-radius:10px;padding:8px 6px`,
              items: [
                txt('', `display:block;width:100%;height:58px;border-radius:6px;background:${soft}`),
                txt(['คุณ','มีน','ต้าร์'][i], `font:700 ${px(11)} ${fb}`),
              ],
            })) }]
          : [['คุณ','สายเอาตัวรอด','คุณ'],['มีน','สายวางแผน','ดูผลคู่ →']].map(([n, ax, tag]) => ({
              text: '', style: `display:flex;align-items:center;gap:12px;background:${card};border:${bd2};border-radius:12px;padding:10px 12px`,
              items: [
                txt('', artStyleFn(44, soft)),
                { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items: [
                  txt(n, `font:700 ${px(13)} ${fb}`),
                  txt(ax, `font:500 ${px(10.5)} ${fb};color:${ink2}`),
                ]},
                txt(tag, `flex:none;background:${hl};border:1.5px solid ${ink};padding:3px 9px;font:700 ${px(10.5)} ${fb}`),
              ],
            }))),
      ];

      case 'axisCounts': {
        const chipPat2 = patOf(b.uid, 'chip');
        const chipR2 = chipPat2 === 'pill' ? 20 : chipPat2 === 'cut' ? 2 : 8;
        return [{ text: '', style: 'display:flex;gap:7px;flex-wrap:wrap',
          items: [['2','สายเอาตัวรอด'],['1','สายวางแผน']].map(([n, l]) =>
            txt(`${n} ${l}`, `background:${hl};border:1.5px solid ${ink};border-radius:${chipR2}px;padding:3px 10px;font:600 ${px(11)} ${fb}`)) }];
      }

      case 'inviteMore': return [btn(cpVal('group_invite_cta'), line, '#FFFFFF')];

      case 'symGrid': return [{ text: '', style: `display:grid;grid-template-columns:repeat(${g('cols') === '4' ? 4 : 3},1fr);gap:10px`,
        items: [0,1,2,3,4,5,6,7,8].map(i => ({
          text: '', style: `display:flex;flex-direction:column;background:${card};border:2px solid ${i < 4 ? ink : 'rgba(28,26,23,.2)'};border-radius:12px;overflow:hidden;box-shadow:${i < 4 ? `3px 3px 0 ${ink}` : 'none'};opacity:${i < 4 ? 1 : .7}`,
          items: [
            txt(i < 4 ? '✦' : '', `display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;font-size:18px;background:${i < 4 ? hl : '#DDD8CC'}`),
            txt(i < 4 ? `ดวงที่ ${i+1}` : 'ยังไม่ปลด', `display:block;padding:4px 5px;text-align:center;font:600 ${px(9)} ${fb};color:${i < 4 ? ink : ink3}`),
          ],
        })) }];

      // ── Error ──────────────────────────────────────────────────────────
      case 'errCopy': return [
        txt(cpVal('error_title'), `display:block;text-align:${g('align')};font-family:${fd};font-size:${px(26)};color:${ink}`),
        txt(cpVal('error_body'), `display:block;text-align:${g('align')};font:500 ${px(13)}/1.7 ${fb};color:${ink2}`),
      ];

      case 'errRetry': return [btn(cpVal('error_retry'), primary, onPrimary)];

      // ── Extras ─────────────────────────────────────────────────────────
      case 'xImage': return [bgOf('x_image', g('h'), 'ภาพตกแต่ง')];
      case 'xText': return [txt(cpVal('x_text'), `display:block;text-align:${g('align')};font:600 ${px(Number(g('size')))}/1.6 ${fb};color:${ink}`)];
      case 'xSpacer': return [txt('', `display:block;height:${g('h')}px`)];
      case 'xDivider': return [txt('', `display:block;height:2px;background:rgba(28,26,23,.15)`)];

      case 'xBox': {
        const bgKey = String(g('xbgColor') || 'highlight');
        const bgC = bgKey === 'primary' ? primary : bgKey === 'soft' ? soft : bgKey === 'surface' ? card : hl;
        return [txt('', `display:block;height:${g('h')}px;border-radius:${g('xRadius')}px;background:${bgC}`)];
      }

      case 'xCard': return cardWrap([
        txt('RESULT CARD', `font:700 ${px(10)} ${fb};letter-spacing:.1em;color:${ink3}`),
        txt('ชื่อผลลัพธ์หลัก', `font-family:${fd};font-size:${px(20)};color:${primary}`),
        txt('คำอธิบายผลลัพธ์ตัวอย่างที่จะแสดงในหน้านี้', `font:500 ${px(12)}/1.6 ${fb};color:${ink2}`),
      ], Number(g('pad')));

      case 'xRow': {
        const compact = g('style') === 'compact';
        return [{ text:'', style:`display:flex;align-items:center;gap:10px;${compact ? `padding:10px 2px;border-bottom:1.5px solid rgba(28,26,23,.14)` : `background:${card};border:${bd2};border-radius:12px;padding:10px 12px;box-shadow:${sh2}`}`, items:[
          txt('', artStyleFn(36, soft)),
          { text:'', style:'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items:[
            txt('ชื่อรายการ', `font:700 ${px(13)} ${fb};color:${ink}`),
            txt('ข้อมูลประกอบ', `font:500 ${px(11)} ${fb};color:${ink2}`),
          ]},
          txt('›', `flex:none;font-size:16px;color:${ink3}`),
        ]}];
      }

      case 'xChip': {
        const chipPatX = patOf(b.uid, 'chip');
        const chipRX = chipPatX === 'pill' ? 18 : chipPatX === 'cut' ? 2 : 9;
        const justifyC = g('align') === 'left' ? 'flex-start' : 'center';
        return [{ text:'', style:`display:flex;flex-wrap:wrap;gap:7px;justify-content:${justifyC}`, items:[
          txt('สาย A', `background:${hl};border:1.5px solid ${ink};border-radius:${chipRX}px;padding:4px 12px;font:700 ${px(11)} ${fb}`),
          txt('สาย B', `background:${soft};border:1.5px solid ${ink};border-radius:${chipRX}px;padding:4px 12px;font:600 ${px(11)} ${fb};color:${ink2}`),
          txt('สาย C', `background:${card};border:1.5px solid ${ink};border-radius:${chipRX}px;padding:4px 12px;font:600 ${px(11)} ${fb};color:${ink2}`),
        ]}];
      }

      default: return [txt('', 'display:block;height:30px')];
    }
  };

  // ── Normalize row tree (deep-clone, flatten items) ─────────────────────
  const rowsNorm = (b: BlockItem): Row[] => {
    const walk = (node: Row): Row => {
      const out: Row = { text: node.text, style: node.style };
      if (node.items?.length) out.items = node.items.map(walk);
      return out;
    };
    return renderRows(b).map(walk);
  };

  // ── Float / flow split ────────────────────────────────────────────────────
  const floatBlocks = layout.filter(b => pos?.[b.uid]);
  const flowBlocks  = layout.filter(b => !pos?.[b.uid]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 14px 44px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, width: 394, border: '1px solid rgba(28,26,23,.2)', borderRadius: 18, overflow: 'hidden', background: bg, boxShadow: '0 16px 40px rgba(28,26,23,.2)' }}>

        {/* LINE top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', background: '#1E1E1E' }}>
          <span style={{ ...BODY_F, fontSize: 11, color: 'rgba(255,255,255,.9)' }}>✕</span>
          <span style={{ ...BODY_F, fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>{oaTitle}</span>
          <span style={{ ...BODY_F, fontSize: 11, color: 'rgba(255,255,255,.9)' }}>⋯</span>
        </div>

        {/* Phone body */}
        <div
          style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px 26px', minHeight: 400,
            ...(texture === 'paper' ? { backgroundImage: 'repeating-linear-gradient(120deg,rgba(0,0,0,.016) 0 2px,transparent 2px 5px)' } : {}),
          }}
          onPointerMove={floatDrag ? onFloatPointerMove : undefined}
          onPointerUp={floatDrag ? onFloatPointerUp : undefined}
        >
          {/* Flow blocks */}
          {flowBlocks.map(b => {
            const def = SLOTS[b.id] || { label: b.id, kind: 'extra', bind: '' };
            const kd  = KIND[def.kind] || KIND.extra;
            const selected = sel === b.uid;
            const rows = rowsNorm(b);

            return (
              <div
                key={b.uid}
                draggable
                onDragStart={e => { onDragStart(b.uid, e); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => { e.preventDefault(); onDragOver(b.uid); }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(e, b.uid); }}
                onDragEnd={onDragEnd}
                onClick={() => onSelect(b.uid)}
                style={{ position: 'relative', cursor: 'pointer', opacity: b.show ? 1 : 0.35, outline: selected ? '2px solid #E8354F' : 'none', outlineOffset: 3, borderRadius: 4 }}
              >
                {/* Drop indicator */}
                {over === b.uid && drag && (
                  <div style={{ position: 'absolute', top: -7, left: 0, right: 0, height: 3, borderRadius: 2, background: '#E8354F', zIndex: 3 }} />
                )}

                {/* Selection chip */}
                {selected && (
                  <div style={{ position: 'absolute', top: -12, left: 0, zIndex: 4, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 6, background: '#E8354F', boxShadow: '0 1px 5px rgba(0,0,0,.28)' }}>
                    <button onClick={e => { e.stopPropagation(); onMoveUp(b.uid); }} style={{ border: 'none', background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 9, lineHeight: 1, padding: '2px 4px' }}>↑</button>
                    <button onClick={e => { e.stopPropagation(); onMoveDown(b.uid); }} style={{ border: 'none', background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 9, lineHeight: 1, padding: '2px 4px' }}>↓</button>
                    <span style={{ ...MONO, fontSize: 9.5, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{def.label}</span>
                    {def.bind && <span style={{ ...MONO, fontSize: 8, color: 'rgba(255,255,255,.65)', whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>🔒 {def.bind}</span>}
                    <button onClick={e => { e.stopPropagation(); onToggleShow(b.uid); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#FFFFFF', padding: '0 1px' }}>{b.show ? '◉' : '◌'}</button>
                    <button onClick={e => { e.stopPropagation(); onRemove(b.uid); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 9, color: '#FFD9DE', padding: '0 1px' }}>✕</button>
                  </div>
                )}

                {/* Block content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: (b.id === 'options' || b.id === 'shareRow') ? 8 : 6, pointerEvents: 'none' }}>
                  <RenderRows rows={rows} />
                </div>
              </div>
            );
          })}

          {/* Tail drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); onDragOver('__tail'); }}
            onDrop={e => { e.preventDefault(); onDrop(e, null); }}
            style={{
              display: drag ? 'flex' : 'none',
              alignItems: 'center', justifyContent: 'center', minHeight: 36,
              border: `1.5px dashed ${over === '__tail' && drag ? '#E8354F' : 'rgba(28,26,23,.2)'}`,
              borderRadius: 9, ...BODY_F, fontSize: 10,
              color: over === '__tail' ? '#E8354F' : '#A0A5AA',
            }}
          >วางบล็อกที่นี่เพื่อต่อท้าย</div>

          {/* Snap guides */}
          {guides.map((g, i) => g.x !== undefined
            ? <div key={i} style={{ position:'absolute', top:0, bottom:0, left:g.x, width:1.5, background:'#E8354F', pointerEvents:'none', zIndex:20 }} />
            : <div key={i} style={{ position:'absolute', left:0, right:0, top:g.y, height:1.5, background:'#E8354F', pointerEvents:'none', zIndex:20 }} />
          )}

          {/* Float blocks overlay */}
          {floatBlocks.map(b => {
            const p = pos![b.uid];
            const def = SLOTS[b.id] || { label: b.id, kind: 'extra', bind: '' };
            const kd  = KIND[def.kind] || KIND.extra;
            const selected = sel === b.uid;
            const rows = rowsNorm(b);
            return (
              <div
                key={b.uid}
                style={{
                  position: 'absolute', left: p.x, top: p.y, width: p.w,
                  cursor: 'grab', opacity: b.show ? 1 : 0.35,
                  outline: selected ? '2px solid #E8354F' : `1.5px dashed ${kd.c}44`,
                  outlineOffset: 2, borderRadius: 4, zIndex: 10,
                  userSelect: 'none',
                }}
                onPointerDown={e => onFloatPointerDown(b.uid, e)}
                onClick={() => onSelect(b.uid)}
              >
                {/* Float handle chip */}
                <div style={{ position:'absolute', top:-14, left:0, zIndex:14, display:'flex', alignItems:'center', gap:5, padding:'2px 6px', borderRadius:6, background: selected ? '#E8354F' : kd.c, boxShadow:'0 1px 4px rgba(0,0,0,.28)' }}>
                  <span style={{ ...MONO, fontSize:9, color:'#FFFFFF', cursor:'grab' }}>⠿</span>
                  <span style={{ ...MONO, fontSize:9, fontWeight:700, color:'#FFFFFF', whiteSpace:'nowrap' }}>{def.label}</span>
                  <button onClick={e => { e.stopPropagation(); onToggleShow(b.uid); }} style={{ border:'none', background:'none', cursor:'pointer', fontSize:9, color:'#FFFFFF', padding:'0 1px' }}>{b.show ? '◉' : '◌'}</button>
                  <button onClick={e => { e.stopPropagation(); onRemove(b.uid); }} style={{ border:'none', background:'none', cursor:'pointer', fontSize:9, color:'rgba(255,255,255,.7)', padding:'0 1px' }}>✕</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, pointerEvents:'none' }}>
                  <RenderRows rows={rows} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
