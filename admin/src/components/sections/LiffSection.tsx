import { useState, useRef, useEffect, useCallback } from 'react';
import type { AppearanceConfig, Brand } from '../../types';
import LayoutEditor from './LayoutEditor';

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
  prevBg:  '#EDEDE9',
  prevHdr: '#F8F8F6',
};
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono','JetBrains Mono',monospace" };
const BODY_F: React.CSSProperties = { fontFamily: "'Noto Sans Thai','Bai Jamjuree',sans-serif" };

// Convert a CSS string ("display:flex;align-items:center") to a React style object.
// Used so that preview block rows don't pass raw CSS strings to React's style prop,
// which throws in production (React 18 does not accept string values for style).
function css2obj(css: string): React.CSSProperties {
  const result: Record<string, string> = {};
  css.split(';').forEach(decl => {
    const colonIdx = decl.indexOf(':');
    if (colonIdx < 0) return;
    const prop = decl.slice(0, colonIdx).trim();
    const val  = decl.slice(colonIdx + 1).trim();
    if (!prop || !val) return;
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camel] = val;
  });
  return result as React.CSSProperties;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface PreviewResult { title: string; body: string; eyebrow?: string; image_url?: string }
interface PreviewGroupArchetype { code: string; title: string; body: string; eyebrow?: string; primary_text?: string; image_url?: string; symbol_url?: string }

