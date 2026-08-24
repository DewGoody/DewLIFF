interface Props {
  config: { brand?: { primary?: string; name?: string }; copy?: Record<string, string> };
  shareUrl: string;
  myArchetypeLabel?: string;
  pairsDone?: number;
  onGoSummary: () => void;
}

export default function Share({ config, shareUrl, myArchetypeLabel, pairsDone, onGoSummary }: Props) {
  const copy = config.copy || {};
  const primary = '#D95F2B';

  const handleShare = async () => {
    try {
      await liff.shareTargetPicker([{
        type: 'flex',
        altText: 'โลกแตกพรุ่งนี้ เราสองคนรอดกี่วัน?',
        contents: {
          type: 'bubble',
          body: {
            type: 'box', layout: 'vertical', spacing: 'md',
            contents: [
              { type: 'text', text: 'โลกแตกพรุ่งนี้ เราสองคนรอดกี่วัน?', weight: 'bold', size: 'lg', wrap: true, color: '#EDE7DF' },
              { type: 'text', text: copy['share_body'] || 'เพื่อนคุณเป็นสายไหน ตอบ 6 ข้อ 1 นาทีรู้ผล', size: 'sm', color: '#888888', wrap: true },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'button', action: { type: 'uri', label: copy['share_cta'] || 'ดูผลของเรา', uri: shareUrl }, style: 'primary', color: primary }],
          },
        },
      }]);
      onGoSummary();
    } catch { /* cancelled — stay */ }
  };

  return (
    <div className="screen fade-enter" style={{background:'#0C0B0A',overflowY:'auto'}}>
      {/* KV area */}
      <div style={{height:230,flexShrink:0,position:'relative',background:'#100E0C',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'repeating-linear-gradient(50deg,rgba(237,231,223,.07) 0 1px,transparent 1px 7px)'}} />
        {/* paper airplane animation placeholder */}
        <div style={{position:'absolute',right:44,top:96,width:120,height:1,borderTop:'1px dashed rgba(237,231,223,.35)',animation:'duoFly 3.4s ease-in-out infinite alternate'}} />
        <div style={{position:'absolute',right:30,top:78,width:16,height:16,background:'#D95F2B',borderRadius:'50%',filter:'blur(9px)'}} />
        <div style={{position:'absolute',left:18,top:18,font:"500 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.12em',color:'rgba(237,231,223,.34)',border:'1px dashed rgba(237,231,223,.22)',padding:'5px 8px',borderRadius:3}}>KV_05_SHARE · paper airplane through smoke</div>
        <div style={{position:'absolute',left:0,right:0,bottom:0,height:90,background:'linear-gradient(to top,#0C0B0A,transparent)'}} />
      </div>
      <div style={{padding:'0 24px 30px',display:'flex',flexDirection:'column',flex:1}}>
        <div style={{font:"700 27px/1.35 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF',marginTop:-10}}>
          คุณคือ <span style={{color:'#D95F2B'}}>{myArchetypeLabel || '...'}</span>
        </div>
        <div style={{font:"300 14px/1.8 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.6)',marginTop:10}}>เหลืออีกอย่างเดียว — ชวนเพื่อนมาตอบ แล้วดูว่าคู่นี้รอดกี่วัน</div>
        {/* Flex message preview */}
        <div style={{marginTop:20,background:'#15120F',border:'1px solid rgba(237,231,223,.13)',padding:16,position:'relative',clipPath:'polygon(0 0,100% 0,100% calc(100% - 9px),96% 100%,0 100%)'}}>
          <div style={{font:"500 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.14em',color:'rgba(237,231,223,.32)',marginBottom:10}}>FLEX MESSAGE PREVIEW</div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:62,height:62,flexShrink:0,background:'#100E0C',border:'1px dashed rgba(237,231,223,.2)',display:'flex',alignItems:'center',justifyContent:'center',font:"400 8px 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.3)',textAlign:'center'}}>KV<br/>THUMB</div>
            <div style={{minWidth:0}}>
              <div style={{font:"600 14px 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF'}}>โลกแตกพรุ่งนี้ เราสองคนรอดกี่วัน?</div>
              <div style={{font:"300 11.5px/1.55 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.45)',marginTop:5}}>{copy['share_body'] || 'เพื่อนคุณเป็นสายไหน ตอบ 6 ข้อ 1 นาทีรู้ผล'}</div>
            </div>
          </div>
          <div style={{marginTop:12,borderTop:'1px solid rgba(237,231,223,.1)',paddingTop:10,textAlign:'center',font:"600 12px 'IBM Plex Sans Thai',sans-serif",color:'#D95F2B'}}>{copy['share_cta'] || 'ดูผลของเรา'}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:22}}>
          <button className="btn-primary" onClick={handleShare}>แชร์ผ่าน LINE</button>
          <button
            onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); } catch {} }}
            className="btn-outline"
            style={{font:"400 13px 'IBM Plex Mono',monospace",display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
          >
            COPY LINK
          </button>
        </div>
        {pairsDone !== undefined && (
          <button style={{width:'100%',marginTop:20,display:'flex',alignItems:'center',gap:12,textAlign:'left',border:'1px dashed rgba(217,95,43,.35)',padding:'13px 14px',background:'rgba(217,95,43,.05)',cursor:'pointer',borderRadius:0}}
            onClick={onGoSummary}>
            <span style={{fontFamily:'Anton,sans-serif',fontSize:24,color:'#D95F2B',lineHeight:1}}>{pairsDone}/3</span>
            <span style={{font:"300 11.5px/1.6 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.55)'}}>ครบ 3 คู่ = ลุ้นคูปองส่วนลด + ได้ 50 แต้มทุกคู่</span>
          </button>
        )}
        <button onClick={onGoSummary} style={{marginTop:16,background:'none',border:'none',color:'rgba(237,231,223,.35)',font:"400 12px 'IBM Plex Sans Thai',sans-serif",cursor:'pointer',padding:8}}>ข้ามไปดูสรุปของฉัน</button>
      </div>
    </div>
  );
}
