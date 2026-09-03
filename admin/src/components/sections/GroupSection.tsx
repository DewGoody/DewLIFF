import { useEffect, useState } from 'react';
import { fetchRewardPools } from '../../api';
import type { GroupConfig, GroupArchetype, GroupCondition, EditorAxis } from '../../types';
import ImageUploader from '../ImageUploader';

interface RewardPool { id: string; name: string; type: string; status: string; available_codes?: number; }

interface Props {
  group: GroupConfig | undefined;
  axes: EditorAxis[];
  onChange: (group: GroupConfig | undefined) => void;
  view?: 'settings' | 'archetypes';
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
  fontFamily: "'JetBrains Mono',monospace",
  fontSize: 10.5,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#A0A5AA',
  marginBottom: 5,
};

/* ── Condition block types ─────────────────────────────────────────────────── */
type CondBlockType = 'has' | 'top' | 'bal' | 'dom' | 'cnt' | 'max' | 'size';

const COND_BLOCK_META: { type: CondBlockType; label: string; chipLabel: string; fullLabel: string; desc: string }[] = [
  { type: 'has', label: 'has', chipLabel: 'มีสายใด',   fullLabel: 'ทีมต้องมีสายเหล่านี้',          desc: 'นับจากสายเด่นของสมาชิกแต่ละคน · "ใดสายหนึ่ง" = ผ่านถ้ามีแม้สายเดียว' },
  { type: 'top', label: 'top', chipLabel: 'สายเด่น',  fullLabel: 'สายที่ครองเสียงส่วนใหญ่ต้องเป็น', desc: 'ดูจากสายที่มีสมาชิกมากที่สุด แล้วตรวจว่าอยู่ในลิสต์ที่ตั้งไว้หรือเปล่า' },
  { type: 'bal', label: 'bal', chipLabel: 'สมดุล',    fullLabel: 'ความสมดุลของทีม',               desc: 'สมดุล = ไม่มีสายไหนมีสมาชิกเกินกว่าสัดส่วนที่ตั้งไว้' },
  { type: 'dom', label: 'dom', chipLabel: '% สายเด่น', fullLabel: 'สายเด่นครองกี่ % ของทีม',       desc: 'ตรวจว่าสายที่มีสมาชิกมากสุดนั้น มีสัดส่วนถึงเกณฑ์ที่ตั้งหรือเปล่า' },
  { type: 'cnt', label: 'cnt', chipLabel: 'คนต่อสาย', fullLabel: 'ต้องมีคนในสายนั้นอย่างน้อย',    desc: 'ใช้คู่กับ "มีสายใด" หรือ "สายเด่น" ด้านบน เพื่อกำหนดจำนวนขั้นต่ำ' },
  { type: 'max', label: 'max', chipLabel: 'หลากหลาย', fullLabel: 'จำนวนสายในทีมไม่เกิน',           desc: 'ทีมที่มีสายหลากหลายเกินกว่านี้จะไม่เข้าเงื่อนไข' },
  { type: 'size', label: 'size', chipLabel: 'ขนาดทีม', fullLabel: 'จำนวนสมาชิกในทีม',             desc: 'เว้นช่องขวาว่าง = ไม่จำกัดเพดาน' },
];

function isBlockActive(type: CondBlockType, c: GroupCondition | undefined, arch: GroupArchetype): boolean {
  if (!c && type !== 'size') return false;
  if (type === 'has') return !!(c?.has_axes !== undefined);
  if (type === 'top') return !!(c?.top_axes !== undefined);
  if (type === 'bal') return c?.is_balanced !== undefined;
  if (type === 'dom') return c?.dominant_threshold != null;
  if (type === 'cnt') return c?.min_members_with_axis != null;
  if (type === 'max') return c?.max_distinct != null;
  if (type === 'size') return arch.max_group_size != null;
  return false;
}

