import { useState } from 'react';

interface PairEntry {
  pairId: string; role: 'inviter'|'invitee'; partnerName: string;
  status: 'waiting'|'completed'|'expired'; resultTitle?: string;
  partnerAxisLabel?: string;
}
export interface PairPopup {
  pairId?: string; title: string; body: string; eyebrow?: string;
  axisMe?: string; axisBuddy?: string; partnerName?: string; imageUrl?: string;
}
interface Props {
  config: {
    brand?: { primary?: string; name?: string };
    copy?: Record<string, string>;
    group?: { enabled?: boolean };
  };
  myArchetypeLabel: string; myArchetypeBody?: string;
  myArchetypeEn?: string; myArchetypeOrder?: string; myArchetypeShort?: string;
  archStats?: { bestPartnerLabel: string; bestSurvival: string; worstPartnerLabel: string; worstSurvival: string };
  pairsDone?: number;
  shareUrl: string; pairs: PairEntry[];
  initialPopup?: PairPopup | null;
  onShare: () => void;
  onViewPair: (pairId: string, partnerName: string) => void;
  onGoRewards?: () => void;
  onCreateGroup?: () => void;
}

export default function Summary({ config, myArchetypeLabel, myArchetypeBody, myArchetypeEn, myArchetypeOrder, myArchetypeShort, archStats, pairsDone, pairs, initialPopup, onShare, onViewPair, onGoRewards, onCreateGroup }: Props) {
  const [popup, setPopup] = useState<PairPopup | null>(initialPopup ?? null);
  const primary = '#D95F2B';

  return (
    <>
      {/* Popup */}
      {popup && (
        <div style={{position:'fixed',inset:0,background:'rgba(12,11,10,.75)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:22}}>
          <div className="fade-enter" style={{width:'100%',maxWidth:340,background:'#15120F',border:'1px solid rgba(237,231,223,.14)',boxShadow:'0 20px 50px rgba(0,0,0,.65)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(237,231,223,.12)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{font:"500 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(237,231,223,.4)'}}>ผลคู่สำเร็จ</span>
              <span onClick={() => setPopup(null)} style={{fontSize:14,color:'rgba(237,231,223,.4)',cursor:'pointer'}}>✕</span>
            </div>
            <div style={{padding:'20px 20px 22px',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>
              {/* Overlapping avatars */}
              <div style={{display:'flex',alignItems:'center',marginBottom:16}}>
                <span style={{width:44,height:44,borderRadius:'50%',background:'#241D18',border:'1px solid rgba(217,95,43,.4)',display:'flex',alignItems:'center',justifyContent:'center',font:"600 15px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.7)'}}>{popup.partnerName?.[0] || '?'}</span>
                <span style={{width:44,height:44,marginLeft:-12,borderRadius:'50%',background:primary,border:'2px solid #15120F',display:'flex',alignItems:'center',justifyContent:'center',font:"600 15px 'IBM Plex Sans Thai',sans-serif",color:'#12100E'}}>คุ</span>
              </div>
              {popup.imageUrl && <img src={popup.imageUrl} alt="" style={{width:'100%',height:112,objectFit:'cover',borderRadius:2,marginBottom:16}} />}
              <div style={{font:"500 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(237,231,223,.4)'}}>{popup.partnerName || 'คู่หู'} × คุณ</div>
              <h3 style={{margin:'7px 0 0',font:"700 24px/1.2 'IBM Plex Sans Thai',sans-serif",color:primary}}>{popup.title}</h3>
              <p style={{margin:'10px 0 18px',font:"300 13.5px/1.55 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.65)'}}>{popup.body}</p>
              {popup.pairId && (
                <button className="btn-primary" style={{marginBottom:8}} onClick={() => { const pid=popup.pairId!; const pname=popup.partnerName||'คู่หู'; setPopup(null); onViewPair(pid,pname); }}>ดูผลคู่แบบเต็ม</button>
              )}
              <button onClick={() => setPopup(null)} style={{width:'100%',padding:12,border:0,background:'transparent',color:'rgba(237,231,223,.4)',font:"inherit",fontSize:13,cursor:'pointer'}}>ดูผลของฉันก่อน</button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="screen" style={{background:'#0C0B0A',opacity: popup ? .35 : 1,transition:'opacity .2s'}}>
        {/* Header KV */}
        <div style={{height:118,flexShrink:0,position:'relative',background:'#100E0C',overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,background:'repeating-linear-gradient(46deg,rgba(237,231,223,.07) 0 1px,transparent 1px 7px)'}} />
          <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% -10%,rgba(217,95,43,.3),transparent 60%)'}} />
          <div style={{position:'absolute',left:16,top:14,font:"500 9px 'IBM Plex Mono',monospace",letterSpacing:'.12em',color:'rgba(237,231,223,.3)',border:'1px dashed rgba(237,231,223,.2)',padding:'4px 7px'}}>KV_06_SUMMARY · bunker notice board</div>
          <div style={{position:'absolute',left:0,right:0,bottom:0,height:70,background:'linear-gradient(to top,#0C0B0A,transparent)'}} />
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          <div style={{padding:'0 22px 34px',marginTop:-38,position:'relative'}}>
            {/* Survivor ID card */}
            <div style={{background:'linear-gradient(160deg,#1A1512,#100E0C)',border:'1px solid rgba(217,95,43,.42)',padding:20,boxShadow:'0 20px 50px rgba(0,0,0,.65)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{font:"500 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.16em',color:'rgba(237,231,223,.4)'}}>SURVIVOR ID</div>
                <div style={{font:"500 9.5px 'IBM Plex Mono',monospace",color:primary}}>VALID · 1 NIGHT</div>
              </div>
              <div style={{display:'flex',gap:16,marginTop:16,alignItems:'center'}}>
                <div style={{width:78,height:96,flexShrink:0,background:'#0C0B0A',border:'1px dashed rgba(237,231,223,.22)',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',font:"400 8px/1.5 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.3)'}}>PORTRAIT<br/>INK</div>
                <div style={{minWidth:0}}>
                  <div style={{font:"400 9.5px 'IBM Plex Mono',monospace",letterSpacing:'.14em',color:'rgba(237,231,223,.38)'}}>{myArchetypeOrder ? `ARCHETYPE ${myArchetypeOrder} / 05` : 'ARCHETYPE'}</div>
                  {myArchetypeEn && <div style={{font:"500 10px 'IBM Plex Mono',monospace",letterSpacing:'.12em',color:'rgba(237,231,223,.5)',marginTop:2}}>{myArchetypeEn}</div>}
                  <div style={{font:"700 27px/1.2 'IBM Plex Sans Thai',sans-serif",color:primary,marginTop:5}}>{myArchetypeLabel}</div>
                  {myArchetypeShort && <div style={{font:"400 10px 'IBM Plex Mono',monospace",letterSpacing:'.12em',color:'rgba(237,231,223,.45)',marginTop:4}}>{myArchetypeShort}</div>}
                  {myArchetypeBody && <div style={{font:"300 12px/1.65 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.55)',marginTop:8}}>{myArchetypeBody}</div>}
                </div>
              </div>
              {archStats && (
                <div style={{display:'flex',flexDirection:'column',gap:9,marginTop:16,borderTop:'1px dashed rgba(237,231,223,.14)',paddingTop:14}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:10}}>
                    <div style={{font:"400 10px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.4)',flex:'none',width:112}}>คู่ที่รอดนานที่สุด</div>
                    <div style={{font:"600 13px 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF'}}>{archStats.bestPartnerLabel} · {archStats.bestSurvival}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:10}}>
                    <div style={{font:"400 10px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.4)',flex:'none',width:112}}>คู่ที่ไม่ควรเจอกัน</div>
                    <div style={{font:"600 13px 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF'}}>{archStats.worstPartnerLabel} · {archStats.worstSurvival}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Pair log */}
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'28px 0 12px'}}>
              <div style={{fontFamily:'Anton,sans-serif',fontSize:16,letterSpacing:'.16em',color:'#EDE7DF'}}>PAIR LOG</div>
              <div style={{font:"400 10px 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.38)'}}>{pairs.length} PAIRS</div>
            </div>

            {pairs.length === 0 ? (
              <div style={{border:'1px dashed rgba(237,231,223,.14)',padding:'26px 22px',textAlign:'center'}}>
                <div style={{font:"500 14px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.5)'}}>ยังไม่มีคู่หู</div>
                <div style={{font:"300 12px/1.6 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.35)',marginTop:8}}>ส่งลิงก์ให้เพื่อนตอบ แล้วผลคู่จะขึ้นในตารางนี้</div>
              </div>
            ) : (
              <div style={{border:'1px solid rgba(237,231,223,.12)'}}>
                {pairs.map((pair, i) => {
                  const isCompleted = pair.status === 'completed';
                  const isLastRow = i === pairs.length - 1;
                  const subtitle = isCompleted
                    ? (pair.partnerAxisLabel
                        ? `${pair.partnerAxisLabel} × ${myArchetypeLabel}`
                        : pair.resultTitle || 'ดูผล')
                    : pair.status === 'waiting' ? 'รอสัญญาณ...' : 'สัญญาณหมดอายุ';
                  return (
                    <button key={pair.pairId} onClick={isCompleted ? () => onViewPair(pair.pairId, pair.partnerName) : undefined}
                      style={{display:'flex',alignItems:'center',gap:11,padding:'13px 14px',borderBottom: isLastRow ? 'none' : '1px solid rgba(237,231,223,.1)',width:'100%',background:'transparent',border:'none',cursor: isCompleted ? 'pointer' : 'default'}}>
                      <span style={{width:34,height:34,flexShrink:0,borderRadius:'50%',background:'#1C1713',border:'1px solid rgba(237,231,223,.18)',display:'flex',alignItems:'center',justifyContent:'center',font:"600 13px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.75)'}}>{pair.partnerName[0]}</span>
                      <span style={{minWidth:0,textAlign:'left',flex:1}}>
                        <span style={{display:'block',font:"500 13.5px 'IBM Plex Sans Thai',sans-serif",color:'#EDE7DF'}}>{pair.partnerName}</span>
                        <span style={{display:'block',font:"400 10px 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.4)',marginTop:3}}>
                          {subtitle}
                        </span>
                      </span>
                      <span style={{marginLeft:'auto',flexShrink:0}}>
                        {isCompleted ? (
                          <span style={{font:"700 13px 'IBM Plex Sans Thai',sans-serif",color:primary,padding:'6px 12px',border:'1px solid rgba(217,95,43,.5)',borderRadius:2}}>
                            {pair.resultTitle || 'ดูผล'}
                          </span>
                        ) : (
                          <span style={{font:"400 9px 'IBM Plex Mono',monospace",color:'rgba(237,231,223,.3)',letterSpacing:'.08em'}}>{pair.status === 'waiting' ? 'WAIT' : 'EXP'}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {pairs.length > 0 && (
              <div style={{padding:'14px',textAlign:'center',font:"400 11.5px 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.32)',borderTop:'1px dashed rgba(237,231,223,.12)'}}>ยังชวนได้ไม่จำกัด — ครบ 3 คู่ลุ้นคูปอง</div>
            )}

            <button className="btn-primary" style={{width:'100%',marginTop:18}} onClick={onShare}>ชวนคนต่อไป</button>
            {config.group?.enabled && onCreateGroup && (
              <button onClick={onCreateGroup} style={{width:'100%',marginTop:10,background:'none',border:`1px solid ${primary}44`,color:primary,borderRadius:2,padding:13,font:"500 13px 'IBM Plex Sans Thai',sans-serif",cursor:'pointer'}}>
                {config.copy?.group_cta || 'ดูผลกลุ่ม 👥'}
              </button>
            )}
            {onGoRewards && (
              <button onClick={onGoRewards} style={{width:'100%',marginTop:10,background:'none',border:'1px solid rgba(237,231,223,.14)',color:'rgba(237,231,223,.5)',borderRadius:2,padding:13,font:"400 12.5px 'IBM Plex Sans Thai',sans-serif",cursor:'pointer'}}>
                ดูสิทธิ์ / แต้มสะสม · {(pairsDone || 0) * 50} pt
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
