import { useState, useRef, useEffect, useCallback } from 'react';
import type { Brand, GroupConfig } from '../../types';
import { buildFlexJson, type FlexEventId, type BuildAxis, type BuildResult, type CardLayoutOpts } from '../../utils/buildFlexJson';
import FlexBubblePreview from '../FlexBubblePreview';

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
};
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono','JetBrains Mono',monospace" };
const BODY_F: React.CSSProperties = { fontFamily: "'Noto Sans Thai','Bai Jamjuree',sans-serif" };

// ── Card definitions ───────────────────────────────────────────────────────

interface FlexLabel { key: string; label: string; hint: string; placeholder: string; multiline?: boolean }
interface FlexCard {
  id: string;
  mark: string;
  group: string;
  label: string;
  title: string;
  desc: string;
  modes: string[];
  hero: boolean;
  heroRatio: string;
  img?: [string, string, string];   // [key, label, hint]
  labels: FlexLabel[];
  parts: string;
}

const FLEX_CARDS: FlexCard[] = [
  {
    id: 'f01', mark: 'F-01', group: 'ชวน',
    label: 'ชวนจับคู่ 1:1', title: 'การ์ดชวนเพื่อนจับคู่',
    desc: 'ส่งผ่าน shareTargetPicker เมื่อกด "เชิญเพื่อน" — ไปอยู่ในแชทของเพื่อน',
    modes: ['pair', 'group'], hero: true, heroRatio: '20:13',
    img: ['f01_hero', 'ภาพหัวการ์ดชวนจับคู่', 'แนะนำ 1200×780 px'],
    parts: 'hero · badge · หัวเรื่อง · บรรทัดรอง · ปุ่ม 2 ปุ่ม',
    labels: [
      { key: 'F01_eyebrow', label: 'Badge บนสุด',    hint: 'แสดงด้านบนสุดของการ์ด',                      placeholder: 'DUO QUIZ · 6 ข้อ' },
      { key: 'F01_title',   label: 'หัวเรื่อง',       hint: 'ข้อความหลักของการ์ด',                         placeholder: 'มาดูว่าถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน!', multiline: true },
      { key: 'F01_body',    label: 'บรรทัดรอง',       hint: 'ใช้ {name} แทนชื่อคนชวน',                    placeholder: '{name} ชวนคุณมาตอบ 6 ข้อ ไม่ถึงนาที', multiline: true },
      { key: 'F01_cta1',   label: 'ปุ่มหลัก',        hint: 'ลิงก์ไปหน้าคำถาม · URL ล็อกอยู่',            placeholder: 'เริ่มตอบ · 1 นาที' },
      { key: 'F01_cta2',   label: 'ปุ่มรอง',         hint: 'ลิงก์ไปหน้า Summary ของคนชวน · URL ล็อกอยู่', placeholder: 'ดูผลคู่กับฉัน' },
    ],
  },
  {
    id: 'f10', mark: 'F-10', group: 'ชวน',
    label: 'ชวนเข้าทีม', title: 'การ์ดชวนเข้าทีม (ลงกลุ่ม LINE)',
    desc: 'ส่งผ่าน shareTargetPicker → กลุ่ม LINE · hero = header count + 5 member slots · body = locked result + progress + body text',
    modes: ['group'], hero: true, heroRatio: '20:13',
    parts: 'hero (member slots) · locked result box · progress bar · body text · ปุ่ม 2 ปุ่ม',
    labels: [
      { key: 'group_invite_title', label: 'Alt text (LINE notification)', hint: 'ข้อความบน chat preview ก่อนเปิดการ์ด', placeholder: 'ทีมนี้ 1/5 คน — ตอบ 6 ข้อแล้วมาเติมทีม' },
      { key: 'F10_header',       label: 'Header (hero บนสุด)', hint: 'ใช้ {n} แทนจำนวนที่ยังขาด', placeholder: 'อีก {n} คน ผลทีมจะเปิด' },
      { key: 'F10_locked_title', label: 'ชื่อผลที่ล็อก',       hint: 'ใน dark box',              placeholder: 'ผลของทีมนี้ยังไม่เปิด' },
      { key: 'F10_locked_body',  label: 'คำอธิบายผลล็อก',      hint: 'ใช้ {n} แทนจำนวนสมาชิก', placeholder: 'ครบ {n} คนแล้วเปิดพร้อมกันทุกคน', multiline: true },
      { key: 'F10_body',         label: 'ข้อความรอง',           hint: '',                         placeholder: 'ชื่อก๊วน จำนวนวันที่รอด และผลคู่กับทุกคนในทีม จะโผล่ทีเดียวเมื่อสายที่ 5 เข้ามา', multiline: true },
      { key: 'F10_cta1',         label: 'ปุ่มหลัก',             hint: 'URL ล็อกอยู่',             placeholder: 'ตอบ 6 ข้อ แล้วเข้าทีมนี้' },
      { key: 'F10_cta2',         label: 'ปุ่มรอง',              hint: 'URL ล็อกอยู่',             placeholder: 'ชวนเพื่อนอีก {n} คน' },
    ],
  },
  {
    id: 'f05', mark: 'F-05', group: 'ชวน',
    label: 'เตือนกลับมาจัดทีม', title: 'การ์ดแจ้งเตือน cron push (48h)',
    desc: 'OA push หาเจ้าของทีมเมื่อมีคนในรายชื่อ ≥2 คน แต่ยังไม่ได้บันทึกทีมใน 48 ชม.',
    modes: ['group'], hero: false, heroRatio: '20:13',
    parts: 'eyebrow · title · body text · 5 flat slot boxes · ปุ่ม 1 ปุ่ม',
    labels: [
      { key: 'F10_remind_badge',    label: 'Eyebrow',    hint: 'ข้อความสีหลักด้านบน',    placeholder: 'ทีมของคุณยังไม่ครบ' },
      { key: 'F10_remind_headline', label: 'หัวเรื่อง',  hint: 'ใช้ {n} แทนจำนวนสมาชิก', placeholder: 'มี {n} คนรออยู่ในรายชื่อ' },
      { key: 'F10_remind_sub',      label: 'ข้อความรอง', hint: '',                         placeholder: 'ครบ 5 สายจะได้ผลทีมพร้อมกัน ตอนนี้ยังขาดอีกหนึ่งสาย', multiline: true },
      { key: 'F10_remind_cta',      label: 'ปุ่ม',       hint: 'URL ล็อกอยู่',             placeholder: 'กลับไปจัดทีม' },
    ],
  },
  {
    id: 'f02', mark: 'F-02', group: 'แชร์ผล',
    label: 'แชร์ผลตัวเอง', title: 'การ์ดแชร์ผลตัวเอง',
    desc: 'ส่งผ่าน shareTargetPicker เมื่อกด "แชร์ผล" — ไปอยู่ในแชทปลายทาง',
    modes: ['solo', 'mbti', 'pair', 'group'], hero: true, heroRatio: '9:13',
    parts: 'hero (axis card) · badge · ชื่อ axis · body · ปุ่ม 1-2 ปุ่ม',
    labels: [
      { key: 'F02_eyebrow', label: 'Badge text', hint: 'แสดงเหนือชื่อผลลัพธ์',                            placeholder: 'สายของฉันคือ' },
      { key: 'F02_cta1',   label: 'ปุ่มหลัก',   hint: 'ลิงก์พาไปเล่น quiz · URL ล็อกอยู่',             placeholder: 'เล่นดูว่าคุณสายไหน' },
      { key: 'F02_cta2',   label: 'ปุ่มรอง',    hint: 'pair เท่านั้น · ซ่อนอัตโนมัติใน solo · URL ล็อก', placeholder: 'ดูผลคู่กับฉัน' },
    ],
  },
  {
    id: 'fpair', mark: 'F-06', group: 'แชร์ผล',
    label: 'แชร์ผลคู่', title: 'การ์ดแชร์ผลคู่',
    desc: 'ส่งผ่าน shareTargetPicker เมื่อดูหน้า PairResult — มี axis chips ของทั้งคู่',
    modes: ['pair', 'group'], hero: true, heroRatio: '20:13',
    img: ['fpair_hero', 'ภาพพื้นหลังผลคู่', 'แนะนำ 1200×780 px'],
    parts: 'hero · badge · หัวเรื่อง · axis chips คู่ · ปุ่ม 2 ปุ่ม',
    labels: [
      { key: 'FPAIR_eyebrow', label: 'Badge',     hint: '',                              placeholder: 'ผลคู่ของเรา' },
      { key: 'FPAIR_title',   label: 'หัวเรื่อง', hint: 'ใช้ {n} แทนคะแนน/วัน',         placeholder: 'เราสองคนรอดได้ {n} วัน!', multiline: true },
      { key: 'FPAIR_cta1',   label: 'ปุ่มหลัก',  hint: 'URL ล็อกอยู่',                  placeholder: 'ดูผลของเรา' },
      { key: 'FPAIR_cta2',   label: 'ปุ่มรอง',   hint: 'URL ล็อกอยู่',                  placeholder: 'เชิญเพื่อนคนอื่น' },
    ],
  },
  {
    id: 'f03', mark: 'F-03', group: 'Push',
    label: 'ผลคู่พร้อมแล้ว', title: 'Pair Result (push to inviter)',
    desc: 'Server push ไปหา A เมื่อ B ตอบครบ — แจ้งว่าผลพร้อมแล้ว ส่งใน OA chat',
    modes: ['pair', 'group'], hero: true, heroRatio: '20:13',
    img: ['f03_hero', 'ภาพ hero (ถ้ามีจะใช้แทน 2 ใบ)', 'ถ้าไม่อัปโหลด จะแสดงการ์ดผลเดียว 2 ใบบนพื้นเหลือง'],
    parts: 'hero (custom หรือ 2 axis images บนพื้นเหลือง) · badge · คะแนน · บรรทัดรอง · chip คู่ · ปุ่ม',
    labels: [
      { key: 'F03_eyebrow', label: 'Badge pill',   hint: 'แถบ pill สีเหลืองบน body',              placeholder: 'คู่นี้รอดได้' },
      { key: 'F03_title',   label: 'บรรทัดรอง',   hint: 'ข้อความใต้คะแนน · ใช้ {partner} แทนชื่อ B', placeholder: '{partner} ตอบแล้ว! มาดูผลกัน', multiline: true },
      { key: 'F03_body',    label: 'ข้อความเสริม', hint: 'บอก context ผลลัพธ์',                   placeholder: 'คุณสองคนเข้ากันได้แค่ไหน?' },
      { key: 'F03_cta',     label: 'ปุ่ม',         hint: 'URL ล็อกอยู่',                          placeholder: 'ดูผลคู่แบบเต็ม' },
    ],
  },
  {
    id: 'f04', mark: 'F-04', group: 'Push',
    label: 'แจ้งเตือนคู่หูตอบ', title: 'Partner Done (notification)',
    desc: 'Push notification LINE เมื่อคู่หูตอบครบ — แสดงเป็น banner บนมือถือ',
    modes: ['pair', 'group'], hero: false, heroRatio: '20:13',
    parts: 'thumbnail ข้างข้อความ · หัว · body · ปุ่ม',
    labels: [
      { key: 'F04_title', label: 'หัว notification', hint: 'สั้น เห็นบน lock screen', placeholder: 'คู่หูตอบแล้ว มาดูผลกัน' },
      { key: 'F04_body',  label: 'เนื้อหา',          hint: 'ขยายความเล็กน้อย',       placeholder: 'กดเพื่อดูว่าคุณสองคนเข้ากันแค่ไหน' },
      { key: 'F04_cta',   label: 'ปุ่ม',             hint: 'URL ล็อกอยู่',           placeholder: 'ดูผลลัพธ์' },
    ],
  },
  {
    id: 'fgrp', mark: 'F-GRP', group: 'กลุ่ม',
    label: 'ผลทีมเปิดแล้ว', title: 'Group Result (ผลทีม)',
    desc: 'Push ไปหาทุกสมาชิกเมื่อทีมครบ — hero = archetype symbol · body = eyebrow + big title + body text + archetype grid (3+2)',
    modes: ['group'], hero: true, heroRatio: '20:13',
    img: ['fgrp_hero', 'ภาพ hero (archetype symbol)', 'แนะนำ 1200×780 px · dark bg'],
    parts: 'hero (archetype symbol image) · eyebrow · หัวเรื่อง survival · body · archetype grid 3+2 · ปุ่ม',
    labels: [
      { key: 'FGRP_eyebrow', label: 'Eyebrow',         hint: 'ข้อความสีเทาด้านบน',                                 placeholder: 'ผลทีมของคุณ' },
      { key: 'FGRP_title',   label: 'หัวเรื่อง survival', hint: 'ใช้ {days} แทนคะแนน · ขึ้นใหญ่ bold',             placeholder: 'ทีมนี้รอดได้ {days} วัน!', multiline: true },
      { key: 'FGRP_body',    label: 'คำอธิบาย',        hint: 'คำอธิบาย archetype (fallback ถ้าไม่มีใน archetype config)', placeholder: 'ทีมที่สมดุล ทักษะครบ รอดได้นานสุด', multiline: true },
      { key: 'FGRP_cta',     label: 'ปุ่ม',            hint: 'URL ล็อกอยู่',                                       placeholder: 'ดูผลทีม' },
    ],
  },
  {
    id: 'f08', mark: 'F-08', group: 'กลุ่ม',
    label: 'ปลดล็อกสัญลักษณ์', title: 'Symbol Unlock Push',
    desc: 'Push เมื่อสมาชิกปลดล็อกสัญลักษณ์ใหม่ได้ — hero 1:1 (square)',
    modes: ['group'], hero: true, heroRatio: '1:1',
    img: ['f08_symbol', 'ภาพสัญลักษณ์', '200×200 px (square)'],
    parts: 'hero (symbol) · หัวเรื่อง · body · ปุ่ม',
    labels: [
      { key: 'F08_title', label: 'หัวเรื่อง', hint: '',              placeholder: 'ปลดล็อกสัญลักษณ์ใหม่แล้ว!', multiline: true },
      { key: 'F08_body',  label: 'body',      hint: '',              placeholder: 'สะสมให้ครบเพื่อดูความหมายซ่อน', multiline: true },
      { key: 'F08_cta',   label: 'ปุ่ม',      hint: 'URL ล็อกอยู่', placeholder: 'ดูสัญลักษณ์ทั้งหมด' },
    ],
  },
  {
    id: 'f09', mark: 'F-09', group: 'กลุ่ม',
    label: 'รางวัล / milestone', title: 'Reward Milestone Push',
    desc: 'Push เมื่อถึง milestone รางวัล — แสดงภาพรางวัล + CTA รับของ',
    modes: ['group'], hero: true, heroRatio: '20:13',
    img: ['f09_reward', 'ภาพรางวัล', 'แนะนำ 1200×780 px'],
    parts: 'hero (reward) · หัวเรื่อง · body · ปุ่มรับรางวัล',
    labels: [
      { key: 'F09_title', label: 'หัวเรื่อง', hint: '',              placeholder: 'รางวัลพิเศษรอคุณอยู่!', multiline: true },
      { key: 'F09_body',  label: 'body',      hint: '',              placeholder: 'ขอบคุณที่ร่วมกิจกรรม ของรางวัลพร้อมส่งแล้ว', multiline: true },
      { key: 'F09_cta',   label: 'ปุ่มรับรางวัล', hint: 'URL ล็อกอยู่', placeholder: 'รับรางวัล' },
    ],
  },
];

