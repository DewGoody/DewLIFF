import { useState, useEffect } from 'react';
import { api } from '../api';
import { getAxisCard, findAxisId } from '../data';
import AddFriendNudge, { nudgeSeen } from './AddFriendNudge';
import { shareOrCopy } from '../shareUtils';
import { getScreenBlocks, resolveSrcText, floatStyle, scaleFont, getPatternDefaults, renderExtraBlock, type SrcTextContext, type ArtStyleAppearance } from '../screenConfig';

interface PairEntry {
  pairId: string; role: 'inviter'|'invitee'; partnerName: string;
  status: 'waiting'|'completed'|'expired'; resultTitle?: string;
  partnerAxisLabel?: string; completedAt?: string; completedAtIso?: string;
}

interface MyGroup {
  groupId: string;
  memberCount: number;
  maxMembers: number;
  isFull: boolean;
  archTitle: string | null;
  primaryText: string | null;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}
export interface PairPopup {
  pairId?: string; title: string; body: string; eyebrow?: string;
  axisMe?: string; axisBuddy?: string; partnerName?: string; imageUrl?: string;
}
interface Props {
  config: {
    brand?: { primary?: string; kv_image_url?: string };
    copy?: Record<string, string>;
    appearance?: ArtStyleAppearance & {
      images?: Record<string, string>; oa_id?: string; screen_config?: Record<string, { blocks: any[] }>;
      font_scale?: number; card_radius?: number; badge_radius?: number; shadow?: string; tilt?: string;
    };
    group?: { enabled?: boolean };
    axes?: Array<{ id: string; label?: string; label_en?: string; body?: string; image_url?: string }>;
    mode?: string;
  };
  campaignId: string;
  liffId: string;
  myArchetypeLabel: string; myArchetypeBody?: string;
  myArchetypeEn?: string; myArchetypeOrder?: string; myArchetypeShort?: string;
  myArchetype?: string;
  myArchetypeImage?: string;
  pairsDone?: number;
  shareUrl: string; pairs: PairEntry[];
  initialPopup?: PairPopup | null;
  onViewPair: (pairId: string, partnerName: string) => void;
  onCreateGroup?: () => void;
  onGoGroup?: (groupId: string) => void;
  onSoloShare?: () => void;
  onRetake?: () => void;
  onPopupDismissed?: () => void;
  onGoSymbols?: () => void;
  onGoRewards?: () => void;
  isFriend?: boolean;
  teamsVersion?: number;
}

const DEFAULT_ORDER = ['survivorCard', 'retake', 'actionRow', 'teamSection', 'symbolsRow', 'pairLog'];

