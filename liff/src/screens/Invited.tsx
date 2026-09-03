import { useState } from 'react';
import { getAxisCard, findAxisId } from '../data';
import AddFriendNudge, { nudgeSeen } from './AddFriendNudge';
import { getScreenBlocks, resolveSrcText, resolveSrcImage, floatStyle, scaleFont } from '../screenConfig';

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
    axes?: Array<{ id: string; label?: string; label_en?: string; image_url?: string }>;
    appearance?: { oa_id?: string; images?: Record<string, string>; screen_config?: Record<string, { blocks: any[] }>; font_scale?: number };
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
  isFriend?: boolean;
  onViewGroup?: () => void;
  kvImageUrl?: string;
  onStart: () => void;
}

const DEFAULT_ORDER = ['invitedHero', 'inviterCard', 'cta', 'note'];
// Original hand-authored vertical rhythm between flow blocks (16/20/28-style spacer
// divs in the pre-conversion JSX) — keyed by "the block that comes before this gap".
const GAP_AFTER: Record<string, number> = { invitedHero: 0, inviterCard: 24, cta: 10 };

export default function Invited({ config, inviterName, inviterPic, inviterArchLabel, inviterArchEn, mode = 'duo', teamInfo, alreadyAnswered, introUrl, isFull, isFriend, onViewGroup, kvImageUrl, onStart }: Props) {
  const copy = config.copy || {};
  const appearance = config.appearance || {};
  const [showNudge, setShowNudge] = useState(false);
  // ── Typography (03) font scale — every literal px font-size below is run through this ──
  const fs = (px: number) => scaleFont(px, appearance.font_scale);

  const handleStartClick = () => {
    if (!isFriend && !nudgeSeen()) { setShowNudge(true); return; }
    onStart();
  };
  const handleNudgeDismiss = () => { setShowNudge(false); onStart(); };
  const isTeam = mode === 'team';

  const inviterAxisId = inviterArchLabel ? findAxisId(inviterArchLabel, config.axes) : inviterArchEn ? findAxisId(inviterArchEn, config.axes) : undefined;
  const inviterCard = getAxisCard(inviterAxisId || config.axes?.[0]?.id || '', config.axes);
  const inviterThLabel = inviterArchLabel || (inviterAxisId ? config.axes?.find(a => a.id === inviterAxisId)?.label : undefined) || '';

  const maxMembers = teamInfo?.maxMembers ?? 5;
  const memberCount = teamInfo?.memberCount ?? 0;
  const progressPct = Math.min(100, (memberCount / maxMembers) * 100);

  const ctaText = isTeam
    ? (alreadyAnswered ? (copy.team_join_cta || 'เข้าร่วมทีมเลย') : (copy.team_answer_first_cta || 'ตอบก่อนเข้าทีม'))
    : (copy.invite_cta || (inviterName ? `ตอบให้${inviterName}` : 'ตอบเลย!'));

  // ── screen_config wiring: order / show / geo / float position / data source ──
  const { blockOrder, blockVisible, geo, pos, src } = getScreenBlocks(appearance, 'Invited', DEFAULT_ORDER);

  // Hero: team mode uses KV image (if provided) — that override always wins. Otherwise it
  // can be bound to a real axis card image before falling back to the fixed hero upload.
  const heroImgSrc = resolveSrcImage(src('invitedHero', 'image'), { axes: config.axes });
  const heroSrc = isTeam && kvImageUrl
    ? kvImageUrl
    : (heroImgSrc || appearance.images?.invited_hero || 'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/invited-hero.png');
  const heroH = Number(geo('invitedHero').h) || 360;
  const heroFit = (geo('invitedHero').fit as string) || 'cover';

  // inviterCard's primary text (the duo-invite badge) can likewise be bound to a real axis.
  const badgeSrc = resolveSrcText(src('inviterCard', 'text'), { axes: config.axes }, copy);
  const cardPad = Number(geo('inviterCard').pad) || 16;
  const cardOverlap = Number(geo('inviterCard').overlap) || 48;
  const badgeHidden = geo('inviterCard').badge === 'hide';

  const ctaGeo = geo('cta');
  const ctaBg = ctaGeo.color === 'primary' ? 'var(--ac)' : 'var(--hl)';
  const ctaFg = ctaGeo.color === 'primary' ? 'var(--on-ac)' : 'var(--ink)';
  const ctaSticky = ctaGeo.sticky === 'on';

  // ── Block renderers ────────────────────────────────────────────────────────

  const renderInvitedHero = () => {
    if (!blockVisible('invitedHero')) return null;
    return (
      <div key="invitedHero" style={{ height:heroH, flexShrink:0, position:'relative', overflow:'hidden', background:'linear-gradient(180deg,#C8D8DC 0%,#FCEFE0 60%,#F7F1E3 100%)' }}>
        <img
          src={heroSrc}
          alt=""
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:heroFit as React.CSSProperties['objectFit'], objectPosition:'center bottom', mixBlendMode:'multiply' }}
        />
      </div>
    );
  };

  const renderInviterCard = () => {
    if (!blockVisible('inviterCard')) return null;
    return (
      <div key="inviterCard" style={{ marginTop:-cardOverlap, background:'var(--card)', border:'var(--border)', borderRadius:'var(--card-radius)', padding:cardPad, boxShadow:'var(--shadow)', position:'relative', transform:'rotate(calc(var(--tilt-deg) * -1deg))' }}>
        {!badgeHidden && (
          <div style={{ position:'absolute', top:-13, left:16, background:'var(--hl)', border:'2px solid var(--ink)', padding:'2px 9px', fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(14), letterSpacing:'.06em', transform:'rotate(-2deg)' }}>
            {isTeam && isFull ? (copy.invited_team_full_badge || 'ทีมเต็มแล้ว!') : isTeam ? (copy.invited_team_badge || 'เชิญเข้าทีม!') : (copy.invited_duo_badge || badgeSrc || 'คำเชิญ!')}
          </div>
        )}

        {isTeam && isFull ? (
          /* ── Full team ── */
          <>
            <div style={{ marginTop:4, font:`700 ${fs(17)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif` }}>{copy.invited_team_full_title ? copy.invited_team_full_title.replace('{n}', String(maxMembers)) : `ทีมนี้ครบ ${maxMembers} คนแล้ว`}</div>
            <div style={{ font:`500 ${fs(13)}px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:10 }}>
              {copy.invited_team_full_body ? copy.invited_team_full_body.replace('{name}', teamInfo?.creatorName || copy.invited_fallback_name || 'เพื่อน') : <>ทีมของ <b style={{ fontWeight:700 }}>{teamInfo?.creatorName || copy.invited_fallback_name || 'เพื่อน'}</b> ครบแล้ว สร้างทีมของคุณเองก็ได้นะ!</>}
            </div>
          </>
        ) : isTeam ? (
          /* ── Team invite (not full) ── */
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4 }}>
              {/* "?" badge */}
              <div style={{ width:52, height:52, borderRadius:8, background:'var(--ink)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(30), color:'var(--hl)', letterSpacing:'.02em' }}>
                ?
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ font:`700 ${fs(15)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif` }}>{copy.invited_team_pending_title || 'ผลทีมรอเผย'}</div>
                <div style={{ font:`500 ${fs(12)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:2 }}>{copy.invited_team_pending_sub ? copy.invited_team_pending_sub.replace('{n}', String(maxMembers)) : `ครบ ${maxMembers} คน ถึงจะรู้ผล`}</div>
              </div>
              <div style={{ flexShrink:0, background:'var(--ink)', color:'var(--hl)', padding:'4px 10px', font:`700 ${fs(12)}px var(--font-body,'Bai Jamjuree'),sans-serif`, borderRadius:4 }}>
                {memberCount}/{maxMembers}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ marginTop:12, height:6, background:'rgba(28,26,23,.1)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progressPct}%`, background:'var(--ac)', borderRadius:3, transition:'width .5s' }} />
            </div>
            {teamInfo?.body && (
              <div style={{ font:`500 ${fs(13)}px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:10 }}>{teamInfo.body}</div>
            )}
            <div style={{ font:`500 ${fs(14)}px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:12 }}>
              <b style={{ fontWeight:700 }}>{teamInfo?.creatorName || copy.invited_fallback_name || 'เพื่อน'}</b>
              {copy.team_invite_body || ' ชวนคุณมาเข้าทีม — ตอบแบบทดสอบแล้วมาดูผลทีมด้วยกัน'}
            </div>
          </>
        ) : (
          /* ── Duo invite ── */
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4 }}>
              {inviterPic ? (
                <img src={inviterPic} alt="" style={{ width:48, height:48, borderRadius:'50%', flexShrink:0, objectFit:'cover', border:'2px solid var(--ink)' }} />
              ) : (
                <img src={inviterCard} alt="" style={{ width:40, height:56, flexShrink:0, objectFit:'contain' }} />
              )}
              <div>
                <div style={{ font:`700 ${fs(16)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif` }}>{inviterName || copy.invited_fallback_name || 'เพื่อน'}</div>
                <div style={{ font:`700 ${fs(13)}px var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ac)', marginTop:2 }}>{inviterThLabel}</div>
              </div>
            </div>
            <div style={{ font:`500 ${fs(14)}px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:14 }}>
              {copy.invited_body
                ? copy.invited_body
                : <>ชวนคุณมาดูว่า<b style={{ fontWeight:700 }}>{copy.invited_body_bold || 'ถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน'}</b> — {copy.invited_sub || 'ตอบ 6 ข้อ ไม่ถึงนาที'}</>
              }
            </div>
          </>
        )}
      </div>
    );
  };

  const renderCta = () => {
    if (!blockVisible('cta')) return null;
    if (isTeam && isFull) {
      return (
        <div key="cta">
          {onViewGroup && (
            <button
              onClick={onViewGroup}
              style={{ width:'100%', padding:'15px 20px', background:'var(--ink)', color:'var(--hl)', border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(17)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'4px 5px 0 rgba(28,26,23,.4)' }}
            >{copy.team_full_view_cta || 'ดูผลลัพท์เต็ม'}</button>
          )}
          <div style={{ height:10 }} />
          <button
            onClick={handleStartClick}
            style={{ width:'100%', padding:'13px 16px', background:ctaBg, color:ctaFg, border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(15)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'3px 4px 0 var(--ink)' }}
          >{alreadyAnswered ? (copy.team_full_own_cta || 'ดูผลของฉัน') : (copy.team_full_answer_cta || 'ตอบแบบทดสอบ')}</button>
        </div>
      );
    }
    const btn = (
      <button
        onClick={handleStartClick}
        style={{ width:'100%', padding:'15px 20px', background:ctaBg, color:ctaFg, border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(17)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'var(--shadow)' }}
      >
        {ctaText}
      </button>
    );
    if (ctaSticky) {
      return (
        <div key="cta-sticky" style={{ position:'sticky', bottom:0, left:0, right:0, background:'var(--bg)', padding:'12px 0 0', zIndex:10 }}>
          {btn}
        </div>
      );
    }
    return <div key="cta">{btn}</div>;
  };

  const renderNote = () => {
    if (!blockVisible('note')) return null;
    return (
      <button
        key="note"
        onClick={() => {
          if (introUrl) {
            try { (liff as any).openWindow({ url: introUrl, external: false }); } catch { window.location.href = introUrl; }
          } else {
            try { liff.closeWindow(); } catch { window.close(); }
          }
        }}
        style={{ width:'100%', padding:'13px 16px', background:'var(--card)', color:'var(--ink)', border:'2px solid var(--ink)', borderRadius:'var(--radius)', font:`600 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer' }}
      >
        {copy.view_campaign_cta || 'ดูแคมเปญก่อน'}
      </button>
    );
  };

  const RENDERERS: Record<string, () => React.ReactNode> = {
    invitedHero: renderInvitedHero,
    inviterCard: renderInviterCard,
    cta:         renderCta,
    note:        renderNote,
  };

  // ── Build output ──────────────────────────────────────────────────────────

  const visible = blockOrder.filter(blockVisible);
  const flowIds  = visible.filter(id => !pos(id));
  const floatIds = visible.filter(id => pos(id));

  // Among flow blocks: invitedHero is always outside the padding wrapper; others go inside
  const topBlocks  = flowIds.filter(id => id === 'invitedHero');
  const bodyBlocks = flowIds.filter(id => id !== 'invitedHero');

  return (
    <div className="screen fade-enter" style={{ background:'var(--bg)', backgroundImage:'var(--texture-bg)', overflowY:'auto', flex:'none', minHeight:'100%', position: floatIds.length ? 'relative' : undefined }}>
      {showNudge && <AddFriendNudge oaId={appearance.oa_id} onDismiss={handleNudgeDismiss} dismissLabel={config.copy?.nudge_skip_accept || 'ข้ามไป รับคำเชิญเลย'} copy={config.copy} />}
      {topBlocks.map(id => RENDERERS[id]?.())}
      <div style={{ padding:'0 20px 28px' }}>
        {bodyBlocks.map((id, i) => (
          <div key={id} style={{ marginTop: i === 0 ? 0 : (GAP_AFTER[bodyBlocks[i - 1]] ?? 16) }}>
            {RENDERERS[id]?.()}
          </div>
        ))}
      </div>
      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
    </div>
  );
}
