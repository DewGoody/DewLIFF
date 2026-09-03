import { useState } from 'react';
import { getScreenBlocks, resolveSrcText, resolveSrcImage, floatStyle, scaleFont, renderExtraBlock } from '../screenConfig';

interface BlockGeo { h?: number; pad?: number; fit?: string; color?: string; sticky?: string; align?: string }

interface AxisConfig { label?: string; label_en?: string; body?: string; image_url?: string }

interface Props {
  config: {
    brand?: { logo_url?: string; kv_image_url?: string; primary?: string };
    copy?: Record<string, string>;
    mode?: string;
    questions?: unknown[];
    axes?: AxisConfig[];
    appearance?: {
      intro_layout?: string;
      images?: Record<string, string>;
      screen_config?: Record<string, { blocks: any[] }>;
      font_scale?: number;
    };
  };
  onStart: (demo: boolean) => void;
}

const DEFAULT_ORDER = ['kv', 'infoCard', 'cta', 'note'];

export default function Intro({ config, onStart }: Props) {
  const [starting, setStarting] = useState(false);
  const copy = config.copy || {};
  const appearance = config.appearance || {};
  const axes = config.axes || [];
  // ── Typography (03) font scale — every literal px font-size below is run through this ──
  const fs = (px: number) => scaleFont(px, appearance.font_scale);

  const isPair = !config.mode || config.mode === 'pair';
  const isMbti = config.mode === 'mbti';
  const isGroup = config.mode === 'group';
  const qCount = (config.questions as unknown[])?.length ?? 6;
  const axCount = axes.length || 5;
  const defaultLabel = isPair ? `DUO QUIZ · ${qCount} ข้อ` : isMbti ? `MBTI QUIZ · ${qCount} ข้อ` : isGroup ? `GROUP QUIZ · ${qCount} ข้อ` : `SOLO QUIZ · ${qCount} ข้อ`;
  const axLabel = isMbti ? `${Math.pow(2, axCount)} types` : `${axCount} สาย`;
  const defaultBody = isPair
    ? 'คุณกับเพื่อนจะรอดกี่วันถ้าโลกแตกพรุ่งนี้? ตอบ 6 ข้อรู้ว่าคุณเป็นสายไหน แล้วชวนเพื่อนมาจับคู่'
    : isGroup
    ? `ตอบ ${qCount} ข้อ รู้ว่าคุณเป็นสายไหน แล้วสร้างกลุ่มชวนเพื่อนมาดูผลกลุ่มกัน`
    : `ตอบ ${qCount} ข้อ รู้ว่าคุณเป็นสายไหน`;
  const ctaText = copy.intro_cta || 'เริ่มตอบ';

  // ── screen_config wiring: order / show / geo / float position / data source ──
  const { blockOrder, blockVisible, geo: geoOf, pos, src } = getScreenBlocks(appearance, 'Intro', DEFAULT_ORDER);
  const geo = (id: string): BlockGeo => geoOf(id) as BlockGeo;

  // infoCard's primary text field is intro_quiz_label — if the admin bound it to
  // a real axis instead of typing it manually, resolve against the real axes[] list.
  const quizLabelSrc = resolveSrcText(src('infoCard', 'text'), { axes }, copy);
  const quizLabel = copy.intro_quiz_label || quizLabelSrc || defaultLabel;
  const bodyText = copy.intro_body || defaultBody;

  // kv can likewise be bound to an axis's card image instead of the fixed KV upload.
  const kvSrc = resolveSrcImage(src('kv', 'image'), { axes });
  const kvUrl = kvSrc || appearance.images?.['kv-intro'] || config.brand?.kv_image_url;

  const handleStart = (demo: boolean) => {
    if (starting) return;
    setStarting(true);
    onStart(demo);
  };

  // ── Block renderers ────────────────────────────────────────────────────────

  const renderKv = () => {
    if (!blockVisible('kv')) return null;
    const g = geo('kv');
    const heightStyle = g.h ? { height: g.h, objectFit: (g.fit || 'cover') as React.CSSProperties['objectFit'] } : {};
    return kvUrl ? (
      <img key="kv" src={kvUrl} alt="" style={{ display:'block', width:'100%', height:'auto', ...heightStyle }} />
    ) : (
      <div key="kv" style={{ height: g.h || 200, background:'linear-gradient(180deg,#FCEFE0 0%,#F7F1E3 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ color:'var(--ink3)', font:`500 ${fs(11)}px var(--font-body,'Bai Jamjuree'),sans-serif`, border:'1.5px dashed var(--ink3)', padding:'8px 14px', borderRadius:8 }}>KV IMAGE</div>
      </div>
    );
  };

  const renderInfoCard = () => {
    if (!blockVisible('infoCard')) return null;
    const g = geo('infoCard');
    const pad = Number(g.pad) || 16;
    return (
      <div key="infoCard" style={{ background:'var(--card)', border:'var(--border)', borderRadius:'var(--card-radius)', padding:pad, boxShadow:'var(--shadow)', transform:'rotate(calc(var(--tilt-deg) * -1deg))' }}>
        <div style={{ font:`700 ${fs(11)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, letterSpacing:'.1em', color:'var(--ac)' }}>{quizLabel}</div>
        <div style={{ font:`700 ${fs(20)}px/1.35 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink)', marginTop:12 }}>{bodyText}</div>
        <div style={{ display:'flex', gap:12, marginTop:12, font:`600 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)' }}>
          <span>{qCount} {copy.unit_questions || 'ข้อ'}</span><span>·</span><span>{copy.intro_time || '1 นาที'}</span><span>·</span><span>{axLabel}</span>
        </div>
      </div>
    );
  };

  const renderCta = () => {
    if (!blockVisible('cta')) return null;
    const g = geo('cta');
    const bg = g.color === 'primary' ? 'var(--ac)' : 'var(--hl)';
    const fg = g.color === 'primary' ? 'var(--on-ac)' : 'var(--ink)';
    const isSticky = g.sticky === 'on';
    const btn = (
      <button
        key="cta"
        onClick={() => handleStart(false)}
        disabled={starting}
        style={{ width:'100%', padding:'15px 20px', background:bg, color:fg, border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(17)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'var(--shadow)', opacity: starting ? .6 : 1 }}
      >
        {starting ? (copy.intro_loading || 'กำลังโหลด...') : ctaText}
      </button>
    );
    if (isSticky) {
      return (
        <div key="cta-sticky" style={{ position:'sticky', bottom:0, left:0, right:0, background:'var(--bg)', padding:'12px 0 0', zIndex:10 }}>
          {btn}
        </div>
      );
    }
    return btn;
  };

  const renderNote = () => {
    if (!blockVisible('note')) return null;
    if (!copy.intro_note) return null;
    return (
      <div key="note" style={{ textAlign:'center', fontFamily:"var(--font-accent,'Gloria Hallelujah'),cursive", fontSize:fs(11), color:'var(--ink2)' }}>
        {copy.intro_note}
      </div>
    );
  };

  const RENDERERS: Record<string, () => React.ReactNode> = {
    kv:       renderKv,
    infoCard: renderInfoCard,
    cta:      renderCta,
    note:     renderNote,
  };
  for (const xid of ['xImage', 'xText', 'xSpacer', 'xDivider', 'xBox']) {
    RENDERERS[xid] = () => renderExtraBlock(xid, geo(xid) as Record<string, unknown>, copy, appearance?.images, appearance?.font_scale);
  }

  // ── Build output ──────────────────────────────────────────────────────────

  const visible = blockOrder.filter(blockVisible);
  const flowIds  = visible.filter(id => !pos(id));
  const floatIds = visible.filter(id => pos(id));

  // Among flow blocks: kv is always outside the padding wrapper; others go inside
  const topBlocks  = flowIds.filter(id => id === 'kv');
  const bodyBlocks = flowIds.filter(id => id !== 'kv');

  return (
    <div className="screen fade-enter" style={{ background:'var(--bg)', backgroundImage:'var(--texture-bg)', overflowY:'auto', flex:'none', minHeight:'100%', position: floatIds.length ? 'relative' : undefined }}>
      {topBlocks.map(id => RENDERERS[id]?.())}
      <div style={{ padding:'16px 20px 28px', display:'flex', flexDirection:'column', gap:10 }}>
        {bodyBlocks.map(id => RENDERERS[id]?.())}
      </div>
      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
    </div>
  );
}
