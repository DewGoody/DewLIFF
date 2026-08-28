/**
 * New architecture: A answers once (stored in user_quiz_answers).
 * Sharing link = ?inviterId={A_lineUserId}&campaignId={cid}
 * B clicks → answers → this service computes result A+B → pushes both.
 */

import { db } from '../db/client.js';
import { getConfig } from '../config/loader.js';
import { toPublicConfig, toPublicResult } from '../config/public.js';
import { validateAnswers, resolvePair, scoreAnswers, dominantAxis } from '../engine/buddyQuiz.js';
import { pushMessage } from './line.js';
import { getProfile } from './line.js';
import { writeResultToLineKit } from './lineKitClient.js';
import { logEvent } from './events.js';
import { getAppBaseUrl } from '../env.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import type { Answer } from '../config/schema.js';

// ── Save A's answers (permanent, one per campaign) ──────────────────

export async function saveUserAnswers(
  userId: string,
  campaignId: string,
  answers: Answer[],
): Promise<{ ok: boolean; inviterUrl: string; myArchetype: string; myArchetypeLabel: string }> {
  // Load campaign
  const { data: campaign, error: campErr } = await db()
    .from('campaigns')
    .select('id, status, current_version')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw new NotFoundError(`Campaign not found: ${campaignId}`);
  if (campaign.status !== 'live') throw new BadRequestError('Campaign is not live');

  const cfg = await getConfig(campaignId, campaign.current_version);
  validateAnswers(cfg, answers);

  // Ensure user record exists FIRST (user_quiz_answers has FK → users)
  // Use ignoreDuplicates: true so this is fast even if record already exists
  await db()
    .from('users')
    .upsert({ line_user_id: userId, display_name: userId }, { onConflict: 'line_user_id', ignoreDuplicates: true });
  // Update display_name in background if we can get it from LINE
  getProfile(userId).then((profile) => {
    if (profile) {
      db().from('users').update({ display_name: profile.displayName }).eq('line_user_id', userId).then(() => {});
    }
  }).catch(() => {});

  // Upsert answers — A can retake if needed but it's idempotent by default
  const rows = answers.map((a) => ({
    user_id: userId,
    campaign_id: campaignId,
    question_id: a.questionId,
    option_id: a.optionId,
  }));

  const { error: ansErr } = await db()
    .from('user_quiz_answers')
    .upsert(rows, { onConflict: 'user_id,campaign_id,question_id' });

  if (ansErr) throw new Error(`Failed to save answers: ${ansErr.message}`);

  logEvent({ userId, type: 'quiz_done', campaignId, meta: { mode: 'save_answers' } });

  // Compute new axis scores (needed both for return value and cascade updates)
  const scores = scoreAnswers(cfg, answers);
  const myAxis = dominantAxis(cfg, scores);
  const myAxisDef = cfg.axes.find((a) => a.id === myAxis);

  // ── Cascade: update group_members rows for this user (fire-and-forget) ──────
  // One person = one result — new answers must propagate to every group they're in.
  cascadeGroupMemberUpdate(userId, campaignId, myAxis, scores).catch((e) =>
    console.warn('[saveAnswers] group cascade failed:', e),
  );

  // ── Cascade: recompute all completed pairs involving this user (fire-and-forget) ─
  cascadePairResultUpdate(userId, campaignId, answers, cfg).catch((e) =>
    console.warn('[saveAnswers] pair cascade failed:', e),
  );

  const liffBase = (process.env.LIFF_URL || `https://liff.line.me/2011037337-KlqFK4LM`).trim();
  const inviterUrl = `${liffBase}?inviterId=${userId}&campaignId=${campaignId}`;

  return {
    ok: true,
    inviterUrl,
    myArchetype: myAxis,
    myArchetypeLabel: myAxisDef?.label || myAxis,
  };
}

// ── Cascade helpers (called fire-and-forget from saveUserAnswers) ─────────────

