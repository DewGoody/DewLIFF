import { Router } from 'express';
import { db } from '../db/client.js';
import { getConfig } from '../config/loader.js';

export const rewardsAdminRouter = Router();
export const rewardsQuizRouter = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

type Pool = {
  id: string;
  name: string;
  type: string;
  gives: string;
  claim_mode: string;
  max_claims_per_user: number;
  expiry_mode: string;
  expiry_days: number | null;
  daily_cap: number | null;
  stock_total: number | null;
  stock_remaining: number | null;
  brand_id: string | null;
  description: string | null;
  expires_at: string | null;
  meta: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Compute expiry timestamp for a new claim given pool settings */
function computeExpiry(pool: Pool, campaignEndsAt?: string | null): string | null {
  if (pool.expiry_mode === 'never') return null;
  if (pool.expiry_mode === 'days' && pool.expiry_days) {
    const d = new Date();
    d.setDate(d.getDate() + pool.expiry_days);
    return d.toISOString();
  }
  if (pool.expiry_mode === 'campaign_end' && campaignEndsAt) return campaignEndsAt;
  return null;
}

/** Check if user has hit max_claims_per_user for this pool */
async function userClaimCount(userId: string, poolId: string): Promise<number> {
  const { count } = await db()
    .from('reward_claims')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('pool_id', poolId);
  return count ?? 0;
}

/** Pop one available code from a code_pool */
async function popCode(poolId: string): Promise<{ id: string; code: string } | null> {
  const { data } = await db()
    .from('reward_codes')
    .select('id, code')
    .eq('pool_id', poolId)
    .is('claimed_by', null)
    .limit(1)
    .single();
  return data as { id: string; code: string } | null;
}

// ─── ADMIN: Pool CRUD ─────────────────────────────────────────────────────────

rewardsAdminRouter.get('/pools', async (req, res, next) => {
  try {
    let q = db()
      .from('reward_pools')
      .select('*')
      .order('created_at', { ascending: false });
    if (req.query.brand_id) q = q.eq('brand_id', req.query.brand_id as string);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    const pools = await Promise.all(
      (data || []).map(async (p: Record<string, unknown>) => {
        const [{ count: totalCodes }, { count: availCodes }, { count: totalClaims }] =
          await Promise.all([
            db().from('reward_codes').select('*', { count: 'exact', head: true }).eq('pool_id', p.id as string),
            db().from('reward_codes').select('*', { count: 'exact', head: true }).eq('pool_id', p.id as string).is('claimed_by', null),
            db().from('reward_claims').select('*', { count: 'exact', head: true }).eq('pool_id', p.id as string),
          ]);
        return { ...p, total_codes: totalCodes ?? 0, available_codes: availCodes ?? 0, total_claims: totalClaims ?? 0 };
      })
    );
    res.json({ pools });
  } catch (err) { next(err); }
});

rewardsAdminRouter.post('/pools', async (req, res, next) => {
  try {
    const {
      name, type, brand_id, description, gives = 'reward', claim_mode = 'auto',
      max_claims_per_user = 1, expiry_mode = 'never', expiry_days, daily_cap,
      stock_total, expires_at, meta,
    } = req.body as Record<string, unknown>;
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });

    const { data, error } = await db()
      .from('reward_pools')
      .insert({
        name, type, brand_id, description, gives, claim_mode, max_claims_per_user,
        expiry_mode, expiry_days: expiry_days ?? null, daily_cap: daily_cap ?? null,
        stock_total: stock_total ?? null, stock_remaining: stock_total ?? null,
        expires_at: expires_at ?? null, meta: meta ?? {},
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ pool: data });
  } catch (err) { next(err); }
});

rewardsAdminRouter.get('/pools/:id', async (req, res, next) => {
  try {
    const { data, error } = await db()
      .from('reward_pools').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'not found' });

    const [{ count: totalCodes }, { count: availCodes }, { count: totalClaims }] =
      await Promise.all([
        db().from('reward_codes').select('*', { count: 'exact', head: true }).eq('pool_id', req.params.id),
        db().from('reward_codes').select('*', { count: 'exact', head: true }).eq('pool_id', req.params.id).is('claimed_by', null),
        db().from('reward_claims').select('*', { count: 'exact', head: true }).eq('pool_id', req.params.id),
      ]);

    const { data: triggers } = await db()
      .from('reward_triggers').select('*').eq('pool_id', req.params.id).order('created_at');

    res.json({
      pool: data,
      stats: { total_codes: totalCodes ?? 0, available_codes: availCodes ?? 0, total_claims: totalClaims ?? 0 },
      triggers: triggers ?? [],
    });
  } catch (err) { next(err); }
});

