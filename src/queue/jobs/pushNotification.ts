import type PgBoss from 'pg-boss';
import { sendPartnerDonePush } from '../../services/push.js';
import { logEvent } from '../../services/events.js';

type PushJobData = {
  userId: string;
  campaignId: string;
  pairId: string;
  resultCode: string;
};

export async function handlePush(job: PgBoss.Job<PushJobData>): Promise<void> {
  const { userId, campaignId, pairId } = job.data;
  await sendPartnerDonePush(userId, campaignId, pairId);
  logEvent({ userId, type: 'push_sent', pairId, campaignId });
}
