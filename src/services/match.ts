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

  // Compute A's own archetype so LIFF can show it on the share screen
  const scores = scoreAnswers(cfg, answers);
  const myAxis = dominantAxis(cfg, scores);
  const myAxisDef = cfg.axes.find((a) => a.id === myAxis);

  const liffBase = process.env.LIFF_URL || `https://liff.line.me/2011037337-KlqFK4LM`;
  const inviterUrl = `${liffBase}?inviterId=${userId}&campaignId=${campaignId}`;

  return {
    ok: true,
    inviterUrl,
    myArchetype: myAxis,
    myArchetypeLabel: myAxisDef?.label || myAxis,
  };
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

  // Check for existing pair between A+B to avoid duplicates
  const { data: existingPair } = await db()
    .from('pairs')
    .select('id, status, result_code, scores')
    .eq('campaign_id', campaignId)
    .eq('a_user', inviterId)
    .eq('b_user', bUserId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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

  const liffBase = process.env.LIFF_URL || `https://liff.line.me/2011037337-KlqFK4LM`;

  // Push to B: result card
  const bAxisMe = outcome.axisB;
  const bAxisBuddy = outcome.axisA;
  const aProfile = await getInviterProfile(inviterId).catch(() => ({ displayName: 'เพื่อน' }));
  const bName = bProfile?.displayName || 'คู่หู';

  const resultCard = buildMatchResultCard(cfg, campaignId, outcome.result, {
    pairId: pair.id,
    axisMe: bAxisMe,
    axisBuddy: bAxisBuddy,
    buddyName: aProfile.displayName,
    liffBase,
  });
  // Push to A: partner answered notification with result
  const pushToA = buildPartnerAnsweredCard(cfg, campaignId, outcome.result, {
    pairId: pair.id,
    partnerName: bName,
    axisMe: outcome.axisA,
    axisBuddy: outcome.axisB,
    liffBase,
  });

  // Also tell LineKit both players' results — server-to-server, doesn't touch
  // KimLIFF's own DB write or trust model, and must never break the pushes below.
  const lineKitPayloadBase = {
    source: 'buddy_quiz_match',
    campaignId,
    pairId: pair.id,
    resultCode: outcome.result.code,
    resultTitle: outcome.result.title,
    scores: { a: outcome.scoresA, b: outcome.scoresB, combined: outcome.combined },
  };
  writeResultToLineKit(bUserId, {
    ...lineKitPayloadBase,
    axisMe: bAxisMe,
    axisBuddy: bAxisBuddy,
  }, pair.id).catch((e) => console.error('LineKit write-back failed (B):', e));
  writeResultToLineKit(inviterId, {
    ...lineKitPayloadBase,
    axisMe: outcome.axisA,
    axisBuddy: outcome.axisB,
  }, pair.id).catch((e) => console.error('LineKit write-back failed (A):', e));

  // Await both pushes before returning so Vercel doesn't kill the function early
  const [pushBResult, pushAResult] = await Promise.allSettled([
    pushMessage(bUserId, resultCard),
    pushMessage(inviterId, pushToA),
  ]);

  if (pushBResult.status === 'rejected') console.error('Push to B failed:', pushBResult.reason);
  const pushSentToInviter = pushAResult.status === 'fulfilled';
  if (pushSentToInviter) {
    logEvent({ userId: inviterId, type: 'push_sent', pairId: pair.id, campaignId });
  } else {
    console.error('Push to A failed:', pushAResult.reason);
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

function liffPairUrl(liffBase: string, campaignId: string, pairId: string): string {
  return `${liffBase}?campaignId=${campaignId}&pairId=${pairId}`;
}

function buildMatchResultCard(
  cfg: Parameters<typeof toPublicConfig>[0],
  campaignId: string,
  result: { title: string; body: string; image_url?: string; code: string },
  opts: { pairId: string; axisMe: string; axisBuddy: string; buddyName: string; liffBase: string },
) {
  const primary = cfg.brand.primary || '#E63B2E';
  const eyebrow = cfg.copy?.['result_eyebrow'] || 'คุณสองคนคือ';
  const axMeLabel = cfg.axes.find((a) => a.id === opts.axisMe)?.label || opts.axisMe;
  const axBuddyLabel = cfg.axes.find((a) => a.id === opts.axisBuddy)?.label || opts.axisBuddy;

  const bodyContents: Record<string, unknown>[] = [];
  if (result.image_url) {
    bodyContents.push({ type: 'image', url: result.image_url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' });
  }
  bodyContents.push({ type: 'text', text: eyebrow, size: 'xs', color: '#888888', ...(result.image_url ? { margin: 'md' } : {}) });
  bodyContents.push({ type: 'text', text: result.title, weight: 'bold', size: 'xl', color: primary, margin: 'sm' });
  if (result.body) {
    bodyContents.push({ type: 'text', text: result.body, wrap: true, margin: 'md', size: 'sm', color: '#666666' });
  }
  bodyContents.push({
    type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'sm',
    contents: [
      { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: `คุณ · ${axMeLabel}`, size: 'xs', color: primary, align: 'center' }], paddingAll: '6px', borderWidth: '1px', borderColor: primary, cornerRadius: '99px' },
      { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: `${opts.buddyName} · ${axBuddyLabel}`, size: 'xs', color: primary, align: 'center' }], paddingAll: '6px', borderWidth: '1px', borderColor: primary, cornerRadius: '99px' },
    ],
  });

  return [
    {
      type: 'flex',
      altText: `${eyebrow} ${result.title}`,
      contents: {
        type: 'bubble',
        body: { type: 'box', layout: 'vertical', contents: bodyContents },
        footer: {
          type: 'box', layout: 'vertical', spacing: 'sm',
          contents: [
            { type: 'button', action: { type: 'uri', label: 'ดูผลลัพธ์', uri: liffPairUrl(opts.liffBase, campaignId, opts.pairId) }, style: 'primary', color: primary },
          ],
        },
      },
    },
  ];
}

