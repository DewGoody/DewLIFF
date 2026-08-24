interface Props {
  config: { copy?: { invited_title?: string } };
  inviterName?: string;
  inviterPic?: string;
  inviterArchLabel?: string;
  inviterArchEn?: string;
  onStart: () => void;
}

export default function Invited({ config, inviterName, inviterPic, inviterArchLabel, inviterArchEn, onStart }: Props) {
  const name = inviterName || 'เพื่อน';
  const initial = name[0];

  return (
    <div className="screen fade-enter" style={{background:'#0C0B0A'}}>
      {/* KV top 52% */}
      <div style={{height:'52%',flexShrink:0,position:'relative',background:'#100E0C',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'repeating-linear-gradient(48deg,rgba(237,231,223,.08) 0 1px,transparent 1px 6px)'}} />
        <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 68% 62%,rgba(217,95,43,.4),transparent 55%)'}} />
        <div style={{position:'absolute',left:0,right:0,bottom:0,height:110,background:'linear-gradient(to top,#0C0B0A,transparent)'}} />
        <div style={{position:'absolute',left:18,top:18,font:"500 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.12em',color:'rgba(237,231,223,.34)',border:'1px dashed rgba(237,231,223,.22)',padding:'5px 8px',borderRadius:3}}>KV_03_INVITED · figure holding a note, ruined street</div>
      </div>
      {/* Invitation card overlapping */}
      <div style={{flex:1,padding:'0 26px 30px',display:'flex',flexDirection:'column',marginTop:-46,position:'relative'}}>
        <div style={{background:'#15120F',border:'1px solid rgba(237,231,223,.14)',padding:'22px 20px',boxShadow:'0 18px 46px rgba(0,0,0,.6)',position:'relative'}}>
          <div style={{position:'absolute',top:-11,left:20,background:'#D95F2B',color:'#12100E',font:"600 10px 'IBM Plex Mono',monospace",letterSpacing:'.14em',padding:'4px 8px'}}>INVITATION</div>
          <div style={{display:'flex',alignItems:'center',gap:13}}>
            <div style={{width:46,height:46,borderRadius:'50%',background:'#241D18',border:'1px solid rgba(217,95,43,.5)',display:'flex',alignItems:'center',justifyContent:'center',font:"600 15px 'IBM Plex Sans Thai',sans-serif",color:'#D95F2B'}}>
              {inviterPic ? <img src={inviterPic} alt="" style={{width:46,height:46,borderRadius:'50%',objectFit:'cover'}} /> : initial}
            </div>
            <div>
              <div style={{font:"600 16px 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF'}}>{name}</div>
              <div style={{font:"400 10.5px 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.4)',marginTop:3}}>ชวนคุณมาจับคู่</div>
              {inviterArchLabel && (
                <div style={{font:"400 10.5px 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.4)',marginTop:3}}>
                  {inviterArchEn && `${inviterArchEn} · `}{inviterArchLabel}
                </div>
              )}
            </div>
          </div>
          <div style={{font:"300 14.5px/1.85 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.72)',marginTop:16}}>ชวนคุณมาดูว่า<b style={{fontWeight:600,color:'#EDE7DF'}}>ถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน</b> — ตอบ 6 ข้อ ใช้เวลาไม่ถึงนาที</div>
        </div>
        <div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:11}}>
          <button className="btn-primary" onClick={onStart}>ตอบให้ {name} →</button>
        </div>
      </div>
    </div>
  );
}
