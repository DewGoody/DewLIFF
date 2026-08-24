import { Router } from 'express';
import express from 'express';
import { webhookSignature } from '../middleware/webhookSignature.js';
import { db } from '../db/client.js';
import { logEvent } from '../services/events.js';
import { handleTextMessage, getWelcomeMessage } from '../services/autoReply.js';
import { handleTriggerMessage } from '../services/triggerReply.js';
import { replyMessage } from '../services/line.js';

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

webhookRouter.post('/line', webhookSignature, async (req, res) => {
  // Always respond 200 immediately — LINE requires this
  res.json({ ok: true });

  const events: LineEvent[] = req.body?.events ?? [];

  for (const event of events) {
    // Dedup
    const { data: inserted } = await db()
      .from('webhook_seen')
      .upsert(
        { webhook_event_id: event.webhookEventId },
        { onConflict: 'webhook_event_id', ignoreDuplicates: true },
      )
      .select('webhook_event_id');

    if (!inserted || inserted.length === 0) continue; // already processed

    const userId = event.source?.userId;
    if (!userId) continue;

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
        // Welcome message from DB — FREE via replyToken
        if (event.replyToken) {
          const welcomeText = await getWelcomeMessage();
          await replyMessage(event.replyToken, [{ type: 'text', text: welcomeText }]);
        }
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
          // Check trigger messages first (from liff.sendMessages)
          const handled = await handleTriggerMessage(event.replyToken, userId, event.message.text);
          if (!handled) {
            // Then check keyword auto-reply
            await handleTextMessage(event.replyToken, event.message.text);
          }
        }
        break;
      }
    }
  }
});