const CARD_GROUPS = [
  { key: 'ชวน',     label: 'ชวน (shareTargetPicker)' },
  { key: 'แชร์ผล',  label: 'แชร์ผล' },
  { key: 'Push',    label: 'Push จากระบบ' },
  { key: 'กลุ่ม',   label: 'กลุ่ม' },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  mode: string;
  copy: Record<string, string>;
  brand: Brand;
  axes?: BuildAxis[];
  results?: Record<string, BuildResult>;
  group?: GroupConfig;
  liffId?: string;
  appearance?: import('../../types').AppearanceConfig;
  onChange: (copy: Record<string, string>) => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Field({ label, hint, path, children }: { label: string; hint?: string; path?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <label style={{ ...BODY_F, fontSize: 11.5, fontWeight: 600, color: T.text }}>{label}</label>
        {path && <span style={{ ...MONO, fontSize: 9, color: T.faint }}>{path}</span>}
      </div>
      {children}
      {hint && <span style={{ ...BODY_F, fontSize: 10.5, color: T.dim, lineHeight: 1.4 }}>{hint}</span>}
    </div>
  );
}

function SegInput({ value, options, onChange }: {
  value: string;
  options: { v: string; label?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', border: T.border, borderRadius: 8, overflow: 'hidden', background: T.bg }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, padding: '6px 4px', border: 'none', cursor: 'pointer',
          ...MONO, fontSize: 10, fontWeight: value === o.v ? 700 : 400,
          background: value === o.v ? T.text : 'transparent',
          color: value === o.v ? '#FFFFFF' : T.mid,
          transition: 'background .12s',
        }}>{o.label ?? o.v}</button>
      ))}
    </div>
  );
}

