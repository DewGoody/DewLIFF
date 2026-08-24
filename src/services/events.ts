import { db } from '../db/client.js';

export type EventType =
  | 'open'
  | 'quiz_start'
  | 'quiz_done'
  | 'share_click'
  | 'invite_open'
  | 'pair_done'
  | 'follow'
  | 'unfollow'
  | 'push_sent';

export async function logEvent(event: {
  userId?: string;
  type: EventType;
  pairId?: string;
  campaignId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await db().from('events').insert({
      user_id: event.userId ?? null,
      type: event.type,
      pair_id: event.pairId ?? null,
      campaign_id: event.campaignId ?? null,
      meta: event.meta ?? {},
    });
    if (error) console.error('Event logging failed:', error.message);
  } catch (err) {
    console.error('Event logging error:', err);
  }
}
