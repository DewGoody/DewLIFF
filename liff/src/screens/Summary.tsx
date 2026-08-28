import { useState, useEffect } from 'react';
import { api } from '../api';
import { getAxisCard, ARCH, findAxisId, getBestWorstFor } from '../data';

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
    appearance?: { images?: Record<string, string> };
    group?: { enabled?: boolean };
    axes?: Array<{ id: string; image_url?: string; label?: string; body?: string }>;
    rewards?: { enabled?: boolean; points_per_pair?: number };
  };
  campaignId: string;
  liffId: string;
  myArchetypeLabel: string; myArchetypeBody?: string;
  myArchetypeEn?: string; myArchetypeOrder?: string; myArchetypeShort?: string;
  myArchetype?: string;
  archStats?: { bestPartnerLabel: string; bestSurvival: string; worstPartnerLabel: string; worstSurvival: string };
  pairsDone?: number;
  shareUrl: string; pairs: PairEntry[];
  initialPopup?: PairPopup | null;
  onViewPair: (pairId: string, partnerName: string) => void;
  onGoRewards?: () => void;
  onCreateGroup?: () => void;
  onGoGroup?: (groupId: string) => void;
  onSoloShare?: () => void;
  onRetake?: () => void;
}

export default function Summary({
  config, campaignId, liffId,
  myArchetypeLabel, myArchetypeBody, myArchetypeEn, myArchetypeOrder, myArchetype,
  archStats, pairsDone, pairs, initialPopup, onViewPair, onGoRewards, onCreateGroup, onGoGroup, onSoloShare, onRetake,
}: Props) {
  const [popup, setPopup] = useState<PairPopup | null>(initialPopup ?? null);
  const [soloShareStatus, setSoloShareStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [duoInviteStatus, setDuoInviteStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [teams, setTeams] = useState<MyGroup[] | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const done = pairsDone ?? 0;
  const pointsPerPair = config.rewards?.points_per_pair ?? 50;

  const axisId = myArchetype || findAxisId(myArchetypeLabel) || findAxisId(myArchetypeEn || '') || 'prep';
  const archData = ARCH[axisId];
  const card = getAxisCard(axisId, config.axes);
  const enName = myArchetypeEn || archData?.en || '';
  const thName = myArchetypeLabel || archData?.th || '';
  const desc = myArchetypeBody || archData?.desc || '';

  const stats = archStats || (() => {
    const d = getBestWorstFor(axisId);
    return { bestPartnerLabel: d.bestTh, bestSurvival: d.bestSurvival, worstPartnerLabel: d.worstTh, worstSurvival: d.worstSurvival };
  })();

  const myArchLabel = thName;
  const statusColor = (s: string) => s === 'completed' ? '#1C1A17' : s === 'expired' ? 'rgba(28,26,23,.35)' : '#E8354F';

  const liffBase = `https://liff.line.me/${liffId}`;
  const copy = config.copy || {};

  // Fetch teams if group feature is enabled
  useEffect(() => {
    if (!config.group?.enabled) return;
    setTeamsLoading(true);
    api<{ groups: MyGroup[] }>('GET', `/api/group/my-groups?campaignId=${campaignId}`)
      .then(res => setTeams(res.groups))
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // F-02 — solo share (axis card)
  const handleShareSolo = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    if (!liff.isInClient() || !liffAny.isApiAvailable?.('shareTargetPicker')) return;
    setSoloShareStatus('sending');
    try {
      let myUserId = '';
      try { const p = await liff.getProfile(); myUserId = p.userId; } catch {}
      const axisCardUrl = card;
      const inviteUrl = myUserId
        ? `${liffBase}?campaignId=${campaignId}&inviterId=${myUserId}`
        : `${liffBase}?campaignId=${campaignId}`;
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
              { type: 'button', action: { type: 'uri', label: copy.F02_cta1 || 'เล่นดูว่าคุณสายไหน', uri: campaignUrl }, style: 'primary', color: '#E8354F' },
              { type: 'button', action: { type: 'uri', label: copy.F02_cta2 || 'ดูผลคู่กับฉัน', uri: inviteUrl }, style: 'secondary' },
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

  // F-01 — duo invite (KV hero, inviter link)
  const handleDuoInvite = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    if (!liff.isInClient() || !liffAny.isApiAvailable?.('shareTargetPicker')) return;
    setDuoInviteStatus('sending');
    try {
      let myUserId = '';
      try { const p = await liff.getProfile(); myUserId = p.userId; } catch {}
      const kvImageUrl = config.brand?.kv_image_url || config.appearance?.images?.kv_image_url;
      const inviteUrl = myUserId
        ? `${liffBase}?campaignId=${campaignId}&inviterId=${myUserId}`
        : `${liffBase}?campaignId=${campaignId}`;
      await liffAny.shareTargetPicker([{
        type: 'flex',
        altText: (copy.F01_alt || 'มาดูว่าถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน').slice(0, 400),
        contents: {
          type: 'bubble', size: 'mega',
          hero: kvImageUrl ? { type: 'image', url: kvImageUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } : undefined,
          body: {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', paddingAll: '4px', backgroundColor: '#F5E14B', cornerRadius: '4px', width: '80px', contents: [{ type: 'text', text: copy.F01_eyebrow || 'คำเชิญ!', size: 'xs', weight: 'bold', color: '#1C1A17', align: 'center' }] },
              { type: 'text', text: copy.F01_title || 'มาดูว่าถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน!', weight: 'bold', size: 'lg', color: '#1C1A17', wrap: true, margin: 'sm' },
              { type: 'text', text: copy.F01_body ? copy.F01_body.replace('{name}', thName) : `${thName} ชวนคุณมาตอบ 6 ข้อ ไม่ถึงนาที`, size: 'sm', color: '#555555', wrap: true, margin: 'sm' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'button', action: { type: 'uri', label: copy.F01_cta || 'จับคู่กับฉันเลย!', uri: inviteUrl }, style: 'primary', color: '#E8354F' }],
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

  return (
    <>
      {/* Pair popup */}
      {popup && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,26,23,.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="fade-enter" style={{ width:'100%', maxWidth:340, background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, boxShadow:'4px 5px 0 #1C1A17', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'2px solid #1C1A17', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F5E14B' }}>
              <span style={{ font:"700 11px/1.5 'Bai Jamjuree',sans-serif", letterSpacing:'.08em' }}>ผลคู่สำเร็จ</span>
              <span onClick={() => setPopup(null)} style={{ fontSize:18, color:'#1C1A17', cursor:'pointer', lineHeight:1 }}>✕</span>
            </div>
            <div style={{ padding:'20px 20px 24px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
              {popup.imageUrl && <img src={popup.imageUrl} alt="" style={{ width:'100%', height:112, objectFit:'cover', borderRadius:8, marginBottom:16, border:'2px solid #1C1A17' }} />}
              <div style={{ font:"500 11px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)' }}>{popup.partnerName || 'คู่หู'} × คุณ</div>
              <div style={{ marginTop:8, font:"700 22px/1.2 'Bai Jamjuree',sans-serif", color:'#E8354F' }}>{popup.title}</div>
              <div style={{ margin:'10px 0 16px', font:"500 13px/1.6 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.65)' }}>{popup.body}</div>
              {popup.pairId && (
                <button
                  onClick={() => { const pid = popup.pairId!; const pname = popup.partnerName || 'คู่หู'; setPopup(null); onViewPair(pid, pname); }}
                  style={{ width:'100%', padding:'13px 16px', background:'#E8354F', color:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:12, font:"700 14px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'3px 4px 0 #1C1A17', marginBottom:8 }}
                >ดูผลคู่แบบเต็ม</button>
              )}
              <button onClick={() => setPopup(null)} style={{ background:'none', border:'none', color:'rgba(28,26,23,.4)', font:"600 11px/1.5 'Bai Jamjuree',sans-serif", cursor:'pointer', padding:6 }}>ดูผลของฉันก่อน</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite bottom sheet */}
      {inviteSheetOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,26,23,.5)', zIndex:150 }} onClick={() => setInviteSheetOpen(false)}>
          <div
            style={{ position:'absolute', bottom:0, left:0, right:0, background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:'16px 16px 0 0', padding:'20px 20px 36px', boxShadow:'0 -4px 0 #1C1A17' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <span style={{ fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:'.05em' }}>เชิญเพื่อน</span>
              <span onClick={() => setInviteSheetOpen(false)} style={{ fontSize:18, color:'rgba(28,26,23,.45)', cursor:'pointer' }}>✕</span>
            </div>
            {/* F-01 duo invite */}
            <button
              onClick={handleDuoInvite}
              disabled={duoInviteStatus === 'sending'}
              style={{ width:'100%', padding:'14px 16px', background: duoInviteStatus === 'sent' ? '#22c55e' : '#E8354F', color:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 14px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 4px 0 #1C1A17', display:'flex', alignItems:'center', gap:12, marginBottom:10, textAlign:'left' }}
            >
              <span style={{ width:36, height:36, borderRadius:8, background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>👥</span>
              <span style={{ flex:1 }}>
                <span style={{ display:'block' }}>{duoInviteStatus === 'sent' ? '✓ ส่งแล้ว!' : duoInviteStatus === 'sending' ? 'กำลังส่ง...' : (copy.invite_duo_label || 'จับคู่ 1:1')}</span>
                <span style={{ display:'block', font:"500 11px/1.5 'Bai Jamjuree',sans-serif", opacity:.8, marginTop:3 }}>{copy.invite_duo_sub || 'ส่งลิงก์เชิญมาดูผลคู่กับฉัน'}</span>
              </span>
            </button>
            {/* Create team */}
            {config.group?.enabled && onCreateGroup && (
              <button
                onClick={() => { setInviteSheetOpen(false); onCreateGroup(); }}
                style={{ width:'100%', padding:'14px 16px', background:'#F5E14B', color:'#1C1A17', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 14px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 4px 0 #1C1A17', display:'flex', alignItems:'center', gap:12, textAlign:'left' }}
              >
                <span style={{ width:36, height:36, borderRadius:8, background:'rgba(28,26,23,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>🏕</span>
                <span style={{ flex:1 }}>
                  <span style={{ display:'block' }}>{copy.invite_team_label || 'สร้างทีมวันสิ้นโลก'}</span>
                  <span style={{ display:'block', font:"500 11px/1.5 'Bai Jamjuree',sans-serif", opacity:.7, marginTop:3 }}>{copy.invite_team_sub || 'รวม 5 คน ดูผลทีมรอดโลก'}</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="screen" style={{ background:'#F7F1E3', opacity: popup ? .35 : 1, transition:'opacity .2s', overflowY:'auto' }}>
        <div style={{ padding:'20px 20px 28px' }}>
          {/* SURVIVOR CARD */}
          <div style={{ background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'4px 5px 0 #1C1A17' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ font:"700 10px/1.5 'Bai Jamjuree',sans-serif", letterSpacing:'.12em', color:'rgba(28,26,23,.4)' }}>SURVIVOR CARD{myArchetypeOrder ? ` · NO.${myArchetypeOrder}` : ''}</span>
              <span style={{ background:'#F5E14B', border:'1.5px solid #1C1A17', padding:'1px 7px', font:"700 9.5px 'Bai Jamjuree',sans-serif" }}>VALID</span>
            </div>
            <div style={{ display:'flex', gap:14, marginTop:12, alignItems:'center' }}>
              <img src={card} alt="" style={{ width:92, height:118, flexShrink:0, objectFit:'contain' }} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:'.04em', color:'#E8354F', lineHeight:1.05 }}>{enName}</div>
                <div style={{ font:"700 18px/1.35 'Bai Jamjuree',sans-serif", marginTop:4 }}>{thName}</div>
                <div style={{ font:"400 12px/1.6 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.6)', marginTop:6 }}>{desc}</div>
              </div>
            </div>
            {/* Stats */}
            {(stats.bestPartnerLabel || stats.worstPartnerLabel) && (
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12, borderTop:'2px dashed rgba(28,26,23,.2)', paddingTop:12 }}>
                {stats.bestPartnerLabel && (
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <span style={{ font:"600 10.5px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)', width:108, flexShrink:0 }}>คู่ที่รอดนานสุด</span>
                    <span style={{ font:"700 12px/1.5 'Bai Jamjuree',sans-serif" }}>{stats.bestPartnerLabel} · {stats.bestSurvival}</span>
                  </div>
                )}
                {stats.worstPartnerLabel && (
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <span style={{ font:"600 10.5px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)', width:108, flexShrink:0 }}>{copy.stat_worst_label || 'คู่ที่ไม่ควรเจอ'}</span>
                    <span style={{ font:"700 12px/1.5 'Bai Jamjuree',sans-serif" }}>{stats.worstPartnerLabel} · {stats.worstSurvival}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Retake button */}
          {onRetake && (
            <button
              onClick={onRetake}
              style={{ background:'none', border:'none', font:"600 11px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.4)', cursor:'pointer', padding:'4px 0', marginTop:4 }}
            >↺ ตอบแบบทดสอบใหม่</button>
          )}

          {/* CTA row — [แชร์ผล] + [เชิญเพื่อน▾] */}
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button
              onClick={onSoloShare ?? handleShareSolo}
              disabled={soloShareStatus === 'sending'}
              style={{
                flex:1, padding:'13px 14px',
                background: soloShareStatus === 'sent' ? '#22c55e' : soloShareStatus === 'error' ? '#E8354F' : '#FFFDF6',
                color: soloShareStatus === 'sent' || soloShareStatus === 'error' ? '#fff' : '#1C1A17',
                border:'2px solid #1C1A17', borderRadius:12,
                font:"600 13px/1 'Bai Jamjuree',sans-serif", cursor:'pointer',
              }}
            >
              {soloShareStatus === 'sent' ? '✓ แชร์แล้ว!' : soloShareStatus === 'error' ? 'เกิดข้อผิดพลาด' : soloShareStatus === 'sending' ? 'กำลังส่ง...' : (copy.share_btn || '↗ แชร์ผล')}
            </button>
            <button
              onClick={() => setInviteSheetOpen(true)}
              style={{ flex:1, padding:'13px 14px', background:'#E8354F', color:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:12, font:"700 13px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'3px 3px 0 #1C1A17' }}
            >
              {copy.invite_btn || 'เชิญเพื่อน ▾'}
            </button>
          </div>

          {/* TEAMS section */}
          {config.group?.enabled && (
            <div style={{ marginTop:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:'.05em' }}>ทีมของฉัน</span>
                {teams && teams.length > 0 && onCreateGroup && (
                  <button
                    onClick={() => onCreateGroup?.()}
                    style={{ background:'none', border:'none', font:"700 12px/1.5 'Bai Jamjuree',sans-serif", color:'#E8354F', cursor:'pointer', padding:'4px 0' }}
                  >+ สร้างทีมใหม่</button>
                )}
              </div>
              {teamsLoading ? (
                <div style={{ padding:'18px 0', textAlign:'center', color:'rgba(28,26,23,.35)', font:"500 13px 'Bai Jamjuree',sans-serif" }}>กำลังโหลด...</div>
              ) : teams && teams.length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {teams.map(t => (
                    <div key={t.groupId} style={{ background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'2px 3px 0 #1C1A17' }}>
                      {/* Progress dots */}
                      <div style={{ display:'flex', gap:4, flexShrink:0, flexWrap:'wrap', maxWidth:60 }}>
                        {Array.from({ length: t.maxMembers }).map((_, i) => (
                          <div key={i} style={{ width:8, height:8, borderRadius:'50%', background: i < t.memberCount ? '#E8354F' : 'rgba(28,26,23,.15)', border:'1.5px solid rgba(28,26,23,.2)' }} />
                        ))}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ font:"700 13px/1.3 'Bai Jamjuree',sans-serif", color:'#1C1A17' }}>
                          {t.isFull ? (t.archTitle || '?') : `${t.memberCount}/${t.maxMembers} คน`}
                        </div>
                        <div style={{ font:"500 11px/1.4 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)', marginTop:2 }}>
                          {t.isFull && t.primaryText ? `รอดได้ ${t.primaryText}` : !t.isFull ? `รอสมาชิกอีก ${t.maxMembers - t.memberCount} คน` : ''}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button
                          onClick={() => onGoGroup?.(t.groupId)}
                          style={{ padding:'8px 12px', background:'#1C1A17', color:'#FFFDF6', border:'none', borderRadius:8, font:"600 11px/1 'Bai Jamjuree',sans-serif", cursor:'pointer' }}
                        >{t.isFull ? 'ดูผล' : 'ดูทีม'}</button>
                        <button
                          disabled={leavingGroupId === t.groupId}
                          onClick={async () => {
                            if (!confirm('ออกจากทีมนี้?')) return;
                            setLeavingGroupId(t.groupId);
                            try {
                              await api('DELETE', `/api/group/${t.groupId}/leave`);
                              setTeams(prev => prev?.filter(g => g.groupId !== t.groupId) ?? null);
                            } finally {
                              setLeavingGroupId(null);
                            }
                          }}
                          style={{ padding:'8px 10px', background:'none', color:'rgba(28,26,23,.45)', border:'1.5px solid rgba(28,26,23,.2)', borderRadius:8, font:"600 11px/1 'Bai Jamjuree',sans-serif", cursor:'pointer' }}
                        >ออก</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background:'rgba(28,26,23,.04)', border:'2px dashed rgba(28,26,23,.18)', borderRadius:12, padding:'20px 16px', textAlign:'center' }}>
                  <div style={{ font:"700 14px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.6)' }}>ยังไม่มีทีม</div>
                  <div style={{ font:"500 12px/1.6 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.4)', marginTop:4 }}>รวม 5 คน ดูผลทีมวันสิ้นโลก</div>
                  {onCreateGroup && (
                    <button
                      onClick={() => onCreateGroup?.()}
                      style={{ marginTop:12, padding:'10px 18px', background:'#F5E14B', color:'#1C1A17', border:'2px solid #1C1A17', borderRadius:10, font:"700 13px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'2px 3px 0 #1C1A17' }}
                    >{copy.group_cta || 'สร้างทีมวันสิ้นโลก'}</button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PAIR LOG */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'24px 0 12px' }}>
            <span style={{ fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:'.05em' }}>PAIR LOG</span>
            <span style={{ font:"700 11px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)' }}>{pairs.length} คู่</span>
          </div>

          {pairs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 16px', color:'rgba(28,26,23,.4)' }}>
              <div style={{ font:"600 14px/1.5 'Bai Jamjuree',sans-serif" }}>ยังไม่มีคู่</div>
              <div style={{ font:"400 12px/1.7 'Bai Jamjuree',sans-serif", marginTop:4 }}>กด "เชิญเพื่อน" เพื่อชวนเพื่อนมาจับคู่</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {pairs.map(p => {
                const partnerAxisId = findAxisId(p.partnerAxisLabel || '') || undefined;
                const partnerCard = partnerAxisId ? getAxisCard(partnerAxisId, config.axes) : undefined;
                const verdict = p.status === 'waiting' ? 'รอคู่หู...' : p.status === 'expired' ? 'หมดเวลา' : p.resultTitle || 'ดูผล';
                return (
                  <button
                    key={p.pairId}
                    onClick={() => p.status === 'completed' && onViewPair(p.pairId, p.partnerName)}
                    style={{ display:'flex', alignItems:'center', gap:10, background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:12, padding:'10px 12px', cursor: p.status === 'completed' ? 'pointer' : 'default', boxShadow:'2px 3px 0 #1C1A17' }}
                  >
                    {partnerCard ? (
                      <span style={{ backgroundImage:`url('${partnerCard}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:38, height:52, flexShrink:0, display:'block' }} />
                    ) : (
                      <span style={{ width:38, height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(28,26,23,.08)', borderRadius:6, font:"700 14px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.35)' }}>{p.partnerName[0]}</span>
                    )}
                    <span style={{ minWidth:0, textAlign:'left', flex:1 }}>
                      <span style={{ display:'block', font:"700 13px/1.4 'Bai Jamjuree',sans-serif" }}>{p.partnerName}</span>
                      <span style={{ display:'block', font:"400 10.5px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.5)', marginTop:2 }}>
                        {p.partnerAxisLabel ? `${myArchLabel} × ${p.partnerAxisLabel}` : myArchLabel}
                      </span>
                    </span>
                    <span style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
                      <span style={{ display:'block', font:"700 13px/1.4 'Bai Jamjuree',sans-serif", color: statusColor(p.status) }}>{verdict}</span>
                      {(p.completedAtIso || p.completedAt) && <span style={{ display:'block', font:"500 9.5px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.35)', marginTop:2 }}>{fmtDate(p.completedAtIso) || p.completedAt}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {onGoRewards && (
            <button
              onClick={onGoRewards}
              style={{ width:'100%', marginTop:16, padding:'13px 16px', background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:13, font:"600 14px/1 'Bai Jamjuree',sans-serif", cursor:'pointer' }}
            >ดูสิทธิ์ / แต้มสะสม · {done * pointsPerPair} pt</button>
          )}
        </div>
      </div>
    </>
  );
}
