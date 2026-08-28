import { useState } from 'react';

interface QuestionData { id: string; kicker?: string; text: string; options: { id: string; label: string }[] }
interface Props {
  config: { copy?: Record<string, string>; questions?: QuestionData[] };
  questionIndex: number;
  onAnswer: (questionId: string, optionId: string) => void;
  onBack: () => void;
}

const KEYS = ['A','B','C','D','E','F','G','H'];

export default function Question({ config, questionIndex, onAnswer, onBack }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const questions = config.questions || [];
  const q = questions[questionIndex];
  const total = questions.length;
  const current = questionIndex + 1;
  const isLast = current === total;
  const pct = Math.round((current / total) * 100);

  if (!q) return null;

  if (submitting) {
    return (
      <div className="screen" style={{ alignItems:'center', justifyContent:'center', background:'#F7F1E3' }}>
        <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{ width:36, height:36, border:'3px solid rgba(28,26,23,.15)', borderTopColor:'#E8354F', borderRadius:'50%', animation:'v2Spin 0.8s linear infinite' }} />
          <span style={{ font:"500 13px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)' }}>กำลังคำนวณผล...</span>
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

  return (
    <div className="screen fade-enter" key={q.id} style={{ background:'#F7F1E3' }}>
      {/* Progress — 20px padding top, 20px L/R */}
      <div style={{ padding:'20px 20px 0', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ font:"700 16px/1.4 'Bai Jamjuree',sans-serif", color:'#1C1A17' }}>ข้อ {current} / {total}</span>
          <span style={{ background:'#F5E14B', border:'2px solid #1C1A17', padding:'1px 8px', font:"700 11px/1.5 'Bai Jamjuree',sans-serif", transform:'rotate(1.5deg)', display:'inline-block' }}>{pct}%</span>
        </div>
        <div className="pbar" style={{ marginTop:8 }}>
          <div className="pbar-fill" style={{ width:`${pct}%` }} />
        </div>
      </div>

      {/* Body — 16px gap after pbar, 20px L/R, 28px bottom */}
      <div style={{ flex:1, padding:'16px 20px 28px', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        {/* Question card */}
        <div style={{ background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'4px 5px 0 #1C1A17' }}>
          <div style={{ font:"700 20px/1.35 'Bai Jamjuree',sans-serif", color:'#1C1A17' }}>{q.text}</div>
        </div>

        {/* Options — 56px height each, 8px gap, r12 */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
          {q.options.map((opt, i) => (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={!!selected}
              style={{
                display:'flex', gap:12, alignItems:'center',
                minHeight:56,
                background: selected === opt.id ? '#F5E14B' : '#FFFDF6',
                border: selected === opt.id ? '2.5px solid #1C1A17' : '2px solid #1C1A17',
                borderRadius:12, padding:'0 12px', cursor:'pointer',
                boxShadow: selected === opt.id ? '3px 4px 0 #1C1A17' : '2px 3px 0 #1C1A17',
                transition:'all .15s',
              }}
            >
              <span style={{ width:26, height:26, flexShrink:0, border:'2px solid #1C1A17', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:14, background:'#FFFDF6' }}>{KEYS[i]}</span>
              <span style={{ font:"500 14px/1.7 'Bai Jamjuree',sans-serif", textAlign:'left' }}>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Back + dots — 20px gap above */}
        <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(28,26,23,.5)', font:"600 12px/1.5 'Bai Jamjuree',sans-serif", cursor:'pointer', padding:'4px 0' }}>← ย้อนกลับ</button>
          <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
            {questions.map((_, i) => (
              <span key={i} style={{ width:6, height:6, borderRadius:'50%', display:'block', background: i < current ? '#1C1A17' : 'rgba(28,26,23,.2)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