rewardsAdminRouter.put('/pools/:id', async (req, res, next) => {
  try {
    const {
      name, description, brand_id, gives, claim_mode, max_claims_per_user,
      expiry_mode, expiry_days, daily_cap, stock_total, expires_at, meta, status,
    } = req.body as Record<string, unknown>;
    const { data, error } = await db()
      .from('reward_pools')
      .update({
        name, description, brand_id, gives, claim_mode, max_claims_per_user,
        expiry_mode, expiry_days, daily_cap, stock_total, expires_at: expires_at ?? null,
        meta, status, updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ pool: data });
  } catch (err) { next(err); }
});

rewardsAdminRouter.delete('/pools/:id', async (req, res, next) => {
  try {
    const { error } = await db().from('reward_pools').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── ADMIN: Codes ─────────────────────────────────────────────────────────────

rewardsAdminRouter.post('/pools/:id/codes', async (req, res, next) => {
  try {
    const { codes } = req.body as { codes?: string[] };
    if (!Array.isArray(codes) || codes.length === 0)
      return res.status(400).json({ error: 'codes array required' });
    const rows = codes.map((c: string) => ({ pool_id: req.params.id, code: c.trim() })).filter(r => r.code.length > 0);
    const { error } = await db().from('reward_codes').upsert(rows, { onConflict: 'pool_id,code', ignoreDuplicates: true });
    if (error) return res.status(500).json({ error: error.message });
    // Update stock_remaining
    const { count: avail } = await db()
      .from('reward_codes').select('*', { count: 'exact', head: true })
      .eq('pool_id', req.params.id).is('claimed_by', null);
    await db().from('reward_pools')
      .update({ stock_remaining: avail ?? rows.length, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    res.json({ ok: true, imported: rows.length });
  } catch (err) { next(err); }
});

rewardsAdminRouter.get('/pools/:id/codes', async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = 50;
    const { data, count, error } = await db()
      .from('reward_codes').select('*', { count: 'exact' })
      .eq('pool_id', req.params.id).order('created_at')
      .range((page - 1) * limit, page * limit - 1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ codes: data || [], total: count ?? 0, page, limit });
  } catch (err) { next(err); }
});

rewardsAdminRouter.delete('/pools/:id/codes/:codeId', async (req, res, next) => {
  try {
    const { error } = await db().from('reward_codes')
      .delete().eq('id', req.params.codeId).eq('pool_id', req.params.id).is('claimed_by', null);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── ADMIN: Triggers ──────────────────────────────────────────────────────────

rewardsAdminRouter.get('/pools/:id/triggers', async (req, res, next) => {
  try {
    const { data, error } = await db()
      .from('reward_triggers').select('*').eq('pool_id', req.params.id).order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ triggers: data || [] });
  } catch (err) { next(err); }
});

rewardsAdminRouter.post('/pools/:id/triggers', async (req, res, next) => {
  try {
    const { campaign_id, trigger_type, condition, units_granted = 1, label, enabled = true } =
      req.body as Record<string, unknown>;
    if (!trigger_type) return res.status(400).json({ error: 'trigger_type required' });
    const { data, error } = await db()
      .from('reward_triggers')
      .insert({ pool_id: req.params.id, campaign_id, trigger_type, condition: condition ?? {}, units_granted, label, enabled })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ trigger: data });
  } catch (err) { next(err); }
});

rewardsAdminRouter.put('/triggers/:id', async (req, res, next) => {
  try {
    const { campaign_id, trigger_type, condition, units_granted, label, enabled } =
      req.body as Record<string, unknown>;
    const { data, error } = await db()
      .from('reward_triggers').update({ campaign_id, trigger_type, condition, units_granted, label, enabled })
      .eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ trigger: data });
  } catch (err) { next(err); }
});

