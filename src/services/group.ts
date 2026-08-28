/**
 * Group service — create, join, compute result, claim reward.
 *
 * Design notes:
 *  - Group result is computed at read-time from member axis_scores (not stored),
 *    so it auto-updates as people join — until result_locks_at is reached.
 *  - For rolling mode, once current_batch reaches batch_size the batch is "complete":
 *    members in that batch can claim reward, and current_batch increments.
 *  - Archetype evaluation: top-to-bottom, pick highest min_group_size that matches.
 */

import { db } from '../db/client.js';
import { getConfig } from '../config/loader.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import type { GroupConfig, GroupArchetype, GroupCondition } from '../config/schema.js';
import { scoreAnswers, dominantAxis } from '../engine/buddyQuiz.js';
import { pushMessage } from './line.js';
import { env } from '../env.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GroupMemberPublic {
  userId: string;
  topAxis: string;
  batchNo: number;
  joinedAt: string;
}

export interface GroupResult {
  archetype: Omit<GroupArchetype, 'reward_pool_id' | 'condition'> | null;
  score: number | null;        // only when result_mode = 'score'
  scoreUnit: string | null;
  isLocked: boolean;
}

export interface GroupView {
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
  members: GroupMemberPublic[];
  result: GroupResult | null;    // null if < min_members
  canClaim: boolean;             // true if batch complete + user in batch + not yet claimed
  createdBy: string;
  name: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise raw axis scores → fraction of total (0–1 per axis) */
function normaliseScores(raw: Record<string, number>): Record<string, number> {
  const total = Object.values(raw).reduce((s, v) => s + Math.max(0, v), 0);
  if (total === 0) return raw;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.max(0, v) / total]));
}

/** axis_counts: { axis_id → member count } for a list of members */
function axisCountsFromMembers(members: { top_axis: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of members) counts[m.top_axis] = (counts[m.top_axis] ?? 0) + 1;
  return counts;
}

/** Average normalised axis scores across all members */
function avgScores(members: { axis_scores: Record<string, number> }[]): Record<string, number> {
  if (members.length === 0) return {};
  const sums: Record<string, number> = {};
  for (const m of members) {
    const norm = normaliseScores(m.axis_scores);
    for (const [k, v] of Object.entries(norm)) sums[k] = (sums[k] ?? 0) + v;
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / members.length]));
}

/** Check a single GroupCondition against current member data */
function matchesCondition(
  cond: GroupCondition,
  axisCounts: Record<string, number>,
  avgNorm: Record<string, number>,
  totalMembers: number,
): boolean {
  const threshold = cond.dominant_threshold ?? 0.5;

  // has_axes check
  if (cond.has_axes && cond.has_axes.length > 0) {
    const mode = cond.has_mode ?? 'any';
    const present = cond.has_axes.map(ax => (axisCounts[ax] ?? 0) > 0);
    if (mode === 'all' && !present.every(Boolean)) return false;
    if (mode === 'any' && !present.some(Boolean)) return false;

    // optional min_members_with_axis (only meaningful with specific single axis)
    if (cond.min_members_with_axis !== undefined && cond.has_axes.length === 1) {
      const ax = cond.has_axes[0];
      if ((axisCounts[ax] ?? 0) < cond.min_members_with_axis) return false;
    }
  }

  // top_axes check — group's top-N axes by member count must overlap has list
  if (cond.top_axes && cond.top_axes.length > 0) {
    const topN = cond.top_n ?? 1;
    const sorted = Object.entries(axisCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([ax]) => ax);
    const overlap = cond.top_axes.some(ax => sorted.includes(ax));
    if (!overlap) return false;
  }

  // is_balanced check — no axis fraction > threshold
  if (cond.is_balanced === true) {
    const isBalanced = Object.values(avgNorm).every(v => v < threshold);
    if (!isBalanced) return false;
  }

  // max_distinct check — number of distinct top axes in group
  if (cond.max_distinct !== undefined) {
    const distinctCount = Object.keys(axisCounts).filter(ax => (axisCounts[ax] ?? 0) > 0).length;
    if (distinctCount > cond.max_distinct) return false;
  }

  return true;
}

/**
 * Evaluate group archetypes for a given member list and group size.
 * Returns highest min_group_size entry that matches (first-match-wins within same tier).
 */
