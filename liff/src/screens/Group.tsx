import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { getAxisCard, findAxisId, ARCH } from '../data';

interface GroupMember {
  userId: string;
  displayName?: string;
  topAxis: string;
  batchNo: number;
  joinedAt: string;
  reward_claimed?: boolean;
}

interface GroupArchetype {
  code: string;
  title: string;
  primary_text?: string;
  body: string;
  image_url?: string;
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
  canClaim?: boolean;
}

interface Props {
  groupId: string;
  campaignId: string;
  myUserId: string;
  config: {
    brand?: { primary?: string; name?: string };
    copy?: Record<string, string>;
    axes?: Array<{ id: string; image_url?: string; label?: string }>;
    group?: { enabled?: boolean; min_members?: number; reward_members?: number; max_members?: number };
  };
  liffId: string;
  onBack: () => void;
  onViewPair?: (pairId: string, partnerName: string) => void;
}

export default function Group({ groupId, campaignId, myUserId, config, liffId, onBack, onViewPair }: Props) {
  const [view, setView] = useState<GroupView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimDone, setClaimDone] = useState(false);
  const [symbolUnlocked, setSymbolUnlocked] = useState<string | null>(null);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [hasShared, setHasShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [tappedMemberId, setTappedMemberId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameEditMode, setNameEditMode] = useState(false);
  const [showCompleteAnim, setShowCompleteAnim] = useState(false);
  const seenComplete = useRef(false);
  const copy = config.copy || {};

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
    const maxMembers = config.group?.max_members ?? 5;
    const count = view.totalMembers ?? view.memberCount ?? view.members.length;
    if (view.result?.isLocked || count >= maxMembers) {
      seenComplete.current = true;
      setShowCompleteAnim(true);
    }
  }, [view, config.group?.max_members]);

  useEffect(() => {
    api<{ unlockedSymbols: string[] }>('GET', `/api/quiz/my-symbols?campaignId=${campaignId}`)
      .then(d => setUnlockedCount(d.unlockedSymbols.length))
      .catch(() => {});
  }, [campaignId]);

  const handleInviteMore = async () => {
    if (!view) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    const notAvailable = !liff.isInClient() || (typeof liffAny.isApiAvailable === 'function' && !liffAny.isApiAvailable('shareTargetPicker'));
    const joinUrl = `https://liff.line.me/${liffId}?campaignId=${campaignId}&groupId=${groupId}`;
    if (notAvailable) {
      try { await navigator.clipboard.writeText(joinUrl); } catch {}
      setInviteStatus('sent');
      setTimeout(() => setInviteStatus('idle'), 3000);
      return;
    }
    setInviteStatus('sending');

    const maxMem = config.group?.reward_members ?? config.group?.max_members ?? 5;
    const memberCount2 = view.totalMembers ?? view.memberCount ?? view.members.length;
    const filled = Math.min(memberCount2, maxMem);
    const remaining = maxMem - filled;
    const fillPct = `${Math.round((filled / maxMem) * 100)}%`;
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
                      { type: 'text', text: copy.F10_header || `อีก ${remaining} คน ผลทีมจะเปิด`, size: 'xs', weight: 'bold', color: '#E8354F', flex: 1, gravity: 'center', maxLines: 1 },
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
                          backgroundColor: '#E8354F', contents: [{ type: 'filler' }],
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
                backgroundColor: '#E8354F', borderColor: '#1C1A17', borderWidth: '2px',
                cornerRadius: '10px', paddingTop: '11px', paddingBottom: '11px',
                action: { type: 'uri', label: copy.F10_cta1 || 'ตอบ 6 ข้อ แล้วเข้าทีมนี้', uri: joinUrl },
                contents: [{ type: 'text', text: copy.F10_cta1 || 'ตอบ 6 ข้อ แล้วเข้าทีมนี้', size: 'md', weight: 'bold', align: 'center', color: '#FFFDF6', maxLines: 1 }],
              },
              {
                type: 'box', layout: 'vertical',
                backgroundColor: '#FFFDF6', borderColor: '#1C1A17', borderWidth: '2px',
                cornerRadius: '10px', paddingTop: '9px', paddingBottom: '9px',
                action: { type: 'uri', label: copy.F10_cta2 || 'ดูผล', uri: joinUrl },
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

  const handleClaim = async () => {
    if (claiming || claimDone) return;
    setClaiming(true);
    try {
      await api('POST', `/api/group/${groupId}/claim`);
      setClaimDone(true);
      loadGroup(); // refresh member list to show reward_claimed badge
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  if (error) {
    return (
      <div className="screen" style={{ alignItems:'center', justifyContent:'center', padding:'0 30px', textAlign:'center', background:'#F7F1E3' }}>
        <div style={{ font:"500 14px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.6)' }}>{error}</div>
        <button onClick={onBack} style={{ marginTop:20, background:'none', border:'none', color:'#E8354F', font:"600 14px 'Bai Jamjuree',sans-serif", cursor:'pointer' }}>{copy.group_back || '← กลับ'}</button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="screen" style={{ alignItems:'center', justifyContent:'center', gap:16, background:'#F7F1E3' }}>
        <div style={{ width:32, height:32, border:'3px solid rgba(28,26,23,.15)', borderTopColor:'#E8354F', borderRadius:'50%', animation:'v2Spin .8s linear infinite' }} />
        <div style={{ font:"500 13px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)' }}>{copy.group_loading || 'กำลังโหลดผลกลุ่ม...'}</div>
      </div>
    );
  }

  const archetype = view.result?.archetype;
  const members = view.members;
  const memberCount = view.totalMembers ?? view.memberCount ?? members.length;
  const maxMembers = config.group?.max_members ?? 5;
  const isComplete = !!(view.result?.isLocked || memberCount >= maxMembers);
  const remaining = Math.max(0, maxMembers - memberCount);

  // ── TEAM COMPLETE! moment ──
  if (showCompleteAnim) {
    const resolveEarly = (raw: string) => config.axes?.find(a => a.id === raw || a.label === raw)?.id || findAxisId(raw) || raw;
    const completeFanCards = members.slice(0, 5).map(m => getAxisCard(resolveEarly(m.topAxis), config.axes));
    const angles = [-10, -5, 0, 5, 10];
    const yOffsets = [12, 6, 0, 6, 12];
    return (
      <div className="screen fade-enter" style={{ background: '#F7F1E3', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%,rgba(245,225,75,.5),transparent 55%)', pointerEvents: 'none' }} />
        {/* Push notification mock */}
        <div style={{ position: 'relative', width: '100%', background: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 14, padding: '12px 14px', boxShadow: '4px 5px 0 #1C1A17', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 9, background: '#1C1A17', color: '#F5E14B', fontFamily: 'Bangers,cursive', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '.04em' }}>AS</span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ font: "700 12.5px 'Bai Jamjuree',sans-serif" }}>{config.brand?.name || 'APOCALYPSE SQUAD'} · เมื่อสักครู่</span>
            <span style={{ font: "500 12.5px/1.5 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.65)' }}>{copy.team_full_push || `ทีมของคุณครบ ${memberCount} คนแล้ว เปิดดูผลทีมได้เลย`}</span>
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
          <div style={{ fontFamily: 'Bangers,cursive', fontSize: 38, letterSpacing: '.05em', lineHeight: 1 }}>{copy.team_full_title || 'TEAM COMPLETE!'}</div>
          <div style={{ font: "500 13.5px/1.6 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.6)', marginTop: 6 }}>{copy.team_full_sub || `ทุกคนได้แจ้งเตือนพร้อมกัน — มาดูผลทีมกันเลย`}</div>
        </div>
        {/* CTA */}
        <button
          onClick={() => setShowCompleteAnim(false)}
          style={{ position: 'relative', width: '100%', height: 52, background: '#E8354F', color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 13, font: "700 17px 'Bai Jamjuree',sans-serif", cursor: 'pointer', boxShadow: '4px 4px 0 #1C1A17' }}
        >{copy.team_full_cta || 'เปิดผลทีม →'}</button>
      </div>
    );
  }
  const canClaim = claimDone ? false : (view.canClaim ?? false);

  // Resolve topAxis to canonical ID (backend may send label or ID)
  const resolveAxis = (raw: string) =>
    config.axes?.find(a => a.id === raw || a.label === raw)?.id || findAxisId(raw) || raw;

  // Fan cards: one card per member (allow duplicates), up to 5
  const fanCards = members.slice(0, 5).map(m => getAxisCard(resolveAxis(m.topAxis), config.axes));

  const handleShareGroup = async () => {
    setShareError(null);
    // Complete team → CTA creates a new team; incomplete → joins this group
    const ctaUrl = isComplete
      ? `https://liff.line.me/${liffId}?campaignId=${campaignId}`
      : (view.shareUrl || `https://liff.line.me/${liffId}?campaignId=${campaignId}&groupId=${groupId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = (window as any).liff ?? liff;
    if (!liffAny.isInClient?.()) { setShareError('isInClient=false — ต้องเปิดในแอป LINE'); return; }
    if (typeof liffAny.isApiAvailable === 'function' && !liffAny.isApiAvailable('shareTargetPicker')) { setShareError('shareTargetPicker ไม่พร้อม — เช็คสิทธิ์ LIFF'); return; }

    const survivalText = archetype?.primary_text || (view.result?.score != null ? `${view.result.score} ${view.result.scoreUnit || 'วัน'}` : '');
    const validFanCards = fanCards.filter(Boolean) as string[];

    const fanCardRow = validFanCards.length > 0
      ? [{
          type: 'box' as const, layout: 'horizontal' as const, spacing: 'xs' as const, margin: 'md' as const,
          contents: validFanCards.map(url => ({
            type: 'image' as const, url, flex: 1, size: 'full' as const,
            aspectRatio: '3:4', aspectMode: 'fit' as const,
          })),
        }]
      : [];

    try {
      await liffAny.shareTargetPicker([{
        type: 'flex',
        altText: archetype
          ? `${archetype.title}${survivalText ? ` · รอด ${survivalText}` : ''}`.slice(0, 400)
          : (copy.group_share_alt || 'มาเข้ากลุ่มกัน!'),
        contents: {
          type: 'bubble',
          size: 'mega',
          hero: archetype?.image_url
            ? { type: 'image', url: archetype.image_url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
            : undefined,
          body: {
            type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
            contents: [
              { type: 'text', text: copy.group_share_badge || 'ทีมนี้เป็นสาย', size: 'xxs', weight: 'bold', color: '#E8354F' },
              { type: 'text', text: archetype?.title || copy.group_fallback_title || 'ผลกลุ่ม', weight: 'bold', size: 'xxl', color: '#1C1A17', wrap: true },
              { type: 'text', text: survivalText || (copy.group_pending_survival || 'รอสมาชิกเพิ่ม'), weight: 'bold', size: '3xl', color: '#E8354F', wrap: true },
              ...(archetype?.body ? [{ type: 'text' as const, text: archetype.body, size: 'sm' as const, color: '#555555', wrap: true }] : []),
              ...fanCardRow,
            ],
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'button', action: { type: 'uri', label: isComplete ? (copy.group_share_cta_complete || 'จัดทีมของคุณเอง') : (copy.group_join_cta || 'มาเข้าทีมนี้'), uri: ctaUrl }, style: 'primary', color: '#E8354F' }],
          },
        },
      }]);
      // Unlock symbol after successful share
      setHasShared(true);
      const shareRes = await api<{ symbolCode: string | null }>('POST', `/api/group/${groupId}/share`).catch(() => ({ symbolCode: null }));
      if (shareRes?.symbolCode) setSymbolUnlocked(shareRes.symbolCode);
    } catch (e: any) {
      setShareError(`error: ${e?.message || String(e)}`);
    }
  };

  const needMoreToChange = view.result?.isLocked ? 0 : Math.max(0, (config.group?.min_members ?? 2) + 2 - memberCount);

  return (
    <div className="screen" style={{ background:'#F7F1E3', overflowY:'auto' }}>
      {/* Top nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 10px', borderBottom:'1.5px solid rgba(28,26,23,.1)', background:'#F7F1E3' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', font:"600 15px 'Bai Jamjuree',sans-serif", color:'#1C1A17', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:17, lineHeight:1 }}>✕</span>
          <span style={{ font:"700 14px 'Bai Jamjuree',sans-serif" }}>{copy.group_page_title || 'ผลกลุ่ม'}</span>
        </button>
        <span style={{ font:"700 12px 'Bai Jamjuree',sans-serif", letterSpacing:'.1em', color:'rgba(28,26,23,.35)' }}>LIFF</span>
      </div>

      {/* Fan cards header */}
      <div style={{ height:220, flexShrink:0, position:'relative', background:'linear-gradient(#FCEFE0,#F7F1E3)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 0 28px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', position:'relative' }}>
          {fanCards.map((url, i) => {
            const n = fanCards.length;
            const angle = n === 1 ? 0 : (i - (n - 1) / 2) * 14;
            const zIdx = i === Math.floor(n / 2) ? 4 : n - Math.abs(i - Math.floor(n / 2));
            const w = n === 1 ? 148 : 118;
            const h = n === 1 ? 208 : 166;
            return (
              <img key={i} src={url} alt="" style={{ width:w, height:h, objectFit:'contain', transform:`rotate(${angle}deg)`, zIndex:zIdx, marginLeft: i > 0 ? -24 : 0, filter:'drop-shadow(3px 5px 0 rgba(28,26,23,.22))', display:'block' }} />
            );
          })}
        </div>
      </div>

      <div style={{ padding:'0 22px 30px', marginTop:-14, position:'relative' }}>
        {/* Group result card */}
        <div style={{ background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'5px 6px 0 #1C1A17' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            {/* Circle badge */}
            <div style={{ width:74, height:74, flexShrink:0, border:'2.5px solid #1C1A17', borderRadius:'50%', overflow:'hidden', background:'#F5E14B', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isComplete && archetype?.image_url
                ? <img src={archetype.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <div style={{ font:"700 9px 'Bai Jamjuree',sans-serif", color:'#1C1A17', textAlign:'center', padding:'0 6px', lineHeight:1.3 }}>{isComplete ? (archetype?.title || '?') : '?'}</div>
              }
            </div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                <span style={{ font:"700 10.5px 'Bai Jamjuree',sans-serif", letterSpacing:'.08em', color:'#E8354F' }}>{copy.group_title || 'ผลกลุ่ม'} · GRP-{groupId.slice(-4).toUpperCase()}</span>
                <span style={{ border:'1.5px solid #1C1A17', padding:'2px 8px', font:"700 10px 'Bai Jamjuree',sans-serif", background:'#F5E14B', flexShrink:0 }}>
                  {view.result?.isLocked ? 'LOCKED' : 'ยังเปลี่ยนได้'}
                </span>
              </div>
              {isComplete ? (
                <div style={{ font:"700 23px/1.25 'Bai Jamjuree',sans-serif", marginTop:5 }}>
                  {archetype?.title || copy.group_fallback_title || '—'}
                </div>
              ) : view.createdBy === myUserId ? (
                /* Creator: input ↔ name+pencil toggle */
                nameEditMode ? (
                  <div style={{ marginTop:6, display:'flex', gap:6, alignItems:'center' }}>
                    <input
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="ตั้งชื่อทีม..."
                      maxLength={50}
                      style={{ flex:1, font:"700 16px/1 'Bai Jamjuree',sans-serif", border:'none', borderBottom:'2px solid #1C1A17', background:'transparent', outline:'none', padding:'4px 0', color:'#1C1A17' }}
                    />
                    <button
                      disabled={nameSaving || !groupName.trim()}
                      onClick={handleSaveName}
                      style={{ flexShrink:0, padding:'4px 10px', background:'#1C1A17', color:'#FFFDF6', border:'none', borderRadius:6, font:"700 11px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', opacity: nameSaving ? 0.5 : 1 }}
                    >{nameSaving ? '...' : 'บันทึก'}</button>
                  </div>
                ) : (
                  <div style={{ marginTop:5, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ font:"700 17px/1.25 'Bai Jamjuree',sans-serif", color:'#1C1A17' }}>{view.name}</span>
                    <button
                      onClick={() => setNameEditMode(true)}
                      style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', padding:'2px 3px', color:'rgba(28,26,23,.45)', fontSize:13, lineHeight:1 }}
                      title="แก้ไขชื่อทีม"
                    >✏️</button>
                  </div>
                )
              ) : (
                <div style={{ font:"700 17px/1.25 'Bai Jamjuree',sans-serif", marginTop:5 }}>
                  {view.name || copy.group_pending_title || 'รอทีมครบก่อน'}
                </div>
              )}
            </div>
          </div>
          {archetype?.body && isComplete && (
            <div style={{ font:"500 13px/1.75 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.65)', marginTop:11 }}>{archetype.body}</div>
          )}
          {isComplete ? (
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:13, borderTop:'2px dashed rgba(28,26,23,.2)', paddingTop:12 }}>
              <div>
                <div style={{ font:"600 9.5px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)' }}>{copy.group_survived || 'กลุ่มนี้อยู่รอดได้'}</div>
                <div style={{ font:"700 27px/1.15 'Bai Jamjuree',sans-serif", color: (archetype?.primary_text || view.result?.score != null) ? '#E8354F' : 'rgba(28,26,23,.25)', marginTop:2 }}>
                  {archetype?.primary_text || (view.result?.score != null ? `${view.result.score} ${view.result.scoreUnit || copy.unit_days || 'วัน'}` : '—')}
                </div>
              </div>
              <div style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
                <div style={{ background:'#F5E14B', border:'2px solid #1C1A17', padding:'2px 9px', font:"700 11px 'Bai Jamjuree',sans-serif", transform:'rotate(-1.5deg)', display:'inline-block' }}>{memberCount} คน</div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop:13, borderTop:'2px dashed rgba(28,26,23,.2)', paddingTop:12 }}>
              {/* Progress bar */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ flex:1, height:8, background:'rgba(28,26,23,.1)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.round((memberCount / maxMembers) * 100)}%`, background:'#E8354F', borderRadius:4, transition:'width .4s' }} />
                </div>
                <span style={{ flexShrink:0, font:"700 11px 'Bai Jamjuree',sans-serif", color:'#1C1A17', minWidth:32, textAlign:'right' }}>{memberCount}/{maxMembers}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ font:"500 12px/1.4 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)' }}>อีก {remaining} คน ผลทีมก็เปิด</div>
                <div style={{ background:'#F5E14B', border:'2px solid #1C1A17', padding:'2px 9px', font:"700 11px 'Bai Jamjuree',sans-serif", transform:'rotate(-1.5deg)', display:'inline-block', flexShrink:0 }}>{memberCount} คน</div>
              </div>
            </div>
          )}
        </div>

        {/* Members */}
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', margin:'20px 0 10px' }}>
          <span style={{ font:"700 16px 'Bai Jamjuree',sans-serif" }}>{copy.group_members || 'สมาชิก'}</span>
          <span style={{ font:"600 11px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)' }}>{memberCount} {copy.unit_person || 'คน'}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {members.map(m => {
            const axId = resolveAxis(m.topAxis);
            const card = getAxisCard(axId, config.axes);
            const archName = config.axes?.find(a => a.id === axId)?.label || ARCH[axId]?.th || m.topAxis;
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
                  <span style={{ display:'block', font:"700 13px 'Bai Jamjuree',sans-serif" }}>{memberDisplayName}</span>
                  <span style={{ display:'block', font:"500 10.5px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.5)', marginTop:1 }}>{archName}</span>
                </span>
                {isLoading
                  ? <span style={{ flexShrink:0, font:"500 10px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.4)' }}>โหลด...</span>
                  : canTap
                  ? <span style={{ flexShrink:0, background:'#F5E14B', border:'1.5px solid #1C1A17', padding:'3px 9px', font:"700 10.5px 'Bai Jamjuree',sans-serif" }}>ดูผลคู่ →</span>
                  : <span style={{ flexShrink:0, background:'#F5E14B', border:'1.5px solid #1C1A17', padding:'2px 8px', font:"700 10px 'Bai Jamjuree',sans-serif" }}>คุณ</span>
                }
              </div>
            );
          })}
        </div>

        {/* Axis composition */}
        {(() => {
          const axisCounts: Record<string, number> = {};
          for (const m of members) {
            const axId = resolveAxis(m.topAxis);
            axisCounts[axId] = (axisCounts[axId] ?? 0) + 1;
          }
          const entries = Object.entries(axisCounts).sort((a, b) => b[1] - a[1]);
          return (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
              {entries.map(([axId, count]) => {
                const axLabel = config.axes?.find(a => a.id === axId)?.label || ARCH[axId]?.th || axId;
                return (
                  <span key={axId} style={{ background: '#F5E14B', border: '1.5px solid #1C1A17', borderRadius: 20, padding: '3px 10px', font: "600 11px 'Bai Jamjuree',sans-serif", display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ font: "700 12px 'Bai Jamjuree',sans-serif" }}>{count}</span> {axLabel}
                  </span>
                );
              })}
            </div>
          );
        })()}

        {/* Claim reward button */}
        {(canClaim || claimDone) && (
          <button
            onClick={handleClaim}
            disabled={claiming || claimDone}
            style={{
              width: '100%', marginTop: 16,
              background: claimDone ? 'rgba(28,26,23,.08)' : '#E8354F',
              color: claimDone ? 'rgba(28,26,23,.4)' : '#FFFDF6',
              border: `2.5px solid ${claimDone ? 'rgba(28,26,23,.2)' : '#1C1A17'}`,
              borderRadius: 13, padding: 15,
              font: "700 16px 'Bai Jamjuree',sans-serif",
              cursor: claimDone ? 'default' : 'pointer',
              boxShadow: claimDone ? 'none' : '4px 5px 0 #1C1A17',
              opacity: claiming ? .6 : 1,
            }}
          >
            {claiming ? 'กำลังรับรางวัล...' : claimDone ? (copy.reward_claimed || '✓ รับรางวัลแล้ว') : (copy.group_claim_cta || 'รับรางวัลกลุ่ม')}
          </button>
        )}

        {/* ชวนเพิ่ม button (when not full) */}
        {!view.result?.isLocked && memberCount < (config.group?.max_members ?? 5) && (
          <button
            onClick={handleInviteMore}
            disabled={inviteStatus === 'sending'}
            style={{
              width: '100%', marginTop: 16, padding: '14px 16px',
              background: inviteStatus === 'sent' ? '#22c55e' : inviteStatus === 'error' ? '#E8354F' : '#E8354F',
              color: '#FFFDF6',
              border: '2.5px solid #1C1A17', borderRadius: 13,
              font: "700 15px 'Bai Jamjuree',sans-serif",
              cursor: inviteStatus === 'sending' ? 'default' : 'pointer',
              boxShadow: '4px 5px 0 #1C1A17',
            }}
          >
            {inviteStatus === 'sending' ? 'กำลังส่ง...' : inviteStatus === 'sent' ? '✓ ส่งคำเชิญแล้ว' : inviteStatus === 'error' ? 'ลองใหม่' : (copy.group_invite_cta || `ชวนเพิ่ม · ยังว่างอีก ${(config.group?.max_members ?? 5) - memberCount} คน`)}
          </button>
        )}

        {/* Share + back */}
        <div style={{ display:'flex', gap:9, marginTop:12 }}>
          {isComplete && (
            <button
              onClick={handleShareGroup}
              style={{ flex:1, background: hasShared ? 'rgba(28,26,23,.08)' : '#F5E14B', color: hasShared ? 'rgba(28,26,23,.45)' : '#1C1A17', border:'2.5px solid #1C1A17', borderRadius:13, padding:'14px 10px', font:"700 13px 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow: hasShared ? 'none' : '4px 5px 0 #1C1A17' }}
            >{hasShared ? '✓ ปลดล็อกสัญลักษณ์แล้ว' : 'แชร์ผลลัพท์เพื่อรับสัญลักษณ์'}</button>
          )}
          <button
            onClick={onBack}
            style={{ flexShrink:0, background:'#FFFDF6', color:'#1C1A17', border:'2px solid #1C1A17', borderRadius:13, padding:'14px 18px', font:"600 13px 'Bai Jamjuree',sans-serif", cursor:'pointer', flex: isComplete ? 1 : undefined }}
          >{copy.group_back_solo || 'ผลเดี่ยว'}</button>
        </div>
        {shareError && (
          <div style={{ marginTop:8, padding:'8px 10px', background:'#FEE2E2', border:'1px solid #E8354F', borderRadius:8, font:"500 11px/1.5 'Bai Jamjuree',sans-serif", color:'#991B1B', wordBreak:'break-all' }}>
            {shareError}
          </div>
        )}
      </div>
      {symbolUnlocked && (
        <div style={{ position: 'fixed', bottom: 32, left: 20, right: 20, zIndex: 200, background: '#1C1A17', color: '#F5E14B', borderRadius: 14, padding: '14px 18px', font: "700 14px 'Bai Jamjuree',sans-serif", textAlign: 'center', boxShadow: '0 4px 20px rgba(28,26,23,.35)', animation: 'v2Bob .4s ease' }}>
          🔓 ปลดล็อกสัญลักษณ์แล้ว!
        </div>
      )}
    </div>
  );
}