rewardsAdminRouter.delete('/triggers/:id', async (req, res, next) => {
  try {
    const { error } = await db().from('reward_triggers').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── ADMIN: Claims management ─────────────────────────────────────────────────

rewardsAdminRouter.get('/claims', async (req, res, next) => {
  try {
    const { campaign_id, pool_id, delivery_status, status } = req.query;
    let q = db()
      .from('reward_claims')
      .select('*, reward_pools(name, type), reward_codes(code)')
      .order('issued_at', { ascending: false })
      .limit(200);
    if (campaign_id) q = q.eq('campaign_id', campaign_id as string);
    if (pool_id)     q = q.eq('pool_id', pool_id as string);
    if (delivery_status) q = q.eq('delivery_status', delivery_status as string);
    if (status)      q = q.eq('status', status as string);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ claims: data || [] });
  } catch (err) { next(err); }
});

// Update claim — admin approve delivery, add tracking, update status
rewardsAdminRouter.put('/claims/:id', async (req, res, next) => {
  try {
    const { delivery_status, tracking_number, admin_note, status } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (delivery_status !== undefined) updates.delivery_status = delivery_status;
    if (tracking_number !== undefined) updates.tracking_number = tracking_number;
    if (admin_note !== undefined)      updates.admin_note = admin_note;
    if (status !== undefined)          updates.status = status;

    const { data, error } = await db()
      .from('reward_claims').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ claim: data });
  } catch (err) { next(err); }
});

// ─── LIFF: public campaign reward info ───────────────────────────────────────
// GET /api/campaign/:id/rewards  (mounted in campaign router)
export async function getCampaignRewards(req: { params: { id: string }; userId?: string }, res: { json: (d: unknown) => void; status: (n: number) => { json: (d: unknown) => void } }) {
  try {
    const campaignId = req.params.id;
    const userId = req.userId;

    // Get all active triggers for this campaign
    const { data: triggers } = await db()
      .from('reward_triggers')
      .select('id, trigger_type, condition, units_granted, label, pool_id, reward_pools(name, type, gives, status)')
      .eq('campaign_id', campaignId)
      .eq('enabled', true);

    if (!triggers || triggers.length === 0) return res.json({ rewards: [] });

    // Get user's existing claims for this campaign (if authenticated)
    let userClaims: Record<string, unknown>[] = [];
    if (userId) {
      const { data } = await db()
        .from('reward_claims')
        .select('trigger_id, status, delivery_status, meta, issued_at, expires_at, reward_codes(code)')
        .eq('user_id', userId)
        .eq('campaign_id', campaignId);
      userClaims = (data as Record<string, unknown>[]) || [];
    }

    const claimsByTrigger = Object.fromEntries(
      userClaims.map((c) => [c.trigger_id as string, c])
    );

    const rewards = (triggers as Record<string, unknown>[]).map((t) => {
      const pool = t.reward_pools as Record<string, unknown> | null;
      return {
        trigger_id: t.id,
        trigger_type: t.trigger_type,
        condition: t.condition,
        units_granted: t.units_granted,
        label: t.label,
        pool: pool ? { id: t.pool_id, name: pool.name, type: pool.type, gives: pool.gives, status: pool.status } : null,
        claim: claimsByTrigger[t.id as string] ?? null,
      };
    });

    res.json({ rewards });
  } catch (err) {
    res.status(500).json({ error: 'internal error' });
  }
}

// ─── LIFF: User reward endpoints ──────────────────────────────────────────────

// GET /api/quiz/rewards/my/:campaignId
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
  } catch (err) { next(err); }
});