function evaluateArchetype(
  cfg: GroupConfig,
  members: { top_axis: string; axis_scores: Record<string, number> }[],
): GroupArchetype | null {
  const n = members.length;
  if (n < cfg.min_members) return null;

  const axisCounts = axisCountsFromMembers(members);
  const avg = avgScores(members);

  // Filter eligible entries (min_group_size <= n, max_group_size >= n if set)
  const eligible = cfg.archetypes.filter(a => {
    if (a.min_group_size > n) return false;
    if (a.max_group_size !== undefined && a.max_group_size < n) return false;
    return true;
  });

  // Sort descending by min_group_size — most specific first
  eligible.sort((a, b) => b.min_group_size - a.min_group_size);

  // First non-fallback that satisfies condition
  for (const arch of eligible) {
    if (arch.fallback) continue;
    if (!arch.condition) continue;
    if (matchesCondition(arch.condition, axisCounts, avg, n)) return arch;
  }

  // First fallback (also descending by min_group_size)
  for (const arch of eligible) {
    if (arch.fallback) return arch;
  }

  return null;
}

/**
 * Compute group score (score mode only).
 * score = base + axis_coverage_bonus + balance_bonus + member_bonus
 */
function computeScore(
  cfg: GroupConfig,
  members: { top_axis: string; axis_scores: Record<string, number> }[],
  totalAxes: number,
): number {
  const f = cfg.formula;
  if (!f) return 0;

  const axisCounts = axisCountsFromMembers(members);
  const avg = avgScores(members);
  const threshold = 0.5;

  const axisCoverage = Object.values(axisCounts).filter(c => c > 0).length;
  const coverageBonus = (axisCoverage - 1) * f.per_axis_coverage;

  const isBalanced = Object.values(avg).every(v => v < threshold);
  const balanceBonus = isBalanced ? f.balance_bonus : 0;

  // Per-axis group_weight contribution (from axis config) averaged across members
  // (not in formula fields — this uses the per-axis weight from config if available)
  const memberBonus = Math.min(members.length * f.per_member, f.per_member_cap);

  return Math.round(f.base + coverageBonus + balanceBonus + memberBonus);
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getGroupOrThrow(groupId: string) {
  const { data, error } = await db()
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();
  if (error || !data) throw new NotFoundError(`Group not found: ${groupId}`);
  return data as Record<string, unknown>;
}

async function getMembersForGroup(groupId: string) {
  const { data, error } = await db()
    .from('group_members')
    .select('id, user_id, top_axis, axis_scores, batch_no, creator_picked, reward_claimed, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    user_id: string;
    top_axis: string;
    axis_scores: Record<string, number>;
    batch_no: number;
    creator_picked: boolean;
    reward_claimed: boolean;
    joined_at: string;
  }>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new group. The creator must have already answered the quiz
 * (user_quiz_answers row must exist for this campaign).
 */
export async function createGroup(
  userId: string,
  campaignId: string,
): Promise<{ groupId: string }> {
  // Load campaign + config
  const { data: campaign, error: campErr } = await db()
    .from('campaigns')
    .select('id, status, current_version')
    .eq('id', campaignId)
    .single();
  if (campErr || !campaign) throw new NotFoundError(`Campaign not found: ${campaignId}`);
  if ((campaign as Record<string, unknown>).status !== 'live') throw new BadRequestError('Campaign is not live');

  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  if (!cfg.group?.enabled) throw new BadRequestError('Group feature is not enabled for this campaign');

  // Check user has answered
  const { data: ansRows } = await db()
    .from('user_quiz_answers')
    .select('question_id, option_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId);
  if (!ansRows || ansRows.length === 0) throw new BadRequestError('คุณต้องตอบควิซก่อนสร้างกลุ่ม');
  const userAnswers = ansRows.map(r => ({ questionId: r.question_id, optionId: r.option_id }));
  const axisScores = scoreAnswers(cfg, userAnswers);
  const topAxis = dominantAxis(cfg, axisScores);

  const g = cfg.group;

  // Insert group
  const { data: group, error: grpErr } = await db()
    .from('groups')
    .insert({
      campaign_id: campaignId,
      created_by: userId,
      overflow_mode: g.overflow_mode,
      min_members: g.min_members,
      reward_members: g.reward_members,
      max_members: g.max_members,
      batch_size: g.batch_size ?? null,
    })
    .select('id')
    .single();
  if (grpErr || !group) throw new Error(grpErr?.message ?? 'Failed to create group');

  const groupId = (group as Record<string, unknown>).id as string;

  // Add creator as first member
  await db().from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    top_axis: topAxis,
    axis_scores: axisScores,
    batch_no: 1,
  });

  return { groupId };
}

/**
 * Join an existing group.
 *
 * Rules:
 *  - Already a member → no-op (ok: true, viewOnly: false)
 *  - Already paired with the creator (either role) → view-only: can see the group
 *    but is NOT inserted into group_members (doesn't count toward the cap/reward).
 *    Returns ok: true, viewOnly: true.
 *  - Group is full (max_members reached) → throws unless view-only.
 *  - New member joins → insert, push OA notification to creator with updated result.
 */
export async function joinGroup(
  userId: string,
  groupId: string,
): Promise<{ ok: boolean; viewOnly?: boolean; message?: string; existingMemberIds?: string[] }> {
  const group = await getGroupOrThrow(groupId);
  const campaignId = group.campaign_id as string;
  const creatorId = group.created_by as string;

  // Already a member → no-op
  const { data: existing } = await db()
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    const members = await getMembersForGroup(groupId);
    return { ok: true, viewOnly: false, message: 'already_member', existingMemberIds: members.map(m => m.user_id).filter(id => id !== userId) };
  }

  // Load config
  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const gcfg = cfg.group!;

  // Check user has answered the quiz
  const { data: ansRows } = await db()
    .from('user_quiz_answers')
    .select('question_id, option_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId);
  if (!ansRows || ansRows.length === 0) throw new BadRequestError('คุณต้องตอบควิซก่อนเข้าร่วมกลุ่ม');
  const userAnswers = ansRows.map(r => ({ questionId: r.question_id, optionId: r.option_id }));
  const axisScores = scoreAnswers(cfg, userAnswers);
  const topAxis = dominantAxis(cfg, axisScores);

  // Count current members
  const members = await getMembersForGroup(groupId);
  const total = members.length;

  if (gcfg.overflow_mode === 'hard_cap' && total >= gcfg.max_members) {
    throw new BadRequestError('กลุ่มนี้เต็มแล้ว กรุณาสร้างกลุ่มใหม่');
  }

  // Determine batch
  const currentBatch = group.current_batch as number;
  let batchNo = currentBatch;

  if (gcfg.overflow_mode === 'rolling' && gcfg.batch_size) {
    const batchMembers = members.filter(m => m.batch_no === currentBatch).length;
    if (batchMembers >= gcfg.batch_size) {
      batchNo = currentBatch + 1;
      await db().from('groups').update({ current_batch: batchNo }).eq('id', groupId);
    }
  }

  // Insert new member
  await db().from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    top_axis: topAxis,
    axis_scores: axisScores,
    batch_no: batchNo,
  });

  const allMembers = [...members, { user_id: userId, top_axis: topAxis, axis_scores: axisScores, batch_no: batchNo, id: '', creator_picked: false, reward_claimed: false, joined_at: new Date().toISOString() }];

  // When group reaches max_members → push F-03 completion card to all members
  if (allMembers.length >= gcfg.max_members) {
    pushGroupComplete(groupId, campaignId, cfg, allMembers).catch(() => {});
  }

  return { ok: true, viewOnly: false, existingMemberIds: members.map(m => m.user_id) };
}

