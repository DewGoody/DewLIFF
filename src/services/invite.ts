import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { GoneError, BadRequestError, NotFoundError } from '../errors/index.js';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateInviteToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export async function createInvite(pairId: string, expiresAt: Date): Promise<string> {
  const { raw, hash } = generateInviteToken();

  const { error } = await db().from('invite_tokens').insert({
    token_hash: hash,
    pair_id: pairId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(`Failed to create invite: ${error.message}`);
  return raw;
}

export type InviteResult = {
  pairId: string;
  aUser: string;
  campaignId: string;
  configVersion: number;
};

export async function verifyAndConsumeInvite(
  rawToken: string,
  userId: string,
): Promise<InviteResult> {
  const hash = hashToken(rawToken);

  // Look up the invite
  const { data: invite, error: invErr } = await db()
    .from('invite_tokens')
    .select('token_hash, pair_id, used_at, expires_at')
    .eq('token_hash', hash)
    .single();

  if (invErr || !invite) throw new NotFoundError('Invite not found');
  if (invite.used_at) throw new GoneError('Invite already used');
  if (new Date(invite.expires_at) < new Date()) throw new GoneError('Invite expired');

  // Look up the pair
  const { data: pair, error: pairErr } = await db()
    .from('pairs')
    .select('id, campaign_id, config_version, a_user, b_user, status')
    .eq('id', invite.pair_id)
    .single();

  if (pairErr || !pair) throw new NotFoundError('Pair not found');
  if (pair.status !== 'waiting') throw new GoneError('Pair is no longer waiting');
  if (pair.a_user === userId) throw new BadRequestError('Cannot pair with yourself');
  if (pair.b_user && pair.b_user !== userId) throw new GoneError('Pair already has a partner');

  // Mark invite as used
  const { error: updateInvErr } = await db()
    .from('invite_tokens')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('token_hash', hash)
    .is('used_at', null);

  if (updateInvErr) throw new Error(`Failed to consume invite: ${updateInvErr.message}`);

  // Set b_user on the pair
  const { error: updatePairErr } = await db()
    .from('pairs')
    .update({ b_user: userId })
    .eq('id', pair.id)
    .eq('status', 'waiting')
    .is('b_user', null);

  if (updatePairErr) throw new Error(`Failed to join pair: ${updatePairErr.message}`);

  return {
    pairId: pair.id,
    aUser: pair.a_user,
    campaignId: pair.campaign_id,
    configVersion: pair.config_version,
  };
}
