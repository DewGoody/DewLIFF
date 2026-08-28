import { getAxisCard, ARCH, findAxisId } from '../data';

interface TeamInfo {
  archTitle?: string;
  memberCount?: number;
  maxMembers?: number;
  body?: string;
  primaryText?: string;
  creatorName?: string;
}

interface Props {
  config: {
    copy?: Record<string, string>;
    axes?: Array<{ id: string; image_url?: string }>;
  };
  inviterName?: string;
  inviterPic?: string;
  inviterArchLabel?: string;
  inviterArchEn?: string;
  mode?: 'duo' | 'team';
  teamInfo?: TeamInfo;
  alreadyAnswered?: boolean;
  introUrl?: string;
  isFull?: boolean;
  onViewGroup?: () => void;
  kvImageUrl?: string;
  onStart: () => void;
}

export default function Invited({ config, inviterName, inviterPic, inviterArchLabel, inviterArchEn, mode = 'duo', teamInfo, alreadyAnswered, introUrl, isFull, onViewGroup, kvImageUrl, onStart }: Props) {
  const copy = config.copy || {};
  const isTeam = mode === 'team';

  const inviterAxisId = inviterArchLabel ? findAxisId(inviterArchLabel) : inviterArchEn ? findAxisId(inviterArchEn) : undefined;
  const inviterCard = getAxisCard(inviterAxisId || 'prep', config.axes);
  const inviterThLabel = inviterArchLabel || (inviterAxisId ? ARCH[inviterAxisId]?.th : undefined) || 'สายเตรียมพร้อม';

  const maxMembers = teamInfo?.maxMembers ?? 5;
  const memberCount = teamInfo?.memberCount ?? 0;
  const progressPct = Math.min(100, (memberCount / maxMembers) * 100);

  const ctaText = isTeam
    ? (alreadyAnswered ? (copy.team_join_cta || 'เข้าร่วมทีมเลย') : (copy.team_answer_first_cta || 'ตอบก่อนเข้าทีม'))
    : (copy.invite_cta || (inviterName ? `ตอบให้${inviterName}` : 'ตอบเลย!'));

  // Hero: team mode uses KV image (if provided), else dog image
  const heroSrc = isTeam && kvImageUrl
    ? kvImageUrl
    : 'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/invited-hero.png';

  return (
    <div className="screen fade-enter" style={{ background:'#F7F1E3', overflowY:'auto', flex:'none', minHeight:'100%' }}>
      {/* Hero — 360px tall, cover-crop */}
      <div style={{ height:360, flexShrink:0, position:'relative', overflow:'hidden', background:'linear-gradient(180deg,#C8D8DC 0%,#FCEFE0 60%,#F7F1E3 100%)' }}>
        <img
          src={heroSrc}
          alt=""
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center bottom', mixBlendMode:'multiply' }}
        />
      </div>

      {/* Content */}
      <div style={{ padding:'0 20px 28px' }}>
        {/* Card — overlaps hero */}
        <div style={{ marginTop:-48, background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'4px 5px 0 #1C1A17', position:'relative' }}>
          <div style={{ position:'absolute', top:-13, left:16, background:'#F5E14B', border:'2px solid #1C1A17', padding:'2px 9px', fontFamily:'Bangers,cursive', fontSize:14, letterSpacing:'.06em', transform:'rotate(-2deg)' }}>
            {isTeam && isFull ? 'ทีมเต็มแล้ว!' : isTeam ? 'เชิญเข้าทีม!' : 'คำเชิญ!'}
          </div>

          {isTeam && isFull ? (
            /* ── Full team ── */
            <>
              <div style={{ marginTop:4, font:"700 17px/1.4 'Bai Jamjuree',sans-serif" }}>ทีมนี้ครบ {maxMembers} คนแล้ว</div>
              <div style={{ font:"500 13px/1.7 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.65)', marginTop:10 }}>
                ทีมของ <b style={{ fontWeight:700 }}>{teamInfo?.creatorName || 'เพื่อน'}</b> ครบแล้ว สร้างทีมของคุณเองก็ได้นะ!
              </div>
            </>
          ) : isTeam ? (
            /* ── Team invite (not full) ── */
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4 }}>
                {/* "?" badge */}
                <div style={{ width:52, height:52, borderRadius:8, background:'#1C1A17', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:30, color:'#F5E14B', letterSpacing:'.02em' }}>
                  ?
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ font:"700 15px/1.4 'Bai Jamjuree',sans-serif" }}>ผลทีมรอเผย</div>
                  <div style={{ font:"500 12px/1.4 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.5)', marginTop:2 }}>ครบ {maxMembers} คน ถึงจะรู้ผล</div>
                </div>
                <div style={{ flexShrink:0, background:'#1C1A17', color:'#F5E14B', padding:'4px 10px', font:"700 12px 'Bai Jamjuree',sans-serif", borderRadius:4 }}>
                  {memberCount}/{maxMembers}
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop:12, height:6, background:'rgba(28,26,23,.1)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${progressPct}%`, background:'#E8354F', borderRadius:3, transition:'width .5s' }} />
              </div>
              {teamInfo?.body && (
                <div style={{ font:"500 13px/1.7 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.65)', marginTop:10 }}>{teamInfo.body}</div>
              )}
              <div style={{ font:"500 14px/1.7 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.72)', marginTop:12 }}>
                <b style={{ fontWeight:700 }}>{teamInfo?.creatorName || 'เพื่อน'}</b>
                {copy.team_invite_body || ' ชวนคุณมาเข้าทีม — ตอบแบบทดสอบแล้วมาดูผลทีมด้วยกัน'}
              </div>
            </>
          ) : (
            /* ── Duo invite ── */
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4 }}>
                {inviterPic ? (
                  <img src={inviterPic} alt="" style={{ width:48, height:48, borderRadius:'50%', flexShrink:0, objectFit:'cover', border:'2px solid #1C1A17' }} />
                ) : (
                  <img src={inviterCard} alt="" style={{ width:40, height:56, flexShrink:0, objectFit:'contain' }} />
                )}
                <div>
                  <div style={{ font:"700 16px/1.4 'Bai Jamjuree',sans-serif" }}>{inviterName || 'เพื่อน'}</div>
                  <div style={{ font:"700 13px 'Bai Jamjuree',sans-serif", color:'#E8354F', marginTop:2 }}>{inviterThLabel}</div>
                </div>
              </div>
              <div style={{ font:"500 14px/1.7 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.72)', marginTop:14 }}>
                {copy.invited_body
                  ? copy.invited_body
                  : <>ชวนคุณมาดูว่า<b style={{ fontWeight:700 }}>{copy.invited_body_bold || 'ถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน'}</b> — {copy.invited_sub || 'ตอบ 6 ข้อ ไม่ถึงนาที'}</>
                }
              </div>
            </>
          )}
        </div>

        <div style={{ height:24 }} />

        {/* CTAs */}
        {isTeam && isFull ? (
          <>
            {onViewGroup && (
              <button
                onClick={onViewGroup}
                style={{ width:'100%', padding:'15px 20px', background:'#1C1A17', color:'#F5E14B', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 17px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 5px 0 rgba(28,26,23,.4)' }}
              >{copy.team_full_view_cta || 'ดูผลลัพท์เต็ม'}</button>
            )}
            <div style={{ height:10 }} />
            <button
              onClick={onStart}
              style={{ width:'100%', padding:'13px 16px', background:'#F5E14B', color:'#1C1A17', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 15px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'3px 4px 0 #1C1A17' }}
            >{alreadyAnswered ? (copy.team_full_own_cta || 'ดูผลของฉัน') : (copy.team_full_answer_cta || 'ตอบแบบทดสอบ')}</button>
          </>
        ) : (
          <button
            onClick={onStart}
            style={{ width:'100%', padding:'15px 20px', background:'#F5E14B', color:'#1C1A17', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 17px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 5px 0 #1C1A17' }}
          >
            {ctaText}
          </button>
        )}
        <div style={{ height:10 }} />
        <button
          onClick={() => {
            if (introUrl) {
              try { (liff as any).openWindow({ url: introUrl, external: false }); } catch { window.location.href = introUrl; }
            } else {
              try { liff.closeWindow(); } catch { window.close(); }
            }
          }}
          style={{ width:'100%', padding:'13px 16px', background:'#FFFDF6', color:'#1C1A17', border:'2px solid #1C1A17', borderRadius:13, font:"600 14px/1 'Bai Jamjuree',sans-serif", cursor:'pointer' }}
        >
          {copy.view_campaign_cta || 'ดูแคมเปญก่อน'}
        </button>
      </div>
    </div>
  );
}
