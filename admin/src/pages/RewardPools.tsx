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
} from '../api';

type PoolType = 'code_pool' | 'single_code' | 'raffle' | 'voucher_link' | 'points_bonus';
type PoolStatus = 'active' | 'draft' | 'exhausted' | 'expired';

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

const TYPE_INFO: Record<PoolType, { label: string; color: string; icon: string }> = {
  code_pool: { label: 'Code Pool', color: '#2563EB', icon: '🎫' },
  single_code: { label: 'Single Code', color: '#16A34A', icon: '🏷️' },
  raffle: { label: 'Raffle', color: '#9333EA', icon: '🎲' },
  voucher_link: { label: 'Voucher Link', color: '#D97706', icon: '🔗' },
  points_bonus: { label: 'Points Bonus', color: '#E63B2E', icon: '⭐' },
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
};

export default function RewardPools() {
  const navigate = useNavigate();
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

  useEffect(() => { loadPools(); }, []);

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
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        expires_at: form.expires_at || undefined,
        status: form.status,
        meta: form.meta,
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

  const setMeta = (key: string, val: unknown) => {
    setForm((f) => ({ ...f, meta: { ...f.meta, [key]: val } }));
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
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>Krob · Host Console</span>
        <span style={{ width: 1, height: 16, background: '#E5E5E3' }} />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>Rewards / คูปอง</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={openCreate}
          style={{ padding: '9px 16px', border: 0, borderRadius: 9, background: '#111111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + สร้าง Pool ใหม่
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #E5E5E3' }}>
        <div style={{ padding: '18px 28px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Pools ทั้งหมด</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6 }}>{pools.length}</div>
        </div>
        <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#16A34A' }}>Active</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6, color: '#16A34A' }}>{pools.filter((p) => p.status === 'active').length}</div>
        </div>
        <div style={{ padding: '18px 28px', borderLeft: '1px solid #E5E5E3' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>รหัสที่แจกไปแล้ว</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 500, letterSpacing: '-.02em', marginTop: 6 }}>
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
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>ยังไม่มี Reward Pool</div>
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
                <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{h}</div>
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
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#C9C9C6', marginTop: 3 }}>{p.id}</div>
                  </div>
                  <div>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', padding: '3px 8px', border: `1px solid ${ti.color}`, color: ti.color }}>
                      {ti.icon} {ti.label}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', padding: '3px 8px', borderRadius: 99, background: si.bg, color: si.color }}>
                      {si.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{p.total_codes ?? '—'}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: (p.available_codes ?? 0) === 0 ? '#E63B2E' : '#16A34A' }}>{p.available_codes ?? '—'}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{p.total_claims ?? 0}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(p.type === 'code_pool' || p.type === 'raffle') && (
                      <button
                        onClick={() => openManageCodes(p)}
                        style={{ fontSize: 12, color: '#5C5C58', border: '1px solid #E5E5E3', borderRadius: 7, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}
                      >
                        Codes
                      </button>
                    )}
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.42)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 540, background: '#fff', border: '1px solid #111111', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E5E3', position: 'sticky', top: 0, background: '#fff' }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.015em' }}>{editPool ? 'แก้ไข Pool' : 'สร้าง Reward Pool'}</span>
              <button onClick={() => setShowModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#9B9B98' }}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>ชื่อ Pool *</div>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น ส่วนลด 200 บาท"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
                />
              </div>

              {/* Type */}
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>ประเภท *</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
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
                        <span style={{ fontSize: 12, fontWeight: 600, color: on ? ti.color : '#111' }}>{ti.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>คำอธิบาย</div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="รายละเอียดรางวัลนี้"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Expires at */}
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>หมดอายุ (ไม่บังคับ)</div>
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
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>รหัสส่วนลด</div>
                  <input
                    value={(form.meta.code as string) || ''}
                    onChange={(e) => setMeta('code', e.target.value)}
                    placeholder="SAVE200"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, fontFamily: "'DM Mono',monospace", outline: 'none' }}
                  />
                </div>
              )}
              {form.type === 'voucher_link' && (
                <>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>URL</div>
                    <input
                      value={(form.meta.url as string) || ''}
                      onChange={(e) => setMeta('url', e.target.value)}
                      placeholder="https://shop.example.com/redeem?code=xxx"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>ข้อความแสดง</div>
                    <input
                      value={(form.meta.discount_text as string) || ''}
                      onChange={(e) => setMeta('discount_text', e.target.value)}
                      placeholder="ส่วนลด 200 บาท"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13, outline: 'none' }}
                    />
                  </div>
                </>
              )}
              {form.type === 'points_bonus' && (
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>Bonus Points</div>
                  <input
                    type="number"
                    value={(form.meta.bonus_points as number) || 0}
                    onChange={(e) => setMeta('bonus_points', parseInt(e.target.value) || 0)}
                    min={0}
                    style={{ width: 120, padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
                  />
                </div>
              )}
              {(form.type === 'code_pool' || form.type === 'raffle') && (
                <div style={{ background: '#F7F7F5', border: '1px solid #E5E5E3', borderRadius: 9, padding: '12px 14px', fontSize: 12.5, color: '#5C5C58' }}>
                  สร้าง pool ก่อน จากนั้นกด <strong>Codes</strong> เพื่อนำเข้ารหัสส่วนลด (ทีละหลายรหัสได้)
                </div>
              )}

              {/* Status */}
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 6 }}>Status</div>
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

      {/* Manage Codes Modal */}
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
              <div>
                <span style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.015em' }}>จัดการ Codes — {codesPool.name}</span>
              </div>
              <button onClick={() => setCodesPool(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#9B9B98' }}>✕</button>
            </div>

            {/* Stats bar */}
            {codeStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #E5E5E3' }}>
                <div style={{ padding: '12px 18px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>ทั้งหมด</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 500, marginTop: 4 }}>{codeStats.total_codes}</div>
                </div>
                <div style={{ padding: '12px 18px', borderLeft: '1px solid #E5E5E3' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#16A34A' }}>ว่างอยู่</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 500, marginTop: 4, color: '#16A34A' }}>{codeStats.available_codes}</div>
                </div>
                <div style={{ padding: '12px 18px', borderLeft: '1px solid #E5E5E3' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>แจกไปแล้ว</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 500, marginTop: 4 }}>{codeStats.total_claims}</div>
                </div>
              </div>
            )}

            {/* Import codes */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E3' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98', marginBottom: 8 }}>นำเข้า Codes (1 รหัสต่อบรรทัด)</div>
              <textarea
                value={codesInput}
                onChange={(e) => setCodesInput(e.target.value)}
                rows={4}
                placeholder={'SAVE200A\nSAVE200B\nSAVE200C'}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 12.5, fontFamily: "'DM Mono',monospace", outline: 'none', resize: 'vertical' }}
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

            {/* Codes table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {codes.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9B9B98', fontSize: 13.5 }}>ยังไม่มี codes ใน pool นี้</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 20px', background: '#F7F7F5', borderBottom: '1px solid #E5E5E3' }}>
                    {['Code', 'Claimed by', 'Claimed at'].map((h) => (
                      <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>{h}</div>
                    ))}
                  </div>
                  {codes.map((c, i) => (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 20px', borderTop: i ? '1px solid #E5E5E3' : undefined, alignItems: 'center' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, letterSpacing: '.04em' }}>{c.code}</div>
                      <div style={{ fontSize: 12, color: c.claimed_by ? '#5C5C58' : '#9B9B98' }}>{c.claimed_by || '—'}</div>
                      <div style={{ fontSize: 12, color: '#9B9B98' }}>{c.claimed_at ? new Date(c.claimed_at).toLocaleDateString('th-TH') : '—'}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid #E5E5E3' }}>
                <button
                  disabled={codesPage <= 1}
                  onClick={() => loadCodes(codesPool.id, codesPage - 1)}
                  style={{ padding: '7px 14px', border: '1px solid #E5E5E3', borderRadius: 7, background: '#fff', cursor: codesPage > 1 ? 'pointer' : 'default', color: codesPage > 1 ? '#111' : '#9B9B98' }}
                >
                  ← ก่อนหน้า
                </button>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#9B9B98' }}>{codesPage} / {totalPages}</span>
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

      <div className={`toast${toast ? ' visible' : ''}`}>{toast}</div>
    </>
  );
}
