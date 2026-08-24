import type PgBoss from 'pg-boss';
import { db } from '../../db/client.js';

export async function handleExpirePairs(_job: PgBoss.Job): Promise<void> {
  const { data, error } = await db()
    .from('pairs')
    .update({ status: 'expired' })
    .eq('status', 'waiting')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Expire pairs failed:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log(`Expired ${data.length} pair(s)`);
  }
}