interface Props {
  appearance: AppearanceConfig;
  brand: Brand;
  copy: Record<string, string>;
  mode: string;
  axes?: { id: string; label: string; label_en?: string; body?: string; image_url?: string }[];
  questions?: { id: string; text: string; options: { id: string; label: string }[] }[];
  /** key = pairKey/axis id/type code depending on mode — same shape as the ข้อมูล tab's results step */
  results?: Record<string, PreviewResult>;
  /** group mode only — same archetypes[] configured in the ข้อมูล tab's group step */
  group?: { archetypes: PreviewGroupArchetype[] };
  onChange: (a: AppearanceConfig) => void;
  onCopyChange: (copy: Record<string, string>) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SECTIONS = [
  ['liff',  '01', 'LIFF Setup',   'ID, endpoint, ขนาดหน้าต่าง'],
  ['color', '02', 'Colors',       'CSS variables ที่ LIFF ใช้'],
  ['type',  '03', 'Typography',   'ฟอนต์และขนาดตัวอักษร'],
  ['shape', '04', 'Shape & Feel', 'มุม, เส้น, เงา'],
  ['art',   '05', 'Art Style',    'รูปทรงภาพผลลัพธ์'],
  ['logo',  '06', 'Logo',         'โลโก้และความสูง'],
] as const;

const SCREEN_DEFS = [
  { k: 'Loading',    label: 'Loading',      modes: ['pair','group','solo'] },
  { k: 'Intro',      label: 'Intro',        modes: ['pair','group','solo'] },
  { k: 'Invited',    label: 'Invited',      modes: ['pair','group'] },
  { k: 'Question',   label: 'Question',     modes: ['pair','group','solo'] },
  { k: 'Matching',   label: 'Matching',     modes: ['pair','group'] },
  { k: 'Summary',    label: 'Summary',      modes: ['pair','group','solo'] },
  { k: 'PairResult', label: 'Pair Result',  modes: ['pair','group'] },
  { k: 'SoloShare',  label: 'Solo Share',   modes: ['pair','group','solo'] },
  { k: 'Group',      label: 'Group Result', modes: ['group'] },
  { k: 'Symbols',    label: 'Symbols',      modes: ['group'] },
  { k: 'Error',      label: 'Error',        modes: ['pair','group','solo'] },
];

const COLOR_FIELDS: [string, string, string, string][] = [
  ['primary',    '--ac',        'Primary',     'ปุ่มหลัก, CTA'],
  ['on_primary', '--on-ac',     'On Primary',  'ตัวอักษรบนปุ่มหลัก'],
  ['background', '--bg',        'Background',  'พื้นหลังทั้งแอป'],
  ['surface',    '--card',      'Surface',     'พื้นหลังการ์ด/กล่อง'],
  ['on_surface', '--ink',       'On Surface',  'ตัวอักษรหลักบน surface'],
  ['muted',      '--ink2',      'Muted',       'ตัวอักษรรอง (ink2/ink3)'],
  ['highlight',  '--hl',        'Highlight',   'สีเน้น (เหลือง/สว่าง)'],
  ['accent',     'accent',      'Accent',      'สีเน้นจุดสนใจ, badge'],
  ['accent_soft','accent_soft', 'Accent Soft', 'chip สาย, bg อ่อน'],
  ['line_green', 'line_green',  'LINE Green',  'ปุ่มแชร์ผ่าน LINE'],
  ['overlay',    'overlay',     'Overlay',     'สีทับโปร่งใส (rgba)'],
  ['danger',     'danger',      'Danger',      'สีข้อผิดพลาด'],
];

const FONTS = [
  { name:'Bai Jamjuree',       g:'Bai+Jamjuree:wght@400;500;600;700',       tag:'ไทย · ที่ LIFF ใช้อยู่' },
  { name:'Noto Sans Thai',     g:'Noto+Sans+Thai:wght@400;500;600;700',     tag:'ไทย' },
  { name:'IBM Plex Sans Thai', g:'IBM+Plex+Sans+Thai:wght@400;500;600;700', tag:'ไทย' },
  { name:'Prompt',             g:'Prompt:wght@400;500;600;700',             tag:'ไทย' },
  { name:'Kanit',              g:'Kanit:wght@400;500;600;700',              tag:'ไทย' },
  { name:'Sarabun',            g:'Sarabun:wght@400;500;600;700',            tag:'ไทย' },
  { name:'Mitr',               g:'Mitr:wght@400;500;600;700',               tag:'ไทย' },
  { name:'Chakra Petch',       g:'Chakra+Petch:wght@400;500;600;700',       tag:'ไทย' },
  { name:'Bangers',            g:'Bangers',                                 tag:'ละติน · display' },
  { name:'Anton',              g:'Anton',                                   tag:'ละติน · display' },
  { name:'Gloria Hallelujah',  g:'Gloria+Hallelujah',                       tag:'ละติน · ลายมือ' },
  { name:'Caveat',             g:'Caveat:wght@400;700',                     tag:'ละติน · ลายมือ' },
];

// ── v3 Slot / Screen / Geo constants ──────────────────────────────────────

const SLOTS: Record<string, { label: string; kind: string; bind: string; geo?: string[]; copy?: [string, string, string?][]; img?: string }> = {
  loadArt:     { label:'ภาพ / สปินเนอร์',           kind:'image',  bind:"images['loading']",                geo:['h','style'], img:'loading' },
  loadCopy:    { label:'หัวเรื่อง + ข้อความรอง',     kind:'text',   bind:'copy.loading_*',                   geo:['align'], copy:[['loading_title','หัวเรื่อง'],['loading_body','ข้อความรอง']] },
  loadBar:     { label:'แถบโหลด',                   kind:'meta',   bind:'liff.init progress · Shape & Feel → Progress Bar', geo:[] },
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
  grpComplete: { label:'Team Complete! moment',      kind:'text',   bind:'showCompleteAnim → onSeeResult()', geo:[], copy:[['team_full_push','push แจ้งเตือน','area'],['team_full_title','ชื่อหน้า'],['team_full_sub','คำอธิบาย','area'],['team_full_cta','ปุ่ม CTA']] },
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
const EXTRAS = ['xImage','xText','xSpacer','xDivider','xBox','xCard','xRow','xChip'];

const SCREENS_V3 = [
  { k:'Loading',       label:'Loading',       modes:['pair','group','solo','mbti'], slots:['loadArt','loadCopy','loadBar'] },
  { k:'Intro',         label:'Intro',         modes:['pair','group','solo','mbti'], slots:['kv','infoCard','cta','note'] },
  { k:'Invited',       label:'Invited',       modes:['pair','group'],               slots:['invitedHero','inviterCard','cta','note'] },
  { k:'Question',      label:'Question',      modes:['pair','group','solo','mbti'], slots:['progress','qCard','options','backRow'] },
  { k:'Matching',      label:'Matching',      modes:['pair','group'],               slots:['matArt','loadCopy','loadBar'] },
  { k:'Summary',       label:'Summary',       modes:['pair','group','solo','mbti'], slots:['survivorCard','retake','actionRow','teamSection','symbolsRow','pairLog'] },
  { k:'PairResult',    label:'Pair Result',   modes:['pair','group'],               slots:['hero2','resultCard','axisChips','shareRow'] },
  { k:'SoloShare',     label:'Solo Share',    modes:['pair','group','solo','mbti'], slots:['survivorCard','shareRow'] },
  { k:'Group',         label:'Group Result',  modes:['group'],                      slots:['topNav','grpHero','grpCard','memberList','axisCounts','inviteMore'] },
  { k:'GroupComplete', label:'Team Complete', modes:['group'],                      slots:['grpComplete'] },
  { k:'Symbols',       label:'Symbols',       modes:['group'],                      slots:['topNav','symGrid'] },
  { k:'Error',         label:'Error',         modes:['pair','group','solo','mbti'], slots:['errArt','errCopy','errRetry'] },
];

const KIND: Record<string, { c: string; label: string; icon: string }> = {
  image:  { c:'#B4552C', label:'ภาพ',            icon:'▣' },
  card:   { c:'#1C1A17', label:'การ์ด',           icon:'▤' },
  action: { c:'#E8354F', label:'ปุ่ม',            icon:'⬤' },
  list:   { c:'#1F7A6F', label:'ลิสต์',           icon:'☰' },
  meta:   { c:'#6F757A', label:'ข้อมูลประกอบ',    icon:'—' },
  text:   { c:'#5F6469', label:'ข้อความ',         icon:'T' },
  extra:  { c:'#B07B12', label:'ตกแต่ง',          icon:'✦' },
};

const GEO_DEF: Record<string, { label: string; kind: 'num'|'seg'; min?: number; max?: number; step?: number; unit?: string; opts?: string[] }> = {
  h:        { label:'ความสูง',          kind:'num', min:40,  max:460, step:10, unit:'px' },
  pad:      { label:'padding การ์ด',    kind:'num', min:8,   max:28,  step:2,  unit:'px' },
  artW:     { label:'ขนาดภาพในการ์ด',  kind:'num', min:60,  max:130, step:2,  unit:'px' },
  tilt:     { label:'องศาเอียง',       kind:'num', min:0,   max:14,  step:1,  unit:'°' },
  overlap:  { label:'เกยขึ้นทับ hero', kind:'num', min:0,   max:64,  step:4,  unit:'px' },
  optH:     { label:'ความสูงตัวเลือก', kind:'num', min:44,  max:80,  step:2,  unit:'px' },
  size:     { label:'ขนาดตัวอักษร',    kind:'num', min:11,  max:28,  step:1,  unit:'px' },
  cols:     { label:'จำนวนคอลัมน์',   kind:'seg', opts:['3','4'] },
  fit:      { label:'การครอบภาพ',     kind:'seg', opts:['cover','contain','stretch'] },
  dir:      { label:'การเรียง',        kind:'seg', opts:['row','column'] },
  style:    { label:'รูปแบบ',          kind:'seg', opts:['default','compact','bar'] },
  sticky:   { label:'ปุ่มติดขอบล่าง', kind:'seg', opts:['off','on'] },
  color:    { label:'สีปุ่ม (token)',  kind:'seg', opts:['highlight','primary'] },
  keyShape: { label:'สัญลักษณ์ตัวเลือก',kind:'seg', opts:['circle','square','none'] },
  reveal:   { label:'การเฉลยผลกลุ่ม', kind:'seg', opts:['members','result'] },
  locked:   { label:'กล่องล็อค',       kind:'seg', opts:['dark','plain'] },
  badge:    { label:'badge',           kind:'seg', opts:['show','hide'] },
  align:    { label:'จัดข้อความ',      kind:'seg', opts:['left','center'] },
  xbgColor: { label:'สีพื้นหลัง',      kind:'seg', opts:['highlight','primary','soft','surface'] },
  xRadius:  { label:'ความโค้งมุม',     kind:'num', min:0, max:28, step:2, unit:'px' },
};

const DEFAULT_GEO: Record<string, string|number> = {
  h:200, pad:16, fit:'cover', dir:'row', style:'default', cols:'3', artW:92,
  tilt:8, overlap:24, sticky:'off', color:'highlight', keyShape:'circle', size:14,
  reveal:'members', locked:'dark', badge:'show', align:'center', optH:56,
  xbgColor:'highlight', xRadius:8,
};

const ART_SHAPES: Record<string, { r: number; radius: number }> = {
  card:   { r:4/3,   radius:8 },
  circle: { r:1,     radius:999 },
  square: { r:1,     radius:10 },
  wide:   { r:9/16,  radius:10 },
  none:   { r:1,     radius:8 },
};

/** Maps slot id → pattern family handled by that slot */
const PATTERN_OF: Record<string, string> = {
  survivorCard: 'solo',
  hero2:        'pair',
  matArt:       'pair',
  grpHero:      'group',
  axisChips:    'chip',
  axisCounts:   'chip',
  xChip:        'chip',
};

/** Visual tile definitions per family/pattern. Each entry: [label, shapeStyles[]] */
const PAT_TILES: Record<string, Record<string, [string, string[]]>> = {
  solo: {
    portrait: ['การ์ดตั้ง',       ['display:block;width:22px;height:30px;border:2px solid #1C1A17;border-radius:4px;background:#F5E14B']],
    square:   ['สี่เหลี่ยม',      ['display:block;width:26px;height:26px;border:2px solid #1C1A17;border-radius:4px;background:#F5E14B']],
    circle:   ['วงกลม',           ['display:block;width:26px;height:26px;border:2px solid #1C1A17;border-radius:50%;background:#F5E14B']],
  },
  pair: {
    tilt:    ['เอียงเข้าหากัน', ['display:block;width:20px;height:28px;border:2px solid #1C1A17;border-radius:4px;background:#E6F1F5;transform:rotate(-8deg);margin-right:-8px', 'display:block;width:20px;height:28px;border:2px solid #1C1A17;border-radius:4px;background:#F5E14B;transform:rotate(8deg);margin-left:-8px']],
    side:    ['เทียบข้างกัน',   ['display:block;width:20px;height:28px;border:2px solid #1C1A17;border-radius:4px;background:#E6F1F5;margin-right:4px', 'display:block;width:20px;height:28px;border:2px solid #1C1A17;border-radius:4px;background:#F5E14B']],
    overlap: ['ซ้อนทับ',         ['display:block;width:20px;height:28px;border:2px solid #1C1A17;border-radius:4px;background:#E6F1F5;margin-right:-12px', 'display:block;width:20px;height:28px;border:2px solid #1C1A17;border-radius:4px;background:#F5E14B']],
  },
  group: {
    fan:   ['พัด',  ['display:block;width:18px;height:24px;border:2px solid #1C1A17;border-radius:3px;background:#E6F1F5;transform:rotate(-10deg);margin-right:-10px', 'display:block;width:18px;height:24px;border:2px solid #1C1A17;border-radius:3px;background:#F5E14B;margin-right:-10px', 'display:block;width:18px;height:24px;border:2px solid #1C1A17;border-radius:3px;background:#E6F1F5;transform:rotate(10deg)']],
    stack: ['ซ้อน', ['display:block;width:18px;height:24px;border:2px solid #1C1A17;border-radius:3px;background:#E6F1F5;margin-right:-10px', 'display:block;width:18px;height:24px;border:2px solid #1C1A17;border-radius:3px;background:#F5E14B;margin-right:-10px', 'display:block;width:18px;height:24px;border:2px solid #1C1A17;border-radius:3px;background:#E6F1F5']],
    grid:  ['กริด', ['display:grid;grid-template-columns:1fr 1fr;gap:3px;width:44px', 'display:block;height:10px;border:1.5px solid #1C1A17;border-radius:2px;background:#E6F1F5', 'display:block;height:10px;border:1.5px solid #1C1A17;border-radius:2px;background:#F5E14B', 'display:block;height:10px;border:1.5px solid #1C1A17;border-radius:2px;background:#F5E14B', 'display:block;height:10px;border:1.5px solid #1C1A17;border-radius:2px;background:#E6F1F5']],
  },
  chip: {
    pill: ['ยาวมน',   ['display:block;height:16px;width:54px;border:1.5px solid #1C1A17;border-radius:20px;background:#F5E14B']],
    soft: ['มุมเล็ก', ['display:block;height:16px;width:54px;border:1.5px solid #1C1A17;border-radius:6px;background:#F5E14B']],
    cut:  ['เหลี่ยม', ['display:block;height:16px;width:54px;border:1.5px solid #1C1A17;border-radius:0;background:#F5E14B']],
  },
};

/** Sample campaign data shown in preview when source is not 'manual' */
const SAMPLE = {
  axes: [
    { label:'สายไฟลุก', label_en:'THE FLARE', body:'ตัดสินใจเร็วกว่าคิด พาทีมรอดสามวันแรกแบบไม่ต้องประชุม', image_url:'' },
    { label:'สายน้ำนิ่ง', label_en:'THE CALM',  body:'ไม่รีบ ไม่แตกตื่น น้ำสำรองอยู่ในมือคนนี้เสมอ',       image_url:'' },
    { label:'สายดินแน่น', label_en:'THE ANCHOR',body:'อยู่กับที่ ซ่อมของเก่าให้กลับมาใช้ได้อีกรอบ',         image_url:'' },
    { label:'สายลมเปลี่ยว',label_en:'THE DRIFTER',body:'ไปคนเดียวได้ไกล แต่กลับมาไม่ค่อยตรงเวลา',          image_url:'' },
    { label:'สายเหล็กเย็น',label_en:'THE BLADE', body:'ตัดสินใจเรื่องยากแทนทีมได้ ไม่แคร์ว่าใครจะงอน',      image_url:'' },
  ],
  results: [
    { code:'fire_water', title:'ไฟเจอน้ำ',   primary:'12 วัน', pair:'สายไฟลุก × สายน้ำนิ่ง',  body:'คนหนึ่งกล้าเสี่ยง อีกคนคิดก่อนทำ เสบียงพอถึงวันที่ 12', image_url:'' },
    { code:'fire_metal', title:'ไฟเจอเหล็ก', primary:'8 วัน',  pair:'สายไฟลุก × สายเหล็กเย็น', body:'เถียงกันทุกเรื่อง แต่ตัดสินใจไว',                          image_url:'' },
    { code:'water_earth',title:'น้ำเจอดิน',  primary:'19 วัน', pair:'สายน้ำนิ่ง × สายดินแน่น',  body:'ไม่มีใครวิ่ง ไม่มีใครตื่น เสบียงอยู่ได้นานที่สุด',         image_url:'' },
  ],
  group: [
    { code:'stove',  title:'ทีมเตาไฟ',   eyebrow:'GROUP RESULT · 4 คน', primary_text:'รอดได้ 40 วัน', body:'ทีมนี้ตัดสินใจเร็วและกล้าเสี่ยง', image_url:'', symbol_url:'' },
    { code:'harbor', title:'ทีมท่าเรือ',  eyebrow:'GROUP RESULT · 3 คน', primary_text:'รอดได้ 52 วัน', body:'ไม่มีใครรีบ ทุกคนมีของสำรอง',     image_url:'', symbol_url:'' },
    { code:'forge',  title:'ทีมโรงหลอม', eyebrow:'GROUP RESULT · 5 คน', primary_text:'รอดได้ 33 วัน', body:'ตัดสินใจเด็ดขาดเกินไป',           image_url:'', symbol_url:'' },
  ],
  members: [
    { name:'คุณ',  axis:'สายไฟลุก',  tag:'คุณ' },
    { name:'มีน',  axis:'สายน้ำนิ่ง', tag:'ดูผลคู่ →' },
    { name:'ต้าร์',axis:'สายดินแน่น',tag:'ดูผลคู่ →' },
    { name:'โบ๊ท', axis:'สายลมเปลี่ยว',tag:'ดูผลคู่ →' },
    { name:'ฟ้า',  axis:'สายเหล็กเย็น',tag:'ดูผลคู่ →' },
  ],
  pairs: [
    { name:'มีน',  axis:'สายไฟลุก × สายน้ำนิ่ง',  value:'12 วัน' },
    { name:'ต้าร์',axis:'สายไฟลุก × สายดินแน่น', value:'19 วัน' },
    { name:'โบ๊ท', axis:'สายไฟลุก',                value:'รอคู่หู...' },
  ],
};

/**
 * Which campaign modes each data source is valid for.
 * - solo: only has axes[] / per-axis results — no pairing, no group.
 * - mbti: same shape as solo (axes[] + type-code results) — no pairing, no group.
 * - pair: has axes[] + pair results[] — no group.
 * - group: has everything, including group.archetypes[] / group.members[].
 */
const ALL_MODES = ['solo', 'mbti', 'pair', 'group'];

/** Text source modes */
const SRC_TEXT = [
  { k:'manual',  label:'พิมพ์เองในหน้านี้',   path:'copy.*',                 n:0,   fields:[] as [string,string][], scope: ALL_MODES },
  { k:'axes',    label:'ข้อความของสาย',        path:'axes[i]',               n:5,   fields:[['label','ชื่อสาย'],['label_en','ชื่ออังกฤษ'],['body','คำอธิบาย']] as [string,string][], scope: ALL_MODES },
  { k:'results', label:'ข้อความผลคู่',         path:'results[i]',            n:3,   fields:[['title','ชื่อผล'],['eyebrow','บรรทัดเล็ก'],['body','เหตุผล']] as [string,string][], scope: ['pair','group'] },
  { k:'group',   label:'ข้อความผลกลุ่ม',       path:'group.archetypes[i]',   n:3,   fields:[['title','ชื่อกลุ่ม'],['eyebrow','บรรทัดเล็ก'],['primary_text','จำนวนวัน'],['body','คำอธิบาย']] as [string,string][], scope: ['group'] },
  { k:'copy',    label:'คีย์ข้อความกลาง',      path:"copy['key']",           n:0,   fields:[] as [string,string][], scope: ALL_MODES },
];

/** Image source modes */
const SRC_IMG = [
  { k:'fixed',     label:'อัปโหลด / URL คงที่',          rows:'',       field:'',          n:0, scope: ALL_MODES },
  { k:'axes',      label:'ภาพการ์ดของสาย',               rows:'axes',   field:'image_url', n:5, scope: ALL_MODES },
  { k:'results',   label:'ภาพผลคู่',                     rows:'results',field:'image_url', n:3, scope: ['pair','group'] },
  { k:'grpImage',  label:'ภาพผลกลุ่ม',                   rows:'group',  field:'image_url', n:3, scope: ['group'] },
  { k:'grpSymbol', label:'สัญลักษณ์กลุ่ม (แสตมป์)',      rows:'group',  field:'symbol_url',n:3, scope: ['group'] },
];

/** List source modes */
const SRC_LIST = [
  { k:'members', label:'สมาชิกในทีม',    path:'group.members[]', max:5, scope: ['group'] },
  { k:'pairs',   label:'คู่หูของฉัน',    path:'summary.pairs[]', max:3, scope: ['pair','group'] },
  { k:'axes',    label:'สาย 5 สาย',      path:'axes[]',          max:5, scope: ALL_MODES },
  { k:'results', label:'ผลคู่ทั้งหมด',   path:'results[]',       max:3, scope: ['pair','group'] },
];

/** Default src state per channel */
const DEFAULT_SRC: Record<string, Record<string, any>> = {
  text:  { mode:'manual',  field:'title', idx:0, key:'group_title', fallback:'manual' },
  image: { mode:'fixed',   idx:0,         key:'kv-intro',           fallback:'placeholder' },
  list:  { mode:'members', count:3,                                  fallback:'placeholder' },
};

const DEFAULT_POS = { x: 20, y: 120, w: 240 };

/** Which channels each slot has */
const CH_OF: Record<string, string[]> = {
  loadArt:['image'], loadCopy:['text'], kv:['image'], infoCard:['text'], cta:['text'], note:['text'],
  invitedHero:['image'], inviterCard:['text'], backRow:['text'],
  survivorCard:['text'], retake:['text'], actionRow:['text'], teamSection:['text'], symbolsRow:['text'],
  pairLog:['text','list'], resultCard:['text'], shareRow:['text'], topNav:['text'],
  grpHero:['image','list'], grpCard:['text'], memberList:['text','list'], axisCounts:['list'],
  inviteMore:['text'], grpComplete:['text'], errCopy:['text'], errRetry:['text'],
  xImage:['image'], xText:['text'], xCard:['text'], xRow:['list'], xChip:['list'],
};

const DEFAULT_COPY: Record<string, string> = {
  intro_quiz_label:'DUO QUIZ · 6 ข้อ',
  intro_body:'คุณกับเพื่อนจะรอดกี่วันถ้าโลกแตกพรุ่งนี้?',
  intro_time:'1 นาที', intro_cta:'เริ่มตอบ', intro_note:'ตอบ 6 ข้อ ไม่ถึงนาที',
  question_progress:'ข้อ 3 / 6', question_back:'← ย้อนกลับ',
  loading_title:'LOADING', loading_body:'กำลังโหลด...',
  matching_title:'MATCHING...', matching_sub:'กำลังคำนวณผลคู่...',
  invited_duo_badge:'คำเชิญ!', invited_body:'ชวนคุณมาดูว่าเราสองคนจะรอดกี่วัน', invite_cta:'ตอบให้มีน',
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
  team_full_push:'ทีมของคุณครบ 5 คนแล้ว เปิดดูผลทีมได้เลย', team_full_title:'TEAM COMPLETE!', team_full_sub:'ทุกคนได้แจ้งเตือนพร้อมกัน — มาดูผลทีมกันเลย', team_full_cta:'เปิดผลทีม →',
  error_title:'เกิดข้อผิดพลาด', error_body:'ลองใหม่อีกครั้ง หรือเข้ามาจากลิงก์เดิม', error_retry:'ลองอีกครั้ง',
  x_text:'ข้อความตกแต่ง',
};

// Screen meta: parts label + images per screen (for info display in config header)
const SCREEN_META: Record<string, { parts: string; images: [string,string,string][] }> = {
  Loading:    { parts:'ภาพ/สปินเนอร์ · หัวเรื่อง · ข้อความรอง · แถบโหลด',
    images:[['loading','ภาพกลางจอ','แนะนำ 300×300 px']] },
  Intro:      { parts:'KV · การ์ดข้อมูล · ปุ่มเริ่ม · โน้ต',
    images:[['kv-intro','KV หลัก','แนะนำ 750×540 px']] },
  Invited:    { parts:'Hero · การ์ดผู้เชิญ · badge · ปุ่มหลัก',
    images:[['invited_hero','Hero','แนะนำ 750×720 px']] },
  Question:   { parts:'ตัวนับ · progress bar · การ์ดคำถาม · ตัวเลือก · ปุ่มย้อนกลับ', images:[] },
  Matching:   { parts:'การ์ด 2 ใบเอียง · หัวเรื่อง · แถบโหลด', images:[] },
  PairResult: { parts:'Hero การ์ด 2 ใบ · การ์ดผล · ชิปสาย · ปุ่มแชร์',
    images:[['kv-pair','ภาพพื้น Hero','การ์ด 2 ใบเอียง']] },
  Summary:    { parts:'การ์ดผู้รอด · ปุ่มตอบใหม่ · ปุ่มแชร์+เชิญ · section ทีม', images:[] },
  SoloShare:  { parts:'การ์ดสายของฉัน · ปุ่มแชร์ไลน์ · ปุ่มคัดลอกลิงก์', images:[] },
  Group:         { parts:'top nav · hero การ์ดพัด · การ์ดผลกลุ่ม · ลิสต์สมาชิก',
    images:[['group_hero','ภาพพื้น hero','พื้นหลังด้านบน'],['group_result','ภาพผลกลุ่ม','archetype image']] },
  GroupComplete: { parts:'push mock · การ์ดพัด · ชื่อหน้า · คำอธิบาย · ปุ่ม CTA', images:[] },
  Symbols:       { parts:'top nav + ตัวนับ · แถบความคืบหน้า · กริดสัญลักษณ์', images:[] },
  Error:      { parts:'ภาพ/การ์ด · หัวเรื่อง · คำอธิบาย · ปุ่มลองใหม่', images:[] },
};

const ART_PRESETS = [
  { k:'hard',  label:'Hard',  hint:'เส้นหนา เงาชัด มุมเหลี่ยม', cardR:16, radius:8,  bw:2.5, shadow:'hard' as const, shOff:4 },
  { k:'flat',  label:'Flat',  hint:'เส้นบาง ไม่มีเงา มุมนุ่ม',  cardR:10, radius:8,  bw:1,   shadow:'none' as const, shOff:0 },
  { k:'round', label:'Round', hint:'มุมกลมมาก เงานุ่ม',          cardR:24, radius:20, bw:1,   shadow:'soft' as const, shOff:4 },
];

const IMG_CTRL: Record<string, { hKey: string; min: number; max: number }> = {
  'loading':       { hKey: 'h_loading',      min: 60,  max: 300 },
  'kv-intro':      { hKey: 'h_kvintro',      min: 120, max: 460 },
  'invitedhero':   { hKey: 'h_invitedhero',  min: 120, max: 440 },
  'invited_hero':  { hKey: 'h_invited_hero', min: 120, max: 440 },
  'kv-pair':       { hKey: 'h_kvpair',       min: 120, max: 360 },
  'group_hero':    { hKey: 'h_group_hero',   min: 100, max: 320 },
  'group_result':  { hKey: 'h_group_result', min: 80,  max: 220 },
};

// ── Luminance / Contrast helpers ───────────────────────────────────────────

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const v = [0, 2, 4].map(i => parseInt(s.substr(i, 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrastRatio(a: string, b: string): number {
  try {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  } catch { return 1; }
}

// ── Field wrapper ──────────────────────────────────────────────────────────

function Field({ label, path, children }: { label: string; path?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ ...MONO, fontSize: 12, fontWeight: 700, color: T.text }}>{label}</span>
        {path && <span style={{ ...MONO, fontSize: 10, color: T.faint, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{path}</span>}
      </div>
      {children}
    </div>
  );
}

// ── ColorInput ─────────────────────────────────────────────────────────────

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
      <input
        type="color"
        value={value?.startsWith('#') ? value : '#888888'}
        onChange={e => onChange(e.target.value)}
        style={{ width: 32, height: 30, flexShrink: 0, border: T.border, borderRadius: 7, padding: 0, cursor: 'pointer', background: 'none' }}
      />
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, border: T.border, borderRadius: 8, padding: '8px 10px', ...MONO, fontSize: 12, fontWeight: 500, background: T.panel, color: T.text, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// ── SegInput ───────────────────────────────────────────────────────────────

function SegInput({ value, options, onChange }: { value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {options.map(o => {
        const on = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            border: `1px solid ${on ? T.text : '#DEDEDA'}`,
            borderRadius: 7,
            background: on ? T.text : '#fff',
            color: on ? '#fff' : T.mid,
            ...BODY_F, fontSize: 11, fontWeight: on ? 600 : 400,
            padding: '6px 10px',
            cursor: 'pointer',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// ── NumInput ───────────────────────────────────────────────────────────────

function NumInput({ value, min, max, step, unit, onChange }: {
  value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, minWidth: 0, accentColor: T.active }}
      />
      <span style={{ flexShrink: 0, border: T.border, borderRadius: 7, background: T.bg, padding: '4px 8px', ...MONO, fontSize: 11, fontWeight: 600, color: T.text }}>
        {value}{unit}
      </span>
    </div>
  );
}

// ── TextInput ──────────────────────────────────────────────────────────────

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', boxSizing: 'border-box', border: T.border, borderRadius: 8, padding: '8px 10px', ...BODY_F, fontSize: 12, fontWeight: 500, background: T.panel, color: T.text, outline: 'none' }}
    />
  );
}

// ── FontInput ──────────────────────────────────────────────────────────────

function FontInput({ value, onChange, sample, uploadedFonts, onUploadRequest }: {
  value: string;
  onChange: (v: string) => void;
  sample: string;
  uploadedFonts: string[];
  onUploadRequest: () => void;
}) {
  const allFonts = [...FONTS, ...uploadedFonts.map(n => ({ name: n, g: '', tag: 'custom' }))];
  const current = value || '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <select
        value={current}
        onChange={e => onChange(e.target.value)}
        style={{ border: T.border, borderRadius: 8, padding: '8px 10px', ...MONO, fontSize: 12, fontWeight: 600, background: T.panel, color: T.text, outline: 'none', cursor: 'pointer' }}
      >
        <option value="">— เลือกฟอนต์ —</option>
        {allFonts.map(f => (
          <option key={f.name} value={f.name}>{f.name}  ·  {f.tag}</option>
        ))}
      </select>
      <button onClick={onUploadRequest} style={{ border: T.border, borderRadius: 8, padding: '8px 10px', ...BODY_F, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: T.panel, color: T.mid, textAlign: 'left' }}>
        + อัปโหลดฟอนต์ (.woff2 / .ttf)
      </button>
      {current && (
        <div style={{ fontFamily: current, fontSize: 20, fontWeight: 700, lineHeight: 1.3, border: '1px dashed #E7E7E3', borderRadius: 8, padding: '8px 10px', background: '#fff' }}>
          {sample}
        </div>
      )}
    </div>
  );
}

// ── ImageInput ─────────────────────────────────────────────────────────────

function ImageInput({ imgKey, value, hint, layout, onUrl, onUploadRequest, onLayout }: {
  imgKey: string;
  value: string;
  hint: string;
  layout: Record<string, string|number>;
  onUrl: (v: string) => void;
  onUploadRequest: (key: string) => void;
  onLayout: (k: string, v: string|number) => void;
}) {
  const ctrl = IMG_CTRL[imgKey];
  const normKey = imgKey.replace(/-/g, '');
  const fitKey  = `fit_${normKey}`;
  const zoomKey = `zoom_${normKey}`;
  const posKey  = `pos_${normKey}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        {/* Thumbnail */}
        <div style={{
          width: 64, height: 64, flexShrink: 0,
          border: '1px dashed #DEDEDA', borderRadius: 8,
          background: value ? 'none' : '#FBFBF9',
          backgroundImage: value ? `url(${value})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {!value && <span style={{ ...MONO, fontSize: 9, color: '#C9CCCE' }}>IMG</span>}
        </div>
        {/* URL + upload */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <input
            type="text"
            value={value}
            placeholder="https://..."
            onChange={e => onUrl(e.target.value)}
            style={{ border: T.border, borderRadius: 8, padding: '7px 9px', ...MONO, fontSize: 11, fontWeight: 500, outline: 'none', width: '100%', boxSizing: 'border-box', background: T.panel, color: T.text }}
          />
          <button onClick={() => onUploadRequest(imgKey)} style={{ border: T.border, borderRadius: 8, padding: '7px 9px', ...BODY_F, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.panel, color: T.mid, textAlign: 'left' }}>
            + อัปโหลดรูป
          </button>
        </div>
      </div>
      {hint && <span style={{ ...BODY_F, fontSize: 10.5, color: T.dim }}>{hint}</span>}
      {ctrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 4 }}>
          <Field label="Fit" path={fitKey}>
            <SegInput
              value={String(layout[fitKey] ?? 'cover')}
              options={[{ v:'cover', label:'Cover' }, { v:'contain', label:'Contain' }, { v:'stretch', label:'Stretch' }]}
              onChange={v => onLayout(fitKey, v)}
            />
          </Field>
          <Field label="Height" path={ctrl.hKey}>
            <NumInput
              value={Number(layout[ctrl.hKey] ?? ctrl.min)}
              min={ctrl.min} max={ctrl.max} step={10} unit="px"
              onChange={v => onLayout(ctrl.hKey, v)}
            />
          </Field>
          <Field label="Zoom" path={zoomKey}>
            <NumInput
              value={Number(layout[zoomKey] ?? 100)}
              min={60} max={220} step={5} unit="%"
              onChange={v => onLayout(zoomKey, v)}
            />
          </Field>
          <Field label="Focus" path={posKey}>
            <SegInput
              value={String(layout[posKey] ?? 'center')}
              options={[{ v:'top', label:'Top' }, { v:'center', label:'Center' }, { v:'bottom', label:'Bottom' }]}
              onChange={v => onLayout(posKey, v)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ── VisualPicker ───────────────────────────────────────────────────────────

type PickerColors = { primary: string; highlight: string; surface: string; background: string; accentSoft: string };

function VisualPicker({ label, layoutKey, options, currentValue, colors: c, onPick, defaultOpen = true }: {
  label: string;
  layoutKey: string;
  options: [string, string, string, string[]][];
  currentValue: string;
  colors: PickerColors;
  onPick: (key: string, value: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: open ? 7 : 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: T.text }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 22, height: 22, borderRadius: 6, marginLeft: 'auto', background: T.bg, fontSize: 15, lineHeight: 1, color: T.text, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && options.map(([value, optLabel, caption, blocks]) => {
        const on = currentValue === value;
        return (
          <button key={value} onClick={() => onPick(layoutKey, value)} style={{
            display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center', textAlign: 'left',
            padding: '8px 10px',
            border: `1.5px solid ${on ? T.active : '#E7E7E3'}`,
            borderRadius: 10,
            background: on ? '#FEF5F6' : T.panel,
            cursor: 'pointer',
          }}>
            {/* Thumbnail */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0,
              width: 46, height: 84, padding: 3, boxSizing: 'border-box',
              borderRadius: 6,
              border: `1.5px solid ${on ? 'rgba(28,26,23,.45)' : 'rgba(28,26,23,.25)'}`,
              background: c.background,
              overflow: 'hidden',
            }}>
              {blocks.map((blockStr, i) => {
                const colonIdx = blockStr.indexOf(':');
                const type = colonIdx >= 0 ? blockStr.slice(0, colonIdx) : blockStr;
                const hRaw = colonIdx >= 0 ? blockStr.slice(colonIdx + 1) : '';
                const h = hRaw ? `${hRaw}%` : '100%';
                const blk: React.CSSProperties = { display: 'block', flexShrink: 0, width: '100%', boxSizing: 'border-box' };
                if (type === 'gap') return <div key={i} style={{ flex: '1 1 auto' }} />;
                if (type === 'ring') return <div key={i} style={{ display: 'block', flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: `2px solid ${c.primary}`, borderTopColor: 'transparent', margin: 'auto' }} />;
                if (type === 'img') return <div key={i} style={{ ...blk, height: h, minHeight: 4, borderRadius: 2, background: 'linear-gradient(160deg,#D8A38B,#C4623A)' }} />;
                if (type === 'imgCircle') return <div key={i} style={{ display: 'block', flexShrink: 0, width: 28, height: 28, borderRadius: '50%', margin: '0 auto', background: 'linear-gradient(160deg,#D8A38B,#C4623A)' }} />;
                if (type === 'imgSquare') return <div key={i} style={{ display: 'block', flexShrink: 0, width: 28, height: 28, borderRadius: 3, margin: '0 auto', background: 'linear-gradient(160deg,#D8A38B,#C4623A)' }} />;
                if (type === 'imgWide') return <div key={i} style={{ ...blk, height: 14, minHeight: 4, borderRadius: 3, background: 'linear-gradient(160deg,#D8A38B,#C4623A)' }} />;
                if (type === 'cta') return <div key={i} style={{ ...blk, height: h, minHeight: 7, borderRadius: 2, background: c.primary }} />;
                if (type === 'ctaHl') return <div key={i} style={{ ...blk, height: h, minHeight: 7, borderRadius: 2, border: '1px solid rgba(28,26,23,.5)', background: c.highlight }} />;
                if (type === 'cta2') return <div key={i} style={{ ...blk, height: h, borderRadius: 2, background: `linear-gradient(90deg,rgba(28,26,23,.18) 0 47%,transparent 47% 53%,${c.primary} 53% 100%)` }} />;
                if (type === 'bar') return <div key={i} style={{ ...blk, height: h, minHeight: 5, borderRadius: 9, border: '1px solid rgba(28,26,23,.4)', background: `repeating-linear-gradient(115deg,${c.primary} 0 4px,${c.highlight} 4px 7px)` }} />;
                if (type === 'barSolid') return <div key={i} style={{ ...blk, height: h, minHeight: 5, borderRadius: 9, border: '1px solid rgba(28,26,23,.4)', background: `linear-gradient(90deg,${c.primary} 0 62%,${c.surface} 62% 100%)` }} />;
                if (type === 'text') return <div key={i} style={{ ...blk, height: h, borderRadius: 2, background: 'rgba(28,26,23,.28)' }} />;
                if (type === 'skel') return <div key={i} style={{ ...blk, height: h, borderRadius: 2, background: 'rgba(28,26,23,.13)' }} />;
                if (type === 'opt') return <div key={i} style={{ ...blk, height: h, minHeight: 7, borderRadius: 2, border: '1px solid rgba(28,26,23,.4)', background: c.surface }} />;
                if (type === 'optC') return <div key={i} style={{ ...blk, height: h, minHeight: 8, borderRadius: 2, border: '1px solid rgba(28,26,23,.4)', background: `radial-gradient(circle at 12% 50%,rgba(28,26,23,.55) 2.6px,transparent 3.1px),${c.surface}` }} />;
                if (type === 'optS') return <div key={i} style={{ ...blk, height: h, minHeight: 8, borderRadius: 2, border: '1px solid rgba(28,26,23,.4)', background: `linear-gradient(90deg,rgba(28,26,23,.5) 0 5px,${c.surface} 5px 100%)` }} />;
                if (type === 'optBig') return <div key={i} style={{ ...blk, height: h, minHeight: 11, borderRadius: 3, border: '1.5px solid rgba(28,26,23,.4)', background: c.surface }} />;
                if (type === 'dots') return <div key={i} style={{ ...blk, height: h, minHeight: 6, background: `radial-gradient(circle at 30% 50%,${c.primary} 2.5px,transparent 3px),radial-gradient(circle at 50% 50%,rgba(28,26,23,.3) 2.5px,transparent 3px),radial-gradient(circle at 70% 50%,rgba(28,26,23,.3) 2.5px,transparent 3px)` }} />;
                if (type === 'chips') return <div key={i} style={{ ...blk, height: h, borderRadius: 2, background: `linear-gradient(90deg,${c.accentSoft || '#E6F1F5'} 0 47%,transparent 47% 53%,${c.highlight} 53% 100%)` }} />;
                if (type === 'chip') return <div key={i} style={{ ...blk, height: h, borderRadius: 2, border: '1px solid rgba(28,26,23,.3)', background: c.accentSoft || '#E6F1F5' }} />;
                if (type === 'row') return <div key={i} style={{ ...blk, height: h, borderRadius: 2, background: `linear-gradient(90deg,${c.highlight} 0 34%,rgba(28,26,23,.16) 34% 100%)` }} />;
                if (type === 'line') return <div key={i} style={{ ...blk, height: h, minHeight: 5, borderBottom: '1px solid rgba(28,26,23,.3)' }} />;
                if (type === 'badge') return <div key={i} style={{ display: 'block', flexShrink: 0, width: '40%', height: h, minHeight: 5, borderRadius: 2, background: c.highlight }} />;
                return <div key={i} style={{ ...blk, height: h, borderRadius: 2, background: 'rgba(28,26,23,.22)' }} />;
              })}
            </div>
            {/* Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, textAlign: 'left' }}>
              <span style={{ ...BODY_F, fontSize: 11.5, fontWeight: 700, color: on ? '#B02A3F' : T.text }}>{optLabel}</span>
              <span style={{ ...BODY_F, fontSize: 10, lineHeight: 1.45, color: T.dim }}>{caption}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Collapsible ────────────────────────────────────────────────────────────

function Collapsible({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: open ? 16 : 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: T.text }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 22, height: 22, borderRadius: 6, marginLeft: 'auto', background: T.bg, fontSize: 15, lineHeight: 1, color: T.text, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && children}
    </div>
  );
}

// ── Specimen Components ────────────────────────────────────────────────────

function ColorSpecimen({ colors }: { colors: Record<string, string> }) {
  const get = (k: string, def: string) => (colors as any)[k] || def;
  const chips = [
    { name: 'Primary',     cssVar: '--ac',        c: get('primary',     '#E8354F') },
    { name: 'On Primary',  cssVar: '--on-ac',     c: get('on_primary',  '#FFFDF6') },
    { name: 'Background',  cssVar: '--bg',        c: get('background',  '#F7F1E3') },
    { name: 'Surface',     cssVar: '--card',      c: get('surface',     '#FFFDF6') },
    { name: 'On Surface',  cssVar: '--ink',       c: get('on_surface',  '#1C1A17') },
    { name: 'Muted',       cssVar: '--ink2',      c: get('muted',       'rgba(28,26,23,.6)') },
    { name: 'Highlight',   cssVar: '--hl',        c: get('highlight',   '#F5E14B') },
    { name: 'Accent',      cssVar: 'accent',      c: get('accent',      '#7AC4D6') },
    { name: 'Accent Soft', cssVar: 'accent_soft', c: get('accent_soft', '#E6F1F5') },
    { name: 'LINE Green',  cssVar: 'line',        c: get('line_green',  '#06C755') },
  ];
  const bodyFont = "'Bai Jamjuree','Noto Sans Thai',sans-serif";
  const pairDefs: [string, string, string, string, string][] = [
    ['on_ac / ac',        get('on_primary','#FFFDF6'),  get('primary','#E8354F'),     'แชร์ผลไปไลน์',       'ปุ่มหลัก · CTA · progress fill'],
    ['ink / card',        get('on_surface','#1C1A17'),  get('surface','#FFFDF6'),     'ข้อความบนการ์ด 123', 'text หลักบนการ์ดและ popup'],
    ['ink / hl',          get('on_surface','#1C1A17'),  get('highlight','#F5E14B'),   'เริ่มตอบ',            'ปุ่ม highlight · ตัวเลือกที่เลือก'],
    ['ink / bg',          get('on_surface','#1C1A17'),  get('background','#F7F1E3'),  'ข้อความบนพื้นแอป',   'body text บน background'],
    ['ac / card',         get('primary','#E8354F'),     get('surface','#FFFDF6'),     'DUO QUIZ · 6 ข้อ',   'label accent · badge · chip สาย'],
    ['ink / accent_soft', get('on_surface','#1C1A17'),  get('accent_soft','#E6F1F5'), 'สายวางแผน',           'axis chip · bg อ่อน'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Color chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8 }}>
        {chips.map(({ name, cssVar, c: col }) => (
          <span key={name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 40, borderRadius: 7, display: 'block', background: col, border: '1px solid rgba(28,26,23,.14)' }} />
            <span style={{ font: `600 10.5px ${bodyFont}`, color: '#16181A' }}>{name}</span>
            <span style={{ font: "500 9px 'JetBrains Mono',monospace", color: '#A0A5AA' }}>{cssVar} · {col}</span>
          </span>
        ))}
      </div>
      {/* Contrast pairs — annotated with element description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pairDefs.map(([pairLabel, fg, bg, sample, usedIn]) => {
          const ratio = contrastRatio(fg, bg);
          const ok = ratio >= 4.5, warn = ratio >= 3;
          const verdict = ok ? 'AA' : warn ? 'ตัวใหญ่' : 'ไม่ผ่าน';
          const vBg = ok ? '#1F7A6F' : warn ? '#B07B12' : '#C0392B';
          return (
            <span key={pairLabel} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px 10px', borderRadius: 9, background: bg, border: '1px solid rgba(28,26,23,.13)' }}>
              <span style={{ font: "500 9px 'JetBrains Mono',monospace", color: fg, opacity: 0.5 }}>{pairLabel} → {usedIn}</span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: `600 13px ${bodyFont}`, color: fg }}>{sample}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ font: "600 9.5px 'JetBrains Mono',monospace", color: fg, opacity: 0.7 }}>{ratio.toFixed(2)}:1</span>
                  <span style={{ font: "700 9.5px 'JetBrains Mono',monospace", padding: '2px 6px', borderRadius: 4, color: '#FFFFFF', background: vBg }}>{verdict}</span>
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TypeSpecimen({ fontDisplay, fontBody, fontAccent, surface, onSurface }: {
  fontDisplay?: string; fontBody?: string; fontAccent?: string; surface?: string; onSurface?: string;
}) {
  const fd  = fontDisplay || 'Bangers';
  const fb  = fontBody    || 'Bai Jamjuree';
  const fa  = fontAccent  || 'Gloria Hallelujah';
  const surf = surface    || '#FFFDF6';
  const ink  = onSurface  || '#1C1A17';
  const disp = `'${fd}','Noto Sans Thai',sans-serif`;
  const body = `'${fb}','Noto Sans Thai',sans-serif`;
  const acc  = `'${fa}','Noto Sans Thai',sans-serif`;
  const rows: [string, string, number, number, string][] = [
    ['display · 38px (survival)', disp, 700, 38, '12 วัน'],
    ['display · 22px (en name)',  disp, 700, 22, 'THE SCOUT'],
    ['body · 20px (heading)',     body, 700, 20, 'ไฟดับทั้งเมือง 3 วัน สิ่งแรกที่คุณทำคือ?'],
    ['body · 14px (option)',      body, 500, 14, 'โทรตามเพื่อนในทีมให้มารวมกัน 0123456789'],
    ['body · 11px (meta)',        body, 600, 11, '6 ข้อ · 1 นาที · 5 สาย'],
    ['accent · 13px (note)',      acc,  400, 13, 'ตอบ 6 ข้อ ไม่ถึงนาที'],
  ];
  return (
    <div style={{ padding: '4px 14px 12px', borderRadius: 10, background: surf, border: '1px solid #E7E7E3' }}>
      {rows.map(([metaLabel, fam, weight, size, sample]) => (
        <span key={metaLabel} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 0', borderBottom: '1px dashed rgba(107,101,92,.25)' }}>
          <span style={{ font: "500 9.5px 'JetBrains Mono',monospace", color: '#A0A5AA' }}>{metaLabel}</span>
          <span style={{ font: `${weight} ${size}px/1.35 ${fam}`, color: ink, wordBreak: 'break-word' } as React.CSSProperties}>{sample}</span>
        </span>
      ))}
    </div>
  );
}

function ShapeSpecimen({ colors, fontBody, fontDisplay, radius, cardRadius, borderWidth, shadowOffset, shadow, progressStyle, progressRadius, axisChipRadius, badgeRadius, tilt, texture }: {
  colors?: Record<string, string>;
  fontBody?: string; fontDisplay?: string;
  radius?: number; cardRadius?: number; borderWidth?: number; shadowOffset?: number; shadow?: string; progressStyle?: string; progressRadius?: number; axisChipRadius?: number; badgeRadius?: number; tilt?: string; texture?: string;
}) {
  const get = (k: string, def: string) => (colors as any)?.[k] || def;
  const primary   = get('primary',    '#E8354F');
  const onPrimary = get('on_primary', '#FFFDF6');
  const bg        = get('background', '#F7F1E3');
  const surface   = get('surface',    '#FFFDF6');
  const onSurface = get('on_surface', '#1C1A17');
  const highlight = get('highlight',  '#F5E14B');
  const accentSoft = get('accent_soft', '#E6F1F5');
  const fb  = fontBody    || 'Bai Jamjuree';
  const fd  = fontDisplay || 'Bangers';
  const bw  = borderWidth  ?? 2;
  const so  = shadowOffset ?? 4;
  const cr  = cardRadius   ?? 16;
  const r   = radius       ?? 13;
  const body = `'${fb}','Noto Sans Thai',sans-serif`;
  const disp = `'${fd}','Noto Sans Thai',sans-serif`;
  const bd  = `${bw}px solid ${onSurface}`;
  const bd2 = `${bw}px solid ${onSurface}`;
  const sh  = shadow === 'none' ? 'none'
    : shadow === 'soft' ? `0 ${(so / 2 + 2)}px ${(so * 2 + 8)}px rgba(28,26,23,.18)`
    : `${so}px ${so + 1}px 0 ${onSurface}`;
  const sh2 = sh;
  const optKeyStyle: React.CSSProperties = { width: 26, height: 26, flex: 'none', border: bd2, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: disp, fontSize: 14, background: surface };
  const optTextStyle: React.CSSProperties = { font: `500 14px/1.7 ${body}`, textAlign: 'left', color: onSurface } as React.CSSProperties;
  const tiltDeg = tilt === 'off' || !tilt ? 0 : tilt === 'subtle' ? 0.6 : 1.4;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '20px 18px', borderRadius: 10, background: bg, border: '1px solid #E7E7E3', ...(texture === 'paper' ? { backgroundImage: 'repeating-linear-gradient(120deg,rgba(0,0,0,.05) 0 2px,transparent 2px 5px)' } : {}) }}>
      {/* Card */}
      <span style={{ display: 'block', background: surface, border: bd, borderRadius: cr, padding: 16, boxShadow: sh, transform: tiltDeg ? `rotate(-${tiltDeg}deg)` : undefined }}>
        <span style={{ display: 'block', font: `700 11px/1 ${body}`, letterSpacing: '.1em', color: primary }}>DUO QUIZ · 6 ข้อ</span>
        <span style={{ display: 'block', font: `700 20px/1.35 ${body}`, color: onSurface, marginTop: 12 }}>การ์ดจริงของ LIFF</span>
        <span style={{ display: 'flex', gap: 12, marginTop: 12, font: `600 11px/1.5 ${body}`, color: 'rgba(28,26,23,.45)' } as React.CSSProperties}>
          <span>6 ข้อ</span><span>·</span><span>1 นาที</span>
        </span>
      </span>
      {/* Button highlight */}
      <span style={{ display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '15px 20px', background: highlight, color: onSurface, border: bd, borderRadius: r, font: `700 17px/1 ${body}`, boxShadow: sh } as React.CSSProperties}>เริ่มตอบ</span>
      {/* Button accent */}
      <span style={{ display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: 16, background: primary, color: onPrimary, border: bd, borderRadius: r, font: `700 18px/1 ${body}`, boxShadow: sh } as React.CSSProperties}>แชร์ผลไปไลน์</span>
      {/* Option row normal */}
      <span style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 56, borderRadius: r, padding: '0 12px', background: surface, border: bd2, boxShadow: sh2 }}>
        <span style={optKeyStyle}>A</span>
        <span style={optTextStyle}>ตัวเลือก 56px</span>
      </span>
      {/* Option row selected */}
      <span style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 56, borderRadius: r, padding: '0 12px', background: highlight, border: bd, boxShadow: `3px 4px 0 ${onSurface}` }}>
        <span style={optKeyStyle}>B</span>
        <span style={optTextStyle}>ตัวเลือกที่ถูกเลือก</span>
      </span>

      {/* Result frames — solo / pair / group */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ font: `600 9px/1 'JetBrains Mono',monospace`, color: `${onSurface}66`, letterSpacing: '.07em' }}>RESULT FRAMES · SOLO / PAIR / GROUP</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {/* Solo */}
          <span style={{ flex: 1, aspectRatio: '3/4', border: bd2, borderRadius: Math.min(cr, 12), background: `${highlight}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ font: `700 9px 'JetBrains Mono',monospace`, color: `${onSurface}66` }}>SOLO</span>
          </span>
          {/* Pair — 2 cards side by side */}
          <span style={{ flex: 1, display: 'flex', gap: 4 }}>
            {['ME','BDY'].map(l => (
              <span key={l} style={{ flex: 1, aspectRatio: '3/4', border: bd2, borderRadius: Math.min(cr, 10), background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ font: `700 8px 'JetBrains Mono',monospace`, color: `${onSurface}55` }}>{l}</span>
              </span>
            ))}
          </span>
          {/* Group — 3×2 grid */}
          <span style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 3 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} style={{ border: bd2, borderRadius: 4, background: i < 5 ? `${primary}18` : `${onSurface}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
                {i < 5 ? '👤' : '+'}
              </span>
            ))}
          </span>
        </span>
      </span>

      {/* Pair log item */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ font: `600 9px/1 'JetBrains Mono',monospace`, color: `${onSurface}66`, letterSpacing: '.07em' }}>PAIR LOG · GROUP LIST</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: surface, border: bd2, borderRadius: cr, boxShadow: sh2 }}>
          <span style={{ width: 38, height: 38, flexShrink: 0, border: bd2, borderRadius: Math.min(r, 10), background: `${highlight}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ font: `700 13px/1.3 ${body}`, color: onSurface }}>มีน</span>
            <span style={{ font: `500 11px/1.4 ${body}`, color: `${onSurface}55` }}>สายเอาตัวรอด × สายวางแผน</span>
          </span>
          <span style={{ font: `700 12px/1 ${body}`, color: primary, flexShrink: 0 }}>12 วัน</span>
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: surface, border: `${bw}px solid ${onSurface}33`, borderRadius: cr, boxShadow: sh2 }}>
          <span style={{ width: 38, height: 38, flexShrink: 0, border: `${bw}px solid ${onSurface}22`, borderRadius: Math.min(r, 10), background: `${onSurface}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ font: `700 13px/1.3 ${body}`, color: onSurface }}>ต้าร์</span>
            <span style={{ font: `500 11px/1.4 ${body}`, color: `${onSurface}55` }}>สายเอาตัวรอด</span>
          </span>
          <span style={{ font: `600 12px/1 ${body}`, color: `${onSurface}44`, flexShrink: 0 }}>รอคู่หู...</span>
        </span>
      </span>

      {/* Symbol grid */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ font: `600 9px/1 'JetBrains Mono',monospace`, color: `${onSurface}66`, letterSpacing: '.07em' }}>SYMBOL GRID</span>
        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[true, true, false].map((unlocked, i) => (
            <span key={i} style={{ aspectRatio: '1', border: unlocked ? bd : `${bw}px dashed ${onSurface}33`, borderRadius: Math.min(cr, 12), background: unlocked ? `${highlight}44` : `${onSurface}06`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {unlocked ? '🔓' : '🔒'}
            </span>
          ))}
        </span>
      </span>

      {/* Progress bar (Loading / Matching / Group Result) */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ font: `600 10.5px ${body}`, letterSpacing: '.04em', textTransform: 'uppercase', color: 'rgba(28,26,23,.45)' } as React.CSSProperties}>Progress Bar</span>
        <span style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 12, border: bd2, borderRadius: progressRadius ?? 8, overflow: 'hidden', background: surface }}>
          <span style={{ display: 'block', height: '100%', width: progressStyle === 'compact' ? '45%' : '82%', background: progressStyle === 'bar' ? primary : `repeating-linear-gradient(115deg,${primary} 0 10px,${highlight} 10px 18px)` }} />
        </span>
      </span>
      {/* Axis chips (Pair Result) */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ font: `600 10.5px ${body}`, letterSpacing: '.04em', textTransform: 'uppercase', color: 'rgba(28,26,23,.45)' } as React.CSSProperties}>Axis Chips</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, border: bd2, borderRadius: axisChipRadius ?? 11, padding: 9, background: accentSoft, boxSizing: 'border-box' }}>
            <span style={{ font: `600 9.5px ${body}`, color: 'rgba(28,26,23,.5)' } as React.CSSProperties}>มึน</span>
            <span style={{ font: `700 12px ${body}`, color: onSurface } as React.CSSProperties}>สายวางแผน</span>
          </span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, border: bd2, borderRadius: axisChipRadius ?? 11, padding: 9, background: highlight, boxSizing: 'border-box' }}>
            <span style={{ font: `600 9.5px ${body}`, color: 'rgba(28,26,23,.5)' } as React.CSSProperties}>คุณ</span>
            <span style={{ font: `700 12px ${body}`, color: onSurface } as React.CSSProperties}>สายเอาตัวรอด</span>
          </span>
        </span>
      </span>
      {/* Badge (Invited / Summary / Pair Result / Question / Group Result) */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ font: `600 10.5px ${body}`, letterSpacing: '.04em', textTransform: 'uppercase', color: 'rgba(28,26,23,.45)' } as React.CSSProperties}>Badge</span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-block', background: highlight, border: bd2, borderRadius: badgeRadius ?? 0, padding: '2px 9px', font: `700 14px ${disp}` } as React.CSSProperties}>คำเชิญ!</span>
          <span style={{ display: 'inline-block', background: highlight, border: bd2, borderRadius: badgeRadius ?? 0, padding: '1px 7px', font: `700 9.5px ${body}` } as React.CSSProperties}>VALID</span>
          <span style={{ display: 'inline-block', background: highlight, border: bd2, borderRadius: badgeRadius ?? 0, padding: '3px 10px', font: `700 11px ${body}` } as React.CSSProperties}>คู่นี้รอดได้</span>
          <span style={{ display: 'inline-block', background: highlight, border: bd2, borderRadius: badgeRadius ?? 0, padding: '1px 8px', font: `700 11px ${body}` } as React.CSSProperties}>50%</span>
          <span style={{ display: 'inline-block', background: highlight, border: bd2, borderRadius: badgeRadius ?? 0, padding: '3px 9px', font: `700 10.5px ${body}` } as React.CSSProperties}>ดูผลคู่ →</span>
        </span>
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

