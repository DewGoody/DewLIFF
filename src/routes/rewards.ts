import { Router } from 'express';
import { db } from '../db/client.js';
import { getConfig } from '../config/loader.js';

export const rewardsAdminRouter = Router();
export const rewardsQuizRouter = Router();

// ─── ADMIN: Reward Pool CRUD ───────────────────────────────────────────────

// List all pools
rewardsAdminRouter.get('/pools', async (_req, res, next) => {
  try {
    const { data, error } = await db()
      .from('reward_pools')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Attach code/claim counts via separate queries (Supabase count via head)
    const pools = await Promise.all(
      (data || []).map(async (p: Record<string, unknown>) => {
        const { count: totalCodes } = await db()
          .from('reward_codes')
          .select('*', { count: 'exact', head: true })
          .eq('pool_id', p.id as string);
        const { count: availCodes } = await db()
          .from('reward_codes')
          .select('*', { count: 'exact', head: true })
          .eq('pool_id', p.id as string)
          .is('claimed_by', null);
        const { count: totalClaims } = await db()
          .from('reward_claims')
          .select('*', { count: 'exact', head: true })
          .eq('pool_id', p.id as string);
        return {
          ...p,
          total_codes: totalCodes ?? 0,
          available_codes: availCodes ?? 0,
          total_claims: totalClaims ?? 0,
        };
      })
    );

    res.json({ pools });
  } catch (err) {
    next(err);
  }
});

// Create pool
rewardsAdminRouter.post('/pools', async (req, res, next) => {
  try {
    const { name, type, description, expires_at, meta } = req.body as {
      name?: string;
      type?: string;
      description?: string;
      expires_at?: string;
      meta?: Record<string, unknown>;
    };
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });
    const { data, error } = await db()
      .from('reward_pools')
      .insert({ name, type, description, expires_at: expires_at || null, meta: meta || {} })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ pool: data });
  } catch (err) {
    next(err);
  }
});

