import { ARCH } from '../data';

interface Props { title: string; body: string; onRetry?: () => void; }

export default function ErrorScreen({ title, body, onRetry }: Props) {
  const card = ARCH.line?.card; // THE ANALYST card — shaking signal
  const handleClose = () => { try { liff.closeWindow(); } catch { window.close(); } };

  return (
    <div className="screen" style={{ background:'#F7F1E3', alignItems:'center', justifyContent:'center', padding:'0 20px', textAlign:'center' }}>
      <div style={{ width:150, height:150, position:'relative', animation:'v2Shake 2s ease-in-out infinite' }}>
        {card ? <img src={card} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : null}
      </div>
      <div style={{ font:"700 26px/1.3 'Bai Jamjuree',sans-serif", marginTop:24 }}>อ๊ะ! สัญญาณหลุด</div>
      <div style={{ font:"500 14px/1.7 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.6)', marginTop:8 }}>{body || 'โลกกำลังจะแตกก็แบบนี้แหละ ลองอีกทีนะ'}</div>
      {title && <div style={{ font:"600 11px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.35)', marginTop:12 }}>{title}</div>}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ marginTop:24, background:'#E8354F', color:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:13, padding:'14px 32px', font:"700 17px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 5px 0 #1C1A17' }}
        >ลองอีกครั้ง</button>
      )}
      <button
        onClick={handleClose}
        style={{ marginTop:12, background:'none', border:'none', color:'rgba(28,26,23,.45)', font:"600 11px/1.5 'Bai Jamjuree',sans-serif", cursor:'pointer', padding:4 }}
      >กลับหน้าแรก</button>
    </div>
  );
}
