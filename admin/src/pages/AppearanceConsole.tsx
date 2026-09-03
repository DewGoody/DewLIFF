import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saveAppearance, saveCampaign, fetchCampaign } from '../api';
import type { AppearanceConfig, CampaignConfig } from '../types';

const ACCENT = '#D95F2B';
const PRESETS = ['#D95F2B', '#C9452F', '#E0A24A', '#7FA6A0', '#B5B0A6'];

const DEFAULT_APPEARANCE: Partial<AppearanceConfig> = {
  accent: '#D95F2B',
  theme: 'dark',
  font: 'editorial',
  texture: 'paper',
  kv_treatment: 'illustration',
  radius: 2,
  intro_layout: 'kv55',
  question_layout: 'card',
  summary_layout: 'idcard',
  pair_layout: 'fullbleed',
  show_dots: true,
  show_progress_pct: true,
  show_reward: true,
  sticky_cta: true,
  loading_style: 'ring',
  loading_copy: 'กำลังเชื่อมสัญญาณ...',
  min_ms: 800,
  timeout_s: 10,
  match_ms: 1800,
  transition: 'fade',
  easing: 'soft',
  images: {},
  liff_id: '',
  oa_id: '',
  share_mode: 'picker',
  flex_title: 'โลกแตกพรุ่งนี้ เราสองคนรอดกี่วัน?',
  flex_sub: 'เพื่อนคุณเป็นสายไหน ตอบ 6 ข้อ 1 นาทีรู้ผล',
  flex_cta: 'ดูผลของเรา',
};

const KV_SLOTS = [
  { key: 'kv-intro',    slug: 'KV_INTRO',    spec: '1170×1300', use: 'ภาพหน้าแรก — หน้า Intro' },
  { key: 'kv-invited',  slug: 'KV_INVITED',  spec: '1170×1300', use: 'หน้า Invited' },
  { key: 'kv-question', slug: 'KV_QUESTION', spec: '1170×1300', use: 'texture พื้นหลังคำถาม (opacity 22%)' },
  { key: 'kv-matching', slug: 'KV_MATCHING', spec: '800×800',   use: 'หน้าจับคู่' },
  { key: 'kv-share',    slug: 'KV_SHARE',    spec: '1170×700',  use: 'header ก่อนปุ่มชวนเพื่อน' },
  { key: 'kv-summary',  slug: 'KV_SUMMARY',  spec: '1170×560',  use: 'header สรุป (Summary / PAIR LOG)' },
  { key: 'kv-pair',     slug: 'KV_PAIR',     spec: '1170×1600', use: 'PairResult — ใช้ result.image_url แทน' },
  { key: 'kv-group',    slug: 'KV_GROUP',    spec: '1170×560',  use: 'header หน้า Group / Team Result' },
  { key: 'kv-error',    slug: 'KV_ERROR',    spec: '600×600',   use: 'ไอคอน error' },
];

type NavSection = 'theme' | 'layout' | 'motion' | 'kvs' | 'line' | 'publish' | 'copy';
type PreviewTab = 'loading' | 'intro' | 'question' | 'result';

const NAV_ITEMS: { id: NavSection; num: string; label: string }[] = [
  { id: 'theme',   num: '01', label: 'Theme & Brand' },
  { id: 'layout',  num: '02', label: 'Structure & Layout' },
  { id: 'motion',  num: '03', label: 'Loading & Motion' },
  { id: 'kvs',     num: '04', label: 'Key Visuals' },
  { id: 'line',    num: '05', label: 'LINE Integration' },
  { id: 'publish', num: '06', label: 'Publish' },
  { id: 'copy',    num: '07', label: 'Labels & Copy' },
];

/* ── Inline CSS animations ── */
const STYLE_TAG = `
@keyframes acSpin { to { transform: rotate(360deg); } }
@keyframes acPulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.18); opacity:.6; } }
@keyframes acBar { 0% { width:0; } 60% { width:80%; } 100% { width:100%; } }
@keyframes acSkel { 0%,100% { opacity:.18; } 50% { opacity:.38; } }
`;

/* ── Helpers ── */
function choiceBtn(active: boolean, accent: string) {
  return {
    padding: '9px 14px',
    borderRadius: 3,
    fontSize: 12.5,
    fontFamily: "'IBM Plex Sans Thai', sans-serif",
    cursor: 'pointer',
    border: active ? `1px solid ${accent}` : '1px solid rgba(237,231,223,.13)',
    background: active ? `rgba(217,95,43,.16)` : '#151312',
    color: active ? '#EDE7DF' : 'rgba(237,231,223,.6)',
    transition: 'all .15s',
  } as React.CSSProperties;
}

function sectionHeader(label: string, num: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid rgba(237,231,223,.08)' }}>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: ACCENT, letterSpacing: '.14em' }}>{num}</span>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.12em', color: 'rgba(237,231,223,.55)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

function groupLabel(text: string) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.12em', color: 'rgba(237,231,223,.38)', textTransform: 'uppercase', marginBottom: 8, marginTop: 18 }}>
      {text}
    </div>
  );
}