/** Update axis_scores + top_axis in every group_members row for this user × campaign. */
async function cascadeGroupMemberUpdate(
  userId: string,
  campaignId: string,
  topAxis: string,
  axisScores: Record<string, number>,
): Promise<void> {
  // Find all group_ids this user belongs to
  const { data: memberships } = await db()
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (!memberships?.length) return;

  const groupIds = memberships.map((m) => m.group_id as string);

  // Filter to groups belonging to this campaign
  const { data: groups } = await db()
    .from('groups')
    .select('id')
    .in('id', groupIds)
    .eq('campaign_id', campaignId);

  const relevantGroupIds = (groups ?? []).map((g) => g.id as string);
  if (!relevantGroupIds.length) return;

  // Update using user_id + group_id directly (avoids relying on row id column)
  const { error } = await db()
    .from('group_members')
    .update({ top_axis: topAxis, axis_scores: axisScores })
    .eq('user_id', userId)
    .in('group_id', relevantGroupIds);

  if (error) console.warn('[cascadeGroupMemberUpdate] failed:', error.message);
}

/** Recompute result_code + scores for all completed pairs involving this user. */
async function cascadePairResultUpdate(
  userId: string,
  campaignId: string,
  newAnswers: Answer[],
  cfg: Awaited<ReturnType<typeof getConfig>>,
): Promise<void> {
  // Fetch all completed pairs where this user is A or B
  const { data: pairs } = await db()
    .from('pairs')
    .select('id, a_user, b_user')
    .eq('campaign_id', campaignId)
    .eq('status', 'completed')
    .or(`a_user.eq.${userId},b_user.eq.${userId}`);

  if (!pairs?.length) return;

  // Collect unique partner ids
  const partnerIds = [...new Set(
    (pairs as Array<{ id: string; a_user: string; b_user: string }>)
      .map((p) => p.a_user === userId ? p.b_user : p.a_user),
  )];

  // Fetch all partners' current answers in one query per partner
  const partnerAnswerMap = new Map<string, Answer[]>();
  await Promise.all(partnerIds.map(async (partnerId) => {
    const { data: rows } = await db()
      .from('user_quiz_answers')
      .select('question_id, option_id')
      .eq('user_id', partnerId)
      .eq('campaign_id', campaignId);
    if (rows?.length) {
      partnerAnswerMap.set(partnerId, rows.map((r) => ({ questionId: r.question_id, optionId: r.option_id })));
    }
  }));

  // Recompute each pair
  await Promise.all(
    (pairs as Array<{ id: string; a_user: string; b_user: string }>).map(async (pair) => {
      const partnerId = pair.a_user === userId ? pair.b_user : pair.a_user;
      const partnerAnswers = partnerAnswerMap.get(partnerId);
      if (!partnerAnswers) return; // partner hasn't answered — skip

      // Keep A=inviter, B=invitee convention regardless of who retook
      const aAnswers = pair.a_user === userId ? newAnswers : partnerAnswers;
      const bAnswers = pair.a_user === userId ? partnerAnswers : newAnswers;

      try {
        const outcome = resolvePair(cfg, aAnswers, bAnswers);
        await db()
          .from('pairs')
          .update({
            result_code: outcome.result.code,
            scores: { a: outcome.scoresA, b: outcome.scoresB, combined: outcome.combined },
          })
          .eq('id', pair.id);
      } catch (e) {
        console.warn(`[saveAnswers] pair ${pair.id} recompute failed:`, e);
      }
    }),
  );
}

// ── Get inviter profile ─────────────────────────────────────────────

export async function getInviterProfile(inviterId: string, campaignId?: string): Promise<{
  displayName: string;
  pictureUrl?: string;
  archLabel?: string;
  archEn?: string;
}> {
  // Try DB first
  const { data: user } = await db()
    .from('users')
    .select('display_name')
    .eq('line_user_id', inviterId)
    .single();

  let displayName: string;
  let pictureUrl: string | undefined;

  if (user?.display_name) {
    displayName = user.display_name;
    const profile = await getProfile(inviterId);
    pictureUrl = profile?.pictureUrl;
  } else {
    const profile = await getProfile(inviterId);
    if (!profile) throw new NotFoundError('Inviter not found');
    displayName = profile.displayName;
    pictureUrl = profile.pictureUrl;
  }

  // Optionally resolve archetype if campaignId provided
  let archLabel: string | undefined;
  let archEn: string | undefined;
  if (campaignId) {
    try {
      const { data: campaign } = await db()
        .from('campaigns')
        .select('current_version')
        .eq('id', campaignId)
        .single();
      if (campaign) {
        const cfg = await getConfig(campaignId, campaign.current_version);
        const { data: ansRows } = await db()
          .from('user_quiz_answers')
          .select('question_id, option_id')
          .eq('user_id', inviterId)
          .eq('campaign_id', campaignId);
        if (ansRows && ansRows.length > 0) {
          const answers: Answer[] = ansRows.map((r) => ({ questionId: r.question_id, optionId: r.option_id }));
          const scores = scoreAnswers(cfg, answers);
          const axisId = dominantAxis(cfg, scores);
          const axisDef = cfg.axes.find((a) => a.id === axisId);
          archLabel = axisDef?.label;
          archEn = (axisDef as any)?.label_en;
        }
      }
    } catch { /* non-critical */ }
  }

  return { displayName, pictureUrl, archLabel, archEn };
}