/* ── Condition Block ───────────────────────────────────────────────────────── */
function CondBlock({ type, arch, axes, onChange, onRemove }: {
  type: CondBlockType;
  arch: GroupArchetype;
  axes: EditorAxis[];
  onChange: (patch: Partial<GroupArchetype>) => void;
  onRemove: () => void;
}) {
  const c = arch.condition ?? {};
  const setC = (patch: Partial<GroupCondition>) => {
    onChange({ condition: { ...c, ...patch } });
  };

  const meta = COND_BLOCK_META.find(m => m.type === type)!;

  const axisChipStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer',
    border: `1px solid ${active ? color : '#D9D9D6'}`,
    background: active ? `${color}18` : '#fff',
    color: active ? color : '#555',
    fontWeight: active ? 600 : 400,
  });

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
    border: `1px solid ${active ? '#1F7A6F' : '#D9D9D6'}`,
    background: active ? '#1F7A6F' : '#fff',
    color: active ? '#fff' : '#555',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ border: '1px solid #E7E7E3', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {/* Block header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FBFBF9', borderBottom: '1px solid #EFEFEC' }}>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 4,
          background: '#EBF5F2', color: '#1F7A6F', border: '1px solid #CBE5DE',
        }}>{meta.label}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111' }}>{meta.fullLabel}</span>
        <button onClick={onRemove} style={{ border: '1px solid #EFEFEC', borderRadius: 7, background: '#FFFFFF', padding: '4px 9px', fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: '#B02A3F', cursor: 'pointer' }}>ลบ</button>
      </div>

      {/* Block body */}
      <div style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {type === 'has' && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {axes.map(ax => {
                const active = c.has_axes?.includes(ax.id) ?? false;
                return (
                  <button key={ax.id} onClick={() => {
                    const cur = c.has_axes ?? [];
                    setC({ has_axes: active ? cur.filter(x => x !== ax.id) : [...cur, ax.id] });
                  }} style={axisChipStyle(active, ax.color ?? '#555')}>
                    {ax.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['any', 'all'] as const).map(m => (
                <button key={m} onClick={() => setC({ has_mode: m })} style={toggleStyle((c.has_mode ?? 'any') === m)}>
                  {m === 'any' ? 'มีสายใดสายหนึ่ง' : 'ต้องมีครบทุกสาย'}
                </button>
              ))}
            </div>
          </>
        )}

        {type === 'top' && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {axes.map(ax => {
                const active = c.top_axes?.includes(ax.id) ?? false;
                return (
                  <button key={ax.id} onClick={() => {
                    const cur = c.top_axes ?? [];
                    setC({ top_axes: active ? cur.filter(x => x !== ax.id) : [...cur, ax.id] });
                  }} style={axisChipStyle(active, ax.color ?? '#555')}>
                    {ax.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range" min={1} max={Math.max(axes.length, 1)} value={c.top_n ?? 1}
                onChange={e => setC({ top_n: parseInt(e.target.value) })}
                style={{ flex: 1, accentColor: '#1F7A6F' }}
              />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#16181A', border: '1px solid #DEDEDA', borderRadius: 6, background: '#F4F4F2', padding: '3px 8px', flexShrink: 0 }}>
                top {c.top_n ?? 1}
              </span>
            </div>
          </>
        )}

        {type === 'bal' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {([true, false] as const).map(val => (
              <button key={String(val)} onClick={() => setC({ is_balanced: val })} style={toggleStyle(c.is_balanced === val)}>
                {val ? 'ต้องสมดุล' : 'ต้องไม่สมดุล'}
              </button>
            ))}
          </div>
        )}

        {type === 'dom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range" min={10} max={100} step={5}
              value={c.dominant_threshold ?? 50}
              onChange={e => setC({ dominant_threshold: parseInt(e.target.value) })}
              style={{ flex: 1, accentColor: '#1F7A6F' }}
            />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#16181A', border: '1px solid #DEDEDA', borderRadius: 6, background: '#F4F4F2', padding: '3px 8px', flexShrink: 0 }}>
              {c.dominant_threshold ?? 50}%
            </span>
          </div>
        )}

        {type === 'cnt' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range" min={1} max={10}
              value={c.min_members_with_axis ?? 2}
              onChange={e => setC({ min_members_with_axis: parseInt(e.target.value) })}
              style={{ flex: 1, accentColor: '#1F7A6F' }}
            />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#16181A', border: '1px solid #DEDEDA', borderRadius: 6, background: '#F4F4F2', padding: '3px 8px', flexShrink: 0 }}>
              {c.min_members_with_axis ?? 2} คน
            </span>
          </div>
        )}

        {type === 'max' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range" min={1} max={Math.max(axes.length, 5)}
              value={c.max_distinct ?? 3}
              onChange={e => setC({ max_distinct: parseInt(e.target.value) })}
              style={{ flex: 1, accentColor: '#1F7A6F' }}
            />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#16181A', border: '1px solid #DEDEDA', borderRadius: 6, background: '#F4F4F2', padding: '3px 8px', flexShrink: 0 }}>
              {c.max_distinct ?? 3} สาย
            </span>
          </div>
        )}

        {type === 'size' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min={1} max={999} value={arch.min_group_size || ''}
              onChange={e => onChange({ min_group_size: parseInt(e.target.value) || 2 })}
              placeholder="—"
              style={{ width: 64, padding: '6px 8px', border: '1px solid #E5E5E3', borderRadius: 7, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }}
            />
            <span style={{ fontSize: 12.5, color: '#9B9B98' }}>ถึง</span>
            <input
              type="number" min={1} max={999} value={arch.max_group_size ?? ''}
              onChange={e => onChange({ max_group_size: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="—"
              style={{ width: 64, padding: '6px 8px', border: '1px solid #E5E5E3', borderRadius: 7, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }}
            />
            <span style={{ fontSize: 12.5, color: '#9B9B98' }}>คน</span>
          </div>
        )}

        <div style={{ fontSize: 11, color: '#9B9B98', lineHeight: 1.5 }}>{meta.desc}</div>
      </div>
    </div>
  );
}

/* ── Condition summary string (readable Thai) ─────────────────────────────── */
function condSummary(arch: GroupArchetype): string {
  const c = arch.condition;
  const hasCond = c && Object.keys(c).length > 0;
  if (!hasCond && arch.max_group_size == null) return '';
  const parts: string[] = [];
  if (c?.has_axes !== undefined) {
    const n = c.has_axes?.length ?? 0;
    const mode = c.has_mode === 'all' ? 'ครบทุกสาย' : 'ใดสายหนึ่ง';
    parts.push(n > 0 ? `มี ${n} สาย (${mode})` : `มีสาย (${mode})`);
  }
  if (c?.top_axes !== undefined) {
    const n = c.top_axes?.length ?? 0;
    parts.push(n > 0 ? `สายเด่นใน ${n} สายที่เลือก (top ${c.top_n ?? 1})` : `สายเด่น (top ${c.top_n ?? 1})`);
  }
  if (c?.is_balanced !== undefined) parts.push(c.is_balanced ? 'ทีมสมดุล' : 'ทีมไม่สมดุล');
  if (c?.dominant_threshold != null) parts.push(`สายเด่นครอง ≥${c.dominant_threshold}%`);
  if (c?.min_members_with_axis != null) parts.push(`มีคนในสายนั้น ≥${c.min_members_with_axis} คน`);
  if (c?.max_distinct != null) parts.push(`หลากหลายไม่เกิน ${c.max_distinct} สาย`);
  if (arch.max_group_size != null) {
    const minS = arch.min_group_size ?? 2;
    parts.push(`ขนาดทีม ${minS}–${arch.max_group_size} คน`);
  }
  return parts.join(' · ');
}

/* ── Compact condition summary (mono, for collapsed card) ─────────────────── */
function condSummaryCompact(arch: GroupArchetype): string {
  const c = arch.condition;
  const parts: string[] = [];
  if (c?.has_axes !== undefined) {
    const n = c.has_axes?.length ?? 0;
    const mode = c.has_mode ?? 'any';
    parts.push(`has[${n}]·${mode}`);
  }
  if (c?.top_axes !== undefined) {
    const n = c.top_axes?.length ?? 0;
    parts.push(`top[${n}]·${c.top_n ?? 1}`);
  }
  if (c?.is_balanced !== undefined) parts.push('bal');
  if (c?.dominant_threshold != null) parts.push(`dom≥${c.dominant_threshold}%`);
  if (c?.min_members_with_axis != null) parts.push(`cnt ${c.min_members_with_axis}`);
  if (c?.max_distinct != null) parts.push(`max ${c.max_distinct}`);
  if (arch.max_group_size != null) {
    const min = arch.min_group_size ?? 2;
    parts.push(`size ${min}+`);
  }
  if (parts.length === 0) return '';
  return `condition: ${parts.join(' · ')}`;
}

/* ── Archetype trace (match mode only) ─────────────────────────────────────── */
function traceArchetypes(archetypes: GroupArchetype[], rosterAxes: string[]): { arch: GroupArchetype; pass: boolean; reason: string }[] {
  const n = rosterAxes.length;
  const counts: Record<string, number> = {};
  for (const id of rosterAxes) counts[id] = (counts[id] || 0) + 1;
  const uniqueAxes = Object.keys(counts).length;
  const maxCount = uniqueAxes > 0 ? Math.max(...Object.values(counts)) : 0;
  const dominantPct = n > 0 ? maxCount / n * 100 : 0;

  return archetypes.map(arch => {
    if (arch.fallback) return { arch, pass: true, reason: 'fallback — ใช้เมื่อไม่มีอันอื่น match' };
    const c = arch.condition;
    if (!c) return { arch, pass: false, reason: 'ไม่มีเงื่อนไข' };
    const reasons: string[] = [];
    let pass = true;

    if (c.has_axes?.length) {
      const mode = c.has_mode ?? 'any';
      const ok = mode === 'any' ? c.has_axes.some(id => counts[id]) : c.has_axes.every(id => counts[id]);
      reasons.push(`has(${mode}): ${ok ? '✓' : '✗'}`);
      if (!ok) pass = false;
    }
    if (c.top_axes?.length) {
      const topN = c.top_n ?? 1;
      const sortedAxes = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0]);
      const ok = c.top_axes.some(id => sortedAxes.includes(id));
      reasons.push(`top(${topN}): ${ok ? '✓' : '✗'}`);
      if (!ok) pass = false;
    }
    if (c.is_balanced !== undefined) {
      const threshold = c.dominant_threshold ?? 60;
      const balanced = uniqueAxes > 0 && dominantPct < threshold;
      const ok = c.is_balanced === balanced;
      reasons.push(`bal: ${ok ? '✓' : '✗'} (${Math.round(dominantPct)}%)`);
      if (!ok) pass = false;
    }
    if (c.dominant_threshold != null) {
      const ok = dominantPct >= c.dominant_threshold;
      reasons.push(`dom≥${c.dominant_threshold}%: ${ok ? '✓' : '✗'} (${Math.round(dominantPct)}%)`);
      if (!ok) pass = false;
    }
    if (c.min_members_with_axis != null) {
      const ok = Object.values(counts).some(cnt => cnt >= (c.min_members_with_axis ?? 1));
      reasons.push(`cnt≥${c.min_members_with_axis}: ${ok ? '✓' : '✗'}`);
      if (!ok) pass = false;
    }
    if (c.max_distinct != null) {
      const ok = uniqueAxes <= c.max_distinct;
      reasons.push(`distinct≤${c.max_distinct}: ${ok ? '✓' : '✗'}`);
      if (!ok) pass = false;
    }
    if (arch.max_group_size != null) {
      const min = arch.min_group_size ?? 2;
      const ok = n >= min && n <= arch.max_group_size;
      reasons.push(`size ${min}-${arch.max_group_size}: ${ok ? '✓' : '✗'} (${n})`);
      if (!ok) pass = false;
    }
    return { arch, pass, reason: reasons.join(' · ') || '—' };
  });
}

