import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchRewardPools,
  createRewardPool,
  updateRewardPool,
  deleteRewardPool,
  importRewardCodes,
  fetchRewardCodes,
  fetchPoolStats,
  fetchPoolTriggers,
  createRewardTrigger,
  updateRewardTrigger,
  deleteRewardTrigger,
  fetchRewardClaims,
  updateRewardClaim,
} from '../api';

type PoolType = 'code_pool' | 'single_code' | 'raffle' | 'voucher_link' | 'points_bonus' | 'physical' | 'webhook';
type PoolStatus = 'active' | 'draft' | 'exhausted' | 'expired';
type GivesType = 'reward' | 'entitlement';
type ClaimMode = 'auto' | 'manual';
type ExpiryMode = 'never' | 'days' | 'campaign_end';
type TriggerType = 'quiz_complete' | 'pair_milestone' | 'group_complete' | 'checkin' | 'push';
type DeliveryStatus = 'all' | 'pending' | 'approved' | 'shipped' | 'delivered';

interface RewardPool {
  id: string;
  name: string;
  type: PoolType;
  description?: string;
  expires_at?: string;
  meta: Record<string, unknown>;
  status: PoolStatus;
  created_at: string;
  total_codes?: number;
  available_codes?: number;
  total_claims?: number;
}

interface RewardCode {
  id: string;
  pool_id: string;
  code: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
}

interface RewardTrigger {
  id: string;
  pool_id: string;
  campaign_id: string;
  trigger_type: TriggerType;
  condition: Record<string, unknown> | null;
  units_granted: number;
  label: string;
  enabled: boolean;
  created_at: string;
}

interface RewardClaim {
  id: string;
  pool_id: string;
  user_id: string;
  trigger_id?: string;
  status: string;
  delivery_status?: string;
  address?: Record<string, unknown>;
  tracking_number?: string;
  admin_note?: string;
  issued_at: string;
  meta?: Record<string, unknown>;
  pool?: { name: string };
}

const TYPE_INFO: Record<PoolType, { label: string; color: string; icon: string }> = {
  code_pool: { label: 'Code Pool', color: '#2563EB', icon: '🎫' },
  single_code: { label: 'Single Code', color: '#16A34A', icon: '🏷️' },
  raffle: { label: 'Raffle', color: '#9333EA', icon: '🎲' },
  voucher_link: { label: 'Voucher Link', color: '#D97706', icon: '🔗' },
  points_bonus: { label: 'Points Bonus', color: '#E63B2E', icon: '⭐' },
  physical: { label: 'Physical', color: '#7C3AED', icon: '📦' },
  webhook: { label: 'Webhook', color: '#0891B2', icon: '🔌' },
};

const STATUS_INFO: Record<PoolStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'ACTIVE', color: '#16A34A', bg: 'rgba(22,163,74,.08)' },
  draft: { label: 'DRAFT', color: '#9B9B98', bg: '#F7F7F5' },
  exhausted: { label: 'EXHAUSTED', color: '#E63B2E', bg: 'rgba(230,59,46,.08)' },
  expired: { label: 'EXPIRED', color: '#D97706', bg: 'rgba(217,119,6,.08)' },
};

const EMPTY_FORM = {
  name: '',
  type: 'code_pool' as PoolType,
  description: '',
  expires_at: '',
  status: 'active' as PoolStatus,
  meta: {} as Record<string, unknown>,
  gives: 'reward' as GivesType,
  claim_mode: 'auto' as ClaimMode,
  max_claims_per_user: 1,
  expiry_mode: 'never' as ExpiryMode,
  expiry_days: 7,
  daily_cap: '' as number | '',
  brand_id: '',
};

const EMPTY_TRIGGER_FORM = {
  campaign_id: '',
  trigger_type: 'quiz_complete' as TriggerType,
  condition: '',
  units_granted: 1,
  label: '',
  enabled: true,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #E5E5E3',
  borderRadius: 9,
  fontSize: 13.5,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace",
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#9B9B98',
  marginBottom: 6,
};

