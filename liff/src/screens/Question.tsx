import { useState } from 'react';

interface QuestionData { id: string; kicker?: string; text: string; options: { id: string; label: string }[] }
interface Props {
  config: { copy?: { question_counter?: string }; questions?: QuestionData[] };
  questionIndex: number;
  onAnswer: (questionId: string, optionId: string) => void;
  onBack: () => void;
}

export default function Question({ config, questionIndex, onAnswer, onBack }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const questions = config.questions || [];
  const q = questions[questionIndex];
  const total = questions.length;
  const current = questionIndex + 1;
  const isLast = current === total;
  const pct = Math.round((questionIndex / total) * 100);

  if (!q) return null;
  if (submitting) {
    return (
      <div className="screen" style={{alignItems:'center',justifyContent:'center',background:'#0C0B0A'}}>
        <div className="tex" />
        <div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
          <div style={{width:36,height:36,border:'3px solid rgba(237,231,223,.14)',borderTopColor:'#D95F2B',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
          <span style={{font:"300 13px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.55)'}}>กำลังคำนวณผล...</span>
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
    }, 400);
  };

  const kickerText = q.kicker || `${String(current).padStart(2,'0')} · QUESTION`;

  return (
    <div className="screen fade-enter" key={q.id} style={{background:'#0C0B0A'}}>
      <div className="tex" style={{opacity:.55}} />
      {/* Progress */}
      <div style={{position:'relative',padding:'20px 24px 0',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',font:"500 10px 'IBM Plex Mono',monospace",letterSpacing:'.14em',color:'rgba(237,231,223,.4)'}}>
          <span>QUESTION {String(current).padStart(2,'0')} / {total}</span>
          <span style={{color:'#D95F2B'}}>{pct}%</span>
        </div>
        <div style={{height:2,background:'rgba(237,231,223,.12)',marginTop:10}}>
          <div style={{height:'100%',background:'#D95F2B',transition:'width .4s cubic-bezier(.2,.8,.2,1)',width:`${pct}%`}} />
        </div>
      </div>
      {/* Body */}
      <div style={{position:'relative',flex:1,padding:'26px 24px 28px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{fontFamily:'Anton,sans-serif',fontSize:15,letterSpacing:'.22em',color:'rgba(217,95,43,.9)'}}>
          {kickerText}
        </div>
        <div style={{font:"600 26px/1.5 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF',marginTop:14}}>{q.text}</div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:26}}>
          {q.options.map((opt, i) => (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={!!selected}
              style={{
                display:'flex',gap:12,alignItems:'flex-start',
                background: selected === opt.id ? 'rgba(217,95,43,.18)' : '#12100E',
                border: selected === opt.id ? '1px solid #D95F2B' : '1px solid rgba(237,231,223,.13)',
                color:'#EDE7DF',padding:'15px 14px',cursor:'pointer',borderRadius:2,transition:'all .18s'
              }}
            >
              <span style={{font:"500 10.5px 'IBM Plex Mono',monospace",color:'rgba(217,95,43,.85)',flexShrink:0,paddingTop:3}}>
                {['A','B','C','D','E'][i]}
              </span>
              <span style={{font:"400 14.5px/1.6 'IBM Plex Sans Thai',sans-serif",textAlign:'left'}}>{opt.label}</span>
            </button>
          ))}
        </div>
        {/* Bottom: back button + dots */}
        <div style={{marginTop:'auto',display:'flex',alignItems:'center',gap:14,paddingTop:18}}>
          <button onClick={onBack} style={{background:'none',border:'none',color:'rgba(237,231,223,.35)',font:"400 12px 'IBM Plex Sans Thai',sans-serif",cursor:'pointer',padding:'6px 0'}}>← ย้อนกลับ</button>
          <div style={{marginLeft:'auto',display:'flex',gap:5}}>
            {questions.map((_, i) => (
              <span key={i} style={{width:5,height:5,borderRadius:'50%',display:'block',background: i <= questionIndex ? '#D95F2B' : 'rgba(237,231,223,.2)'}} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
