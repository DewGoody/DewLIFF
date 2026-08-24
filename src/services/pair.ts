import { db } from '../db/client.js';
import { getConfig } from '../config/loader.js';
import { toPublicConfig, toPublicResult } from '../config/public.js';
import { validateAnswers, resolvePair } from '../engine/buddyQuiz.js';
import { sendResultCard } from './push.js';
import { createInvite, verifyAndConsumeInvite } from './invite.js';
import { logEvent } from './events.js';
import { DEMO_BUDDY_USER_ID, getDemoBuddyAnswers } from './demoBuddy.js';
import { sendPartnerDonePush } from './push.js';
import { writeResultToLineKit } from './lineKitClient.js';
import { BadRequestError, NotFoundError, ConflictError } from '../errors/index.js';
import type { Answer, CampaignConfig } from '../config/schema.js';

// ────────────────────────────────────────────────── Start Quiz

export type StartResult = {
  pairId: string;
  inviteToken?: string;
  config: ReturnType<typeof toPublicConfig>;
};

export async function startQuiz(
  userId: string,
  campaignId: string,
  demo: boolean,
): Promise<StartResult> {
  // Load campaign
  const { data: campaign, error: campErr } = await db()
    .from('campaigns')
    .select('id, status, current_version, starts_at, ends_at')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw new NotFoundError(`Campaign not found: ${campaignId}`);
  if (campaign.status !== 'live') throw new BadRequestError('Campaign is not live');

  const now = new Date();
  if (campaign.starts_at && new Date(campaign.starts_at) > now) throw new BadRequestError('Campaign has not started');
  if (campaign.ends_at && new Date(campaign.ends_at) < now) throw new BadRequestError('Campaign has ended');

  const cfg = await getConfig(campaignId, campaign.current_version);

  // Check daily pair limit
  if (!demo) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await db()
      .from('pairs')
      .select('*', { count: 'exact', head: true })
      .eq('a_user', userId)
      .eq('campaign_id', campaignId)
      .gte('created_at', todayStart.toISOString());

    if (count !== null && count >= cfg.rules.max_pairs_per_user_per_day) {
      throw new ConflictError('Daily pair limit reached');
    }
  }

  // Compute expiry
  const expiresAt = new Date(now.getTime() + cfg.rules.invite_ttl_hours * 60 * 60 * 1000);

  if (demo) {
    // Demo mode: pair with demo buddy, pre-fill answers
    const { data: pair, error: pairErr } = await db()
      .from('pairs')
      .insert({
        campaign_id: campaignId,
        config_version: campaign.current_version,
        a_user: userId,
        b_user: DEMO_BUDDY_USER_ID,
        status: 'waiting',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (pairErr || !pair) throw new Error(`Failed to create demo pair: ${pairErr?.message}`);

    // Insert demo buddy answers
    const demoAnswers = getDemoBuddyAnswers(cfg);
    const answerRows = demoAnswers.map((a) => ({
      pair_id: pair.id,
      user_id: DEMO_BUDDY_USER_ID,
      question_id: a.questionId,
      option_id: a.optionId,
    }));
    await db().from('answers').insert(answerRows);

    logEvent({ userId, type: 'quiz_start', pairId: pair.id, campaignId, meta: { demo: true } });

    return { pairId: pair.id, config: toPublicConfig(cfg) };
  }

  // Normal mode: create pair + invite token
  const { data: pair, error: pairErr } = await db()
    .from('pairs')
    .insert({
      campaign_id: campaignId,
      config_version: campaign.current_version,
      a_user: userId,
      status: 'waiting',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (pairErr || !pair) throw new Error(`Failed to create pair: ${pairErr?.message}`);

  const inviteToken = await createInvite(pair.id, expiresAt);

  logEvent({ userId, type: 'quiz_start', pairId: pair.id, campaignId });

  return { pairId: pair.id, inviteToken, config: toPublicConfig(cfg) };
}

// ────────────────────────────────────────────────── Join Pair

export type JoinResult = {
  pairId: string;
  config: ReturnType<typeof toPublicConfig>;
};

export async function joinPair(userId: string, rawToken: string): Promise<JoinResult> {
  const invite = await verifyAndConsumeInvite(rawToken, userId);
  const cfg = await getConfig(invite.campaignId, invite.configVersion);

  logEvent({
    userId,
    type: 'invite_open',
    pairId: invite.pairId,
    campaignId: invite.campaignId,
  });

  return { pairId: invite.pairId, config: toPublicConfig(cfg) };
}

// ────────────────────────────────────────────────── Submit Answers

export type SubmitResult =
  | { status: 'waiting' }
  | { status: 'completed'; result: ReturnType<typeof toPublicResult>; axisMe: string; axisBuddy: string };

export async function submitAnswers(
  userId: string,
  pairId: string,
  answers: Answer[],
): Promise<SubmitResult> {
  // Load pair
  const { data: pair, error: pairErr } = await db()
    .from('pairs')
    .select('id, campaign_id, config_version, a_user, b_user, status')
    .eq('id', pairId)
    .single();

  if (pairErr || !pair) throw new NotFoundError('Pair not found');
  if (pair.status === 'completed') throw new ConflictError('Pair already completed');
  if (pair.status === 'expired') throw new BadRequestError('Pair has expired');

  const isA = pair.a_user === userId;
  const isB = pair.b_user === userId;
  if (!isA && !isB) throw new BadRequestError('You are not part of this pair');

  // Load frozen config
  const cfg = await getConfig(pair.campaign_id, pair.config_version);
  validateAnswers(cfg, answers);

  // Insert answers (ON CONFLICT DO NOTHING for idempotency)
  const answerRows = answers.map((a) => ({
    pair_id: pairId,
    user_id: userId,
    question_id: a.questionId,
    option_id: a.optionId,
  }));

  const { error: ansErr } = await db().from('answers').upsert(answerRows, {
    onConflict: 'pair_id,user_id,question_id',
    ignoreDuplicates: true,
  });
  if (ansErr) throw new Error(`Failed to save answers: ${ansErr.message}`);

  // Check if both users have answered
  const { data: allAnswers, error: fetchErr } = await db()
    .from('answers')
    .select('user_id, question_id, option_id')
    .eq('pair_id', pairId);

  if (fetchErr || !allAnswers) throw new Error('Failed to fetch answers');

  const userIds = new Set(allAnswers.map((a) => a.user_id));

  if (userIds.size < 2) {
    logEvent({ userId, type: 'quiz_done', pairId, campaignId: pair.campaign_id });
    return { status: 'waiting' };
  }

  // Both answered — resolve
  const answersA: Answer[] = allAnswers
    .filter((a) => a.user_id === pair.a_user)
    .map((a) => ({ questionId: a.question_id, optionId: a.option_id }));

  const answersB: Answer[] = allAnswers
    .filter((a) => a.user_id === pair.b_user)
    .map((a) => ({ questionId: a.question_id, optionId: a.option_id }));

  const outcome = resolvePair(cfg, answersA, answersB);

  // Update pair
  await db()
    .from('pairs')
    .update({
      status: 'completed',
      result_code: outcome.result.code,
      scores: {
        a: outcome.scoresA,
        b: outcome.scoresB,
        combined: outcome.combined,
      },
      completed_at: new Date().toISOString(),
    })
    .eq('id', pairId);

  logEvent({
    userId,
    type: 'pair_done',
    pairId,
    campaignId: pair.campaign_id,
    meta: { result_code: outcome.result.code, used_fallback: outcome.usedFallback },
  });

  const myAxis = isA ? outcome.axisA : outcome.axisB;
  const buddyAxis = isA ? outcome.axisB : outcome.axisA;

  // Push result card เข้า chat ของคนที่เพิ่งตอบ (ได้ card เก็บไว้ใน chat)
  sendResultCard(userId, pair.campaign_id, outcome.result, {
    pairId,
    axisMe: myAxis,
    axisBuddy: buddyAxis,
  }).catch((e) => console.error('Result card push failed:', e));

  // Also tell LineKit this player's result — server-to-server, doesn't touch
  // KimLIFF's own DB write or trust model, and must never break the response above.
  // Awaited (not fire-and-forget): on Vercel, work left running after the response
  // is sent can be frozen mid-flight before the fetch ever completes — writeResultToLineKit
  // never throws, so awaiting it costs a little latency but no reliability.
  await writeResultToLineKit(userId, {
    source: 'buddy_quiz_pair',
    campaignId: pair.campaign_id,
    pairId,
    resultCode: outcome.result.code,
    resultTitle: outcome.result.title,
    axisMe: myAxis,
    axisBuddy: buddyAxis,
    scores: { a: outcome.scoresA, b: outcome.scoresB, combined: outcome.combined },
  }, pairId).catch((e) => console.error('LineKit write-back failed:', e));

  // Push notification to the other user (skip for demo buddy)
  const otherUser = isA ? pair.b_user : pair.a_user;
  if (otherUser && otherUser !== DEMO_BUDDY_USER_ID) {
    sendPartnerDonePush(otherUser, pair.campaign_id, pairId)
      .then(() => logEvent({ userId: otherUser, type: 'push_sent', pairId, campaignId: pair.campaign_id }))
      .catch((e) => console.error('Partner done push failed:', e));

    await writeResultToLineKit(otherUser, {
      source: 'buddy_quiz_pair',
      campaignId: pair.campaign_id,
      pairId,
      resultCode: outcome.result.code,
      resultTitle: outcome.result.title,
      axisMe: buddyAxis,
      axisBuddy: myAxis,
      scores: { a: outcome.scoresA, b: outcome.scoresB, combined: outcome.combined },
    }, pairId).catch((e) => console.error('LineKit write-back failed (partner):', e));
  }

  return {
    status: 'completed',
    result: toPublicResult(outcome.result),
    axisMe: myAxis,
    axisBuddy: buddyAxis,
  };
}

// ────────────────────────────────────────────────── Get Pair Status

export type PairView =
  | { status: 'waiting' }
  | { status: 'expired' }
  | {
      status: 'completed';
      result: ReturnType<typeof toPublicResult>;
      axisMe: string;
      axisBuddy: string;
    };

export async function getPairStatus(userId: string, pairId: string): Promise<PairView> {
  const { data: pair, error } = await db()
    .from('pairs')
    .select('id, campaign_id, config_version, a_user, b_user, status, result_code, scores')
    .eq('id', pairId)
    .single();

  if (error || !pair) throw new NotFoundError('Pair not found');

  const isA = pair.a_user === userId;
  const isB = pair.b_user === userId;
  if (!isA && !isB) throw new NotFoundError('Pair not found');

  if (pair.status === 'waiting') return { status: 'waiting' };
  if (pair.status === 'expired') return { status: 'expired' };

  // Completed — return result
  const cfg = await getConfig(pair.campaign_id, pair.config_version);
  const resultRule = cfg.results.find((r) => r.code === pair.result_code);
  if (!resultRule) throw new Error('Result rule not found in config');

  const scores = pair.scores as { a: Record<string, number>; b: Record<string, number> };
  const { dominantAxis } = await import('../engine/buddyQuiz.js');
  const axisA = dominantAxis(cfg, scores.a);
  const axisB = dominantAxis(cfg, scores.b);

  const labelOf = (id: string) => cfg.axes.find((a) => a.id === id)?.label || id;

  return {
    status: 'completed',
    result: toPublicResult(resultRule),
    axisMe: isA ? labelOf(axisA) : labelOf(axisB),
    axisBuddy: isA ? labelOf(axisB) : labelOf(axisA),
  };
}
