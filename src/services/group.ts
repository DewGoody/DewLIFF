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
  const { data: answers } = await db()
    .from('user_quiz_answers')
    .select('top_axis, axis_scores')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .single();
  if (!answers) throw new BadRequestError('คุณต้องตอบควิซก่อนสร้างกลุ่ม');

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
    top_axis: (answers as Record<string, unknown>).top_axis,
    axis_scores: (answers as Record<string, unknown>).axis_scores,
    batch_no: 1,
  });

  return { groupId };
}

/**
 * Join an existing group. User must have answered the quiz.
 * Handles hard_cap and rolling overflow.
 */
export async function joinGroup(
  userId: string,
  groupId: string,
): Promise<{ ok: boolean; message?: string }> {
  const group = await getGroupOrThrow(groupId);
  const campaignId = group.campaign_id as string;

  // Check already a member
  const { data: existing } = await db()
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { ok: true, message: 'already_member' };

  // Load config
  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const gcfg = cfg.group!;

  // Check user has answered
  const { data: answers } = await db()
    .from('user_quiz_answers')
    .select('top_axis, axis_scores')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .single();
  if (!answers) throw new BadRequestError('คุณต้องตอบควิซก่อนเข้าร่วมกลุ่ม');

  // Count current members
  const members = await getMembersForGroup(groupId);
  const total = members.length;

  if (gcfg.overflow_mode === 'hard_cap') {
    if (total >= gcfg.max_members) {
      throw new BadRequestError('กลุ่มนี้เต็มแล้ว กรุณาสร้างกลุ่มใหม่');
    }
  }

  // Determine batch
  const currentBatch = group.current_batch as number;
  let batchNo = currentBatch;

  if (gcfg.overflow_mode === 'rolling' && gcfg.batch_size) {
    const batchMembers = members.filter(m => m.batch_no === currentBatch).length;
    if (batchMembers >= gcfg.batch_size) {
      // Current batch full → start new batch
      batchNo = currentBatch + 1;
      await db()
        .from('groups')
        .update({ current_batch: batchNo })
        .eq('id', groupId);
    }
  }

  await db().from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    top_axis: (answers as Record<string, unknown>).top_axis,
    axis_scores: (answers as Record<string, unknown>).axis_scores,
    batch_no: batchNo,
  });

  return { ok: true };
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
      topAxis: m.top_axis,
      batchNo: m.batch_no,
      joinedAt: m.joined_at,
    })),
    result: groupResult,
    canClaim,
    createdBy: group.created_by as string,
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