// ── JSON colour-coding (Phase 5) ──────────────────────────────────────────

const CLR_LOCK  = '#E8354F'; // 🔒 lock  — type/uri/altText
const CLR_BOUND = '#7AC4D6'; // 🔗 bound — copy-driven text/labels
const CLR_FREE  = '#D4A017'; // 🎨 free  — layout / style props
const CLR_KEY   = '#79C0FF'; // JSON key
const CLR_STR   = '#A5D6FF'; // neutral string value
const CLR_NUM   = '#79C0FF'; // number
const CLR_BOOL  = '#FF7B72'; // boolean / null
const CLR_PUNC  = '#8B949E'; // brackets / commas

const _LOCK_KEYS  = new Set(['type', 'uri', 'altText']);
const _FREE_KEYS  = new Set([
  'paddingAll','paddingTop','paddingBottom','paddingLeft','paddingRight',
  'paddingStart','paddingEnd','aspectRatio','layout','cornerRadius',
  'weight','color','align','wrap','spacing','margin','height',
  'aspectMode','backgroundColor','gravity','maxLines','adjustMode','flex',
]);
const _BOUND_KEYS = new Set(['text', 'label']);
const _LOCK_URL   = /^https?:\/\/(liff\.line\.me|line\.me)/;

function _classify(key: string | null, val: unknown): 'lock' | 'bound' | 'free' | '' {
  if (!key) return '';
  if (_LOCK_KEYS.has(key)) return 'lock';
  if (key === 'url' && typeof val === 'string' && _LOCK_URL.test(val)) return 'lock';
  if (_BOUND_KEYS.has(key)) return 'bound';
  if (_FREE_KEYS.has(key)) return 'free';
  return '';
}

