import { useEffect, useState } from 'react';
import { fetchRewardPools } from '../../api';
import type { RewardConfig, RewardMilestone } from '../../types';

interface RewardPool {
  id: string;
  name: string;
  type: string;
  status: string;
  available_codes?: number;
}

interface Props {
  rewards: RewardConfig | undefined;
  onChange: (rewards: RewardConfig | undefined) => void;
}

const TYPE_ICONS: Record<string, string> = {
  code_pool: '🎫',
  single_code: '🏷️',
  raffle: '🎲',
  voucher_link: '🔗',
  points_bonus: '⭐',
};

const EMPTY_MILESTONE: RewardMilestone = {
  key: '',
  trigger_pairs: 3,
  reward_pool_id: '',
  label: '',
  icon: '',
};

export default function RewardsSection({ rewards, onChange }: Props) {
  const [pools, setPools] = useState<RewardPool[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);

  const enabled = rewards?.enabled ?? false;

  useEffect(() => {
    setPoolsLoading(true);
    fetchRewardPools()
      .then((data) => setPools((data.pools || []) as RewardPool[]))
      .catch(() => {/* non-critical */})
      .finally(() => setPoolsLoading(false));
  }, []);

  const set = <K extends keyof RewardConfig>(key: K, val: RewardConfig[K]) => {
    onChange({ enabled: rewards?.enabled ?? false, points_per_pair: rewards?.points_per_pair ?? 50, milestones: rewards?.milestones, ...rewards, [key]: val });
  };

  const handleToggle = () => {
    if (!enabled) {
      onChange({ enabled: true, points_per_pair: rewards?.points_per_pair ?? 50, milestones: rewards?.milestones ?? [] });
    } else {
      onChange({ ...rewards, enabled: false } as RewardConfig);
    }
  };

  const updateMilestone = (index: number, update: Partial<RewardMilestone>) => {
    const milestones = [...(rewards?.milestones ?? [])];
    milestones[index] = { ...milestones[index], ...update };
    set('milestones', milestones);
  };

  const addMilestone = () => {
    const existing = rewards?.milestones ?? [];
    if (existing.length >= 5) return;
    const newKey = `milestone_${existing.length + 1}`;
    set('milestones', [...existing, { ...EMPTY_MILESTONE, key: newKey }]);
  };

  const removeMilestone = (index: number) => {
    const milestones = [...(rewards?.milestones ?? [])];
    milestones.splice(index, 1);
    set('milestones', milestones);
  };

  return (
    <div className="section" id="sec-rewards">
      <div className="section-head">
        <span className="section-num">Rewards</span>
        <span className="section-title">ระบบรางวัล · Milestones · Coupons</span>
      </div>

      <div className="adv-section">
        <div className="adv-row">
          <div className="akey">เปิดใช้ระบบรางวัล</div>
          <div>
            <button
              className={`toggle-pill ${enabled ? 'on' : 'off'}`}
              onClick={handleToggle}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="aeffect">แสดงหน้า Rewards ใน LIFF พร้อม milestones และ coupons</div>
        </div>
      </div>

      {enabled && (
        <>
          <div className="adv-section" style={{ marginTop: 16 }}>
            <div className="adv-group-label">การให้แต้ม</div>
            <div className="adv-row">
              <div className="akey">points_per_pair</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={rewards?.points_per_pair ?? 50}
                    style={{ width: 80 }}
                    min={0}
                    max={1000}
                    onChange={(e) => set('points_per_pair', parseInt(e.target.value) || 0)}
                  />
                  <span className="unit-label">แต้ม/คู่</span>
                </div>
              </div>
              <div className="aeffect">แต้มที่ได้รับต่อการจับคู่สำเร็จ 1 คู่</div>
            </div>
          </div>

          <div className="adv-section" style={{ marginTop: 16 }}>
            <div className="adv-group-label">Milestones ({rewards?.milestones?.length ?? 0}/5)</div>
            <div style={{ fontSize: 12, color: '#9B9B98', marginBottom: 12 }}>
              กำหนดรางวัลที่ปลดล็อคเมื่อครบจำนวนคู่ที่กำหนด
            </div>

            {(rewards?.milestones ?? []).map((m, i) => (
              <div
                key={i}
                style={{ border: '1px solid #E5E5E3', borderRadius: 8, padding: '14px 16px', marginBottom: 10, background: '#FAFAF9' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>
                    Milestone {i + 1}
                  </span>
                  <button
                    onClick={() => removeMilestone(i)}
                    style={{ fontSize: 11, color: '#E63B2E', border: '1px solid rgba(230,59,46,.25)', borderRadius: 6, padding: '4px 8px', background: '#fff', cursor: 'pointer' }}
                  >
                    ลบ
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 4 }}>Key (a-z, _)</div>
                    <input
                      type="text"
                      value={m.key}
                      placeholder="e.g. milestone_3"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      onChange={(e) => updateMilestone(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 4 }}>ต้องครบกี่คู่</div>
                    <input
                      type="number"
                      value={m.trigger_pairs}
                      min={1}
                      max={50}
                      style={{ width: 80 }}
                      onChange={(e) => updateMilestone(i, { trigger_pairs: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 4 }}>Label</div>
                    <input
                      type="text"
                      value={m.label}
                      placeholder="เช่น ครบ 3 คู่ รับส่วนลด 200 บาท"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      onChange={(e) => updateMilestone(i, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 4 }}>Icon (emoji)</div>
                    <input
                      type="text"
                      value={m.icon || ''}
                      placeholder="🎁"
                      maxLength={4}
                      style={{ width: 60 }}
                      onChange={(e) => updateMilestone(i, { icon: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 4 }}>Reward Pool</div>
                  {poolsLoading ? (
                    <div style={{ fontSize: 12, color: '#9B9B98' }}>กำลังโหลด pools...</div>
                  ) : pools.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#E63B2E' }}>ยังไม่มี pool — ไปสร้างที่ Rewards / คูปอง ก่อน</div>
                  ) : (
                    <select
                      value={m.reward_pool_id}
                      onChange={(e) => updateMilestone(i, { reward_pool_id: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontSize: 12.5, background: '#fff', outline: 'none' }}
                    >
                      <option value="">-- เลือก Reward Pool --</option>
                      {pools.map((p) => (
                        <option key={p.id} value={p.id}>
                          {TYPE_ICONS[p.type] || '🎁'} {p.name}
                          {p.available_codes != null ? ` (${p.available_codes} ว่าง)` : ''}
                          {p.status !== 'active' ? ` [${p.status}]` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}

            {(rewards?.milestones?.length ?? 0) < 5 && (
              <button
                onClick={addMilestone}
                style={{ width: '100%', padding: '10px 14px', border: '1px dashed #C9C9C6', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#5C5C58', marginTop: 4 }}
              >
                + เพิ่ม Milestone
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
