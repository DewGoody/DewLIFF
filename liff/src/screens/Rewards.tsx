import { useState } from 'react';

interface RewardClaim {
  id: string;
  milestone_key: string;
  pool_type: string;
  pool_name: string;
  code?: string;
  issued_at: string;
  meta?: { code?: string; pool_type?: string; pool_name?: string };
}

interface RewardMilestone {
  key: string;
  trigger_pairs: number;
  reward_pool_id: string;
  label: string;
  icon?: string;
}

interface RewardsConfig {
  enabled: boolean;
  points_per_pair: number;
  milestones?: RewardMilestone[];
}

interface Props {
  pairsDone: number;
  rewardsConfig?: RewardsConfig;
  claims: RewardClaim[];
  onClaim: (milestoneKey: string) => Promise<void>;
  onBack: () => void;
  campaignId: string;
  pairs?: Array<{ partnerName: string; status: string }>;
}

export default function Rewards({ pairsDone, rewardsConfig, claims, onClaim, onBack, pairs = [] }: Props) {
  const primary = '#D95F2B';
  const pointsPerPair = rewardsConfig?.points_per_pair ?? 50;
  const points = pairsDone * pointsPerPair;
  const milestones = rewardsConfig?.milestones ?? [];
  const completedPairs = pairs.filter((p) => p.status === 'completed');

  const [claiming, setClaiming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getClaimForMilestone = (key: string): RewardClaim | undefined => {
    return claims.find((c) => c.milestone_key === key);
  };

  const getCode = (claim: RewardClaim): string | null => {
    return claim.code ?? claim.meta?.code ?? null;
  };

  const getPoolType = (claim: RewardClaim): string => {
    return claim.pool_type ?? claim.meta?.pool_type ?? 'single_code';
  };

  const handleClaim = async (key: string) => {
    if (claiming) return;
    setClaiming(key);
    setError(null);
    try {
      await onClaim(key);
    } catch (e) {
      setError((e as Error).message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setClaiming(null);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {/* non-critical */});
  };

  // Fallback: if no rewardsConfig milestones, show legacy hardcoded card
  const showLegacy = !rewardsConfig || !rewardsConfig.enabled || milestones.length === 0;
  const unlocked = pairsDone >= 3;

  return (
    <div className="screen fade-enter" style={{ background: '#0C0B0A', overflowY: 'auto' }}>
      <div className="tex" style={{ opacity: .4 }} />

      {/* Header */}
      <div style={{ position: 'relative', padding: '28px 24px 0', flexShrink: 0 }}>
        <div style={{ font: "500 9.5px 'IBM Plex Mono',monospace", letterSpacing: '.2em', color: 'rgba(237,231,223,.38)' }}>SURVIVOR REWARDS</div>
        <div style={{ fontFamily: 'Anton,sans-serif', fontSize: 38, letterSpacing: '.04em', color: '#EDE7DF', marginTop: 6, lineHeight: 1 }}>
          <span style={{ color: primary }}>{points.toLocaleString('en-US')}</span>
          <span style={{ fontSize: 16, letterSpacing: '.12em', marginLeft: 8, verticalAlign: 'middle', color: 'rgba(237,231,223,.55)' }}>แต้มสะสม</span>
        </div>
        <div style={{ font: "300 12px/1.7 'IBM Plex Sans Thai',sans-serif", color: 'rgba(237,231,223,.45)', marginTop: 8 }}>
          +{pointsPerPair} แต้มทุกครั้งที่มีเพื่อนตอบครบและจับคู่กับคุณสำเร็จ
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, padding: '22px 24px 34px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: 'rgba(230,59,46,.12)', border: '1px solid rgba(230,59,46,.4)', padding: '10px 14px', font: "300 12px 'IBM Plex Sans Thai',sans-serif", color: '#EDE7DF' }}>
            {error}
          </div>
        )}

        {/* Dynamic milestones from config */}
        {!showLegacy && milestones.map((m) => {
          const claim = getClaimForMilestone(m.key);
          const progress = Math.min(pairsDone, m.trigger_pairs);
          const met = pairsDone >= m.trigger_pairs;
          const isClaiming = claiming === m.key;
          const claimed = !!claim;

          const poolType = claim ? getPoolType(claim) : null;
          const code = claim ? getCode(claim) : null;

          return (
            <div
              key={m.key}
              style={{
                background: claimed ? 'rgba(217,95,43,.08)' : met ? 'rgba(237,231,223,.04)' : '#15120F',
                border: claimed ? `1px solid rgba(217,95,43,.5)` : met ? '1px solid rgba(237,231,223,.2)' : '1px dashed rgba(237,231,223,.12)',
                padding: 18,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.icon && <span style={{ fontSize: 20 }}>{m.icon}</span>}
                    <div style={{ font: "600 13px 'IBM Plex Sans Thai',sans-serif", color: claimed ? primary : '#EDE7DF' }}>{m.label}</div>
                  </div>
                </div>
                <div style={{ font: "400 10px 'IBM Plex Mono',monospace", color: primary, whiteSpace: 'nowrap', marginLeft: 8 }}>{pairsDone}/{m.trigger_pairs}</div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, borderRadius: 1, background: 'rgba(237,231,223,.1)', marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(progress / m.trigger_pairs) * 100}%`, background: claimed ? primary : met ? 'rgba(237,231,223,.5)' : 'rgba(217,95,43,.5)', transition: 'width .4s' }} />
              </div>

              {/* State: not met */}
              {!met && !claimed && (
                <div style={{ font: "300 11px 'IBM Plex Sans Thai',sans-serif", color: 'rgba(237,231,223,.38)' }}>
                  อีก {m.trigger_pairs - pairsDone} คู่ถึงจะได้รางวัลนี้
                </div>
              )}

              {/* State: met, not claimed */}
              {met && !claimed && (
                <button
                  onClick={() => handleClaim(m.key)}
                  disabled={isClaiming}
                  style={{ width: '100%', marginTop: 4, padding: '12px 0', background: isClaiming ? 'rgba(217,95,43,.3)' : primary, border: 'none', color: '#fff', fontFamily: 'Anton,sans-serif', fontSize: 14, letterSpacing: '.16em', cursor: isClaiming ? 'default' : 'pointer', borderRadius: 1 }}
                >
                  {isClaiming ? 'กำลังรับ...' : 'CLAIM รางวัล'}
                </button>
              )}

              {/* State: claimed — show reward details */}
              {claimed && claim && (
                <div style={{ marginTop: 4 }}>
                  {(poolType === 'code_pool' || poolType === 'raffle' || poolType === 'single_code') && code && (
                    <div>
                      <div style={{ font: "400 9.5px 'IBM Plex Mono',monospace", letterSpacing: '.14em', color: 'rgba(237,231,223,.45)', marginBottom: 8 }}>COUPON CODE</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: '#15120F', border: '1px solid rgba(237,231,223,.15)', padding: '10px 14px', fontFamily: 'Anton,sans-serif', fontSize: 22, letterSpacing: '.08em', color: primary, userSelect: 'all' }}>
                          {code}
                        </div>
                        <button
                          onClick={() => handleCopy(code, m.key)}
                          style={{ padding: '10px 14px', background: copied === m.key ? 'rgba(22,163,74,.15)' : 'rgba(237,231,223,.06)', border: '1px solid rgba(237,231,223,.2)', color: copied === m.key ? '#16A34A' : 'rgba(237,231,223,.7)', cursor: 'pointer', borderRadius: 1, font: "400 11px 'IBM Plex Mono',monospace", letterSpacing: '.1em', whiteSpace: 'nowrap' }}
                        >
                          {copied === m.key ? 'คัดลอกแล้ว ✓' : 'COPY'}
                        </button>
                      </div>
                    </div>
                  )}
                  {poolType === 'voucher_link' && code && (
                    <div>
                      <div style={{ font: "400 9.5px 'IBM Plex Mono',monospace", letterSpacing: '.14em', color: 'rgba(237,231,223,.45)', marginBottom: 8 }}>VOUCHER LINK</div>
                      <a
                        href={code}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '12px 0', background: primary, color: '#fff', textDecoration: 'none', fontFamily: 'Anton,sans-serif', fontSize: 14, letterSpacing: '.16em' }}
                      >
                        เปิด Voucher →
                      </a>
                    </div>
                  )}
                  {poolType === 'points_bonus' && code && (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ fontFamily: 'Anton,sans-serif', fontSize: 36, letterSpacing: '.04em', color: primary }}>+{code}</div>
                      <div style={{ font: "300 12px 'IBM Plex Sans Thai',sans-serif", color: 'rgba(237,231,223,.5)', marginTop: 4 }}>แต้มโบนัสเพิ่ม</div>
                    </div>
                  )}
                  <div style={{ font: "300 10px 'IBM Plex Mono',monospace", color: 'rgba(237,231,223,.3)', marginTop: 10 }}>
                    รับเมื่อ {new Date(claim.issued_at).toLocaleDateString('th-TH')}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Legacy static card (when rewards config is not set or disabled) */}
        {showLegacy && (
          <>
            {/* Mission card */}
            <div style={{ background: '#15120F', border: '1px solid rgba(237,231,223,.12)', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ font: "600 13px 'IBM Plex Sans Thai',sans-serif", color: '#EDE7DF' }}>ครบ 3 คู่ = ลุ้นรางวัลใหญ่</div>
                <div style={{ font: "400 10px 'IBM Plex Mono',monospace", color: primary }}>{pairsDone}/3</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ flex: 1, height: 6, borderRadius: 1, background: i < pairsDone ? primary : 'rgba(237,231,223,.14)', transition: 'background .3s' }} />
                ))}
              </div>
              {pairsDone < 3 && (
                <div style={{ font: "300 11px 'IBM Plex Sans Thai',sans-serif", color: 'rgba(237,231,223,.38)', marginTop: 10 }}>
                  อีก {3 - pairsDone} คู่ถึงจะลุ้นรางวัล
                </div>
              )}
              {pairsDone >= 3 && (
                <div style={{ font: "300 11px 'IBM Plex Sans Thai',sans-serif", color: primary, marginTop: 10 }}>
                  ครบแล้ว! ติดตามผลรางวัลจากทีมงาน
                </div>
              )}
            </div>

            {/* Coupon card */}
            <div style={{ background: unlocked ? 'rgba(217,95,43,.08)' : '#15120F', border: unlocked ? `1px solid rgba(217,95,43,.5)` : '1px dashed rgba(237,231,223,.2)', padding: 18, position: 'relative', overflow: 'hidden' }}>
              {!unlocked && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,11,10,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                  <div style={{ font: "500 10px 'IBM Plex Mono',monospace", letterSpacing: '.18em', color: 'rgba(237,231,223,.4)', border: '1px solid rgba(237,231,223,.2)', padding: '7px 14px' }}>LOCKED · ครบ 3 คู่</div>
                </div>
              )}
              <div style={{ font: "400 9.5px 'IBM Plex Mono',monospace", letterSpacing: '.16em', color: unlocked ? primary : 'rgba(237,231,223,.35)', marginBottom: 8 }}>
                {unlocked ? 'COUPON READY' : 'COUPON LOCKED'}
              </div>
              <div style={{ fontFamily: 'Anton,sans-serif', fontSize: 32, color: unlocked ? '#EDE7DF' : 'rgba(237,231,223,.25)', letterSpacing: '.04em' }}>ส่วนลด 200.-</div>
              <div style={{ font: "300 11px/1.6 'IBM Plex Sans Thai',sans-serif", color: unlocked ? 'rgba(237,231,223,.55)' : 'rgba(237,231,223,.25)', marginTop: 6 }}>
                {unlocked ? 'แสดงหน้าจอนี้แลกรับสิทธิ์ได้เลย' : 'จับคู่ให้ครบ 3 คู่เพื่อรับส่วนลด'}
              </div>
            </div>
          </>
        )}

        {/* Points log */}
        {completedPairs.length > 0 && (
          <div style={{ background: '#15120F', border: '1px solid rgba(237,231,223,.1)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(237,231,223,.1)', font: "500 9.5px 'IBM Plex Mono',monospace", letterSpacing: '.14em', color: 'rgba(237,231,223,.38)' }}>POINTS LOG</div>
            {completedPairs.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < completedPairs.length - 1 ? '1px solid rgba(237,231,223,.08)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#241D18', border: '1px solid rgba(237,231,223,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "600 11px 'IBM Plex Sans Thai',sans-serif", color: 'rgba(237,231,223,.7)' }}>{p.partnerName[0]}</div>
                  <div style={{ font: "400 12.5px 'IBM Plex Sans Thai',sans-serif", color: 'rgba(237,231,223,.7)' }}>{p.partnerName}</div>
                </div>
                <div style={{ font: "600 13px 'IBM Plex Mono',monospace", color: primary }}>+{pointsPerPair} pt</div>
              </div>
            ))}
          </div>
        )}

        {/* Back button */}
        <button onClick={onBack} style={{ width: '100%', marginTop: 8, background: 'none', border: '1px solid rgba(237,231,223,.18)', color: 'rgba(237,231,223,.6)', borderRadius: 2, padding: 14, font: "400 13px 'IBM Plex Sans Thai',sans-serif", cursor: 'pointer' }}>
          ← กลับหน้าสรุป
        </button>
      </div>
    </div>
  );
}
