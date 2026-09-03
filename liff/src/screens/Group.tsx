import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { getAxisCard, findAxisId } from '../data';
import AddFriendNudge, { nudgeSeen } from './AddFriendNudge';
import { shareOrCopy } from '../shareUtils';
import { getScreenBlocks, resolveSrcText, resolveSrcImage, floatStyle, scaleFont, getPatternDefaults, renderExtraBlock } from '../screenConfig';

interface BlockGeo { h?: number; pad?: number; reveal?: string; style?: string }

interface GroupMember {
  userId: string;
  displayName?: string;
  topAxis: string;
  batchNo: number;
  joinedAt: string;
}

interface GroupArchetype {
  code: string;
  title: string;
  primary_text?: string;
  body: string;
  image_url?: string;
  symbol_url?: string;
  min_group_size: number;
  fallback?: boolean;
}

interface GroupResult {
  archetype: GroupArchetype | null;
  score: number | null;
  scoreUnit: string | null;
  isLocked: boolean;
}

interface GroupView {
  groupId: string;
  campaignId: string;
  creatorId: string;
  name?: string | null;
  createdBy?: string;
  members: GroupMember[];
  result: GroupResult | null;
  // API returns totalMembers; memberCount is a fallback alias
  totalMembers?: number;
  memberCount?: number;
  shareUrl?: string;
  overflowMode?: string;
  batchSize?: number | null;
  currentBatch?: number;
  currentBatchMembers?: number;
  maxMembers?: number;
}

interface Props {
  groupId: string;
  campaignId: string;
  myUserId: string;
  config: {
    brand?: { primary?: string; name?: string };
    copy?: Record<string, string>;
    axes?: Array<{ id: string; image_url?: string; label?: string }>;
    group?: { enabled?: boolean; min_members?: number; max_members?: number; overflow_mode?: string; batch_size?: number; result_locks_at?: number };
    appearance?: { oa_id?: string; og_base_url?: string; colors?: { primary?: string; on_primary?: string }; images?: Record<string, string>; screen_config?: Record<string, { blocks: any[] }>; font_scale?: number; group_hero_pattern?: 'fan' | 'grid'; art_shape?: 'card' | 'circle' | 'square' | 'wide' | 'none'; art_frame?: 'outline' | 'soft' | 'flat'; art_hero?: 'pair' | 'single' | 'band' };
  };
  liffId: string;
  isFriend?: boolean;
  onBack: () => void;
  onViewPair?: (pairId: string, partnerName: string) => void;
}

const DEFAULT_ORDER = ['topNav', 'grpHero', 'grpCard', 'memberList', 'axisCounts', 'inviteMore'];