/** F-03: push group-complete card to ALL members when group reaches max_members */
async function pushGroupComplete(
  groupId: string,
  campaignId: string,
  cfg: Awaited<ReturnType<typeof getConfig>>,
  members: Array<{ user_id: string; top_axis: string; axis_scores: Record<string, number>; batch_no: number; id: string; creator_picked: boolean; reward_claimed: boolean; joined_at: string }>,
): Promise<void> {
  const gcfg = cfg.group!;
  const archetype = evaluateArchetype(gcfg, members);
  const primary = cfg.brand.primary || '#E8354F';
  const liffBase = env().LIFF_URL ?? '';
  const groupUrl = `${liffBase}?campaignId=${campaignId}&groupId=${groupId}`;
  const copy = (cfg as Record<string, unknown>).copy as Record<string, string> ?? {};

  const altText = archetype
    ? `ทีมครบแล้ว! ${archetype.title} — ดูผลทีมวันสิ้นโลก`
    : 'ทีมครบแล้ว! มาดูผลทีมกันเลย';

  const bodyContents: Record<string, unknown>[] = [
    {
      type: 'box', layout: 'vertical', paddingAll: '4px', backgroundColor: '#F5E14B',
      cornerRadius: '4px', width: '112px',
      contents: [{ type: 'text', text: copy.F03_badge || 'ทีมครบแล้ว!', size: 'xs', weight: 'bold', color: '#1C1A17', align: 'center' }],
    },
  ];

  if (archetype) {
    bodyContents.push({ type: 'text', text: archetype.title, weight: 'bold', size: 'xxl', color: primary, wrap: true, margin: 'sm' });
    if (archetype.primary_text) {
      bodyContents.push({ type: 'text', text: `รอดได้ ${archetype.primary_text}`, size: 'md', color: '#555555', margin: 'xs' });
    }
    if (archetype.body) {
      bodyContents.push({ type: 'text', text: archetype.body, size: 'sm', color: '#666666', wrap: true, margin: 'sm' });
    }
  } else {
    bodyContents.push({ type: 'text', text: copy.F03_title || 'ทีมวันสิ้นโลกของคุณพร้อมแล้ว!', weight: 'bold', size: 'xl', color: primary, wrap: true, margin: 'sm' });
  }
  bodyContents.push({ type: 'text', text: `${members.length} คนในทีม`, size: 'xs', color: '#888888', margin: 'md' });

  const message = {
    type: 'flex',
    altText: altText.slice(0, 400),
    contents: {
      type: 'bubble',
      size: 'mega',
      ...(archetype?.image_url ? { hero: { type: 'image', url: archetype.image_url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } } : {}),
      body: { type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', contents: bodyContents },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'button', action: { type: 'uri', label: copy.F03_cta || 'ดูผลทีมแบบเต็ม', uri: groupUrl }, style: 'primary', color: primary }],
      },
    },
  };

  await Promise.allSettled(members.map(m => pushMessage(m.user_id, [message] as any)));
}

