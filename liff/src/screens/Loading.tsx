interface Props {
  appearance?: { loading_style?: string; loading_copy?: string; };
}

export default function Loading({ appearance }: Props) {
  const style = appearance?.loading_style || 'ring';
  const copy = appearance?.loading_copy || 'กำลังเชื่อมสัญญาณ...';

  const renderIndicator = () => {
    if (style === 'pulse') {
      return (
        <div style={{width:60,height:60,borderRadius:12,background:'#D95F2B',animation:'duoPulse 1.4s ease-in-out infinite'}} />
      );
    }
    if (style === 'bar') {
      return (
        <div style={{width:160,height:4,background:'rgba(237,231,223,.14)',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',background:'#D95F2B',borderRadius:2,animation:'duoBar 1.8s ease-in-out infinite'}} />
        </div>
      );
    }
    if (style === 'skeleton') {
      return (
        <div style={{display:'flex',flexDirection:'column',gap:10,width:200}}>
          <div style={{height:14,borderRadius:4,background:'rgba(237,231,223,.18)',animation:'duoPulse 1.6s ease-in-out infinite'}} />
          <div style={{height:10,borderRadius:4,background:'rgba(237,231,223,.10)',animation:'duoPulse 1.6s ease-in-out .2s infinite',width:'75%'}} />
          <div style={{height:10,borderRadius:4,background:'rgba(237,231,223,.08)',animation:'duoPulse 1.6s ease-in-out .4s infinite',width:'55%'}} />
        </div>
      );
    }
    // default: ring
    return (
      <div style={{position:'relative',width:150,height:150,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'1px solid rgba(237,231,223,.14)',borderTopColor:'#D95F2B',animation:'duoSpin 1.5s linear infinite'}} />
        <div style={{position:'absolute',inset:22,borderRadius:'50%',border:'1px dashed rgba(237,231,223,.1)',animation:'duoSpin 4s linear infinite reverse'}} />
        <div style={{width:9,height:9,background:'#D95F2B',borderRadius:'50%',boxShadow:'0 0 26px 8px rgba(217,95,43,.5)',animation:'duoPulse 2s ease-in-out infinite'}} />
      </div>
    );
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:26,background:'#0C0B0A',position:'relative'}}>
      <div className="tex" />
      {renderIndicator()}
      <div style={{textAlign:'center'}}>
        <div style={{fontFamily:'Anton,sans-serif',fontSize:15,letterSpacing:'.3em',color:'rgba(237,231,223,.72)'}}>CONNECTING</div>
        <div style={{font:"300 12px/1.6 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.38)',marginTop:8}}>{copy}</div>
      </div>
      <div style={{position:'absolute',bottom:34,left:0,right:0,textAlign:'center',font:"400 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.16em',color:'rgba(237,231,223,.22)'}}>LIFF.INIT · PROFILE · SESSION</div>
    </div>
  );
}