export default function Group({ groupId, campaignId, myUserId, config, liffId, isFriend, onBack, onViewPair }: Props) {
  const [view, setView] = useState<GroupView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [symbolUnlocked, setSymbolUnlocked] = useState<string | null>(null);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [hasShared, setHasShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showShareNudge, setShowShareNudge] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [copyLinkStatus, setCopyLinkStatus] = useState<'idle' | 'copied'>('idle');
  const [tappedMemberId, setTappedMemberId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameEditMode, setNameEditMode] = useState(false);
  const completeSeenKey = `groupCompleteSeen_${groupId}`;
  const [showCompleteAnim, setShowCompleteAnim] = useState(false);
  const seenComplete = useRef(!!localStorage.getItem(completeSeenKey));
  const copy = config.copy || {};
  const primary = config.appearance?.colors?.primary || config.brand?.primary || '#E8354F';
  const appearance = config.appearance || {};
  // ── Typography (03) font scale — every literal px font-size below is run through this ──
  const fs = (px: number) => scaleFont(px, appearance.font_scale);

  const loadGroup = useCallback(async () => {
    try {
      const data = await api<GroupView>('GET', `/api/group/${groupId}?campaignId=${campaignId}`);
      setView(data);
      setGroupName(data.name || '');
      if (!data.name) setNameEditMode(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [groupId, campaignId]);

  useEffect(() => { loadGroup(); }, [loadGroup]);

  // Show TEAM COMPLETE! moment on first load when team is full
  useEffect(() => {
    if (!view || seenComplete.current) return;
    const cfgIsRolling = (config.group?.overflow_mode ?? view.overflowMode) === 'rolling';
    const cfgBatchSize = config.group?.batch_size ?? view.batchSize ?? (config.group?.max_members ?? 5);
    const cfgMaxMembers = config.group?.max_members ?? 5;
    const myBatch = cfgIsRolling ? (view.members.find(m => m.userId === myUserId)?.batchNo ?? null) : null;
    const batchCount = (cfgIsRolling && myBatch != null)
      ? view.members.filter(m => m.batchNo === myBatch).length
      : (view.totalMembers ?? view.memberCount ?? view.members.length);
    const threshold = cfgIsRolling ? cfgBatchSize : cfgMaxMembers;
    if (batchCount >= threshold) {
      seenComplete.current = true;
      localStorage.setItem(completeSeenKey, '1');
      setShowCompleteAnim(true);
    }
  }, [view, config.group?.max_members, config.group?.batch_size, config.group?.overflow_mode, completeSeenKey, myUserId]);

  useEffect(() => {
    api<{ unlockedSymbols: string[] }>('GET', `/api/quiz/my-symbols?campaignId=${campaignId}`)
      .then(d => setUnlockedCount(d.unlockedSymbols.length))
      .catch(() => {});
  }, [campaignId]);

  const handleCopyGroupLink = async () => {
    if (!view) return;
    const joinUrl = `${window.location.origin}/join?campaignId=${campaignId}&groupId=${groupId}`;
    try { await navigator.clipboard.writeText(joinUrl); } catch {}
    setCopyLinkStatus('copied');
    setTimeout(() => setCopyLinkStatus('idle'), 2000);
  };

  const handleInviteMore = async () => {
    if (!view) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    const notAvailable = !liff.isInClient() || (typeof liffAny.isApiAvailable === 'function' && !liffAny.isApiAvailable('shareTargetPicker'));
    const joinUrl = `${window.location.origin}/join?campaignId=${campaignId}&groupId=${groupId}`;
    // LIFF URL used inside flex card CTAs so LINE opens directly in LIFF (not webview)
    const liffJoinUrl = liffId
      ? `https://liff.line.me/${liffId}?campaignId=${campaignId}&groupId=${groupId}`
      : joinUrl;
    if (notAvailable) {
      await shareOrCopy(joinUrl, copy.group_invite_cta || 'ชวนเพื่อนร่วมทีม');
      setInviteStatus('sent');
      setTimeout(() => setInviteStatus('idle'), 3000);
      return;
    }
    setInviteStatus('sending');

    const maxMem = config.group?.max_members ?? 5;
    const batchSz = config.group?.batch_size ?? maxMem;
    const isRoll = config.group?.overflow_mode === 'rolling';
    const dispMax = isRoll ? batchSz : maxMem;
    const memberCount2 = view.totalMembers ?? view.memberCount ?? view.members.length;
    const inB = memberCount2 > 0 ? ((memberCount2 - 1) % batchSz) + 1 : 0;
    const dispCount = isRoll ? inB : memberCount2;
    const filled = Math.min(dispCount, dispMax);
    const remaining = dispMax - filled;
    const fillPct = `${Math.round((filled / dispMax) * 100)}%`;
    const lockIconUrl: string | undefined = copy.F10_lock_icon_url;

    // Inline axis resolver (resolveAxis is defined after the render guard)
    const resolveAx = (raw: string) =>
      config.axes?.find(a => a.id === raw || a.label === raw)?.id || findAxisId(raw) || raw;

    // Member slots: card image + name INSIDE the card box
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberSlots: any[] = [];
    for (let i = 0; i < maxMem; i++) {
      const member = view.members[i];
      if (member) {
        const axId = resolveAx(member.topAxis);
        const cardUrl = getAxisCard(axId, config.axes);
        memberSlots.push({
          type: 'box', layout: 'vertical', height: '100px',
          backgroundColor: '#FFFDF6', borderColor: '#1C1A17', borderWidth: '2px',
          cornerRadius: '7px', paddingAll: '3px', spacing: 'none',
          contents: [
            cardUrl
              ? { type: 'image', url: cardUrl, size: 'full', aspectMode: 'cover', aspectRatio: '3:4' }
              : { type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#F5E14B', contents: [] },
            { type: 'text', text: member.displayName || '...', size: 'xxs', weight: 'bold', align: 'center', color: '#1C1A17', margin: '2px', maxLines: 1 },
          ],
        });
      } else {
        memberSlots.push({
          type: 'box', layout: 'vertical', height: '100px',
          backgroundColor: '#EAE3D3', borderColor: '#B3ADA0', borderWidth: '2px',
          cornerRadius: '7px', justifyContent: 'center',
          contents: [{ type: 'text', text: '?', size: 'md', weight: 'bold', align: 'center', color: '#B3ADA0' }],
        });
      }
    }

    // Lock icon: use image if URL configured, otherwise styled text box
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lockIconBox: any = lockIconUrl
      ? {
          type: 'box', layout: 'vertical', width: '34px', height: '34px', flex: 0,
          backgroundColor: '#2A2724', borderColor: '#55504A', borderWidth: '2px',
          cornerRadius: '8px', justifyContent: 'center',
          contents: [{ type: 'image', url: lockIconUrl, size: 'full', aspectRatio: '1:1', aspectMode: 'fit' }],
        }
      : {
          type: 'box', layout: 'vertical', width: '34px', height: '34px', flex: 0,
          backgroundColor: '#2A2724', borderColor: '#55504A', borderWidth: '2px',
          cornerRadius: '8px', justifyContent: 'center',
          contents: [{ type: 'text', text: 'LOCK', size: 'xxs', weight: 'bold', align: 'center', color: '#F5E14B' }],
        };

    const altText = `ชวนเพื่อนอีก ${remaining} คน`.slice(0, 400);

    try {
      await liffAny.shareTargetPicker([{
        type: 'flex',
        altText,
        contents: {
          type: 'bubble', size: 'mega',
          styles: { body: { backgroundColor: '#FFFDF6' }, footer: { backgroundColor: '#FFFDF6', separator: false } },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '0px', spacing: 'none',
            contents: [
              // ── Top: member count header + slots ──
              {
                type: 'box', layout: 'vertical', backgroundColor: '#F7F1E3',
                paddingStart: '12px', paddingEnd: '12px', paddingTop: '11px', paddingBottom: '12px', spacing: 'none',
                contents: [
                  {
                    type: 'box', layout: 'horizontal',
                    contents: [
                      { type: 'text', text: copy.F10_header || `อีก ${remaining} คน ผลทีมจะเปิด`, size: 'xs', weight: 'bold', color: primary, flex: 1, gravity: 'center', maxLines: 1 },
                      { type: 'text', text: `${filled} / ${maxMem} คน`, size: 'sm', weight: 'bold', color: '#1C1A17', align: 'end', gravity: 'center', flex: 0 },
                    ],
                  },
                  { type: 'box', layout: 'horizontal', margin: '10px', spacing: 'xs', contents: memberSlots },
                ],
              },
              // ── Divider ──
              { type: 'box', layout: 'vertical', height: '2px', backgroundColor: '#1C1A17', contents: [{ type: 'filler' }] },
              // ── Locked result + progress ──
              {
                type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'none',
                contents: [
                  // Locked box
                  {
                    type: 'box', layout: 'horizontal', backgroundColor: '#1C1A17',
                    borderColor: '#1C1A17', borderWidth: '2px', cornerRadius: '10px',
                    paddingAll: '12px', spacing: 'md',
                    contents: [
                      lockIconBox,
                      {
                        type: 'box', layout: 'vertical', flex: 1, spacing: 'none', justifyContent: 'center',
                        contents: [
                          { type: 'text', text: copy.F10_locked_title || 'ผลของทีมนี้ยังไม่เปิด', size: 'sm', weight: 'bold', color: '#FFFDF6', maxLines: 1 },
                          { type: 'text', text: copy.F10_locked_body || `ครบ ${maxMem} คนแล้วเปิดพร้อมกันทุกคน`, size: 'xxs', color: '#B8B2A8', margin: '3px', wrap: true, maxLines: 2 },
                        ],
                      },
                    ],
                  },
                  // Progress bar + label
                  {
                    type: 'box', layout: 'horizontal', margin: '12px', spacing: 'sm', alignItems: 'center',
                    contents: [
                      {
                        type: 'box', layout: 'vertical', flex: 1, height: '12px',
                        backgroundColor: '#F7F1E3', borderColor: '#1C1A17', borderWidth: '2px', cornerRadius: '6px',
                        contents: [{
                          type: 'box', layout: 'vertical', width: fillPct, height: '100%',
                          backgroundColor: primary, contents: [{ type: 'filler' }],
                        }],
                      },
                      { type: 'text', text: `เหลือ ${remaining} ที่`, size: 'xxs', weight: 'bold', color: '#8A857B', align: 'end', gravity: 'center', flex: 0 },
                    ],
                  },
                  // Description
                  { type: 'text', text: copy.F10_body || 'ชื่อก๊วน จำนวนวันที่รอด และผลคู่กับทุกคนในทีม จะโผล่ทีเดียวเมื่อสายที่ 5 เข้ามา', size: 'sm', color: '#6E6A62', margin: '10px', wrap: true },
                ],
              },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', spacing: 'sm',
            paddingStart: '14px', paddingEnd: '14px', paddingBottom: '14px', paddingTop: '0px',
            contents: [
              {
                type: 'box', layout: 'vertical',
                backgroundColor: primary, borderColor: '#1C1A17', borderWidth: '2px',
                cornerRadius: '10px', paddingTop: '11px', paddingBottom: '11px',
                action: { type: 'uri', label: copy.F10_cta1 || 'ตอบ 6 ข้อ แล้วเข้าทีมนี้', uri: liffJoinUrl },
                contents: [{ type: 'text', text: copy.F10_cta1 || 'ตอบ 6 ข้อ แล้วเข้าทีมนี้', size: 'md', weight: 'bold', align: 'center', color: '#FFFDF6', maxLines: 1 }],
              },
              {
                type: 'box', layout: 'vertical',
                backgroundColor: '#FFFDF6', borderColor: '#1C1A17', borderWidth: '2px',
                cornerRadius: '10px', paddingTop: '9px', paddingBottom: '9px',
                action: { type: 'uri', label: copy.F10_cta2 || 'ดูผล', uri: liffJoinUrl },
                contents: [{ type: 'text', text: copy.F10_cta2 || 'ดูผล', size: 'sm', weight: 'bold', align: 'center', color: '#1C1A17', maxLines: 1 }],
              },
            ],
          },
        },
      }]);
      setInviteStatus('sent');
      setTimeout(() => setInviteStatus('idle'), 3000);
    } catch {
      setInviteStatus('error');
      setTimeout(() => setInviteStatus('idle'), 3000);
    }
  };

  const handleTapMember = async (memberId: string, memberName: string) => {
    if (memberId === myUserId || !onViewPair) return;
    setTappedMemberId(memberId);
    try {
      const res = await api<{ pairId?: string; status?: string; result?: { title: string; body: string } }>(
        'GET', `/api/pair/with-user?partnerId=${memberId}&campaignId=${campaignId}`
      );
      if (res.pairId && res.status === 'completed') {
        onViewPair(res.pairId, memberName);
      }
    } catch { /* no pair yet */ }
    setTappedMemberId(null);
  };

  const handleSaveName = async () => {
    if (!groupName.trim()) return;
    setNameSaving(true);
    try {
      await api('PATCH', `/api/group/${groupId}/name`, { name: groupName.trim() });
      setView(v => v ? { ...v, name: groupName.trim() } : v);
      setNameEditMode(false);
    } finally {
      setNameSaving(false);
    }
  };


  if (error) {
    return (
      <div className="screen" style={{ alignItems:'center', justifyContent:'center', padding:'0 30px', textAlign:'center', background:'#F7F1E3', backgroundImage:'var(--texture-bg)' }}>
        <div style={{ font:`500 ${fs(14)}px 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.6)' }}>{error}</div>
        <button onClick={onBack} style={{ marginTop:20, background:'none', border:'none', color:primary, font:`600 ${fs(14)}px 'Bai Jamjuree',sans-serif`, cursor:'pointer' }}>{copy.group_back || '← กลับ'}</button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="screen" style={{ alignItems:'center', justifyContent:'center', gap:16, background:'#F7F1E3', backgroundImage:'var(--texture-bg)' }}>
        <div style={{ width:32, height:32, border:'3px solid rgba(28,26,23,.15)', borderTopColor:primary, borderRadius:'50%', animation:'v2Spin .8s linear infinite' }} />
        <div style={{ font:`500 ${fs(13)}px 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.55)' }}>{copy.group_loading || 'กำลังโหลดผลกลุ่ม...'}</div>
      </div>
    );
  }

  const archetype = view.result?.archetype;
  const maxMembers = config.group?.max_members ?? view.maxMembers ?? 5;
  const isRolling = (config.group?.overflow_mode ?? view.overflowMode) === 'rolling';
  const batchSize = config.group?.batch_size ?? view.batchSize ?? maxMembers;
  // In rolling mode, show only members from the viewer's own batch
  const myBatchNo = isRolling ? (view.members.find(m => m.userId === myUserId)?.batchNo ?? null) : null;
  const members = (isRolling && myBatchNo != null)
    ? view.members.filter(m => m.batchNo === myBatchNo)
    : view.members;
  const memberCount = members.length;
  const displayMax = isRolling ? batchSize : maxMembers;
  const displayCount = memberCount;
  const remaining = Math.max(0, displayMax - displayCount);
  const isComplete = isRolling
    ? memberCount >= batchSize
    : !!(view.result?.isLocked || memberCount >= maxMembers);

  // ── screen_config wiring (LIFF & Style block builder) ───────────────────
  // 'group' ctx below is whatever THIS screen already computed for the current
  // user's archetype — there's no meaningful "index" for it at runtime.
  const groupCtx = archetype ? { title: archetype.title, primary_text: archetype.primary_text, body: archetype.body } : undefined;

  const { blockOrder, blockVisible, geo: geoRaw, pos, pat, src } = getScreenBlocks(appearance, 'Group', DEFAULT_ORDER);
  const geo = (id: string): BlockGeo => geoRaw(id) as BlockGeo;
  // Independent screen_config lookup for the "team just became complete" moment.
  const completeBlocks = getScreenBlocks(appearance, 'GroupComplete', ['grpComplete']);
  // Global "05 Art Style" tab defaults — per-block pat() overrides (already persisted
  // via screen_config) win whenever explicitly set; this only supplies the fallback.
  const patternDefaults = getPatternDefaults(appearance);

  const topNavTextSrc = resolveSrcText(src('topNav', 'text'), { axes: config.axes, group: groupCtx }, copy);
  const pageTitle = copy.group_page_title || topNavTextSrc || 'ผลกลุ่ม';

  const heroGeo = geo('grpHero');
  const heroH = Number(heroGeo.h) || 220;
  const heroReveal = heroGeo.reveal || 'members';
  const grpHeroPattern = pat('grpHero', 'group', patternDefaults.group);
  const grpHeroImgSrc = resolveSrcImage(src('grpHero', 'image'), { axes: config.axes, grpImage: archetype?.image_url, grpSymbol: archetype?.symbol_url });
  const grpHeroFixedUrl = grpHeroImgSrc || appearance.images?.['group_hero'];

  const grpCardTextSrc = resolveSrcText(src('grpCard', 'text'), { axes: config.axes, group: groupCtx }, copy);
  const groupTitleLabel = copy.group_title || grpCardTextSrc || 'ผลกลุ่ม';
  const grpCardPad = Number(geo('grpCard').pad) || 16;

  const memberListTextSrc = resolveSrcText(src('memberList', 'text'), { axes: config.axes, group: groupCtx }, copy);
  const membersHeading = copy.group_members || memberListTextSrc || 'สมาชิก';
  const memberListStyle = geo('memberList').style || 'default';

  const axisChipPat = pat('axisCounts', 'chip', patternDefaults.chip);
  // pill/cut/soft are per-block shape overrides with their own fixed radii (20/2/8) —
  // independent of the global Shape & Feel "Axis Chip Radius" field, which has no
  // per-block equivalent here (chip pattern always resolves via getPatternDefaults
  // above, never the global axis_chip_radius number). Left as literals: nothing to wire.
  const axisChipRadius = axisChipPat === 'pill' ? 20 : axisChipPat === 'cut' ? 2 : 8;

  const inviteMoreTextSrc = resolveSrcText(src('inviteMore', 'text'), { axes: config.axes, group: groupCtx }, copy);
  const inviteCtaIdleLabel = copy.group_invite_cta || inviteMoreTextSrc || `ชวนเพิ่ม · ยังว่างอีก ${remaining} คน`;

  const completePushSrc = resolveSrcText(completeBlocks.src('grpComplete', 'text'), { axes: config.axes, group: groupCtx }, copy);
  const completePushText = copy.team_full_push || completePushSrc || `ทีมของคุณครบ ${memberCount} คนแล้ว เปิดดูผลทีมได้เลย`;

  // ── TEAM COMPLETE! moment ──
  if (showCompleteAnim && completeBlocks.blockVisible('grpComplete')) {
    const resolveEarly = (raw: string) => config.axes?.find(a => a.id === raw || a.label === raw)?.id || findAxisId(raw) || raw;
    const completeFanCards = members.slice(0, 5).map(m => getAxisCard(resolveEarly(m.topAxis), config.axes));
    const angles = [-10, -5, 0, 5, 10];
    const yOffsets = [12, 6, 0, 6, 12];
    const completePosVal = completeBlocks.pos('grpComplete');
    const completeContent = (
      <>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%,rgba(245,225,75,.5),transparent 55%)', pointerEvents: 'none' }} />
        {/* Push notification mock */}
        <div style={{ position: 'relative', width: '100%', background: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 14, padding: '12px 14px', boxShadow: '4px 5px 0 #1C1A17', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 9, background: '#1C1A17', color: '#F5E14B', fontFamily: 'Bangers,cursive', fontSize: fs(17), display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '.04em' }}>AS</span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ font:`700 ${fs(12.5)}px 'Bai Jamjuree',sans-serif` }}>{config.brand?.name || 'APOCALYPSE SQUAD'} · เมื่อสักครู่</span>
            <span style={{ font:`500 ${fs(12.5)}px/1.5 'Bai Jamjuree',sans-serif`, color: 'rgba(28,26,23,.65)' }}>{completePushText}</span>
          </span>
        </div>
        {/* Fan cards */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {completeFanCards.map((url, i) => (
            <span key={i} style={{ display: 'block', width: 72, height: 98, border: '2.5px solid #1C1A17', borderRadius: 10, background: '#FFFDF6', boxShadow: '3px 4px 0 #1C1A17', overflow: 'hidden', margin: '0 -8px', transform: `rotate(${angles[i] ?? 0}deg) translateY(${yOffsets[i] ?? 0}px)`, flexShrink: 0 }}>
              {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            </span>
          ))}
        </div>
        {/* Title */}
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Bangers,cursive', fontSize: fs(38), letterSpacing: '.05em', lineHeight: 1 }}>{copy.team_full_title || 'TEAM COMPLETE!'}</div>
          <div style={{ font:`500 ${fs(13.5)}px/1.6 'Bai Jamjuree',sans-serif`, color: 'rgba(28,26,23,.6)', marginTop: 6 }}>{copy.team_full_sub || `ทุกคนได้แจ้งเตือนพร้อมกัน — มาดูผลทีมกันเลย`}</div>
        </div>
        {/* CTA */}
        <button
          onClick={() => setShowCompleteAnim(false)}
          style={{ position: 'relative', width: '100%', height: 52, background: primary, color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 13, font:`700 ${fs(17)}px 'Bai Jamjuree',sans-serif`, cursor: 'pointer', boxShadow: '4px 4px 0 #1C1A17' }}
        >{copy.team_full_cta || 'เปิดผลทีม →'}</button>
      </>
    );
    // Floating position is an edge case for a full-moment section, but the
    // block builder still allows it — support it while keeping the default
    // (no screen_config / no pos) path pixel-identical to before.
    if (completePosVal) {
      return (
        <div className="screen fade-enter" style={{ background: '#F7F1E3', backgroundImage: 'var(--texture-bg)', position: 'relative', overflow: 'hidden' }}>
          <div style={floatStyle(completePosVal)}>{completeContent}</div>
        </div>
      );
    }
    return (
      <div className="screen fade-enter" style={{ background: '#F7F1E3', backgroundImage: 'var(--texture-bg)', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 20px', position: 'relative', overflow: 'hidden' }}>
        {completeContent}
      </div>
    );
  }

  // Resolve topAxis to canonical ID (backend may send label or ID)
  const resolveAxis = (raw: string) =>
    config.axes?.find(a => a.id === raw || a.label === raw)?.id || findAxisId(raw) || raw;

  // Fan cards: one card per member (allow duplicates), up to 5
  const fanCards = members.slice(0, 5).map(m => getAxisCard(resolveAxis(m.topAxis), config.axes));

  const handleNativeShareCard = async () => {
    if (!isComplete || !archetype) return;
    const ogBase = config.appearance?.og_base_url || `${window.location.origin}/api/og`;
    const validFanCards = fanCards.filter(Boolean) as string[];
    const ogParams = new URLSearchParams({
      type: 'group_card',
      groupTitle: archetype.title,
      survival: archetype.primary_text || (view?.result?.score != null ? `${view.result.score} ${view.result.scoreUnit || 'วัน'}` : ''),
      body: archetype.body || '',
      badgeLabel: copy.og_badge_survival || 'รอดได้',
      ...(view?.name ? { teamName: view.name } : {}),
      archetypeLabel: archetype.title,
      ...(archetype.symbol_url ? { symbolUrl: archetype.symbol_url } : {}),
      ...(validFanCards.length ? { cardUrls: validFanCards.join(',') } : {}),
      t: String(Date.now()),
    });
    const imgUrl = `${ogBase}?${ogParams.toString()}`;
    try {
      const res = await fetch(imgUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const file = new File([blob], 'group-result.png', { type: 'image/png' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: archetype.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'group-result.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* cancelled or unavailable */ }
  };

  const handleShareClick = () => {
    if (!isFriend && !nudgeSeen('share')) { setShowShareNudge(true); return; }
    void handleShareGroup();
  };

  const handleShareNudgeDismiss = () => {
    setShowShareNudge(false);
    void handleShareGroup();
  };

  const handleShareGroup = async () => {
    setShareError(null);
    // Use LIFF URL directly so LINE opens in LIFF context, not a new webview
    const liffBase2 = liffId ? `https://liff.line.me/${liffId}` : `${window.location.origin}`;
    const ctaUrl = `${liffBase2}?campaignId=${campaignId}&groupId=${groupId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = (window as any).liff ?? liff;
    if (!liffAny.isInClient?.() || (typeof liffAny.isApiAvailable === 'function' && !liffAny.isApiAvailable('shareTargetPicker'))) {
      await shareOrCopy(ctaUrl, archetype?.title || copy.group_page_title || 'ผลกลุ่ม');
      return;
    }

    const survivalText = archetype?.primary_text || (view.result?.score != null ? `${view.result.score} ${view.result.scoreUnit || 'วัน'}` : '');
    const validFanCards = fanCards.filter(Boolean) as string[];

    // Build group_card OG hero image — only if og_base_url is explicitly configured
    // (window.location.origin inside LIFF is https://liff.line.me, not the real server)
    const ogBase = config.appearance?.og_base_url;
    const heroOgParams = ogBase ? new URLSearchParams({
      type: 'group_card',
      groupTitle: archetype?.title || '',
      survival: survivalText,
      body: archetype?.body || '',
      badgeLabel: copy.og_badge_survival || 'รอดได้',
      ...(view.name ? { teamName: view.name } : {}),
      archetypeLabel: archetype?.title || '',
      ...(archetype?.symbol_url ? { symbolUrl: archetype.symbol_url } : {}),
      ...(validFanCards.length ? { cardUrls: validFanCards.join(',') } : {}),
      t: String(Date.now()),
    }) : null;
    const heroOgUrl = isComplete && archetype && ogBase && heroOgParams ? `${ogBase}?${heroOgParams.toString()}` : null;

    try {
      const shareResult = await liffAny.shareTargetPicker([{
        type: 'flex',
        altText: (archetype
          ? `${view.name ? `ทีม "${view.name}" · ` : ''}${archetype.title}${survivalText ? ` · รอด ${survivalText}` : ''}`
          : (copy.group_share_alt || 'มาเข้ากลุ่มกัน!')).slice(0, 400),
        contents: {
          type: 'bubble',
          size: 'mega',
          hero: heroOgUrl
            ? { type: 'image', url: heroOgUrl, size: 'full', aspectRatio: '9:16', aspectMode: 'cover' }
            : (archetype?.symbol_url || archetype?.image_url)
              ? { type: 'image', url: archetype!.symbol_url || archetype!.image_url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
              : undefined,
          body: {
            type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
            contents: [
              ...(view.name ? [{ type: 'text' as const, text: `ทีม "${view.name}"`, size: 'xs', weight: 'bold', color: '#1C1A17', margin: 'none' as const }] : []),
              { type: 'text', text: copy.group_share_badge || 'ทีมนี้เป็นสาย', size: 'xxs', weight: 'bold', color: primary, margin: view.name ? 'xs' as const : 'none' as const },
              { type: 'text', text: archetype?.title || copy.group_fallback_title || 'ผลกลุ่ม', weight: 'bold', size: 'xxl', color: '#1C1A17', wrap: true },
              ...(survivalText || !isComplete ? [{
                type: 'box' as const, layout: 'vertical' as const, margin: 'xs' as const,
                contents: [
                  { type: 'text' as const, text: copy.og_badge_survival || 'รอดได้', size: 'xxs' as const, weight: 'bold' as const, color: primary },
                  { type: 'text' as const, text: survivalText || copy.group_pending_survival || 'รอสมาชิกเพิ่ม', weight: 'bold' as const, size: 'xl' as const, color: primary, wrap: true },
                ],
              }] : []),
              ...(archetype?.body ? [{ type: 'text' as const, text: archetype.body, size: 'sm' as const, color: '#555555', wrap: true }] : []),
              ...(!heroOgUrl && validFanCards.length > 0 ? [{
                  type: 'box' as const, layout: 'horizontal' as const, spacing: 'xs' as const, margin: 'md' as const,
                  contents: validFanCards.map(url => ({
                    type: 'image' as const, url, flex: 1, size: 'full' as const,
                    aspectRatio: '3:4', aspectMode: 'fit' as const,
                  })),
                }] : []),
            ],
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'button', action: { type: 'uri', label: isComplete ? (copy.group_share_cta_complete || 'ดูผลเต็ม') : (copy.group_join_cta || 'มาเข้าทีมนี้'), uri: ctaUrl }, style: 'primary', color: primary }],
          },
        },
      }]);
      // Only unlock symbol if user actually shared (not just opened/cancelled the picker)
      if ((shareResult as any)?.status === 'cancel') return;
      setHasShared(true);
      const shareRes = await api<{ symbolCode: string | null }>('POST', `/api/group/${groupId}/share`).catch(() => ({ symbolCode: null }));
      if (shareRes?.symbolCode) setSymbolUnlocked(shareRes.symbolCode);
    } catch (e: any) {
      setShareError(`error: ${e?.message || String(e)}`);
    }
  };

  const needMoreToChange = view.result?.isLocked ? 0 : Math.max(0, (config.group?.min_members ?? 2) + 2 - memberCount);

  // ── Per-slot block renderers ─────────────────────────────────────────────

  const renderTopNav = () => {
    if (!blockVisible('topNav')) return null;
    return (
      <div key="topNav" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 10px', borderBottom:'1.5px solid rgba(28,26,23,.1)', background:'#F7F1E3' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', font:`600 ${fs(15)}px 'Bai Jamjuree',sans-serif`, color:'#1C1A17', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize: fs(17), lineHeight:1 }}>✕</span>
          <span style={{ font:`700 ${fs(14)}px 'Bai Jamjuree',sans-serif` }}>{pageTitle}</span>
        </button>
        <span style={{ font:`700 ${fs(12)}px 'Bai Jamjuree',sans-serif`, letterSpacing:'.1em', color:'rgba(28,26,23,.35)' }}>LIFF</span>
      </div>
    );
  };

  const renderGrpHero = () => {
    if (!blockVisible('grpHero')) return null;
    // reveal:'result' shows a single fixed/bound hero image instead of the member-card fan.
    if (heroReveal === 'result' && grpHeroFixedUrl) {
      return (
        <div key="grpHero" style={{ height:heroH, flexShrink:0, position:'relative', background:'linear-gradient(#FCEFE0,#F7F1E3)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 0 28px' }}>
          <img src={grpHeroFixedUrl} alt="" style={{ maxWidth:'70%', maxHeight:'80%', objectFit:'contain', filter:'drop-shadow(3px 5px 0 rgba(28,26,23,.22))' }} />
        </div>
      );
    }
    if (grpHeroPattern === 'stack') {
      return (
        <div key="grpHero" style={{ height:heroH, flexShrink:0, position:'relative', background:'linear-gradient(#FCEFE0,#F7F1E3)', display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'20px 0 28px' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', position:'relative' }}>
            {fanCards.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width:100, height:140, objectFit:'contain', marginLeft: i > 0 ? -46 : 0, zIndex:i + 1, filter:'drop-shadow(3px 5px 0 rgba(28,26,23,.22))', display:'block', flexShrink:0 }} />
            ))}
          </div>
        </div>
      );
    }
    if (grpHeroPattern === 'grid') {
      return (
        <div key="grpHero" style={{ height:heroH, flexShrink:0, position:'relative', background:'linear-gradient(#FCEFE0,#F7F1E3)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px 20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(fanCards.length, 3) || 1},1fr)`, gap:8, width:'100%' }}>
            {fanCards.map((url, i) => (
              <div key={i} style={{ width:'100%', aspectRatio:'3/4', border:'2px solid #1C1A17', borderRadius:8, overflow:'hidden', background:'#FFFDF6' }}>
                {url && <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />}
              </div>
            ))}
          </div>
        </div>
      );
    }
    // fan (default) — existing behavior, unchanged
    return (
      <div key="grpHero" style={{ height:heroH, flexShrink:0, position:'relative', background:'linear-gradient(#FCEFE0,#F7F1E3)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 0 28px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', position:'relative', width:'100%', overflow:'hidden', paddingBottom:4 }}>
          {fanCards.map((url, i) => {
            const n = fanCards.length;
            const angle = n === 1 ? 0 : (i - (n - 1) / 2) * (n >= 4 ? 11 : 14);
            const zIdx = i === Math.floor(n / 2) ? 4 : n - Math.abs(i - Math.floor(n / 2));
            const w = n === 1 ? 148 : n >= 4 ? 86 : 118;
            const h = n === 1 ? 208 : n >= 4 ? 120 : 166;
            const ml = i > 0 ? (n >= 4 ? -18 : -24) : 0;
            return (
              <img key={i} src={url} alt="" style={{ width:w, height:h, objectFit:'contain', transform:`rotate(${angle}deg)`, zIndex:zIdx, marginLeft:ml, filter:'drop-shadow(3px 5px 0 rgba(28,26,23,.22))', display:'block', flexShrink:0 }} />
            );
          })}
        </div>
      </div>
    );
  };

  const renderGrpCard = () => {
    if (!blockVisible('grpCard')) return null;
    return (
      <div key="grpCard" style={{ background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:'var(--card-radius)', padding:grpCardPad, boxShadow:'5px 6px 0 #1C1A17', transform:'rotate(calc(var(--tilt-deg) * -1deg))' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          {/* Circle badge */}
          <div style={{ width:74, height:74, flexShrink:0, border:'2.5px solid #1C1A17', borderRadius:'50%', overflow:'hidden', background:'#F5E14B', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {isComplete && (archetype?.symbol_url || archetype?.image_url)
              ? <img src={archetype!.symbol_url || archetype!.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <div style={{ font:`700 ${fs(9)}px 'Bai Jamjuree',sans-serif`, color:'#1C1A17', textAlign:'center', padding:'0 6px', lineHeight:1.3 }}>{isComplete ? (archetype?.title || '?') : '?'}</div>
            }
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
              <span style={{ font:`700 ${fs(10.5)}px 'Bai Jamjuree',sans-serif`, letterSpacing:'.08em', color:primary }}>{groupTitleLabel}</span>
            </div>
            {isComplete ? (
              <div style={{ font:`700 ${fs(23)}px/1.25 'Bai Jamjuree',sans-serif`, marginTop:5 }}>
                {archetype?.title || copy.group_fallback_title || '—'}
              </div>
            ) : view.createdBy === myUserId ? (
              /* Creator: input ↔ name+pencil toggle */
              nameEditMode ? (
                <div style={{ marginTop:6, display:'flex', gap:6, alignItems:'center' }}>
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder={copy.group_name_placeholder || 'ตั้งชื่อทีม...'}
                    maxLength={50}
                    style={{ flex:1, font:`700 ${fs(16)}px/1 'Bai Jamjuree',sans-serif`, border:'none', borderBottom:'2px solid #1C1A17', background:'transparent', outline:'none', padding:'4px 0', color:'#1C1A17' }}
                  />
                  <button
                    disabled={nameSaving || !groupName.trim()}
                    onClick={handleSaveName}
                    style={{ flexShrink:0, padding:'4px 10px', background:'#1C1A17', color:'#FFFDF6', border:'none', borderRadius:6, font:`700 ${fs(11)}px/1 'Bai Jamjuree',sans-serif`, cursor:'pointer', opacity: nameSaving ? 0.5 : 1 }}
                  >{nameSaving ? '...' : (copy.group_name_save_btn || 'บันทึก')}</button>
                </div>
              ) : (
                <div style={{ marginTop:5, display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ font:`700 ${fs(17)}px/1.25 'Bai Jamjuree',sans-serif`, color:'#1C1A17' }}>{view.name}</span>
                  <button
                    onClick={() => setNameEditMode(true)}
                    style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', padding:'2px 3px', color:'rgba(28,26,23,.45)', fontSize: fs(13), lineHeight:1 }}
                    title="แก้ไขชื่อทีม"
                  >✏️</button>
                </div>
              )
            ) : (
              <div style={{ font:`700 ${fs(17)}px/1.25 'Bai Jamjuree',sans-serif`, marginTop:5 }}>
                {view.name || copy.group_pending_title || 'รอทีมครบก่อน'}
              </div>
            )}
          </div>
        </div>
        {archetype?.body && isComplete && (
          <div style={{ font:`500 ${fs(13)}px/1.75 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.65)', marginTop:11 }}>{archetype.body}</div>
        )}
        {isComplete ? (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:13, borderTop:'2px dashed rgba(28,26,23,.2)', paddingTop:12 }}>
            <div>
              <div style={{ font:`600 ${fs(9.5)}px 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.45)' }}>{copy.group_survived || 'กลุ่มนี้อยู่รอดได้'}</div>
              <div style={{ font:`700 ${fs(27)}px/1.15 'Bai Jamjuree',sans-serif`, color: (archetype?.primary_text || view.result?.score != null) ? primary : 'rgba(28,26,23,.25)', marginTop:2 }}>
                {archetype?.primary_text || (view.result?.score != null ? `${view.result.score} ${view.result.scoreUnit || copy.unit_days || 'วัน'}` : '—')}
              </div>
            </div>
            <div style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
              <div style={{ background:'#F5E14B', border:'2px solid #1C1A17', borderRadius:'var(--badge-radius)', padding:'2px 9px', font:`700 ${fs(11)}px 'Bai Jamjuree',sans-serif`, transform:'rotate(-1.5deg)', display:'inline-block' }}>{memberCount} คน</div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop:13, borderTop:'2px dashed rgba(28,26,23,.2)', paddingTop:12 }}>
            {/* Progress bar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{ flex:1, height:8, background:'rgba(28,26,23,.1)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.round((displayCount / displayMax) * 100)}%`, background:primary, borderRadius:4, transition:'width .4s' }} />
              </div>
              <span style={{ flexShrink:0, font:`700 ${fs(11)}px 'Bai Jamjuree',sans-serif`, color:'#1C1A17', minWidth:32, textAlign:'right' }}>{displayCount}/{displayMax}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ font:`500 ${fs(12)}px/1.4 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.55)' }}>{copy.group_remaining_label ? copy.group_remaining_label.replace('{n}', String(remaining)) : `อีก ${remaining} คน ผลทีมก็เปิด`}</div>
              <div style={{ background:'#F5E14B', border:'2px solid #1C1A17', borderRadius:'var(--badge-radius)', padding:'2px 9px', font:`700 ${fs(11)}px 'Bai Jamjuree',sans-serif`, transform:'rotate(-1.5deg)', display:'inline-block', flexShrink:0 }}>{memberCount} คน</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMemberList = () => {
    if (!blockVisible('memberList')) return null;
    if (memberListStyle === 'compact') {
      return (
        <div key="memberList">
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', margin:'20px 0 10px' }}>
            <span style={{ font:`700 ${fs(16)}px 'Bai Jamjuree',sans-serif` }}>{membersHeading}</span>
            <span style={{ font:`600 ${fs(11)}px 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.45)' }}>{memberCount} {copy.unit_person || 'คน'}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {members.map(m => {
              const axId = resolveAxis(m.topAxis);
              const card = getAxisCard(axId, config.axes);
              const isMe = m.userId === myUserId;
              const memberDisplayName = isMe ? (copy.me || 'คุณ') : (m.displayName || `${copy.group_member_prefix || 'สมาชิก'} #${m.batchNo}`);
              const canTap = !isMe && !!onViewPair;
              const isLoading = tappedMemberId === m.userId;
              return (
                <div
                  key={m.userId}
                  onClick={() => canTap && handleTapMember(m.userId, memberDisplayName)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:10, padding:'8px 6px', cursor: canTap ? 'pointer' : 'default', opacity: isLoading ? 0.6 : 1 }}
                >
                  <img src={card} alt="" style={{ width:'100%', height:58, objectFit:'contain' }} />
                  <span style={{ font:`700 ${fs(11)}px 'Bai Jamjuree',sans-serif`, textAlign:'center' }}>{memberDisplayName}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    // default — existing behavior, unchanged
    return (
      <div key="memberList">
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', margin:'20px 0 10px' }}>
          <span style={{ font:`700 ${fs(16)}px 'Bai Jamjuree',sans-serif` }}>{membersHeading}</span>
          <span style={{ font:`600 ${fs(11)}px 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.45)' }}>{memberCount} {copy.unit_person || 'คน'}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {members.map(m => {
            const axId = resolveAxis(m.topAxis);
            const card = getAxisCard(axId, config.axes);
            const archName = config.axes?.find(a => a.id === axId)?.label || m.topAxis;
            const isMe = m.userId === myUserId;
            const memberDisplayName = isMe ? (copy.me || 'คุณ') : (m.displayName || `${copy.group_member_prefix || 'สมาชิก'} #${m.batchNo}`);
            const canTap = !isMe && !!onViewPair;
            const isLoading = tappedMemberId === m.userId;
            return (
              <div
                key={m.userId}
                onClick={() => canTap && handleTapMember(m.userId, memberDisplayName)}
                style={{ display:'flex', alignItems:'center', gap:12, background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:12, padding:'10px 12px', cursor: canTap ? 'pointer' : 'default', opacity: isLoading ? 0.6 : 1 }}
              >
                <img src={card} alt="" style={{ width:48, height:66, flexShrink:0, objectFit:'contain' }} />
                <span style={{ minWidth:0, flex:1 }}>
                  <span style={{ display:'block', font:`700 ${fs(13)}px 'Bai Jamjuree',sans-serif` }}>{memberDisplayName}</span>
                  <span style={{ display:'block', font:`500 ${fs(10.5)}px 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.5)', marginTop:1 }}>{archName}</span>
                </span>
                {isLoading
                  ? <span style={{ flexShrink:0, font:`500 ${fs(10)}px 'Bai Jamjuree',sans-serif`, color:'rgba(28,26,23,.4)' }}>โหลด...</span>
                  : canTap
                  ? <span style={{ flexShrink:0, background:'#F5E14B', border:'1.5px solid #1C1A17', borderRadius:'var(--badge-radius)', padding:'3px 9px', font:`700 ${fs(10.5)}px 'Bai Jamjuree',sans-serif` }}>{copy.group_view_pair_btn || 'ดูผลคู่ →'}</span>
                  : <span style={{ flexShrink:0, background:'#F5E14B', border:'1.5px solid #1C1A17', borderRadius:'var(--badge-radius)', padding:'2px 8px', font:`700 ${fs(10)}px 'Bai Jamjuree',sans-serif` }}>{copy.me || 'คุณ'}</span>
                }
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAxisCounts = () => {
    if (!blockVisible('axisCounts')) return null;
    const axisCounts: Record<string, number> = {};
    for (const m of members) {
      const axId = resolveAxis(m.topAxis);
      axisCounts[axId] = (axisCounts[axId] ?? 0) + 1;
    }
    const entries = Object.entries(axisCounts).sort((a, b) => b[1] - a[1]);
    return (
      <div key="axisCounts" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
        {entries.map(([axId, count]) => {
          const axLabel = config.axes?.find(a => a.id === axId)?.label || axId;
          return (
            <span key={axId} style={{ background: '#F5E14B', border: '1.5px solid #1C1A17', borderRadius: axisChipRadius, padding: '3px 10px', font:`600 ${fs(11)}px 'Bai Jamjuree',sans-serif`, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ font:`700 ${fs(12)}px 'Bai Jamjuree',sans-serif` }}>{count}</span> {axLabel}
            </span>
          );
        })}
      </div>
    );
  };

  const renderInviteMore = () => {
    if (!blockVisible('inviteMore')) return null;
    if (view.result?.isLocked || memberCount >= (config.group?.max_members ?? 5)) return null;
    return (
      <div key="inviteMore">
        <button
          onClick={handleInviteMore}
          disabled={inviteStatus === 'sending'}
          style={{
            width: '100%', marginTop: 16, padding: '14px 16px',
            background: inviteStatus === 'sent' ? '#22c55e' : inviteStatus === 'error' ? '#E8354F' : 'var(--line)',
            color: '#FFFDF6',
            border: '2.5px solid #1C1A17', borderRadius: 13,
            font:`700 ${fs(15)}px 'Bai Jamjuree',sans-serif`,
            cursor: inviteStatus === 'sending' ? 'default' : 'pointer',
            boxShadow: '4px 5px 0 #1C1A17',
          }}
        >
          {inviteStatus === 'sending' ? (copy.group_invite_sending || 'กำลังส่ง...') : inviteStatus === 'sent' ? (copy.group_invite_sent || '✓ ส่งคำเชิญแล้ว') : inviteStatus === 'error' ? (copy.group_invite_retry || 'ลองใหม่') : inviteCtaIdleLabel}
        </button>
        <button
          onClick={handleCopyGroupLink}
          style={{ width: '100%', marginTop: 8, padding: '13px 16px', background: '#FFFDF6', color: copyLinkStatus === 'copied' ? 'var(--line)' : '#1C1A17', border: '2.5px solid #1C1A17', borderRadius: 13, font:`700 ${fs(14)}px/1 'Bai Jamjuree',sans-serif`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '4px 5px 0 #1C1A17' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {copyLinkStatus === 'copied' ? (copy.copy_link_done || '✓ คัดลอกแล้ว') : (copy.copy_link_btn || 'คัดลอกลิงก์เชิญ')}
        </button>
      </div>
    );
  };

  const RENDERERS: Record<string, () => React.ReactNode> = {
    topNav: renderTopNav,
    grpHero: renderGrpHero,
    grpCard: renderGrpCard,
    memberList: renderMemberList,
    axisCounts: renderAxisCounts,
    inviteMore: renderInviteMore,
  };
  // config.group here carries only settings (min/max members etc.), not the full
  // archetypes[] list — this screen only ever computes the ONE archetype that
  // matched (groupCtx), so xRow/xChip's 'group' list mode has nothing to bind to.
  for (const xid of ['xImage', 'xText', 'xSpacer', 'xDivider', 'xBox', 'xCard', 'xRow', 'xChip']) {
    RENDERERS[xid] = () => renderExtraBlock(xid, {
      geo: geo(xid) as Record<string, unknown>, copy, images: appearance?.images, fontScale: appearance?.font_scale,
      srcText: src(xid, 'text'), textCtx: { axes: config.axes, group: groupCtx },
      srcList: src(xid, 'list'), listCtx: { axes: config.axes },
    });
  }

  // topNav/grpHero always bleed full-width outside the padded content wrapper
  // (matching the screen's original layout); the rest render inside it. Order
  // within each group still follows the admin's configured blockOrder.
  const visibleBlocks = blockOrder.filter(blockVisible);
  const flowIds = visibleBlocks.filter(id => !pos(id));
  const floatIds = visibleBlocks.filter(id => pos(id));
  const outerFlowIds = flowIds.filter(id => id === 'topNav' || id === 'grpHero');
  const innerFlowIds = flowIds.filter(id => id !== 'topNav' && id !== 'grpHero');

  return (
    <div className="screen" style={{ background:'#F7F1E3', backgroundImage:'var(--texture-bg)', overflowY:'auto', position: floatIds.length ? 'relative' : undefined }}>
      {showShareNudge && (
        <AddFriendNudge
          oaId={config.appearance?.oa_id}
          trigger="share"
          onDismiss={handleShareNudgeDismiss}
          dismissLabel={copy.nudge_skip_share || 'ข้ามไปก่อน แชร์เลย'}
        />
      )}
      {outerFlowIds.map(id => RENDERERS[id]?.())}

      <div style={{ padding:'0 22px 30px', marginTop:-14, position:'relative' }}>
        {innerFlowIds.map(id => RENDERERS[id]?.())}

        {/* Share + back */}
        <div style={{ display:'flex', gap:9, marginTop:12 }}>
          {isComplete && (
            <button
              onClick={handleShareClick}
              style={{ flex:1, background: hasShared ? 'rgba(6,199,85,.15)' : 'var(--line)', color: hasShared ? 'var(--line)' : '#fff', border:'2.5px solid #1C1A17', borderRadius:13, padding:'14px 10px', font:`700 ${fs(13)}px 'Bai Jamjuree',sans-serif`, cursor:'pointer', boxShadow: hasShared ? 'none' : '4px 5px 0 #1C1A17' }}
            >{hasShared ? (copy.group_share_unlocked || '✓ แชร์แล้ว') : (copy.group_share_cta || 'แชร์ผลกลุ่มเข้าไลน์')}</button>
          )}
          <button
            onClick={onBack}
            style={{ flexShrink:0, background:'#FFFDF6', color:'#1C1A17', border:'2px solid #1C1A17', borderRadius:13, padding:'14px 18px', font:`600 ${fs(13)}px 'Bai Jamjuree',sans-serif`, cursor:'pointer', flex: isComplete ? 1 : undefined }}
          >{copy.group_back_solo || 'ผลเดี่ยว'}</button>
        </div>
        {isComplete && (
          <button
            onClick={handleNativeShareCard}
            style={{ width:'100%', padding:'13px 20px', background:'#FFFDF6', color:'#1C1A17', border:'2.5px solid #1C1A17', borderRadius:13, font:`700 ${fs(15)}px/1 'Bai Jamjuree',sans-serif`, cursor:'pointer', boxShadow:'4px 5px 0 #1C1A17', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:10 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            {copy.group_native_share_btn || 'แชร์การ์ดกลุ่ม'}
          </button>
        )}
        {shareError && (
          <div style={{ marginTop:8, padding:'8px 10px', background:'#FEE2E2', border:'1px solid #E8354F', borderRadius:8, font:`500 ${fs(11)}px/1.5 'Bai Jamjuree',sans-serif`, color:'#991B1B', wordBreak:'break-all' }}>
            {shareError}
          </div>
        )}
      </div>

      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}

      {symbolUnlocked && (
        <div style={{ position: 'fixed', bottom: 32, left: 20, right: 20, zIndex: 200, background: '#1C1A17', color: '#F5E14B', borderRadius: 14, padding: '14px 18px', font:`700 ${fs(14)}px 'Bai Jamjuree',sans-serif`, textAlign: 'center', boxShadow: '0 4px 20px rgba(28,26,23,.35)', animation: 'v2Bob .4s ease' }}>
          {copy.group_unlocked_toast || '🔓 ปลดล็อกสัญลักษณ์แล้ว!'}
        </div>
      )}
    </div>
  );
}
