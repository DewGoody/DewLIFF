import { useState } from 'react';
import { getScreenBlocks, resolveSrcText, floatStyle, scaleFont } from '../screenConfig';

interface QuestionData { id: string; kicker?: string; text: string; options: { id: string; label: string }[] }
interface AxisConfig { label?: string; label_en?: string; body?: string; image_url?: string }
interface Props {
  config: {
    copy?: Record<string, string>;
    questions?: QuestionData[];
    axes?: AxisConfig[];
    appearance?: { images?: Record<string, string>; screen_config?: Record<string, { blocks: any[] }>; font_scale?: number };
  };
  questionIndex: number;
  onAnswer: (questionId: string, optionId: string) => void;
  onBack: () => void;
}

const KEYS = ['A','B','C','D','E','F','G','H'];
const DEFAULT_ORDER = ['progress', 'qCard', 'options', 'backRow'];

export default function Question({ config, questionIndex, onAnswer, onBack }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const questions = config.questions || [];
  const q = questions[questionIndex];
  const total = questions.length;
  const current = questionIndex + 1;
  const isLast = current === total;
  const pct = Math.round((current / total) * 100);
  const copy = config.copy || {};
  const axes = config.axes || [];
  const appearance = config.appearance || {};
  // ── Typography (03) font scale — every literal px font-size below is run through this ──
  const fs = (px: number) => scaleFont(px, appearance.font_scale);

  // ── screen_config wiring: order / show / geo / float position / data source ──
  // progress/qCard/options are locked binds (questionIndex, questions[i].text,
  // questions[i].options → onAnswer()) — no CH_OF channel, so no src resolution for them.
  // backRow is the only slot with a configurable data-source channel (its back-button text).
  const { blockOrder, blockVisible, geo: geoOf, pos, src } = getScreenBlocks(appearance, 'Question', DEFAULT_ORDER);
  const geo = (id: string): Record<string, string | number> => geoOf(id);

  const backTextSrc = resolveSrcText(src('backRow', 'text'), { axes }, copy);
  const backText = copy.question_back || backTextSrc || '← ย้อนกลับ';

  if (!q) return null;

  if (submitting) {
    return (
      <div className="screen" style={{ alignItems:'center', justifyContent:'center', background:'var(--bg)', backgroundImage:'var(--texture-bg)' }}>
        <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{ width:36, height:36, border:'3px solid rgba(28,26,23,.15)', borderTopColor:'var(--ac)', borderRadius:'50%', animation:'v2Spin 0.8s linear infinite' }} />
          <span style={{ font:`500 ${fs(13)}px var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)' }}>{copy.question_calculating || 'กำลังคำนวณผล...'}</span>
        </div>
      </div>
    );
  }

  const handleSelect = (optionId: string) => {
    if (selected || submitting) return;
    setSelected(optionId);
    setTimeout(() => {
      if (isLast) setSubmitting(true);
      onAnswer(q.id, optionId);
      setSelected(null);
    }, 380);
  };

  const qCardGeo = geo('qCard');
  const qCardPad = Number(qCardGeo.pad) || 16;
  const qCardSize = Number(qCardGeo.size) || 20;

  const optionsGeo = geo('options');
  const optH = Number(optionsGeo.optH) || 56;
  const keyShape = (optionsGeo.keyShape as string) || 'circle';

  // ── Block renderers ────────────────────────────────────────────────────────

  const renderProgress = () => (
    <div key="progress" style={{ padding:'20px 20px 0', flexShrink:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ font:`700 ${fs(16)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink)' }}>{copy.question_progress ? copy.question_progress.replace('{current}', String(current)).replace('{total}', String(total)) : `ข้อ ${current} / ${total}`}</span>
        <span style={{ background:'var(--hl)', border:'2px solid var(--ink)', padding:'1px 8px', font:`700 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, transform:'rotate(1.5deg)', display:'inline-block' }}>{pct}%</span>
      </div>
      <div className="pbar" style={{ marginTop:8 }}>
        <div className="pbar-fill" style={{ width:`${pct}%` }} />
      </div>
    </div>
  );

  const renderQCard = () => (
    <div key="qCard" style={{ background:'var(--card)', border:'var(--border)', borderRadius:'var(--card-radius)', padding:qCardPad, boxShadow:'var(--shadow)' }}>
      <div style={{ font:`700 ${fs(qCardSize)}px/1.35 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink)' }}>{q.text}</div>
    </div>
  );

  const renderOptions = () => (
    <div key="options" style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
      {q.options.map((opt, i) => (
        <button
          key={opt.id}
          onClick={() => handleSelect(opt.id)}
          disabled={!!selected}
          style={{
            display:'flex', gap:12, alignItems:'center',
            minHeight:optH,
            background: selected === opt.id ? 'var(--hl)' : 'var(--card)',
            border: selected === opt.id ? 'var(--border)' : '2px solid var(--ink)',
            borderRadius:'var(--radius)', padding:'0 12px', cursor:'pointer',
            boxShadow: selected === opt.id ? '3px 4px 0 var(--ink)' : '2px 3px 0 var(--ink)',
            transition:'all .15s',
          }}
        >
          {keyShape !== 'none' && (
            <span style={{ width:26, height:26, flexShrink:0, border:'2px solid var(--ink)', borderRadius: keyShape === 'square' ? 6 : '50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(14), background:'var(--card)' }}>{KEYS[i]}</span>
          )}
          <span style={{ font:`500 ${fs(14)}px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif`, textAlign:'left' }}>{opt.label}</span>
        </button>
      ))}
    </div>
  );

  const renderBackRow = () => (
    <div key="backRow" style={{ marginTop:20, display:'flex', alignItems:'center', gap:12 }}>
      <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--ink2)', font:`600 ${fs(12)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', padding:'4px 0' }}>{backText}</button>
      <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
        {questions.map((_, i) => (
          <span key={i} style={{ width:6, height:6, borderRadius:'50%', display:'block', background: i < current ? 'var(--ink)' : 'var(--ink3)' }} />
        ))}
      </div>
    </div>
  );

  const RENDERERS: Record<string, () => React.ReactNode> = {
    progress: renderProgress,
    qCard: renderQCard,
    options: renderOptions,
    backRow: renderBackRow,
  };

  // ── Build output ──────────────────────────────────────────────────────────
  // progress keeps its own top padding wrapper (like Intro's kv); qCard/options/backRow
  // share the scrolling body wrapper and reorder freely among themselves within it.

  const visible = blockOrder.filter(blockVisible);
  const flowIds  = visible.filter(id => !pos(id));
  const floatIds = visible.filter(id => pos(id));
  const topBlocks  = flowIds.filter(id => id === 'progress');
  const bodyBlocks = flowIds.filter(id => id !== 'progress');

  return (
    <div className="screen fade-enter" key={q.id} style={{ background:'var(--bg)', backgroundImage:'var(--texture-bg)', position: floatIds.length ? 'relative' : undefined }}>
      {topBlocks.map(id => RENDERERS[id]?.())}
      <div style={{ flex:1, padding:'16px 20px 28px', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        {bodyBlocks.map(id => RENDERERS[id]?.())}
      </div>
      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
    </div>
  );
}
