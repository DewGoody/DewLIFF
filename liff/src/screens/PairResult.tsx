interface Props {
  config: { brand?: { primary?: string; name?: string } };
  partnerName: string; title: string; body: string;
  imageUrl?: string; axisMe?: string; axisBuddy?: string;
  axisMeShort?: string; axisBuddyShort?: string;
  rank?: number;
  pairUrl?: string; onBack: () => void;
}

export default function PairResult({ config, partnerName, title, body, imageUrl, axisMe, axisBuddy, axisMeShort, axisBuddyShort, rank, pairUrl, onBack }: Props) {
  const primary = '#D95F2B';

  const handleShare = async () => {
    const url = pairUrl || window.location.href;
    try {
      await liff.shareTargetPicker([{
        type: 'flex', altText: `คู่หูสำรวจโลกแตก — ${title}`,
        contents: {
          type: 'bubble',
          body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
            { type: 'text', text: `คุณ × ${partnerName}`, size: 'xs', color: '#888888' },
            { type: 'text', text: title, weight: 'bold', size: 'xl', wrap: true, color: primary },
            { type: 'text', text: body, size: 'sm', color: '#666666', wrap: true },
          ]},
          footer: { type: 'box', layout: 'vertical', contents: [
            { type: 'button', action: { type: 'uri', label: 'ดูผลคู่', uri: url }, style: 'primary', color: primary },
          ]},
        },
      }]);
    } catch { /* cancelled */ }
  };

  return (
    <div className="screen fade-enter" style={{background:'#0C0B0A'}}>
      <div className="tex" style={{opacity:.55}} />
      {/* ember gradient bottom */}
      <div style={{position:'absolute',left:0,right:0,bottom:0,height:'58%',background:'linear-gradient(to top,rgba(217,95,43,.4),transparent)',pointerEvents:'none'}} />
      <div style={{position:'absolute',left:0,right:0,bottom:0,top:'35%',background:'linear-gradient(to top,#0C0B0A 22%,rgba(12,11,10,.55) 60%,transparent)',pointerEvents:'none'}} />
      {/* KV placeholder */}
      <div style={{position:'absolute',left:16,top:16,font:"500 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.12em',color:'rgba(237,231,223,.3)',border:'1px dashed rgba(237,231,223,.2)',padding:'5px 8px'}}>KV_07_PAIR · two figures on cliff, ember horizon</div>

      {/* Content anchored to bottom */}
      <div style={{position:'relative',marginTop:'auto',padding:'0 24px 30px'}}>
        <div style={{font:"500 10px 'IBM Plex Mono',monospace",letterSpacing:'.2em',color:primary}}>คู่นี้รอดได้</div>
        <div style={{font:"700 46px/1.1 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF',marginTop:8}}>{title}</div>
        {rank !== undefined && (
          <div style={{font:"400 11px 'IBM Plex Mono',monospace",letterSpacing:'.1em',color:'rgba(237,231,223,.45)',marginTop:8}}>
            อันดับ {rank} จาก 15 คู่
          </div>
        )}
        <div style={{font:"300 14px/1.85 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.62)',marginTop:12}}>{body}</div>
        {/* Axis cards */}
        {(axisMe || axisBuddy) && (
          <div style={{display:'flex',gap:10,marginTop:20}}>
            {axisBuddy && <div style={{flex:1,border:'1px solid rgba(237,231,223,.14)',padding:12,background:'rgba(12,11,10,.5)'}}>
              <div style={{font:"400 9px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.35)'}}>{partnerName}</div>
              <div style={{font:"600 13.5px 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF',marginTop:4}}>{axisBuddy}</div>
              {axisBuddyShort && <div style={{font:"300 11px/1.5 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.45)',marginTop:5}}>{axisBuddyShort}</div>}
            </div>}
            {axisMe && <div style={{flex:1,border:'1px solid rgba(217,95,43,.45)',padding:12,background:'rgba(217,95,43,.07)'}}>
              <div style={{font:"400 9px 'IBM Plex Mono',monospace",letterSpacing:'.1em',color:'rgba(237,231,223,.35)'}}>คุณ</div>
              <div style={{font:"600 13.5px 'IBM Plex Sans Thai',sans-serif",color:primary,marginTop:4}}>{axisMe}</div>
              {axisMeShort && <div style={{font:"300 11px/1.5 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.45)',marginTop:5}}>{axisMeShort}</div>}
            </div>}
          </div>
        )}
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button className="btn-primary" style={{flex:1}} onClick={handleShare}>แชร์การ์ดคู่นี้</button>
          <button onClick={onBack} style={{flexShrink:0,background:'none',border:'1px solid rgba(237,231,223,.18)',color:'rgba(237,231,223,.6)',borderRadius:2,padding:'16px 18px',font:"400 13px 'IBM Plex Sans Thai',sans-serif",cursor:'pointer'}}>สรุป</button>
        </div>
      </div>
    </div>
  );
}
