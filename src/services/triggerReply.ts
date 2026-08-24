import { db } from '../db/client.js';
import { replyMessage } from './line.js';
import { getConfig } from '../config/loader.js';
import { toPublicResult } from '../config/public.js';
import { logEvent } from './events.js';
import { env } from '../env.js';
import type { LineMessage } from './line.js';

/**
 * Trigger messages are sent by LIFF via liff.sendMessages().
 * They follow a pattern: "🎯command:payload"
 *
 * The webhook catches them and replies with rich content — FREE via replyToken.
 *
 * Patterns:
 *   🎯result:pairId:campaignId     → reply with result Flex card
 *   🎯share:campaignId             → reply with campaign intro card
 *   🎯random:campaignId:seed       → reply with randomized content
 */

/**
 * Detect trigger messages sent by LIFF via liff.sendMessages().
 *
 * Patterns user sees in chat (looks natural):
 *   "✨ ฉันเล่นควิซเสร็จแล้ว ดูผลลัพธ์ให้หน่อย!\n#ref:pairId"
 *   "🎲 สุ่มรางวัล!\n#ref:campaignId:seed"
 *   "📋 ดูกิจกรรม\n#ref:share:campaignId"
 */

export async function handleTriggerMessage(
  replyToken: string,
  userId: string,
  text: string,
): Promise<boolean> {
  // Look for #ref: pattern anywhere in the message
  const refMatch = text.match(/#ref:(.+)/);
  if (!refMatch) return false;

  const refParts = refMatch[1].trim().split(':');

  try {
    // Detect command type from the ref
    if (refParts[0] === 'share' && refParts[1]) {
      await handleShareTrigger(replyToken, refParts[1]);
      return true;
    }

    if (refParts[0] === 'random' && refParts[1]) {
      await handleRandomTrigger(replyToken, userId, refParts[1], refParts[2] || Date.now().toString());
      return true;
    }

    // Default: treat ref as pairId/sessionId → show result
    // Find which campaign this pair belongs to
    const pairId = refParts[0];
    const { data: pair } = await db()
      .from('pairs')
      .select('campaign_id')
      .eq('id', pairId)
      .single();

    if (pair) {
      await handleResultTrigger(replyToken, userId, pairId, pair.campaign_id);
      return true;
    }

    return false;
  } catch (e) {
    console.error('Trigger handler error:', e);
    return false;
  }
}

/**
 * 🎯result:pairId:campaignId
 * Reply with the result Flex card — same content as push but FREE
 */
async function handleResultTrigger(
  replyToken: string,
  userId: string,
  pairId: string,
  campaignId: string,
): Promise<void> {
  // Load pair
  const { data: pair } = await db()
    .from('pairs')
    .select('id, campaign_id, config_version, a_user, b_user, result_code, scores, status')
    .eq('id', pairId)
    .single();

  if (!pair || pair.status !== 'completed' || !pair.result_code) return;

  const cfg = await getConfig(pair.campaign_id, pair.config_version);
  const result = cfg.results.find(r => r.code === pair.result_code);
  if (!result) return;

  const isSolo = cfg.mode === 'solo';
  const isA = pair.a_user === userId;
  const scores = pair.scores as Record<string, Record<string, number>>;

  // Build axis info
  let axisMe: string | undefined;
  let axisBuddy: string | undefined;
  let typeCode: string | undefined;

  if (isSolo) {
    // Reconstruct type code from scores
    typeCode = '';
    for (const axis of cfg.axes) {
      const v = scores?.a?.[axis.id] ?? 0;
      const poles = axis.poles ?? [axis.id, axis.id];
      typeCode += (v >= 0 ? poles[0] : poles[1])[0].toUpperCase();
    }
  } else {
    // Find dominant axes
    const findDominant = (s: Record<string, number>) => {
      let best = cfg.axes[0]?.id;
      for (const a of cfg.axes) {
        if ((s[a.id] ?? 0) > (s[best] ?? 0)) best = a.id;
      }
      return best;
    };
    if (scores?.a) axisMe = findDominant(isA ? scores.a : (scores.b || scores.a));
    if (scores?.b) axisBuddy = findDominant(isA ? (scores.b || scores.a) : scores.a);
  }

  const liffBase = `${env().LIFF_URL}/quiz/${pair.campaign_id}`;
  const eyebrow = cfg.copy?.['result_eyebrow'] || (isSolo ? 'คุณคือ' : 'คุณสองคนคือ');

  // Build Flex card
  const bodyContents: Record<string, unknown>[] = [];

  if (result.image_url) {
    bodyContents.push({ type: 'image', url: result.image_url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' });
  }

  bodyContents.push({ type: 'text', text: eyebrow, size: 'xs', color: '#888888', ...(result.image_url ? { margin: 'md' } : {}) });
  bodyContents.push({ type: 'text', text: result.title, weight: 'bold', size: 'xl', color: cfg.brand.primary, margin: 'sm' });

  if (result.body) {
    bodyContents.push({ type: 'text', text: result.body, wrap: true, margin: 'md', size: 'sm', color: '#666666' });
  }

  // Axis tags
  const tags: string[] = [];
  if (typeCode) tags.push(typeCode);
  if (axisMe) {
    const ax = cfg.axes.find(a => a.id === axisMe);
    if (ax) tags.push('คุณ · ' + ax.label);
  }
  if (axisBuddy) {
    const ax = cfg.axes.find(a => a.id === axisBuddy);
    if (ax) tags.push('คู่หู · ' + ax.label);
  }

  if (tags.length > 0) {
    bodyContents.push({
      type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'sm',
      contents: tags.map(label => ({
        type: 'box', layout: 'vertical',
        contents: [{ type: 'text', text: label, size: 'xs', color: cfg.brand.primary, align: 'center' }],
        paddingAll: '6px', borderWidth: '1px', borderColor: cfg.brand.primary, cornerRadius: '99px',
      })),
    });
  }

  const message: LineMessage = {
    type: 'flex',
    altText: `${eyebrow} ${result.title}`,
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', contents: bodyContents },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: cfg.copy?.['result_share_cta'] || 'ชวนเพื่อนเล่น', uri: liffBase },
            style: 'primary', color: cfg.brand.primary,
          },
          {
            type: 'button',
            action: { type: 'uri', label: 'ดูผลอีกครั้ง', uri: `${liffBase}?pairId=${pairId}` },
            style: 'secondary',
          },
        ],
      },
    },
  };

  await replyMessage(replyToken, [message]);
  logEvent({ userId, type: 'share_click', pairId, campaignId: pair.campaign_id, meta: { via: 'trigger' } });
}