// POST /api/quiz/rewards/claim — claim via trigger
rewardsQuizRouter.post('/claim', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { campaign_id, trigger_id } = req.body as { campaign_id?: string; trigger_id?: string };
    if (!campaign_id || !trigger_id) return res.status(400).json({ error: 'campaign_id and trigger_id required' });

    // Load trigger
    const { data: triggerRow } = await db()
      .from('reward_triggers')
      .select('*, reward_pools(*)')
      .eq('id', trigger_id)
      .eq('campaign_id', campaign_id)
      .eq('enabled', true)
      .single();
    if (!triggerRow) return res.status(404).json({ error: 'trigger not found' });

    const trigger = triggerRow as Record<string, unknown>;
    const pool = trigger.reward_pools as Pool;
    if (!pool || pool.status !== 'active') return res.status(400).json({ error: 'reward pool unavailable' });

    // Check max_claims_per_user
    const claimCount = await userClaimCount(userId, pool.id);
    if (claimCount >= pool.max_claims_per_user) return res.status(409).json({ error: 'claim limit reached' });

    // Check duplicate for this trigger
    const { data: existing } = await db()
      .from('reward_claims').select('id').eq('user_id', userId).eq('trigger_id', trigger_id).single();
    if (existing) return res.status(409).json({ error: 'already claimed' });

    // Verify trigger condition is met
    const conditionMet = await checkTriggerCondition(userId, campaign_id, trigger);
    if (!conditionMet.ok) return res.status(400).json({ error: conditionMet.reason });

    // Resolve code/value
    let codeId: string | null = null;
    let codeValue: string | null = null;

    if (pool.type === 'code_pool') {
      const code = await popCode(pool.id);
      if (!code) {
        await db().from('reward_pools').update({ status: 'exhausted', updated_at: new Date().toISOString() }).eq('id', pool.id);
        return res.status(503).json({ error: 'reward pool exhausted' });
      }
      codeId = code.id;
      codeValue = code.code;
    } else if (pool.type === 'single_code') {
      codeValue = (pool.meta?.code as string) ?? null;
    } else if (pool.type === 'voucher_link') {
      codeValue = (pool.meta?.url as string) ?? null;
    }

    // Load campaign for expiry calc
    const { data: campaign } = await db().from('campaigns').select('ends_at').eq('id', campaign_id).single();
    const expiresAt = computeExpiry(pool, (campaign as Record<string, unknown> | null)?.ends_at as string ?? null);

    // Insert claim
    const { data: claim, error: claimErr } = await db()
      .from('reward_claims')
      .insert({
        user_id: userId,
        campaign_id,
        pool_id: pool.id,
        trigger_id,
        milestone_key: trigger_id, // backward-compat
        code_id: codeId,
        expires_at: expiresAt,
        delivery_mode: pool.type === 'physical' ? 'delivery' : 'digital',
        delivery_status: pool.type === 'physical' ? 'pending' : null,
        status: pool.claim_mode === 'auto' ? 'issued' : 'pending',
        meta: { pool_name: pool.name, pool_type: pool.type, code: codeValue },
      })
      .select().single();

    if (claimErr) {
      if (claimErr.code === '23505') return res.status(409).json({ error: 'already claimed' });
      return res.status(500).json({ error: claimErr.message });
    }

    // Mark code as claimed
    if (codeId) {
      const claimRecord = claim as Record<string, unknown>;
      await db().from('reward_codes').update({ claimed_by: userId, claimed_at: new Date().toISOString(), claim_id: claimRecord.id as string }).eq('id', codeId);
    }

    const claimRecord = claim as Record<string, unknown>;
    res.json({
      ok: true,
      claim: { ...claimRecord, code: codeValue, pool_type: pool.type, pool_name: pool.name },
    });
  } catch (err) { next(err); }
});

// POST /api/quiz/rewards/claims/:id/address — submit delivery address
rewardsQuizRouter.post('/claims/:id/address', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { name, phone, address_line, district, province, postal_code } = req.body as Record<string, string>;
    if (!name || !phone || !address_line || !province || !postal_code)
      return res.status(400).json({ error: 'name, phone, address_line, province, postal_code required' });

    const { data, error } = await db()
      .from('reward_claims')
      .update({
        address: { name, phone, address_line, district, province, postal_code },
        delivery_status: 'pending',
      })
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .eq('delivery_mode', 'delivery')
      .select().single();
    if (error || !data) return res.status(404).json({ error: 'claim not found or not eligible' });
    res.json({ ok: true, claim: data });
  } catch (err) { next(err); }
});

// POST /api/quiz/rewards/claims/:id/redeem — mark redeemed onsite
rewardsQuizRouter.post('/claims/:id/redeem', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { data, error } = await db()
      .from('reward_claims')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .neq('status', 'redeemed')
      .select().single();
    if (error || !data) return res.status(404).json({ error: 'claim not found or already redeemed' });
    res.json({ ok: true, claim: data });
  } catch (err) { next(err); }
});