function _clsColor(cls: string): string {
  if (cls === 'lock')  return CLR_LOCK;
  if (cls === 'bound') return CLR_BOUND;
  if (cls === 'free')  return CLR_FREE;
  return CLR_STR;
}

function _renderVal(val: unknown, pKey: string | null, depth: number, last: boolean): React.ReactNode {
  const pad  = '  '.repeat(depth);
  const cls  = _classify(pKey, val);
  const comma = last ? '' : ',';

  if (val === null)                         return <><span style={{color:CLR_BOOL}}>null</span>{comma}</>;
  if (typeof val === 'boolean')             return <><span style={{color:CLR_BOOL}}>{String(val)}</span>{comma}</>;
  if (typeof val === 'number')              return <><span style={{color:CLR_NUM}}>{val}</span>{comma}</>;
  if (typeof val === 'string') {
    const badge = cls === 'lock' ? <span style={{color:CLR_LOCK,opacity:.55,fontSize:'0.85em'}}> 🔒</span>
                : cls === 'bound' ? <span style={{color:CLR_BOUND,opacity:.55,fontSize:'0.85em'}}> 🔗</span>
                : cls === 'free'  ? <span style={{color:CLR_FREE,opacity:.55,fontSize:'0.85em'}}> 🎨</span>
                : null;
    return <><span style={{color:_clsColor(cls)}}>{JSON.stringify(val)}</span>{badge}{comma}</>;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <><span style={{color:CLR_PUNC}}>[]</span>{comma}</>;
    return <>
      <span style={{color:CLR_PUNC}}>{'['}</span>{'\n'}
      {val.map((item, i) => (
        <span key={i}>{pad + '  '}{_renderVal(item, null, depth+1, i === val.length-1)}{'\n'}</span>
      ))}
      {pad}<span style={{color:CLR_PUNC}}>{']'}</span>{comma}
    </>;
  }
  if (typeof val === 'object') {
    const obj  = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return <><span style={{color:CLR_PUNC}}>{'{}'}</span>{comma}</>;
    return <>
      <span style={{color:CLR_PUNC}}>{'{'}</span>{'\n'}
      {keys.map((k, i) => (
        <span key={k}>
          {pad + '  '}<span style={{color:CLR_KEY}}>{JSON.stringify(k)}</span>
          <span style={{color:'#E6EDF3'}}>: </span>
          {_renderVal(obj[k], k, depth+1, i === keys.length-1)}{'\n'}
        </span>
      ))}
      {pad}<span style={{color:CLR_PUNC}}>{'}'}</span>{comma}
    </>;
  }
  return <>{String(val)}{comma}</>;
}

function JsonColored({ data }: { data: unknown }) {
  return <>{_renderVal(data, null, 0, true)}</>;
}

/** Build JSONC string with 🔒/🔗/🎨 inline comments */
function buildJsonc(val: unknown, depth = 0, pKey: string | null = null): string {
  const pad  = '  '.repeat(depth);
  const cls  = _classify(pKey, val);
  const tag  = cls === 'lock' ? ' // 🔒' : cls === 'bound' ? ' // 🔗' : cls === 'free' ? ' // 🎨' : '';

  if (val === null || typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
    return JSON.stringify(val) + tag;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const rows = val.map((item, i) => pad + '  ' + buildJsonc(item, depth+1, null) + (i < val.length-1 ? ',' : ''));
    return '[\n' + rows.join('\n') + '\n' + pad + ']';
  }
  if (typeof val === 'object') {
    const obj  = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    const rows = keys.map((k, i) => pad + '  ' + JSON.stringify(k) + ': ' + buildJsonc(obj[k], depth+1, k) + (i < keys.length-1 ? ',' : ''));
    return '{\n' + rows.join('\n') + '\n' + pad + '}';
  }
  return String(val);
}

// ── Phase 6: JSON paste helpers ───────────────────────────────────────────