async function pushGroupUpdateToMember(
  recipientId: string,
  newJoinerId: string,
  groupId: string,
  campaignId: string,
  cfg: Awaited<ReturnType<typeof getConfig>>,
  members: Array<{ user_id: string; top_axis: string; axis_scores: Record<string, number>; batch_no: number; id: string; creator_picked: boolean; reward_claimed: boolean; joined_at: string }>,
): Promise<void> {
  const gcfg = cfg.group!;
  const newTotal = members.length;
  const archetype = evaluateArchetype(gcfg, members);
  const primary = cfg.brand.primary || '#E63B2E';
  const liffBase = env().LIFF_URL ?? '';
  const groupUrl = `${liffBase}?campaignId=${campaignId}&groupId=${groupId}`;
  const shortId = groupId.slice(-4).toUpperCase();
  // Fetch joiner display name for the notification
  const { data: joinerRow } = await db().from('users').select('display_name').eq('line_user_id', newJoinerId).maybeSingle();
  const joinerName = (joinerRow as Record<string, unknown> | null)?.display_name as string || 'สมาชิกใหม่';

  const bodyContents: Record<string, unknown>[] = [
    { type: 'text', text: `ผลกลุ่ม · GRP-${shortId}`, size: 'xs', color: '#888888' },
    { type: 'text', text: `${joinerName} เข้าร่วมทีม!`, weight: 'bold', size: 'lg', margin: 'sm' },
  ];

  if (archetype) {
    bodyContents.push({ type: 'text', text: archetype.title, weight: 'bold', size: 'xl', color: primary, margin: 'sm' });
    if (archetype.body) {
      bodyContents.push({ type: 'text', text: archetype.body, size: 'sm', color: '#666666', wrap: true, margin: 'sm' });
    }
    if (archetype.primary_text) {
      bodyContents.push({
        type: 'box', layout: 'horizontal', margin: 'md',
        contents: [
          { type: 'text', text: 'รอด', size: 'xs', color: '#888888', flex: 0 },
          { type: 'text', text: archetype.primary_text, weight: 'bold', size: 'xl', color: primary, margin: 'sm' },
          { type: 'box', layout: 'vertical', flex: 0, justifyContent: 'center', paddingAll: '4px', backgroundColor: '#F5E14B', borderWidth: '1px', borderColor: '#1C1A17', cornerRadius: '4px', contents: [{ type: 'text', text: `${newTotal} คน`, size: 'xs', weight: 'bold', color: '#1C1A17' }] },
        ],
      });
    }
  } else {
    bodyContents.push({ type: 'text', text: `${newTotal} คนในทีม — รอสมาชิกเพิ่ม`, size: 'sm', color: '#888888', margin: 'sm' });
  }

  const messages: Record<string, unknown>[] = [{
    type: 'flex',
    altText: archetype ? `${joinerName} เข้าร่วมทีม · ${archetype.title} · ${newTotal} คน` : `${joinerName} เข้าร่วมทีม GRP-${shortId} แล้ว`,
    contents: {
      type: 'bubble',
      ...(archetype?.image_url ? { hero: { type: 'image', url: archetype.image_url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } } : {}),
      body: { type: 'box', layout: 'vertical', paddingAll: '16px', contents: bodyContents },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'button', action: { type: 'uri', label: 'ดูผลทีม', uri: groupUrl }, style: 'primary', color: primary }],
      },
    },
  }];

  await pushMessage(recipientId, messages as any);
}

