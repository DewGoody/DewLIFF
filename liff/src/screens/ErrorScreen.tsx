interface Props { title: string; body: string; onRetry?: () => void; }

export default function ErrorScreen({ title, body, onRetry }: Props) {
  const handleClose = () => { try { liff.closeWindow(); } catch { window.close(); } };

  return (
    <div className="screen" style={{background:'#0C0B0A',alignItems:'center',justifyContent:'center',padding:'0 40px',textAlign:'center'}}>
      <div style={{width:132,height:132,border:'1px dashed rgba(237,231,223,.22)',display:'flex',alignItems:'center',justifyContent:'center',font:"400 9px/1.6 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.32)',letterSpacing:'.1em'}}>KV_08_ERROR<br/>SIGNAL LOST<br/>broken radio</div>
      <div style={{fontFamily:'Anton,sans-serif',fontSize:24,letterSpacing:'.14em',color:'#EDE7DF',marginTop:28}}>SIGNAL LOST</div>
      <div style={{font:"300 14px/1.85 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.5)',marginTop:12}}>{body || 'สัญญาณขาดหายไปสักครู่ — ลองใหม่อีกที'}</div>
      <div style={{font:"400 10px 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.25)',marginTop:14,letterSpacing:'.1em'}}>{title}</div>
      {onRetry && <button className="btn-primary" style={{marginTop:30}} onClick={onRetry}>ลองอีกครั้ง</button>}
      <button onClick={handleClose} style={{marginTop:12,background:'none',border:'none',color:'rgba(237,231,223,.35)',font:"400 12px 'IBM Plex Sans Thai',sans-serif",cursor:'pointer',padding:8}}>ปิดหน้าต่าง</button>
    </div>
  );
}