/* Mini thumbnail for layout previews */
function LayoutThumb({ bands, active, accent }: { bands: [number, string, string][]; active: boolean; accent: string }) {
  return (
    <div style={{
      width: 52, height: 84, borderRadius: 3, overflow: 'hidden',
      border: active ? `1.5px solid ${accent}` : '1.5px solid rgba(237,231,223,.12)',
      display: 'flex', flexDirection: 'column',
    }}>
      {bands.map(([pct, bg, _label], i) => (
        <div key={i} style={{ height: `${pct}%`, background: bg, flexShrink: 0 }} />
      ))}
    </div>
  );
}

/* Toggle switch */
function Toggle({ on, onChange, accent }: { on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
        background: on ? accent : 'rgba(237,231,223,.16)',
        position: 'relative', flexShrink: 0, transition: 'background .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20,
        borderRadius: '50%', background: '#EDE7DF', transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.4)',
      }} />
    </div>
  );
}

/* Numeric stepper */
function Stepper({ value, onChange, step, min, max, unit }: {
  value: number; onChange: (v: number) => void; step: number; min: number; max: number; unit: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid rgba(237,231,223,.13)', borderRadius: 4, overflow: 'hidden' }}>
      <button
        onClick={() => onChange(clamp(value - step))}
        style={{ width: 34, height: 32, background: '#151312', border: 'none', color: 'rgba(237,231,223,.7)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
      >−</button>
      <div style={{ flex: 1, textAlign: 'center', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#EDE7DF', background: '#0F0E0D', padding: '0 8px', lineHeight: '32px' }}>
        {value}<span style={{ fontSize: 10, color: 'rgba(237,231,223,.4)', marginLeft: 3 }}>{unit}</span>
      </div>
      <button
        onClick={() => onChange(clamp(value + step))}
        style={{ width: 34, height: 32, background: '#151312', border: 'none', color: 'rgba(237,231,223,.7)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
      >+</button>
    </div>
  );
}

export default function AppearanceConsole() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campaignId = id!;

  const [appearance, setAppearance] = useState<Partial<AppearanceConfig>>({ ...DEFAULT_APPEARANCE });
  const [localCopy, setLocalCopy] = useState<Record<string, string>>({});
  const [copySaving, setCopySaving] = useState(false);
  const [fullConfig, setFullConfig] = useState<CampaignConfig | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('theme');
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>('intro');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [campaignStatus, setCampaignStatusState] = useState<'draft' | 'live' | 'ended'>('draft');
  const [summaryStats, setSummaryStats] = useState({ axes: 0, questions: 0, results: 0 });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => {
    fetchCampaign(campaignId).then(({ campaign, config }) => {
      setCampaignStatusState(campaign.status);
      setFullConfig(config);
      setSummaryStats({
        axes: config.axes?.length ?? 0,
        questions: config.questions?.length ?? 0,
        results: config.results?.length ?? 0,
      });
      if (config.appearance) {
        setAppearance({ ...DEFAULT_APPEARANCE, ...config.appearance });
      }
      setLocalCopy(config.copy || {});
    }).catch(e => showToast('โหลดไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))));
  }, [campaignId, showToast]);

  /* Send preview config to iframe whenever appearance or fullConfig changes */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => {
      iframe.contentWindow?.postMessage({
        type: 'preview_config',
        config: { ...(fullConfig ?? {}), appearance },
        startScreen: activePreviewTab,
      }, '*');
    };
    iframe.addEventListener('load', send);
    send();
    return () => iframe.removeEventListener('load', send);
  }, [appearance, activePreviewTab, fullConfig]);

  const update = useCallback(<K extends keyof Required<AppearanceConfig>>(key: K, value: Required<AppearanceConfig>[K]) => {
    setAppearance(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const updateImage = useCallback((imgKey: string, url: string) => {
    setAppearance(prev => ({ ...prev, images: { ...prev.images, [imgKey]: url } }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveAppearance(campaignId, appearance);
      setDirty(false);
      showToast('บันทึก appearance แล้ว');
    } catch (e) {
      showToast('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCopy = async () => {
    if (copySaving || !fullConfig) return;
    setCopySaving(true);
    try {
      await saveCampaign(campaignId, { ...fullConfig, copy: localCopy });
      setFullConfig(prev => prev ? { ...prev, copy: localCopy } : prev);
      showToast('บันทึก labels แล้ว');
    } catch (e) {
      showToast('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCopySaving(false);
    }
  };

  const acc = appearance.accent || ACCENT;

  /* ── Section renderers ── */

  const renderTheme = () => (
    <div>
      {sectionHeader('Theme & Brand', '01')}

      {groupLabel('ACCENT')}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {PRESETS.map(hex => (
          <div
            key={hex}
            onClick={() => update('accent', hex)}
            style={{
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 3, background: hex,
              border: appearance.accent === hex ? `2px solid ${acc}` : '2px solid transparent',
              outline: appearance.accent === hex ? `2px solid rgba(255,255,255,.3)` : 'none',
              boxShadow: appearance.accent === hex ? `0 0 0 1px ${hex}` : 'none',
            }} />
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: 'rgba(237,231,223,.45)', letterSpacing: '.04em' }}>{hex}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          <input
            type="color"
            value={appearance.accent}
            onChange={e => update('accent', e.target.value)}
            style={{ width: 26, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }}
          />
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(237,231,223,.4)' }}>custom</span>
        </div>
      </div>

      {groupLabel('BASE THEME')}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['dark', 'light'] as const).map(t => (
          <button key={t} style={choiceBtn(appearance.theme === t, acc)} onClick={() => update('theme', t)}>
            {t === 'dark' ? 'Dark' : 'Light'}
          </button>
        ))}
      </div>

      {groupLabel('TYPE PAIRING')}
      <div style={{ display: 'flex', gap: 8 }}>
        {([['editorial', 'Editorial'], ['friendly', 'Friendly'], ['system', 'System']] as const).map(([v, l]) => (
          <button key={v} style={choiceBtn(appearance.font === v, acc)} onClick={() => update('font', v)}>{l}</button>
        ))}
      </div>

      {groupLabel('TEXTURE')}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={choiceBtn(appearance.texture === 'paper', acc)} onClick={() => update('texture', 'paper')}>เปิด</button>
        <button style={choiceBtn(!appearance.texture || appearance.texture === 'none', acc)} onClick={() => update('texture', 'none')}>ปิด</button>
      </div>

      {groupLabel('KV TREATMENT')}
      <div style={{ display: 'flex', gap: 8 }}>
        {([['illustration', 'Illustration'], ['photo', 'Photo'], ['flat', 'Flat color']] as const).map(([v, l]) => (
          <button key={v} style={choiceBtn(appearance.kv_treatment === v, acc)} onClick={() => update('kv_treatment', v)}>{l}</button>
        ))}
      </div>

      {groupLabel('CORNER RADIUS')}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#EDE7DF', minWidth: 36 }}>{appearance.radius}px</span>
        <input
          type="range" min={0} max={20} step={2}
          value={appearance.radius}
          onChange={e => update('radius', Number(e.target.value))}
          style={{ flex: 1, accentColor: acc }}
        />
      </div>
    </div>
  );

  const renderLayout = () => {
    const introLayouts: { v: AppearanceConfig['intro_layout']; l: string; bands: [number, string, string][] }[] = [
      { v: 'kv55',     l: 'KV 55% + เนื้อหา',  bands: [[55,'rgba(217,95,43,.28)','kv'],[30,'rgba(255,255,255,.08)','txt'],[15,acc,'cta']] },
      { v: 'fullbleed', l: 'ภาพเต็มจอ',         bands: [[80,'rgba(217,95,43,.28)','kv'],[5,'rgba(255,255,255,.08)','txt'],[15,acc,'cta']] },
      { v: 'compact',  l: 'Compact',            bands: [[32,'rgba(217,95,43,.28)','kv'],[53,'rgba(255,255,255,.08)','txt'],[15,acc,'cta']] },
    ];
    const questionLayouts: { v: AppearanceConfig['question_layout']; l: string; bands: [number, string, string][] }[] = [
      { v: 'card',  l: 'Card',  bands: [[18,'rgba(255,255,255,.08)','txt'],[70,'rgba(217,95,43,.28)','kv'],[12,'transparent','none']] },
      { v: 'list',  l: 'List',  bands: [[18,'rgba(255,255,255,.08)','txt'],[70,'rgba(255,255,255,.05)','txt'],[12,'transparent','none']] },
      { v: 'swipe', l: 'Swipe', bands: [[26,'rgba(255,255,255,.08)','txt'],[56,'rgba(217,95,43,.28)','kv'],[18,acc,'cta']] },
    ];
    const summaryLayouts: { v: AppearanceConfig['summary_layout']; l: string; bands: [number, string, string][] }[] = [
      { v: 'idcard',  l: 'บัตรผู้รอดชีวิต', bands: [[40,'rgba(217,95,43,.28)','kv'],[45,'rgba(255,255,255,.08)','txt'],[15,acc,'cta']] },
      { v: 'logbook', l: 'สมุดบันทึก',      bands: [[22,'rgba(255,255,255,.1)','txt'],[63,'rgba(255,255,255,.05)','txt'],[15,acc,'cta']] },
    ];
    const pairLayouts: { v: AppearanceConfig['pair_layout']; l: string; bands: [number, string, string][] }[] = [
      { v: 'fullbleed', l: 'ภาพเต็ม',     bands: [[62,'rgba(217,95,43,.28)','kv'],[23,'rgba(255,255,255,.08)','txt'],[15,acc,'cta']] },
      { v: 'card',      l: 'การ์ดกลาง',   bands: [[25,'rgba(217,95,43,.28)','kv'],[60,'rgba(255,255,255,.08)','txt'],[15,acc,'cta']] },
    ];

    const layoutGroup = (
      title: string,
      items: { v: string | undefined; l: string; bands: [number, string, string][] }[],
      current: string | undefined,
      onChange: (v: string) => void,
    ) => (
      <div style={{ marginBottom: 22 }}>
        {groupLabel(title)}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {items.map(({ v, l, bands }) => (
            <div
              key={v} onClick={() => onChange(v!)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}
            >
              <LayoutThumb bands={bands} active={current === v} accent={acc} />
              <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11, color: current === v ? '#EDE7DF' : 'rgba(237,231,223,.5)', textAlign: 'center', maxWidth: 64 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    );

    const toggleCard = (label: string, hint: string, key: keyof Pick<Required<AppearanceConfig>, 'show_dots' | 'show_progress_pct' | 'show_reward' | 'sticky_cta'>) => (
      <div style={{ border: '1px solid rgba(237,231,223,.10)', borderRadius: 4, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, color: '#EDE7DF', marginBottom: 2 }}>{label}</div>
          <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11, color: 'rgba(237,231,223,.42)' }}>{hint}</div>
        </div>
        <Toggle on={appearance[key] as boolean} onChange={v => update(key, v)} accent={acc} />
      </div>
    );

    return (
      <div>
        {sectionHeader('Structure & Layout', '02')}
        {layoutGroup('INTRO / INVITED LAYOUT', introLayouts, appearance.intro_layout, v => update('intro_layout', v as 'kv55' | 'fullbleed' | 'compact'))}
        {layoutGroup('QUESTION LAYOUT', questionLayouts, appearance.question_layout, v => update('question_layout', v as 'card' | 'list' | 'swipe'))}
        {layoutGroup('SUMMARY LAYOUT', summaryLayouts, appearance.summary_layout, v => update('summary_layout', v as 'idcard' | 'logbook'))}
        {layoutGroup('PAIRRESULT LAYOUT', pairLayouts, appearance.pair_layout, v => update('pair_layout', v as 'fullbleed' | 'card'))}

        {groupLabel('UI TOGGLES')}
        {toggleCard('จุดบอกความคืบหน้า', 'จุด 6 จุดล่างหน้า Question', 'show_dots')}
        {toggleCard('แสดงเปอร์เซ็นต์', 'ตัวเลข % มุมขวาบน', 'show_progress_pct')}
        {toggleCard('แถบความคืบหน้ารางวัล', 'แถบ x/3 คู่', 'show_reward')}
        {toggleCard('ปุ่มหลักติดขอบล่าง', 'ปุ่ม CTA ลอยติดล่างเสมอ', 'sticky_cta')}
      </div>
    );
  };

  const renderMotion = () => {
    const loadingStyles: { v: AppearanceConfig['loading_style']; l: string; hint: string; demo: React.ReactNode }[] = [
      {
        v: 'ring', l: 'วงแหวนหมุน', hint: 'ring spinner',
        demo: (
          <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid rgba(237,231,223,.18)`, borderTopColor: acc, animation: 'acSpin 1s linear infinite' }} />
        ),
      },
      {
        v: 'pulse', l: 'โลโก้เต้น', hint: 'pulse block',
        demo: (
          <div style={{ width: 30, height: 30, borderRadius: 6, background: acc, animation: 'acPulse 1.4s ease-in-out infinite' }} />
        ),
      },
      {
        v: 'bar', l: 'แถบความคืบหน้า', hint: 'progress bar',
        demo: (
          <div style={{ width: 80, height: 4, background: 'rgba(237,231,223,.12)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: acc, animation: 'acBar 1.8s ease-in-out infinite' }} />
          </div>
        ),
      },
      {
        v: 'skeleton', l: 'โครงหน้าจาง', hint: 'skeleton shimmer',
        demo: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ width: 80, height: 8, borderRadius: 3, background: 'rgba(237,231,223,.2)', animation: 'acSkel 1.6s ease-in-out infinite' }} />
            <div style={{ width: 56, height: 8, borderRadius: 3, background: 'rgba(237,231,223,.12)', animation: 'acSkel 1.6s ease-in-out .3s infinite' }} />
          </div>
        ),
      },
    ];

    return (
      <div>
        {sectionHeader('Loading & Motion', '03')}

        {groupLabel('รูปแบบหน้าโหลด')}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {loadingStyles.map(({ v, l, hint, demo }) => (
            <div
              key={v} onClick={() => v && update('loading_style', v)}
              style={{
                width: 150, padding: '14px 12px', borderRadius: 5, cursor: 'pointer',
                border: appearance.loading_style === v ? `1px solid ${acc}` : '1px solid rgba(237,231,223,.10)',
                background: appearance.loading_style === v ? 'rgba(217,95,43,.07)' : '#121110',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}
            >
              <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{demo}</div>
              <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12.5, fontWeight: 600, color: '#EDE7DF', textAlign: 'center' }}>{l}</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: 'rgba(237,231,223,.38)', textAlign: 'center' }}>{hint}</div>
            </div>
          ))}
        </div>

        {groupLabel('MIN DISPLAY (ms)')}
        <Stepper value={appearance.min_ms ?? 800} onChange={v => update('min_ms', v)} step={100} min={0} max={5000} unit="ms" />

        {groupLabel('INIT TIMEOUT')}
        <Stepper value={appearance.timeout_s ?? 10} onChange={v => update('timeout_s', v)} step={1} min={3} max={30} unit="วินาที" />

        {groupLabel('MATCHING DELAY (ms)')}
        <Stepper value={appearance.match_ms ?? 1800} onChange={v => update('match_ms', v)} step={100} min={0} max={5000} unit="ms" />

        {groupLabel('ข้อความระหว่างโหลด')}
        <input
          type="text" value={appearance.loading_copy}
          onChange={e => update('loading_copy', e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', background: '#151312', border: '1px solid rgba(237,231,223,.13)',
            borderRadius: 4, color: '#EDE7DF', fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, boxSizing: 'border-box',
          }}
        />

        {groupLabel('PAGE TRANSITION')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['fade','Fade'],['slide','Slide'],['rise','Rise up'],['none','ไม่มี']] as const).map(([v, l]) => (
            <button key={v} style={choiceBtn(appearance.transition === v, acc)} onClick={() => update('transition', v)}>{l}</button>
          ))}
        </div>

        {groupLabel('EASING')}
        <div style={{ display: 'flex', gap: 8 }}>
          {([['soft','Soft'],['snappy','Snappy'],['linear','Linear']] as const).map(([v, l]) => (
            <button key={v} style={choiceBtn(appearance.easing === v, acc)} onClick={() => update('easing', v)}>{l}</button>
          ))}
        </div>
      </div>
    );
  };

  const renderKVs = () => (
    <div>
      {sectionHeader('Key Visuals', '04')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {KV_SLOTS.map(slot => {
          const url = appearance.images?.[slot.key] || '';
          return (
            <div key={slot.key} style={{ border: '1px solid rgba(237,231,223,.12)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: 118, background: '#100E0C', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {url ? (
                  <img src={url} alt={slot.slug} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '0 12px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(237,231,223,.28)', letterSpacing: '.08em' }}>{slot.slug}</div>
                    <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 10.5, color: 'rgba(237,231,223,.22)', marginTop: 4 }}>คลิกเพื่ออัปโหลด / วาง URL</div>
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 10px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: 'rgba(237,231,223,.55)' }}>{slot.slug}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: 'rgba(237,231,223,.3)' }}>{slot.spec}</span>
              </div>
              <div style={{ padding: '0 10px 4px', fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 10.5, color: 'rgba(237,231,223,.38)' }}>{slot.use}</div>
              <div style={{ padding: '4px 10px 10px' }}>
                <input
                  type="text" value={url} placeholder="https://..."
                  onChange={e => updateImage(slot.key, e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', background: '#151312', border: '1px solid rgba(237,231,223,.10)',
                    borderRadius: 3, color: '#EDE7DF', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, border: '1px dashed rgba(237,231,223,.14)', borderRadius: 4, padding: '10px 14px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(237,231,223,.38)', letterSpacing: '.08em' }}>
          UPLOAD SPEC — ใช้ PNG หรือ JPG, sRGB, ≤ 2 MB ต่อไฟล์ · ความละเอียดตาม spec ด้านบน
        </div>
      </div>
    </div>
  );

  const renderLine = () => {
    const flexBg = '#1A1714';
    return (
      <div>
        {sectionHeader('LINE Integration', '05')}

        {groupLabel('LIFF ID')}
        <input
          type="text" value={appearance.liff_id} placeholder="2001234567-AbCdEfGh"
          onChange={e => update('liff_id', e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', background: '#151312', border: '1px solid rgba(237,231,223,.13)',
            borderRadius: 4, color: '#EDE7DF', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, boxSizing: 'border-box',
          }}
        />

        {groupLabel('OA ID')}
        <input
          type="text" value={appearance.oa_id} placeholder="@lastlight"
          onChange={e => update('oa_id', e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', background: '#151312', border: '1px solid rgba(237,231,223,.13)',
            borderRadius: 4, color: '#EDE7DF', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, boxSizing: 'border-box',
          }}
        />

        {groupLabel('SHARE MODE')}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={choiceBtn(appearance.share_mode === 'picker', acc)} onClick={() => update('share_mode', 'picker')}>LINE Picker</button>
          <button style={choiceBtn(appearance.share_mode === 'url', acc)} onClick={() => update('share_mode', 'url')}>URL</button>
        </div>

        {groupLabel('FLEX MESSAGE')}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Preview card */}
          <div style={{ width: 230, flexShrink: 0, border: '1px solid rgba(237,231,223,.12)', borderRadius: 10, overflow: 'hidden', background: flexBg }}>
            <div style={{
              height: 78, background: 'repeating-linear-gradient(45deg, rgba(237,231,223,.05) 0, rgba(237,231,223,.05) 1px, transparent 1px, transparent 8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: 'rgba(237,231,223,.3)', letterSpacing: '.1em' }}>HERO 1200×628</span>
            </div>
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, fontWeight: 700, color: '#EDE7DF', marginBottom: 5, lineHeight: 1.4 }}>{appearance.flex_title || 'ชื่อ Flex Message'}</div>
              <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11.5, color: 'rgba(237,231,223,.55)', marginBottom: 12, lineHeight: 1.6 }}>{appearance.flex_sub || 'คำอธิบาย'}</div>
              <div style={{ background: acc, borderRadius: 4, padding: '8px 14px', textAlign: 'center', fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12, fontWeight: 600, color: '#fff' }}>
                {appearance.flex_cta || 'CTA'}
              </div>
            </div>
          </div>
          {/* Inputs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'flex_title' as const, label: 'TITLE', max: 120 },
              { key: 'flex_sub' as const, label: 'SUB', max: 200 },
              { key: 'flex_cta' as const, label: 'CTA', max: 40 },
            ].map(({ key, label, max }) => (
              <div key={key}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: 'rgba(237,231,223,.38)', letterSpacing: '.1em', marginBottom: 5 }}>{label}</div>
                <input
                  type="text" value={appearance[key]} maxLength={max}
                  onChange={e => update(key, e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', background: '#151312', border: '1px solid rgba(237,231,223,.13)',
                    borderRadius: 3, color: '#EDE7DF', fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12.5, boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPublish = () => {
    const checks = [
      { label: 'LIFF ID', ok: !!appearance.liff_id, state: appearance.liff_id || '(ยังไม่ตั้ง)' },
      { label: 'OA ID', ok: !!appearance.oa_id, state: appearance.oa_id || '(ยังไม่ตั้ง)' },
      { label: 'Accent color', ok: true, state: appearance.accent },
      { label: 'KV Intro', ok: !!appearance.images?.['kv-intro'], state: appearance.images?.['kv-intro'] ? 'ตั้งค่าแล้ว' : '(ยังไม่มีภาพ)' },
      { label: 'KV Pair', ok: !!appearance.images?.['kv-pair'], state: appearance.images?.['kv-pair'] ? 'ตั้งค่าแล้ว' : '(ยังไม่มีภาพ)' },
    ];
    const liffUrl = `https://liff.line.me/${appearance.liff_id || '(ยังไม่ตั้ง LIFF ID)'}`;

    return (
      <div>
        {sectionHeader('Publish', '06')}

        {groupLabel('STATUS')}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['draft', 'live', 'ended'] as const).map(s => (
            <button key={s} style={choiceBtn(campaignStatus === s, acc)} onClick={() => setCampaignStatusState(s)}>{s}</button>
          ))}
        </div>

        {groupLabel('PRE-FLIGHT CHECKLIST')}
        <div style={{ border: '1px solid rgba(237,231,223,.10)', borderRadius: 5, overflow: 'hidden' }}>
          {checks.map(({ label, ok, state }, i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderBottom: i < checks.length - 1 ? '1px solid rgba(237,231,223,.06)' : 'none',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: ok ? 'rgba(74,222,128,.15)' : 'rgba(251,191,36,.12)',
                color: ok ? '#4ADE80' : '#FBBF24',
                border: `1px solid ${ok ? 'rgba(74,222,128,.3)' : 'rgba(251,191,36,.25)'}`,
              }}>{ok ? '✓' : '⚠'}</div>
              <div style={{ flex: 1, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#EDE7DF' }}>{label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(237,231,223,.38)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state}</div>
            </div>
          ))}
        </div>

        {groupLabel('LIFF URL')}
        <div style={{ border: '1px dashed rgba(237,231,223,.18)', borderRadius: 5, padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{
            width: 84, height: 84, flexShrink: 0, border: '1px dashed rgba(237,231,223,.25)', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: 'rgba(237,231,223,.3)',
          }}>QR</div>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: acc, wordBreak: 'break-all', marginBottom: 8 }}>{liffUrl}</div>
            <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11.5, color: 'rgba(237,231,223,.45)', lineHeight: 1.6 }}>
              ธีมและเลย์เอาต์ที่ publish จะมีผลทันทีกับลิงก์นี้ ไม่ต้อง deploy โค้ดใหม่
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCopy = () => {
    const COPY_FIELDS: { key: string; label: string; hint: string; long?: boolean }[] = [
      // Intro
      { key: 'intro_quiz_label', label: 'Quiz Label', hint: 'บรรทัดสีแดงบนการ์ด intro เช่น "JBTI · 5 ข้อ"' },
      { key: 'intro_body',       label: 'Intro Body',  hint: 'ข้อความหลักหน้า intro', long: true },
      { key: 'intro_cta',        label: 'Intro CTA',   hint: 'ปุ่มเริ่มตอบ เช่น "เริ่มตอบ"' },
      { key: 'intro_note',       label: 'Intro Note',  hint: 'ข้อความเล็กใต้ปุ่ม เช่น "รู้ผลทันที"' },
      // Summary
      { key: 'share_btn',        label: 'Share Button', hint: 'ปุ่มแชร์บนหน้า Summary เช่น "↗ แชร์ผล"' },
      { key: 'F02_eyebrow',      label: 'Share Card Eyebrow', hint: 'ข้อความบน flex share card' },
      { key: 'F02_cta1',         label: 'Share CTA 1', hint: 'ปุ่มหลักบน flex share card' },
      { key: 'F02_cta2',         label: 'Share CTA 2', hint: 'ปุ่มรองบน flex share card' },
      // Invite (pair mode)
      { key: 'invite_btn',       label: 'Invite Button', hint: 'ปุ่มเชิญเพื่อน (pair mode)' },
      { key: 'invite_duo_label', label: 'Invite Duo Label', hint: 'ชื่อตัวเลือก 1:1 ใน invite sheet' },
      { key: 'invite_duo_sub',   label: 'Invite Duo Sub',   hint: 'คำอธิบายตัวเลือก 1:1' },
      { key: 'invite_team_label', label: 'Invite Team Label', hint: 'ชื่อตัวเลือกสร้างทีม' },
      { key: 'invite_team_sub',  label: 'Invite Team Sub',  hint: 'คำอธิบายตัวเลือกสร้างทีม' },
      // Group
      { key: 'group_cta',        label: 'Group CTA', hint: 'ปุ่มสร้างทีม เช่น "สร้างทีมวันสิ้นโลก"' },
      { key: 'symbols_title',    label: 'Symbols Title', hint: 'หัวข้อสะสมสัญลักษณ์' },
      { key: 'symbols_sub',      label: 'Symbols Sub',   hint: 'คำอธิบายสะสมสัญลักษณ์' },
    ];

    const inputStyle: React.CSSProperties = {
      width: '100%', padding: '8px 10px', boxSizing: 'border-box',
      background: '#151312', border: '1px solid rgba(237,231,223,.13)',
      borderRadius: 4, color: '#EDE7DF',
      fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13,
      outline: 'none',
    };

    return (
      <div>
        {sectionHeader('Labels & Copy', '07')}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
          <button
            onClick={handleSaveCopy}
            disabled={copySaving || !fullConfig}
            style={{
              padding: '8px 20px', borderRadius: 3, border: 'none',
              background: ACCENT, color: '#fff', cursor: copySaving ? 'wait' : 'pointer',
              fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, fontWeight: 600,
              opacity: copySaving ? .7 : 1,
            }}
          >{copySaving ? 'กำลังบันทึก...' : 'บันทึก Labels'}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {COPY_FIELDS.map(({ key, label, hint, long }) => (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: acc, letterSpacing: '.08em' }}>{key}</span>
                <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11, color: 'rgba(237,231,223,.45)' }}>— {label}</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11, color: 'rgba(237,231,223,.3)', marginBottom: 5 }}>{hint}</div>
              {long ? (
                <textarea
                  value={localCopy[key] ?? ''}
                  onChange={e => setLocalCopy(prev => ({ ...prev, [key]: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              ) : (
                <input
                  type="text"
                  value={localCopy[key] ?? ''}
                  onChange={e => setLocalCopy(prev => ({ ...prev, [key]: e.target.value }))}
                  style={inputStyle}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, border: '1px dashed rgba(237,231,223,.14)', borderRadius: 4, padding: '10px 14px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(237,231,223,.35)', lineHeight: 1.7 }}>
          ช่องที่ปล่อยว่างจะใช้ default text ของ LIFF — ไม่จำเป็นต้องกรอกทุกช่อง
        </div>
      </div>
    );
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'theme':   return renderTheme();
      case 'layout':  return renderLayout();
      case 'motion':  return renderMotion();
      case 'kvs':     return renderKVs();
      case 'line':    return renderLine();
      case 'publish': return renderPublish();
      case 'copy':    return renderCopy();
    }
  };

  return (
    <>
      <style>{STYLE_TAG}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0F0E0D', color: '#EDE7DF', fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>

        {/* Top bar */}
        <div style={{
          height: 56, flexShrink: 0, background: '#131110', borderBottom: '1px solid rgba(237,231,223,.08)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14,
        }}>
          <button
            onClick={() => navigate(`/campaign/${campaignId}`)}
            style={{ background: 'none', border: 'none', color: 'rgba(237,231,223,.55)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
          >←</button>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#EDE7DF', letterSpacing: '.06em', fontWeight: 600 }}>
            LIFF Appearance Console
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(237,231,223,.42)', background: '#1C1917', border: '1px solid rgba(237,231,223,.12)', borderRadius: 3, padding: '2px 8px' }}>
            {campaignId}
          </span>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: campaignStatus === 'live' ? '#4ADE80' : campaignStatus === 'ended' ? '#888' : '#FBBF24', marginLeft: -4 }} />
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(237,231,223,.38)' }}>{campaignStatus}</span>

          <div style={{ flex: 1 }} />

          {dirty && (
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#FBBF24', letterSpacing: '.06em' }}>● unsaved</span>
          )}
          <button
            onClick={() => setJsonOpen(true)}
            style={{
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, padding: '6px 12px', borderRadius: 3,
              background: '#151312', border: '1px solid rgba(237,231,223,.13)', color: 'rgba(237,231,223,.7)', cursor: 'pointer',
            }}
          >{'{ }'} theme.json</button>
          <button
            onClick={handleSave} disabled={saving}
            style={{
              fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, fontWeight: 600, padding: '7px 18px', borderRadius: 3,
              background: ACCENT, border: 'none', color: '#fff', cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1,
            }}
          >{saving ? 'กำลังบันทึก...' : 'บันทึกและ publish'}</button>
        </div>

        {/* 3-column body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left sidebar */}
          <div style={{ width: 216, flexShrink: 0, background: '#121110', borderRight: '1px solid rgba(237,231,223,.07)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, padding: '14px 0', overflowY: 'auto' }}>
              {NAV_ITEMS.map(item => (
                <div
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
                    margin: '2px 8px', borderRadius: 4,
                    background: activeSection === item.id ? `rgba(217,95,43,.14)` : 'transparent',
                    border: activeSection === item.id ? `1px solid ${acc}` : '1px solid transparent',
                    color: activeSection === item.id ? '#EDE7DF' : 'rgba(237,231,223,.55)',
                  }}
                >
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: activeSection === item.id ? acc : 'rgba(237,231,223,.3)' }}>{item.num}</span>
                  <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12.5 }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Summary box */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(237,231,223,.07)' }}>
              <div style={{ border: '1px dashed rgba(237,231,223,.14)', borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: 'rgba(237,231,223,.35)', letterSpacing: '.1em', marginBottom: 8 }}>CONTENT</div>
                {[['Axes', summaryStats.axes], ['Questions', summaryStats.questions], ['Results', summaryStats.results]].map(([l, v]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'rgba(237,231,223,.5)', marginBottom: 3 }}>
                    <span>{l}</span><span style={{ color: '#EDE7DF' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px', background: '#0F0E0D' }}>
            {renderSection()}
          </div>

          {/* Preview panel */}
          <div style={{ flex: '0 1 436px', minWidth: 340, background: '#121110', borderLeft: '1px solid rgba(237,231,223,.07)', display: 'flex', flexDirection: 'column' }}>
            {/* Preview header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(237,231,223,.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: 'rgba(237,231,223,.45)' }}>LIVE PREVIEW</span>
              <div style={{ flex: 1 }} />
              {(['loading', 'intro', 'question', 'result'] as PreviewTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActivePreviewTab(tab)}
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, padding: '4px 9px', borderRadius: 3, cursor: 'pointer',
                    background: activePreviewTab === tab ? `rgba(217,95,43,.18)` : 'transparent',
                    border: activePreviewTab === tab ? `1px solid ${acc}` : '1px solid rgba(237,231,223,.10)',
                    color: activePreviewTab === tab ? '#EDE7DF' : 'rgba(237,231,223,.45)',
                  }}
                >{tab}</button>
              ))}
            </div>

            {/* Phone frame */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0 12px' }}>
              <div style={{
                width: 390, maxWidth: '100%', height: 660,
                borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(237,231,223,.14)',
                display: 'flex', flexDirection: 'column', background: '#0C0B0A',
              }}>
                {/* Phone top bar */}
                <div style={{
                  height: 38, flexShrink: 0, background: '#131110', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8,
                  borderBottom: '1px solid rgba(237,231,223,.08)',
                }}>
                  <span style={{ fontSize: 14, color: 'rgba(237,231,223,.5)', lineHeight: 1 }}>✕</span>
                  <span style={{ flex: 1, fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12, color: 'rgba(237,231,223,.7)', textAlign: 'center' }}>โลกแตกพรุ่งนี้ เรารอดกี่วัน</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: acc, border: `1px solid ${acc}33`, padding: '1px 5px', borderRadius: 2 }}>LIFF</span>
                </div>
                {/* iframe */}
                <iframe
                  ref={iframeRef}
                  src={`/liff-app/?preview=1&startScreen=${activePreviewTab}`}
                  style={{ flex: 1, border: 'none', width: '100%' }}
                  title="LIFF Preview"
                />
              </div>
            </div>

            {/* Preview note */}
            <div style={{ padding: '10px 16px 14px' }}>
              <div style={{ border: '1px dashed rgba(237,231,223,.12)', borderRadius: 4, padding: '8px 12px', fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11, color: 'rgba(237,231,223,.35)', lineHeight: 1.6 }}>
                พรีวิวผูกกับค่าจริงทุกช่อง — เปลี่ยนค่าใด iframe อัปเดตทันที
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Drawer */}
      {jsonOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)',
        }} onClick={() => setJsonOpen(false)}>
          <div
            style={{ width: 460, height: '100%', background: '#131110', borderLeft: '1px solid rgba(237,231,223,.1)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(237,231,223,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: acc, fontWeight: 600 }}>theme.json</span>
              <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11, color: 'rgba(237,231,223,.38)', flex: 1 }}>appearance config ที่จะ publish</span>
              <button onClick={() => setJsonOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(237,231,223,.55)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <pre style={{
              flex: 1, overflowY: 'auto', padding: '16px 18px', margin: 0,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#EDE7DF', lineHeight: 1.7,
              background: '#0F0E0D',
            }}>
              {JSON.stringify(appearance, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: '#1C1917', border: '1px solid rgba(237,231,223,.14)', borderRadius: 6, padding: '9px 18px',
        fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, color: '#EDE7DF',
        opacity: toast ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none', zIndex: 2000,
        whiteSpace: 'nowrap',
      }}>
        {toast}
      </div>
    </>
  );
}
