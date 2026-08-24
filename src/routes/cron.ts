import { Router } from 'express';
import { db } from '../db/client.js';

export const cronRouter = Router();

// Called by Vercel cron every hour
cronRouter.get('/expire-pairs', async (req, res) => {
  // Simple auth: check for cron secret
  const secret = req.headers['authorization'];
  if (secret !== `Bearer ${process.env.CRON_SECRET || 'cron-local'}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

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