// Get single pool with stats
rewardsAdminRouter.get('/pools/:id', async (req, res, next) => {
  try {
    const { data, error } = await db()
      .from('reward_pools')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'not found' });

    const { count: totalCodes } = await db()
      .from('reward_codes')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', req.params.id);
    const { count: availCodes } = await db()
      .from('reward_codes')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', req.params.id)
      .is('claimed_by', null);
    const { count: claims } = await db()
      .from('reward_claims')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', req.params.id);

    res.json({
      pool: data,
      stats: {
        total_codes: totalCodes ?? 0,
        available_codes: availCodes ?? 0,
        total_claims: claims ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update pool
rewardsAdminRouter.put('/pools/:id', async (req, res, next) => {
  try {
    const { name, description, expires_at, meta, status } = req.body as {
      name?: string;
      description?: string;
      expires_at?: string;
      meta?: Record<string, unknown>;
      status?: string;
    };
    const { data, error } = await db()
      .from('reward_pools')
      .update({ name, description, expires_at: expires_at || null, meta, status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ pool: data });
  } catch (err) {
    next(err);
  }
});

// Delete pool
rewardsAdminRouter.delete('/pools/:id', async (req, res, next) => {
  try {
    const { error } = await db().from('reward_pools').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Import codes into pool (bulk)
rewardsAdminRouter.post('/pools/:id/codes', async (req, res, next) => {
  try {
    const { codes } = req.body as { codes?: string[] };
    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: 'codes array required' });
    }
    const rows = codes
      .map((c: string) => ({ pool_id: req.params.id, code: c.trim() }))
      .filter((r) => r.code.length > 0);
    const { error } = await db()
      .from('reward_codes')
      .upsert(rows, { onConflict: 'pool_id,code', ignoreDuplicates: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, imported: rows.length });
  } catch (err) {
    next(err);
  }
});

// List codes in pool (paginated)
rewardsAdminRouter.get('/pools/:id/codes', async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = 50;
    const { data, count, error } = await db()
      .from('reward_codes')
      .select('*', { count: 'exact' })
      .eq('pool_id', req.params.id)
      .order('created_at')
      .range((page - 1) * limit, page * limit - 1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ codes: data || [], total: count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

// Delete a code (only unclaimed)
rewardsAdminRouter.delete('/pools/:id/codes/:codeId', async (req, res, next) => {
  try {
    const { error } = await db()
      .from('reward_codes')
      .delete()
      .eq('id', req.params.codeId)
      .eq('pool_id', req.params.id)
      .is('claimed_by', null);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── LIFF: User Rewards ────────────────────────────────────────────────────

// Get my claimed rewards for a campaign
rewardsQuizRouter.get('/my/:campaignId', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await db()
      .from('reward_claims')
      .select('*, reward_pools(name, type, meta), reward_codes(code)')
      .eq('user_id', userId)
      .eq('campaign_id', req.params.campaignId)
      .order('issued_at');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ claims: data || [] });
  } catch (err) {
    next(err);
  }
});

// Claim a milestone reward
rewardsQuizRouter.post('/claim', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { campaign_id, milestone_key } = req.body as {
      campaign_id?: string;
      milestone_key?: string;
    };
    if (!campaign_id || !milestone_key) {
      return res.status(400).json({ error: 'campaign_id and milestone_key required' });
    }

    // Load campaign config
    const cfg = await getConfig(campaign_id).catch(() => null);
    if (!cfg) return res.status(404).json({ error: 'campaign not found' });

    const rewardCfg = cfg.rewards;
    if (!rewardCfg?.enabled) return res.status(400).json({ error: 'rewards not enabled' });

    const milestone = rewardCfg.milestones?.find((m) => m.key === milestone_key);
    if (!milestone) return res.status(404).json({ error: 'milestone not found' });

    // Check user has enough completed pairs
    const { count: pairsDone } = await db()
      .from('pairs')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)
      .eq('status', 'completed')
      .or(`a_user.eq.${userId},b_user.eq.${userId}`);

    if ((pairsDone ?? 0) < milestone.trigger_pairs) {
      return res.status(400).json({
        error: 'not enough pairs',
        need: milestone.trigger_pairs,
        have: pairsDone,
      });
    }

    // Check not already claimed
    const { data: existing } = await db()
      .from('reward_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('campaign_id', campaign_id)
      .eq('milestone_key', milestone_key)
      .single();
    if (existing) return res.status(409).json({ error: 'already claimed' });

    // Load pool
    const { data: pool } = await db()
      .from('reward_pools')
      .select('*')
      .eq('id', milestone.reward_pool_id)
      .single();
    if (!pool || (pool as Record<string, unknown>).status !== 'active') {
      return res.status(400).json({ error: 'reward pool unavailable' });
    }

    const poolRecord = pool as Record<string, unknown>;
    let codeId: string | null = null;
    let codeValue: string | null = null;

    if (poolRecord.type === 'code_pool' || poolRecord.type === 'raffle') {
      const { data: code } = await db()
        .from('reward_codes')
        .select('id, code')
        .eq('pool_id', poolRecord.id as string)
        .is('claimed_by', null)
        .limit(1)
        .single();
      if (!code) {
        await db()
          .from('reward_pools')
          .update({ status: 'exhausted', updated_at: new Date().toISOString() })
          .eq('id', poolRecord.id as string);
        return res.status(503).json({ error: 'reward pool exhausted' });
      }
      const codeRecord = code as Record<string, unknown>;
      codeId = codeRecord.id as string;
      codeValue = codeRecord.code as string;
    } else if (poolRecord.type === 'single_code') {
      const meta = poolRecord.meta as Record<string, unknown>;
      codeValue = (meta?.code as string) ?? null;
    } else if (poolRecord.type === 'voucher_link') {
      const meta = poolRecord.meta as Record<string, unknown>;
      codeValue = (meta?.url as string) ?? null;
    } else if (poolRecord.type === 'points_bonus') {
      const meta = poolRecord.meta as Record<string, unknown>;
      codeValue = String(meta?.bonus_points ?? 0);
    }

    // Insert claim
    const { data: claim, error: claimError } = await db()
      .from('reward_claims')
      .insert({
        user_id: userId,
        campaign_id,
        pool_id: poolRecord.id as string,
        milestone_key,
        code_id: codeId,
        meta: {
          pool_name: poolRecord.name,
          pool_type: poolRecord.type,
          code: codeValue,
        },
      })
      .select()
      .single();

    if (claimError) {
      if (claimError.code === '23505') return res.status(409).json({ error: 'already claimed' });
      return res.status(500).json({ error: claimError.message });
    }

    // Mark code as claimed
    if (codeId) {
      const claimRecord = claim as Record<string, unknown>;
      await db()
        .from('reward_codes')
        .update({
          claimed_by: userId,
          claimed_at: new Date().toISOString(),
          claim_id: claimRecord.id as string,
        })
        .eq('id', codeId);
    }

    const claimRecord = claim as Record<string, unknown>;
    res.json({
      ok: true,
      claim: {
        ...claimRecord,
        code: codeValue,
        pool_type: poolRecord.type,
        pool_name: poolRecord.name,
      },
    });
  } catch (err) {
    next(err);
  }
});
