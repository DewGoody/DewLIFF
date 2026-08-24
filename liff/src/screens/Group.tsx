import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface GroupMember {
  userId: string;
  topAxis: string;
  batchNo: number;
  joinedAt: string;
  reward_claimed?: boolean;
}

interface GroupArchetype {
  code: string;
  title: string;
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
  status: string;
  totalMembers: number;
  currentBatch: number;
  currentBatchMembers: number;
  minMembers: number;
  rewardMembers: number;
  maxMembers: number;
  overflowMode: string;
  batchSize: number | null;
  members: GroupMember[];
  result: GroupResult | null;
  canClaim: boolean;
  createdBy: string;
}

interface Props {
  groupId: string;
  campaignId: string;
  myUserId: string;
  config: {
    brand?: { primary?: string; surface?: string; on_surface?: string };
    copy?: Record<string, string>;
    axes?: { id: string; label: string; label_en?: string; short?: string }[];
    group?: {
      result_mode?: 'score' | 'match';
      overflow_mode?: string;
      batch_size?: number;
    };
    appearance?: { images?: Record<string, string> };
  };
  liffId: string;
  onBack: () => void;
}

export default function Group({ groupId, campaignId, myUserId, config, liffId, onBack }: Props) {
  const [group, setGroup] = useState<GroupView | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  const primary = config.brand?.primary || '#D95F2B';
  const surface = config.brand?.surface || '#0C0B0A';
  const onSurface = config.brand?.on_surface || '#EDE7DF';
  const copy = config.copy || {};
  const axes = config.axes || [];

  const groupLink = `https://liff.line.me/${liffId}?campaignId=${campaignId}&groupId=${groupId}`;

  const load = useCallback(async () => {
    try {
      const data = await api<GroupView>('GET', `/api/group/${groupId}`);
      setGroup(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await api<{ code?: string; message: string }>('POST', `/api/group/${groupId}/claim`);
      setClaimedCode(res.code || 'claimed');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  const handleShare = () => {
    const shareTitle = copy.group_invite_title || 'ชวนเพื่อนมาดูผลกลุ่ม';
    const shareCta = copy.group_invite_cta || 'เข้าร่วมกลุ่ม';
    if (typeof liff !== 'undefined' && liff.isInClient?.()) {
      liff.shareTargetPicker([{
        type: 'flex',
        altText: shareTitle,
        contents: {
          type: 'bubble',
          body: {
            type: 'box', layout: 'vertical', spacing: 'md',
            contents: [
              { type: 'text', text: shareTitle, weight: 'bold', size: 'lg', wrap: true, color: onSurface },
              group?.result?.archetype ? {
                type: 'text',
                text: `กลุ่มนี้: ${group.result.archetype.title}`,
                size: 'sm', wrap: true, color: primary,
              } : { type: 'text', text: `${group?.totalMembers || 1} คนแล้ว`, size: 'sm', color: '#888888' },
              {
                type: 'text',
                text: `${group?.totalMembers || 1}/${group?.rewardMembers || 5} คน`,
                size: 'sm', color: '#888888',
              },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [
              { type: 'button', action: { type: 'uri', label: shareCta, uri: groupLink }, style: 'primary', color: primary },
            ],
          },
        },
      }]).catch(() => {});
    } else {
      navigator.clipboard?.writeText(groupLink).catch(() => {});
    }
  };

  const axisLabel = (axisId: string) => {
    const ax = axes.find(a => a.id === axisId);
    return ax?.label || axisId;
  };

  const axisColor = (axisId: string, idx: number) => {
    const colors = [primary, '#2563EB', '#16A34A', '#9333EA', '#D97706'];
    const axIdx = axes.findIndex(a => a.id === axisId);
    return colors[(axIdx >= 0 ? axIdx : idx) % colors.length];
  };

  const kvGroup = config.appearance?.images?.['kv-group'];

  if (loading) {
    return (
      <div className="screen" style={{ background: surface, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid rgba(237,231,223,.18)`, borderTopColor: primary, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="screen" style={{ background: surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <p style={{ color: `${onSurface}99`, textAlign: 'center', marginBottom: 20 }}>{error || 'โหลดกลุ่มไม่สำเร็จ'}</p>
        <button className="btn-outline" onClick={onBack}>กลับ</button>
      </div>
    );
  }

  const batchProgress = group.overflowMode === 'rolling' && group.batchSize
    ? group.currentBatchMembers
    : group.totalMembers;
  const batchTarget = group.overflowMode === 'rolling' && group.batchSize
    ? group.batchSize
    : group.rewardMembers;
  const progressPct = Math.min(100, (batchProgress / batchTarget) * 100);
  const hasResult = group.result !== null;
  const archetype = group.result?.archetype;
  const isScoreMode = config.group?.result_mode === 'score';
  const myMember = group.members.find(m => m.userId === myUserId);

  return (
    <div className="screen fade-enter" style={{ background: surface, overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ position: 'relative', height: kvGroup ? 180 : 120, flexShrink: 0, background: '#100E0C', overflow: 'hidden' }}>
        <div className="tex" />
        {kvGroup && (
          <img src={kvGroup} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${surface}, transparent 60%)` }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: `${onSurface}88`, fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: `${onSurface}66` }}>GROUP</span>
          <div style={{ width: 24 }} />
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 20 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: '.14em', color: primary, marginBottom: 4 }}>
            {copy.group_eyebrow || 'ผลลัพธ์กลุ่ม'}
          </div>
          <div style={{ font: "700 22px/1.2 'IBM Plex Sans Thai',sans-serif", color: onSurface }}>
            {hasResult && archetype ? archetype.title : (copy.group_waiting_title || 'รอสมาชิกเพิ่ม...')}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 20px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Progress bar */}
        <div style={{ background: '#15120F', border: '1px solid rgba(237,231,223,.08)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, color: onSurface }}>
              {copy.group_progress_label || 'สมาชิกในกลุ่ม'}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: primary, fontWeight: 600 }}>
              {batchProgress}/{batchTarget}
            </span>
          </div>
          <div style={{ height: 6, background: 'rgba(237,231,223,.10)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: primary, borderRadius: 3, transition: 'width .6s ease' }} />
          </div>
          {group.totalMembers < group.rewardMembers && (
            <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11.5, color: `${onSurface}55`, marginTop: 8 }}>
              {(copy.group_locked || 'อีก {n} คนถึงได้รับรางวัล').replace('{n}', String(group.rewardMembers - group.totalMembers))}
            </div>
          )}
          {group.overflowMode === 'rolling' && group.currentBatch > 1 && (
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: '.1em', color: `${onSurface}44`, marginTop: 6 }}>
              BATCH {group.currentBatch}
            </div>
          )}
        </div>

        {/* Result card */}
        {hasResult ? (
          <div style={{ background: '#15120F', border: `1px solid ${primary}33`, borderRadius: 8, overflow: 'hidden' }}>
            {archetype?.image_url && (
              <img src={archetype.image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />
            )}
            <div style={{ padding: '16px 18px' }}>
              {isScoreMode && group.result?.score !== null && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span style={{ font: "700 42px/1 'IBM Plex Sans Thai',sans-serif", color: primary }}>
                    {group.result!.score}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 16, color: `${onSurface}99` }}>
                    {group.result!.scoreUnit || 'วัน'}
                  </span>
                </div>
              )}
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: '.14em', color: primary, marginBottom: 6 }}>
                {copy.group_result_label || 'ผลลัพธ์กลุ่ม'}
                {group.result?.isLocked && (
                  <span style={{ marginLeft: 8, color: `${onSurface}44` }}>· LOCKED</span>
                )}
              </div>
              <div style={{ font: "700 20px/1.25 'IBM Plex Sans Thai',sans-serif", color: onSurface, marginBottom: 10 }}>
                {archetype?.title || '—'}
              </div>
              <div style={{ font: "300 14px/1.75 'IBM Plex Sans Thai',sans-serif", color: `${onSurface}aa` }}>
                {archetype?.body}
              </div>
              {!group.result?.isLocked && group.totalMembers < group.rewardMembers && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: `${primary}14`, borderRadius: 4, fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12, color: `${primary}cc` }}>
                  {copy.group_result_hint || 'ผลอาจเปลี่ยนเมื่อมีสมาชิกเพิ่ม'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: '#15120F', border: '1px solid rgba(237,231,223,.08)', borderRadius: 8, padding: '24px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.12em', color: `${onSurface}44`, marginBottom: 10 }}>
              {copy.group_waiting || `ต้องมีอย่างน้อย ${group.minMembers} คน`}
            </div>
            <div style={{ font: "300 13px/1.7 'IBM Plex Sans Thai',sans-serif", color: `${onSurface}55` }}>
              ชวนเพื่อนมาเพิ่มเพื่อดูผลกลุ่ม
            </div>
          </div>
        )}

        {/* Claimed code */}
        {claimedCode && claimedCode !== 'claimed' && (
          <div style={{ background: '#0E1A0E', border: '1px solid #16A34A44', borderRadius: 8, padding: '16px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.12em', color: '#4ADE80', marginBottom: 8 }}>REWARD CODE</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 700, color: '#4ADE80', letterSpacing: '.08em' }}>
              {claimedCode}
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12, color: '#4ADE8088', marginTop: 6 }}>
              คัดลอกโค้ดนี้ไปใช้ได้เลย
            </div>
          </div>
        )}
        {claimedCode === 'claimed' && (
          <div style={{ background: '#0E1A0E', border: '1px solid #16A34A44', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#4ADE80', fontSize: 18 }}>✓</span>
            <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, color: '#4ADE80' }}>รับรางวัลแล้ว</span>
          </div>
        )}

        {/* Members */}
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.12em', color: `${onSurface}44`, marginBottom: 12 }}>
            MEMBERS — {group.totalMembers} คน
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.members.map((m, i) => {
              const isMe = m.userId === myUserId;
              const color = axisColor(m.topAxis, i);
              return (
                <div key={m.userId} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', background: '#15120F',
                  border: `1px solid ${isMe ? primary + '44' : 'rgba(237,231,223,.07)'}`,
                  borderRadius: 6,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: `${color}22`, border: `1.5px solid ${color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    font: "600 13px 'IBM Plex Sans Thai',sans-serif", color,
                  }}>
                    {isMe ? 'คุณ' : String(i + 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 13, color: isMe ? onSurface : `${onSurface}cc`, fontWeight: isMe ? 600 : 400 }}>
                      {isMe ? 'คุณ' : `สมาชิก ${i + 1}`}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 11, color: `${onSurface}55`, marginTop: 1 }}>
                      {axisLabel(m.topAxis)}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5,
                    letterSpacing: '.08em', padding: '3px 8px', borderRadius: 3,
                    background: `${color}18`, color: color, border: `1px solid ${color}33`,
                  }}>
                    {m.topAxis.toUpperCase()}
                  </div>
                  {group.overflowMode === 'rolling' && (
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: `${onSurface}33` }}>
                      B{m.batchNo}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Axis breakdown */}
        {group.members.length >= group.minMembers && (
          <div style={{ background: '#15120F', border: '1px solid rgba(237,231,223,.07)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: '.12em', color: `${onSurface}44`, marginBottom: 12 }}>
              AXIS BREAKDOWN
            </div>
            {axes.map((ax, i) => {
              const count = group.members.filter(m => m.topAxis === ax.id).length;
              const pct = group.members.length > 0 ? (count / group.members.length) * 100 : 0;
              const color = axisColor(ax.id, i);
              return (
                <div key={ax.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: "'IBM Plex Sans Thai',sans-serif", fontSize: 12, color: count > 0 ? onSurface : `${onSurface}44` }}>
                      {ax.label}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: count > 0 ? color : `${onSurface}33` }}>
                      {count} คน · {Math.round(pct)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(237,231,223,.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '14px 20px 28px',
        background: `linear-gradient(to top, ${surface} 70%, transparent)`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {group.canClaim && !claimedCode && myMember && !myMember.reward_claimed && (
          <button
            className="btn-primary"
            onClick={handleClaim}
            disabled={claiming}
            style={{ background: '#16A34A', borderColor: '#16A34A' }}
          >
            {claiming ? 'กำลังรับรางวัล...' : (copy.group_claim_cta || 'รับรางวัลเลย 🎁')}
          </button>
        )}
        <button className="btn-primary" onClick={handleShare}>
          {copy.group_invite_cta || 'ชวนเพื่อนเข้ากลุ่ม'}
        </button>
        <button className="btn-outline" onClick={onBack} style={{ padding: '10px 0' }}>
          {copy.group_back_cta || 'กลับ'}
        </button>
      </div>
    </div>
  );
}