/**
 * 🎯share:campaignId
 * Reply with campaign intro card — for sharing the campaign
 */
async function handleShareTrigger(replyToken: string, campaignId: string): Promise<void> {
  const cfg = await getConfig(campaignId);
  const liffUrl = `${env().LIFF_URL}/quiz/${campaignId}`;

  const message: LineMessage = {
    type: 'flex',
    altText: cfg.brand.name || campaignId,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'text', text: cfg.brand.name, weight: 'bold', size: 'xl' },
          { type: 'text', text: cfg.copy?.['intro_body'] || '', wrap: true, margin: 'md', size: 'sm', color: '#888888' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: cfg.copy?.['intro_cta'] || 'เริ่มเลย', uri: liffUrl },
            style: 'primary', color: cfg.brand.primary,
          },
        ],
      },
    },
  };

  await replyMessage(replyToken, [message]);
}

/**
 * 🎯random:campaignId:seed
 * Reply with randomized content — for lucky draw, random picks, etc.
 * Uses seed to ensure deterministic result per session
 */
async function handleRandomTrigger(
  replyToken: string,
  userId: string,
  campaignId: string,
  seed: string,
): Promise<void> {
  const cfg = await getConfig(campaignId);

  // Use seed to pick a deterministic result
  let hash = 0;
  for (const ch of seed) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const idx = Math.abs(hash) % cfg.results.length;
  const result = cfg.results[idx];

  const liffUrl = `${env().LIFF_URL}/quiz/${campaignId}`;

  const message: LineMessage = {
    type: 'flex',
    altText: '🎲 ' + result.title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          ...(result.image_url
            ? [{ type: 'image', url: result.image_url, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } as Record<string, unknown>]
            : []),
          { type: 'text', text: '🎲 ผลสุ่มของคุณ', size: 'xs', color: '#888888', ...(result.image_url ? { margin: 'md' } : {}) },
          { type: 'text', text: result.title, weight: 'bold', size: 'xl', color: cfg.brand.primary, margin: 'sm' },
          ...(result.body ? [{ type: 'text', text: result.body, wrap: true, margin: 'md', size: 'sm', color: '#666666' }] : []),
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: 'เล่นอีกครั้ง', uri: liffUrl },
            style: 'primary', color: cfg.brand.primary,
          },
        ],
      },
    },
  };

  await replyMessage(replyToken, [message]);
  logEvent({ userId, type: 'quiz_done', campaignId, meta: { via: 'random', seed, result_code: result.code } });
}