function buildPartnerAnsweredCard(
  cfg: Parameters<typeof toPublicConfig>[0],
  campaignId: string,
  result: { title: string; body: string; code: string },
  opts: { pairId: string; partnerName: string; axisMe: string; axisBuddy: string; liffBase: string },
) {
  const primary = cfg.brand.primary || '#E63B2E';
  const axMeLabel = cfg.axes.find((a) => a.id === opts.axisMe)?.label || opts.axisMe;
  const axBuddyLabel = cfg.axes.find((a) => a.id === opts.axisBuddy)?.label || opts.axisBuddy;
  const title = `${opts.partnerName} ตอบแล้ว! ดูผลกัน`;
  const altText = `${opts.partnerName} ตอบแล้ว ผลลัพท์ของคุณกับ ${opts.partnerName} คือ "${result.title}"`;

  return [
    {
      type: 'flex',
      altText,
      contents: {
        type: 'bubble',
        body: {
          type: 'box', layout: 'vertical',
          contents: [
            { type: 'text', text: title, weight: 'bold', size: 'lg', wrap: true },
            { type: 'text', text: `ผลลัพท์ของคุณกับ ${opts.partnerName}`, size: 'xs', color: '#888888', margin: 'md' },
            { type: 'text', text: result.title, weight: 'bold', size: 'xl', color: primary, margin: 'sm' },
            { type: 'text', text: result.body, wrap: true, margin: 'md', size: 'sm', color: '#666666' },
            {
              type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'sm',
              contents: [
                { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: `คุณ · ${axMeLabel}`, size: 'xs', color: primary, align: 'center' }], paddingAll: '6px', borderWidth: '1px', borderColor: primary, cornerRadius: '99px' },
                { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: `${opts.partnerName} · ${axBuddyLabel}`, size: 'xs', color: primary, align: 'center' }], paddingAll: '6px', borderWidth: '1px', borderColor: primary, cornerRadius: '99px' },
              ],
            },
          ],
        },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [
            { type: 'button', action: { type: 'uri', label: 'ดูผลลัพท์', uri: liffPairUrl(opts.liffBase, campaignId, opts.pairId) }, style: 'primary', color: primary },
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

  const liffBase = process.env.LIFF_URL || `https://liff.line.me/2011037337-KlqFK4LM`;

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

  // Pairs as inviter (A)
  const { data: pairsAsA } = await db()
    .from('pairs')
    .select('id, status, b_user, result_code, scores')
    .eq('a_user', userId)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  // Pairs as invitee (B)
  const { data: pairsAsB } = await db()
    .from('pairs')
    .select('id, status, a_user, result_code, scores')
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
    })),
    ...(pairsAsB || []).map((p) => ({
      pairId: p.id,
      role: 'invitee' as const,
      partnerName: userMap.get(p.a_user) || 'คู่หู',
      status: toStatus(p.status),
      resultTitle: resultTitleOf(p.result_code),
      partnerAxisLabel: getPartnerAxisLabel(p, 'b'),
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