// ── Block item type ────────────────────────────────────────────────────────
interface BlockItem {
  id: string; uid: string; show: boolean; geo: Record<string, string|number>;
  /** Free-floating position within the phone canvas. Absent = flows in document order. */
  pos?: { x: number; y: number; w: number };
  /** Per-family layout variant, e.g. { pair: 'tilt' } — which visual arrangement this block uses. */
  pat?: Record<string, string>;
  /** Per-channel data source (text/image/list) — where this block's content comes from. */
  src?: Record<string, Record<string, any>>;
}

/**
 * Slots that exist on a screen shared across modes (e.g. Summary shows in
 * solo/pair/group) but whose data only exists for some of those modes.
 * Omit an entry to mean "available in every mode".
 */
const SLOT_SCOPE: Record<string, string[]> = {
  teamSection: ['group'],        // bind: GET /api/group/my-groups — group mode only
  symbolsRow:  ['group'],        // routes to the Symbols screen, which is group-only
  pairLog:     ['pair','group'], // bind: summary.pairs[] — solo never pairs
};

function defaultLayout(k: string, mode: string): BlockItem[] {
  const s = SCREENS_V3.find(x => x.k === k);
  return (s?.slots ?? [])
    .filter(id => (SLOT_SCOPE[id] ?? ALL_MODES).includes(mode))
    .map(id => ({ id, uid: id, show: true, geo: {} }));
}

