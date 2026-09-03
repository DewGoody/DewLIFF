import { db } from '../db/client.js';
import { getConfig } from '../config/loader.js';
import { toPublicConfig, toPublicResult } from '../config/public.js';
import { validateAnswers, scoreAnswers, resolveSolo } from '../engine/buddyQuiz.js';
import { logEvent } from './events.js';
import { sendResultCard } from './push.js';
import { BadRequestError, NotFoundError, ConflictError } from '../errors/index.js';
import type { Answer } from '../config/schema.js';

// ────────────────────────────────────────────────── Start Solo

export type SoloStartResult = {
  sessionId: string;
  config: ReturnType<typeof toPublicConfig>;
};

export async function startSolo(
  userId: string,
  campaignId: string,
): Promise<SoloStartResult> {
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

  // Daily limit check
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await db()
    .from('pairs')
    .select('*', { count: 'exact', head: true })
    .eq('a_user', userId)
    .eq('campaign_id', campaignId)
    .gte('created_at', todayStart.toISOString());

  if (count !== null && count >= cfg.rules.max_pairs_per_user_per_day) {
    throw new ConflictError('Daily limit reached');
  }

  // Reuse pairs table — solo = a_user only, b_user null, completes immediately on answer
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: session, error: sessErr } = await db()
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

  if (sessErr || !session) throw new Error(`Failed to create session: ${sessErr?.message}`);

  logEvent({ userId, type: 'quiz_start', pairId: session.id, campaignId, meta: { mode: 'solo' } });

  return { sessionId: session.id, config: toPublicConfig(cfg) };
}

// ────────────────────────────────────────────────── Submit Solo Answers

export type SoloSubmitResult = {
  status: 'completed';
  result: ReturnType<typeof toPublicResult>;
  typeCode: string;
  poles: Record<string, string>;
  scores: Record<string, number>;
};

export async function submitSoloAnswers(
  userId: string,
  sessionId: string,
  answers: Answer[],
): Promise<SoloSubmitResult> {
  // Load session
  const { data: session, error: sessErr } = await db()
    .from('pairs')
    .select('id, campaign_id, config_version, a_user, status')
    .eq('id', sessionId)
    .single();

  if (sessErr || !session) throw new NotFoundError('Session not found');
  if (session.a_user !== userId) throw new BadRequestError('Not your session');
  if (session.status === 'completed') throw new ConflictError('Already completed');

  // Load frozen config
  const cfg = await getConfig(session.campaign_id, session.config_version);
  validateAnswers(cfg, answers);

  // Insert answers
  const answerRows = answers.map((a) => ({
    pair_id: sessionId,
    user_id: userId,
    question_id: a.questionId,
    option_id: a.optionId,
  }));

  await db().from('answers').upsert(answerRows, {
    onConflict: 'pair_id,user_id,question_id',
    ignoreDuplicates: true,
  });

  // Resolve immediately
  const outcome = resolveSolo(cfg, answers);

  // Update session
  await db()
    .from('pairs')
    .update({
      status: 'completed',
      result_code: outcome.result.code,
      scores: { a: outcome.scores },
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  logEvent({
    userId,
    type: 'pair_done',
    pairId: sessionId,
    campaignId: session.campaign_id,
    meta: { mode: 'solo', type_code: outcome.typeCode, used_fallback: outcome.usedFallback },
  });

  // Push result card เข้า chat — user เก็บไว้ใน chat + forward ได้
  sendResultCard(userId, session.campaign_id, outcome.result, {
    typeCode: outcome.typeCode,
  }).catch((e) => console.error('Solo result card push failed:', e));

  return {
    status: 'completed',
    result: toPublicResult(outcome.result),
    typeCode: outcome.typeCode,
    poles: outcome.poles,
    scores: outcome.scores,
  };
}