/* ── TeamSimulator ─────────────────────────────────────────────────────────── */
function TeamSimulator({ axes, archetypes, maxMembers }: {
  axes: EditorAxis[];
  archetypes: GroupArchetype[];
  maxMembers: number;
}) {
  const [roster, setRoster] = useState<string[]>([]);

  const counts: Record<string, number> = {};
  for (const id of roster) counts[id] = (counts[id] || 0) + 1;
  const uniqueCount = Object.keys(counts).length;
  const maxCount = roster.length > 0 ? Math.max(...Object.values(counts)) : 0;
  const dominantPct = roster.length > 0 ? Math.round(maxCount / roster.length * 100) : 0;
  const dominantAx = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const dominantAxis = axes.find(a => a.id === dominantAx?.[0]);
  const isBalanced = uniqueCount > 1 && dominantPct < 60;
  const atMax = roster.length >= maxMembers;

  const trace = traceArchetypes(archetypes, roster);
  const winner = trace.find(t => t.pass);

  return (
    <div style={{ border: '1px solid #E7E7E3', borderRadius: 12, background: '#FFFFFF', padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>จำลองทีมสมมติ</div>
          <div style={{ fontSize: 10.5, color: '#8A8F94', marginTop: 2 }}>เพิ่มสมาชิกทีละสาย แล้วดูว่าทีมนี้จะได้ผลอะไร</div>
        </div>
        {roster.length > 0 && (
          <button onClick={() => setRoster([])} style={{ border: '1px solid #EFEFEC', borderRadius: 6, background: '#fff', padding: '4px 9px', fontSize: 10, color: '#5F6469', cursor: 'pointer' }}>ล้างทีม</button>
        )}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: atMax ? '#C5C5C2' : '#5C5C58' }}>
          + เพิ่มสมาชิก {atMax && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>(ครบ {maxMembers} คนแล้ว)</span>}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {axes.map(ax => (
            <button key={ax.id} onClick={() => !atMax && setRoster(prev => [...prev, ax.id])} style={{
              border: `1px solid ${ax.color}55`, borderRadius: 7, background: atMax ? '#F7F7F5' : `${ax.color}15`,
              padding: '5px 11px', fontSize: 11.5, cursor: atMax ? 'default' : 'pointer',
              color: atMax ? '#C5C5C2' : ax.color, fontWeight: 600,
            }}>+ {ax.label}</button>
          ))}
        </div>
      </div>

      {/* Roster chips */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minHeight: 28 }}>
        {roster.length === 0 ? (
          <span style={{ fontSize: 11, color: '#C0C4C8' }}>ยังไม่มีสมาชิก — กดสายด้านบนเพื่อเพิ่ม</span>
        ) : (
          roster.map((axId, idx) => {
            const ax = axes.find(a => a.id === axId);
            return (
              <span key={idx} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                border: `1px solid ${ax?.color ?? '#DEDEDA'}44`, borderRadius: 6,
                background: `${ax?.color ?? '#F4F4F2'}18`, padding: '4px 8px', fontSize: 11.5, color: ax?.color ?? '#5F6469',
              }}>
                {ax?.label ?? axId}
                <button onClick={() => setRoster(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: '#B02A3F', lineHeight: 1 }}>✕</button>
              </span>
            );
          })
        )}
      </div>

      {/* Stats */}
      {roster.length > 0 && (
        <div style={{ borderRadius: 9, background: '#FBFBF9', border: '1px solid #EFEFEC', overflow: 'hidden' }}>
          {[
            { label: 'สมาชิก', value: `${roster.length} คน` },
            { label: 'สายที่ทีมมี', value: `${uniqueCount} / ${axes.length} สาย` },
            { label: 'สัดส่วนสายเด่น', value: dominantAxis ? `${dominantAxis.label} ${dominantPct}%` : '—', color: dominantAxis?.color },
            { label: 'ความสมดุล', value: roster.length < 2 ? '—' : isBalanced ? 'สมดุล' : 'ไม่สมดุล', badge: roster.length >= 2 ? (isBalanced ? 'green' : 'orange') : undefined },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 11px', borderTop: i > 0 ? '1px solid #F3F3F1' : 'none' }}>
              <span style={{ fontSize: 10.5, color: '#5F6469' }}>{s.label}</span>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: s.color ?? (s.badge === 'green' ? '#16A34A' : s.badge === 'orange' ? '#C2410C' : '#16181A') }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Trace */}
      {roster.length > 0 && archetypes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {winner && (
            <div style={{ padding: '9px 11px', borderRadius: 9, background: '#EBF5F2', border: '1px solid #CFE6DF' }}>
              <div style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", color: '#1F7A6F', marginBottom: 3 }}>ผลที่ทีมนี้จะได้</div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{winner.arch.title}</div>
              <div style={{ fontSize: 10.5, color: '#5F6469', marginTop: 2 }}>{winner.reason}</div>
            </div>
          )}
          <div style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", color: '#A0A5AA' }}>ไล่เงื่อนไขจากบนลงล่าง</div>
          {trace.map((t, i) => (
            <div key={i} style={{
              fontSize: 10.5, padding: '5px 9px', borderRadius: 6, lineHeight: 1.5,
              background: t.pass ? '#EBF5F2' : '#FBFBF9',
              border: `1px solid ${t.pass ? '#CFE6DF' : '#EFEFEC'}`,
              color: t.pass ? '#1F7A6F' : '#8A8F94',
            }}>
              <span style={{ fontWeight: 700 }}>{i + 1}. {t.arch.title || t.arch.code || `(ผลที่ ${i + 1})`}</span>
              {' — '}{t.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ArchetypeCard (full redesign) ─────────────────────────────────────────── */
function ArchetypeCard({ arch, index, axes, pools, poolsLoading, totalArchetypes, onChange, onRemove, onMoveUp, onMoveDown }: {
  arch: GroupArchetype; index: number; axes: EditorAxis[];
  pools: RewardPool[]; poolsLoading: boolean; totalArchetypes: number;
  onChange: (a: GroupArchetype) => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [resultOpen, setResultOpen] = useState(false);
  const set = (patch: Partial<GroupArchetype>) => onChange({ ...arch, ...patch });

  const activeBlocks = COND_BLOCK_META.filter(m => isBlockActive(m.type, arch.condition, arch));
  const inactiveBlocks = COND_BLOCK_META.filter(m => !isBlockActive(m.type, arch.condition, arch));

  const addBlock = (type: CondBlockType) => {
    const c = arch.condition ?? {};
    if (type === 'has') set({ condition: { ...c, has_axes: [], has_mode: 'any' } });
    if (type === 'top') set({ condition: { ...c, top_axes: [], top_n: 1 } });
    if (type === 'bal') set({ condition: { ...c, is_balanced: true } });
    if (type === 'dom') set({ condition: { ...c, dominant_threshold: 50 } });
    if (type === 'cnt') set({ condition: { ...c, min_members_with_axis: 2 } });
    if (type === 'max') set({ condition: { ...c, max_distinct: 3 } });
    if (type === 'size') set({ max_group_size: (arch.min_group_size ?? 2) + 3 });
  };

  const removeBlock = (type: CondBlockType) => {
    const c = { ...(arch.condition ?? {}) };
    const patch: Partial<GroupArchetype> = {};
    if (type === 'has') { delete c.has_axes; delete c.has_mode; }
    if (type === 'top') { delete c.top_axes; delete c.top_n; }
    if (type === 'bal') { delete c.is_balanced; }
    if (type === 'dom') { delete c.dominant_threshold; }
    if (type === 'cnt') { delete c.min_members_with_axis; }
    if (type === 'max') { delete c.max_distinct; }
    if (type === 'size') patch.max_group_size = undefined;
    onChange({ ...arch, ...patch, condition: Object.keys(c).length ? c : undefined });
  };

  const handleCondChange = (patch: Partial<GroupArchetype>) => {
    onChange({ ...arch, ...patch });
  };

  const summary = condSummary(arch);
  const compactSummary = condSummaryCompact(arch);
  const hasResult = !!(arch.title || arch.body);

  return (
    <div style={{ border: '1px solid #E7E7E3', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#FBFBF9', borderBottom: '1px solid #EFEFEC' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#C0C0BD', flexShrink: 0, width: 18, textAlign: 'center' }}>{index + 1}</span>
        <button onClick={onMoveUp} disabled={index === 0} style={{ width: 22, height: 22, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 4, fontSize: 9, cursor: index === 0 ? 'default' : 'pointer', color: '#5C5C58', flexShrink: 0 }}>↑</button>
        <button onClick={onMoveDown} disabled={index === totalArchetypes - 1} style={{ width: 22, height: 22, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 4, fontSize: 9, cursor: index === totalArchetypes - 1 ? 'default' : 'pointer', color: '#5C5C58', flexShrink: 0 }}>↓</button>
        <input
          value={arch.code}
          onChange={e => set({ code: e.target.value })}
          placeholder="code"
          style={{
            width: 120, padding: '4px 10px',
            border: arch.fallback ? '1px solid #CBE5DE' : '1px solid #DEDAD8',
            borderRadius: arch.fallback ? 99 : 6,
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
            color: arch.fallback ? '#1F7A6F' : '#5C5C58',
            background: arch.fallback ? '#EBF5F2' : '#fff',
            outline: 'none', flexShrink: 0,
          }}
        />
        <input
          value={arch.title}
          onChange={e => set({ title: e.target.value })}
          placeholder="ชื่อผลลัพธ์กลุ่ม"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, background: 'transparent', padding: 0, minWidth: 0 }}
        />
        <button
          onClick={() => set({ fallback: !arch.fallback || undefined, condition: arch.fallback ? undefined : arch.condition })}
          style={{
            padding: '4px 11px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', flexShrink: 0,
            border: `1px solid ${arch.fallback ? '#111' : '#DEDAD8'}`,
            background: arch.fallback ? '#111' : '#fff',
            color: arch.fallback ? '#fff' : '#9B9B98',
            fontWeight: arch.fallback ? 700 : 400,
          }}
        >{arch.fallback ? '✓ fallback' : 'fallback'}</button>
        <button onClick={onRemove} style={{ width: 24, height: 24, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 5, fontSize: 12, cursor: 'pointer', color: '#E63B2E', flexShrink: 0 }}>×</button>
      </div>

      {/* Fallback banner */}
      {arch.fallback && (
        <div style={{ background: '#F0F5FF', borderBottom: '1px solid #DDEAFF', padding: '7px 13px', fontSize: 11.5, color: '#2563EB' }}>
          ใบนี้เป็นผลสำรอง — ใช้เมื่อไม่มีใบไหนเข้าเงื่อนไข จึงไม่ต้องตั้งเงื่อนไข
        </div>
      )}

      <div style={{ padding: '13px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Condition blocks */}
        {!arch.fallback && (
          <>
            {activeBlocks.map(m => (
              <CondBlock
                key={m.type}
                type={m.type}
                arch={arch}
                axes={axes}
                onChange={handleCondChange}
                onRemove={() => removeBlock(m.type)}
              />
            ))}

            {/* + เงื่อนไข row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {inactiveBlocks.length > 0 ? (
                <>
                  <span style={{ fontSize: 9.5, color: '#A0A5AA', fontWeight: 500, fontFamily: "'JetBrains Mono',monospace" }}>+ เงื่อนไข</span>
                  {inactiveBlocks.map(m => (
                    <button key={m.type} onClick={() => addBlock(m.type)} style={{
                      padding: '4px 9px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer', borderRadius: 13,
                      border: '1px dashed #CFD8D5', background: '#FFFFFF', color: '#5F6469',
                      fontFamily: "'Noto Sans Thai',sans-serif",
                    }}>{m.chipLabel}</button>
                  ))}
                </>
              ) : (
                <span style={{ fontSize: 11.5, color: '#C0C0BD', fontStyle: 'italic' }}>ครบทุกประเภทเงื่อนไขแล้ว</span>
              )}
            </div>
          </>
        )}

        {/* Condition summary */}
        {summary && !arch.fallback && (
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#A0A5AA', lineHeight: 1.6, wordBreak: 'break-all' }}>
            {summary}
          </div>
        )}

        {/* Reward pool */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: '#9B9B98', letterSpacing: '.04em', flexShrink: 0 }}>reward pool</span>
          {poolsLoading ? (
            <span style={{ fontSize: 11.5, color: '#9B9B98' }}>กำลังโหลด...</span>
          ) : (
            <select
              value={arch.reward_pool_id ?? ''}
              onChange={e => set({ reward_pool_id: e.target.value || undefined })}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid #E5E5E3', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}
            >
              <option value="">ไม่ผูก Pool</option>
              {pools.map(p => (
                <option key={p.id} value={p.id}>🎁 {p.name}{p.available_codes != null ? ` (${p.available_codes})` : ''}</option>
              ))}
            </select>
          )}
        </div>

        {/* ผลลัพธ์ของใบนี้ collapsible */}
        <div style={{ borderTop: '1px solid #F0F0EE', paddingTop: 10 }}>
          <button
            onClick={() => setResultOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <span style={{ fontSize: 11, color: '#9B9B98' }}>{resultOpen ? '▾' : '▸'}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111' }}>ผลลัพธ์ของใบนี้</span>
            <span style={{
              fontSize: 10, fontFamily: "'JetBrains Mono',monospace", padding: '2px 8px', borderRadius: 4,
              background: hasResult ? '#ECF6F3' : '#F4F4F2', color: hasResult ? '#1F7A6F' : '#A0A5AA',
              border: `1px solid ${hasResult ? '#CBE5DE' : '#E7E7E3'}`,
            }}>
              {hasResult ? 'พร้อม' : 'ยังไม่มีผล'}
            </span>
          </button>

          {!resultOpen && !arch.fallback && compactSummary && (
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: '#A0A5AA', lineHeight: 1.6, wordBreak: 'break-all' }}>
              {compactSummary}
            </div>
          )}

          {resultOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* eyebrow */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>eyebrow (บรรทัดเล็กบนหัวข้อ)</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#C9CCCE' }}>group.archetype.eyebrow</span>
                </div>
                <input value={arch.eyebrow ?? ''} onChange={e => set({ eyebrow: e.target.value || undefined })}
                  placeholder="เช่น ทีมที่สมดุลที่สุด"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #DEDEDA', borderRadius: 8, fontSize: 13, outline: 'none' }} />
              </div>

              {/* คำอธิบาย */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>คำอธิบาย</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#C9CCCE' }}>group.archetype.body</span>
                </div>
                <textarea value={arch.body} onChange={e => set({ body: e.target.value })}
                  placeholder="คำอธิบายที่โชว์ใน Group Screen"
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #DEDEDA', borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }} />
              </div>

              {/* Images side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>ภาพผล 1040×520</span>
                    <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: '#C9CCCE' }}>group.archetype.image_url</span>
                  </div>
                  <ImageUploader value={arch.image_url} onChange={url => set({ image_url: url })} aspectRatio="2:1" hint="PNG / JPG · ผล 1040×520" maxHeight={100} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>ภาพ OG 1200×630</span>
                    <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: '#C9CCCE' }}>group.archetype.og_image_url</span>
                  </div>
                  <ImageUploader value={arch.og_image_url} onChange={url => set({ og_image_url: url })} aspectRatio="1200:630" hint="PNG / JPG · OG 1200×630" maxHeight={100} />
                </div>
              </div>

              {/* ภาพสัญลักษณ์ */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>ภาพสัญลักษณ์ (unlock push)</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: '#C9CCCE' }}>group.archetype.symbol_url</span>
                </div>
                <ImageUploader value={arch.symbol_url} onChange={url => set({ symbol_url: url || undefined })} aspectRatio="1:1" hint="PNG · ไอคอน 1:1 · แสดงใน unlock push" maxHeight={80} />
              </div>

              {/* ข้อความแชร์ */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>ข้อความแชร์</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#C9CCCE' }}>group.archetype.share_text</span>
                </div>
                <input value={arch.share_text ?? ''} onChange={e => set({ share_text: e.target.value || undefined })}
                  placeholder="เช่น ทีมเราได้เป็น ค่ายสมดุลสมบูรณ์แบบ!"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #DEDEDA', borderRadius: 8, fontSize: 13, outline: 'none' }} />
              </div>

              {/* Condition summary at bottom */}
              {summary && !arch.fallback && (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: '#A0A5AA', lineHeight: 1.6, wordBreak: 'break-all', borderTop: '1px solid #F0F0EE', paddingTop: 8 }}>
                  {summary}
                </div>
              )}

              {/* fallback: true annotation */}
              {arch.fallback && (
                <div style={{ borderTop: '1px solid #F0F0EE', paddingTop: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: '#2563EB', letterSpacing: '.05em' }}>
                  fallback: true
                </div>
              )}
            </div>
          )}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {tiers.map(tier => {
          const eligible = archetypes.filter(a => a.min_group_size <= tier && (!a.max_group_size || a.max_group_size >= tier));
          const hasFallback = eligible.some(a => a.fallback);
          const used = eligible.length > 0;
          return (
            <div key={tier} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 6,
              background: !used ? '#F7F7F5' : hasFallback ? '#F0FDF4' : '#FFF7ED',
              border: `1px solid ${!used ? '#E5E5E3' : hasFallback ? '#16A34A33' : '#F97316'}`,
            }}>
              <span style={{ fontSize: 12.5, color: !used ? '#9B9B98' : '#111' }}>{tier} คน</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: !used ? '#C0C0BD' : hasFallback ? '#16A34A' : '#C2410C' }}>
                {!used ? '—' : hasFallback ? '✓' : '⚠ ขาด fallback'}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: '#9B9B98', lineHeight: 1.55, marginTop: 8 }}>ทุกขนาดกลุ่มต้องมีผลสำรองอย่างน้อย 1 อัน</div>
    </div>
  );
}

/* ── Copy Panel ──────────────────────────────────────────────────────────── */
function CopyPanel({ copy, onChange }: { copy: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const rows = [
    { k: 'group_cta',        effect: 'ปุ่มใน Summary screen',         placeholder: 'ดูผลกลุ่ม 👥' },
    { k: 'group_invite_cta', effect: 'ปุ่ม CTA ในหน้า Group',        placeholder: 'ชวนเพื่อนเข้ากลุ่ม' },
    { k: 'group_waiting',    effect: 'ระหว่างรอคนเข้า (min member)', placeholder: 'ต้องมีอย่างน้อย {n} คน' },
    { k: 'group_claim_cta',  effect: 'ปุ่มรับรางวัล',                placeholder: 'รับรางวัลเลย 🎁' },
  ];
  return (
    <div style={{ borderTop: '1px solid #E5E5E3', paddingTop: 14 }}>
      <div style={{ ...MONO, margin: '0 0 10px' }}>ข้อความหน้ากลุ่ม</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => (
          <div key={r.k}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: '#C0C0BD', marginBottom: 3 }}>{r.k}</div>
            <input value={copy[r.k] ?? ''} onChange={e => onChange(r.k, e.target.value)}
              placeholder={r.placeholder}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 12.5, outline: 'none' }} />
            <div style={{ fontSize: 11, color: '#9B9B98', marginTop: 3 }}>{r.effect}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slider row ─────────────────────────────────────────────────────────── */
function SliderRow({ label, hint, min, max, value, onChange }: { label: string; hint?: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#16181A', flex: 1 }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#16181A', border: '1px solid #DEDEDA', borderRadius: 6, background: '#F4F4F2', padding: '3px 8px' }}>{value} คน</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#1F7A6F' }} />
      {hint && <div style={{ fontSize: 11, color: '#8A8F94' }}>{hint}</div>}
    </div>
  );
}

/* ── Main GroupSection ─────────────────────────────────────────────────────── */
export default function GroupSection({ group, axes, onChange, view }: Props) {
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
    const newCode = `archetype_${archetypes.length + 1}`;
    set('archetypes', [{ ...DEFAULT_ARCHETYPE, code: newCode, min_group_size: 2 }, ...archetypes]);
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

  const groupCopy: Record<string, string> = {};
  if (group) {
    for (const [k, v] of Object.entries(group as unknown as Record<string, unknown>)) {
      if (k.startsWith('copy_') && typeof v === 'string') groupCopy[k.slice(5)] = v;
    }
  }

  const hasFallbackAny = archetypes.some(a => a.fallback);
  const showWarn = archetypes.length > 0 && !hasFallbackAny;
  const overflowOptions = [
    { v: 'hard_cap' as const, label: 'ปิดกลุ่ม', note: 'คนใหม่เข้าไม่ได้' },
    { v: 'rolling' as const, label: 'แบ่ง batch', note: 'ทุก N คน = รอบใหม่รับรางวัลได้' },
    { v: 'creator_pick' as const, label: 'ให้ผู้สร้างเลือก', note: 'creator เลือกเองว่าจะเอาใคร' },
  ];

  /* ── view='settings' ─────────────────────────────────────────────────────── */
  if (view === 'settings') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ border: '1px solid #E5E5E3', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #E5E5E3', background: '#F7F7F5', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>จำนวนสมาชิก</div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SliderRow label="ดูผลได้ตั้งแต่" hint="สมาชิกครบเท่านี้ → เห็นชื่อผลลัพธ์กลุ่ม" min={2} max={10} value={group?.min_members ?? 2} onChange={v => set('min_members', v)} />
            <SliderRow label="รับรางวัลเมื่อครบ" hint="สมาชิกครบเท่านี้ → ปุ่มรับรางวัลจะขึ้น" min={2} max={50} value={group?.reward_members ?? 5} onChange={v => set('reward_members', v)} />
            <SliderRow label="รับสมาชิกสูงสุด" hint="เกินกว่านี้จะเข้าสู่ overflow mode" min={2} max={200} value={group?.max_members ?? 50} onChange={v => set('max_members', v)} />
          </div>
        </div>

        <div style={{ border: '1px solid #E5E5E3', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #E5E5E3', background: '#F7F7F5', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9B9B98' }}>เมื่อสมาชิกเกินเพดาน</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {overflowOptions.map((ov, i) => (
              <button key={ov.v} onClick={() => set('overflow_mode', ov.v)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 0,
                borderTop: i > 0 ? '1px solid #F0F0EE' : 'none',
                background: group?.overflow_mode === ov.v ? '#F7F7F5' : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: group?.overflow_mode === ov.v ? '5px solid #111' : '1.5px solid #C9C9C6', background: '#fff' }} />
                <span style={{ fontSize: 13.5, fontWeight: 500, color: '#111', minWidth: 130 }}>{ov.label}</span>
                <span style={{ fontSize: 12.5, color: '#9B9B98' }}>{ov.note}</span>
              </button>
            ))}
          </div>
          {group?.overflow_mode === 'rolling' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderTop: '1px solid #F0F0EE', fontSize: 13, color: '#5C5C58' }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#C0C0BD' }}>└</span>
              <span>จำนวนคนต่อรอบ</span>
              <input type="number" min={2} max={100} value={group?.batch_size ?? 5} onChange={e => set('batch_size', parseInt(e.target.value) || 5)}
                style={{ width: 56, padding: '7px 9px', border: '1px solid #E5E5E3', borderRadius: 7, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: 'center', outline: 'none' }} />
              <span>คน</span>
            </div>
          )}
        </div>

        {archetypes.length > 0 && (
          <TeamSimulator axes={axes} archetypes={archetypes} maxMembers={group?.max_members ?? 50} />
        )}
        <CopyPanel copy={groupCopy} onChange={setCopy} />
      </div>
    );
  }

  /* ── view='archetypes' ───────────────────────────────────────────────────── */
  if (view === 'archetypes') {

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Section header — single row: title · subtitle · tabs · + button */}
        <div style={{ border: '1px solid #E7E7E3', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FBFBF9', borderBottom: '1px solid #EFEFEC', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, flexShrink: 0 }}>ผลกลุ่ม (archetype)</span>
            <span style={{ fontSize: 11, color: '#9B9B98', flexShrink: 0 }}>ตรวจจากบนลงล่าง ในเฟรกที่เข้าเงื่อนไขผลของทีม</span>
            <div style={{ flex: 1 }} />
            <button onClick={addArchetype} style={{ padding: '6px 13px', border: '1px solid #E5E5E3', background: '#fff', fontSize: 12.5, color: '#111', cursor: 'pointer', borderRadius: 8, fontWeight: 600, flexShrink: 0 }}>
              + เพิ่มผลกลุ่ม
            </button>
          </div>
        </div>

        {showWarn && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#FFF7ED', border: '1px solid #F97316', borderRadius: 8, fontSize: 13, color: '#C2410C' }}>
            <span>⚠</span>
            <span>ต้องมีผลสำรอง (fallback) อย่างน้อย 1 อัน ไม่งั้นบางกลุ่มจะไม่ได้ผลลัพธ์เลย</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {archetypes.map((arch, i) => (
            <ArchetypeCard
              key={i} arch={arch} index={i} axes={axes}
              pools={pools} poolsLoading={poolsLoading}
              totalArchetypes={archetypes.length}
              onChange={a => updateArchetype(i, a)}
              onRemove={() => removeArchetype(i)}
              onMoveUp={() => moveArchetype(i, -1)}
              onMoveDown={() => moveArchetype(i, 1)}
            />
          ))}
          <button onClick={addArchetype} style={{ padding: '9px 14px', border: '1.5px dashed #D2D2CD', background: '#FFFFFF', fontSize: 12, fontWeight: 600, fontFamily: "'Noto Sans Thai',sans-serif", color: '#5F6469', cursor: 'pointer', borderRadius: 9 }}>
            + เพิ่มผลลัพธ์กลุ่ม
          </button>
        </div>
      </div>
    );
  }

  /* ── default view ────────────────────────────────────────────────────────── */
  return (
    <section style={{ padding: '32px 32px 28px', borderBottom: '1px solid #E5E5E3' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9B9B98' }}>Step 4</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>ผลลัพธ์กลุ่ม</h2>
        <button onClick={handleToggle} style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer', fontWeight: 600, border: enabled ? '1px solid #16A34A' : '1px solid #E5E5E3', background: enabled ? '#F0FDF4' : '#fff', color: enabled ? '#16A34A' : '#9B9B98' }}>{enabled ? 'ON' : 'OFF'}</button>
        {enabled && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#9B9B98' }}>{archetypes.length} ผลลัพธ์</span>}
        <div style={{ flex: 1 }} />
        {enabled && <button onClick={() => setCollapsed(v => !v)} style={{ padding: '7px 13px', border: '1px solid #E5E5E3', background: '#fff', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', color: '#5C5C58' }}>{collapsed ? 'กาง' : 'ย่อ'}</button>}
      </div>
      {!enabled && (
        <div style={{ border: '1px dashed #C9C9C6', background: '#FAFAF9', padding: 28, textAlign: 'center', fontSize: 13.5, color: '#9B9B98', lineHeight: 1.6, borderRadius: 8 }}>
          Group Mode ปิดอยู่
        </div>
      )}
    </section>
  );
}
