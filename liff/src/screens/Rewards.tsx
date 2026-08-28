import { useState, useEffect } from 'react';
import { api } from '../api';
import { ARCH } from '../data';

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

interface GroupArchetype {
  code: string;
  title: string;
  image_url?: string;
}

interface Props {
  pairsDone: number;
  rewardsConfig?: RewardsConfig;
  claims: RewardClaim[];
  onClaim: (milestoneKey: string) => Promise<void>;
  onBack: () => void;
  campaignId: string;
  pairs?: Array<{ partnerName: string; status: string; completedAtIso?: string }>;
  groupArchetypes?: GroupArchetype[];
}

export default function Rewards({ pairsDone, rewardsConfig, claims, onClaim, onBack, campaignId, pairs = [], groupArchetypes = [] }: Props) {
  const pointsPerPair = rewardsConfig?.points_per_pair ?? 50;
  const points = pairsDone * pointsPerPair;
  const milestones = rewardsConfig?.milestones ?? [];
  const completedPairs = pairs.filter(p => p.status === 'completed');

  const [claiming, setClaiming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlockedSymbols, setUnlockedSymbols] = useState<string[]>([]);

  useEffect(() => {
    api<{ unlockedSymbols: string[] }>('GET', `/api/quiz/my-symbols?campaignId=${campaignId}`)
      .then((d) => setUnlockedSymbols(d.unlockedSymbols))
      .catch(() => {});
  }, [campaignId]);

  const totalSymbols = groupArchetypes.length;
  const unlockedCount = unlockedSymbols.length;
  const collectorUnlocked = totalSymbols > 0 && unlockedCount >= totalSymbols;

  const getClaim = (key: string) => claims.find(c => c.milestone_key === key);
  const getCode = (c: RewardClaim) => c.code ?? c.meta?.code ?? null;
  const getPoolType = (c: RewardClaim) => c.pool_type ?? c.meta?.pool_type ?? 'single_code';

  const handleClaim = async (key: string) => {
    if (claiming) return;
    setClaiming(key);
    setError(null);
    try { await onClaim(key); }
    catch (e) { setError((e as Error).message || 'เกิดข้อผิดพลาด'); }
    finally { setClaiming(null); }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); }).catch(() => {});
  };

  const showLegacy = !rewardsConfig?.enabled || milestones.length === 0;
  const unlocked = pairsDone >= 3;
  // Use live card for coupon decoration
  const couponCard = ARCH.live?.card;

  return (
    <div className="screen fade-enter" style={{ background:'#F7F1E3', overflowY:'auto' }}>
      <div style={{ padding:'20px 20px 28px' }}>
        {/* Header */}
        <div style={{ fontFamily:'Bangers,cursive', fontSize:15, letterSpacing:'.1em', color:'#E8354F' }}>SURVIVOR REWARDS</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:9, marginTop:6 }}>
          <div style={{ font:"700 42px/1 'Bai Jamjuree',sans-serif" }}>{points.toLocaleString('en-US')}</div>
          <div style={{ font:"600 12.5px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.5)', paddingBottom:5 }}>แต้มสะสม</div>
        </div>

        {error && (
          <div style={{ marginTop:10, background:'rgba(232,53,79,.1)', border:'1.5px solid #E8354F', borderRadius:8, padding:'9px 12px', font:"500 12px 'Bai Jamjuree',sans-serif", color:'#E8354F' }}>{error}</div>
        )}

        {/* Dynamic milestones */}
        {!showLegacy && milestones.map(m => {
          const claim = getClaim(m.key);
          const progress = Math.min(pairsDone, m.trigger_pairs);
          const met = pairsDone >= m.trigger_pairs;
          const isClaiming = claiming === m.key;
          const claimed = !!claim;
          const code = claim ? getCode(claim) : null;
          const poolType = claim ? getPoolType(claim) : null;

          return (
            <div key={m.key} style={{ marginTop:20, background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'4px 5px 0 #1C1A17' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ font:"700 13.5px 'Bai Jamjuree',sans-serif" }}>{m.icon ? `${m.icon} ` : ''}{m.label}</span>
                <span style={{ fontFamily:'Bangers,cursive', fontSize:17, color:'#E8354F' }}>{pairsDone}/{m.trigger_pairs}</span>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:11 }}>
                {Array.from({ length: m.trigger_pairs }).map((_, i) => (
                  <div key={i} style={{ flex:1, height:8, borderRadius:4, background: i < pairsDone ? '#E8354F' : 'rgba(28,26,23,.12)', transition:'background .3s' }} />
                ))}
              </div>
              {!met && !claimed && (
                <div style={{ font:"500 11.5px/1.6 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)', marginTop:10 }}>อีก {m.trigger_pairs - pairsDone} คู่</div>
              )}
              {met && !claimed && (
                <button
                  onClick={() => handleClaim(m.key)}
                  disabled={!!isClaiming}
                  style={{ width:'100%', marginTop:10, background:isClaiming ? 'rgba(232,53,79,.5)' : '#E8354F', color:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:10, padding:12, font:"700 15px 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'3px 4px 0 #1C1A17' }}
                >{isClaiming ? 'กำลังรับ...' : 'รับรางวัล'}</button>
              )}
              {claimed && claim && (
                <div style={{ marginTop:10 }}>
                  {(poolType === 'code_pool' || poolType === 'single_code' || poolType === 'raffle') && code && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, background:'#F5E14B', border:'2px solid #1C1A17', borderRadius:8, padding:'10px 14px', fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:'.08em' }}>{code}</div>
                      <button onClick={() => handleCopy(code, m.key)} style={{ padding:'10px 13px', background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:8, font:"600 11px 'Bai Jamjuree',sans-serif", cursor:'pointer', whiteSpace:'nowrap' }}>{copied === m.key ? 'คัดลอก ✓' : 'คัดลอก'}</button>
                    </div>
                  )}
                  {poolType === 'voucher_link' && code && (
                    <a href={code} target="_blank" rel="noopener noreferrer" style={{ display:'block', background:'#E8354F', color:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:10, padding:12, textAlign:'center', textDecoration:'none', font:"700 15px 'Bai Jamjuree',sans-serif", boxShadow:'3px 4px 0 #1C1A17', marginTop:4 }}>เปิด Voucher →</a>
                  )}
                  <div style={{ font:"400 10px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.35)', marginTop:8 }}>รับเมื่อ {new Date(claim.issued_at).toLocaleDateString('th-TH')}</div>
                </div>
              )}
            </div>
          );
        })}

        {/* Legacy card */}
        {showLegacy && (
          <>
            <div style={{ marginTop:20, background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'4px 5px 0 #1C1A17' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ font:"700 13.5px 'Bai Jamjuree',sans-serif" }}>ครบ 3 คู่ = ลุ้นรางวัลใหญ่</span>
                <span style={{ fontFamily:'Bangers,cursive', fontSize:17, color:'#E8354F' }}>{pairsDone}/3</span>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:11 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ flex:1, height:8, borderRadius:4, background: i < pairsDone ? '#E8354F' : 'rgba(28,26,23,.12)', transition:'background .3s' }} />
                ))}
              </div>
              <div style={{ font:"500 11.5px/1.6 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)', marginTop:10 }}>
                {unlocked ? 'ครบแล้ว! ติดตามผลรางวัลจากทีมงาน' : `อีก ${3 - pairsDone} คู่ถึงจะลุ้นรางวัล`}
              </div>
            </div>

            <div style={{ marginTop:16, border:'2.5px dashed #1C1A17', borderRadius:16, padding:16, background: unlocked ? '#F5E14B' : 'rgba(28,26,23,.04)', display:'flex', gap:12, alignItems:'center' }}>
              {couponCard && <img src={couponCard} alt="" style={{ width:48, height:58, flexShrink:0, objectFit:'contain' }} />}
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ font:"700 17px 'Bai Jamjuree',sans-serif" }}>ส่วนลด 200.-</div>
                <div style={{ font:"400 11.5px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)', marginTop:3 }}>
                  {unlocked ? 'แสดงหน้าจอนี้แลกรับสิทธิ์ได้เลย' : 'จับคู่ให้ครบ 3 คู่เพื่อรับส่วนลด'}
                </div>
              </div>
              <div style={{ fontFamily:'Bangers,cursive', fontSize:15, letterSpacing:'.05em', color: unlocked ? '#E8354F' : 'rgba(28,26,23,.3)', flexShrink:0 }}>{unlocked ? 'READY' : 'LOCKED'}</div>
            </div>
          </>
        )}

        {/* Points log */}
        {completedPairs.length > 0 && (
          <div style={{ marginTop:14, background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:14, padding:'13px 15px' }}>
            <div style={{ font:"700 10px 'Bai Jamjuree',sans-serif", letterSpacing:'.12em', color:'rgba(28,26,23,.4)', marginBottom:8 }}>POINTS LOG</div>
            {completedPairs.map((p, i) => {
              const dateStr = p.completedAtIso
                ? new Date(p.completedAtIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
                : '';
              return (
                <div key={i} style={{ display:'flex', alignItems:'baseline', gap:9, padding:'6px 0', borderBottom: i < completedPairs.length - 1 ? '1px dashed rgba(28,26,23,.15)' : 'none' }}>
                  {dateStr && <span style={{ font:"600 10px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.4)', width:50, flexShrink:0 }}>{dateStr}</span>}
                  <span style={{ font:"500 12.5px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.7)', flex:1 }}>{p.partnerName}</span>
                  <span style={{ font:"700 12px 'Bai Jamjuree',sans-serif", color:'#E8354F' }}>+{pointsPerPair} pt</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Symbol stamps */}
        {totalSymbols > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: 'Bangers,cursive', fontSize: 15, letterSpacing: '.1em', color: '#E8354F' }}>SYMBOL STAMPS</div>
              <span style={{ font: "600 11px 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.45)' }}>{unlockedCount} / {totalSymbols}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {groupArchetypes.map((arch) => {
                const unlocked = unlockedSymbols.includes(arch.code);
                return (
                  <div key={arch.code} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 70, height: 70, borderRadius: '50%', border: `2px solid ${unlocked ? '#1C1A17' : 'rgba(28,26,23,.12)'}`, background: unlocked ? '#FFFDF6' : '#1C1A17', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {unlocked ? (
                        arch.image_url
                          ? <img src={arch.image_url} alt={arch.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ font: "700 7px 'Bai Jamjuree',sans-serif", color: '#1C1A17', textAlign: 'center', padding: '0 5px', lineHeight: 1.3 }}>{arch.title}</div>
                      ) : (
                        <span style={{ font: "700 14px 'Bai Jamjuree',sans-serif", color: 'rgba(255,255,255,.3)' }}>?</span>
                      )}
                    </div>
                    <span style={{ font: "400 8.5px 'Bai Jamjuree',sans-serif", color: unlocked ? '#1C1A17' : 'rgba(28,26,23,.25)', textAlign: 'center', lineHeight: 1.2, maxWidth: 70 }}>
                      {unlocked ? arch.title : '???'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 9/9 collector set */}
            <div style={{ marginTop: 14, background: collectorUnlocked ? '#F5E14B' : '#FFFDF6', border: `2.5px solid ${collectorUnlocked ? '#1C1A17' : 'rgba(28,26,23,.2)'}`, borderRadius: 14, padding: 15, boxShadow: collectorUnlocked ? '4px 5px 0 #1C1A17' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ font: "700 13.5px 'Bai Jamjuree',sans-serif", color: collectorUnlocked ? '#1C1A17' : 'rgba(28,26,23,.4)' }}>ชุด element สำหรับนักสะสม</div>
                  <div style={{ font: "500 11px 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.5)', marginTop: 2 }}>ปลดล็อกเมื่อครบ {totalSymbols}/{totalSymbols}</div>
                </div>
                <div style={{ fontFamily: 'Bangers,cursive', fontSize: 15, letterSpacing: '.05em', color: collectorUnlocked ? '#E8354F' : 'rgba(28,26,23,.25)' }}>
                  {collectorUnlocked ? 'READY' : 'LOCKED'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { icon: '🎨', label: 'Sticker Pack PNG', sub: '5 ตัวละคร 5 สาย' },
                  { icon: '📱', label: 'Rich Menu Template', sub: 'ติดตั้งใน LINE OA' },
                  { icon: '🏆', label: 'Survival Certificate', sub: 'ใบรับรองผู้รอดชีวิต' },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: collectorUnlocked ? 1 : 0.45 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ font: "600 12.5px 'Bai Jamjuree',sans-serif" }}>{item.label}</div>
                      <div style={{ font: "400 10.5px 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.5)' }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              {collectorUnlocked && (
                <div style={{ marginTop: 12, background: '#E8354F', color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 10, padding: '11px', textAlign: 'center', font: "700 14px 'Bai Jamjuree',sans-serif", boxShadow: '3px 3px 0 #1C1A17' }}>
                  รับชุด element ได้เลย →
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onBack}
          style={{ width:'100%', marginTop:24, padding:'15px 20px', background:'#E8354F', color:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 17px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 5px 0 #1C1A17' }}
        >กลับหน้าสรุป</button>
      </div>
    </div>
  );
}
