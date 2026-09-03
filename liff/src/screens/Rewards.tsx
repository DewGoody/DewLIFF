import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RewardPool {
  id: string;
  name: string;
  type: string; // code_pool | single_code | physical | webhook | voucher_link | raffle
  gives: string; // reward | entitlement
  status: string;
}

interface TriggerClaim {
  id: string;
  status: string; // issued | claimed | redeemed | expired
  delivery_mode?: string;
  delivery_status?: string;
  tracking_number?: string;
  address?: {
    name: string;
    phone: string;
    address_line: string;
    district?: string;
    province: string;
    postal_code: string;
  };
  issued_at: string;
  expires_at?: string;
  meta?: { code?: string; pool_type?: string; pool_name?: string };
  reward_codes?: { code: string };
}

interface RewardTrigger {
  trigger_id: string;
  trigger_type: string; // quiz_complete | pair_milestone | group_complete | checkin | push
  condition: Record<string, unknown>;
  units_granted: number;
  label: string | null;
  pool: RewardPool | null;
  claim: TriggerClaim | null;
}

interface GroupArchetype {
  code: string;
  title: string;
  image_url?: string;
}

interface Props {
  campaignId: string;
  pairsDone: number;
  onBack: () => void;
  copy?: Record<string, string>;
  groupArchetypes?: GroupArchetype[];
}

// ── Progress helpers ───────────────────────────────────────────────────────────

