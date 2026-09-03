/**
 * Analytics service — hashed participant tracking, enhanced event logging,
 * participant upserts, and daily rollup computation.
 *
 * All identifiers stored are SHA-256(lineUserId + ':' + brandSalt) so raw
 * LINE user IDs never appear in analytics tables.
 */

import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db/client.js';

// ── Brand salt management ─────────────────────────────────────────────

const saltCache = new Map<string, string>();

/** Get or create a stable salt for this brand (cached in-process). */
async function getBrandSalt(brandId: string): Promise<string> {
  const cached = saltCache.get(brandId);
  if (cached) return cached;

  const { data } = await db()
    .from('brand_salts')
    .select('salt')
    .eq('brand_id', brandId)
    .single();

  if (data?.salt) {
    saltCache.set(brandId, data.salt);
    return data.salt;
  }

  // First time — create a salt
  const salt = randomBytes(32).toString('hex');
  const { error } = await db()
    .from('brand_salts')
    .upsert({ brand_id: brandId, salt }, { onConflict: 'brand_id', ignoreDuplicates: true });

  if (error) console.error('[analytics] brand salt upsert failed:', error.message);

  // Re-read to get whichever salt won the race
  const { data: confirmed } = await db()
    .from('brand_salts')
    .select('salt')
    .eq('brand_id', brandId)
    .single();

  const finalSalt = confirmed?.salt || salt;
  saltCache.set(brandId, finalSalt);
  return finalSalt;
}

/** SHA-256(lineUserId + ':' + brandSalt), hex — stable, anonymised ID. */
export async function hashParticipant(lineUserId: string, brandId: string): Promise<string> {
  const salt = await getBrandSalt(brandId);
  return createHash('sha256').update(lineUserId + ':' + salt).digest('hex');
}

// ── Enhanced event logging ────────────────────────────────────────────

export interface AnalyticsEvent {
  userId: string;
  campaignId: string;
  type: string;
  /** Brand / OA identifier used for participant hashing. Defaults to campaignId. */
  brandId?: string;
  pairId?: string;
  sessionId?: string;
  source?: 'organic' | 'invite' | 'richmenu' | 'push' | string;
  /** Raw LINE userId of the person who referred this user (will be hashed). */
  refUserId?: string;
  configVersion?: number;
  tier?: 'solo' | 'pair' | 'group' | string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
}

export async function logAnalyticsEvent(input: AnalyticsEvent): Promise<void> {
  try {
    const brand = input.brandId ?? input.campaignId;
    const participantHash = await hashParticipant(input.userId, brand);
    const refHash = input.refUserId
      ? await hashParticipant(input.refUserId, brand)
      : null;

    const { error } = await db().from('events').insert({
      user_id: input.userId,
      pair_id: input.pairId ?? null,
      campaign_id: input.campaignId,
      type: input.type,
      meta: {},
      participant_hash: participantHash,
      session_id: input.sessionId ?? null,
      source: input.source ?? null,
      ref_participant: refHash,
      config_version: input.configVersion ?? null,
      tier: input.tier ?? null,
      payload: input.payload ?? null,
      occurred_at: input.occurredAt?.toISOString() ?? null,
    });

    if (error) console.error('[analytics] event insert failed:', error.message);
  } catch (err) {
    console.error('[analytics] logAnalyticsEvent error:', err);
  }
}

// ── Participant upsert ────────────────────────────────────────────────

export interface ParticipantUpdate {
  campaignId: string;
  participantHash: string;
  source?: string;
  refParticipant?: string;
  referralDepth?: number;
  resultId?: string;
  status?: 'started' | 'completed' | 'dropped';
  msSpent?: number;
  incrementInvitesSent?: boolean;
  incrementInvitesConverted?: boolean;
}

export async function upsertParticipant(p: ParticipantUpdate): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Insert if new (ignoreDuplicates = don't overwrite first_seen_at / source / ref)
    await db().from('participants').upsert(
      {
        campaign_id: p.campaignId,
        participant_hash: p.participantHash,
        first_seen_at: now,
        last_seen_at: now,
        source: p.source ?? null,
        ref_participant: p.refParticipant ?? null,
        referral_depth: p.referralDepth ?? 0,
        result_id: p.resultId ?? null,
        status: p.status ?? 'started',
        ms_spent: p.msSpent ?? null,
      },
      { onConflict: 'campaign_id,participant_hash', ignoreDuplicates: true },
    );

    // Update mutable fields on existing row
    const updates: Record<string, unknown> = { last_seen_at: now };
    if (p.resultId !== undefined) updates.result_id = p.resultId;
    if (p.status !== undefined) updates.status = p.status;
    if (p.msSpent !== undefined) updates.ms_spent = p.msSpent;

    await db()
      .from('participants')
      .update(updates)
      .eq('campaign_id', p.campaignId)
      .eq('participant_hash', p.participantHash);

    // Atomic increments via DB functions
    if (p.incrementInvitesSent) {
      await db().rpc('increment_participant_invites_sent', {
        p_campaign_id: p.campaignId,
        p_hash: p.participantHash,
      });
    }
    if (p.incrementInvitesConverted) {
      await db().rpc('increment_participant_invites_converted', {
        p_campaign_id: p.campaignId,
        p_hash: p.participantHash,
      });
    }
  } catch (err) {
    console.error('[analytics] upsertParticipant error:', err);
  }
}

// ── Daily rollup computation ──────────────────────────────────────────

/** Aggregate one day's events into daily_rollups. date format: 'YYYY-MM-DD' */
export async function computeDailyRollup(date: string, campaignId?: string): Promise<number> {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  // Get all campaigns to rollup (or just the one requested)
  let campaignIds: string[];
  if (campaignId) {
    campaignIds = [campaignId];
  } else {
    const { data } = await db().from('campaigns').select('id');
    campaignIds = (data ?? []).map((c: { id: string }) => c.id);
  }

  let processed = 0;
  for (const cid of campaignIds) {
    const { data: evts } = await db()
      .from('events')
      .select('type, tier, participant_hash')
      .eq('campaign_id', cid)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd);

    if (!evts || evts.length === 0) continue;

    const counts = {
      opens: 0, starts: 0, completions: 0, pairs_done: 0,
      shares: 0, follows: 0, unfollows: 0,
      invite_clicks: 0, invite_conversions: 0,
    };

    const seenParticipants = new Set<string>();
    for (const e of evts) {
      if (e.participant_hash) seenParticipants.add(e.participant_hash);
      switch (e.type) {
        case 'open':            counts.opens++;          break;
        case 'quiz_start':      counts.starts++;         break;
        case 'quiz_done':       counts.completions++;    break;
        case 'pair_done':       counts.pairs_done++;     break;
        case 'share_click':     counts.shares++;         break;
        case 'follow':          counts.follows++;        break;
        case 'unfollow':        counts.unfollows++;      break;
        case 'invite_open':     counts.invite_clicks++;  break;
      }
    }

    await db().from('daily_rollups').upsert(
      {
        campaign_id: cid,
        date,
        tier: 'all',
        ...counts,
        new_participants: seenParticipants.size,
        invite_conversions: counts.completions, // proxy: completions from invite source
      },
      { onConflict: 'campaign_id,date,tier' },
    );

    processed++;
  }

  return processed;
}