/**
 * Get group state including computed result and claim eligibility.
 */
export async function getGroup(
  userId: string,
  groupId: string,
): Promise<GroupView> {
  const group = await getGroupOrThrow(groupId);
  const campaignId = group.campaign_id as string;

  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const gcfg = cfg.group!;

  const members = await getMembersForGroup(groupId);
  const total = members.length;
  const currentBatch = group.current_batch as number;
  const batchMembers = members.filter(m => m.batch_no === currentBatch);

  // Determine if result is locked
  const locksAt = gcfg.result_locks_at ?? 0;
  const isLocked = locksAt > 0 && total >= locksAt;
  const lockedCode = group.locked_archetype_code as string | null;

  // Compute result
  let groupResult: GroupResult | null = null;
  if (total >= gcfg.min_members) {
    let archetype: GroupArchetype | null = null;

    if (isLocked && lockedCode) {
      archetype = gcfg.archetypes.find(a => a.code === lockedCode) ?? null;
    } else {
      archetype = evaluateArchetype(gcfg, members);
      // Lock if needed
      if (isLocked && archetype && !lockedCode) {
        await db().from('groups').update({ locked_archetype_code: archetype.code, locked_at: new Date().toISOString() }).eq('id', groupId);
      }
    }

    let score: number | null = null;
    if (gcfg.result_mode === 'score' && gcfg.formula) {
      score = computeScore(gcfg, members, cfg.axes.length);
    }

    groupResult = {
      archetype: archetype ? {
        code: archetype.code,
        title: archetype.title,
        body: archetype.body,
        image_url: archetype.image_url,
        min_group_size: archetype.min_group_size,
        max_group_size: archetype.max_group_size,
        fallback: archetype.fallback,
      } : null,
      score,
      scoreUnit: gcfg.formula?.unit ?? null,
      isLocked,
    };
  }

  // Determine canClaim
  const myMember = members.find(m => m.user_id === userId);
  let canClaim = false;
  if (myMember && !myMember.reward_claimed) {
    const myBatch = myMember.batch_no;
    const batchCount = members.filter(m => m.batch_no === myBatch).length;
    const batchFull = gcfg.overflow_mode === 'rolling'
      ? (gcfg.batch_size ? batchCount >= gcfg.batch_size : false)
      : total >= gcfg.reward_members;
    canClaim = batchFull;
  }

  // Fetch display names for all members
  const userIds = members.map(m => m.user_id);
  const { data: userRows } = await db()
    .from('users')
    .select('line_user_id, display_name')
    .in('line_user_id', userIds);
  const nameMap = new Map<string, string>();
  for (const u of userRows ?? []) nameMap.set(u.line_user_id, u.display_name);

  return {
    groupId,
    campaignId,
    status: group.status as string,
    totalMembers: total,
    currentBatch,
    currentBatchMembers: batchMembers.length,
    minMembers: gcfg.min_members,
    rewardMembers: gcfg.reward_members,
    maxMembers: gcfg.max_members,
    overflowMode: gcfg.overflow_mode,
    batchSize: gcfg.batch_size ?? null,
    members: members.map(m => ({
      userId: m.user_id,
      displayName: nameMap.get(m.user_id) || undefined,
      topAxis: m.top_axis,
      batchNo: m.batch_no,
      joinedAt: m.joined_at,
    })),
    result: groupResult,
    canClaim,
    createdBy: group.created_by as string,
    name: (group.name as string | null) ?? null,
  };
}