function TriggerProgress({ trigger, pairsDone }: { trigger: RewardTrigger; pairsDone: number }) {
  const { trigger_type, condition } = trigger;

  if (trigger_type === 'pair_milestone') {
    const required = (condition.pairs_required as number) ?? 1;
    const progress = Math.min(pairsDone, required);
    const met = pairsDone >= required;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: Math.min(required, 10) }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 7, borderRadius: 4,
                background: i < progress ? 'var(--accent, #E8354F)' : 'rgba(28,26,23,.12)',
                transition: 'background .3s',
              }}
            />
          ))}
        </div>
        {!met && (
          <div style={{ font: "500 11px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.5)', marginTop: 6 }}>
            อีก {required - pairsDone} คู่
          </div>
        )}
      </div>
    );
  }

  if (trigger_type === 'quiz_complete') {
    return (
      <div style={{ marginTop: 8, font: "500 11px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.5)' }}>
        ✓ ทำแบบทดสอบครบแล้ว
      </div>
    );
  }

  if (trigger_type === 'group_complete') {
    return (
      <div style={{ marginTop: 8, font: "500 11px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.5)' }}>
        ทีมครบ 5 คน → ได้รับสิทธิ์
      </div>
    );
  }

  return null;
}

function conditionMet(trigger: RewardTrigger, pairsDone: number): boolean {
  const { trigger_type, condition } = trigger;
  if (trigger_type === 'pair_milestone') {
    return pairsDone >= ((condition.pairs_required as number) ?? 1);
  }
  if (trigger_type === 'quiz_complete') return true; // on summary = quiz done
  return true; // server validates the rest
}

// ── Reward display after claimed ──────────────────────────────────────────────

function ClaimResult({
  claim,
  pool,
  onAddressSubmit,
  onRedeem,
  copy,
}: {
  claim: TriggerClaim;
  pool: RewardPool;
  onAddressSubmit: (addr: Record<string, string>) => Promise<void>;
  onRedeem: () => Promise<void>;
  copy?: Record<string, string>;
}) {
  const code = claim.reward_codes?.code ?? claim.meta?.code ?? null;
  const [showAddressForm, setShowAddressForm] = useState(!claim.address && pool.type === 'physical');
  const [addr, setAddr] = useState({ name: '', phone: '', address_line: '', district: '', province: '', postal_code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [addrError, setAddrError] = useState('');

  const handleAddrSubmit = async () => {
    if (!addr.name || !addr.phone || !addr.address_line || !addr.province || !addr.postal_code) {
      setAddrError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    setSubmitting(true);
    setAddrError('');
    try { await onAddressSubmit(addr); setShowAddressForm(false); }
    catch (e) { setAddrError((e as Error).message || 'เกิดข้อผิดพลาด'); }
    finally { setSubmitting(false); }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    try { await onRedeem(); }
    catch {}
    finally { setRedeeming(false); }
  };

  // Code types
  if ((pool.type === 'code_pool' || pool.type === 'single_code' || pool.type === 'raffle') && code) {
    const [copied, setCopied] = useState(false);
    const copy_ = () => {
      navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
    };
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, background: '#F5E14B', border: '2px solid #1C1A17', borderRadius: 8, padding: '10px 14px', fontFamily: 'Bangers, cursive', fontSize: 22, letterSpacing: '.08em' }}>{code}</div>
          <button
            onClick={copy_}
            style={{ padding: '10px 13px', background: '#FFFDF6', border: '2px solid #1C1A17', borderRadius: 8, font: "600 11px var(--font-body,'Bai Jamjuree'),sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' }}
          >{copied ? '✓ คัดลอก' : copy?.copy_link_btn || 'คัดลอก'}</button>
        </div>
        {claim.status !== 'redeemed' && (
          <button
            onClick={handleRedeem}
            disabled={redeeming}
            style={{ width: '100%', marginTop: 8, padding: '10px', background: redeeming ? 'rgba(28,26,23,.06)' : 'transparent', border: '1.5px solid rgba(28,26,23,.2)', borderRadius: 8, font: "600 12px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.6)', cursor: 'pointer' }}
          >{redeeming ? 'กำลังยืนยัน...' : 'ยืนยันใช้แล้ว (onsite)'}</button>
        )}
        {claim.status === 'redeemed' && (
          <div style={{ font: "500 10px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.4)', marginTop: 6 }}>✓ ใช้แล้ว</div>
        )}
        <div style={{ font: "400 10px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.35)', marginTop: 6 }}>
          รับเมื่อ {new Date(claim.issued_at).toLocaleDateString('th-TH')}
          {claim.expires_at && ` · หมดอายุ ${new Date(claim.expires_at).toLocaleDateString('th-TH')}`}
        </div>
      </div>
    );
  }

  // Voucher link
  if (pool.type === 'voucher_link' && code) {
    return (
      <div style={{ marginTop: 10 }}>
        <a href={code} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: 'var(--accent, #E8354F)', color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 10, padding: 12, textAlign: 'center', textDecoration: 'none', font: "700 15px var(--font-body,'Bai Jamjuree'),sans-serif", boxShadow: '3px 4px 0 #1C1A17' }}>
          เปิด Voucher →
        </a>
        <div style={{ font: "400 10px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.35)', marginTop: 6 }}>รับเมื่อ {new Date(claim.issued_at).toLocaleDateString('th-TH')}</div>
      </div>
    );
  }

  // Webhook
  if (pool.type === 'webhook') {
    return (
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✓</div>
        <div style={{ font: "600 12px var(--font-body,'Bai Jamjuree'),sans-serif", color: '#1C1A17' }}>ส่งสิทธิ์ไปยังระบบปลายทางแล้ว</div>
      </div>
    );
  }

  // Physical delivery
  if (pool.type === 'physical') {
    if (showAddressForm) {
      return (
        <div style={{ marginTop: 12, background: '#F7F1E3', border: '1.5px solid rgba(28,26,23,.15)', borderRadius: 12, padding: 14 }}>
          <div style={{ font: "700 12px var(--font-body,'Bai Jamjuree'),sans-serif", marginBottom: 10 }}>กรอกที่อยู่จัดส่ง</div>
          {(['name', 'phone', 'address_line', 'district', 'province', 'postal_code'] as const).map((field) => {
            const labels: Record<string, string> = { name: 'ชื่อ-นามสกุล', phone: 'เบอร์โทร', address_line: 'ที่อยู่', district: 'แขวง/ตำบล', province: 'จังหวัด', postal_code: 'รหัสไปรษณีย์' };
            return (
              <div key={field} style={{ marginBottom: 8 }}>
                <div style={{ font: "600 10px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.5)', marginBottom: 3 }}>{labels[field]}</div>
                <input
                  value={addr[field]}
                  onChange={(e) => setAddr((a) => ({ ...a, [field]: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1.5px solid rgba(28,26,23,.2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#FFFDF6', outline: 'none' }}
                />
              </div>
            );
          })}
          {addrError && <div style={{ font: "500 11px var(--font-body,'Bai Jamjuree'),sans-serif", color: '#E8354F', marginBottom: 8 }}>{addrError}</div>}
          <button
            onClick={handleAddrSubmit}
            disabled={submitting}
            style={{ width: '100%', padding: '11px', background: submitting ? 'rgba(28,26,23,.15)' : '#1C1A17', color: '#FFFDF6', border: 'none', borderRadius: 9, font: "700 13px var(--font-body,'Bai Jamjuree'),sans-serif", cursor: 'pointer' }}
          >{submitting ? 'กำลังบันทึก...' : 'บันทึกที่อยู่'}</button>
        </div>
      );
    }

    const statusLabel: Record<string, string> = {
      pending: '⏳ รอ admin ตรวจสอบ',
      approved: '✓ อนุมัติแล้ว รอจัดส่ง',
      shipped: '📦 จัดส่งแล้ว',
      delivered: '✅ ได้รับของแล้ว',
    };

    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ background: '#F5E14B', border: '2px solid #1C1A17', borderRadius: 9, padding: '10px 12px' }}>
          <div style={{ font: "700 11.5px var(--font-body,'Bai Jamjuree'),sans-serif" }}>
            {statusLabel[claim.delivery_status || 'pending'] || '⏳ รอดำเนินการ'}
          </div>
          {claim.tracking_number && (
            <div style={{ font: "500 10.5px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.6)', marginTop: 3 }}>
              เลขพัสดุ: {claim.tracking_number}
            </div>
          )}
          {claim.address && (
            <div style={{ font: "400 10px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.5)', marginTop: 4 }}>
              {claim.address.name} · {claim.address.province}
            </div>
          )}
        </div>
        <div style={{ font: "400 10px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.35)', marginTop: 5 }}>
          รับเมื่อ {new Date(claim.issued_at).toLocaleDateString('th-TH')}
        </div>
      </div>
    );
  }

  // Manual claim pending
  return (
    <div style={{ marginTop: 10, background: 'rgba(28,26,23,.04)', border: '1.5px solid rgba(28,26,23,.12)', borderRadius: 9, padding: '10px 12px', font: "500 11.5px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.6)' }}>
      ⏳ อยู่ระหว่างรอ admin ดำเนินการ
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Rewards({ campaignId, pairsDone, onBack, copy = {}, groupArchetypes = [] }: Props) {
  const [triggers, setTriggers] = useState<RewardTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null); // trigger_id
  const [claimError, setClaimError] = useState<string | null>(null);
  const [unlockedSymbols, setUnlockedSymbols] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ rewards: RewardTrigger[] }>('GET', `/api/campaign/${campaignId}/rewards`);
      setTriggers(data.rewards || []);
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api<{ unlockedSymbols: string[] }>('GET', `/api/quiz/my-symbols?campaignId=${campaignId}`)
      .then((d) => setUnlockedSymbols(d.unlockedSymbols))
      .catch(() => {});
  }, [campaignId]);

  const handleClaim = async (triggerId: string) => {
    if (claiming) return;
    setClaiming(triggerId);
    setClaimError(null);
    try {
      await api('POST', '/api/quiz/rewards/claim', { campaign_id: campaignId, trigger_id: triggerId });
      await load(); // refresh to show reward
    } catch (e) {
      setClaimError((e as Error).message || 'เกิดข้อผิดพลาด');
    } finally {
      setClaiming(null);
    }
  };

  const handleAddressSubmit = async (claimId: string, addr: Record<string, string>) => {
    await api('POST', `/api/quiz/rewards/claims/${claimId}/address`, addr);
    await load();
  };

  const handleRedeem = async (claimId: string) => {
    await api('POST', `/api/quiz/rewards/claims/${claimId}/redeem`, {});
    await load();
  };

  const totalSymbols = groupArchetypes.length;
  const unlockedCount = unlockedSymbols.length;

  const hasRewards = triggers.length > 0;

  return (
    <div className="screen fade-enter" style={{ background: 'var(--surface, #F7F1E3)', overflowY: 'auto' }}>
      <div style={{ padding: '20px 20px 32px' }}>

        {/* Header */}
        <div style={{ fontFamily: "var(--font-display,'Bangers'),cursive", fontSize: 15, letterSpacing: '.1em', color: 'var(--accent, #E8354F)' }}>
          {copy.rewards_eyebrow || 'REWARDS'}
        </div>
        <div style={{ font: "700 28px/1.1 var(--font-body,'Bai Jamjuree'),sans-serif", marginTop: 4 }}>
          {copy.rewards_title || 'รางวัลของฉัน'}
        </div>

        {claimError && (
          <div style={{ marginTop: 10, background: 'rgba(232,53,79,.1)', border: '1.5px solid #E8354F', borderRadius: 8, padding: '9px 12px', font: "500 12px var(--font-body,'Bai Jamjuree'),sans-serif", color: '#E8354F' }}>
            {claimError}
          </div>
        )}

        {/* Trigger cards */}
        {loading ? (
          <div style={{ marginTop: 32, textAlign: 'center', font: "500 13px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.4)' }}>
            กำลังโหลด...
          </div>
        ) : !hasRewards ? (
          <div style={{ marginTop: 32, textAlign: 'center', font: "500 13px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.4)' }}>
            {copy.rewards_empty || 'แคมเปญนี้ยังไม่มีรางวัล'}
          </div>
        ) : (
          triggers.map((trigger) => {
            const isClaiming = claiming === trigger.trigger_id;
            const claimed = !!trigger.claim;
            const pool = trigger.pool;
            const eligible = conditionMet(trigger, pairsDone);
            const title = trigger.label || pool?.name || copy.rewards_default_label || 'รางวัล';
            const pairsRequired = trigger.trigger_type === 'pair_milestone'
              ? (trigger.condition.pairs_required as number) ?? 1
              : null;

            return (
              <div
                key={trigger.trigger_id}
                style={{ marginTop: 20, background: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 16, padding: 16, boxShadow: '4px 5px 0 #1C1A17' }}
              >
                {/* Title row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ font: "700 14px/1.3 var(--font-body,'Bai Jamjuree'),sans-serif" }}>{title}</div>
                  {pairsRequired && (
                    <div style={{ fontFamily: "var(--font-display,'Bangers'),cursive", fontSize: 17, color: 'var(--accent, #E8354F)', flexShrink: 0 }}>
                      {Math.min(pairsDone, pairsRequired)}/{pairsRequired}
                    </div>
                  )}
                  {claimed && (
                    <div style={{ fontFamily: "var(--font-display,'Bangers'),cursive", fontSize: 12, letterSpacing: '.06em', padding: '3px 8px', background: '#F5E14B', border: '1.5px solid #1C1A17', borderRadius: 6, flexShrink: 0 }}>
                      ได้รับแล้ว
                    </div>
                  )}
                </div>

                {/* Pool type badge */}
                {pool && (
                  <div style={{ marginTop: 4, font: "500 10px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.4)', letterSpacing: '.06em' }}>
                    {pool.type === 'code_pool' ? '🎫 Code' : pool.type === 'physical' ? '📦 ของรางวัล' : pool.type === 'webhook' ? '🔌 ส่งสิทธิ์' : pool.type === 'voucher_link' ? '🔗 Voucher' : '🎁 รางวัล'}
                    {pool.gives === 'entitlement' ? ' · สิทธิ์ลุ้น' : ''}
                  </div>
                )}

                {/* Progress */}
                {!claimed && <TriggerProgress trigger={trigger} pairsDone={pairsDone} />}

                {/* Claim button */}
                {!claimed && eligible && pool?.status === 'active' && (
                  <button
                    onClick={() => handleClaim(trigger.trigger_id)}
                    disabled={!!isClaiming}
                    style={{
                      width: '100%', marginTop: 12,
                      background: isClaiming ? 'rgba(232,53,79,.5)' : 'var(--accent, #E8354F)',
                      color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 10,
                      padding: 12, font: "700 15px var(--font-body,'Bai Jamjuree'),sans-serif",
                      cursor: isClaiming ? 'default' : 'pointer', boxShadow: isClaiming ? 'none' : '3px 4px 0 #1C1A17',
                    }}
                  >
                    {isClaiming ? 'กำลังรับ...' : copy.claim_btn || 'รับรางวัล'}
                  </button>
                )}

                {/* Pool exhausted */}
                {!claimed && eligible && pool?.status === 'exhausted' && (
                  <div style={{ marginTop: 10, font: "500 11.5px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.4)' }}>
                    {copy.rewards_exhausted || 'ของรางวัลหมดแล้ว'}
                  </div>
                )}

                {/* Reward after claiming */}
                {claimed && trigger.claim && pool && (
                  <ClaimResult
                    claim={trigger.claim}
                    pool={pool}
                    onAddressSubmit={(addr) => handleAddressSubmit(trigger.claim!.id, addr)}
                    onRedeem={() => handleRedeem(trigger.claim!.id)}
                    copy={copy}
                  />
                )}
              </div>
            );
          })
        )}

        {/* Symbol stamps */}
        {totalSymbols > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: "var(--font-display,'Bangers'),cursive", fontSize: 15, letterSpacing: '.1em', color: 'var(--accent, #E8354F)' }}>
                {copy.symbols_title || 'SYMBOL STAMPS'}
              </div>
              <span style={{ font: "600 11px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(28,26,23,.45)' }}>
                {unlockedCount} / {totalSymbols}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {groupArchetypes.map((arch) => {
                const isUnlocked = unlockedSymbols.includes(arch.code);
                return (
                  <div key={arch.code} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: 70, height: 70, borderRadius: '50%',
                      border: `2px solid ${isUnlocked ? '#1C1A17' : 'rgba(28,26,23,.12)'}`,
                      background: isUnlocked ? '#FFFDF6' : '#1C1A17',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isUnlocked ? (
                        arch.image_url
                          ? <img src={arch.image_url} alt={arch.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ font: "700 7px var(--font-body,'Bai Jamjuree'),sans-serif", color: '#1C1A17', textAlign: 'center', padding: '0 5px', lineHeight: 1.3 }}>{arch.title}</div>
                      ) : (
                        <span style={{ font: "700 14px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'rgba(255,255,255,.3)' }}>?</span>
                      )}
                    </div>
                    <span style={{ font: "400 8.5px var(--font-body,'Bai Jamjuree'),sans-serif", color: isUnlocked ? '#1C1A17' : 'rgba(28,26,23,.25)', textAlign: 'center', lineHeight: 1.2, maxWidth: 70 }}>
                      {isUnlocked ? arch.title : '???'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={onBack}
          style={{ width: '100%', marginTop: 28, padding: '15px 20px', background: 'var(--accent, #E8354F)', color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 13, font: "700 17px/1 var(--font-body,'Bai Jamjuree'),sans-serif", cursor: 'pointer', boxShadow: '4px 5px 0 #1C1A17' }}
        >
          {copy.rewards_back || 'กลับหน้าสรุป'}
        </button>
      </div>
    </div>
  );
}