// ── Check if user has already answered this campaign ────────────────

export async function getMyAnswers(
  userId: string,
  campaignId: string,
): Promise<{ answered: boolean; answers?: Answer[] }> {
  const { data, error } = await db()
    .from('user_quiz_answers')
    .select('question_id, option_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId);

  if (error || !data || data.length === 0) return { answered: false };

  const answers: Answer[] = data.map((r) => ({ questionId: r.question_id, optionId: r.option_id }));
  return { answered: true, answers };
}

// ── Match: B answers, compute A+B result, push both ─────────────────

export type MatchResult = {
  pairId: string;
  result: ReturnType<typeof toPublicResult>;
  axisMe: string;
  axisBuddy: string;
  axisMeShort?: string;
  axisBuddyShort?: string;
  resultRank?: number;
  config: ReturnType<typeof toPublicConfig>;
  pushSentToInviter: boolean;
  inviterShareUrl?: string; // fallback share URL if push failed
};

export async function matchAndCompute(
  bUserId: string,
  inviterId: string,
  campaignId: string,
  bAnswers?: Answer[],
  opts?: { fromGroup?: boolean },
): Promise<MatchResult> {
  if (bUserId === inviterId) throw new BadRequestError('ไม่สามารถจับคู่กับตัวเองได้');

  // Load campaign
  const { data: campaign, error: campErr } = await db()
    .from('campaigns')
    .select('id, status, current_version')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw new NotFoundError(`Campaign not found: ${campaignId}`);
  if (campaign.status !== 'live') throw new BadRequestError('Campaign is not live');

  const cfg = await getConfig(campaignId, campaign.current_version);

  // Load A's stored answers
  const { data: aRows, error: aErr } = await db()
    .from('user_quiz_answers')
    .select('question_id, option_id')
    .eq('user_id', inviterId)
    .eq('campaign_id', campaignId);

  if (aErr || !aRows || aRows.length === 0) {
    throw new NotFoundError('ยังไม่มีคำตอบของผู้ชวน');
  }

  const aAnswers: Answer[] = aRows.map((r) => ({ questionId: r.question_id, optionId: r.option_id }));

  // Load B's answers from DB if not provided
  if (!bAnswers) {
    const { data: bRows } = await db()
      .from('user_quiz_answers')
      .select('question_id, option_id')
      .eq('user_id', bUserId)
      .eq('campaign_id', campaignId);
    if (!bRows || bRows.length === 0) {
      throw new BadRequestError('ยังไม่มีคำตอบของผู้รับเชิญ กรุณาตอบคำถามก่อน');
    }
    bAnswers = bRows.map((r) => ({ questionId: r.question_id, optionId: r.option_id }));
  }

  // Check for existing pair between A+B (any status, either role order) to avoid duplicates.
  // Also covers group-join re-entries: same person clicks group link again → already paired → skip.
  const { data: existingPairs } = await db()
    .from('pairs')
    .select('id, status, result_code, scores')
    .eq('campaign_id', campaignId)
    .or(`and(a_user.eq.${inviterId},b_user.eq.${bUserId}),and(a_user.eq.${bUserId},b_user.eq.${inviterId})`)
    .order('created_at', { ascending: false })
    .limit(1);
  const existingPair = existingPairs?.[0] ?? null;

  if (existingPair) {
    // Return existing result instead of creating a duplicate pair
    const outcome = resolvePair(cfg, aAnswers, bAnswers);
    const bAxisMe = outcome.axisB;
    const bAxisBuddy = outcome.axisA;
    return {
      pairId: existingPair.id,
      result: toPublicResult(outcome.result),
      axisMe: cfg.axes.find((a) => a.id === bAxisMe)?.label || bAxisMe,
      axisBuddy: cfg.axes.find((a) => a.id === bAxisBuddy)?.label || bAxisBuddy,
      axisMeShort: (cfg.axes.find((a) => a.id === bAxisMe) as any)?.short,
      axisBuddyShort: (cfg.axes.find((a) => a.id === bAxisBuddy) as any)?.short,
      resultRank: outcome.result.rank,
      config: toPublicConfig(cfg),
      pushSentToInviter: false,
    };
  }

  // Validate both
  validateAnswers(cfg, aAnswers);
  validateAnswers(cfg, bAnswers);

  // Ensure B user record exists FIRST
  await db()
    .from('users')
    .upsert({ line_user_id: bUserId, display_name: bUserId }, { onConflict: 'line_user_id', ignoreDuplicates: true });
  const bProfile = await getProfile(bUserId);
  if (bProfile) {
    await db().from('users').update({ display_name: bProfile.displayName }).eq('line_user_id', bUserId).then(() => {});
  }
  // Resolve B's display name: prefer LINE profile, then users table, then fallback
  const { data: bUserRow } = await db().from('users').select('display_name').eq('line_user_id', bUserId).maybeSingle();
  const bDisplayName = bProfile?.displayName || (bUserRow?.display_name !== bUserId ? bUserRow?.display_name : undefined) || 'คู่หู';

  // Create pair record
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const { data: pair, error: pairErr } = await db()
    .from('pairs')
    .insert({
      campaign_id: campaignId,
      config_version: campaign.current_version,
      a_user: inviterId,
      b_user: bUserId,
      status: 'waiting',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (pairErr || !pair) throw new Error(`Failed to create pair: ${pairErr?.message}`);

  // Save both answer sets to answers table (for history)
  const answerRows = [
    ...aAnswers.map((a) => ({ pair_id: pair.id, user_id: inviterId, question_id: a.questionId, option_id: a.optionId })),
    ...bAnswers.map((a) => ({ pair_id: pair.id, user_id: bUserId, question_id: a.questionId, option_id: a.optionId })),
  ];
  await db().from('answers').insert(answerRows);

  // Also save B's answers to user_quiz_answers so B gets their own summary page
  const bUserAnswerRows = bAnswers.map((a) => ({
    user_id: bUserId,
    campaign_id: campaignId,
    question_id: a.questionId,
    option_id: a.optionId,
  }));
  await db()
    .from('user_quiz_answers')
    .upsert(bUserAnswerRows, { onConflict: 'user_id,campaign_id,question_id' })
    .then(() => {}, (e: unknown) => console.warn('[match] save B user_quiz_answers failed:', e));

  // Resolve result
  const outcome = resolvePair(cfg, aAnswers, bAnswers);

  // Update pair to completed
  await db()
    .from('pairs')
    .update({
      status: 'completed',
      result_code: outcome.result.code,
      scores: { a: outcome.scoresA, b: outcome.scoresB, combined: outcome.combined },
      completed_at: new Date().toISOString(),
    })
    .eq('id', pair.id);

  logEvent({ userId: bUserId, type: 'pair_done', pairId: pair.id, campaignId, meta: { result_code: outcome.result.code } });

  const liffBase = (process.env.LIFF_URL || `https://liff.line.me/2011037337-KlqFK4LM`).trim();

  // Push to B: result card
  const bAxisMe = outcome.axisB;
  const bAxisBuddy = outcome.axisA;
  const aProfile = await getInviterProfile(inviterId).catch(() => ({ displayName: 'เพื่อน' }));
  const bName = bDisplayName;

  // F-04 for A: kilo notification that partner answered
  const partnerAnsweredCard = buildPartnerAnsweredCard(cfg, campaignId, outcome.result, {
    pairId: pair.id,
    partnerName: bName,
    axisMe: outcome.axisA,
    axisBuddy: outcome.axisB,
    liffBase,
  });

  // Also tell LineKit both players' results — server-to-server, doesn't touch
  // KimLIFF's own DB write or trust model, and must never break the push/response below.
  const lineKitPayloadBase = {
    source: 'buddy_quiz_match',
    campaignId,
    pairId: pair.id,
    resultCode: outcome.result.code,
    resultTitle: outcome.result.title,
    scores: { a: outcome.scoresA, b: outcome.scoresB, combined: outcome.combined },
  };
  const lineKitWrites: Promise<void>[] = [
    writeResultToLineKit(bUserId, {
      ...lineKitPayloadBase,
      axisMe: bAxisMe,
      axisBuddy: bAxisBuddy,
    }, pair.id).catch((e) => console.error('LineKit write-back failed (B):', e)),
    writeResultToLineKit(inviterId, {
      ...lineKitPayloadBase,
      axisMe: outcome.axisA,
      axisBuddy: outcome.axisB,
    }, pair.id).catch((e) => console.error('LineKit write-back failed (A):', e)),
  ];

  // B sees result immediately in LIFF — no push needed for B.
  // A gets F-04 notification — UNLESS this match came from a group join flow,
  // in which case A already received a group-update push (no need to double-notify).
  // Await everything below before returning — on Vercel, work left running after the
  // response is sent can be frozen mid-flight, so the push (when sent) and the LineKit
  // write-backs (which never throw on their own) all have to finish inside this call.
  let pushSentToInviter = false;
  if (!opts?.fromGroup) {
    const [pushAResult] = await Promise.allSettled([
      pushMessage(inviterId, partnerAnsweredCard),
      ...lineKitWrites,
    ]);
    pushSentToInviter = pushAResult.status === 'fulfilled';
    if (pushSentToInviter) {
      logEvent({ userId: inviterId, type: 'push_sent', pairId: pair.id, campaignId });
    } else {
      console.error('Push to A failed:', (pushAResult as PromiseRejectedResult).reason);
    }
  } else {
    await Promise.allSettled(lineKitWrites);
  }

  // If push to A failed (not a follower), provide a share URL B can use to notify A manually
  const inviterShareUrl = pushSentToInviter
    ? undefined
    : `${liffBase}?campaignId=${campaignId}&pairId=${pair.id}`;

  return {
    pairId: pair.id,
    result: toPublicResult(outcome.result),
    axisMe: cfg.axes.find((a) => a.id === bAxisMe)?.label || bAxisMe,
    axisBuddy: cfg.axes.find((a) => a.id === bAxisBuddy)?.label || bAxisBuddy,
    axisMeShort: (cfg.axes.find((a) => a.id === bAxisMe) as any)?.short,
    axisBuddyShort: (cfg.axes.find((a) => a.id === bAxisBuddy) as any)?.short,
    resultRank: outcome.result.rank,
    config: toPublicConfig(cfg),
    pushSentToInviter,
    inviterShareUrl,
  };
}

// ── Message builders ────────────────────────────────────────────────

const AXIS_CARD_FALLBACK: Record<string, string> = {
  chill: 'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-01-chiller-v2.png',
  mu:    'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-02-mystic-v2.png',
  live:  'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-03-influencer-v2.png',
  prep:  'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-04-prepper-v2.png',
  line:  'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-05-analyst-v2.png',
};

function getAxisCardUrl(
  axisId: string,
  axes: Array<{ id: string; image_url?: string }>,
): string {
  return axes.find(a => a.id === axisId)?.image_url || AXIS_CARD_FALLBACK[axisId] || AXIS_CARD_FALLBACK['prep'];
}

function buildAxisPairBox(
  cardUrlMe: string, nameMe: string, labelMe: string,
  cardUrlBuddy: string, nameBuddy: string, labelBuddy: string,
): Record<string, unknown> {
  const memberBox = (cardUrl: string, name: string, label: string) => ({
    type: 'box', layout: 'vertical', alignItems: 'center', flex: 1,
    contents: [
      { type: 'image', url: cardUrl, size: 'sm', aspectRatio: '9:13', aspectMode: 'fit' },
      { type: 'text', text: name, size: 'xxs', align: 'center', color: '#888888', margin: 'xs' },
      { type: 'text', text: label, size: 'xs', align: 'center', weight: 'bold', wrap: true },
    ],
  });
  return {
    type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'md',
    contents: [memberBox(cardUrlMe, nameMe, labelMe), memberBox(cardUrlBuddy, nameBuddy, labelBuddy)],
  };
}

function liffPairUrl(liffBase: string, campaignId: string, pairId: string): string {
  return `${liffBase}?campaignId=${campaignId}&pairId=${pairId}`;
}

// DewLIFF is its own separate Vercel deployment from KimLIFF's — never hardcode
// KimLIFF's own domain here. getAppBaseUrl() self-configures to whichever domain
// this project is actually deployed to (see src/env.ts).
const OG_BASE = `${getAppBaseUrl()}/api/og`;

function buildMatchResultCard(
  cfg: Parameters<typeof toPublicConfig>[0],
  campaignId: string,
  result: { title: string; body: string; image_url?: string; code: string; rank?: number },
  opts: { pairId: string; axisMe: string; axisBuddy: string; buddyName: string; liffBase: string },
) {
  const primary = cfg.brand.primary || '#E8354F';
  const eyebrow = cfg.copy?.['result_eyebrow'] || 'ผลลัพท์คู่';
  const axMeLabel = cfg.axes.find((a) => a.id === opts.axisMe)?.label || opts.axisMe;
  const axBuddyLabel = cfg.axes.find((a) => a.id === opts.axisBuddy)?.label || opts.axisBuddy;
  const cardMeUrl = getAxisCardUrl(opts.axisMe, cfg.axes);
  const cardBuddyUrl = getAxisCardUrl(opts.axisBuddy, cfg.axes);

  // Hero: PNG of 2 axis cards tilted ±8° on yellow bg (cards only, no text)
  const heroUrl = `${OG_BASE}?${new URLSearchParams({ type: 'pair', cardMeUrl, cardBuddyUrl })}`;

  return [
    {
      type: 'flex',
      altText: `${eyebrow}: ${result.title}`.slice(0, 400),
      contents: {
        type: 'bubble',
        size: 'mega',
        hero: { type: 'image', url: heroUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' },
        body: {
          type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
          contents: [
            // Survival title + subtitle inline
            {
              type: 'box', layout: 'horizontal', alignItems: 'baseline', spacing: 'sm',
              contents: [
                { type: 'text', text: result.title, weight: 'bold', size: 'xxl', color: primary, flex: 0 },
                { type: 'text', text: cfg.copy?.['result_subtitle'] || 'คือเวลาที่คู่นี้รอด', size: 'xxs', color: '#888888', wrap: true, flex: 1 },
              ],
            },
            // Axis pair boxes: buddy (gray bg) | me (yellow bg)
            {
              type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'sm',
              contents: [
                {
                  type: 'box', layout: 'vertical', flex: 1, paddingAll: '10px',
                  backgroundColor: 'rgba(28,26,23,.07)', cornerRadius: '8px',
                  contents: [
                    { type: 'text', text: opts.buddyName, size: 'xxs', color: '#888888' },
                    { type: 'text', text: axBuddyLabel, weight: 'bold', size: 'sm', color: '#1C1A17', wrap: true, margin: 'xs' },
                  ],
                },
                {
                  type: 'box', layout: 'vertical', flex: 1, paddingAll: '10px',
                  backgroundColor: '#F5E14B', cornerRadius: '8px',
                  contents: [
                    { type: 'text', text: cfg.copy?.['me'] || 'คุณ', size: 'xxs', color: '#888888' },
                    { type: 'text', text: axMeLabel, weight: 'bold', size: 'sm', color: '#1C1A17', wrap: true, margin: 'xs' },
                  ],
                },
              ],
            },
            // Body text
            ...(result.body ? [{ type: 'text' as const, text: result.body, size: 'sm' as const, color: '#555555', wrap: true, margin: 'sm' as const }] : []),
          ],
        },
        footer: {
          type: 'box', layout: 'vertical', spacing: 'sm',
          contents: [
            { type: 'button', action: { type: 'uri', label: cfg.copy?.['result_cta'] || 'ดูผลคู่แบบเต็ม', uri: liffPairUrl(opts.liffBase, campaignId, opts.pairId) }, style: 'primary', color: primary },
            { type: 'button', action: { type: 'uri', label: cfg.copy?.['result_cta2'] || 'ชวนคนต่อไป', uri: `${opts.liffBase}?campaignId=${campaignId}&view=share` }, style: 'secondary' },
          ],
        },
      },
    },
  ];
}

function buildPartnerAnsweredCard(
  cfg: Parameters<typeof toPublicConfig>[0],
  campaignId: string,
  _result: { title: string; body: string; code: string },
  opts: { pairId: string; partnerName: string; axisMe: string; axisBuddy: string; liffBase: string },
) {
  const primary = cfg.brand.primary || '#E8354F';
  const axBuddyLabel = cfg.axes.find((a) => a.id === opts.axisBuddy)?.label || opts.axisBuddy;
  const buddyCardUrl = getAxisCardUrl(opts.axisBuddy, cfg.axes);
  const altText = `${opts.partnerName} ตอบจบแล้ว — ดูผลคู่ + จัดทีม`;

  return [
    {
      type: 'flex',
      altText,
      contents: {
        type: 'bubble',
        size: 'kilo',
        body: {
          type: 'box', layout: 'horizontal', paddingAll: '14px', spacing: 'md', alignItems: 'center',
          contents: [
            // Left: partner's axis card image
            {
              type: 'box', layout: 'vertical', flex: 0, width: '68px',
              contents: [
                { type: 'image', url: buddyCardUrl, size: 'full', aspectRatio: '3:4', aspectMode: 'fit' },
              ],
            },
            // Right: badge + name + axis sub
            {
              type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
              contents: [
                {
                  type: 'box', layout: 'vertical', paddingAll: '3px', backgroundColor: '#F5E14B',
                  cornerRadius: '4px', width: '120px',
                  contents: [{ type: 'text', text: cfg.copy?.['F04_badge'] || 'เพื่อนใหม่ในรายชื่อ', size: 'xxs', weight: 'bold', color: '#1C1A17', align: 'center' }],
                },
                { type: 'text', text: `${opts.partnerName} ตอบจบแล้ว`, weight: 'bold', size: 'sm', color: '#1C1A17', wrap: true, margin: 'xs' },
                { type: 'text', text: `${axBuddyLabel} · ${cfg.copy?.['F04_sub_suffix'] || 'หยิบเข้าทีมได้เลย'}`, size: 'xxs', color: '#888888', margin: 'xs' },
              ],
            },
          ],
        },
        footer: {
          type: 'box', layout: 'vertical', paddingAll: '12px',
          contents: [
            { type: 'button', action: { type: 'uri', label: cfg.copy?.['F04_cta'] || 'ดูผลคู่ + จัดทีม', uri: liffPairUrl(opts.liffBase, campaignId, opts.pairId) }, style: 'primary', color: primary, height: 'sm' },
          ],
        },
      },
    },
  ];
}

// ── My summary (persistent home screen data) ────────────────────────

export interface PairSummaryEntry {
  pairId: string;
  role: 'inviter' | 'invitee';
  partnerName: string;
  status: 'waiting' | 'completed' | 'expired';
  resultTitle?: string;
  partnerAxisLabel?: string;
  completedAt?: string;
  completedAtIso?: string;
}

export interface MySummaryResult {
  myArchetype: string;
  myArchetypeLabel: string;
  myArchetypeBody?: string;
  myArchetypeEn?: string;
  myArchetypeOrder?: string;
  myArchetypeShort?: string;
  archStats?: { bestPartnerLabel: string; bestSurvival: string; worstPartnerLabel: string; worstSurvival: string };
  shareUrl: string;
  pairs: PairSummaryEntry[];
  pairsDone: number;
}

export async function getMySummary(userId: string, campaignId: string): Promise<MySummaryResult> {
  const { data: campaign, error: campErr } = await db()
    .from('campaigns')
    .select('id, current_version')
    .eq('id', campaignId)
    .single();
  if (campErr || !campaign) throw new NotFoundError(`Campaign not found: ${campaignId}`);

  const cfg = await getConfig(campaignId, campaign.current_version);

  const { data: ansRows } = await db()
    .from('user_quiz_answers')
    .select('question_id, option_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId);

  if (!ansRows || ansRows.length === 0) throw new NotFoundError('User has not answered yet');

  const myAnswers: Answer[] = ansRows.map((r) => ({ questionId: r.question_id, optionId: r.option_id }));
  const scores = scoreAnswers(cfg, myAnswers);
  const myAxisId = dominantAxis(cfg, scores);
  const myAxisDef = cfg.axes.find((a) => a.id === myAxisId);

  const liffBase = (process.env.LIFF_URL || `https://liff.line.me/2011037337-KlqFK4LM`).trim();

  // Compute archStats from config results
  const myResultsRanked = cfg.results
    .filter(r => r.pair && (r.pair[0] === myAxisId || r.pair[1] === myAxisId) && r.rank !== undefined)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const bestResult = myResultsRanked[0];
  const worstResult = myResultsRanked[myResultsRanked.length - 1];
  const archStats = bestResult && worstResult ? {
    bestPartnerLabel: cfg.axes.find(a => a.id === (bestResult.pair![0] === myAxisId ? bestResult.pair![1] : bestResult.pair![0]))?.label || '',
    bestSurvival: bestResult.title,
    worstPartnerLabel: cfg.axes.find(a => a.id === (worstResult.pair![0] === myAxisId ? worstResult.pair![1] : worstResult.pair![0]))?.label || '',
    worstSurvival: worstResult.title,
  } : undefined;

  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const fmtDate = (iso: string | null): string | undefined => {
    if (!iso) return undefined;
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  // Pairs as inviter (A)
  const { data: pairsAsA } = await db()
    .from('pairs')
    .select('id, status, b_user, result_code, scores, completed_at')
    .eq('a_user', userId)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  // Pairs as invitee (B)
  const { data: pairsAsB } = await db()
    .from('pairs')
    .select('id, status, a_user, result_code, scores, completed_at')
    .eq('b_user', userId)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  // Batch fetch partner display names
  const partnerIds = [
    ...(pairsAsA || []).map((p) => p.b_user),
    ...(pairsAsB || []).map((p) => p.a_user),
  ].filter(Boolean);

  const userMap = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: users } = await db()
      .from('users')
      .select('line_user_id, display_name')
      .in('line_user_id', [...new Set(partnerIds)]);
    for (const u of users || []) userMap.set(u.line_user_id, u.display_name);
  }

  const resultTitleOf = (code: string | null): string | undefined => {
    if (!code) return undefined;
    return cfg.results.find((r) => r.code === code)?.title;
  };

  const toStatus = (s: string): PairSummaryEntry['status'] =>
    s === 'completed' || s === 'expired' ? s : 'waiting';

  const getPartnerAxisLabel = (p: any, role: 'a' | 'b'): string | undefined => {
    if (p.status !== 'completed' || !p.scores) return undefined;
    const partnerScores = p.scores[role === 'a' ? 'b' : 'a'];
    if (!partnerScores) return undefined;
    const partnerAxisId = dominantAxis(cfg, partnerScores);
    return cfg.axes.find((a) => a.id === partnerAxisId)?.label;
  };

  const pairs: PairSummaryEntry[] = [
    ...(pairsAsA || []).map((p) => ({
      pairId: p.id,
      role: 'inviter' as const,
      partnerName: userMap.get(p.b_user) || 'คู่หู',
      status: toStatus(p.status),
      resultTitle: resultTitleOf(p.result_code),
      partnerAxisLabel: getPartnerAxisLabel(p, 'a'),
      completedAt: fmtDate(p.completed_at),
      completedAtIso: p.completed_at || undefined,
    })),
    ...(pairsAsB || []).map((p) => ({
      pairId: p.id,
      role: 'invitee' as const,
      partnerName: userMap.get(p.a_user) || 'คู่หู',
      status: toStatus(p.status),
      resultTitle: resultTitleOf(p.result_code),
      partnerAxisLabel: getPartnerAxisLabel(p, 'b'),
      completedAt: fmtDate(p.completed_at),
      completedAtIso: p.completed_at || undefined,
    })),
  ];

  // Completed first, then waiting
  pairs.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return -1;
    if (a.status !== 'completed' && b.status === 'completed') return 1;
    return 0;
  });

  return {
    myArchetype: myAxisId,
    myArchetypeLabel: myAxisDef?.label || myAxisId,
    myArchetypeBody: myAxisDef?.body,
    myArchetypeEn: (myAxisDef as any)?.label_en,
    myArchetypeOrder: (myAxisDef as any)?.order,
    myArchetypeShort: (myAxisDef as any)?.short,
    archStats,
    shareUrl: `${liffBase}?inviterId=${userId}&campaignId=${campaignId}`,
    pairs,
    pairsDone: pairs.filter(p => p.status === 'completed').length,
  };
}

// ── Set display name ────────────────────────────────────────────────

export async function setDisplayName(userId: string, displayName: string): Promise<void> {
  await db()
    .from('users')
    .upsert({ line_user_id: userId, display_name: displayName }, { onConflict: 'line_user_id' });
}

// ── My unlocked group archetype symbols ─────────────────────────────

export async function getMySymbols(userId: string, campaignId: string): Promise<string[]> {
  const { data: memberships } = await db()
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (!memberships?.length) return [];

  const groupIds = memberships.map((m) => m.group_id as string);

  const { data: groups } = await db()
    .from('groups')
    .select('locked_archetype_code')
    .in('id', groupIds)
    .eq('campaign_id', campaignId)
    .not('locked_archetype_code', 'is', null);

  const codes = (groups ?? [])
    .map((g) => g.locked_archetype_code as string)
    .filter(Boolean);

  return [...new Set(codes)];
}