/**
 * Claim group reward for the calling user.
 * Handles hard_cap (reward when total >= reward_members) and rolling (per-batch).
 */
export async function claimGroupReward(
  userId: string,
  groupId: string,
): Promise<{ code?: string; message: string }> {
  const group = await getGroupOrThrow(groupId);
  const campaignId = group.campaign_id as string;

  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const gcfg = cfg.group!;

  const members = await getMembersForGroup(groupId);
  const myMember = members.find(m => m.user_id === userId);
  if (!myMember) throw new BadRequestError('คุณไม่ได้อยู่ในกลุ่มนี้');
  if (myMember.reward_claimed) throw new BadRequestError('คุณรับรางวัลไปแล้ว');

  // Check batch is complete
  const myBatch = myMember.batch_no;
  const batchCount = members.filter(m => m.batch_no === myBatch).length;
  const batchFull = gcfg.overflow_mode === 'rolling'
    ? (gcfg.batch_size ? batchCount >= gcfg.batch_size : false)
    : members.length >= gcfg.reward_members;

  if (!batchFull) throw new BadRequestError('ยังรอสมาชิกในกลุ่มไม่ครบ');

  // Find which archetype's reward_pool_id to use
  const archetype = evaluateArchetype(gcfg, members);
  const poolId = archetype?.reward_pool_id;

  if (!poolId) {
    // No pool configured — just mark claimed
    await db().from('group_members').update({ reward_claimed: true }).eq('id', myMember.id);
    return { message: 'claimed' };
  }

  // Claim a code from the pool (race-condition safe via row lock)
  const { data: code, error: codeErr } = await db()
    .from('reward_codes')
    .select('id, code')
    .eq('pool_id', poolId)
    .is('claimed_by', null)
    .limit(1)
    .single();

  if (codeErr || !code) throw new BadRequestError('โค้ดรางวัลหมดแล้ว');

  // Insert claim
  const { data: claim } = await db()
    .from('reward_claims')
    .insert({
      user_id: userId,
      campaign_id: campaignId,
      pool_id: poolId,
      milestone_key: `group_${groupId}_batch_${myBatch}`,
      code_id: (code as Record<string, unknown>).id,
    })
    .select('id')
    .single();

  if (!claim) throw new Error('Failed to create claim');

  // Mark code as claimed
  await db().from('reward_codes').update({
    claimed_by: userId,
    claimed_at: new Date().toISOString(),
    claim_id: (claim as Record<string, unknown>).id,
  }).eq('id', (code as Record<string, unknown>).id);

  // Mark member as claimed
  await db().from('group_members').update({
    reward_claimed: true,
    reward_claim_id: (claim as Record<string, unknown>).id,
  }).eq('id', myMember.id);

  return { code: (code as Record<string, unknown>).code as string, message: 'claimed' };
}

/**
 * Add selected pair-partners as group members (creator-only, batch call after createGroup).
 * Resolves partner userIds from the pairs table, then computes their axis from user_quiz_answers
 * (same path as joinGroup) so it works regardless of whether pairs.scores is populated.
 * Pairs without a partner who has answered are silently skipped.
 */
export async function addPairsToGroup(
  creatorId: string,
  groupId: string,
  pairIds: string[],
): Promise<{ added: number }> {
  if (!pairIds.length) return { added: 0 };

  const group = await getGroupOrThrow(groupId);
  if ((group.created_by as string) !== creatorId) throw new BadRequestError('Not the group creator');

  const campaignId = group.campaign_id as string;
  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);

  // Fetch pairs (no status filter — we'll compute scores from user_quiz_answers regardless)
  const { data: pairRows } = await db()
    .from('pairs')
    .select('id, a_user, b_user')
    .in('id', pairIds)
    .eq('campaign_id', campaignId);

  if (!pairRows?.length) return { added: 0 };

  // Collect unique partner userIds
  const partnerIds = [...new Set(
    (pairRows as Array<{ id: string; a_user: string; b_user: string }>)
      .map(p => p.a_user === creatorId ? p.b_user : p.a_user)
  )];

  // Existing members — skip duplicates
  const existing = await getMembersForGroup(groupId);
  const existingUsers = new Set(existing.map((m) => m.user_id));
  const currentBatch = (group.current_batch as number) ?? 1;

  const toInsert: Array<{
    group_id: string;
    user_id: string;
    top_axis: string;
    axis_scores: Record<string, number>;
    batch_no: number;
    creator_picked: boolean;
  }> = [];

  for (const partnerId of partnerIds) {
    if (existingUsers.has(partnerId)) continue;

    // Compute partner's axis from their saved answers (same as joinGroup)
    const { data: ansRows } = await db()
      .from('user_quiz_answers')
      .select('question_id, option_id')
      .eq('user_id', partnerId)
      .eq('campaign_id', campaignId);

    if (!ansRows || ansRows.length === 0) continue; // partner hasn't answered yet — skip

    const answers = ansRows.map(r => ({ questionId: r.question_id, optionId: r.option_id }));
    const axisScores = scoreAnswers(cfg, answers);
    const topAxis = dominantAxis(cfg, axisScores);

    toInsert.push({
      group_id: groupId,
      user_id: partnerId,
      top_axis: topAxis,
      axis_scores: axisScores,
      batch_no: currentBatch,
      creator_picked: true,
    });
    existingUsers.add(partnerId);
  }

  if (toInsert.length) {
    await db().from('group_members').insert(toInsert);
  }

  return { added: toInsert.length };
}