function _stripComments(s: string): string {
  return s.replace(/\/\/[^\n]*/g, '');
}

/** Walk two JSON trees in parallel. Collect changed text/label back to copy keys. */
function _walkDiff(
  orig: unknown, next: unknown,
  origCopy: Record<string, string>,
  copyOut: Record<string, string>,
  warnLock: string[],
): void {
  if (typeof orig !== 'object' || orig === null || typeof next !== 'object' || next === null) return;
  if (Array.isArray(orig) && Array.isArray(next)) {
    for (let i = 0; i < Math.min(orig.length, next.length); i++) {
      _walkDiff(orig[i], next[i], origCopy, copyOut, warnLock);
    }
    return;
  }
  if (Array.isArray(orig) || Array.isArray(next)) return;
  const o = orig as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  for (const k of Object.keys(n)) {
    const ov = o[k], nv = n[k];
    if (_LOCK_KEYS.has(k) || (k === 'url' && typeof nv === 'string' && _LOCK_URL.test(nv))) {
      if (ov !== nv) warnLock.push(k);
      continue;
    }
    if (_BOUND_KEYS.has(k) && typeof ov === 'string' && typeof nv === 'string' && ov !== nv) {
      // Find which copy key produced the original value
      let found = false;
      for (const [ck, cv] of Object.entries(origCopy)) {
        if (cv === ov) { copyOut[ck] = nv; found = true; break; }
      }
      // If not found by exact match, check placeholder patterns
      if (!found) {
        // Try prefix match (handles template vars like {name})
        for (const [ck, cv] of Object.entries(origCopy)) {
          if (cv && ov && ov.startsWith(cv.slice(0, Math.min(cv.length, 12)))) {
            copyOut[ck] = nv; break;
          }
        }
      }
    } else {
      _walkDiff(ov, nv, origCopy, copyOut, warnLock);
    }
  }
}

// ── Main component ─────────────────────────────────────────────────────────