export default function Summary({
  config, campaignId, liffId,
  myArchetypeLabel, myArchetypeBody, myArchetypeEn, myArchetypeOrder, myArchetype, myArchetypeImage,
  pairsDone, pairs, initialPopup, onViewPair, onCreateGroup, onGoGroup, onSoloShare, onRetake, onPopupDismissed, onGoSymbols, onGoRewards, isFriend, teamsVersion,
}: Props) {
  const isSoloMode = config.mode === 'solo' || config.mode === 'mbti';
  const isMbti = config.mode === 'mbti';
  const [popup, setPopup] = useState<PairPopup | null>(initialPopup ?? null);
  const [soloShareStatus, setSoloShareStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [duoInviteStatus, setDuoInviteStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [copyLinkStatus, setCopyLinkStatus] = useState<'idle'|'copied'>('idle');
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [nudgePending, setNudgePending] = useState<null | 'share' | 'addFriend'>(null);
  const [teams, setTeams] = useState<MyGroup[] | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [leaveConfirmGroupId, setLeaveConfirmGroupId] = useState<string | null>(null);
  const done = pairsDone ?? 0;

  const axisId = myArchetype || findAxisId(myArchetypeLabel, config.axes) || findAxisId(myArchetypeEn || '', config.axes) || config.axes?.[0]?.id || '';
  const axisFromConfig = config.axes?.find(a => a.id === axisId);
  // Solo mode: use result image_url; pair mode: use axis card
  const card = myArchetypeImage || getAxisCard(axisId, config.axes);
  // Solo mode: show typeCode in Bangers (e.g. "INTJ"); pair mode: show axis english name
  // MBTI: show typeCode in Bangers (e.g. "INTJ"); pair/solo axis: show axis english name
  const enName = isMbti ? (myArchetype || '') : (myArchetypeEn || axisFromConfig?.label_en || '');
  const thName = myArchetypeLabel || axisFromConfig?.label || '';
  const desc = myArchetypeBody || axisFromConfig?.body || '';


  const myArchLabel = thName;
  const statusColor = (s: string) => s === 'completed' ? 'var(--ink)' : s === 'expired' ? 'var(--ink3)' : 'var(--ac)';

  // Use web origin when not in LINE so dev invite links stay on dev, prod on prod.
  // Flex cards are only sent when isInClient()=true, at which point liffBase = LINE URL.
  const lineBase = `https://liff.line.me/${liffId}`;
  const webBase = window.location.origin + window.location.pathname;
  const liffBase = liff.isInClient() ? lineBase : webBase;
  const copy = config.copy || {};
  const primary = config.brand?.primary || '#E8354F';

  // Fetch teams if group feature is enabled
  useEffect(() => {
    if (!config.group?.enabled) return;
    setTeamsLoading(true);
    api<{ groups: MyGroup[] }>('GET', `/api/group/my-groups?campaignId=${campaignId}`)
      .then(res => setTeams(res.groups))
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, teamsVersion]);

  // F-02 — solo share (axis card)
  const handleShareSolo = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    setSoloShareStatus('sending');
    let myUserId = '';
    try { const p = await liff.getProfile(); myUserId = p.userId; } catch {}
    const inviteUrl = myUserId
      ? `${liffBase}?campaignId=${campaignId}&inviterId=${myUserId}`
      : `${liffBase}?campaignId=${campaignId}`;

    if (!liff.isInClient() || !liffAny.isApiAvailable?.('shareTargetPicker')) {
      const result = await shareOrCopy(inviteUrl, thName);
      setSoloShareStatus(result === 'failed' ? 'error' : 'sent');
      setTimeout(() => setSoloShareStatus('idle'), 3000);
      return;
    }
    try {
      const axisCardUrl = card;
      const campaignUrl = `${liffBase}?campaignId=${campaignId}`;
      await liffAny.shareTargetPicker([{
        type: 'flex',
        altText: `ผลของฉัน: ${thName} — มาดูว่าคุณสายไหน`.slice(0, 400),
        contents: {
          type: 'bubble', size: 'mega',
          hero: axisCardUrl ? { type: 'image', url: axisCardUrl, size: 'full', aspectRatio: '20:21', aspectMode: 'fit', backgroundColor: '#F5E14B' } : undefined,
          body: {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', paddingAll: '4px', backgroundColor: '#F5E14B', cornerRadius: '4px', width: '96px', contents: [{ type: 'text', text: copy.F02_eyebrow || 'สายของฉันคือ', size: 'xs', weight: 'bold', color: '#1C1A17', align: 'center' }] },
              { type: 'text', text: thName, weight: 'bold', size: 'xxl', color: '#1C1A17', wrap: true, margin: 'sm' },
              { type: 'text', text: desc, size: 'sm', color: '#555555', wrap: true, margin: 'sm' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              { type: 'button', action: { type: 'uri', label: copy.F02_cta1 || 'เล่นดูว่าคุณสายไหน', uri: campaignUrl }, style: 'primary', color: primary },
              ...(!isSoloMode ? [{ type: 'button', action: { type: 'uri', label: copy.F02_cta2 || 'ดูผลคู่กับฉัน', uri: inviteUrl }, style: 'secondary' }] : []),
            ],
          },
        },
      }]);
      setSoloShareStatus('sent');
      setTimeout(() => setSoloShareStatus('idle'), 3000);
    } catch {
      setSoloShareStatus('error');
      setTimeout(() => setSoloShareStatus('idle'), 3000);
    }
  };

  const handleCopyInviteLink = async () => {
    let myUserId = '';
    try { const p = await liff.getProfile(); myUserId = p.userId; } catch {}
    const inviteUrl = myUserId
      ? `${liffBase}?campaignId=${campaignId}&inviterId=${myUserId}`
      : `${liffBase}?campaignId=${campaignId}`;
    try { await navigator.clipboard.writeText(inviteUrl); } catch {}
    setCopyLinkStatus('copied');
    setTimeout(() => setCopyLinkStatus('idle'), 2000);
  };

  // F-01 — duo invite (3-card hero, inviter link)
  const handleDuoInvite = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    setDuoInviteStatus('sending');
    let myUserId = '';
    let myDisplayName = '';
    try { const p = await liff.getProfile(); myUserId = p.userId; myDisplayName = p.displayName; } catch {}
    const inviteUrl = myUserId
      ? `${liffBase}?campaignId=${campaignId}&inviterId=${myUserId}`
      : `${liffBase}?campaignId=${campaignId}`;

    if (!liff.isInClient() || !liffAny.isApiAvailable?.('shareTargetPicker')) {
      const result = await shareOrCopy(inviteUrl, copy.F01_title || 'ชวนเพื่อนมาเล่นด้วยกัน');
      setDuoInviteStatus(result === 'failed' ? 'error' : 'sent');
      setTimeout(() => { setDuoInviteStatus('idle'); setInviteSheetOpen(false); }, 3000);
      return;
    }
    try {
      const campaignUrl = copy.F01_campaign_url || `${liffBase}?campaignId=${campaignId}`;
      const kvUrl = config.brand?.kv_image_url;
      const altName = myDisplayName || thName;

      await liffAny.shareTargetPicker([{
        type: 'flex',
        altText: (copy.F01_alt ? copy.F01_alt.replace('{name}', altName) : `${altName}ชวนคุณเล่น Duo Quiz — มาดูว่าเราสองคนจะรอดกี่วัน`).slice(0, 400),
        contents: {
          type: 'bubble', size: 'mega',
          hero: kvUrl
            ? { type: 'image', url: kvUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
            : undefined,
          body: {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'text', text: copy.F01_eyebrow || 'DUO QUIZ · 6 ข้อ', size: 'xs', color: primary, weight: 'bold' },
              { type: 'text', text: copy.F01_title || 'มาดูว่าถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน!', weight: 'bold', size: 'xl', color: '#1C1A17', wrap: true, margin: 'sm' },
              { type: 'text', text: copy.F01_body ? copy.F01_body.replace('{name}', thName) : `${thName} ชวนคุณมาตอบ 6 ข้อ ไม่ถึงนาที`, size: 'sm', color: '#555555', wrap: true, margin: 'sm' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
            contents: [
              { type: 'button', action: { type: 'uri', label: copy.F01_cta1 || 'เริ่มตอบ · 1 นาที', uri: inviteUrl }, style: 'primary', color: primary },
              { type: 'button', action: { type: 'uri', label: copy.F01_cta2 || 'ดูผลคู่กับฉัน', uri: campaignUrl }, style: 'secondary' },
            ],
          },
        },
      }]);
      setDuoInviteStatus('sent');
      setTimeout(() => { setDuoInviteStatus('idle'); setInviteSheetOpen(false); }, 2000);
    } catch {
      setDuoInviteStatus('error');
      setTimeout(() => setDuoInviteStatus('idle'), 2000);
    }
  };

  const handleNudgeDismiss = () => {
    const pending = nudgePending;
    setNudgePending(null);
    if (pending === 'share') {
      if (onSoloShare) onSoloShare(); else void handleShareSolo();
    } else if (pending === 'addFriend') {
      setInviteSheetOpen(true);
    }
  };

  // ── screen_config wiring: order / show / geo / float position / data source ──
  // Layered ON TOP of the business-logic gating above (isSoloMode / config.group?.enabled /
  // onGoSymbols / onGoRewards) — a block only ever appears where that logic already allows it.
  const appearance = config.appearance || {};
  const { blockOrder, blockVisible, geo: geoOf, pos, pat, src } = getScreenBlocks(appearance, 'Summary', DEFAULT_ORDER);
  const geo = (id: string) => geoOf(id);
  // ── Typography (03) font scale — every literal px font-size below is run through this ──
  const fs = (px: number) => scaleFont(px, appearance.font_scale);
  // 05 Art Style / 04 Shape & Feel global defaults, fed into pat() as the fallback
  // instead of a hardcoded literal (same idea as PairResult.tsx / Intro.tsx).
  const artDefaults = getPatternDefaults(appearance);

  // Text-source resolution context: axes[] is static campaign config (resolved by index);
  // "results"/"group" resolve against whatever THIS screen already computed for this user.
  const srcCtx: SrcTextContext = {
    axes: config.axes,
    results: { title: thName, body: desc },
    group: teams && teams[0] ? { title: teams[0].archTitle ?? undefined, primary_text: teams[0].primaryText ?? undefined } : undefined,
  };
  const eyebrowSrcVal = resolveSrcText(src('survivorCard', 'text'), srcCtx, copy);
  const retakeSrcVal = resolveSrcText(src('retake', 'text'), srcCtx, copy);
  const shareBtnSrcVal = resolveSrcText(src('actionRow', 'text'), srcCtx, copy);
  const teamsHeaderSrcVal = resolveSrcText(src('teamSection', 'text'), srcCtx, copy);
  const symbolsTitleSrcVal = resolveSrcText(src('symbolsRow', 'text'), srcCtx, copy);
  const pairLogLabelSrcVal = resolveSrcText(src('pairLog', 'text'), srcCtx, copy);
  // pairLog also has a 'list' channel (per admin's CH_OF), which would let the admin bind the
  // pair-log rows to a non-default data source. There's no safe mapping for that here: pairs[]
  // carries real functional data (pairId for onViewPair, live status) that a generic list source
  // (e.g. axes[]) can't reproduce without breaking behavior — so it's intentionally left
  // unresolved; the real `pairs` prop is always used, matching today's behavior exactly.

  // survivorCard art shape — mirrors LayoutEditor.tsx's ART_SHAPES switch (portrait/square/circle).
  // 'portrait' is this screen's existing default; its aspect (92×118) is preserved exactly so
  // unconfigured campaigns render pixel-identical to before — admin's abstract preview uses a
  // generic 4:3 card ratio, but the real screen already had its own concrete 92×118 art size.
  const survivorGeo = geo('survivorCard');
  const cardPad = Number(survivorGeo.pad) || 16;
  const cardDir = (survivorGeo.dir as string) || 'row';
  const artW = Number(survivorGeo.artW) || 92;
  const soloShape = pat('survivorCard', 'solo', artDefaults.solo);
  const PORTRAIT_R = 118 / 92;
  const artH = soloShape === 'portrait' ? Math.round(artW * PORTRAIT_R) : artW;
  const artRadius = soloShape === 'circle' ? artW : soloShape === 'square' ? Math.min(10, artW) : undefined;

  const actionRowDir = (geo('actionRow').dir as string) || 'row';
  const teamStyle = (geo('teamSection').style as string) || 'default';
  const pairLogStyle = (geo('pairLog').style as string) || 'default';

  // ── Block renderers ────────────────────────────────────────────────────────

  const renderSurvivorCard = () => {
    if (!blockVisible('survivorCard')) return null;
    return (
      <div key="survivorCard" style={{ background:'var(--card)', border:'var(--border)', borderRadius:'var(--card-radius)', padding:cardPad, boxShadow:'var(--shadow)', backgroundImage:'var(--texture-bg)', transform:'rotate(calc(var(--tilt-deg) * -1deg))' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ font:`700 ${fs(10)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, letterSpacing:'.12em', color:'var(--ink3)' }}>
            {isMbti ? (copy.summary_card_eyebrow_mbti || 'TYPE CARD') : `${copy.summary_card_eyebrow || eyebrowSrcVal || 'SURVIVOR CARD'}${myArchetypeOrder ? ` · NO.${myArchetypeOrder}` : ''}`}
          </span>
          <span style={{ background:'var(--hl)', border:'1.5px solid var(--ink)', padding:'1px 7px', borderRadius:'var(--badge-radius)', font:`700 ${fs(9.5)}px var(--font-body,'Bai Jamjuree'),sans-serif` }}>{copy.summary_card_valid || 'VALID'}</span>
        </div>
        <div style={{ display:'flex', flexDirection: cardDir === 'column' ? 'column' : 'row', gap:14, marginTop:12, alignItems: cardDir === 'column' ? 'flex-start' : 'center' }}>
          {card ? (
            <img src={card} alt="" style={{ width:artW, height:artH, flexShrink:0, objectFit:'contain', ...(artRadius !== undefined ? { borderRadius: artRadius } : {}) }} />
          ) : (
            /* Solo mode: no image — show typeCode as a big card placeholder */
            <div style={{ width:artW, height:artH, flexShrink:0, background:'var(--hl)', border:'2px solid var(--ink)', borderRadius: artRadius ?? 10, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(32), letterSpacing:'.06em', color:'var(--ink)' }}>{enName}</span>
            </div>
          )}
          <div style={{ minWidth:0 }}>
            {/* Solo: typeCode badge; Pair: en name */}
            {enName && (
              <div style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(22), letterSpacing:'.04em', color:'var(--ac)', lineHeight:1.05 }}>{enName}</div>
            )}
            <div style={{ font:`700 ${fs(18)}px/1.35 var(--font-body,'Bai Jamjuree'),sans-serif`, marginTop: enName ? 4 : 0 }}>{thName}</div>
            <div style={{ font:`400 ${fs(12)}px/1.6 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:6 }}>{desc}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderRetake = () => {
    if (!blockVisible('retake') || !onRetake) return null;
    return (
      <button
        key="retake"
        onClick={onRetake}
        style={{ background:'none', border:'none', font:`600 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink3)', cursor:'pointer', padding:'4px 0', marginTop:4 }}
      >{copy.summary_retake_btn || retakeSrcVal || '↺ ตอบแบบทดสอบใหม่'}</button>
    );
  };

  const renderActionRow = () => {
    if (!blockVisible('actionRow')) return null;
    return (
      <div key="actionRow" style={{ display:'flex', flexDirection: actionRowDir === 'column' ? 'column' : 'row', gap:8, marginTop:12 }}>
        <button
          onClick={() => {
            if (!isFriend && !nudgeSeen('share')) { setNudgePending('share'); return; }
            if (onSoloShare) onSoloShare(); else void handleShareSolo();
          }}
          disabled={soloShareStatus === 'sending'}
          style={{
            flex:1, padding:'13px 14px',
            background: soloShareStatus === 'sent' ? '#22c55e' : soloShareStatus === 'error' ? 'var(--ac)' : isSoloMode ? 'var(--ac)' : 'var(--card)',
            color: soloShareStatus === 'sent' || soloShareStatus === 'error' || isSoloMode ? 'var(--on-ac)' : 'var(--ink)',
            border:'2px solid var(--ink)', borderRadius:'var(--radius)',
            font:`${isSoloMode ? '700' : '600'} ${fs(13)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer',
            boxShadow: isSoloMode ? '3px 3px 0 var(--ink)' : undefined,
          }}
        >
          {soloShareStatus === 'sent' ? (copy.share_btn_sent || '✓ แชร์แล้ว!') : soloShareStatus === 'error' ? (copy.share_btn_error || 'เกิดข้อผิดพลาด') : soloShareStatus === 'sending' ? (copy.share_btn_sending || 'กำลังส่ง...') : (copy.share_btn || shareBtnSrcVal || '↗ แชร์ผล')}
        </button>
        {/* Invite button — pair mode only */}
        {!isSoloMode && (
          <button
            onClick={() => {
              if (!isFriend && !nudgeSeen('addFriend')) { setNudgePending('addFriend'); return; }
              setInviteSheetOpen(true);
            }}
            style={{ flex:1, padding:'13px 14px', background:'var(--ac)', color:'var(--on-ac)', border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(13)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'3px 3px 0 var(--ink)' }}
          >
            {copy.invite_btn || 'เชิญเพื่อน ▾'}
          </button>
        )}
      </div>
    );
  };

  const renderTeamSection = () => {
    if (!blockVisible('teamSection') || !config.group?.enabled) return null;
    return (
      <div key="teamSection" style={{ marginTop:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(22), letterSpacing:'.05em' }}>{copy.summary_teams_header || teamsHeaderSrcVal || 'ทีมของฉัน'}</span>
          {teams && teams.length > 0 && onCreateGroup && (
            <button
              onClick={() => onCreateGroup?.()}
              style={{ background:'none', border:'none', font:`700 ${fs(12)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ac)', cursor:'pointer', padding:'4px 0' }}
            >{copy.summary_new_team_btn || '+ สร้างทีมใหม่'}</button>
          )}
        </div>
        {teamsLoading ? (
          <div style={{ padding:'18px 0', textAlign:'center', color:'var(--ink3)', font:`500 ${fs(13)}px var(--font-body,'Bai Jamjuree'),sans-serif` }}>{copy.summary_teams_loading || 'กำลังโหลด...'}</div>
        ) : teams && teams.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {teams.map(t => (
              <div key={t.groupId} style={{ background:'var(--card)', border:'2px solid var(--ink)', borderRadius:'var(--card-radius)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'2px 3px 0 var(--ink)', transform:'rotate(calc(var(--tilt-deg) * -1deg))' }}>
                {teamStyle === 'bar' ? (
                  <div style={{ width:56, height:8, flexShrink:0, border:'1.5px solid var(--ink)', borderRadius:9, overflow:'hidden', background:'var(--bg)' }}>
                    <div style={{ height:'100%', width:`${Math.min(100, (t.memberCount / t.maxMembers) * 100)}%`, background:'var(--ac)' }} />
                  </div>
                ) : (
                  /* Progress dots — cap at 10 to avoid flooding layout */
                  <div style={{ display:'flex', gap:4, flexShrink:0, flexWrap:'wrap', maxWidth:60 }}>
                    {Array.from({ length: Math.min(t.maxMembers, 10) }).map((_, i) => (
                      <div key={i} style={{ width:8, height:8, borderRadius:'50%', background: i < t.memberCount ? 'var(--ac)' : 'var(--ink3)', border:'1.5px solid rgba(28,26,23,.2)' }} />
                    ))}
                  </div>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ font:`700 ${fs(13)}px/1.3 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink)' }}>
                    {t.isFull ? (t.archTitle || '?') : `${t.memberCount}/${t.maxMembers} คน`}
                  </div>
                  <div style={{ font:`500 ${fs(11)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:2 }}>
                    {t.isFull && t.primaryText ? `${copy.team_survived_prefix || 'รอดได้'} ${t.primaryText}` : !t.isFull ? `${copy.team_waiting_prefix || 'รอสมาชิกอีก'} ${t.maxMembers - t.memberCount} ${copy.team_waiting_suffix || 'คน'}` : ''}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button
                    onClick={() => onGoGroup?.(t.groupId)}
                    style={{ padding:'8px 12px', background:'var(--ink)', color:'var(--card)', border:'none', borderRadius:8, font:`600 ${fs(11)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer' }}
                  >{t.isFull ? (copy.team_view_result_btn || 'ดูผล') : (copy.team_view_btn || 'ดูทีม')}</button>
                  <button
                    disabled={leavingGroupId === t.groupId}
                    onClick={() => setLeaveConfirmGroupId(t.groupId)}
                    style={{ padding:'8px 10px', background:'none', color:'var(--ink2)', border:'1.5px solid rgba(28,26,23,.2)', borderRadius:8, font:`600 ${fs(11)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer' }}
                  >{copy.team_leave_btn || 'ออก'}</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background:'rgba(28,26,23,.04)', border:'2px dashed rgba(28,26,23,.18)', borderRadius:12, padding:'20px 16px', textAlign:'center' }}>
            <div style={{ font:`700 ${fs(14)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)' }}>{copy.summary_no_teams_title || 'ยังไม่มีทีม'}</div>
            <div style={{ font:`500 ${fs(12)}px/1.6 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink3)', marginTop:4 }}>{copy.summary_no_teams_body || 'รวม 5 คน ดูผลทีมวันสิ้นโลก'}</div>
            {onCreateGroup && (
              <button
                onClick={() => onCreateGroup?.()}
                style={{ marginTop:12, padding:'10px 18px', background:'var(--hl)', color:'var(--ink)', border:'2px solid var(--ink)', borderRadius:10, font:`700 ${fs(13)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'2px 3px 0 var(--ink)' }}
              >{copy.group_cta || 'สร้างทีมวันสิ้นโลก'}</button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSymbolsRow = () => {
    if (!blockVisible('symbolsRow') || !config.group?.enabled || !onGoSymbols) return null;
    return (
      <button
        key="symbolsRow"
        onClick={onGoSymbols}
        style={{ width:'100%', marginTop:16, padding:'14px 16px', background:'var(--card)', border:'2px solid var(--ink)', borderRadius:'var(--radius)', font:`600 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'2px 3px 0 var(--ink)', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}
      >
        <span style={{ width:36, height:36, borderRadius:8, background:'var(--hl)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:fs(20) }}>✦</span>
        <span style={{ flex:1 }}>
          <span style={{ display:'block' }}>{copy.symbols_title || symbolsTitleSrcVal || 'สะสมสัญลักษณ์'}</span>
          <span style={{ display:'block', font:`500 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, opacity:.7, marginTop:3 }}>{copy.symbols_sub || 'แชร์ผลกลุ่มเพื่อปลดล็อกสัญลักษณ์'}</span>
        </span>
        <span style={{ fontSize:fs(18), color:'var(--ink3)' }}>›</span>
      </button>
    );
  };

  // REWARDS is not one of Summary's 6 configurable block-builder slots (see SCREENS_V3 in
  // admin/src/components/sections/LiffSection.tsx) — it stays business-logic-only, always
  // rendered right after symbolsRow's spot and before pairLog, exactly as before.
  const renderRewards = () => {
    if (!onGoRewards) return null;
    return (
      <button
        key="rewards"
        onClick={onGoRewards}
        style={{ width:'100%', marginTop:16, padding:'14px 16px', background:'var(--card)', border:'2px solid var(--ink)', borderRadius:'var(--radius)', font:`600 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'2px 3px 0 var(--ink)', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}
      >
        <span style={{ width:36, height:36, borderRadius:8, background:'var(--ac)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:fs(20) }}>🎁</span>
        <span style={{ flex:1 }}>
          <span style={{ display:'block' }}>{copy.rewards_title || 'รางวัลของฉัน'}</span>
          <span style={{ display:'block', font:`500 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, opacity:.7, marginTop:3 }}>{copy.rewards_eyebrow || 'ดูสิทธิ์และรางวัลที่ได้รับ'}</span>
        </span>
        <span style={{ fontSize:fs(18), color:'var(--ink3)' }}>›</span>
      </button>
    );
  };

  const renderPairLog = () => {
    if (!blockVisible('pairLog') || isSoloMode) return null;
    return (
      <>
        <div key="pairLog-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'24px 0 12px' }}>
          <span style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(22), letterSpacing:'.05em' }}>{copy.pair_log_label || pairLogLabelSrcVal || 'คู่หูของฉัน'}</span>
          <span style={{ font:`700 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)' }}>{pairs.length} {copy.unit_pair || 'คู่'}</span>
        </div>

        {pairs.length === 0 ? (
          <div key="pairLog-empty" style={{ textAlign:'center', padding:'24px 16px', color:'var(--ink3)' }}>
            <div style={{ font:`600 ${fs(14)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif` }}>{copy.summary_no_pairs_title || 'ยังไม่มีคู่'}</div>
            <div style={{ font:`400 ${fs(12)}px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif`, marginTop:4 }}>{copy.summary_no_pairs_body || 'กด "เชิญเพื่อน" เพื่อชวนเพื่อนมาจับคู่'}</div>
          </div>
        ) : (
          <div key="pairLog-list" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pairs.map(p => {
              const partnerAxisId = findAxisId(p.partnerAxisLabel || '', config.axes) || undefined;
              const partnerCard = partnerAxisId ? getAxisCard(partnerAxisId, config.axes) : undefined;
              const verdict = p.status === 'waiting' ? (copy.pair_status_waiting || 'รอคู่หู...') : p.status === 'expired' ? (copy.pair_status_expired || 'หมดเวลา') : p.resultTitle || (copy.pair_status_done || 'ดูผล');
              const isCompact = pairLogStyle === 'compact';
              return (
                <button
                  key={p.pairId}
                  onClick={() => p.status === 'completed' && onViewPair(p.pairId, p.partnerName)}
                  style={isCompact
                    ? { display:'flex', alignItems:'center', gap:10, background:'none', border:'none', borderBottom:'1.5px solid rgba(28,26,23,.14)', borderRadius:0, padding:'10px 2px', cursor: p.status === 'completed' ? 'pointer' : 'default' }
                    : { display:'flex', alignItems:'center', gap:10, background:'var(--card)', border:'2px solid var(--ink)', borderRadius:'var(--card-radius)', padding:'10px 12px', cursor: p.status === 'completed' ? 'pointer' : 'default', boxShadow:'2px 3px 0 var(--ink)', transform:'rotate(calc(var(--tilt-deg) * -1deg))' }}
                >
                  {isCompact ? (
                    partnerCard ? (
                      <span style={{ backgroundImage:`url('${partnerCard}')`, backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:28, height:28, borderRadius:'50%', flexShrink:0, display:'block' }} />
                    ) : (
                      <span style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(28,26,23,.08)', font:`700 ${fs(12)}px var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink3)' }}>{p.partnerName[0]}</span>
                    )
                  ) : partnerCard ? (
                    <span style={{ backgroundImage:`url('${partnerCard}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:38, height:52, flexShrink:0, display:'block' }} />
                  ) : (
                    <span style={{ width:38, height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(28,26,23,.08)', borderRadius:6, font:`700 ${fs(14)}px var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink3)' }}>{p.partnerName[0]}</span>
                  )}
                  <span style={{ minWidth:0, textAlign:'left', flex:1 }}>
                    <span style={{ display:'block', font:`700 ${fs(13)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif` }}>{p.partnerName}</span>
                    <span style={{ display:'block', font:`400 ${fs(10.5)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:2 }}>
                      {p.partnerAxisLabel ? `${myArchLabel} × ${p.partnerAxisLabel}` : myArchLabel}
                    </span>
                  </span>
                  <span style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
                    <span style={{ display:'block', font:`700 ${fs(13)}px/1.4 var(--font-body,'Bai Jamjuree'),sans-serif`, color: statusColor(p.status) }}>{verdict}</span>
                    {(p.completedAtIso || p.completedAt) && <span style={{ display:'block', font:`500 ${fs(9.5)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink3)', marginTop:2 }}>{fmtDate(p.completedAtIso) || p.completedAt}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const RENDERERS: Record<string, () => React.ReactNode> = {
    survivorCard: renderSurvivorCard,
    retake:       renderRetake,
    actionRow:    renderActionRow,
    teamSection:  renderTeamSection,
    symbolsRow:   renderSymbolsRow,
    pairLog:      renderPairLog,
  };
  for (const xid of ['xImage', 'xText', 'xSpacer', 'xDivider', 'xBox', 'xCard', 'xRow', 'xChip']) {
    RENDERERS[xid] = () => renderExtraBlock(xid, {
      geo: geo(xid), copy, images: appearance?.images, fontScale: appearance?.font_scale,
      srcText: src(xid, 'text'), textCtx: srcCtx,
      srcList: src(xid, 'list'), listCtx: { axes: config.axes },
    });
  }

  const visible = blockOrder.filter(blockVisible);
  const flowBlocks = visible.filter(id => !pos(id));
  const floatBlocks = visible.filter(id => pos(id));
  // pairLog is pinned last (with Rewards immediately before it) regardless of admin reordering —
  // Rewards isn't part of the block system and must stay functionally independent of pairLog's
  // visibility/position, while still landing in its original spot for the unconfigured default order.
  const flowBlocksBeforePairLog = flowBlocks.filter(id => id !== 'pairLog');
  const pairLogVisible = flowBlocks.includes('pairLog');

  return (
    <>
      {/* Pair popup */}
      {popup && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="fade-enter" style={{ width:'100%', maxWidth:340, background:'var(--card)', border:'var(--border)', borderRadius:'var(--radius)', boxShadow:'var(--shadow)', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'2px solid var(--ink)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--hl)' }}>
              <span style={{ font:`700 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, letterSpacing:'.08em' }}>{copy.pair_popup_header || 'ผลคู่สำเร็จ'}</span>
              <span onClick={() => { setPopup(null); onPopupDismissed?.(); }} style={{ fontSize:fs(18), color:'var(--ink)', cursor:'pointer', lineHeight:1 }}>✕</span>
            </div>
            <div style={{ padding:'20px 20px 24px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
              {popup.imageUrl && <img src={popup.imageUrl} alt="" style={{ width:'100%', height:112, objectFit:'cover', borderRadius:8, marginBottom:16, border:'2px solid var(--ink)' }} />}
              <div style={{ font:`500 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)' }}>{popup.partnerName || copy.pair_partner_label || 'คู่หู'} × {copy.pair_me_label || 'คุณ'}</div>
              <div style={{ marginTop:8, font:`700 ${fs(22)}px/1.2 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ac)' }}>{popup.title}</div>
              <div style={{ margin:'10px 0 16px', font:`500 ${fs(13)}px/1.6 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)' }}>{popup.body}</div>
              {popup.pairId && (
                <button
                  onClick={() => { const pid = popup.pairId!; const pname = popup.partnerName || copy.pair_partner_label || 'คู่หู'; setPopup(null); onPopupDismissed?.(); onViewPair(pid, pname); }}
                  style={{ width:'100%', padding:'13px 16px', background:'var(--ac)', color:'var(--on-ac)', border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'3px 4px 0 var(--ink)', marginBottom:8 }}
                >{copy.pair_popup_view_btn || 'ดูผลคู่แบบเต็ม'}</button>
              )}
              <button onClick={() => { setPopup(null); onPopupDismissed?.(); }} style={{ background:'none', border:'none', color:'var(--ink3)', font:`600 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', padding:6 }}>{copy.pair_popup_skip_btn || 'ดูผลของฉันก่อน'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add friend nudge (non-mandatory) */}
      {nudgePending && (
        <AddFriendNudge
          oaId={config.appearance?.oa_id}
          trigger={nudgePending}
          onDismiss={handleNudgeDismiss}
          dismissLabel={nudgePending === 'share' ? (config.copy?.nudge_skip_share || 'ข้ามไป แชร์เลย') : (config.copy?.nudge_skip_invite || 'ข้ามไป เชิญเพื่อนเลย')}
          copy={config.copy}
        />
      )}

      {/* Leave-team confirm dialog */}
      {leaveConfirmGroupId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
          <div style={{ background:'var(--card)', border:'var(--border)', borderRadius:'var(--radius)', padding:'24px 20px 20px', boxShadow:'var(--shadow)', width:'100%', maxWidth:320 }}>
            <div style={{ font:`700 ${fs(17)}px/1.3 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink)', marginBottom:10 }}>{copy.team_leave_confirm_title || 'ออกจากทีม?'}</div>
            <div style={{ font:`500 ${fs(13)}px/1.6 var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginBottom:20 }}>{copy.team_leave_confirm || 'ออกจากทีมนี้จะต้องรอเพื่อนเชิญใหม่'}</div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => setLeaveConfirmGroupId(null)}
                style={{ flex:1, padding:'12px 0', background:'none', border:'2px solid rgba(28,26,23,.25)', borderRadius:'var(--radius)', font:`600 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', color:'var(--ink2)' }}
              >{copy.team_leave_cancel || 'ยกเลิก'}</button>
              <button
                disabled={leavingGroupId === leaveConfirmGroupId}
                onClick={async () => {
                  const gid = leaveConfirmGroupId;
                  setLeaveConfirmGroupId(null);
                  setLeavingGroupId(gid);
                  try {
                    await api('DELETE', `/api/group/${gid}/leave`);
                    setTeams(prev => prev?.filter(g => g.groupId !== gid) ?? null);
                  } finally {
                    setLeavingGroupId(null);
                  }
                }}
                style={{ flex:1, padding:'12px 0', background:'var(--ac)', color:'var(--on-ac)', border:'2px solid var(--ink)', borderRadius:'var(--radius)', font:`700 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'3px 3px 0 var(--ink)' }}
              >{copy.team_leave_confirm_btn || 'ออกจากทีม'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite bottom sheet */}
      {inviteSheetOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:150 }} onClick={() => setInviteSheetOpen(false)}>
          <div
            style={{ position:'absolute', bottom:0, left:0, right:0, background:'var(--card)', border:'var(--border)', borderRadius:'16px 16px 0 0', padding:'20px 20px 36px', boxShadow:'0 -4px 0 var(--ink)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <span style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:fs(22), letterSpacing:'.05em' }}>{copy.invite_sheet_title || 'เชิญเพื่อน'}</span>
              <span onClick={() => setInviteSheetOpen(false)} style={{ fontSize:fs(18), color:'var(--ink2)', cursor:'pointer' }}>✕</span>
            </div>
            {/* F-01 duo invite */}
            <button
              onClick={handleDuoInvite}
              disabled={duoInviteStatus === 'sending'}
              style={{ width:'100%', padding:'14px 16px', background: duoInviteStatus === 'sent' ? '#22c55e' : 'var(--line)', color:'#fff', border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'var(--shadow)', display:'flex', alignItems:'center', gap:12, marginBottom:10, textAlign:'left' }}
            >
              <span style={{ width:36, height:36, borderRadius:8, background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:fs(20) }}>👥</span>
              <span style={{ flex:1 }}>
                <span style={{ display:'block' }}>{duoInviteStatus === 'sent' ? (copy.invite_btn_sent || '✓ ส่งแล้ว!') : duoInviteStatus === 'sending' ? (copy.invite_btn_sending || 'กำลังส่ง...') : (copy.invite_duo_label || 'จับคู่ 1:1')}</span>
                <span style={{ display:'block', font:`500 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, opacity:.8, marginTop:3 }}>{copy.invite_duo_sub || 'ส่งลิงก์เชิญมาดูผลคู่กับฉัน'}</span>
              </span>
            </button>
            {/* Copy invite link */}
            <button
              onClick={handleCopyInviteLink}
              style={{ width:'100%', padding:'13px 16px', background:'var(--card)', color: copyLinkStatus === 'copied' ? 'var(--line)' : 'var(--ink)', border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'var(--shadow)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {copyLinkStatus === 'copied' ? (copy.copy_link_done || '✓ คัดลอกแล้ว') : (copy.copy_link_btn || 'คัดลอกลิงก์เชิญ')}
            </button>
            {/* Create team */}
            {config.group?.enabled && onCreateGroup && (
              <button
                onClick={() => { setInviteSheetOpen(false); onCreateGroup(); }}
                style={{ width:'100%', padding:'14px 16px', background:'var(--hl)', color:'var(--ink)', border:'var(--border)', borderRadius:'var(--radius)', font:`700 ${fs(14)}px/1 var(--font-body,'Bai Jamjuree'),sans-serif`, cursor:'pointer', boxShadow:'var(--shadow)', display:'flex', alignItems:'center', gap:12, textAlign:'left' }}
              >
                <span style={{ width:36, height:36, borderRadius:8, background:'rgba(28,26,23,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:fs(20) }}>🏕</span>
                <span style={{ flex:1 }}>
                  <span style={{ display:'block' }}>{copy.invite_team_label || 'สร้างทีมวันสิ้นโลก'}</span>
                  <span style={{ display:'block', font:`500 ${fs(11)}px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif`, opacity:.7, marginTop:3 }}>{copy.invite_team_sub || 'รวม 5 คน ดูผลทีมรอดโลก'}</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="screen" style={{ background:'var(--bg)', backgroundImage:'var(--texture-bg)', opacity: popup ? .35 : 1, transition:'opacity .2s', overflowY:'auto', position: floatBlocks.length ? 'relative' : undefined }}>
        <div style={{ padding:'20px 20px 28px' }}>
          {flowBlocksBeforePairLog.map(id => RENDERERS[id]?.())}
          {renderRewards()}
          {pairLogVisible && renderPairLog()}
        </div>
        {floatBlocks.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
      </div>
    </>
  );
}
