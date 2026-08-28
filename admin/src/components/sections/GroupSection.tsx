import { useEffect, useState } from 'react';
import { fetchRewardPools } from '../../api';
import type { GroupConfig, GroupArchetype, GroupCondition, EditorAxis } from '../../types';

interface RewardPool { id: string; name: string; type: string; status: string; available_codes?: number; }

interface Props {
  group: GroupConfig | undefined;
  axes: EditorAxis[];
  onChange: (group: GroupConfig | undefined) => void;
}

const DEFAULT_GROUP: GroupConfig = {
  enabled: true,
  result_mode: 'match',
  min_members: 2,
  reward_members: 5,
  max_members: 50,
  overflow_mode: 'rolling',
  batch_size: 5,
  result_locks_at: 0,
  archetypes: [],
  fallback_archetype: '',
};

const DEFAULT_ARCHETYPE: GroupArchetype = { code: '', title: '', body: '', min_group_size: 2, fallback: false };

const MONO: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#9B9B98',
  marginBottom: 5,
};

/* ── Condition Editor (advanced, collapsed by default) ─────────────────────── */
function ConditionEditor({ condition, axes, onChange }: {
  condition: GroupCondition | undefined;
  axes: EditorAxis[];
  onChange: (c: GroupCondition | undefined) => void;
}) {
  const c = condition ?? {};
  const set = (patch: Partial<GroupCondition>) => onChange({ ...c, ...patch });
  const isEmpty = !c.has_axes?.length && !c.top_axes?.length && !c.is_balanced;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* has_axes */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ ...MONO, margin: 0 }}>ในกลุ่มต้องมีสาย</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['any', 'all'] as const).map(m => (
              <button key={m} onClick={() => set({ has_mode: m })} style={{
                padding: '3px 10px', fontSize: 11.5, cursor: 'pointer', borderRadius: 4,
                border: (c.has_mode ?? 'any') === m ? '1px solid #111' : '1px solid #E5E5E3',
                background: (c.has_mode ?? 'any') === m ? '#111' : '#fff',
                color: (c.has_mode ?? 'any') === m ? '#fff' : '#5C5C58',
              }}>
                {m === 'any' ? 'มีสักคน' : 'ต้องครบ'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {axes.map(ax => {
            const active = c.has_axes?.includes(ax.id);
            return (
              <button key={ax.id} onClick={() => {
                const cur = c.has_axes ?? [];
                set({ has_axes: active ? cur.filter(x => x !== ax.id) : [...cur, ax.id] });
              }} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', borderRadius: 4, fontSize: 12.5, cursor: 'pointer',
                border: active ? `1px solid ${ax.color || '#555'}` : '1px solid #E5E5E3',
                background: active ? `${ax.color || '#555'}18` : '#fff',
                color: active ? (ax.color || '#333') : '#5C5C58',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ax.color || '#555', flexShrink: 0 }} />
                {ax.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* top_axes */}
      <div>
        <div style={{ ...MONO, margin: '0 0 5px' }}>สายที่ครองเสียงในกลุ่ม</div>
        <div style={{ fontSize: 12, color: '#9B9B98', lineHeight: 1.45, marginBottom: 8 }}>สายที่ได้คะแนนรวมสูงสุด — เจาะจงกว่า "ต้องมีสาย" ข้างบน</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {axes.map(ax => {
            const active = c.top_axes?.includes(ax.id);
            return (
              <button key={ax.id} onClick={() => {
                const cur = c.top_axes ?? [];
                set({ top_axes: active ? cur.filter(x => x !== ax.id) : [...cur, ax.id] });
              }} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', borderRadius: 4, fontSize: 12.5, cursor: 'pointer',
                border: active ? `1px solid ${ax.color || '#555'}` : '1px solid #E5E5E3',
                background: active ? `${ax.color || '#555'}18` : '#fff',
                color: active ? (ax.color || '#333') : '#5C5C58',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ax.color || '#555', flexShrink: 0 }} />
                {ax.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* is_balanced */}
      <button onClick={() => set({ is_balanced: !c.is_balanced || undefined })} style={{
        display: 'flex', alignItems: 'center', gap: 9,
        border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{
          width: 16, height: 16, border: '1px solid', flexShrink: 0,
          borderColor: c.is_balanced ? '#111' : '#C9C9C6',
          background: c.is_balanced ? '#111' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#fff',
        }}>{c.is_balanced ? '✓' : ''}</span>
        <span style={{ fontSize: 13, color: '#111' }}>กลุ่มสมดุล — ไม่มีสายไหนครองเสียง (ห้ามใช้คู่กับช่องข้างบน)</span>
      </button>

      {!isEmpty && (
        <button onClick={() => onChange(undefined)} style={{ alignSelf: 'flex-start', fontSize: 11.5, color: '#E63B2E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ล้างเงื่อนไขทั้งหมด
        </button>
      )}
    </div>
  );
}

/* ── Archetype Card ────────────────────────────────────────────────────────── */
function ArchetypeCard({ arch, index, axes, pools, poolsLoading, totalArchetypes, resultMode, onChange, onRemove, onMoveUp, onMoveDown }: {
  arch: GroupArchetype; index: number; axes: EditorAxis[];
  pools: RewardPool[]; poolsLoading: boolean; totalArchetypes: number;
  resultMode: 'match' | 'score';
  onChange: (a: GroupArchetype) => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [advOpen, setAdvOpen] = useState(false);
  const set = (patch: Partial<GroupArchetype>) => onChange({ ...arch, ...patch });

  const tiers = [
    { v: 2, l: '2 คน' },
    { v: 3, l: '3 คน' },
    { v: 4, l: '4 คน' },
    { v: 5, l: '5+ คน' },
  ];

  const condSummary = (() => {
    const c = arch.condition;
    if (!c) return '';
    const parts: string[] = [];
    if (c.has_axes?.length) parts.push(`มี ${c.has_axes.join('/')} (${c.has_mode ?? 'any'})`);
    if (c.top_axes?.length) parts.push(`top: ${c.top_axes.join('/')}`);
    if (c.is_balanced) parts.push('สมดุล');
    return parts.join(' · ');
  })();

  return (
    <div style={{ border: arch.fallback ? '1px solid #2563EB44' : '1px solid #E5E5E3', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #E5E5E3', background: arch.fallback ? '#EEF2FF' : '#F7F7F5' }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#9B9B98' }}>{index + 1}</span>
        <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-.01em', flex: 1 }}>
          {arch.title || <span style={{ color: '#9B9B98', fontWeight: 400 }}>(ยังไม่มีชื่อ)</span>}
          {arch.fallback && (
            <span style={{ marginLeft: 8, fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '.06em', padding: '3px 8px', border: '1px solid #2563EB', color: '#2563EB' }}>ผลสำรอง</span>
          )}
        </span>
        <button onClick={onMoveUp} disabled={index === 0} title="เลื่อนขึ้น" style={{ width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 10, cursor: index === 0 ? 'default' : 'pointer', color: '#5C5C58' }}>▲</button>
        <button onClick={onMoveDown} disabled={index === totalArchetypes - 1} title="เลื่อนลง" style={{ width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 10, cursor: index === totalArchetypes - 1 ? 'default' : 'pointer', color: '#5C5C58' }}>▼</button>
        <button onClick={onRemove} title="ลบ" style={{ width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 10, cursor: 'pointer', color: '#E63B2E' }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ชื่อ + ข้อความหลัก + คำอธิบาย */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 12 }}>
          <div>
            <div style={MONO}>ชื่อผล</div>
            <input value={arch.title} onChange={e => set({ title: e.target.value })}
              placeholder="เช่น ทีมบุกเบิก"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 14, fontWeight: 600, outline: 'none' }} />
          </div>
          <div>
            <div style={MONO}>ข้อความหลัก</div>
            <input value={arch.primary_text ?? ''} onChange={e => set({ primary_text: e.target.value || undefined })}
              placeholder="เช่น รอดได้ 40 วัน"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, fontWeight: 600, color: '#E63B2E', outline: 'none' }} />
          </div>
          <div>
            <div style={MONO}>คำอธิบาย</div>
            <input value={arch.body} onChange={e => set({ body: e.target.value })}
              placeholder="คำอธิบายที่โชว์ในหน้า Group Screen"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #E5E5E3', borderRadius: 9, fontSize: 13.5, outline: 'none' }} />
          </div>
        </div>

        {/* รูปภาพ */}
        <div>
          <div style={MONO}>รูปภาพ · ไม่ใส่ก็ได้</div>
          <input value={arch.image_url ?? ''} onChange={e => set({ image_url: e.target.value || undefined })}
            placeholder="https://…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #E5E5E3', borderRadius: 9, fontFamily: "'DM Mono',monospace", fontSize: 12, outline: 'none' }} />
        </div>

        {/* Tier chips */}
        <div>
          <div style={MONO}>แสดงเมื่อกลุ่มมีสมาชิก</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {tiers.map(t => (
              <button key={t.v} onClick={() => set({ min_group_size: t.v })} style={{
                padding: '6px 14px', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                border: arch.min_group_size === t.v ? '1px solid #111' : '1px solid #E5E5E3',
                background: arch.min_group_size === t.v ? '#111' : '#fff',
                color: arch.min_group_size === t.v ? '#fff' : '#5C5C58',
              }}>{t.l}</button>
            ))}
          </div>
        </div>

        {/* Score range — score mode only */}
        {resultMode === 'score' && (
          <div>
            <div style={MONO}>ช่วงคะแนนที่ได้ผลนี้</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#5C5C58' }}>
              <input
                type="number" min={0} placeholder="ไม่จำกัดต่ำสุด"
                value={arch.min_score ?? ''}
                onChange={e => set({ min_score: e.target.value ? Number(e.target.value) : undefined })}
                style={{ width: 120, padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }}
              />
              <span style={{ color: '#9B9B98' }}>–</span>
              <input
                type="number" min={0} placeholder="ไม่จำกัดสูงสุด"
                value={arch.max_score ?? ''}
                onChange={e => set({ max_score: e.target.value ? Number(e.target.value) : undefined })}
                style={{ width: 120, padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }}
              />
              <span style={{ fontSize: 12.5, color: '#9B9B98' }}>คะแนนรวมของกลุ่ม{arch.min_score != null || arch.max_score != null ? ` · ${arch.min_score ?? 0}–${arch.max_score ?? '∞'}` : ''}</span>
            </div>
            <div style={{ fontSize: 12, color: '#9B9B98', marginTop: 6 }}>ปล่อยว่างไว้ = ไม่จำกัด · ใช้คู่กับ fallback เพื่อรับช่วงที่เหลือ</div>
          </div>
        )}

        {/* Advanced condition toggle */}
        <div style={{ borderTop: '1px solid #F0F0EE', paddingTop: 12 }}>
          <button onClick={() => setAdvOpen(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#5C5C58',
          }}>
            <span>{advOpen ? '▴' : '▸'} เงื่อนไขขั้นสูง</span>
            <span style={{ fontSize: 11.5, color: '#C0C0BD' }}>ระบุให้เจาะจงกว่าจำนวนคน</span>
            {condSummary && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: '#9B9B98' }}>{condSummary}</span>}
          </button>
          {advOpen && !arch.fallback && (
            <div style={{ marginTop: 13, background: '#FAFAF9', border: '1px solid #F0F0EE', padding: 14 }}>
              <ConditionEditor condition={arch.condition} axes={axes} onChange={cond => set({ condition: cond })} />
            </div>
          )}
          {advOpen && arch.fallback && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: '#9B9B98' }}>ผลสำรองไม่ต้องตั้งเงื่อนไข — ใช้เมื่อไม่มีผลอื่น match</div>
          )}
        </div>

        {/* Fallback + Reward */}
        <div style={{ borderTop: '1px solid #F0F0EE', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => set({ fallback: !arch.fallback || undefined, condition: undefined })} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}>
            <span style={{
              width: 16, height: 16, border: '1px solid', flexShrink: 0,
              borderColor: arch.fallback ? '#2563EB' : '#C9C9C6',
              background: arch.fallback ? '#2563EB' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff',
            }}>{arch.fallback ? '✓' : ''}</span>
            <span style={{ fontSize: 13, color: '#111' }}>ใช้เป็นผลสำรอง — เมื่อกลุ่มไม่เข้าเงื่อนไขข้ออื่นเลย</span>
          </button>

          <div>
            <div style={MONO}>รางวัลเมื่อกลุ่มครบ · ไม่ผูกก็ได้</div>
            {poolsLoading ? (
              <div style={{ fontSize: 12, color: '#9B9B98' }}>กำลังโหลด pools...</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => set({ reward_pool_id: undefined })} style={{
                  padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', borderRadius: 4,
                  border: !arch.reward_pool_id ? '1px solid #111' : '1px solid #E5E5E3',
                  background: !arch.reward_pool_id ? '#111' : '#fff',
                  color: !arch.reward_pool_id ? '#fff' : '#5C5C58',
                }}>ไม่ผูก Pool</button>
                {pools.map(p => (
                  <button key={p.id} onClick={() => set({ reward_pool_id: p.id })} style={{
                    padding: '6px 12px', fontSize: 12.5, cursor: 'pointer', borderRadius: 4,
                    border: arch.reward_pool_id === p.id ? '1px solid #111' : '1px solid #E5E5E3',
                    background: arch.reward_pool_id === p.id ? '#111' : '#fff',
                    color: arch.reward_pool_id === p.id ? '#fff' : '#5C5C58',
                  }}>🎁 {p.name}{p.available_codes != null ? ` (${p.available_codes})` : ''}</button>
                ))}
                {pools.length === 0 && (
                  <span style={{ fontSize: 12, color: '#9B9B98' }}>ยังไม่มี pool — สร้างที่ Rewards ก่อน</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Coverage Panel ────────────────────────────────────────────────────────── */
function CoveragePanel({ archetypes, minMembers }: { archetypes: GroupArchetype[]; minMembers: number }) {
  const tiers = [2, 3, 4, 5].filter(t => t >= minMembers);

  return (
    <div>
      <div style={MONO}>ความครอบคลุม</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tiers.map(tier => {
          const eligible = archetypes.filter(a => a.min_group_size <= tier && (!a.max_group_size || a.max_group_size >= tier));
          const hasFallback = eligible.some(a => a.fallback);
          const used = eligible.length > 0;
          return (
            <div key={tier} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 11px',
              background: !used ? '#F7F7F5' : hasFallback ? '#F0FDF4' : '#FFF7ED',
              border: `1px solid ${!used ? '#E5E5E3' : hasFallback ? '#16A34A33' : '#F97316'}`,
            }}>
              <span style={{ fontSize: 13, color: !used ? '#9B9B98' : '#111' }}>{tier} คน</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: !used ? '#C0C0BD' : hasFallback ? '#16A34A' : '#C2410C' }}>
                {!used ? '—' : hasFallback ? '✓' : '⚠ ขาด fallback'}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: '#9B9B98', lineHeight: 1.55, marginTop: 9 }}>ทุกจำนวนคนที่เปิดใช้ ต้องมีผลสำรองอย่างน้อย 1 อัน ไม่งั้นกลุ่มนั้นจะไม่ได้ผลลัพธ์เลย</div>
    </div>
  );
}

/* ── Copy Panel ────────────────────────────────────────────────────────── */
function CopyPanel({ copy, onChange }: { copy: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const rows = [
    { k: 'group_cta',          label: 'group_cta',          effect: 'ปุ่มใน Summary screen',        placeholder: 'ดูผลกลุ่ม 👥' },
    { k: 'group_invite_title', label: 'group_invite_title', effect: 'title ใน flex message ชวน',   placeholder: 'ชวนเพื่อนมาดูผลกลุ่ม' },
    { k: 'group_invite_cta',   label: 'group_invite_cta',   effect: 'ปุ่ม CTA ในหน้า Group',       placeholder: 'ชวนเพื่อนเข้ากลุ่ม' },
    { k: 'group_waiting',      label: 'group_waiting',      effect: 'ระหว่างรอคนเข้า (min member)', placeholder: 'ต้องมีอย่างน้อย {n} คน' },
    { k: 'group_claim_cta',    label: 'group_claim_cta',    effect: 'ปุ่มรับรางวัล',               placeholder: 'รับรางวัลเลย 🎁' },
  ];

  return (
    <div style={{ borderTop: '1px solid #E5E5E3', paddingTop: 16 }}>
      <div style={{ ...MONO, margin: '0 0 4px' }}>C · ข้อความหน้ากลุ่ม</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
        {rows.map(r => (
          <div key={r.k}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#C0C0BD', marginBottom: 4 }}>{r.label}</div>
            <input value={copy[r.k] ?? ''} onChange={e => onChange(r.k, e.target.value)}
              placeholder={r.placeholder}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #E5E5E3', borderRadius: 8, fontSize: 13, outline: 'none' }} />
            <div style={{ fontSize: 11.5, color: '#9B9B98', lineHeight: 1.45, marginTop: 4 }}>{r.effect}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main GroupSection ─────────────────────────────────────────────────────── */
export default function GroupSection({ group, axes, onChange }: Props) {
  const [pools, setPools] = useState<RewardPool[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const enabled = group?.enabled ?? false;

  useEffect(() => {
    setPoolsLoading(true);
    fetchRewardPools()
      .then(data => setPools((data.pools || []) as RewardPool[]))
      .catch(() => {})
      .finally(() => setPoolsLoading(false));
  }, []);

  const set = <K extends keyof GroupConfig>(key: K, val: GroupConfig[K]) =>
    onChange({ ...(group ?? DEFAULT_GROUP), [key]: val });

  const setCopy = (k: string, v: string) => {
    const prev = (group ?? DEFAULT_GROUP) as GroupConfig & { _copy?: Record<string, string> };
    onChange({ ...(group ?? DEFAULT_GROUP), [`copy_${k}`]: v } as GroupConfig);
  };

  const handleToggle = () => {
    if (!enabled) onChange({ ...DEFAULT_GROUP, enabled: true });
    else onChange({ ...(group ?? DEFAULT_GROUP), enabled: false });
  };

  const archetypes = group?.archetypes ?? [];

  const updateArchetype = (i: number, a: GroupArchetype) => {
    const next = [...archetypes]; next[i] = a;
    const fb = next.find(x => x.fallback)?.code ?? group?.fallback_archetype ?? '';
    onChange({ ...(group ?? DEFAULT_GROUP), archetypes: next, fallback_archetype: fb });
  };

  const addArchetype = () => {
    const tier = archetypes.length === 0 ? 2 : Math.min(5, Math.max(...archetypes.map(a => a.min_group_size)));
    const newCode = `archetype_${archetypes.length + 1}`;
    set('archetypes', [...archetypes, { ...DEFAULT_ARCHETYPE, code: newCode, min_group_size: tier }]);
  };

  const removeArchetype = (i: number) => {
    const next = archetypes.filter((_, idx) => idx !== i);
    const fb = next.find(x => x.fallback)?.code ?? group?.fallback_archetype ?? '';
    onChange({ ...(group ?? DEFAULT_GROUP), archetypes: next, fallback_archetype: fb });
  };

  const moveArchetype = (i: number, dir: -1 | 1) => {
    const next = [...archetypes]; const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    set('archetypes', next);
  };

  // copy keys stored in group object with copy_ prefix
  const groupCopy: Record<string, string> = {};
  if (group) {
    for (const [k, v] of Object.entries(group as unknown as Record<string, unknown>)) {
      if (k.startsWith('copy_') && typeof v === 'string') groupCopy[k.slice(5)] = v;
    }
  }

  const hasFallbackAny = archetypes.some(a => a.fallback);
  const showWarn = enabled && archetypes.length > 0 && !hasFallbackAny;

  const overflowOptions = [
    { v: 'hard_cap' as const, label: 'ปิดกลุ่ม', note: 'คนใหม่เข้าไม่ได้' },
    { v: 'rolling' as const, label: 'แบ่ง batch', note: 'ทุก N คน = รอบใหม่รับรางวัลได้' },
    { v: 'creator_pick' as const, label: 'ให้ผู้สร้างเลือก', note: 'creator เลือกเองว่าจะเอาใคร' },
  ];

  return (
    <section style={{ padding: '32px 32px 28px', borderBottom: '1px solid #E5E5E3' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Step 4</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>ผลลัพธ์กลุ่ม</h2>
        <button onClick={handleToggle} style={{
          padding: '5px 14px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer', fontWeight: 600,
          border: enabled ? '1px solid #16A34A' : '1px solid #E5E5E3',
          background: enabled ? '#F0FDF4' : '#fff',
          color: enabled ? '#16A34A' : '#9B9B98',
        }}>{enabled ? 'ON' : 'OFF'}</button>
        {enabled && (
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#9B9B98' }}>{archetypes.length} ผลลัพธ์</span>
        )}
        <div style={{ flex: 1 }} />
        {enabled && (
          <button onClick={() => setCollapsed(v => !v)} style={{ padding: '7px 13px', border: '1px solid #E5E5E3', background: '#fff', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', color: '#5C5C58' }}>
            {collapsed ? 'กาง' : 'ย่อ'}
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 13.5, color: '#5C5C58' }}>
        แสดงปุ่ม "ดูผลกลุ่ม" ใน Summary และสร้างหน้า Group Screen · กำหนดชื่อผลลัพธ์ก่อน แล้วค่อยบอกว่ากลุ่มแบบไหนได้ผลนั้น
      </p>

      {/* OFF state */}
      {!enabled && (
        <div style={{ border: '1px dashed #C9C9C6', background: '#FAFAF9', padding: 28, textAlign: 'center', fontSize: 13.5, color: '#9B9B98', lineHeight: 1.6 }}>
          Group Mode ปิดอยู่ · Summary จะไม่มีปุ่มดูผลกลุ่ม และไม่สร้างหน้า Group Screen
        </div>
      )}

      {/* ON state */}
      {enabled && !collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* A · ตั้งค่าพื้นฐาน */}
          <div style={{ border: '1px solid #E5E5E3', background: '#fff' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid #E5E5E3', background: '#F7F7F5', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>
              A · ตั้งค่าพื้นฐาน
            </div>

            {/* ประเภทผลลัพธ์ */}
            <div style={{ padding: 16, borderBottom: '1px solid #F0F0EE' }}>
              <div style={MONO}>ประเภทผลลัพธ์</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { v: 'match' as const, label: 'เลือกจุดหมาย', hint: 'กลุ่มได้ชื่อ archetype เช่น บาหลี, ญี่ปุ่น' },
                  { v: 'score' as const, label: 'คำนวณคะแนน', hint: 'กลุ่มได้ตัวเลข เช่น รอดได้ 14 วัน' },
                ].map(rm => (
                  <button key={rm.v} onClick={() => set('result_mode', rm.v)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                    padding: '10px 16px', borderRadius: 8, cursor: 'pointer', flex: 1,
                    border: group?.result_mode === rm.v ? '1px solid #111' : '1px solid #E5E5E3',
                    background: group?.result_mode === rm.v ? '#111' : '#fff',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: group?.result_mode === rm.v ? '#fff' : '#111' }}>{rm.label}</span>
                    <span style={{ fontSize: 12, color: group?.result_mode === rm.v ? 'rgba(255,255,255,.6)' : '#9B9B98' }}>{rm.hint}</span>
                  </button>
                ))}
              </div>
              {group?.result_mode === 'score' && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ ...MONO, margin: 0 }}>หน่วย</span>
                  <input value={(group as GroupConfig & { unit?: string }).unit ?? ''} onChange={e => onChange({ ...group, unit: e.target.value } as GroupConfig)}
                    placeholder="วัน"
                    style={{ width: 110, padding: '9px 11px', border: '1px solid #E5E5E3', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                  <span style={{ fontSize: 12.5, color: '#9B9B98' }}>ผลลัพธ์จะแสดงเป็น "รอดได้ 14 วัน" — คะแนนรวมจากทุกคนในกลุ่ม</span>
                </div>
              )}
            </div>

            {/* จำนวนสมาชิก */}
            <div style={{ padding: 16, borderBottom: '1px solid #F0F0EE' }}>
              <div style={MONO}>จำนวนสมาชิก</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5, color: '#5C5C58' }}>
                <span>ดูผลได้ตั้งแต่</span>
                <input type="number" min={2} max={10} value={group?.min_members ?? 2} onChange={e => set('min_members', parseInt(e.target.value) || 2)}
                  style={{ width: 56, padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }} />
                <span>คน · รับรางวัลเมื่อครบ</span>
                <input type="number" min={2} max={50} value={group?.reward_members ?? 5} onChange={e => set('reward_members', parseInt(e.target.value) || 5)}
                  style={{ width: 56, padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }} />
                <span>คน · รับได้สูงสุด</span>
                <input type="number" min={2} max={999} value={group?.max_members ?? 50} onChange={e => set('max_members', parseInt(e.target.value) || 50)}
                  style={{ width: 62, padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }} />
                <span>คน</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#9B9B98', marginTop: 8 }}>ดูผลได้ = เห็นชื่อผลลัพธ์ของกลุ่ม · รับรางวัล = ปุ่มรับรางวัลจะขึ้น</div>
            </div>

            {/* Overflow */}
            <div style={{ padding: '16px 16px 4px' }}>
              <div style={MONO}>เมื่อกลุ่มเกินจำนวนสูงสุด</div>
              <div style={{ border: '1px solid #E5E5E3' }}>
                {overflowOptions.map((ov, i) => (
                  <button key={ov.v} onClick={() => set('overflow_mode', ov.v)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', border: 0,
                    borderTop: i > 0 ? '1px solid #F0F0EE' : 'none',
                    background: group?.overflow_mode === ov.v ? '#F7F7F5' : '#fff',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: group?.overflow_mode === ov.v ? '5px solid #111' : '1.5px solid #C9C9C6',
                      background: '#fff',
                    }} />
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: '#111', minWidth: 120 }}>{ov.label}</span>
                    <span style={{ fontSize: 12.5, color: '#9B9B98' }}>{ov.note}</span>
                  </button>
                ))}
              </div>
              {group?.overflow_mode === 'rolling' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 0 14px', fontSize: 13.5, color: '#5C5C58' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#C0C0BD' }}>└</span>
                  <span>จำนวนคนต่อรอบ</span>
                  <input type="number" min={2} max={100} value={group?.batch_size ?? 5} onChange={e => set('batch_size', parseInt(e.target.value) || 5)}
                    style={{ width: 56, padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }} />
                  <span>คน</span>
                </div>
              )}
            </div>
          </div>

          {/* B · ผลลัพธ์กลุ่ม */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>B · ผลลัพธ์กลุ่ม</span>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>กำหนดผลลัพธ์ที่เป็นไปได้ทั้งหมด</span>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#9B9B98' }}>
              ระบบจะเลือกผลที่ตรงกับส่วนผสมของกลุ่มมากที่สุด · เรียงจากบนลงล่าง = เจาะจงที่สุด → ผลสำรอง
            </p>

            {showWarn && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#FFF7ED', border: '1px solid #F97316', marginBottom: 14, fontSize: 13, color: '#C2410C' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>⚠</span>
                <span>ต้องมีผลสำรอง (fallback) อย่างน้อย 1 อัน ไม่งั้นบางกลุ่มจะไม่ได้ผลลัพธ์เลย</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>
              {/* Archetype list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {archetypes.map((arch, i) => (
                  <ArchetypeCard
                    key={i} arch={arch} index={i} axes={axes}
                    pools={pools} poolsLoading={poolsLoading}
                    totalArchetypes={archetypes.length}
                    resultMode={group?.result_mode ?? 'match'}
                    onChange={a => updateArchetype(i, a)}
                    onRemove={() => removeArchetype(i)}
                    onMoveUp={() => moveArchetype(i, -1)}
                    onMoveDown={() => moveArchetype(i, 1)}
                  />
                ))}
                <button onClick={addArchetype} style={{ padding: 15, border: '1px dashed #C9C9C6', background: '#fff', fontSize: 14, color: '#5C5C58', cursor: 'pointer' }}>
                  + เพิ่มผลลัพธ์กลุ่ม
                </button>
              </div>

              {/* Right sidebar: Coverage + Copy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 70 }}>
                <CoveragePanel archetypes={archetypes} minMembers={group?.min_members ?? 2} />
                <CopyPanel copy={groupCopy} onChange={setCopy} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