export default function RewardPools() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pools' | 'claims'>('pools');
  const [pools, setPools] = useState<RewardPool[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editPool, setEditPool] = useState<RewardPool | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Manage codes modal
  const [codesPool, setCodesPool] = useState<RewardPool | null>(null);
  const [codes, setCodes] = useState<RewardCode[]>([]);
  const [codesTotal, setCodesTotal] = useState(0);
  const [codesPage, setCodesPage] = useState(1);
  const [codeStats, setCodeStats] = useState<{ total_codes: number; available_codes: number; total_claims: number } | null>(null);
  const [codesInput, setCodesInput] = useState('');
  const [importingCodes, setImportingCodes] = useState(false);

  // Triggers modal
  const [triggersPool, setTriggersPool] = useState<RewardPool | null>(null);
  const [triggers, setTriggers] = useState<RewardTrigger[]>([]);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [triggerForm, setTriggerForm] = useState({ ...EMPTY_TRIGGER_FORM });
  const [savingTrigger, setSavingTrigger] = useState(false);

  // Claims tab
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState<{ delivery_status: DeliveryStatus; pool_id: string }>({ delivery_status: 'all', pool_id: '' });
  const [claimEdits, setClaimEdits] = useState<Record<string, { delivery_status?: string; tracking_number?: string; admin_note?: string }>>({});
  const [savingClaim, setSavingClaim] = useState<string | null>(null);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  };

  const loadPools = async () => {
    setLoading(true);
    try {
      const data = await fetchRewardPools();
      setPools((data.pools || []) as RewardPool[]);
    } catch {
      showToast('โหลด reward pools ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const loadClaims = async () => {
    setClaimsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (claimsFilter.delivery_status !== 'all') params.delivery_status = claimsFilter.delivery_status;
      if (claimsFilter.pool_id) params.pool_id = claimsFilter.pool_id;
      const data = await fetchRewardClaims(params);
      setClaims((data as { claims?: RewardClaim[] }).claims || []);
    } catch {
      showToast('โหลด claims ไม่สำเร็จ');
    } finally {
      setClaimsLoading(false);
    }
  };

  useEffect(() => { loadPools(); }, []);
  useEffect(() => { if (activeTab === 'claims') loadClaims(); }, [activeTab, claimsFilter]);

  const openCreate = () => {
    setEditPool(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (p: RewardPool) => {
    setEditPool(p);
    setForm({
      name: p.name,
      type: p.type,
      description: p.description || '',
      expires_at: p.expires_at ? p.expires_at.slice(0, 16) : '',
      status: p.status,
      meta: { ...p.meta },
      gives: (p.meta.gives as GivesType) || 'reward',
      claim_mode: (p.meta.claim_mode as ClaimMode) || 'auto',
      max_claims_per_user: (p.meta.max_claims_per_user as number) || 1,
      expiry_mode: (p.meta.expiry_mode as ExpiryMode) || 'never',
      expiry_days: (p.meta.expiry_days as number) || 7,
      daily_cap: (p.meta.daily_cap as number) || '',
      brand_id: (p.meta.brand_id as string) || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const meta: Record<string, unknown> = {
        ...form.meta,
        gives: form.gives,
        claim_mode: form.claim_mode,
        max_claims_per_user: form.max_claims_per_user,
        expiry_mode: form.expiry_mode,
      };
      if (form.expiry_mode === 'days') meta.expiry_days = form.expiry_days;
      if (form.daily_cap !== '') meta.daily_cap = form.daily_cap;
      if (form.brand_id.trim()) meta.brand_id = form.brand_id.trim();

      const payload = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        expires_at: form.expires_at || undefined,
        status: form.status,
        meta,
      };
      if (editPool) {
        await updateRewardPool(editPool.id, payload);
        showToast('อัปเดต pool แล้ว');
      } else {
        await createRewardPool(payload);
        showToast('สร้าง pool แล้ว');
      }
      setShowModal(false);
      await loadPools();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ลบ pool นี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    try {
      await deleteRewardPool(id);
      showToast('ลบแล้ว');
      await loadPools();
    } catch {
      showToast('ลบไม่สำเร็จ');
    }
  };

  const openManageCodes = async (p: RewardPool) => {
    setCodesPool(p);
    setCodesPage(1);
    setCodesInput('');
    await loadCodes(p.id, 1);
    const statsData = await fetchPoolStats(p.id);
    setCodeStats(statsData.stats || null);
  };

  const loadCodes = async (poolId: string, page: number) => {
    const data = await fetchRewardCodes(poolId, page);
    setCodes((data.codes || []) as RewardCode[]);
    setCodesTotal(data.total || 0);
    setCodesPage(page);
  };

  const handleImportCodes = async () => {
    if (!codesPool || !codesInput.trim()) return;
    setImportingCodes(true);
    try {
      const codeList = codesInput.split('\n').map((c) => c.trim()).filter(Boolean);
      const result = await importRewardCodes(codesPool.id, codeList);
      showToast(`นำเข้า ${result.imported} รหัสแล้ว`);
      setCodesInput('');
      await loadCodes(codesPool.id, 1);
      const statsData = await fetchPoolStats(codesPool.id);
      setCodeStats(statsData.stats || null);
    } catch {
      showToast('นำเข้า codes ไม่สำเร็จ');
    } finally {
      setImportingCodes(false);
    }
  };

  const openTriggers = async (p: RewardPool) => {
    setTriggersPool(p);
    setTriggerForm({ ...EMPTY_TRIGGER_FORM });
    setTriggersLoading(true);
    try {
      const data = await fetchPoolTriggers(p.id);
      setTriggers((data.triggers || []) as RewardTrigger[]);
    } catch {
      showToast('โหลด triggers ไม่สำเร็จ');
    } finally {
      setTriggersLoading(false);
    }
  };

  const handleCreateTrigger = async () => {
    if (!triggersPool || !triggerForm.campaign_id.trim()) return;
    setSavingTrigger(true);
    try {
      let condition: Record<string, unknown> | null = null;
      if (triggerForm.condition.trim()) {
        try { condition = JSON.parse(triggerForm.condition); } catch { showToast('Condition JSON ไม่ถูกต้อง'); setSavingTrigger(false); return; }
      }
      await createRewardTrigger(triggersPool.id, {
        campaign_id: triggerForm.campaign_id.trim(),
        trigger_type: triggerForm.trigger_type,
        condition,
        units_granted: triggerForm.units_granted,
        label: triggerForm.label.trim(),
        enabled: triggerForm.enabled,
      });
      showToast('เพิ่ม trigger แล้ว');
      setTriggerForm({ ...EMPTY_TRIGGER_FORM });
      const data = await fetchPoolTriggers(triggersPool.id);
      setTriggers((data.triggers || []) as RewardTrigger[]);
    } catch {
      showToast('เพิ่ม trigger ไม่สำเร็จ');
    } finally {
      setSavingTrigger(false);
    }
  };

  const handleToggleTrigger = async (t: RewardTrigger) => {
    try {
      await updateRewardTrigger(t.id, { enabled: !t.enabled });
      setTriggers((prev) => prev.map((x) => x.id === t.id ? { ...x, enabled: !x.enabled } : x));
    } catch {
      showToast('อัปเดต trigger ไม่สำเร็จ');
    }
  };

  const handleDeleteTrigger = async (id: string) => {
    if (!confirm('ลบ trigger นี้?')) return;
    if (!triggersPool) return;
    try {
      await deleteRewardTrigger(id);
      showToast('ลบ trigger แล้ว');
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    } catch {
      showToast('ลบ trigger ไม่สำเร็จ');
    }
  };

  const handleSaveClaim = async (claim: RewardClaim) => {
    setSavingClaim(claim.id);
    try {
      const edits = claimEdits[claim.id] || {};
      await updateRewardClaim(claim.id, edits);
      showToast('บันทึกแล้ว');
      setClaimEdits((prev) => { const n = { ...prev }; delete n[claim.id]; return n; });
      await loadClaims();
    } catch {
      showToast('บันทึกไม่สำเร็จ');
    } finally {
      setSavingClaim(null);
    }
  };

  const setMeta = (key: string, val: unknown) => {
    setForm((f) => ({ ...f, meta: { ...f.meta, [key]: val } }));
  };

  const setClaimEdit = (claimId: string, key: string, val: string) => {
    setClaimEdits((prev) => ({ ...prev, [claimId]: { ...prev[claimId], [key]: val } }));
  };

  const typeInfo = TYPE_INFO[form.type];
  const totalPages = Math.ceil(codesTotal / 50);

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', borderBottom: '1px solid #E5E5E3', position: 'sticky', top: 0, background: '#fff', zIndex: 40 }}>
        <button
          onClick={() => navigate('/')}
          style={{ fontSize: 13, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 9, padding: '8px 14px', background: '#fff', cursor: 'pointer' }}
        >
          ← กลับ
        </button>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>Krob · Host Console</span>
        <span style={{ width: 1, height: 16, background: '#E5E5E3' }} />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>Rewards / คูปอง</span>
        <div style={{ flex: 1 }} />
        {activeTab === 'pools' && (
          <button
            onClick={openCreate}
            style={{ padding: '9px 16px', border: 0, borderRadius: 9, background: '#111111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + สร้าง Pool ใหม่
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E5E3', padding: '0 28px' }}>
        {(['pools', 'claims'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '11px 16px',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #111111' : '2px solid transparent',
              background: 'transparent',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: activeTab === tab ? '#111111' : '#9B9B98',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab === 'pools' ? 'Pools' : 'Claims'}
          </button>
        ))}
      </div>

      {/* ── POOLS TAB ── */}
      {activeTab === 'pools' && (
        <>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #E5E5E3' }}>
            <div style={{ padding: '18px 28px' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Pools ทั้งหมด</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6 }}>{pools.length}</div>
            </div>
            <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#16A34A' }}>Active</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6, color: '#16A34A' }}>{pools.filter((p) => p.status === 'active').length}</div>
            </div>
            <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>รหัสที่แจกไปแล้ว</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6 }}>
                {pools.reduce((s, p) => s + (p.total_claims ?? 0), 0).toLocaleString('en-US')}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ padding: '24px 28px 60px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 24px', color: '#9B9B98' }}>กำลังโหลด...</div>
            ) : pools.length === 0 ? (
              <div style={{ border: '1px dashed #C9C9C6', padding: '64px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>ยังไม่มี Reward Pool</div>
                <div style={{ fontSize: 14.5, color: '#5C5C58', lineHeight: 1.6, maxWidth: 340 }}>
                  สร้าง pool แล้วนำเข้า codes หรือกำหนดรางวัลประเภทต่างๆ
                </div>
                <button onClick={openCreate} style={{ marginTop: 4, padding: '11px 20px', border: 0, borderRadius: 9, background: '#111111', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                  + สร้าง Pool ใหม่
                </button>
              </div>
            ) : (
              <div style={{ border: '1px solid #E5E5E3' }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 90px 80px 80px 80px 1fr', gap: 0, padding: '10px 20px', background: '#F7F7F5', borderBottom: '1px solid #E5E5E3' }}>
                  {['ชื่อ Pool', 'Type', 'Status', 'Codes', 'Available', 'Claims', 'Actions'].map((h) => (
                    <div key={h} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{h}</div>
                  ))}
                </div>
                {pools.map((p, i) => {
                  const ti = TYPE_INFO[p.type] || TYPE_INFO.code_pool;
                  const si = STATUS_INFO[p.status] || STATUS_INFO.draft;
                  return (
                    <div
                      key={p.id}
                      style={{ display: 'grid', gridTemplateColumns: '2fr 120px 90px 80px 80px 80px 1fr', gap: 0, padding: '14px 20px', borderTop: i ? '1px solid #E5E5E3' : undefined, alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: 11.5, color: '#9B9B98', marginTop: 2 }}>{p.description}</div>}
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#C9C9C6', marginTop: 3 }}>{p.id}</div>
                      </div>
                      <div>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', padding: '3px 8px', border: `1px solid ${ti.color}`, color: ti.color }}>
                          {ti.icon} {ti.label}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', padding: '3px 8px', borderRadius: 99, background: si.bg, color: si.color }}>
                          {si.label}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{p.total_codes ?? '—'}</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: (p.available_codes ?? 0) === 0 ? '#E63B2E' : '#16A34A' }}>{p.available_codes ?? '—'}</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{p.total_claims ?? 0}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(p.type === 'code_pool' || p.type === 'raffle') && (
                          <button
                            onClick={() => openManageCodes(p)}
                            style={{ fontSize: 12, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 7, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}
                          >
                            Codes
                          </button>
                        )}
                        <button
                          onClick={() => openTriggers(p)}
                          style={{ fontSize: 12, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 7, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}
                        >
                          Triggers
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          style={{ fontSize: 12, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 7, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          style={{ fontSize: 12, color: '#E63B2E', border: '1px solid rgba(230,59,46,.25)', borderRadius: 7, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CLAIMS TAB ── */}
      {activeTab === 'claims' && (
        <div style={{ padding: '20px 28px 60px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>กรองด้วย:</div>
            <select
              value={claimsFilter.delivery_status}
              onChange={(e) => setClaimsFilter((f) => ({ ...f, delivery_status: e.target.value as DeliveryStatus }))}
              style={{ padding: '8px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff', fontFamily: "'JetBrains Mono',monospace" }}
            >
              <option value="all">Delivery: ทั้งหมด</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
            <select
              value={claimsFilter.pool_id}
              onChange={(e) => setClaimsFilter((f) => ({ ...f, pool_id: e.target.value }))}
              style={{ padding: '8px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff' }}
            >
              <option value="">Pool: ทั้งหมด</option>
              {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={loadClaims}
              style={{ padding: '8px 14px', border: '1px solid #E5E5E3', borderRadius: 9, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#5C5C58' }}
            >
              รีเฟรช
            </button>
          </div>

          {claimsLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#9B9B98' }}>กำลังโหลด...</div>
          ) : claims.length === 0 ? (
            <div style={{ border: '1px dashed #C9C9C6', padding: '48px 28px', textAlign: 'center', color: '#9B9B98', fontSize: 13.5 }}>ไม่พบ claims</div>
          ) : (
            <div style={{ border: '1px solid #E5E5E3' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 80px 90px 1fr 100px', gap: 0, padding: '10px 16px', background: '#F7F7F5', borderBottom: '1px solid #E5E5E3' }}>
                {['User', 'Pool', 'Trigger', 'Status', 'Delivery', 'Address', 'Issued'].map((h) => (
                  <div key={h} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{h}</div>
                ))}
              </div>
              {claims.map((claim, i) => {
                const edits = claimEdits[claim.id] || {};
                const poolName = claim.pool?.name || pools.find((p) => p.id === claim.pool_id)?.name || claim.pool_id.slice(0, 8) + '...';
                const triggerLabel = (claim.meta?.trigger_type as string) || claim.trigger_id?.slice(0, 8) || '—';
                const addrParts = claim.address ? [claim.address.name, claim.address.city, claim.address.province].filter(Boolean).join(', ') : '—';
                return (
                  <div key={claim.id} style={{ borderTop: i ? '1px solid #E5E5E3' : undefined }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 80px 90px 1fr 100px', gap: 0, padding: '12px 16px', alignItems: 'start' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#5C5C58', wordBreak: 'break-all' }}>{claim.user_id.slice(0, 16)}...</div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{poolName}</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#5C5C58' }}>{triggerLabel}</div>
                      <div>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, padding: '2px 7px', borderRadius: 99, background: claim.status === 'issued' ? 'rgba(22,163,74,.1)' : '#F7F7F5', color: claim.status === 'issued' ? '#16A34A' : '#9B9B98' }}>
                          {claim.status}
                        </span>
                      </div>
                      <div>
                        {claim.delivery_status ? (
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, padding: '2px 7px', borderRadius: 99, background: '#F0F0EE', color: '#5C5C58' }}>
                            {edits.delivery_status || claim.delivery_status}
                          </span>
                        ) : <span style={{ color: '#C9C9C6', fontSize: 12 }}>—</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#5C5C58' }}>{addrParts}</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#9B9B98' }}>
                        {new Date(claim.issued_at).toLocaleDateString('th-TH')}
                      </div>
                    </div>
                    {/* Action row */}
                    <div style={{ padding: '0 16px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      {claim.delivery_status !== undefined && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98' }}>Delivery Status</div>
                            <select
                              value={edits.delivery_status ?? claim.delivery_status ?? 'pending'}
                              onChange={(e) => setClaimEdit(claim.id, 'delivery_status', e.target.value)}
                              style={{ padding: '7px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98' }}>Tracking No.</div>
                            <input
                              value={edits.tracking_number ?? claim.tracking_number ?? ''}
                              onChange={(e) => setClaimEdit(claim.id, 'tracking_number', e.target.value)}
                              placeholder="TH123456789"
                              style={{ padding: '7px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 12, outline: 'none', width: 160 }}
                            />
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9B9B98' }}>Admin Note</div>
                        <input
                          value={edits.admin_note ?? claim.admin_note ?? ''}
                          onChange={(e) => setClaimEdit(claim.id, 'admin_note', e.target.value)}
                          placeholder="หมายเหตุ..."
                          style={{ padding: '7px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 12, outline: 'none', width: 200 }}
                        />
                      </div>
                      <button
                        onClick={() => handleSaveClaim(claim)}
                        disabled={savingClaim === claim.id}
                        style={{ padding: '8px 14px', border: 0, borderRadius: 7, background: '#111111', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}
                      >
                        {savingClaim === claim.id ? '...' : 'บันทึก'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.42)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #111111', maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E5E3', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.015em' }}>{editPool ? 'แก้ไข Pool' : 'สร้าง Reward Pool'}</span>
              <button onClick={() => setShowModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#9B9B98' }}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <div style={labelStyle}>ชื่อ Pool *</div>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น ส่วนลด 200 บาท"
                  style={inputStyle}
                />
              </div>

              {/* Type */}
              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>ประเภท *</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {(Object.keys(TYPE_INFO) as PoolType[]).map((t) => {
                    const ti = TYPE_INFO[t];
                    const on = form.type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setForm((f) => ({ ...f, type: t, meta: {} }))}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 9, cursor: 'pointer', border: `1px solid ${on ? ti.color : '#E5E5E3'}`, background: on ? `${ti.color}10` : '#fff' }}
                      >
                        <span style={{ fontSize: 15 }}>{ti.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: on ? ti.color : '#111' }}>{ti.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <div style={labelStyle}>คำอธิบาย</div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="รายละเอียดรางวัลนี้"
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Gives + Claim Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={labelStyle}>Gives</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['reward', 'entitlement'] as GivesType[]).map((g) => (
                      <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: form.gives === g ? '#111' : '#5C5C58' }}>
                        <input
                          type="radio"
                          name="gives"
                          value={g}
                          checked={form.gives === g}
                          onChange={() => setForm((f) => ({ ...f, gives: g }))}
                        />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Claim Mode</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['auto', 'manual'] as ClaimMode[]).map((m) => (
                      <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: form.claim_mode === m ? '#111' : '#5C5C58' }}>
                        <input
                          type="radio"
                          name="claim_mode"
                          value={m}
                          checked={form.claim_mode === m}
                          onChange={() => setForm((f) => ({ ...f, claim_mode: m }))}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Max claims per user + Daily cap */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={labelStyle}>Max Claims / User</div>
                  <input
                    type="number"
                    min={1}
                    value={form.max_claims_per_user}
                    onChange={(e) => setForm((f) => ({ ...f, max_claims_per_user: parseInt(e.target.value) || 1 }))}
                    style={{ ...inputStyle, width: 'auto' }}
                  />
                </div>
                <div>
                  <div style={labelStyle}>Daily Cap (ไม่บังคับ)</div>
                  <input
                    type="number"
                    min={0}
                    value={form.daily_cap}
                    onChange={(e) => setForm((f) => ({ ...f, daily_cap: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                    placeholder="ไม่จำกัด"
                    style={{ ...inputStyle, width: 'auto' }}
                  />
                </div>
              </div>

              {/* Expiry mode */}
              <div>
                <div style={labelStyle}>Expiry Mode</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['never', 'days', 'campaign_end'] as ExpiryMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setForm((f) => ({ ...f, expiry_mode: m }))}
                      style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${form.expiry_mode === m ? '#111111' : '#E5E5E3'}`, background: form.expiry_mode === m ? '#111111' : '#fff', color: form.expiry_mode === m ? '#fff' : '#5C5C58', fontSize: 12.5, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace" }}
                    >
                      {m === 'never' ? 'Never' : m === 'days' ? 'Days' : 'Campaign End'}
                    </button>
                  ))}
                </div>
                {form.expiry_mode === 'days' && (
                  <div style={{ marginTop: 10 }}>
                    <div style={labelStyle}>จำนวนวัน</div>
                    <input
                      type="number"
                      min={1}
                      value={form.expiry_days}
                      onChange={(e) => setForm((f) => ({ ...f, expiry_days: parseInt(e.target.value) || 1 }))}
                      style={{ ...inputStyle, width: 120 }}
                    />
                  </div>
                )}
              </div>

              {/* Brand ID */}
              <div>
                <div style={labelStyle}>Brand ID (ไม่บังคับ)</div>
                <input
                  value={form.brand_id}
                  onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                  placeholder="brand-slug หรือ ID"
                  style={inputStyle}
                />
              </div>

              {/* Expires at */}
              <div>
                <div style={labelStyle}>หมดอายุ Pool (ไม่บังคับ)</div>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  style={{ padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* Meta fields by type */}
              {form.type === 'single_code' && (
                <div>
                  <div style={labelStyle}>รหัสส่วนลด</div>
                  <input
                    value={(form.meta.code as string) || ''}
                    onChange={(e) => setMeta('code', e.target.value)}
                    placeholder="SAVE200"
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }}
                  />
                </div>
              )}
              {form.type === 'voucher_link' && (
                <>
                  <div>
                    <div style={labelStyle}>URL</div>
                    <input
                      value={(form.meta.url as string) || ''}
                      onChange={(e) => setMeta('url', e.target.value)}
                      placeholder="https://shop.example.com/redeem?code=xxx"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>ข้อความแสดง</div>
                    <input
                      value={(form.meta.discount_text as string) || ''}
                      onChange={(e) => setMeta('discount_text', e.target.value)}
                      placeholder="ส่วนลด 200 บาท"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}
              {form.type === 'points_bonus' && (
                <div>
                  <div style={labelStyle}>Bonus Points</div>
                  <input
                    type="number"
                    value={(form.meta.bonus_points as number) || 0}
                    onChange={(e) => setMeta('bonus_points', parseInt(e.target.value) || 0)}
                    min={0}
                    style={{ width: 120, padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
                  />
                </div>
              )}
              {form.type === 'webhook' && (
                <div>
                  <div style={labelStyle}>Webhook URL</div>
                  <input
                    value={(form.meta.webhook_url as string) || ''}
                    onChange={(e) => setMeta('webhook_url', e.target.value)}
                    placeholder="https://your-api.com/reward-hook"
                    style={inputStyle}
                  />
                </div>
              )}
              {(form.type === 'code_pool' || form.type === 'raffle') && (
                <div style={{ background: '#F7F7F5', border: '1px solid #E5E5E3', borderRadius: 9, padding: '12px 14px', fontSize: 12.5, color: '#5C5C58' }}>
                  สร้าง pool ก่อน จากนั้นกด <strong>Codes</strong> เพื่อนำเข้ารหัสส่วนลด (ทีละหลายรหัสได้)
                </div>
              )}
              {form.type === 'physical' && (
                <div style={{ background: '#F7F7F5', border: '1px solid #E5E5E3', borderRadius: 9, padding: '12px 14px', fontSize: 12.5, color: '#5C5C58' }}>
                  Pool ประเภท Physical จะเก็บข้อมูลที่อยู่จัดส่งและสามารถอัปเดต delivery_status ได้จาก Claims tab
                </div>
              )}

              {/* Status */}
              <div>
                <div style={labelStyle}>Status</div>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PoolStatus }))}
                  style={{ padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff' }}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="exhausted">Exhausted</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #E5E5E3', position: 'sticky', bottom: 0, background: '#fff' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 16px', border: '1px solid #E5E5E3', background: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#5C5C58' }}>
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                style={{ padding: '10px 20px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: form.name.trim() && !saving ? 'pointer' : 'default', background: form.name.trim() && !saving ? '#111111' : '#F0F0EE', color: form.name.trim() && !saving ? '#fff' : '#9B9B98' }}
              >
                {saving ? 'กำลังบันทึก...' : editPool ? 'บันทึก' : 'สร้าง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGE CODES MODAL ── */}
      {codesPool && (
        <div
          onClick={() => setCodesPool(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.42)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 620, background: '#fff', border: '1px solid #111111', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E5E3' }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.015em' }}>จัดการ Codes — {codesPool.name}</span>
              <button onClick={() => setCodesPool(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#9B9B98' }}>✕</button>
            </div>

            {codeStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #E5E5E3' }}>
                <div style={{ padding: '12px 18px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>ทั้งหมด</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 500, marginTop: 4 }}>{codeStats.total_codes}</div>
                </div>
                <div style={{ padding: '12px 18px', borderLeft: '1px solid #E5E5E3' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#16A34A' }}>ว่างอยู่</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 500, marginTop: 4, color: '#16A34A' }}>{codeStats.available_codes}</div>
                </div>
                <div style={{ padding: '12px 18px', borderLeft: '1px solid #E5E5E3' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>แจกไปแล้ว</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 500, marginTop: 4 }}>{codeStats.total_claims}</div>
                </div>
              </div>
            )}

            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E3' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>นำเข้า Codes (1 รหัสต่อบรรทัด)</div>
              <textarea
                value={codesInput}
                onChange={(e) => setCodesInput(e.target.value)}
                rows={4}
                placeholder={'SAVE200A\nSAVE200B\nSAVE200C'}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 12.5, fontFamily: "'JetBrains Mono',monospace", outline: 'none', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={handleImportCodes}
                  disabled={importingCodes || !codesInput.trim()}
                  style={{ padding: '9px 18px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: codesInput.trim() && !importingCodes ? 'pointer' : 'default', background: codesInput.trim() && !importingCodes ? '#111111' : '#F0F0EE', color: codesInput.trim() && !importingCodes ? '#fff' : '#9B9B98' }}
                >
                  {importingCodes ? 'กำลังนำเข้า...' : 'Import'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {codes.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9B9B98', fontSize: 13.5 }}>ยังไม่มี codes ใน pool นี้</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 20px', background: '#F7F7F5', borderBottom: '1px solid #E5E5E3' }}>
                    {['Code', 'Claimed by', 'Claimed at'].map((h) => (
                      <div key={h} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{h}</div>
                    ))}
                  </div>
                  {codes.map((c, i) => (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 20px', borderTop: i ? '1px solid #E5E5E3' : undefined, alignItems: 'center' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, letterSpacing: '.04em' }}>{c.code}</div>
                      <div style={{ fontSize: 12, color: c.claimed_by ? '#5C5C58' : '#9B9B98' }}>{c.claimed_by || '—'}</div>
                      <div style={{ fontSize: 12, color: '#9B9B98' }}>{c.claimed_at ? new Date(c.claimed_at).toLocaleDateString('th-TH') : '—'}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid #E5E5E3' }}>
                <button
                  disabled={codesPage <= 1}
                  onClick={() => loadCodes(codesPool.id, codesPage - 1)}
                  style={{ padding: '7px 14px', border: '1px solid #E5E5E3', borderRadius: 7, background: '#fff', cursor: codesPage > 1 ? 'pointer' : 'default', color: codesPage > 1 ? '#111' : '#9B9B98' }}
                >
                  ← ก่อนหน้า
                </button>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#9B9B98' }}>{codesPage} / {totalPages}</span>
                <button
                  disabled={codesPage >= totalPages}
                  onClick={() => loadCodes(codesPool.id, codesPage + 1)}
                  style={{ padding: '7px 14px', border: '1px solid #E5E5E3', borderRadius: 7, background: '#fff', cursor: codesPage < totalPages ? 'pointer' : 'default', color: codesPage < totalPages ? '#111' : '#9B9B98' }}
                >
                  ถัดไป →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TRIGGERS MODAL ── */}
      {triggersPool && (
        <div
          onClick={() => setTriggersPool(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.42)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 660, background: '#fff', border: '1px solid #111111', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E5E3' }}>
              <div>
                <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.015em' }}>Triggers — {triggersPool.name}</span>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: '#9B9B98', marginTop: 3 }}>{triggersPool.id}</div>
              </div>
              <button onClick={() => setTriggersPool(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#9B9B98' }}>✕</button>
            </div>

            {/* Existing triggers */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {triggersLoading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9B9B98' }}>กำลังโหลด...</div>
              ) : triggers.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9B9B98', fontSize: 13 }}>ยังไม่มี triggers — เพิ่มด้านล่าง</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 110px 1fr 60px 60px 80px', gap: 0, padding: '8px 20px', background: '#F7F7F5', borderBottom: '1px solid #E5E5E3' }}>
                    {['Campaign', 'Trigger Type', 'Label / Condition', 'Units', 'On', 'Actions'].map((h) => (
                      <div key={h} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{h}</div>
                    ))}
                  </div>
                  {triggers.map((t, i) => (
                    <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '120px 110px 1fr 60px 60px 80px', gap: 0, padding: '12px 20px', borderTop: i ? '1px solid #E5E5E3' : undefined, alignItems: 'center' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#5C5C58', wordBreak: 'break-all' }}>{t.campaign_id}</div>
                      <div>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, padding: '2px 7px', border: '1px solid #E5E5E3', color: '#5C5C58' }}>{t.trigger_type}</span>
                      </div>
                      <div>
                        {t.label && <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{t.label}</div>}
                        {t.condition && (
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#9B9B98', wordBreak: 'break-all' }}>
                            {JSON.stringify(t.condition).slice(0, 60)}{JSON.stringify(t.condition).length > 60 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{t.units_granted}</div>
                      <div>
                        <button
                          onClick={() => handleToggleTrigger(t)}
                          style={{
                            width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: t.enabled ? '#16A34A' : '#E5E5E3',
                            position: 'relative', transition: 'background .15s',
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: 2, left: t.enabled ? 18 : 2, width: 16, height: 16,
                            borderRadius: '50%', background: '#fff', transition: 'left .15s',
                          }} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleDeleteTrigger(t.id)}
                          style={{ fontSize: 11, color: '#E63B2E', border: '1px solid rgba(230,59,46,.25)', borderRadius: 6, padding: '5px 9px', background: '#fff', cursor: 'pointer' }}
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Add trigger form */}
            <div style={{ borderTop: '1px solid #E5E5E3', padding: '16px 20px', background: '#F7F7F5' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 12 }}>+ เพิ่ม Trigger</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={labelStyle}>Campaign ID *</div>
                  <input
                    value={triggerForm.campaign_id}
                    onChange={(e) => setTriggerForm((f) => ({ ...f, campaign_id: e.target.value }))}
                    placeholder="campaign-slug"
                    style={{ ...inputStyle, fontSize: 12.5, fontFamily: "'JetBrains Mono',monospace" }}
                  />
                </div>
                <div>
                  <div style={labelStyle}>Trigger Type *</div>
                  <select
                    value={triggerForm.trigger_type}
                    onChange={(e) => setTriggerForm((f) => ({ ...f, trigger_type: e.target.value as TriggerType }))}
                    style={{ ...inputStyle, fontSize: 12.5, background: '#fff' }}
                  >
                    <option value="quiz_complete">quiz_complete</option>
                    <option value="pair_milestone">pair_milestone</option>
                    <option value="group_complete">group_complete</option>
                    <option value="checkin">checkin</option>
                    <option value="push">push</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={labelStyle}>Label</div>
                  <input
                    value={triggerForm.label}
                    onChange={(e) => setTriggerForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="ชื่อ trigger"
                    style={{ ...inputStyle, fontSize: 12.5 }}
                  />
                </div>
                <div>
                  <div style={labelStyle}>Units</div>
                  <input
                    type="number"
                    min={1}
                    value={triggerForm.units_granted}
                    onChange={(e) => setTriggerForm((f) => ({ ...f, units_granted: parseInt(e.target.value) || 1 }))}
                    style={{ ...inputStyle, fontSize: 12.5 }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={labelStyle}>Condition (JSON, ไม่บังคับ)</div>
                <textarea
                  value={triggerForm.condition}
                  onChange={(e) => setTriggerForm((f) => ({ ...f, condition: e.target.value }))}
                  rows={2}
                  placeholder={'{"score_min": 80}'}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#5C5C58' }}>
                  <input
                    type="checkbox"
                    checked={triggerForm.enabled}
                    onChange={(e) => setTriggerForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                  Enabled
                </label>
                <button
                  onClick={handleCreateTrigger}
                  disabled={savingTrigger || !triggerForm.campaign_id.trim()}
                  style={{ padding: '9px 18px', border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: triggerForm.campaign_id.trim() && !savingTrigger ? 'pointer' : 'default', background: triggerForm.campaign_id.trim() && !savingTrigger ? '#111111' : '#F0F0EE', color: triggerForm.campaign_id.trim() && !savingTrigger ? '#fff' : '#9B9B98' }}
                >
                  {savingTrigger ? 'กำลังเพิ่ม...' : '+ เพิ่ม Trigger'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' visible' : ''}`}>{toast}</div>
    </>
  );
}