// Legacy: claim by milestone_key (backward-compat for old LIFF code)
rewardsQuizRouter.post('/claim-milestone', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { campaign_id, milestone_key } = req.body as { campaign_id?: string; milestone_key?: string };
    if (!campaign_id || !milestone_key) return res.status(400).json({ error: 'campaign_id and milestone_key required' });

    const cfg = await getConfig(campaign_id).catch(() => null);
    if (!cfg) return res.status(404).json({ error: 'campaign not found' });
    const milestone = cfg.rewards?.milestones?.find((m) => m.key === milestone_key);
    if (!milestone) return res.status(404).json({ error: 'milestone not found' });

    const { count: pairsDone } = await db()
      .from('pairs').select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id).eq('status', 'completed')
      .or(`a_user.eq.${userId},b_user.eq.${userId}`);
    if ((pairsDone ?? 0) < milestone.trigger_pairs)
      return res.status(400).json({ error: 'not enough pairs', need: milestone.trigger_pairs, have: pairsDone });

    const { data: existing } = await db()
      .from('reward_claims').select('id')
      .eq('user_id', userId).eq('campaign_id', campaign_id).eq('milestone_key', milestone_key).single();
    if (existing) return res.status(409).json({ error: 'already claimed' });

    const { data: pool } = await db().from('reward_pools').select('*').eq('id', milestone.reward_pool_id).single();
    if (!pool || (pool as Record<string, unknown>).status !== 'active') return res.status(400).json({ error: 'reward pool unavailable' });

    const poolRecord = pool as Record<string, unknown>;
    let codeId: string | null = null;
    let codeValue: string | null = null;
    if (poolRecord.type === 'code_pool' || poolRecord.type === 'raffle') {
      const code = await popCode(poolRecord.id as string);
      if (!code) { await db().from('reward_pools').update({ status: 'exhausted', updated_at: new Date().toISOString() }).eq('id', poolRecord.id as string); return res.status(503).json({ error: 'pool exhausted' }); }
      codeId = code.id; codeValue = code.code;
    } else if (poolRecord.type === 'single_code') { codeValue = (poolRecord.meta as Record<string, unknown>)?.code as string ?? null; }
    else if (poolRecord.type === 'voucher_link') { codeValue = (poolRecord.meta as Record<string, unknown>)?.url as string ?? null; }

    const { data: claim, error: claimErr } = await db()
      .from('reward_claims')
      .insert({ user_id: userId, campaign_id, pool_id: poolRecord.id as string, milestone_key, code_id: codeId, meta: { pool_name: poolRecord.name, pool_type: poolRecord.type, code: codeValue } })
      .select().single();
    if (claimErr) { if (claimErr.code === '23505') return res.status(409).json({ error: 'already claimed' }); return res.status(500).json({ error: claimErr.message }); }
    if (codeId) { const cr = claim as Record<string, unknown>; await db().from('reward_codes').update({ claimed_by: userId, claimed_at: new Date().toISOString(), claim_id: cr.id as string }).eq('id', codeId); }
    const cr = claim as Record<string, unknown>;
    res.json({ ok: true, claim: { ...cr, code: codeValue, pool_type: poolRecord.type, pool_name: poolRecord.name } });
  } catch (err) { next(err); }
});

// ─── Trigger condition checker ────────────────────────────────────────────────

async function checkTriggerCondition(
  userId: string,
  campaignId: string,
  trigger: Record<string, unknown>
): Promise<{ ok: boolean; reason?: string }> {
  const type = trigger.trigger_type as string;
  const cond = (trigger.condition as Record<string, unknown>) ?? {};

  if (type === 'quiz_complete') {
    const { count } = await db()
      .from('user_quiz_answers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('campaign_id', campaignId);
    if ((count ?? 0) === 0) return { ok: false, reason: 'quiz not completed' };
    return { ok: true };
  }

  if (type === 'pair_milestone') {
    const required = (cond.pairs_required as number) ?? 1;
    const { count } = await db()
      .from('pairs')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'completed')
      .or(`a_user.eq.${userId},b_user.eq.${userId}`);
    if ((count ?? 0) < required) return { ok: false, reason: `need ${required} pairs, have ${count ?? 0}` };
    return { ok: true };
  }

  if (type === 'group_complete') {
    const { data: groups } = await db()
      .from('group_members')
      .select('group_id, groups(status)')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId);
    const hasComplete = (groups ?? []).some(
      (g) => (g as Record<string, unknown>).groups && ((g as Record<string, unknown>).groups as Record<string, unknown>).status === 'complete'
    );
    if (!hasComplete) return { ok: false, reason: 'no completed group' };
    return { ok: true };
  }

  // checkin / push — condition checked externally before calling /claim
  return { ok: true };
}
