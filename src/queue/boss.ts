import PgBoss from 'pg-boss';
import { handlePush } from './jobs/pushNotification.js';
import { handleExpirePairs } from './jobs/expirePairs.js';

let _boss: PgBoss | null = null;

export async function createBoss(connectionString: string): Promise<PgBoss> {
  _boss = new PgBoss(connectionString);
  await _boss.start();
  return _boss;
}

export function getBoss(): PgBoss {
  if (!_boss) throw new Error('pg-boss not initialized');
  return _boss;
}

export async function registerHandlers(boss: PgBoss): Promise<void> {
  await boss.work('push-notification', { batchSize: 1 }, async ([job]) =>
    handlePush(job as PgBoss.Job<Parameters<typeof handlePush>[0]['data']>),
  );
  await boss.createQueue('expire-pairs');
  await boss.schedule('expire-pairs', '0 * * * *');
  await boss.work('expire-pairs', { batchSize: 1 }, async ([job]) =>
    handleExpirePairs(job as PgBoss.Job),
  );
}