export default function FlexCardSection({ mode, copy, brand, axes, results, group, liffId, appearance, onChange }: Props) {
  const [cardId, setCardId]   = useState('f01');
  const [tab, setTab]         = useState<'labels' | 'images' | 'layout'>('labels');
  const [pane, setPane]         = useState<'chat' | 'json'>('chat');
  const [cfgW, setCfgW]         = useState(440);
  const [copyMsg, setCopyMsg]         = useState('');
  const [copyMsgAnnotated, setCopyMsgAnnotated] = useState('');
  const [images, setImages]       = useState<Record<string, string>>({});
  const [imgTarget, setImgTarget] = useState<string | null>(null);
  const [layouts, setLayouts]     = useState<Record<string, CardLayoutOpts>>({});
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteErr, setPasteErr]   = useState('');

  const cfgRef   = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const resizing = useRef(false);

  // Filter cards by mode; F-09 (reward) only shown when rewards are configured
  const hasRewards = (group?.reward_members ?? 0) > 0;
  const visibleCards = FLEX_CARDS.filter(c => {
    if (!c.modes.includes(mode)) return false;
    if (c.id === 'f09' && !hasRewards) return false;
    return true;
  });
  const card = visibleCards.find(c => c.id === cardId) ?? visibleCards[0];

  // Reset to first visible card when mode changes
  useEffect(() => {
    if (!visibleCards.find(c => c.id === cardId)) {
      setCardId(visibleCards[0]?.id ?? 'f01');
    }
  }, [mode]);

  // ── Resize grip ───────────────────────────────────────────────────────────

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startW = cfgW;
    const move = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - startX; // grip is between preview and config: drag right = wider config (config is on right)
      setCfgW(Math.max(300, Math.min(720, startW - delta)));
    };
    const up = () => { resizing.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [cfgW]);

  // ── Field helpers ─────────────────────────────────────────────────────────

  const set = (key: string, v: string) => onChange({ ...copy, [key]: v });

  const handleSeedDefaults = () => {
    if (!card) return;
    const patch: Record<string, string> = {};
    for (const lbl of card.labels) {
      if (!copy[lbl.key] && lbl.placeholder) {
        patch[lbl.key] = lbl.placeholder;
      }
    }
    if (Object.keys(patch).length > 0) {
      onChange({ ...copy, ...patch });
    }
  };

  const cardLayout = layouts[card?.id ?? ''] ?? {};
  const setL = (patch: Partial<CardLayoutOpts>) =>
    setLayouts(prev => ({ ...prev, [card.id]: { ...prev[card.id], ...patch } }));

  // ── Image upload ──────────────────────────────────────────────────────────

  const pickImage = (key: string) => {
    setImgTarget(key);
    if (imgInput.current) { imgInput.current.value = ''; imgInput.current.click(); }
  };

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imgTarget) return;
    const url = URL.createObjectURL(file);
    setImages(prev => ({ ...prev, [imgTarget]: url }));
    setImgTarget(null);
  };

  const clearImage = (key: string) => {
    setImages(prev => {
      const next = { ...prev };
      if (next[key]) URL.revokeObjectURL(next[key]);
      delete next[key];
      return next;
    });
  };

  // ── JSON / copy ───────────────────────────────────────────────────────────

  const flexJson = card
    ? buildFlexJson(card.id as FlexEventId, {
        copy, images, brand, mode, axes, results, liffId, appearance,
        group: group ? { max_members: group.max_members, archetypes: group.archetypes } : undefined,
        layoutOpts: cardLayout,
      })
    : null;

  const jsonStr = flexJson ? JSON.stringify(flexJson, null, 2) : '';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopyMsg('✓ JSON');
      setTimeout(() => setCopyMsg(''), 2600);
    }).catch(() => {
      setCopyMsg('⚠ fail');
      setTimeout(() => setCopyMsg(''), 2600);
    });
  }, [jsonStr]);

  const jsoncStr = flexJson ? buildJsonc(flexJson) : '';
  const handleCopyAnnotated = useCallback(() => {
    navigator.clipboard.writeText(jsoncStr).then(() => {
      setCopyMsgAnnotated('✓ JSONC');
      setTimeout(() => setCopyMsgAnnotated(''), 2600);
    }).catch(() => {
      setCopyMsgAnnotated('⚠ fail');
      setTimeout(() => setCopyMsgAnnotated(''), 2600);
    });
  }, [jsoncStr]);

  const applyPaste = useCallback(() => {
    setPasteErr('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(_stripComments(pasteText));
    } catch (e) {
      setPasteErr('JSON ไม่ถูก syntax: ' + (e as Error).message);
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setPasteErr('ต้องเป็น Flex message object');
      return;
    }
    if ((parsed as Record<string,unknown>).type !== 'flex') {
      setPasteErr('type ต้องเป็น "flex"');
      return;
    }
    const copyOut: Record<string,string> = {};
    const warnLock: string[] = [];
    _walkDiff(flexJson, parsed, copy, copyOut, warnLock);
    const nChanged = Object.keys(copyOut).length;
    if (nChanged > 0) onChange({ ...copy, ...copyOut });
    const warnMsg = warnLock.length > 0 ? ` (locked field ถูกข้าม: ${[...new Set(warnLock)].join(', ')})` : '';
    if (nChanged === 0) {
      setPasteErr('ไม่พบข้อความที่เปลี่ยนแปลงได้' + warnMsg);
    } else {
      setPasteMode(false);
      setPasteText('');
      setCopyMsg(`✓ นำเข้า ${nChanged} ค่า${warnMsg}`);
      setTimeout(() => setCopyMsg(''), 4000);
    }
  }, [pasteText, flexJson, copy, onChange]);

  if (!card) {
    return (
      <div style={{ padding: 32, ...BODY_F, fontSize: 13, color: T.dim }}>
        ไม่มี flex card สำหรับ mode "{mode}"
      </div>
    );
  }

  // ── Nav ───────────────────────────────────────────────────────────────────

  const renderNav = () => (
    <div style={{ width: 214, flexShrink: 0, borderRight: T.border, background: T.panel, display: 'flex', flexDirection: 'column', overflowY: 'auto', order: 0 }}>
      {CARD_GROUPS.map(grp => {
        const items = visibleCards.filter(c => c.group === grp.key);
        if (items.length === 0) return null;
        return (
          <div key={grp.key}>
            {/* Group header */}
            <div style={{ padding: '10px 14px 4px', ...MONO, fontSize: 9, fontWeight: 700, color: T.faint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {grp.label}
            </div>
            {items.map(c => {
              const active = c.id === card.id;
              return (
                <button key={c.id} onClick={() => { setCardId(c.id); setTab('labels'); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', border: 'none', background: active ? '#F0F0EE' : 'transparent', cursor: 'pointer', textAlign: 'left', borderLeft: `2.5px solid ${active ? T.active : 'transparent'}` }}
                >
                  <span style={{ ...MONO, fontSize: 9.5, fontWeight: 700, color: active ? T.active : T.faint, flexShrink: 0 }}>{c.mark}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...BODY_F, fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? T.text : T.mid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  // ── Preview pane ──────────────────────────────────────────────────────────

  const renderPreview = () => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: pane === 'chat' ? '#E5DDD5' : '#161B22', order: 1 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${pane === 'chat' ? '#D0C9C0' : '#30363D'}`, flexShrink: 0, background: pane === 'chat' ? T.panel : '#161B22', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['chat', 'พรีวิวแชท'], ['json', 'JSON']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPane(v)} style={{
              ...MONO, fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid #30363D',
              background: pane === v ? (v === 'chat' ? '#238636' : '#388BFD') : '#21262D',
              color: '#fff',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(copyMsg || copyMsgAnnotated) && (
            <span style={{ ...MONO, fontSize: 10, color: (copyMsg || copyMsgAnnotated).startsWith('✓') ? '#3FB950' : '#F85149' }}>
              {copyMsg || copyMsgAnnotated}
            </span>
          )}
          {/* copy clean JSON */}
          <button onClick={handleCopy} style={{ ...MONO, fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid #30363D', background: '#21262D', color: '#C9D1D9' }}>
            JSON
          </button>
          {/* copy annotated JSONC with 🔒🔗🎨 */}
          <button onClick={handleCopyAnnotated} title="คัดลอก JSONC พร้อม annotation 🔒🔗🎨" style={{ ...MONO, fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid #30363D', background: '#21262D', color: '#C9D1D9' }}>
            JSONC
          </button>
          {/* paste back */}
          <button onClick={() => { setPasteMode(m => !m); setPasteErr(''); }} style={{ ...MONO, fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: `1px solid ${pasteMode ? '#388BFD' : '#30363D'}`, background: pasteMode ? '#1F3048' : '#21262D', color: pasteMode ? '#58A6FF' : '#C9D1D9' }}>
            Paste
          </button>
          <a href="https://developers.line.biz/flex-simulator/" target="_blank" rel="noopener noreferrer"
            style={{ ...MONO, fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid #30363D', background: '#21262D', color: '#58A6FF', textDecoration: 'none' }}>
            Simulator ↗
          </a>
        </div>
      </div>

      {/* Paste panel */}
      {pasteMode && (
        <div style={{ flexShrink: 0, background: '#0D1117', borderBottom: '1px solid #30363D', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...MONO, fontSize: 10, color: '#8B949E' }}>
            วาง Flex JSON หรือ JSONC (พร้อม 🔒🔗🎨) แล้วกด Apply — ระบบจะนำข้อความที่เปลี่ยนกลับเข้า copy
          </div>
          <textarea
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); setPasteErr(''); }}
            placeholder='{ "type": "flex", "altText": "...", "contents": { ... } }'
            rows={7}
            style={{ width: '100%', padding: '8px 10px', background: '#161B22', border: `1px solid ${pasteErr ? '#F85149' : '#30363D'}`, borderRadius: 6, ...MONO, fontSize: 11, color: '#E6EDF3', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
          {pasteErr && <span style={{ ...MONO, fontSize: 10, color: '#F85149' }}>{pasteErr}</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={applyPaste} disabled={!pasteText.trim()} style={{ ...MONO, fontSize: 10, padding: '5px 14px', borderRadius: 5, cursor: pasteText.trim() ? 'pointer' : 'default', border: 'none', background: pasteText.trim() ? '#238636' : '#21262D', color: '#fff', opacity: pasteText.trim() ? 1 : 0.4 }}>
              Apply
            </button>
            <button onClick={() => { setPasteMode(false); setPasteText(''); setPasteErr(''); }} style={{ ...MONO, fontSize: 10, padding: '5px 14px', borderRadius: 5, cursor: 'pointer', border: '1px solid #30363D', background: 'transparent', color: '#8B949E' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {pane === 'chat' ? (
          <FlexBubblePreview
            flexJson={flexJson as Record<string, unknown> | null}
            brand={{ primary: brand.primary || '#E8354F', name: brand.name || 'Official Account' }}
            size={cardLayout.size}
          />
        ) : (
          <div style={{ padding: '16px 20px' }}>
            <pre style={{ margin: 0, ...MONO, fontSize: 11.5, lineHeight: 1.7, color: '#E6EDF3', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <JsonColored data={flexJson} />
            </pre>
          </div>
        )}
      </div>

      {pane === 'json' && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #30363D', flexShrink: 0 }}>
          <span style={{ ...MONO, fontSize: 9, color: '#6E7681' }}>
            <span style={{color:CLR_LOCK}}>🔒 lock</span> = type/uri/altText &nbsp;·&nbsp;
            <span style={{color:CLR_BOUND}}>🔗 bound</span> = text/label จาก copy &nbsp;·&nbsp;
            <span style={{color:CLR_FREE}}>🎨 free</span> = layout/style
          </span>
        </div>
      )}
    </div>
  );

  // ── Grip ──────────────────────────────────────────────────────────────────

  const renderGrip = () => (
    <div
      onMouseDown={startResize}
      style={{ width: 9, flexShrink: 0, cursor: 'col-resize', background: T.divider, order: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#DEDEDA')}
      onMouseLeave={e => (e.currentTarget.style.background = T.divider)}
    >
      <div style={{ width: 1, height: 32, background: T.faint, borderRadius: 1 }} />
    </div>
  );

  // ── Config column ─────────────────────────────────────────────────────────

  const renderConfig = () => (
    <div ref={cfgRef} style={{ width: cfgW, flexShrink: 0, borderLeft: T.border, background: T.panel, display: 'flex', flexDirection: 'column', order: 3, minHeight: 0 }}>
      {/* Card header */}
      <div style={{ padding: '13px 16px 10px', borderBottom: T.border, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: T.active }}>{card.mark}</span>
          <span style={{ ...BODY_F, fontSize: 13, fontWeight: 700, color: T.text }}>{card.title}</span>
        </div>
        <div style={{ ...BODY_F, fontSize: 10.5, color: T.dim, marginTop: 3, lineHeight: 1.4 }}>{card.desc}</div>
        <div style={{ ...MONO, fontSize: 9, color: T.faint, marginTop: 5 }}>{card.parts}</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: T.border, flexShrink: 0 }}>
        {([['labels', 'ข้อความ'], ['images', 'ภาพ'], ['layout', 'เลย์เอาต์']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flex: 1, padding: '9px 4px', border: 'none', background: 'none', cursor: 'pointer',
            ...BODY_F, fontSize: 11.5, fontWeight: tab === v ? 700 : 400,
            color: tab === v ? T.text : T.dim,
            borderBottom: `2px solid ${tab === v ? T.text : 'transparent'}`,
            marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>

      {/* Tab body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tab === 'labels' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSeedDefaults}
              title="เติม placeholder ให้ field ที่ยังว่างอยู่ทั้งหมด"
              style={{ ...MONO, fontSize: 9.5, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: T.border, background: T.bg, color: T.mid }}
            >
              Seed defaults
            </button>
          </div>
        )}
        {tab === 'labels' && card.labels.map(f => (
          <Field key={f.key} label={f.label} hint={f.hint} path={f.key}>
            {f.multiline ? (
              <textarea
                value={copy[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={e => set(f.key, e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '7px 10px', border: T.border, borderRadius: 8, ...BODY_F, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none', background: T.panel, color: T.text }}
              />
            ) : (
              <input
                type="text"
                value={copy[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={e => set(f.key, e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: T.border, borderRadius: 8, ...BODY_F, fontSize: 13, boxSizing: 'border-box', outline: 'none', background: T.panel, color: T.text }}
              />
            )}
          </Field>
        ))}

        {tab === 'images' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {card.img ? (() => {
              const [imgKey, imgLabel, imgHint] = card.img!;
              const url = images[imgKey];
              return (
                <Field label={imgLabel} hint={imgHint} path={imgKey}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {/* Thumbnail */}
                    <div style={{
                      width: 72, height: 72, flexShrink: 0, borderRadius: 8,
                      border: T.border, overflow: 'hidden', background: T.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {url
                        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ ...MONO, fontSize: 9, color: T.faint }}>IMG</span>
                      }
                    </div>
                    {/* Controls */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => pickImage(imgKey)} style={{ padding: '7px 12px', border: T.border, borderRadius: 8, background: T.panel, cursor: 'pointer', ...BODY_F, fontSize: 12, fontWeight: 600, color: T.mid, textAlign: 'left' }}>
                        + อัปโหลดรูป
                      </button>
                      {url && (
                        <button onClick={() => clearImage(imgKey)} style={{ padding: '5px 12px', border: T.border, borderRadius: 8, background: T.panel, cursor: 'pointer', ...MONO, fontSize: 10, color: T.dim, textAlign: 'left' }}>
                          ✕ ลบรูป
                        </button>
                      )}
                      {url && <span style={{ ...MONO, fontSize: 9, color: T.faint, wordBreak: 'break-all' }}>blob (local preview)</span>}
                    </div>
                  </div>
                </Field>
              );
            })() : (
              <div style={{ ...BODY_F, fontSize: 12, color: T.dim, padding: '12px 0' }}>
                การ์ดนี้ไม่มีภาพที่ตั้งค่าได้<br />
                <span style={{ fontSize: 10.5 }}>ภาพดึงจาก axes / results / group config โดยอัตโนมัติ</span>
              </div>
            )}
          </div>
        )}

        {tab === 'layout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Size */}
            <Field label="Bubble Size" hint="ความกว้างของ bubble ในแชท LINE">
              <SegInput
                value={cardLayout.size ?? 'mega'}
                options={[{ v:'kilo', label:'Kilo' }, { v:'mega', label:'Mega' }, { v:'giga', label:'Giga' }]}
                onChange={v => setL({ size: v as CardLayoutOpts['size'] })}
              />
            </Field>

            {/* Hero */}
            {card.hero && (<>
              <Field label="Hero Image" hint="แสดงหรือซ่อนภาพ hero ด้านบน">
                <SegInput
                  value={(cardLayout.heroShow ?? true) ? 'show' : 'hide'}
                  options={[{ v:'show', label:'แสดง' }, { v:'hide', label:'ซ่อน' }]}
                  onChange={v => setL({ heroShow: v === 'show' })}
                />
              </Field>
              {(cardLayout.heroShow ?? true) && (<>
                <Field label="Aspect Ratio" hint="สัดส่วนภาพ hero">
                  <SegInput
                    value={cardLayout.heroRatio ?? card.heroRatio}
                    options={['20:13','1:1','4:5','9:13','16:9'].map(v => ({ v }))}
                    onChange={v => setL({ heroRatio: v })}
                  />
                </Field>
                <Field label="Fit Mode" hint="วิธีครอบภาพ">
                  <SegInput
                    value={cardLayout.heroMode ?? 'cover'}
                    options={[{ v:'cover', label:'Cover' }, { v:'fit', label:'Fit' }]}
                    onChange={v => setL({ heroMode: v as CardLayoutOpts['heroMode'] })}
                  />
                </Field>
              </>)}
            </>)}

            {/* Badge */}
            {card.labels.some(f => f.key.toLowerCase().includes('eyebrow')) && (
              <Field label="Badge / Eyebrow" hint="แถบข้อความเล็กด้านบน">
                <SegInput
                  value={(cardLayout.badge ?? true) ? 'show' : 'hide'}
                  options={[{ v:'show', label:'แสดง' }, { v:'hide', label:'ซ่อน' }]}
                  onChange={v => setL({ badge: v === 'show' })}
                />
              </Field>
            )}

            {/* Separator */}
            <Field label="Separator" hint="เส้นแบ่งระหว่าง body กับ footer">
              <SegInput
                value={(cardLayout.sep ?? false) ? 'show' : 'hide'}
                options={[{ v:'show', label:'แสดง' }, { v:'hide', label:'ซ่อน' }]}
                onChange={v => setL({ sep: v === 'show' })}
              />
            </Field>

            {/* Button direction */}
            <Field label="ปุ่ม — จัดเรียง" hint="ซ้อนกันหรือเรียงข้างกัน">
              <SegInput
                value={cardLayout.btnDir ?? 'vertical'}
                options={[{ v:'vertical', label:'ซ้อนกัน' }, { v:'horizontal', label:'เรียงข้างกัน' }]}
                onChange={v => setL({ btnDir: v as CardLayoutOpts['btnDir'] })}
              />
            </Field>

            {/* Button style */}
            <Field label="ปุ่ม — สไตล์">
              <SegInput
                value={cardLayout.btnStyle ?? 'primary+secondary'}
                options={[
                  { v:'primary+secondary', label:'Pri+Sec' },
                  { v:'primary+link',      label:'Pri+Link' },
                  { v:'all-primary',       label:'ทั้งหมด' },
                ]}
                onChange={v => setL({ btnStyle: v as CardLayoutOpts['btnStyle'] })}
              />
            </Field>

            {/* Padding */}
            <Field label={`Padding — ${cardLayout.pad ?? 16}px`} hint="ระยะขอบ body ทุกด้าน">
              <input
                type="range" min={8} max={24} step={2}
                value={cardLayout.pad ?? 16}
                onChange={e => setL({ pad: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer', accentColor: T.active }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 9, color: T.faint }}>
                <span>8px</span><span>24px</span>
              </div>
            </Field>

            {/* Reset */}
            {Object.keys(cardLayout).length > 0 && (
              <button onClick={() => setLayouts(prev => { const n = { ...prev }; delete n[card.id]; return n; })}
                style={{ padding: '7px 12px', border: T.border, borderRadius: 8, background: T.panel, cursor: 'pointer', ...MONO, fontSize: 10, color: T.dim, textAlign: 'left' }}>
                ↺ reset การ์ดนี้
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Root ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Hidden file input for image upload */}
      <input ref={imgInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageFile} />
      {renderNav()}
      {renderPreview()}
      {renderGrip()}
      {renderConfig()}
    </div>
  );
}