export default function LiffSection({ appearance, brand, copy, mode, axes = [], questions = [], results = {}, group, onChange, onCopyChange }: Props) {
  // ── State ────────────────────────────────────────────────────────────────
  const [section, setSection]             = useState('color');
  const [screen, setScreen]               = useState('Intro');
  const [pane, setPaneRaw]                = useState<'specimen'|'preview'|'json'>('specimen');
  const [view, setView]                   = useState<'fields'|'props'|'add'|'art'>('fields');
  const [sel, setSel]                     = useState<string>('');
  const [drag, setDrag]                   = useState<{ uid?: string; newSlot?: string } | null>(null);
  const [over, setOver]                   = useState<string|null>(null);
  const [cfgW, setCfgW]                   = useState(440);
  const [resizing, setResizing]           = useState(false);
  const [layouts, setLayouts]             = useState<Record<string, BlockItem[]>>({});
  const [snap, setSnap]                   = useState(true);
  const [blockCopy, setBlockCopy]         = useState<Record<string, string>>({});
  const [blockImages, setBlockImages]     = useState<Record<string, string>>({});
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
  const [uploadErrors, setUploadErrors]   = useState<Record<string, string>>({});
  const [copyMsg, setCopyMsg]             = useState('');
  const [uploadedFonts, setUploadedFonts] = useState<string[]>([]);
  const fontFileRef = useRef<HTMLInputElement>(null);
  const imgFileRef  = useRef<HTMLInputElement>(null);
  const [fontTarget, setFontTarget] = useState<string|null>(null);
  const [imgTarget,  setImgTarget]  = useState<string|null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isScreenSection = section.startsWith('screen:');
  const liffSize   = (appearance as any).liff_size as string || 'full';
  const vpH        = liffSize === 'compact' ? 421 : liffSize === 'tall' ? 632 : 812;
  const colors     = (appearance.colors ?? {}) as Record<string, string>;
  const accentSoft = colors.accent_soft || '#E6F1F5';
  const primaryColor = colors.primary || brand.primary || '#E8354F';
  const oaTitle    = (appearance as any).oa_title || brand.name || 'LIFF Preview';
  const visibleScreens = SCREENS_V3.filter(s => s.modes.includes(mode));

  const pane_ = pane;
  const setPane = (p: 'specimen'|'preview'|'json') => { setPaneRaw(p); };

  // ── Computed tokens (mirroring prototype T()) ─────────────────────────────
  const tok = {
    primary:    primaryColor,
    onPrimary:  colors.on_primary  || '#FFFDF6',
    bg:         colors.background  || '#F7F1E3',
    card:       colors.surface     || '#FFFDF6',
    ink:        colors.on_surface  || '#1C1A17',
    ink2:       colors.muted       || '#6B655C',
    ink3:       'rgba(28,26,23,.4)',
    hl:         colors.highlight   || '#F5E14B',
    accent:     colors.accent      || '#7AC4D6',
    soft:       accentSoft,
    danger:     (colors as any).danger     || '#C0392B',
    line:       (colors as any).line_green || '#06C755',
    shadow:     appearance.shadow          || 'hard',
    tilt:       appearance.tilt            || 'off',
    texture:    appearance.texture         || 'none',
    artShape:   (appearance as any).art_shape || 'card',
    artFrame:   (appearance as any).art_frame || 'outline',
    artHero:    (appearance as any).art_hero  || 'pair',
    fontDisplay: appearance.font_display || 'Bangers',
    fontBody:    appearance.font_body    || 'Bai Jamjuree',
    fontAccent:  appearance.font_accent  || 'Gloria Hallelujah',
    scale:       appearance.font_scale   ?? 1,
    cardR:       (appearance as any).card_radius ?? 16,
    radius:      appearance.radius       ?? 13,
    borderW:     appearance.border_width ?? 2.5,
    offset:      appearance.shadow_offset ?? 4,
    progressStyleLoading:  (appearance as any).progress_style_loading  || 'default',
    progressStyleQuestion: (appearance as any).progress_style_question || 'default',
    progressStyleMatching: (appearance as any).progress_style_matching || 'default',
    progressStyleGroup:    (appearance as any).progress_style_group    || 'default',
    progressRadius: (appearance as any).progress_radius  ?? 8,
    axisChipRadius: (appearance as any).axis_chip_radius ?? 11,
    badgeRadius:    (appearance as any).badge_radius     ?? 0,
    groupHeroPattern: (appearance as any).group_hero_pattern || 'fan',
  };
  const tokC = (() => {
    const { shadow, offset, ink, fontBody, fontDisplay, fontAccent, scale, cardR, radius, borderW } = tok;
    const sh = shadow === 'none' ? 'none'
      : shadow === 'soft' ? `0 ${(offset/2+2)}px ${(offset*2+8)}px rgba(28,26,23,.18)`
      : `${offset}px ${offset+1}px 0 ${ink}`;
    const sh2 = sh;
    const tiltDeg = tok.tilt === 'off' ? 0 : tok.tilt === 'subtle' ? 0.6 : 1.4;
    const bd = `${borderW}px solid ${ink}`;
    const bd2 = `${borderW}px solid ${ink}`;
    const px = (n: number) => `${Math.round(n * scale)}px`;
    const fb = `'${fontBody}','Noto Sans Thai',sans-serif`;
    const fd = `'${fontDisplay}','Noto Sans Thai',sans-serif`;
    return { sh, sh2, bd, bd2, tiltDeg, px, fb, fd, cardR, radius };
  })();

  const artStyle = (w: number, bg: string, extra?: string): string => {
    const A = ART_SHAPES[tok.artShape] || ART_SHAPES.card;
    if (tok.artShape === 'none') return 'display:none';
    const frame = tok.artFrame === 'flat' ? '' : tok.artFrame === 'soft'
      ? 'box-shadow:0 4px 10px rgba(28,26,23,.2);'
      : `border:2px solid ${tok.ink};`;
    return `display:block;flex:none;width:${w}px;height:${Math.round(w*A.r)}px;border-radius:${Math.min(A.radius,w)}px;background:${bg};${frame}${extra||''}`;
  };

  // ── Layout helpers ────────────────────────────────────────────────────────

  // Hydrate layouts from saved screen_config on mount (only once)
  useEffect(() => {
    const sc = appearance.screen_config as Record<string, { blocks?: BlockItem[] }> | undefined;
    if (!sc) return;
    const init: Record<string, BlockItem[]> = {};
    for (const [k, v] of Object.entries(sc)) {
      if (Array.isArray(v?.blocks) && v.blocks.length) init[k] = v.blocks;
    }
    if (Object.keys(init).length) setLayouts(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLayout = (k: string) => layouts[k] || defaultLayout(k, mode);

  const setLayout = (k: string, list: BlockItem[]) => {
    setLayouts(prev => {
      const next = { ...prev, [k]: list };
      // Merge Layout Editor blocks into screen_config (preserving any other keys)
      const sc: Record<string, unknown> = { ...(appearance.screen_config ?? {}) };
      for (const [key, blocks] of Object.entries(next)) {
        sc[key] = { blocks };
      }
      onChange({ ...appearance, screen_config: sc });
      return next;
    });
  };

  const curLayout = getLayout(screen);

  const moveBlock = (fromUid: string, toUid: string | null) => {
    const list = [...curLayout];
    const from = list.findIndex(x => x.uid === fromUid);
    if (from < 0) return;
    const [item] = list.splice(from, 1);
    const to = toUid ? list.findIndex(x => x.uid === toUid) : list.length;
    list.splice(to < 0 ? list.length : to, 0, item);
    setLayout(screen, list);
  };

  const insertBlock = (slotId: string, toUid: string | null) => {
    const list = [...curLayout];
    const uid = `${slotId}_${Math.random().toString(36).slice(2,6)}`;
    const to = toUid ? list.findIndex(x => x.uid === toUid) : list.length;
    list.splice(to < 0 ? list.length : to, 0, { id: slotId, uid, show: true, geo: {} });
    setLayout(screen, list);
    setSel(uid);
  };

  const updateBlockGeo = (uid: string, gk: string, v: string|number) => {
    setLayout(screen, curLayout.map(b => b.uid === uid ? { ...b, geo: { ...b.geo, [gk]: v } } : b));
  };

  /** Every pos/src/pat setter writes onto the BlockItem itself, via setLayout —
   *  same persistence path as geo, so these survive reload/save like everything else. */
  const updateBlock = (uid: string, patch: (b: BlockItem) => Partial<BlockItem>) =>
    setLayout(screen, curLayout.map(b => b.uid === uid ? { ...b, ...patch(b) } : b));

  const updatePat = (uid: string, fam: string, val: string) =>
    updateBlock(uid, b => ({ pat: { ...(b.pat ?? {}), [fam]: val } }));

  const srcOf = (b: BlockItem, ch: string): Record<string, any> => ({
    ...DEFAULT_SRC[ch], ...(b.src?.[ch] ?? {}),
  });

  const setSrcOf = (b: BlockItem, ch: string, patch: Record<string, any>) =>
    updateBlock(b.uid, cur => ({
      src: { ...(cur.src ?? {}), [ch]: { ...DEFAULT_SRC[ch], ...(cur.src?.[ch] ?? {}), ...patch } },
    }));

  const posOf   = (b: BlockItem) => b.pos;
  const isFloat = (b: BlockItem) => !!b.pos;

  const setFloat = (b: BlockItem) => updateBlock(b.uid, () => ({ pos: DEFAULT_POS }));
  const setFlow  = (b: BlockItem) => updateBlock(b.uid, () => ({ pos: undefined }));
  const updatePosField = (b: BlockItem, field: 'x'|'y'|'w', val: number) =>
    updateBlock(b.uid, cur => ({ pos: { ...(cur.pos ?? DEFAULT_POS), [field]: val } }));

  /**
   * Rows for the data-source preview. Prefers the real campaign data set in the
   * ข้อมูล tab (axes/results/group.archetypes) over the SAMPLE mock, falling back
   * to SAMPLE only when that step hasn't been filled in yet. `members`/`pairs` have
   * no ข้อมูล-tab equivalent — they're live roster/pairing data computed at runtime —
   * so they always preview with SAMPLE.
   */
  const sampleRows = (rows: string): Record<string, any>[] => {
    if (rows === 'axes') return axes.length ? axes : SAMPLE.axes;
    if (rows === 'results') { const vals = Object.values(results); return vals.length ? vals : SAMPLE.results; }
    if (rows === 'group') { const arch = group?.archetypes ?? []; return arch.length ? arch : SAMPLE.group; }
    if (rows === 'pairs') return SAMPLE.pairs;
    return SAMPLE.members;
  };

  const resolveText = (b: BlockItem): { bound: boolean; path: string; value: string; ok: boolean } => {
    const s = srcOf(b, 'text');
    if (s.mode === 'manual') return { bound: false, path: '', value: '', ok: false };
    if (s.mode === 'copy') {
      const v = blockCopy[s.key] ?? DEFAULT_COPY[s.key] ?? '';
      return { bound: true, path: `copy['${s.key}']`, value: v, ok: !!v };
    }
    const def = SRC_TEXT.find(x => x.k === s.mode);
    if (!def || !(def.scope ?? ALL_MODES).includes(mode)) return { bound: false, path: '', value: '', ok: false };
    const rows = sampleRows(s.mode === 'group' ? 'group' : s.mode);
    const row = rows[Math.min(s.idx ?? 0, rows.length - 1)] ?? {};
    const v = (row as any)[s.field] ?? '';
    return { bound: true, path: def.path.replace('[i]', `[${s.idx ?? 0}]`) + '.' + s.field, value: v, ok: !!v };
  };

  const resolveImage = (b: BlockItem): { bound: boolean; path: string; url: string; ok: boolean } => {
    const s = srcOf(b, 'image');
    if (s.mode === 'fixed') return { bound: false, path: '', url: '', ok: false };
    const def = SRC_IMG.find(x => x.k === s.mode);
    if (!def || !def.rows || !(def.scope ?? ALL_MODES).includes(mode)) return { bound: false, path: '', url: '', ok: false };
    const rows = sampleRows(def.rows);
    const row = rows[Math.min(s.idx ?? 0, rows.length - 1)] ?? {};
    const url = (row as any)[def.field] ?? '';
    return { bound: true, path: def.rows + `[${s.idx ?? 0}].${def.field}`, url, ok: !!url };
  };

  const resolveList = (b: BlockItem): { bound: boolean; path: string; rows: any[] } => {
    const s = srcOf(b, 'list');
    const def = SRC_LIST.find(x => x.k === s.mode);
    if (!def || !(def.scope ?? ALL_MODES).includes(mode)) return { bound: false, path: '', rows: [] };
    const rowsAll = sampleRows(s.mode);
    const count = Math.min(s.count ?? 3, rowsAll.length);
    return { bound: true, path: def.path, rows: rowsAll.slice(0, count) };
  };

  /** Pick a (primary, secondary) display pair out of a list row — shape differs per source. */
  const listRowText = (srcMode: string, row: any): { primary: string; secondary: string } => {
    switch (srcMode) {
      case 'axes':    return { primary: row.label ?? '', secondary: row.body ?? '' };
      case 'results': return { primary: row.title ?? '', secondary: row.body ?? '' };
      case 'group':   return { primary: row.title ?? '', secondary: row.body ?? '' };
      case 'members': return { primary: row.name ?? '', secondary: row.axis ?? '' };
      case 'pairs':   return { primary: row.name ?? '', secondary: row.axis ?? '' };
      default:        return { primary: '', secondary: '' };
    }
  };

  /** Compute effective copy: persisted campaign copy as base, local edits + bound text sources on top */
  const effectiveCopy = (() => {
    const out = { ...copy, ...blockCopy };
    for (const b of curLayout) {
      const s = srcOf(b, 'text');
      if (s.mode === 'manual') continue;
      const primaryCopyKey = SLOTS[b.id]?.copy?.[0]?.[0] ?? (b.id === 'xText' ? 'x_text' : null);
      if (!primaryCopyKey) continue;
      const r = resolveText(b);
      if (r.ok) { out[primaryCopyKey] = r.value; }
      else {
        const fb = s.fallback;
        if (fb === 'placeholder') out[primaryCopyKey] = `⛓ ${r.path}`;
        else if (fb === 'hide') out[primaryCopyKey] = '';
      }
    }
    return out;
  })();

  /** Compute effective images: persisted appearance.images as base, overridden by local blockImages (blob/new uploads) */
  const effectiveImages = (() => {
    const out = { ...(appearance.images ?? {}), ...blockImages };
    for (const b of curLayout) {
      if (!(CH_OF[b.id] ?? []).includes('image')) continue;
      const s = srcOf(b, 'image');
      if (s.mode === 'fixed') continue;
      const imgKey = SLOTS[b.id]?.img;
      if (!imgKey) continue;
      const r = resolveImage(b);
      if (r.ok) out[imgKey] = r.url;
    }
    return out;
  })();

  const geoVal = (b: BlockItem, k: string): string|number => b.geo[k] !== undefined ? b.geo[k] : DEFAULT_GEO[k];
  const cpVal  = (k: string) => (copy[k] || blockCopy[k] || DEFAULT_COPY[k] || '');

  /** uid-keyed pos/pat for LayoutEditor */
  const editorPos: Record<string, { x: number; y: number; w: number }> = {};
  const editorPat: Record<string, Record<string, string>> = {};
  for (const b of curLayout) {
    if (b.pos) editorPos[b.uid] = b.pos;
    if (b.pat) editorPat[b.uid] = b.pat;
  }

  // ── Resize grip ───────────────────────────────────────────────────────────
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = cfgW;
    setResizing(true);
    document.body.style.userSelect = 'none';
    const move = (ev: MouseEvent) => setCfgW(Math.max(268, Math.min(680, startW - (ev.clientX - startX))));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
      setResizing(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // ── AppearanceConfig helpers ──────────────────────────────────────────────
  const set = <K extends keyof AppearanceConfig>(k: K, v: AppearanceConfig[K]) => onChange({ ...appearance, [k]: v });
  const setColor = (k: string, v: string) => onChange({ ...appearance, colors: { ...(appearance.colors ?? {}), [k]: v } as AppearanceConfig['colors'] });
  const setAppImage = (k: string, v: string) => onChange({ ...appearance, images: { ...(appearance.images ?? {}), [k]: v } });
  const setAppCopy  = (k: string, v: string) => onCopyChange({ ...copy, [k]: v });
  const c = (k: string, fb?: string) => copy[k] ?? fb ?? '';

  const pickerColors: PickerColors = {
    primary: primaryColor, highlight: colors.highlight || '#F5E14B',
    surface: colors.surface || '#FFFDF6', background: colors.background || '#F7F1E3', accentSoft,
  };

  // ── Font loading ─────────────────────────────────────────────────────────
  const loadFont = useCallback((name: string) => {
    const f = FONTS.find(x => x.name === name);
    if (!f || !f.g) return;
    const id = 'gf-' + f.g;
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`;
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    [appearance.font_display, appearance.font_body, appearance.font_accent].forEach(f => f && loadFont(f));
  }, []); // eslint-disable-line

  // Seed blockImages from persisted appearance.images on mount
  useEffect(() => {
    if (appearance.images && Object.keys(appearance.images).length > 0) {
      setBlockImages(prev => ({ ...appearance.images as Record<string, string>, ...prev }));
    }
  }, []); // eslint-disable-line

  // ── Font file upload ─────────────────────────────────────────────────────
  const onFontFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = fontTarget;
    if (!file || !key) return;
    const name = file.name.replace(/\.(woff2?|ttf|otf)$/i, '');
    const face = new (window as any).FontFace(name, `url(${URL.createObjectURL(file)})`);
    face.load().then((f: any) => {
      (document as any).fonts.add(f);
      setUploadedFonts(prev => prev.includes(name) ? prev : [...prev, name]);
      set(key as any, name);
      setFontTarget(null);
    });
    e.target.value = '';
  };

  // ── Image file upload ─────────────────────────────────────────────────────
  const onImgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = imgTarget;
    e.target.value = '';
    if (!file || !key) return;
    // Show blob preview immediately while uploading
    const blobUrl = URL.createObjectURL(file);
    setBlockImages(prev => ({ ...prev, [key]: blobUrl }));
    setUploadErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    setUploadingKeys(prev => new Set([...prev, key]));
    setImgTarget(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
      const data = await res.json() as { ok?: boolean; url?: string; error?: { message?: string } };
      if (res.ok && data.url) {
        setBlockImages(prev => ({ ...prev, [key]: data.url! }));
        setAppImage(key, data.url!);
      } else {
        setUploadErrors(prev => ({ ...prev, [key]: data.error?.message || 'อัปโหลดไม่สำเร็จ' }));
      }
    } catch (err) {
      setUploadErrors(prev => ({ ...prev, [key]: 'เชื่อมต่อไม่สำเร็จ' }));
    } finally {
      setUploadingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const requestImgUpload = (key: string) => { setImgTarget(key); imgFileRef.current?.click(); };

  // ── Nav click ─────────────────────────────────────────────────────────────
  const handleAppearanceClick = (key: string) => {
    setSection(key);
    setPaneRaw('specimen');
  };

  const handleScreenClick = (k: string) => {
    setSection(`screen:${k}`);
    setScreen(k);
    setPaneRaw('preview');
    setView('fields');
    const l = getLayout(k);
    setSel(l[0]?.uid || '');
  };

  // ── Section renderers ─────────────────────────────────────────────────────

  const renderLiff = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Campaign Mode" path="mode">
        <SegInput
          value={mode}
          options={[{ v:'pair', label:'pair' }, { v:'group', label:'group' }, { v:'solo', label:'solo' }, { v:'mbti', label:'mbti' }]}
          onChange={() => {}}
        />
      </Field>
      <Field label="LIFF ID" path="liff_id">
        <TextInput value={appearance.liff_id || ''} onChange={v => set('liff_id', v)} placeholder="2011037337-xxxxxxxx" />
      </Field>
      <Field label="Endpoint URL" path="liff.endpoint">
        <TextInput value={(appearance as any).endpoint || ''} onChange={v => onChange({ ...appearance, endpoint: v } as any)} placeholder="https://liff.line.me/..." />
      </Field>
      <Field label="OA ID" path="liff.oa_id">
        <TextInput value={appearance.oa_id || ''} onChange={v => set('oa_id', v)} placeholder="@xxxxxxxx" />
      </Field>
      <Field label="OA Title" path="liff.title">
        <TextInput value={oaTitle} onChange={v => onChange({ ...appearance, oa_title: v } as any)} placeholder={brand.name || 'LIFF Preview'} />
      </Field>
    </div>
  );

  // Effective color: explicit value if set, else fallback from tok (mirrors specimen)
  const effectiveColor = (k: string): string => {
    if (colors[k]) return colors[k];
    const fallbacks: Record<string, string> = {
      primary:     tok.primary,
      on_primary:  tok.onPrimary,
      background:  tok.bg,
      surface:     tok.card,
      on_surface:  tok.ink,
      muted:       tok.ink2,
      highlight:   tok.hl,
      accent:      tok.accent,
      accent_soft: tok.soft,
      line_green:  tok.line,
      danger:      tok.danger,
    };
    return fallbacks[k] || '';
  };

  const renderColor = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {COLOR_FIELDS.map(([k, cssVar, label, hint]) => (
        <Field key={k} label={label} path={cssVar}>
          <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, marginBottom: 2 }}>{hint}</div>
          <ColorInput value={effectiveColor(k)} onChange={v => setColor(k, v)} />
        </Field>
      ))}
    </div>
  );

  const renderType = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Display Font" path="font.display">
        <FontInput
          value={appearance.font_display || ''}
          onChange={v => { set('font_display', v); loadFont(v); }}
          sample="12 วัน · SURVIVOR"
          uploadedFonts={uploadedFonts}
          onUploadRequest={() => { setFontTarget('font_display'); fontFileRef.current?.click(); }}
        />
      </Field>
      <Field label="Body Font" path="font.body">
        <FontInput
          value={appearance.font_body || ''}
          onChange={v => { set('font_body', v); loadFont(v); }}
          sample="ตอบ 6 ข้อ ไม่ถึงนาที 0123"
          uploadedFonts={uploadedFonts}
          onUploadRequest={() => { setFontTarget('font_body'); fontFileRef.current?.click(); }}
        />
      </Field>
      <Field label="Accent Font" path="font.accent">
        <FontInput
          value={appearance.font_accent || ''}
          onChange={v => { set('font_accent', v); loadFont(v); }}
          sample="78% รอด"
          uploadedFonts={uploadedFonts}
          onUploadRequest={() => { setFontTarget('font_accent'); fontFileRef.current?.click(); }}
        />
      </Field>
      <Field label="Font Scale" path="font.scale">
        <NumInput
          value={appearance.font_scale ?? 1}
          min={0.85} max={1.25} step={0.05} unit="×"
          onChange={v => set('font_scale', v)}
        />
      </Field>
    </div>
  );

  const renderShape = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Collapsible title="Radius">
        <Field label="Card Radius" path="card_radius">
          <NumInput value={(appearance as any).card_radius ?? 16} min={0} max={28} step={1} unit="px" onChange={v => onChange({ ...appearance, card_radius: v } as any)} />
        </Field>
        <Field label="Button Radius" path="radius">
          <NumInput value={appearance.radius ?? 13} min={0} max={28} step={1} unit="px" onChange={v => set('radius', v)} />
        </Field>
        <Field label="Progress Bar Radius" path="progress_radius">
          <NumInput value={(appearance as any).progress_radius ?? 8} min={0} max={20} step={1} unit="px" onChange={v => onChange({ ...appearance, progress_radius: v } as any)} />
          <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, marginTop: 6 }}>ใช้กับแถบโหลดของ Loading, Matching และ Group Result — ส่วนรูปแบบลาย (default/compact/bar) ย้ายไปอยู่ที่ Art Style</div>
        </Field>
        <Field label="Axis Chip Radius" path="axis_chip_radius">
          <NumInput value={(appearance as any).axis_chip_radius ?? 11} min={0} max={28} step={1} unit="px" onChange={v => onChange({ ...appearance, axis_chip_radius: v } as any)} />
          <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, marginTop: 6 }}>กล่องสายฝั่ง Pair Result เท่านั้น (แยกจาก Card/Button Radius)</div>
        </Field>
        <Field label="Badge Radius" path="badge_radius">
          <NumInput value={(appearance as any).badge_radius ?? 0} min={0} max={20} step={1} unit="px" onChange={v => onChange({ ...appearance, badge_radius: v } as any)} />
          <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, marginTop: 6 }}>badge สีไฮไลต์เล็กๆ — "คำเชิญ!" (Invited), "VALID" (Summary), "คู่นี้รอดได้" (Pair Result), "50%" (Question), tag ชื่อสมาชิก (Group Result) — ไม่รวม "2 สายเอาตัวรอด" แบบเม็ดยาที่ Group Result เพราะออกแบบเป็นทรงยาวมนตายตัวอยู่แล้ว</div>
        </Field>
      </Collapsible>
      <Collapsible title="Border & Shadow">
        <Field label="Border Width" path="border_width">
          <NumInput value={appearance.border_width ?? 2.5} min={0} max={5} step={0.5} unit="px" onChange={v => set('border_width', v)} />
        </Field>
        <Field label="Shadow Style" path="shadow">
          <SegInput value={appearance.shadow || 'hard'}
            options={[{ v:'none', label:'none' }, { v:'soft', label:'soft' }, { v:'hard', label:'hard' }]}
            onChange={v => set('shadow', v as any)} />
        </Field>
        <Field label="Shadow Offset" path="shadow_offset">
          <NumInput value={appearance.shadow_offset ?? 4} min={0} max={10} step={1} unit="px" onChange={v => set('shadow_offset', v)} />
        </Field>
      </Collapsible>
      <Collapsible title="Card Feel">
        <Field label="Card Tilt" path="tilt">
          <SegInput value={appearance.tilt || 'off'}
            options={[{ v:'off', label:'off' }, { v:'subtle', label:'subtle' }, { v:'playful', label:'playful' }]}
            onChange={v => set('tilt', v as any)} />
        </Field>
        <Field label="Texture" path="texture">
          <SegInput value={appearance.texture || 'none'}
            options={[{ v:'none', label:'none' }, { v:'paper', label:'paper' }]}
            onChange={v => set('texture', v)} />
        </Field>
      </Collapsible>
    </div>
  );

  const renderArt = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <VisualPicker
        label="Art Shape"
        layoutKey="art_shape"
        currentValue={tok.artShape}
        colors={pickerColors}
        onPick={(k, v) => onChange({ ...appearance, [k]: v } as any)}
        options={[
          ['card',   'การ์ด 3:4',         'แบบไพ่ — เหมาะกับ collectible', ['img:60','text:12']],
          ['circle', 'วงกลม',              'อวาตาร์ / ตราสัญลักษณ์',        ['imgCircle:60','text:12']],
          ['square', 'สี่เหลี่ยมจัตุรัส', 'ภาพถ่าย/ไอคอน',                 ['imgSquare:60','text:12']],
          ['wide',   'แบนเนอร์ 16:9',     'ภาพประกอบแนวนอน',               ['imgWide:40','text:12']],
          ['none',   'ไม่ใช้ภาพ',          'ใช้ตัวอักษร/สีแทน',             ['text:20','text:12']],
        ]}
      />
      <VisualPicker
        label="Art Frame"
        layoutKey="art_frame"
        currentValue={tok.artFrame}
        colors={pickerColors}
        onPick={(k, v) => onChange({ ...appearance, [k]: v } as any)}
        options={[
          ['outline', 'Outline',  'เส้นขอบ + เงาแข็ง ตามธีมเดิม', ['img:60','text:12']],
          ['soft',    'Soft',     'เงานุ่ม ดูโมเดิร์น',            ['img:60','text:12']],
          ['flat',    'Flat',     'ไม่มีกรอบ ปล่อยภาพลอย',         ['img:60','text:12']],
        ]}
      />
      <VisualPicker
        label="Art Hero (Pair Result)"
        layoutKey="art_hero"
        currentValue={tok.artHero}
        colors={pickerColors}
        onPick={(k, v) => onChange({ ...appearance, [k]: v } as any)}
        options={[
          ['pair',   'ภาพ 2 ชิ้นเอียงชนกัน', 'เล่าเรื่อง "คู่" ได้ดี',   ['img:34','img:34']],
          ['single', 'ภาพเดียวกลางจอ',        'ไม่ต้องมี asset ต่อสาย',  ['img:60']],
          ['band',   'แถบสีพร้อมข้อความ',     'ไม่ใช้ภาพเลย',             ['img:40']],
        ]}
      />
      <Field label="Group Hero Pattern" path="group_hero_pattern">
        <SegInput value={(appearance as any).group_hero_pattern || 'fan'}
          options={[{ v:'fan', label:'Fan' }, { v:'grid', label:'Grid' }]}
          onChange={v => onChange({ ...appearance, group_hero_pattern: v } as any)} />
        <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, marginTop: 6 }}>ใช้เฉพาะตอน Group Result reveal = "members" — Fan เหมาะทีมเล็ก, Grid รองรับจำนวนสมาชิกได้กว้างกว่า</div>
      </Field>
      <Collapsible title="Progress Bar Style">
        <Field label="Loading" path="progress_style_loading">
          <SegInput value={(appearance as any).progress_style_loading || 'default'}
            options={[{ v:'default', label:'default' }, { v:'compact', label:'compact' }, { v:'bar', label:'bar' }]}
            onChange={v => onChange({ ...appearance, progress_style_loading: v } as any)} />
        </Field>
        <Field label="Question" path="progress_style_question">
          <SegInput value={(appearance as any).progress_style_question || 'default'}
            options={[{ v:'default', label:'default' }, { v:'compact', label:'compact' }, { v:'bar', label:'bar' }]}
            onChange={v => onChange({ ...appearance, progress_style_question: v } as any)} />
        </Field>
        <Field label="Matching" path="progress_style_matching">
          <SegInput value={(appearance as any).progress_style_matching || 'default'}
            options={[{ v:'default', label:'default' }, { v:'compact', label:'compact' }, { v:'bar', label:'bar' }]}
            onChange={v => onChange({ ...appearance, progress_style_matching: v } as any)} />
        </Field>
        <Field label="Group Result" path="progress_style_group">
          <SegInput value={(appearance as any).progress_style_group || 'default'}
            options={[{ v:'default', label:'default' }, { v:'compact', label:'compact' }, { v:'bar', label:'bar' }]}
            onChange={v => onChange({ ...appearance, progress_style_group: v } as any)} />
          <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, marginTop: 6 }}>แยกตั้งลาย/ความยาวได้ทีละจอ — ส่วนมุมโค้งยังคุมรวมที่ Shape & Feel</div>
        </Field>
      </Collapsible>
    </div>
  );

  const renderLogo = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Logo URL" path="logo.src">
        <TextInput value={appearance.logo_url || ''} onChange={v => set('logo_url', v)} placeholder="https://..." />
      </Field>
      <Field label="Logo Height" path="logo.height">
        <NumInput value={appearance.logo_height ?? 28} min={16} max={48} step={2} unit="px" onChange={v => set('logo_height', v)} />
      </Field>
    </div>
  );

  // ── Block rows renderer (canvas preview) ────────────────────────────────
  const renderBlockRows = (b: BlockItem): { text: string; style: string; items?: any[] }[] => {
    const { sh, sh2, bd, bd2, tiltDeg, px, fb, fd, cardR, radius } = tokC;
    const { ink, ink2, ink3, card, bg, hl, soft, accent, primary, onPrimary, line } = tok;
    const g = (k: string) => geoVal(b, k);
    const IM = blockImages;
    const txt = (t: string, st: string) => ({ text: t, style: st });
    const bgOf = (key: string, h: number | string, label: string) => ({
      text: IM[key] ? '' : label,
      style: `display:flex;align-items:center;justify-content:center;height:${h}px;font:500 10px 'JetBrains Mono',monospace;color:${ink3};background:linear-gradient(180deg,#FCEFE0,${bg})${IM[key] ? `;background-image:url(${IM[key]});background-size:${g('fit') === 'contain' ? 'contain' : g('fit') === 'stretch' ? '100% 100%' : 'cover'};background-position:center;background-repeat:no-repeat` : ''}`,
    });
    const cardWrap = (inner: any[], pad: number) => [{ text: '', style: `display:flex;flex-direction:column;gap:6px;background:${card};border:${bd};border-radius:${cardR}px;padding:${pad}px;box-shadow:${sh}${tiltDeg ? `;transform:rotate(-${tiltDeg}deg)` : ''}`, items: inner }];
    const btn = (t: string, bgC: string, fgC: string) => txt(t, `display:block;text-align:center;padding:14px 18px;background:${bgC};color:${fgC};border:${bd};border-radius:${radius}px;box-shadow:${sh};font:700 ${px(16)} ${fb}`);

    switch (b.id) {
      case 'kv': return [bgOf('kv-intro', g('h'), 'KV IMAGE')];
      case 'invitedHero': return [bgOf('invited_hero', g('h'), 'INVITED HERO')];
      case 'grpHero': {
        if (g('reveal') === 'result') return [bgOf('group_hero', g('h'), 'GROUP RESULT ART')];
        if (tok.groupHeroPattern === 'grid') {
          return [{ text: '', style: `display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:center;height:${g('h')}px;background:linear-gradient(#FCEFE0,${bg});padding:14px`,
            items: [0,1,2,3,4,5].map(i => txt('', artStyle(64, i % 2 ? soft : hl, 'margin:0 auto;'))) }];
        }
        return [{ text: '', style: `display:flex;align-items:flex-end;justify-content:center;height:${g('h')}px;background:linear-gradient(#FCEFE0,${bg})`,
          items: [0,1,2,3,4].map(i => txt('', artStyle(64, i % 2 ? soft : hl, `transform:rotate(${(i-2)*10}deg);margin-left:${i ? -14 : 0}px;`))) }];
      }
      case 'loadArt': {
        const loadingImgCss = IM['loading'] ? `background-image:url(${IM['loading']});background-size:cover;background-position:center;background-repeat:no-repeat;` : '';
        return [{ text: IM['loading'] ? '' : 'LOADING ART',
          style: `${artStyle(Math.min(Number(g('h')), 150), soft, loadingImgCss)};align-self:center;display:flex;align-items:center;justify-content:center;font:500 10px 'JetBrains Mono',monospace;color:${ink3}` }];
      }
      case 'matArt': return [{ text: '', style: `display:flex;align-items:center;justify-content:center;height:${g('h')}px`, items: [
        txt('', artStyle(104, soft, 'transform:rotate(-7deg);margin-right:-22px;')),
        txt('', artStyle(104, hl, 'transform:rotate(7deg);margin-left:-22px;')),
      ]}];
      case 'errArt': return [txt('', artStyle(96, soft, 'align-self:center;transform:rotate(-4deg);'))];

      case 'loadCopy': return [
        txt(cpVal(screen === 'Matching' ? 'matching_title' : 'loading_title'), `display:block;text-align:${g('align')};font-family:${fd};font-size:${px(26)};letter-spacing:.06em;color:${ink}`),
        txt(cpVal(screen === 'Matching' ? 'matching_sub' : 'loading_body'), `display:block;text-align:${g('align')};font:500 ${px(13)} ${fb};color:${ink2}`),
      ];
      case 'loadBar': {
        const pStyle = screen === 'Matching' ? tok.progressStyleMatching : tok.progressStyleLoading;
        return [{ text: '', style: `display:block;align-self:center;width:190px;height:12px;border:${bd2};border-radius:${tok.progressRadius}px;overflow:hidden;background:${card}`,
          items: [txt('', `display:block;height:100%;width:${pStyle === 'compact' ? '45%' : '82%'};background:${pStyle === 'bar' ? primary : `repeating-linear-gradient(115deg,${primary} 0 10px,${hl} 10px 18px)`}`)] }];
      }

      case 'infoCard': return cardWrap([
        txt(cpVal('intro_quiz_label'), `display:block;font:700 ${px(11)} ${fb};letter-spacing:.1em;color:${primary}`),
        txt(cpVal('intro_body'), `display:block;font:700 ${px(19)}/1.35 ${fb};color:${ink}`),
        txt(`6 ข้อ · ${cpVal('intro_time')} · 5 สาย`, `display:block;font:600 ${px(11)} ${fb};color:${ink3}`),
      ], Number(g('pad')));
      case 'cta': return [btn(cpVal(screen === 'Invited' ? 'invite_cta' : 'intro_cta'), g('color') === 'primary' ? primary : hl, g('color') === 'primary' ? onPrimary : ink)];
      case 'note': return [txt(cpVal('intro_note'), `display:block;text-align:center;font:400 ${px(11)} ${fb};color:${ink3}`)];
      case 'inviterCard': return cardWrap([
        tok.artShape === 'none' || g('badge') === 'hide' ? txt('', 'display:none') : txt(cpVal('invited_duo_badge'), `align-self:flex-start;background:${hl};border:${bd2};border-radius:${tok.badgeRadius}px;padding:2px 9px;font-family:${fd};font-size:${px(14)}`),
        { text: '', style: `display:flex;align-items:center;gap:10px`, items: [txt('', artStyle(40, soft)), txt('มีน · สายวางแผน', `font:700 ${px(15)} ${fb};color:${ink}`)] },
        txt(cpVal('invited_body'), `display:block;font:500 ${px(13.5)}/1.7 ${fb};color:${ink2}`),
      ], Number(g('pad')));

      case 'progress': return [
        { text: '', style: 'display:flex;align-items:center;justify-content:space-between', items: [
          txt(cpVal('question_progress'), `font:700 ${px(16)} ${fb};color:${ink}`),
          txt('50%', `background:${hl};border:${bd2};border-radius:${tok.badgeRadius}px;padding:1px 8px;font:700 ${px(11)} ${fb};transform:rotate(1.5deg)`),
        ]},
        { text: '', style: `display:block;height:12px;border:${bd2};border-radius:${tok.progressRadius}px;overflow:hidden;background:${card}`, items: [txt('', `display:block;height:100%;width:${tok.progressStyleQuestion === 'compact' ? '30%' : '50%'};background:${tok.progressStyleQuestion === 'bar' ? primary : `repeating-linear-gradient(115deg,${primary} 0 10px,${hl} 10px 18px)`}`)] },
      ];
      case 'qCard': {
        const qText = questions[0]?.text || 'ไฟดับทั้งเมือง 3 วัน สิ่งแรกที่คุณทำคือ?';
        return cardWrap([txt(qText, `display:block;font:700 ${px(Math.max(14, Number(g('size')) + 5))}/1.35 ${fb};color:${ink}`)], Number(g('pad')));
      }
      case 'options': {
        const keyBox = (ch: string) => g('keyShape') === 'none' ? null : txt(ch, `display:flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;border:${bd2};border-radius:${g('keyShape') === 'square' ? '6px' : '50%'};background:${card};font-family:${fd};font-size:${px(14)}`);
        const realOpts = questions[0]?.options ?? [];
        const opts: [string, string, boolean][] = realOpts.length
          ? realOpts.slice(0, 4).map((o, i) => [String.fromCharCode(65 + i), o.label, i === Math.min(1, realOpts.length - 1)])
          : [['A','ออกไปหาน้ำกับอาหารก่อนเลย',false],['B','โทรตามเพื่อนในทีมให้มารวมกัน',true],['C','อยู่บ้าน ประหยัดพลังงานไว้ก่อน',false]];
        return opts.map(([ch, label, on]) => ({ text: '', style: `display:flex;gap:12px;align-items:center;min-height:${g('optH')}px;padding:0 12px;border-radius:${radius}px;background:${on ? hl : card};border:${on ? bd : bd2};box-shadow:${on ? `3px 4px 0 ${ink}` : sh2}`,
          items: [keyBox(ch), txt(label, `font:500 ${px(14)}/1.7 ${fb};color:${ink}`)].filter(Boolean) }));
      }
      case 'backRow': return [{ text: '', style: 'display:flex;align-items:center;gap:12px', items: [
        txt(cpVal('question_back'), `font:600 ${px(12)} ${fb};color:${ink3}`),
        { text: '', style: 'margin-left:auto;display:flex;gap:5px', items: [0,1,2,3,4,5].map(i => txt('', `width:6px;height:6px;border-radius:50%;display:block;background:${i < 3 ? primary : 'rgba(28,26,23,.2)'}`)) },
      ]}];

      case 'survivorCard': {
        const arch = axes[0];
        const headline = (arch?.label_en || arch?.label || 'THE SCOUT').toUpperCase();
        const subtitle = arch?.label || 'สายเอาตัวรอด';
        const body = arch?.body || 'ไปก่อน คิดทีหลัง แต่กลับมาพร้อมของที่ทีมต้องใช้';
        return cardWrap([
          { text: '', style: 'display:flex;align-items:center;justify-content:space-between', items: [
            txt(cpVal('summary_card_eyebrow'), `font:700 ${px(10)} ${fb};letter-spacing:.12em;color:${ink3}`),
            txt(cpVal('summary_card_valid'), `background:${hl};border:${bd2};border-radius:${tok.badgeRadius}px;padding:1px 7px;font:700 ${px(9.5)} ${fb}`),
          ]},
          { text: '', style: `display:flex;${g('dir') === 'column' ? 'flex-direction:column;align-items:flex-start;' : 'align-items:center;'}gap:14px`, items: [
            txt('', artStyle(Number(g('artW')), hl)),
            { text: '', style: 'display:flex;flex-direction:column;gap:3px;min-width:0', items: [
              txt(headline, `font-family:${fd};font-size:${px(22)};color:${primary}`),
              txt(subtitle, `font:700 ${px(18)} ${fb};color:${ink}`),
              txt(body, `font:400 ${px(12)}/1.6 ${fb};color:${ink2}`),
            ]},
          ]},
        ], Number(g('pad')));
      }
      case 'retake': return [txt(cpVal('summary_retake_btn'), `display:block;font:600 ${px(11)} ${fb};color:${ink3}`)];
      case 'actionRow': return [{ text: '', style: `display:flex;${g('dir') === 'column' ? 'flex-direction:column;' : ''}gap:8px`, items: [
        txt(cpVal('share_btn'), `flex:1;text-align:center;padding:13px 14px;background:${card};color:${ink};border:${bd2};border-radius:${radius}px;font:600 ${px(13)} ${fb};box-shadow:${sh2}`),
        txt(cpVal('invite_btn'), `flex:1;text-align:center;padding:13px 14px;background:${primary};color:${onPrimary};border:${bd};border-radius:${radius}px;font:700 ${px(13)} ${fb};box-shadow:${sh}`),
      ]}];
      case 'teamSection': return [
        txt(cpVal('summary_teams_header'), `display:block;font-family:${fd};font-size:${px(22)};letter-spacing:.05em;color:${ink}`),
        { text: '', style: `display:flex;align-items:center;gap:10px;background:${card};border:${bd2};border-radius:${radius}px;padding:12px 14px;box-shadow:${sh2}`, items: [
          g('style') === 'bar'
            ? { text: '', style: `display:block;flex:none;width:56px;height:8px;border:${bd2};border-radius:9px;overflow:hidden;background:${bg}`, items: [txt('', `display:block;height:100%;width:60%;background:${primary}`)] }
            : { text: '', style: 'display:flex;gap:4px;flex:none;flex-wrap:wrap;max-width:60px', items: [0,1,2,3,4].map(i => txt('', `width:8px;height:8px;border-radius:50%;display:block;border:1.5px solid rgba(28,26,23,.2);background:${i < 3 ? primary : 'rgba(28,26,23,.15)'}`)) },
          { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items: [
            txt('3/5 คน', `font:700 ${px(13)} ${fb};color:${ink}`),
            txt('รอสมาชิกอีก 2 คน', `font:500 ${px(11)} ${fb};color:${ink3}`),
          ]},
          txt(cpVal('team_view_btn'), `flex:none;padding:8px 12px;background:${ink};color:${card};border-radius:${radius}px;font:600 ${px(11)} ${fb}`),
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
            : `display:flex;align-items:center;gap:10px;background:${card};border:${bd2};border-radius:${radius}px;padding:10px 12px;box-shadow:${sh2}`,
          items: [
            g('style') === 'compact' ? txt('', `width:28px;height:28px;flex:none;border-radius:50%;background:rgba(28,26,23,.08)`) : txt('', artStyle(34, soft)),
            { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items: [
              txt(n, `font:700 ${px(13)} ${fb};color:${ink}`), txt(ax, `font:400 ${px(10.5)} ${fb};color:${ink2}`),
            ]},
            txt(v, `flex:none;font:700 ${px(13)} ${fb};color:${v === 'รอคู่หู...' ? primary : ink}`),
          ],
        })),
      ];

      case 'hero2': {
        const hero = tok.artHero;
        const items = hero === 'band'
          ? [txt('', `display:block;width:78%;height:46px;border-radius:${radius}px;background:${primary}`)]
          : hero === 'single'
            ? [txt('', artStyle(150, hl))]
            : [txt('', artStyle(130, soft, `transform:rotate(-${g('tilt')}deg);margin-right:-30px;`)), txt('', artStyle(130, hl, `transform:rotate(${g('tilt')}deg);margin-left:-30px;`))];
        return [{ text: '', style: `display:flex;align-items:center;justify-content:center;height:${g('h')}px;background:linear-gradient(#FCEFE0,${bg})`, items }];
      }
      case 'resultCard': {
        const r = Object.values(results)[0];
        return cardWrap([
          txt(cpVal('pair_result_badge'), `align-self:flex-start;background:${hl};border:${bd2};border-radius:${tok.badgeRadius}px;padding:3px 10px;font:700 ${px(11)} ${fb}`),
          txt(r?.title || '12 วัน', `display:block;font-family:${fd};font-size:${px(38)};line-height:1.1;color:${ink}`),
          txt(r?.body || 'คนหนึ่งกล้าเสี่ยง อีกคนคิดก่อนทำ — เสบียงพอถึงวันที่ 12', `display:block;font:500 ${px(13.5)}/1.7 ${fb};color:${ink2}`),
        ], Number(g('pad')));
      }
      case 'axisChips': {
        const a0 = axes[0]?.label || 'สายวางแผน';
        const a1 = axes[1]?.label || axes[0]?.label || 'สายเอาตัวรอด';
        return [{ text: '', style: `display:flex;${g('dir') === 'column' ? 'flex-direction:column;' : ''}gap:8px`, items: [
          { text: '', style: `flex:1;display:flex;flex-direction:column;gap:2px;border:${bd2};border-radius:${tok.axisChipRadius}px;padding:9px;background:${soft}`, items: [txt('มีน', `font:600 ${px(9.5)} ${fb};color:${ink3}`), txt(a0, `font:700 ${px(12)} ${fb}`)] },
          { text: '', style: `flex:1;display:flex;flex-direction:column;gap:2px;border:${bd2};border-radius:${tok.axisChipRadius}px;padding:9px;background:${hl}`, items: [txt('คุณ', `font:600 ${px(9.5)} ${fb};color:${ink3}`), txt(a1, `font:700 ${px(12)} ${fb}`)] },
        ]}];
      }
      case 'shareRow': return [
        btn(cpVal('pair_share_cta'), line, '#FFFFFF'),
        txt(cpVal('copy_link_btn'), `display:block;text-align:center;padding:13px 18px;background:${card};color:${ink};border:${bd};border-radius:${radius}px;box-shadow:${sh};font:700 ${px(15)} ${fb}`),
      ];

      case 'topNav': return [{ text: '', style: `display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1.5px solid rgba(28,26,23,.1)`, items: [
        txt(`✕  ${cpVal(screen === 'Symbols' ? 'symbols_title' : 'group_page_title')}`, `font:700 ${px(14)} ${fb};color:${ink}`),
        txt('LIFF', `font:700 ${px(12)} ${fb};letter-spacing:.1em;color:${ink3}`),
      ]}];
      case 'grpCard': return cardWrap([
        { text: '', style: 'display:flex;align-items:flex-start;gap:12px', items: [
          txt('?', `display:flex;align-items:center;justify-content:center;width:66px;height:66px;flex:none;border:${bd};border-radius:50%;background:${hl};font:700 ${px(18)} ${fb}`),
          { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px', items: [
            txt(cpVal('group_title'), `font:700 ${px(10.5)} ${fb};letter-spacing:.08em;color:${primary}`),
            txt(group?.archetypes?.[0]?.title || 'ทีมรอดโลก', `font:700 ${px(17)} ${fb};color:${ink}`),
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
          { text: '', style: `flex:1;height:8px;border-radius:${Math.min(tok.progressRadius, 4)}px;overflow:hidden;background:rgba(28,26,23,.1)`, items: [txt('', `display:block;height:100%;width:${tok.progressStyleGroup === 'compact' ? '38%' : '60%'};background:${tok.progressStyleGroup === 'bar' ? primary : `repeating-linear-gradient(115deg,${primary} 0 8px,${hl} 8px 14px)`}`)] },
          txt('3/5', `flex:none;font:700 ${px(11)} ${fb}`),
        ]},
        txt(cpVal('group_remaining_label'), `display:block;font:500 ${px(12)} ${fb};color:${ink2}`),
      ], Number(g('pad')));
      case 'memberList': return [
        txt(cpVal('group_members'), `display:block;font:700 ${px(16)} ${fb};color:${ink}`),
        ...(g('style') === 'compact'
          ? [{ text: '', style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px', items: [0,1,2].map(i => ({ text: '', style: `display:flex;flex-direction:column;align-items:center;gap:5px;background:${card};border:${bd2};border-radius:10px;padding:8px 6px`, items: [txt('', artStyle(90, soft)), txt(['คุณ','มีน','ต้าร์'][i], `font:700 ${px(11)} ${fb}`)] })) }]
          : [['คุณ','สายเอาตัวรอด','คุณ'],['มีน','สายวางแผน','ดูผลคู่ →']].map(([n, ax, tag]) => ({ text: '', style: `display:flex;align-items:center;gap:12px;background:${card};border:${bd2};border-radius:12px;padding:10px 12px`, items: [
            txt('', artStyle(44, soft)),
            { text: '', style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px', items: [txt(n, `font:700 ${px(13)} ${fb}`), txt(ax, `font:500 ${px(10.5)} ${fb};color:${ink2}`)] },
            txt(tag, `flex:none;background:${hl};border:${bd2};border-radius:${tok.badgeRadius}px;padding:3px 9px;font:700 ${px(10.5)} ${fb}`),
          ]}))),
      ];
      case 'axisCounts': return [{ text: '', style: 'display:flex;gap:7px;flex-wrap:wrap', items: [['2','สายเอาตัวรอด'],['1','สายวางแผน']].map(([n, l]) =>
        txt(`${n} ${l}`, `background:${hl};border:${bd2};border-radius:20px;padding:3px 10px;font:600 ${px(11)} ${fb}`)) }];
      case 'inviteMore': return [btn(cpVal('group_invite_cta'), line, '#FFFFFF')];
      case 'grpComplete': return [
        { text: '', style: `background:${card};border:${bd};border-radius:14px;padding:12px 14px;box-shadow:${sh};display:flex;gap:12px;align-items:flex-start`, items: [
          txt('AS', `width:38px;height:38px;flex:none;border-radius:9px;background:${ink};color:${hl};font-family:${fd};font-size:17px;display:flex;align-items:center;justify-content:center;letter-spacing:.04em`),
          { text: '', style: 'display:flex;flex-direction:column;gap:2px', items: [
            txt('Brand · เมื่อสักครู่', `font:700 ${px(12.5)} ${fb}`),
            txt(cpVal('team_full_push'), `font:500 ${px(12.5)}/1.5 ${fb};color:${ink2}`),
          ]},
        ]},
        { text: '', style: 'display:flex;align-items:flex-end;justify-content:center;padding:8px 0', items:
          [0,1,2,3,4].map(i => txt('', artStyle(72, i % 2 ? soft : hl, `border-radius:10px;height:98px;transform:rotate(${(i-2)*10}deg);margin-left:${i ? -14 : 0}px;`))) },
        txt(cpVal('team_full_title'), `display:block;text-align:center;font-family:${fd};font-size:${px(34)};letter-spacing:.05em;line-height:1`),
        txt(cpVal('team_full_sub'), `display:block;text-align:center;font:500 ${px(13)}/1.6 ${fb};color:${ink2}`),
        btn(cpVal('team_full_cta'), primary, onPrimary),
      ];
      case 'symGrid': return [{ text: '', style: `display:grid;grid-template-columns:repeat(${g('cols') === '4' ? 4 : 3},1fr);gap:10px`, items: [0,1,2,3,4,5,6,7,8].map(i => ({ text: '', style: `display:flex;flex-direction:column;background:${card};border:${tok.borderW}px solid ${i < 4 ? ink : 'rgba(28,26,23,.2)'};border-radius:${cardR}px;overflow:hidden;box-shadow:${i < 4 ? sh2 : 'none'};opacity:${i < 4 ? 1 : .7}`,
        items: [
          txt(i < 4 ? '✦' : '', `display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;font-size:18px;background:${i < 4 ? hl : '#DDD8CC'}`),
          txt(i < 4 ? `ดวงที่ ${i+1}` : 'ยังไม่ปลด', `display:block;padding:4px 5px;text-align:center;font:600 ${px(9)} ${fb};color:${i < 4 ? ink : ink3}`),
        ] })) }];

      case 'errCopy': return [
        txt(cpVal('error_title'), `display:block;text-align:${g('align')};font-family:${fd};font-size:${px(26)};color:${ink}`),
        txt(cpVal('error_body'), `display:block;text-align:${g('align')};font:500 ${px(13)}/1.7 ${fb};color:${ink2}`),
      ];
      case 'errRetry': return [btn(cpVal('error_retry'), primary, onPrimary)];

      case 'xImage': return [bgOf('x_image', g('h'), 'ภาพตกแต่ง')];
      case 'xText': return [txt(cpVal('x_text'), `display:block;text-align:${g('align')};font:600 ${px(Number(g('size')))}/1.6 ${fb};color:${ink}`)];
      case 'xSpacer': return [txt('', `display:block;height:${g('h')}px`)];
      case 'xDivider': return [txt('', `display:block;height:2px;background:rgba(28,26,23,.15)`)];
      case 'xBox': {
        const boxBg = g('xbgColor') === 'primary' ? primary : g('xbgColor') === 'soft' ? soft : g('xbgColor') === 'surface' ? card : hl;
        return [txt('', `display:block;height:${g('h')}px;border-radius:${g('xRadius')}px;background:${boxBg}`)];
      }
      case 'xCard': {
        const r = resolveText(b);
        const label = r.bound ? (r.ok ? r.value : (srcOf(b, 'text').fallback === 'placeholder' ? `⛓ ${r.path}` : 'ยังไม่มีข้อมูล')) : (cpVal('x_text') || 'การ์ดผลลัพธ์ (DATA CARD)');
        return cardWrap([txt(label, `display:block;font:700 ${px(15)}/1.5 ${fb};color:${ink}`)], Number(g('pad')));
      }
      case 'xRow': {
        const rl = resolveList(b);
        const srcMode = srcOf(b, 'list').mode ?? 'axes';
        if (!rl.bound || !rl.rows.length) return [txt('แถวรายการ — ยังไม่ได้เลือกแหล่งข้อมูล', `display:block;font:500 ${px(12)} ${fb};color:${ink3}`)];
        return rl.rows.map(row => {
          const t = listRowText(srcMode, row);
          return { text: '', style: `display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:${bd2};border-radius:${radius}px;background:${card};box-shadow:${sh2}`,
            items: [txt(t.primary || '—', `font:700 ${px(12.5)} ${fb};color:${ink}`), ...(t.secondary ? [txt(t.secondary, `font:400 ${px(10.5)} ${fb};color:${ink2}`)] : [])] };
        });
      }
      case 'xChip': {
        const rl = resolveList(b);
        const srcMode = srcOf(b, 'list').mode ?? 'axes';
        if (!rl.bound || !rl.rows.length) return [txt('chip', `display:inline-block;padding:4px 10px;border:${bd2};border-radius:20px;background:${soft};font:600 ${px(11)} ${fb}`)];
        return [{ text: '', style: `display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:${g('align') === 'left' ? 'flex-start' : 'center'}`,
          items: rl.rows.map(row => txt(listRowText(srcMode, row).primary || '—', `padding:4px 10px;border:${bd2};border-radius:20px;background:${soft};font:600 ${px(11)} ${fb}`)) }];
      }

      default: return [txt('', 'display:block;height:28px')];
    }
  };

  // tree-walk: items → sub → sub2
  const rowsNorm = (b: BlockItem): any[] => {
    const walk = (node: any, depth: number): any => {
      if (!node) return null;
      const out: any = { text: node.text, style: node.style };
      if (node.items?.length) {
        const key = depth === 0 ? 'items' : depth === 1 ? 'sub' : 'sub2';
        out[key] = node.items.map((c: any) => walk(c, depth + 1)).filter(Boolean);
      }
      return out;
    };
    return renderBlockRows(b).map(r => walk(r, 0));
  };

  // ── JSON model ─────────────────────────────────────────────────────────────
  const jsonModel = () => {
    const list = curLayout;
    const lines: { indent: number; ref: string; kind: string; note: string }[] = [];
    const push = (i: number, ref: string, kind: string, note: string) => lines.push({ indent: i, ref, kind, note });
    push(0, '{', '', '');
    push(1, '"schema": 1,', 'lock', 'เวอร์ชัน schema');
    push(1, `"screen": ${JSON.stringify(screen.toLowerCase())},`, 'lock', 'หน้าใน App.tsx');
    push(1, '"slots": [', '', '');
    list.forEach((b, i) => {
      const def = SLOTS[b.id] || { bind: '', geo: [], copy: [], img: undefined };
      const isExtra = EXTRAS.includes(b.id);
      const props: [string, string, string][] = [];
      if (def.bind) props.push([`"bind": ${JSON.stringify(def.bind)}`, 'lock', 'ข้อมูล/นาวิเกชันที่ผูกไว้']);
      props.push([`"show": ${b.show}`, 'free', 'ซ่อน/แสดง']);
      props.push([`"order": ${i}`, 'free', 'ลำดับจากการลากวาง']);
      const geoStr = (def.geo || []).map(k => `${JSON.stringify(k)}: ${JSON.stringify(geoVal(b, k))}`).join(', ');
      if (geoStr) props.push([`"geo": { ${geoStr} }`, 'free', 'geometry']);
      if (def.copy) props.push([`"copy": [${def.copy.map(cp => JSON.stringify(cp[0])).join(', ')}]`, 'free', 'คีย์ข้อความของ slot นี้']);
      if (def.img) props.push([`"image": ${JSON.stringify('images.' + def.img)}`, 'free', 'สลอตรูปของ slot นี้']);
      if (!isExtra) props.push(['"style": "$token"', 'bound', 'สี/ฟอนต์อ้าง token จาก 01–06']);
      push(2, `{ "id": ${JSON.stringify(b.id)},${isExtra ? ' "role": "extra",' : ''}`, isExtra ? 'free' : 'lock', isExtra ? 'บล็อกตกแต่ง' : 'slot id ของโค้ด LIFF');
      props.forEach(([code, kind, note], j) => push(3, code + (j < props.length - 1 ? ',' : ''), kind, note));
      push(2, '}' + (i < list.length - 1 ? ',' : ''), '', '');
    });
    push(1, '],', '', '');
    push(1, '"fallback": "default"', 'lock', 'JSON พัง → ใช้เลย์เอาต์ตั้งต้น');
    push(0, '}', '', '');
    return lines;
  };

  const serializeJson = (withNotes: boolean) => {
    const lines = jsonModel();
    return lines.map(l => '  '.repeat(l.indent) + l.ref + (withNotes && l.note ? `  // ${{ lock:'🔒', bound:'🔗', free:'🎨' }[l.kind] || ''} ${l.note}` : '')).join('\n');
  };

  const copyJson = (withNotes: boolean) => {
    const text = serializeJson(withNotes);
    try { JSON.parse(serializeJson(false)); }
    catch (e: any) { setCopyMsg(`⚠ JSON ไม่ผ่านการตรวจ: ${e.message}`); setTimeout(() => setCopyMsg(''), 4000); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopyMsg(withNotes ? '✓ คัดลอกพร้อมโน้ตแล้ว' : '✓ คัดลอกแล้ว');
    setTimeout(() => setCopyMsg(''), 2500);
  };

  // ── Config column content ─────────────────────────────────────────────────
  const renderGlobalConfig = () => {
    switch (section) {
      case 'liff':  return renderLiff();
      case 'color': return renderColor();
      case 'type':  return renderType();
      case 'shape': return renderShape();
      case 'art':   return renderArt();
      case 'logo':  return renderLogo();
      default:      return renderColor();
    }
  };

  const renderScreenArt = () => {
    const curCardR  = (appearance as any).card_radius ?? 16;
    const curRadius = appearance.radius ?? 13;
    const curBw     = appearance.border_width ?? 2.5;
    const curSh     = appearance.shadow || 'hard';
    const curShOff  = appearance.shadow_offset ?? 4;
    const curTilt   = appearance.tilt || 'off';
    const curTex    = appearance.texture || 'none';

    const activePreset = ART_PRESETS.find(p =>
      Math.abs(curCardR - p.cardR) < 3 &&
      curSh === p.shadow &&
      Math.abs(curBw - p.bw) < 0.5
    );

    const applyPreset = (p: typeof ART_PRESETS[0]) => onChange({
      ...appearance,
      card_radius: p.cardR,
      radius: p.radius,
      border_width: p.bw,
      shadow: p.shadow,
      shadow_offset: p.shOff,
    } as any);

    const SCREEN_TOKEN_EXTRAS: Record<string, { name: string; color: string; border?: boolean }[]> = {
      PairResult: [{ name:'--line', color: tok.line }],
      SoloShare:  [{ name:'--line', color: tok.line }],
      Error:      [{ name:'--danger', color: tok.danger }],
    };

    const baseChips: { name: string; color: string; border?: boolean }[] = [
      { name:'--ac',     color: tok.primary },
      { name:'--hl',     color: tok.hl },
      { name:'--card',   color: tok.card, border: true },
      { name:'--ink',    color: tok.ink },
      { name:'--soft',   color: tok.soft },
      { name:'--shadow', color: '' },
      { name:'--radius', color: '' },
    ];
    const tokenChips = [...baseChips, ...(SCREEN_TOKEN_EXTRAS[screen] || [])];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...BODY_F, fontSize: 10.5, lineHeight: 1.6, color: T.dim }}>
          กดเลือกรูปแบบ หรือปรับแต่ละค่าเอง — สี ฟอนต์ ยังอ้าง token จากแท็บ Colors &amp; Typography
        </div>

        {/* Shape preset tiles */}
        <Field label="Shape Preset" path="shape">
          <div style={{ display: 'flex', gap: 7 }}>
            {ART_PRESETS.map(p => {
              const on = activePreset?.k === p.k;
              const previewSh = p.shadow === 'hard' ? `3px 4px 0 ${tok.ink}`
                : p.shadow === 'soft' ? '0 4px 10px rgba(28,26,23,.2)'
                : 'none';
              return (
                <button key={p.k} onClick={() => applyPreset(p)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', gap: 7, padding: '9px 6px',
                  border: `${on ? 1.5 : 1}px solid ${on ? T.text : '#DEDEDA'}`,
                  borderRadius: 10, background: on ? '#F4F4F2' : '#FFFFFF',
                  cursor: 'pointer', alignItems: 'center',
                }}>
                  <div style={{
                    width: 44, height: 54, flexShrink: 0,
                    borderRadius: Math.round(p.cardR * 0.6),
                    border: `${p.bw}px solid ${tok.ink}`,
                    background: tok.card, boxShadow: previewSh,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: 24, height: 8, borderRadius: Math.round(p.radius * 0.5), background: tok.primary }} />
                  </div>
                  <span style={{ ...BODY_F, fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? T.text : T.mid }}>{p.label}</span>
                  <span style={{ ...BODY_F, fontSize: 9, color: T.dim, textAlign: 'center', lineHeight: 1.4 }}>{p.hint}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <div style={{ height: 1, background: T.divider }} />

        <Field label="Card Radius" path="card_radius">
          <NumInput value={curCardR} min={0} max={28} step={2} unit="px"
            onChange={v => onChange({ ...appearance, card_radius: v } as any)} />
        </Field>
        <Field label="Button Radius" path="radius">
          <NumInput value={curRadius} min={0} max={26} step={2} unit="px"
            onChange={v => set('radius', v)} />
        </Field>
        <Field label="Border Width" path="border_width">
          <NumInput value={curBw} min={0} max={4} step={0.5} unit="px"
            onChange={v => set('border_width', v)} />
        </Field>
        <Field label="Shadow Style" path="shadow">
          <SegInput
            value={curSh}
            options={[{ v:'none', label:'ไม่มีเงา' }, { v:'soft', label:'นุ่ม' }, { v:'hard', label:'ชัด' }]}
            onChange={v => set('shadow', v as AppearanceConfig['shadow'])}
          />
        </Field>
        <Field label="Shadow Offset" path="shadow_offset">
          <NumInput value={curShOff} min={0} max={8} step={1} unit="px"
            onChange={v => set('shadow_offset', v)} />
        </Field>
        <Field label="Card Tilt" path="tilt">
          <SegInput
            value={curTilt}
            options={[{ v:'off', label:'ตั้งตรง' }, { v:'subtle', label:'เอียงน้อย' }, { v:'playful', label:'เอียงชัด' }]}
            onChange={v => set('tilt', v as AppearanceConfig['tilt'])}
          />
        </Field>
        <Field label="Texture" path="texture">
          <SegInput
            value={curTex}
            options={[{ v:'none', label:'ไม่มี' }, { v:'paper', label:'Paper' }]}
            onChange={v => set('texture', v)}
          />
        </Field>

        <div style={{ height: 1, background: T.divider }} />

        {/* Token reference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${T.divider}`, borderRadius: 10, background: '#FBFBF9', padding: 10 }}>
          <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#7AC4D6' }}>token ที่จอนี้ใช้</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {tokenChips.map(({ name, color, border }) => (
              <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${T.divider}`, borderRadius: 6, background: T.panel, padding: '4px 7px', ...MONO, fontSize: 10, fontWeight: 600, color: '#3A3E42' }}>
                {color && <span style={{ width: 10, height: 10, borderRadius: 3, background: color, border: border ? `1px solid ${T.faint}` : 'none', flexShrink: 0 }} />}
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderScreenConfig = () => {
    if (view === 'art') return renderScreenArt();
    const screenDef = SCREENS_V3.find(x => x.k === screen);
    const editing = view === 'add' || (!!sel && view === 'props');
    const selBlock = curLayout.find(b => b.uid === sel);
    const targets = view === 'add' ? [] : view === 'props' && selBlock ? [selBlock] : curLayout;

    if (view === 'add') {
      const used = curLayout.map(b => b.id);
      const available = (screenDef?.slots || []).filter(id => !used.includes(id)).concat(EXTRAS);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ ...BODY_F, fontSize: 11.5, fontWeight: 700, color: T.text }}>เพิ่มบล็อกในหน้านี้</div>
          {available.map(id => {
            const def = SLOTS[id];
            const k = KIND[def.kind] || KIND.extra;
            return (
              <div
                key={id}
                draggable
                onDragStart={e => { setDrag({ newSlot: id }); e.dataTransfer.effectAllowed = 'copy'; }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: T.border, borderRadius: 9, background: '#FBFBF9', cursor: 'grab' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, borderRadius: 6, background: '#F4F4F2', color: k.c, fontSize: 10 }}>{k.icon}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ ...BODY_F, fontSize: 11, fontWeight: 700, color: T.text }}>{def.label}</span>
                  <span style={{ ...BODY_F, fontSize: 9.5, lineHeight: 1.4, color: T.dim }}>{def.bind ? `🔒 ${def.bind}` : 'ไม่มี logic ผูก — ตกแต่งได้อิสระ'}</span>
                </div>
                <button onClick={e => { e.stopPropagation(); insertBlock(id, null); }} style={{ flexShrink: 0, border: T.border, borderRadius: 6, background: '#FFFFFF', padding: '4px 9px', ...MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {targets.map(b => {
          const def = SLOTS[b.id] || { label: b.id, kind: 'extra', bind: '', geo: [], copy: [] };
          const k = KIND[def.kind] || KIND.extra;
          return (
            <div key={b.uid} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* Block group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', paddingBottom: 7, borderBottom: `1px solid ${T.divider}` }}>
                <span style={{ ...MONO, fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, color: '#FFFFFF', background: k.c }}>{k.label}</span>
                <span style={{ ...BODY_F, fontSize: 12.5, fontWeight: 700, color: T.text }}>{def.label}</span>
                {def.bind && <span style={{ ...MONO, fontSize: 9.5, fontWeight: 500, color: '#B02A3F' }}>🔒 {def.bind}</span>}
                <button onClick={() => setSel(b.uid)} style={{ marginLeft: 'auto', border: T.border, borderRadius: 6, background: '#FFFFFF', padding: '3px 7px', ...BODY_F, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>ดูในจอ →</button>
              </div>
              {/* Positioning section */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, border:`1px solid ${T.divider}`, borderRadius:11, padding:10 }}>
                <span style={{ ...BODY_F, fontSize:11.5, fontWeight:700, color:T.text }}>การวางตำแหน่ง</span>
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={() => setFlow(b)} style={{ flex:1, border:`1px solid ${isFloat(b) ? '#DEDEDA' : T.text}`, borderRadius:7, padding:'7px 10px', background: isFloat(b) ? '#FFFFFF' : T.text, color: isFloat(b) ? T.mid : '#FFFFFF', ...BODY_F, fontSize:11, fontWeight:600, cursor:'pointer' }}>ในลำดับ</button>
                  <button onClick={() => setFloat(b)} style={{ flex:1, border:`1px solid ${isFloat(b) ? T.text : '#DEDEDA'}`, borderRadius:7, padding:'7px 10px', background: isFloat(b) ? T.text : '#FFFFFF', color: isFloat(b) ? '#FFFFFF' : T.mid, ...BODY_F, fontSize:11, fontWeight:600, cursor:'pointer' }}>ลอยอิสระ · ลากได้</button>
                </div>
                {isFloat(b) && (() => {
                  const p = posOf(b) ?? DEFAULT_POS;
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {([['x','X',0,354],['y','Y',0,760],['w','W',80,354]] as [keyof typeof DEFAULT_POS, string, number, number][]).map(([fk, fl, mn, mx]) => (
                        <div key={fk} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ flexShrink:0, width:18, ...MONO, fontSize:10, fontWeight:600, color:T.dim }}>{fl}</span>
                          <input type="range" min={mn} max={mx} step={4} value={p[fk]}
                            onChange={e => updatePosField(b, fk, Number(e.target.value))}
                            style={{ flex:1, minWidth:0, accentColor: T.active }}
                          />
                          <span style={{ flexShrink:0, border:T.border, borderRadius:7, background:T.bg, padding:'3px 7px', ...MONO, fontSize:11, fontWeight:600, color:T.text, minWidth:34, textAlign:'center' as const }}>{p[fk]}</span>
                        </div>
                      ))}
                      <button onClick={() => setSnap(s => !s)} style={{ border:`1px solid ${snap ? T.text : '#DEDEDA'}`, borderRadius:7, padding:'6px 10px', background: snap ? '#F4F4F2' : '#FFFFFF', ...BODY_F, fontSize:11, fontWeight: snap ? 700 : 500, cursor:'pointer', color: snap ? T.text : T.mid }}>
                        {snap ? '⊞ Snap เปิดอยู่' : '⊟ Snap ปิดอยู่'}
                      </button>
                      <span style={{ ...BODY_F, fontSize:9.5, lineHeight:1.5, color:T.dim }}>ลากบล็อกในจอได้เลย — เส้นไกด์แดงจะโผล่เมื่อใกล้ขอบหรือกึ่งกลาง</span>
                    </div>
                  );
                })()}
              </div>
              {/* Copy fields */}
              {(def.copy || []).map(([ck, lbl, kind]) => (
                <Field key={ck} label={lbl} path={`copy.${ck}`}>
                  {kind === 'area'
                    ? <textarea value={cpVal(ck)} onChange={e => { const v = e.target.value; setBlockCopy(prev => ({ ...prev, [ck]: v })); setAppCopy(ck, v); }} placeholder={DEFAULT_COPY[ck] || ''} rows={3} style={{ width: '100%', boxSizing: 'border-box', border: T.border, borderRadius: 8, padding: '8px 10px', ...BODY_F, fontSize: 12, lineHeight: 1.6, resize: 'vertical' as const }} />
                    : <TextInput value={cpVal(ck)} onChange={v => { setBlockCopy(prev => ({ ...prev, [ck]: v })); setAppCopy(ck, v); }} placeholder={DEFAULT_COPY[ck]} />
                  }
                </Field>
              ))}
              {/* Image field */}
              {def.img && (
                <Field label="รูปของบล็อกนี้" path={`images.${def.img}`}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <div style={{ width: 60, height: 60, flexShrink: 0, border: '1px dashed #DEDEDA', borderRadius: 8, background: effectiveImages[def.img] ? `url(${effectiveImages[def.img]}) center/cover` : '#FBFBF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!effectiveImages[def.img] && <span style={{ ...MONO, fontSize: 9, color: '#C9CCCE' }}>IMG</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <input type="text" value={effectiveImages[def.img!] || ''} onChange={e => { const v = e.target.value; setBlockImages(prev => ({ ...prev, [def.img!]: v })); setAppImage(def.img!, v); }} placeholder="https://..." style={{ border: T.border, borderRadius: 8, padding: '7px 9px', ...MONO, fontSize: 11, fontWeight: 500, outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                      <button onClick={() => requestImgUpload(def.img!)} disabled={uploadingKeys.has(def.img!)} style={{ border: T.border, borderRadius: 8, padding: '7px 9px', ...BODY_F, fontSize: 11, fontWeight: 600, cursor: uploadingKeys.has(def.img!) ? 'default' : 'pointer', textAlign: 'left' as const, opacity: uploadingKeys.has(def.img!) ? 0.6 : 1 }}>
                        {uploadingKeys.has(def.img!) ? '⏳ กำลังอัปโหลด...' : '+ อัปโหลดรูป'}
                      </button>
                      {uploadErrors[def.img!] && <span style={{ fontSize: 10, color: '#E8354F' }}>⚠ {uploadErrors[def.img!]} — รูปนี้ยังไม่ได้บันทึก</span>}
                    </div>
                  </div>
                </Field>
              )}
              {/* Geo fields */}
              {(def.geo || []).map(gk => {
                const gd = GEO_DEF[gk];
                if (!gd) return null;
                const cur = geoVal(b, gk);
                return (
                  <Field key={gk} label={gd.label} path={`geo.${gk}`}>
                    {gd.kind === 'num'
                      ? <NumInput value={Number(cur)} min={gd.min!} max={gd.max!} step={gd.step!} unit={gd.unit!} onChange={v => updateBlockGeo(b.uid, gk, v)} />
                      : <SegInput value={String(cur)} options={(gd.opts || []).map(o => ({ v: o, label: o }))} onChange={v => updateBlockGeo(b.uid, gk, v)} />
                    }
                  </Field>
                );
              })}
              {/* Data source channels */}
              {(CH_OF[b.id] ?? []).map(ch => {
                const s = srcOf(b, ch);
                const isText  = ch === 'text';
                const isImage = ch === 'image';
                const isList  = ch === 'list';
                const allSrc = isText ? SRC_TEXT : isImage ? SRC_IMG : SRC_LIST;
                // Only offer data sources that actually exist for this campaign's mode
                // (solo has no pair results/group data, pair has no group data).
                const modes = (allSrc as any[]).filter((m: any) => (m.scope ?? ALL_MODES).includes(mode));
                const chLabel = isText ? 'แหล่งข้อมูลข้อความ' : isImage ? 'แหล่งข้อมูลภาพ' : 'แหล่งข้อมูลลิสต์';
                const storedMode = s.mode ?? (isText ? 'manual' : isImage ? 'fixed' : 'members');
                const curMode = modes.some((m: any) => m.k === storedMode) ? storedMode : (modes[0]?.k ?? storedMode);
                const modeDef = (modes as any[]).find((m: any) => m.k === curMode);
                const rText  = isText  ? resolveText(b)  : null;
                const rImg   = isImage ? resolveImage(b) : null;

                return (
                  <div key={ch} style={{ display:'flex', flexDirection:'column', gap:8, border:`1.5px solid ${T.text}`, borderRadius:11, background:'#FBFBF9', padding:10 }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                      <span style={{ ...BODY_F, fontSize:11.5, fontWeight:700, color:T.text }}>{chLabel}</span>
                      {(rText?.bound || rImg?.bound) && <span style={{ marginLeft:'auto', ...MONO, fontSize:9, color:T.faint, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rText?.path || rImg?.path}</span>}
                    </div>

                    {/* Mode buttons */}
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {(modes as any[]).map((m: any) => {
                        const on = curMode === m.k;
                        return (
                          <button key={m.k} onClick={() => setSrcOf(b, ch, { mode: m.k })} style={{
                            display:'flex', alignItems:'center', gap:8, padding:'7px 9px',
                            border:`1px solid ${on ? T.text : '#DEDEDA'}`,
                            borderRadius:8, background: on ? '#F4F4F2' : '#FFFFFF', cursor:'pointer', textAlign:'left' as const,
                          }}>
                            <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background: on ? T.text : T.faint }} />
                            <span style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:1 }}>
                              <span style={{ ...BODY_F, fontSize:11, fontWeight: on ? 700 : 500, color: on ? T.text : T.mid }}>{m.label}</span>
                              <span style={{ ...MONO, fontSize:9, color:T.faint }}>{m.path ?? (m.max ? `max ${m.max}` : '')}</span>
                            </span>
                            {m.n > 0 && <span style={{ flexShrink:0, ...MONO, fontSize:9, color:T.faint }}>{m.n}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Field picker (text mode with fields) */}
                    {isText && modeDef?.fields?.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ ...MONO, fontSize:9.5, fontWeight:600, color:T.dim }}>field</span>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {(modeDef.fields as [string,string][]).map(([fk, fl]) => {
                            const on = s.field === fk;
                            return (
                              <button key={fk} onClick={() => setSrcOf(b, ch, { field: fk })} style={{
                                border:`1px solid ${on ? T.text : '#DEDEDA'}`, borderRadius:6,
                                background: on ? T.text : '#FFFFFF', color: on ? '#fff' : T.mid,
                                ...BODY_F, fontSize:10.5, padding:'4px 9px', cursor:'pointer',
                              }}>{fl}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Index slider */}
                    {(modeDef as any)?.n > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ ...MONO, fontSize:9.5, fontWeight:600, color:T.dim }}>รายการที่ใช้พรีวิว</span>
                        <div style={{ display:'flex', gap:9, alignItems:'center' }}>
                          <input type="range" min={0} max={(modeDef as any).n - 1} step={1}
                            value={s.idx ?? 0}
                            onChange={e => setSrcOf(b, ch, { idx: Number(e.target.value) })}
                            style={{ flex:1, minWidth:0, accentColor: T.active }}
                          />
                          <span style={{ flexShrink:0, border:T.border, borderRadius:7, background:T.bg, padding:'3px 7px', ...MONO, fontSize:11, fontWeight:600, color:T.text }}>
                            #{(s.idx ?? 0) + 1}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Key input (copy mode) */}
                    {isText && curMode === 'copy' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ ...MONO, fontSize:9.5, fontWeight:600, color:T.dim }}>copy key</span>
                        <input
                          value={s.key ?? ''}
                          onChange={e => setSrcOf(b, ch, { key: e.target.value })}
                          placeholder="เช่น group_title"
                          style={{ border:T.border, borderRadius:7, padding:'6px 8px', ...MONO, fontSize:11, outline:'none', width:'100%', boxSizing:'border-box' as const }}
                        />
                      </div>
                    )}

                    {/* Count slider (list mode) */}
                    {isList && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ ...MONO, fontSize:9.5, fontWeight:600, color:T.dim }}>จำนวนรายการ</span>
                        <div style={{ display:'flex', gap:9, alignItems:'center' }}>
                          <input type="range" min={1} max={(SRC_LIST.find(m => m.k === curMode)?.max ?? 5)} step={1}
                            value={s.count ?? 3}
                            onChange={e => setSrcOf(b, ch, { count: Number(e.target.value) })}
                            style={{ flex:1, minWidth:0, accentColor: T.active }}
                          />
                          <span style={{ flexShrink:0, border:T.border, borderRadius:7, background:T.bg, padding:'3px 7px', ...MONO, fontSize:11, fontWeight:600, color:T.text }}>
                            {s.count ?? 3}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Fallback picker */}
                    {(rText?.bound || rImg?.bound || isList) && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ ...MONO, fontSize:9.5, fontWeight:600, color:T.dim }}>ถ้าข้อมูลว่าง</span>
                        <div style={{ display:'flex', gap:4 }}>
                          {([['hide','ซ่อน'],['placeholder','แสดง placeholder'],['manual','ใช้ค่าที่พิมพ์เอง']] as [string,string][]).map(([fk, fl]) => {
                            const on = (s.fallback ?? 'manual') === fk;
                            return (
                              <button key={fk} onClick={() => setSrcOf(b, ch, { fallback: fk })} style={{
                                border:`1px solid ${on ? T.text : '#DEDEDA'}`, borderRadius:6,
                                background: on ? T.text : '#FFFFFF', color: on ? '#fff' : T.mid,
                                ...BODY_F, fontSize:10, padding:'4px 8px', cursor:'pointer',
                              }}>{fl}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Resolved value */}
                    {(rText?.bound || rImg?.bound) && (
                      <div style={{ borderRadius:6, background:'#F4F4F2', padding:'5px 8px', ...MONO, fontSize:10, color: (rText?.ok || rImg?.ok) ? T.text : T.dim }}>
                        {rText?.ok ? `✓ "${rText.value}"` : rImg?.ok ? `✓ มีรูป` : `— ข้อมูลว่าง (${s.fallback})`}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Pattern tiles (if slot has a pattern family) */}
              {(() => {
                const fam = PATTERN_OF[b.id];
                if (!fam) return null;
                const tiles = PAT_TILES[fam];
                if (!tiles) return null;
                const curPat = b.pat?.[fam] ?? { solo:'portrait', pair:'tilt', group:'fan', chip:'pill' }[fam];
                const famLabel: Record<string,string> = { solo:'รูปทรงภาพ (solo)', pair:'การจัดเรียงคู่', group:'การจัดเรียงกลุ่ม', chip:'รูปแบบชิป' };
                return (
                  <Field key="pat" label={famLabel[fam] || 'Pattern'} path={`pat.${b.uid}.${fam}`}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {Object.entries(tiles).map(([val, [label, shapes]]) => {
                        const on = curPat === val;
                        const isGrid = fam === 'group' && val === 'grid';
                        return (
                          <button
                            key={val}
                            onClick={() => updatePat(b.uid, fam, val)}
                            style={{ display:'flex', flexDirection:'column', gap:6, flex:1, minWidth:0, boxSizing:'border-box' as const,
                              border:`${on ? 1.5 : 1}px solid ${on ? '#16181A' : '#DEDEDA'}`,
                              borderRadius:10, background: on ? '#F4F4F2' : '#FFFFFF', padding:7, cursor:'pointer' }}
                          >
                            {/* Shape preview box */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:42, borderRadius:7, background:'#F7F1E3', overflow:'hidden' }}>
                              {isGrid
                                ? <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3, width:44 }}>
                                    {shapes.slice(1).map((s, i) => <div key={i} style={css2obj(s)} />)}
                                  </div>
                                : shapes.map((s, i) => <div key={i} style={css2obj(s)} />)
                              }
                            </div>
                            <span style={{ ...BODY_F, fontSize:9.5, fontWeight: on ? 700 : 500, color: on ? '#16181A' : T.mid, textAlign:'center', lineHeight:1.3 }}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                );
              })()}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Specimen ───────────────────────────────────────────────────────────────
  const specimenName = section === 'color' ? 'COLOR SPECIMEN' : section === 'type' ? 'TYPE SPECIMEN' : section === 'art' ? 'ART SPECIMEN' : section === 'logo' ? 'LOGO SPECIMEN' : 'SHAPE & ART SPECIMEN';

  const renderLogoSpecimen = () => {
    const logoUrl = (appearance as any).logo_url || '';
    const logoH = (appearance as any).logo_height ?? 28;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 18px', borderRadius: 10, background: tok.bg, border: '1px solid #E7E7E3' }}>
        <div>
          <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#8A8F94', marginBottom: 12 }}>LOGO บน HEADER BAR</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1E1E1E', borderRadius: 8 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ height: logoH, width: 'auto', display: 'block' }} />
            ) : (
              <div style={{ height: logoH, minWidth: logoH * 2, boxSizing: 'border-box', border: '1px dashed rgba(255,255,255,.4)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', ...MONO, fontSize: 9, color: 'rgba(255,255,255,.5)' }}>LOGO</div>
            )}
            <span style={{ ...BODY_F, fontSize: 12, color: '#fff', fontWeight: 600 }}>{oaTitle}</span>
          </div>
          <div style={{ ...BODY_F, fontSize: 11, color: '#A0A5AA', marginTop: 10 }}>ความสูง {logoH}px — ปรับ Logo Height แล้วโลโก้ในแถบนี้จะย่อ/ขยายตาม</div>
        </div>
      </div>
    );
  };

  const ART_SHAPE_LABEL: Record<string, string> = { card: 'การ์ด 3:4', circle: 'วงกลม', square: 'สี่เหลี่ยมจัตุรัส', wide: 'แบนเนอร์ 16:9', none: 'ไม่ใช้ภาพ' };
  const ART_FRAME_LABEL: Record<string, string> = { outline: 'Outline', soft: 'Soft', flat: 'Flat' };
  const ART_HERO_LABEL: Record<string, string> = { pair: 'ภาพ 2 ชิ้นเอียงชนกัน', single: 'ภาพเดียวกลางจอ', band: 'แถบสีพร้อมข้อความ' };

  const renderArtSpecimen = () => {
    const photoBg  = 'linear-gradient(160deg,#D8A38B,#C4623A)';
    const photoBg2 = 'linear-gradient(160deg,#9FC7D6,#5FA0B8)';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 18px', borderRadius: 10, background: tok.bg, border: '1px solid #E7E7E3' }}>
        <div>
          <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#8A8F94', marginBottom: 12 }}>ART SHAPE × ART FRAME</div>
          {tok.artShape === 'none' ? (
            <div style={{ ...BODY_F, fontSize: 12.5, color: tok.ink, background: tok.card, border: tokC.bd, borderRadius: 10, padding: '14px 16px' }}>
              ไม่ใช้ภาพ — โชว์ตัวอักษร/สีแทน
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <span style={css2obj(artStyle(100, photoBg))} />
              <span style={{ ...MONO, fontSize: 11, color: '#8A8F94', paddingBottom: 4 }}>{ART_SHAPE_LABEL[tok.artShape]} · frame: {ART_FRAME_LABEL[tok.artFrame]}</span>
            </div>
          )}
        </div>
        <div>
          <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#8A8F94', marginBottom: 12 }}>ART HERO (PAIR RESULT)</div>
          {tok.artHero === 'pair' && (
            <div style={{ position: 'relative', height: 150 }}>
              <span style={{ ...css2obj(artStyle(112, photoBg2)), position: 'absolute', left: 0, top: 14, transform: 'rotate(-8deg)' }} />
              <span style={{ ...css2obj(artStyle(112, photoBg)), position: 'absolute', left: 64, top: 0, transform: 'rotate(8deg)' }} />
            </div>
          )}
          {tok.artHero === 'single' && (
            <span style={css2obj(artStyle(150, photoBg))} />
          )}
          {tok.artHero === 'band' && (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 10, background: tok.hl, border: tokC.bd, ...MONO, fontSize: 12, fontWeight: 700, color: tok.ink }}>
              ไม่ใช้ภาพ — แถบสี + ข้อความ
            </span>
          )}
          <div style={{ ...BODY_F, fontSize: 11, color: '#A0A5AA', marginTop: 10 }}>{ART_HERO_LABEL[tok.artHero]}</div>
          <div style={{ ...BODY_F, fontSize: 10.5, color: '#C9531F', marginTop: 6 }}>ใช้กับ Pair Result เท่านั้น — Matching ใช้ภาพ 2 ชิ้นเอียงชนกันตายตัวเสมอ, Group Result มี pattern ของตัวเองแยกต่างหาก (ดูด้านล่าง)</div>
        </div>
        <div>
          <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#8A8F94', marginBottom: 12 }}>GROUP HERO PATTERN</div>
          {tok.groupHeroPattern === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, width: 180 }}>
              {[0,1,2,3,4,5].map(i => <span key={i} style={css2obj(artStyle(46, i % 2 ? photoBg2 : photoBg))} />)}
            </div>
          ) : (
            <div style={{ position: 'relative', height: 70, width: 220 }}>
              {[0,1,2,3,4].map(i => (
                <span key={i} style={{ ...css2obj(artStyle(48, i % 2 ? photoBg2 : photoBg)), position: 'absolute', left: i * 32, bottom: 0, transform: `rotate(${(i - 2) * 10}deg)` }} />
              ))}
            </div>
          )}
          <div style={{ ...BODY_F, fontSize: 11, color: '#A0A5AA', marginTop: 10 }}>ใช้ตอน Group Result reveal = "members" เท่านั้น</div>
        </div>
        <div>
          <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#8A8F94', marginBottom: 12 }}>PROGRESS BAR STYLE — แยกตามจอ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([['Loading', tok.progressStyleLoading], ['Question', tok.progressStyleQuestion], ['Matching', tok.progressStyleMatching], ['Group Result', tok.progressStyleGroup]] as [string, string][]).map(([scr, st]) => (
              <div key={scr} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ ...MONO, fontSize: 10.5, color: '#8A8F94', width: 82, flexShrink: 0 }}>{scr}</span>
                <span style={{ display: 'block', flex: 1, boxSizing: 'border-box', height: 12, border: tokC.bd2, borderRadius: tok.progressRadius, overflow: 'hidden', background: tok.card }}>
                  <span style={{ display: 'block', height: '100%', width: st === 'compact' ? '45%' : '82%', background: st === 'bar' ? tok.primary : `repeating-linear-gradient(115deg,${tok.primary} 0 10px,${tok.hl} 10px 18px)` }} />
                </span>
              </div>
            ))}
          </div>
          <div style={{ ...BODY_F, fontSize: 11, color: '#A0A5AA', marginTop: 10 }}>ตั้งลาย/ความยาวได้ทีละจอ — มุมโค้งคุมรวมที่ Shape & Feel</div>
        </div>
      </div>
    );
  };

  const renderSpecimen = () => {
    // Pass resolved tok values so all specimens use the same effective colors as LIFF
    const resolvedColors = {
      primary:     tok.primary,
      on_primary:  tok.onPrimary,
      background:  tok.bg,
      surface:     tok.card,
      on_surface:  tok.ink,
      muted:       tok.ink2,
      highlight:   tok.hl,
      accent:      tok.accent,
      accent_soft: tok.soft,
      line_green:  tok.line,
      danger:      tok.danger,
    };
    if (section === 'color') return <ColorSpecimen colors={resolvedColors} />;
    if (section === 'type') return <TypeSpecimen fontDisplay={appearance.font_display} fontBody={appearance.font_body} fontAccent={appearance.font_accent} surface={resolvedColors.surface} onSurface={resolvedColors.on_surface} />;
    if (section === 'art') return renderArtSpecimen();
    if (section === 'logo') return renderLogoSpecimen();
    return <ShapeSpecimen colors={resolvedColors} fontBody={appearance.font_body} fontDisplay={appearance.font_display} radius={appearance.radius} cardRadius={(appearance as any).card_radius} borderWidth={appearance.border_width} shadowOffset={appearance.shadow_offset} shadow={appearance.shadow} progressStyle={tok.progressStyleLoading} progressRadius={tok.progressRadius} axisChipRadius={tok.axisChipRadius} badgeRadius={tok.badgeRadius} tilt={appearance.tilt} texture={appearance.texture} />;
  };

  // ── Derived display ───────────────────────────────────────────────────────
  const colTitle = isScreenSection
    ? (SCREENS_V3.find(s => s.k === screen)?.label ?? screen)
    : (SECTIONS.find(s => s[0] === section)?.[2] ?? section);
  const colHint = isScreenSection
    ? (SCREEN_META[screen]?.parts ?? '')
    : (SECTIONS.find(s => s[0] === section)?.[3] ?? '');

  // LIFF Setup (ID / endpoint / window size) has no visual specimen — skip the canvas.
  const showCanvas = section !== 'liff';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', background: T.bg }}>

      {/* Hidden file inputs */}
      <input ref={fontFileRef} type="file" accept=".woff,.woff2,.ttf,.otf" style={{ display: 'none' }} onChange={onFontFile} />
      <input ref={imgFileRef}  type="file" accept="image/*" style={{ display: 'none' }} onChange={onImgFile} />

      {/* ── Nav (order:0, 212px) ── */}
      <div style={{ flexShrink: 0, order: 0, width: 212, borderRight: T.border, background: T.panel, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '13px 13px 6px', ...MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', color: T.dim }}>APPEARANCE</div>
        {SECTIONS.map(([key, num, label]) => {
          const on = section === key;
          return (
            <button key={key} onClick={() => handleAppearanceClick(key)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', boxSizing: 'border-box', border: 'none', borderLeft: `3px solid ${on ? T.active : 'transparent'}`, background: on ? T.bg : 'transparent', padding: '8px 12px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ ...MONO, fontSize: 10.5, fontWeight: 500, color: on ? T.active : T.faint }}>{num}</span>
              <span style={{ ...MONO, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? T.text : T.mid }}>{label}</span>
            </button>
          );
        })}
        <div style={{ height: 1, background: T.divider, margin: '11px 0' }} />
        <div style={{ padding: '0 13px 6px', ...MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', color: T.dim }}>หน้าจอ LIFF</div>
        {visibleScreens.map(s => {
          const on = section === `screen:${s.k}`;
          const count = getLayout(s.k).filter(b => b.show).length;
          return (
            <button key={s.k} onClick={() => handleScreenClick(s.k)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', border: 'none', borderLeft: `3px solid ${on ? T.active : 'transparent'}`, background: on ? T.bg : 'transparent', padding: '8px 12px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'block', flexShrink: 0, background: on ? T.active : '#DEDEDA' }} />
              <span style={{ flex: 1, ...MONO, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? T.text : T.mid }}>{s.label}</span>
              <span style={{ flexShrink: 0, ...MONO, fontSize: 9.5, fontWeight: 600, color: T.faint }}>{count}</span>
            </button>
          );
        })}
        <div style={{ height: 22, flexShrink: 0 }} />
      </div>

      {/* ── Canvas (order:1, flex:1) — hidden for LIFF Setup tab ── */}
      {showCanvas && (
      <div style={{ flex: 1, order: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: T.prevBg, minHeight: 0 }}>
        {/* Canvas toolbar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: T.border, background: T.prevHdr }}>
          <div style={{ display: 'flex', gap: 3, border: T.border, borderRadius: 8, background: T.panel, padding: 3 }}>
            {(isScreenSection ? [['preview','พรีวิว'],['json','JSON']] : [['specimen','Specimen'],['preview','หน้าจอ']] as [string,string][]).map(([p, lbl]) => (
              <button key={p} onClick={() => setPane(p as any)} style={{ border: 'none', borderRadius: 6, padding: '6px 10px', background: pane_ === p ? T.text : 'transparent', color: pane_ === p ? '#fff' : T.mid, ...MONO, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', ...MONO, fontSize: 10, color: T.dim }}>375 × {vpH} · {liffSize}</span>
        </div>

        {/* Preview pane — delegated to LayoutEditor component */}
        {pane_ === 'preview' && (
          <LayoutEditor
            tok={tok}
            copy={effectiveCopy}
            blockImages={effectiveImages}
            screen={screen}
            oaTitle={oaTitle}
            layout={curLayout}
            sel={sel}
            drag={drag}
            over={over}
            pat={editorPat}
            onSelect={uid => { setSel(uid); setView('props'); }}
            onDragStart={(uid, e) => { setDrag({ uid }); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={uid => { if (over !== uid) setOver(uid); }}
            onDrop={(_, toUid) => { if (drag?.uid) moveBlock(drag.uid, toUid); else if (drag?.newSlot) insertBlock(drag.newSlot, toUid); setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            onToggleShow={uid => setLayout(screen, curLayout.map(x => x.uid === uid ? { ...x, show: !x.show } : x))}
            onRemove={uid => setLayout(screen, curLayout.filter(x => x.uid !== uid))}
            onMoveUp={uid => { const i = curLayout.findIndex(x => x.uid === uid); if (i > 0) moveBlock(uid, curLayout[i-1].uid); }}
            onMoveDown={uid => { const i = curLayout.findIndex(x => x.uid === uid); if (i < curLayout.length - 1) { const n = [...curLayout]; const it = n.splice(i,1)[0]; n.splice(i+1,0,it); setLayout(screen, n); } }}
            pos={editorPos}
            snap={snap}
            onMoveFloat={(uid, x, y) => {
              const b = curLayout.find(bl => bl.uid === uid);
              if (b) { updatePosField(b, 'x', x); updatePosField(b, 'y', y); }
            }}
          />
        )}

        {/* Specimen pane */}
        {pane_ === 'specimen' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 14px 40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#8A8F94' }}>{specimenName}</div>
              {renderSpecimen()}
            </div>
          </div>
        )}

        {/* JSON pane */}
        {pane_ === 'json' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 14px 40px', background: '#22262A' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
              <button onClick={() => copyJson(true)} style={{ border: '1px solid #3A3E42', borderRadius: 7, background: '#22262A', color: '#EDEDE9', padding: '7px 10px', ...BODY_F, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⧉ คัดลอกพร้อมโน้ต</button>
              <button onClick={() => copyJson(false)} style={{ border: '1px solid #3A3E42', borderRadius: 7, background: '#22262A', color: '#EDEDE9', padding: '7px 10px', ...BODY_F, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⧉ คัดลอกแบบใช้งานจริง</button>
              {copyMsg && <span style={{ alignSelf: 'center', ...BODY_F, fontSize: 10.5, fontWeight: 600, color: '#7ED9A7' }}>{copyMsg}</span>}
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', padding: '7px 9px', border: '1px solid #33383D', borderRadius: 8, background: '#1B1F23', marginBottom: 9 }}>
              <span style={{ ...MONO, fontSize: 9.5, fontWeight: 600, color: '#E8354F' }}>🔒 slot / binding / navigation</span>
              <span style={{ ...MONO, fontSize: 9.5, fontWeight: 600, color: '#7AC4D6' }}>🔗 token</span>
              <span style={{ ...MONO, fontSize: 9.5, fontWeight: 600, color: '#F5E14B' }}>🎨 ลำดับ / geometry / ข้อความ</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', background: '#15181B', border: '1px solid #2C3136', borderRadius: 9, overflow: 'hidden' }}>
              {jsonModel().map((l, i) => {
                const tint: Record<string,string> = { lock: '#E8354F', bound: '#7AC4D6', free: '#F5E14B', '': '#5A6068' };
                const icon: Record<string,string> = { lock: '🔒', bound: '🔗', free: '🎨', '': '' };
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 9px', borderLeft: `2px solid ${tint[l.kind] || tint['']}`, background: l.kind === 'lock' ? 'rgba(232,53,79,.07)' : l.kind === 'bound' ? 'rgba(122,196,214,.06)' : l.kind === 'free' ? 'rgba(245,225,75,.06)' : 'transparent' }}>
                    <span style={{ flexShrink: 0, width: 13, fontSize: 9, lineHeight: 1.7, opacity: l.kind ? 1 : 0 }}>{icon[l.kind] || ''}</span>
                    <span style={{ flexShrink: 0, whiteSpace: 'pre', ...MONO, fontSize: 10.5, lineHeight: 1.7, color: l.kind === 'lock' ? '#FFB3BE' : l.kind === 'bound' ? '#B7E4EE' : l.kind === 'free' ? '#F6EBAF' : '#C6CBD1' }}>{'  '.repeat(l.indent)}{l.ref}</span>
                    {l.note && <span style={{ flex: 1, minWidth: 0, ...BODY_F, fontSize: 9.5, lineHeight: 1.7, color: '#7C838B', textAlign: 'right' }}>{l.note}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Grip (order:2, 9px) — hidden for LIFF Setup ── */}
      {showCanvas && (
      <div onMouseDown={startResize} style={{ flexShrink: 0, order: 2, width: 9, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: resizing ? '#E4E4E0' : T.prevBg, borderLeft: T.border }}>
        <span style={{ display: 'block', width: 2, height: 26, borderRadius: 2, background: T.faint }} />
      </div>
      )}

      {/* ── Config column (order:3, resizable right when canvas is shown, full-width otherwise) ── */}
      <div style={{ flexShrink: 0, order: 3, width: showCanvas ? cfgW : '100%', flex: showCanvas ? 'none' : 1, display: 'flex', flexDirection: 'column', background: T.panel, borderLeft: showCanvas ? T.border : 'none', minHeight: 0 }}>
        {/* Config header */}
        <div style={{ flexShrink: 0, padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: T.text }}>{colTitle}</span>
            <span style={{ ...BODY_F, fontSize: 11, color: '#8A8F94' }}>{colHint}</span>
          </div>
          {isScreenSection && (
            <div style={{ display: 'flex', gap: 3, borderBottom: `1px solid ${T.divider}` }}>
              {([['fields','รายการฟิลด์'],['props','บล็อกที่เลือก'],['add','เพิ่มบล็อก'],['art','Shape & Feel']] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setView(k)} style={{ border: 'none', background: 'none', padding: '8px 11px', cursor: 'pointer', ...BODY_F, fontSize: 12, fontWeight: view === k ? 700 : 500, color: view === k ? T.text : T.dim, boxShadow: view === k ? `inset 0 -2px 0 ${T.active}` : 'none' }}>{lbl}</button>
              ))}
            </div>
          )}
        </div>
        {/* Config body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '13px 14px 44px', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {isScreenSection ? renderScreenConfig() : renderGlobalConfig()}
        </div>
      </div>
    </div>
  );
}
