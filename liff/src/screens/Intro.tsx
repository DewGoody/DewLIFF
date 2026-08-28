import { useState } from 'react';

interface Props {
  config: {
    brand?: { logo_url?: string; kv_image_url?: string; primary?: string };
    copy?: Record<string, string>;
    mode?: string;
    questions?: unknown[];
    axes?: unknown[];
    appearance?: { intro_layout?: string; images?: Record<string, string> };
  };
  onStart: (demo: boolean) => void;
}

export default function Intro({ config, onStart }: Props) {
  const [starting, setStarting] = useState(false);
  const copy = config.copy || {};
  const appearance = config.appearance || {};

  // KV image already contains logo + character cards — render at natural size
  const kvUrl = appearance.images?.['kv-intro'] || config.brand?.kv_image_url;
  const qCount = (config.questions as unknown[])?.length ?? 6;
  const axCount = (config.axes as unknown[])?.length ?? 5;
  const bodyText = copy.intro_body || 'คุณกับเพื่อนจะรอดกี่วันถ้าโลกแตกพรุ่งนี้? ตอบ 6 ข้อรู้ว่าคุณเป็นสายไหน แล้วชวนเพื่อนมาจับคู่';
  const ctaText = copy.intro_cta || 'เริ่มตอบ';

  const handleStart = (demo: boolean) => {
    if (starting) return;
    setStarting(true);
    onStart(demo);
  };

  return (
    <div className="screen fade-enter" style={{ background:'#F7F1E3', overflowY:'auto', flex:'none', minHeight:'100%' }}>

      {/* KV — full width, height follows image natural proportion (no crop, no dead space) */}
      {kvUrl ? (
        <img src={kvUrl} alt="" style={{ display:'block', width:'100%', height:'auto' }} />
      ) : (
        <div style={{ height:200, background:'linear-gradient(180deg,#FCEFE0 0%,#F7F1E3 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ color:'rgba(28,26,23,.3)', font:"500 11px 'Bai Jamjuree',sans-serif", border:'1.5px dashed rgba(28,26,23,.2)', padding:'8px 14px', borderRadius:8 }}>KV IMAGE</div>
        </div>
      )}

      {/* Content — 20px L/R, 16px top, 28px bottom */}
      <div style={{ padding:'16px 20px 28px' }}>
        {/* Quiz info card */}
        <div style={{ background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'4px 5px 0 #1C1A17' }}>
          <div style={{ font:"700 11px/1 'Bai Jamjuree',sans-serif", letterSpacing:'.1em', color:'#E8354F' }}>DUO QUIZ · {qCount} ข้อ</div>
          <div style={{ font:"700 20px/1.35 'Bai Jamjuree',sans-serif", color:'#1C1A17', marginTop:12 }}>{bodyText}</div>
          <div style={{ display:'flex', gap:12, marginTop:12, font:"600 11px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)' }}>
            <span>{qCount} ข้อ</span><span>·</span><span>1 นาที</span><span>·</span><span>{axCount} สาย</span>
          </div>
        </div>

        {/* 24px gap then CTA */}
        <div style={{ height:24 }} />
        <button
          onClick={() => handleStart(false)}
          disabled={starting}
          style={{ width:'100%', padding:'15px 20px', background:'#F5E14B', color:'#1C1A17', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 17px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 5px 0 #1C1A17', opacity: starting ? .6 : 1 }}
        >
          {starting ? 'กำลังโหลด...' : ctaText}
        </button>
        <div style={{ height:10 }} />
        <div style={{ textAlign:'center', fontFamily:"'Gloria Hallelujah',cursive", fontSize:11, color:'rgba(28,26,23,.5)' }}>
          {copy.intro_note || 'ครบ 3 คู่ลุ้นคูปอง'}
        </div>
      </div>
    </div>
  );
}