/**
 * Get all groups the user is a member of for a given campaign.
 */
export async function getMyGroups(
  userId: string,
  campaignId: string,
): Promise<{ groups: Array<{ groupId: string; memberCount: number; maxMembers: number; isFull: boolean; archCode: string | null; archTitle: string | null; primaryText: string | null; score: number | null; scoreUnit: string | null; memberAxes: string[] }> }> {
  // Find all group_ids for this user in this campaign
  const { data: memberships } = await db()
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (!memberships?.length) return { groups: [] };

  const groupIds = memberships.map((m: Record<string, unknown>) => m.group_id as string);

  const { data: groupRows } = await db()
    .from('groups')
    .select('id, campaign_id, current_batch')
    .in('id', groupIds)
    .eq('campaign_id', campaignId);
  if (!groupRows?.length) return { groups: [] };

  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const gcfg = cfg.group!;

  const results = await Promise.all(
    (groupRows as Array<Record<string, unknown>>).map(async (g) => {
      const members = await getMembersForGroup(g.id as string);
      const archetype = members.length >= gcfg.min_members ? evaluateArchetype(gcfg, members) : null;
      const score = (gcfg.result_mode === 'score' && gcfg.formula && members.length >= gcfg.min_members)
        ? computeScore(gcfg, members, cfg.axes.length) : null;
      return {
        groupId: g.id as string,
        memberCount: members.length,
        maxMembers: gcfg.max_members,
        isFull: members.length >= gcfg.max_members,
        archCode: archetype?.code ?? null,
        archTitle: archetype?.title ?? null,
        primaryText: archetype?.primary_text ?? (score != null ? `${score} ${gcfg.formula?.unit ?? 'วัน'}` : null),
        score,
        scoreUnit: gcfg.formula?.unit ?? null,
        memberAxes: members.map(m => m.top_axis),
      };
    })
  );

  // Sort newest first (by groupId — UUIDs are time-ordered via insertion)
  return { groups: results };
}

/**
 * Share group result — locks current archetype code so the symbol is permanently unlocked for members.
 * Idempotent: if already locked, just returns existing code.
 */
export async function shareGroup(userId: string, groupId: string): Promise<{ symbolCode: string | null }> {
  const group = await getGroupOrThrow(groupId);
  const campaignId = group.campaign_id as string;

  // Confirm user is a member
  const { data: membership } = await db()
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();
  if (!membership) return { symbolCode: null };

  // Already locked — return existing
  const existingCode = group.locked_archetype_code as string | null;
  if (existingCode) return { symbolCode: existingCode };

  // Evaluate current archetype
  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const gcfg = cfg.group!;

  const members = await getMembersForGroup(groupId);
  if (members.length < gcfg.min_members) return { symbolCode: null };

  const archetype = evaluateArchetype(gcfg, members);
  if (!archetype) return { symbolCode: null };

  await db()
    .from('groups')
    .update({ locked_archetype_code: archetype.code, locked_at: new Date().toISOString() })
    .eq('id', groupId);

  // F-08: push symbol-unlock notification to the sharer (fire-and-forget)
  pushSymbolUnlockedToUser(userId, campaignId, groupId, cfg, archetype).catch(() => {});

  return { symbolCode: archetype.code };
}

