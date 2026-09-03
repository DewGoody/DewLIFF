import { Router } from 'express';
import express from 'express';
import { webhookSignature } from '../middleware/webhookSignature.js';
import { db } from '../db/client.js';
import { logEvent } from '../services/events.js';
import { handleTextMessage } from '../services/autoReply.js';
import { handleTriggerMessage } from '../services/triggerReply.js';

export const webhookRouter = Router();

// Parse JSON but save raw body for signature verification
webhookRouter.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody: Buffer }).rawBody = buf;
    },
  }),
);

type LineEvent = {
  type: string;
  webhookEventId: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  [key: string]: unknown;
};

async function processEvent(event: LineEvent): Promise<void> {
  // Dedup
  const { data: inserted, error: dedupError } = await db()
    .from('webhook_seen')
    .upsert(
      { webhook_event_id: event.webhookEventId },
      { onConflict: 'webhook_event_id', ignoreDuplicates: true },
    )
    .select('webhook_event_id');

  if (dedupError) {
    console.error('[webhook] dedup error:', dedupError.message);
    return;
  }
  if (!inserted || inserted.length === 0) return; // already processed

  const userId = event.source?.userId;
  if (!userId) return;

  switch (event.type) {
    case 'follow':
      await db()
        .from('users')
        .upsert(
          {
            line_user_id: userId,
            is_friend: true,
            followed_at: new Date().toISOString(),
          },
          { onConflict: 'line_user_id' },
        );
      logEvent({ userId, type: 'follow' });
      break;

    case 'unfollow':
      await db()
        .from('users')
        .update({
          is_friend: false,
          unfollowed_at: new Date().toISOString(),
        })
        .eq('line_user_id', userId);
      logEvent({ userId, type: 'unfollow' });
      break;

    case 'message': {
      if (event.message?.type === 'text' && event.message.text && event.replyToken) {
        console.log('[webhook] text message:', event.message.text);
        const handled = await handleTriggerMessage(event.replyToken, userId, event.message.text);
        if (!handled) {
          await handleTextMessage(event.replyToken, event.message.text);
        }
      }
      break;
    }
  }
}

webhookRouter.post('/line', webhookSignature, async (req, res) => {
  const events: LineEvent[] = req.body?.events ?? [];

  // Process all events before responding — Vercel terminates after res.json()
  await Promise.all(events.map(e => processEvent(e).catch(err => console.error('[webhook] event error:', err))));

  res.json({ ok: true });
});
