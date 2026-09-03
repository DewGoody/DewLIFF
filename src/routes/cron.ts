import { Router } from 'express';
import { db } from '../db/client.js';
import { getConfig } from '../config/loader.js';
import { scoreAnswers, dominantAxis } from '../engine/buddyQuiz.js';
import { pushMessage } from '../services/line.js';
import { env } from '../env.js';
import type { Answer } from '../config/schema.js';
import { computeDailyRollup } from '../services/analytics.js';

export const cronRouter = Router();

// ── Auth guard (shared) ───────────────────────────────────────────────

function checkCronAuth(req: import('express').Request, res: import('express').Response): boolean {
  const secret = req.headers['authorization'];
  if (secret !== `Bearer ${process.env.CRON_SECRET || 'cron-local'}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── F-06: remind users with waiting pairs older than 48 h ─────────────

async function sendF06Reminder(
  userId: string,
  campaignId: string,
  waitingCount: number,
): Promise<void> {
  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  if (!campaign) return;

  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const copy = (cfg as any).copy ?? {};
  const primary = (cfg.appearance as any)?.colors?.primary || cfg.brand.primary || '#E8354F';
  const liffBase = env().LIFF_URL ?? '';
  const liffUrl = `${liffBase}?campaignId=${campaignId}`;

  // Resolve user's own axis card from their saved answers
  const { data: ansRows } = await db()
    .from('user_quiz_answers')
    .select('question_id, option_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId);

  let axisId = 'prep';
  let axisLabel = '';
  let axisCardUrl: string | undefined;

  if (ansRows && ansRows.length > 0) {
    const answers: Answer[] = ansRows.map(r => ({ questionId: r.question_id, optionId: r.option_id }));
    const scores = scoreAnswers(cfg, answers);
    axisId = dominantAxis(cfg, scores);
    const axisDef = cfg.axes.find(a => a.id === axisId);
    axisLabel = axisDef?.label || axisId;
    axisCardUrl = (axisDef as any)?.image_url;
  }

  // Fallback axis card URLs (same set as match.ts)
  const AXIS_CARD_FALLBACK: Record<string, string> = {
    chill: 'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-01-chiller-v2.png',
    mu:    'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-02-mystic-v2.png',
    live:  'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-03-influencer-v2.png',
    prep:  'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-04-prepper-v2.png',
    line:  'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/axis-05-analyst-v2.png',
  };
  const cardUrl = axisCardUrl || AXIS_CARD_FALLBACK[axisId] || AXIS_CARD_FALLBACK['prep'];

  const headline = copy.F06_headline || 'ยังมีเพื่อนรอดูผลคู่กับคุณ';
  const sub = waitingCount > 1
    ? (copy.F06_sub_plural || `${waitingCount} คู่รอ · กลับมาชวนเพื่อนสร้างทีม`)
    : (copy.F06_sub || 'กลับมาชวนเพื่อนสร้างทีมผู้รอดเลย!');
  const ctaLabel = copy.F06_cta || 'ไปจัดทีมเลย';

  // F-06: kilo bubble, horizontal layout (axis card LEFT, text RIGHT)
  const message = {
    type: 'flex',
    altText: headline,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box', layout: 'horizontal', paddingAll: '14px', spacing: 'md', alignItems: 'center',
        contents: [
          // Left: user's own axis card
          {
            type: 'box', layout: 'vertical', flex: 0, width: '68px',
            contents: [
              { type: 'image', url: cardUrl, size: 'full', aspectRatio: '3:4', aspectMode: 'fit' },
            ],
          },
          // Right: reminder text
          {
            type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
            contents: [
              { type: 'text', text: headline, weight: 'bold', size: 'sm', color: '#1C1A17', wrap: true },
              { type: 'text', text: axisLabel, size: 'xxs', color: '#888888', margin: 'xs' },
              { type: 'separator', margin: 'sm', color: 'rgba(28,26,23,.1)' },
              { type: 'text', text: sub, size: 'xs', color: '#555555', wrap: true, margin: 'sm' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [
          { type: 'button', action: { type: 'uri', label: ctaLabel, uri: liffUrl }, style: 'primary', color: primary, height: 'sm' },
        ],
      },
    },
  };

  await pushMessage(userId, [message] as any);
}

// ── Route: remind users with waiting pairs (48 h window) ──────────────

/**
 * Finds pairs that crossed the 48-hour mark in the last hour
 * (created_at between 49h and 48h ago, status still waiting).
 * Each pair lands in this window exactly once → no duplicate pushes without DB changes.
 * Run hourly via Vercel cron.
 */
cronRouter.get('/remind-waiting', async (req, res) => {
  if (!checkCronAuth(req, res)) return;

  const now = Date.now();
  const windowStart = new Date(now - 49 * 3600 * 1000).toISOString(); // 49 h ago
  const windowEnd   = new Date(now - 48 * 3600 * 1000).toISOString(); // 48 h ago

  const { data: waitingPairs, error } = await db()
    .from('pairs')
    .select('a_user, campaign_id')
    .eq('status', 'waiting')
    .gt('expires_at', new Date(now).toISOString())
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd);

  if (error) {
    console.error('remind-waiting query failed:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  // Aggregate: count waiting pairs per (userId, campaignId)
  const buckets = new Map<string, { userId: string; campaignId: string; count: number }>();
  for (const p of waitingPairs ?? []) {
    const key = `${p.a_user}:${p.campaign_id}`;
    if (!buckets.has(key)) buckets.set(key, { userId: p.a_user, campaignId: p.campaign_id, count: 0 });
    buckets.get(key)!.count++;
  }

  let pushed = 0;
  let failed = 0;
  for (const { userId, campaignId, count } of buckets.values()) {
    try {
      await sendF06Reminder(userId, campaignId, count);
      pushed++;
    } catch (e) {
      console.error(`F-06 push failed for ${userId}:`, e);
      failed++;
    }
  }

  console.log(`F-06 reminders: ${pushed} sent, ${failed} failed`);
  res.json({ ok: true, pushed, failed });
});

// ── F-10: remind group creator when group is incomplete after 48 h ────

async function sendGroupIncompleteReminder(
  creatorId: string,
  groupId: string,
  campaignId: string,
  memberCount: number,
  maxMembers: number,
): Promise<void> {
  const { data: campaign } = await db()
    .from('campaigns')
    .select('current_version')
    .eq('id', campaignId)
    .single();
  if (!campaign) return;

  const cfg = await getConfig(campaignId, (campaign as Record<string, unknown>).current_version as number);
  const copy = (cfg as Record<string, unknown>).copy as Record<string, string> ?? {};
  const primary = (cfg.appearance as any)?.colors?.primary || cfg.brand.primary || '#E8354F';
  const liffBase = env().LIFF_URL ?? '';
  const groupUrl = `${liffBase}?campaignId=${campaignId}&groupId=${groupId}`;

  const remaining = maxMembers - memberCount;
  const headline = copy.F10_remind_headline || `ทีมของคุณยังขาดอีก ${remaining} คน`;
  const sub = copy.F10_remind_sub || 'ชวนเพื่อนเพิ่มเพื่อปลดล็อกผลทีมวันสิ้นโลก!';
  const progressPct = Math.round((memberCount / maxMembers) * 100);

  const message = {
    type: 'flex',
    altText: headline,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
        contents: [
          { type: 'text', text: copy.F10_remind_badge || 'ทีมรอเพื่อน', size: 'xs', color: '#888888', weight: 'bold' },
          { type: 'text', text: headline, weight: 'bold', size: 'lg', color: '#1C1A17', wrap: true, margin: 'sm' },
          {
            type: 'box', layout: 'vertical', margin: 'md', height: '6px',
            backgroundColor: '#E8E4DC', cornerRadius: '3px',
            contents: [{
              type: 'box', layout: 'vertical', width: `${progressPct}%`,
              backgroundColor: primary, cornerRadius: '3px',
              contents: [{ type: 'filler' }],
            }],
          },
          { type: 'text', text: `${memberCount}/${maxMembers} คน`, size: 'xs', color: '#888888', margin: 'sm', align: 'right' },
          { type: 'text', text: sub, size: 'sm', color: '#555555', wrap: true, margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [
          { type: 'button', action: { type: 'uri', label: copy.F10_remind_cta || 'ชวนเพื่อนเพิ่ม', uri: groupUrl }, style: 'primary', color: primary, height: 'sm' },
        ],
      },
    },
  };

  await pushMessage(creatorId, [message] as any);
}

/**
 * Finds groups that crossed the 48-hour mark in the last hour and are still not full.
 * Window-based → each group is processed exactly once → no duplicate pushes.
 * Run hourly via Vercel cron.
 */
cronRouter.get('/remind-incomplete-groups', async (req, res) => {
  if (!checkCronAuth(req, res)) return;

  const now = Date.now();
  const windowStart = new Date(now - 49 * 3600 * 1000).toISOString();
  const windowEnd   = new Date(now - 48 * 3600 * 1000).toISOString();

  const { data: groupRows, error } = await db()
    .from('groups')
    .select('id, campaign_id, created_by, max_members')
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd);

  if (error) {
    console.error('remind-incomplete-groups query failed:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  let pushed = 0;
  let skipped = 0;
  let failed = 0;

  for (const group of (groupRows ?? []) as Array<Record<string, unknown>>) {
    try {
      const { count } = await db()
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

      const memberCount = count ?? 0;
      const maxMembers = group.max_members as number;

      if (memberCount >= maxMembers) { skipped++; continue; }

      await sendGroupIncompleteReminder(
        group.created_by as string,
        group.id as string,
        group.campaign_id as string,
        memberCount,
        maxMembers,
      );
      pushed++;
    } catch (e) {
      console.error(`F-10 reminder failed for group ${group.id}:`, e);
      failed++;
    }
  }

  console.log(`F-10 incomplete-group reminders: ${pushed} sent, ${skipped} skipped (full), ${failed} failed`);
  res.json({ ok: true, pushed, skipped, failed });
});

// Called by Vercel cron every hour
cronRouter.get('/expire-pairs', async (req, res) => {
  if (!checkCronAuth(req, res)) return;

  const { data, error } = await db()
    .from('pairs')
    .update({ status: 'expired' })
    .eq('status', 'waiting')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  const count = data?.length || 0;
  if (error) {
    console.error('Expire pairs failed:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  console.log(`Expired ${count} pair(s)`);
  res.json({ ok: true, expired: count });
});

// ── Daily analytics rollup ────────────────────────────────────────────
// Aggregates yesterday's events into daily_rollups for fast dashboard queries.
// Run at 00:30 UTC daily via Vercel cron.

cronRouter.get('/rollup-daily', async (req, res) => {
  if (!checkCronAuth(req, res)) return;

  // Compute yesterday in UTC
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const date = yesterday.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  try {
    const processed = await computeDailyRollup(date);
    console.log(`Daily rollup for ${date}: ${processed} campaign(s) processed`);
    res.json({ ok: true, date, processed });
  } catch (err) {
    console.error('Daily rollup failed:', err);
    res.status(500).json({ error: String(err) });
  }
});