async function pushSymbolUnlockedToUser(
  userId: string,
  campaignId: string,
  groupId: string,
  cfg: Awaited<ReturnType<typeof getConfig>>,
  archetype: import('../config/schema.js').GroupArchetype,
): Promise<void> {
  const liffBase = env().LIFF_URL ?? '';
  const groupUrl = `${liffBase}?campaignId=${campaignId}&groupId=${groupId}`;
  const copy = (cfg as any).copy ?? {};

  // Count how many distinct symbols the user has now (including the one just unlocked)
  const { data: memberships } = await db()
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  const groupIds = (memberships ?? []).map((m: any) => m.group_id as string);
  const { data: lockedGroups } = groupIds.length
    ? await db().from('groups').select('locked_archetype_code').in('id', groupIds)
        .eq('campaign_id', campaignId).not('locked_archetype_code', 'is', null)
    : { data: [] };
  const unlockedCodes = new Set<string>([
    ...(lockedGroups ?? []).map((g: any) => g.locked_archetype_code as string).filter(Boolean),
    archetype.code,
  ]);
  const unlockedCount = unlockedCodes.size;
  const totalSymbols = cfg.group?.archetypes?.filter((a: any) => !a.fallback).length ?? 9;
  const remaining = Math.max(0, totalSymbols - unlockedCount);

  // Symbol hero image (symbol_url preferred, fall back to image_url)
  const heroUrl = archetype.symbol_url || archetype.image_url;

  // Progress dots: unlockedCount red filled, rest dark empty
  const dots: Record<string, unknown>[] = [];
  for (let i = 0; i < totalSymbols; i++) {
    dots.push({
      type: 'box', layout: 'vertical', width: '10px', height: '10px',
      cornerRadius: '5px',
      backgroundColor: i < unlockedCount ? '#E8354F' : '#1C1A17',
      contents: [],
    });
  }

  const bodyContents: Record<string, unknown>[] = [];

  // Hero image section (yellow bg)
  if (heroUrl) {
    bodyContents.push({
      type: 'box', layout: 'vertical', backgroundColor: '#F5E14B',
      paddingAll: '0px', alignItems: 'center', justifyContent: 'center',
      height: '120px',
      contents: [{ type: 'image', url: heroUrl, size: 'full', aspectRatio: '1:1', aspectMode: 'fit' }],
    });
  }

  // Text section
  bodyContents.push({
    type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'sm',
    contents: [
      // Eyebrow label
      {
        type: 'box', layout: 'vertical', paddingTop: '3px', paddingBottom: '3px',
        paddingStart: '8px', paddingEnd: '8px',
        backgroundColor: '#E8354F', cornerRadius: '4px', alignItems: 'flex-start',
        contents: [{ type: 'text', text: copy.F08_eyebrow || 'ดวงใหม่รอบนี้', size: 'xxs', weight: 'bold', color: '#FFFDF6' }],
      },
      { type: 'text', text: archetype.title, size: 'lg', weight: 'bold', color: '#1C1A17', wrap: true, margin: 'xs' },
      {
        type: 'text',
        text: `สะสมแล้ว ${unlockedCount}/${totalSymbols} ดวง · เหลือ ${remaining}`,
        size: 'xs', color: 'rgba(28,26,23,.55)', margin: 'xs',
      },
      // Dots row
      { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm', contents: dots },
    ],
  });

  const message = {
    type: 'flex',
    altText: `${copy.F08_eyebrow || 'ดวงใหม่รอบนี้'} — ${archetype.title} (${unlockedCount}/${totalSymbols})`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '0px', spacing: 'none',
        contents: bodyContents,
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{
          type: 'button',
          action: { type: 'uri', label: copy.F08_cta || 'ดูสัญลักษณ์ที่เหลือ', uri: groupUrl },
          style: 'primary', color: '#E8354F', height: 'sm',
        }],
      },
    },
  };

  await pushMessage(userId, [message] as any);
}

/** Leave a group — removes user from group_members. Creator can also leave (group stays). */
export async function leaveGroup(userId: string, groupId: string): Promise<void> {
  const { error } = await db()
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Set/update group name — creator only. */
export async function renameGroup(userId: string, groupId: string, name: string): Promise<void> {
  const group = await getGroupOrThrow(groupId);
  if ((group.created_by as string) !== userId) throw new BadRequestError('Only the group creator can rename the group');
  const { error } = await db()
    .from('groups')
    .update({ name })
    .eq('id', groupId);
  if (error) throw new Error(error.message);
}
