import { ARCH } from '../data';

export default function Loading() {
  const card = ARCH.prep.card;
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'#F7F1E3', position:'relative' }}>
      <div style={{ position:'absolute', inset:0, opacity:.5, background:'radial-gradient(circle at 30% 20%,rgba(122,196,214,.3),transparent 45%),radial-gradient(circle at 75% 75%,rgba(245,225,75,.35),transparent 45%)', pointerEvents:'none' }} />
      <div style={{ position:'relative', width:150, height:150, animation:'v2Bob 2.4s ease-in-out infinite' }}>
        <img src={card} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
      </div>
      <div style={{ position:'relative', textAlign:'center' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:28, letterSpacing:'.06em', color:'#1C1A17' }}>HANG ON!</div>
        <div style={{ font:"500 13px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)', marginTop:8 }}>กำลังรวมทีมเอาตัวรอด...</div>
      </div>
      <div style={{ position:'relative', width:190, height:12, border:'2px solid #1C1A17', borderRadius:8, overflow:'hidden', background:'#FFFDF6' }}>
        <div className="pbar-loading" />
      </div>
    </div>
  );
}
