import { env } from '../env.js';
import { UnauthorizedError } from '../errors/index.js';

export type LineProfile = {
  sub: string;
  name: string;
  picture?: string;
};

export async function verifyIdToken(idToken: string): Promise<LineProfile> {
  const res = await fetch(`${env().LINE_API_BASE}/oauth2/v2.1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: env().LINE_CHANNEL_ID,
    }),
  });

  if (!res.ok) {
    // LINE's /verify returns a JSON body explaining *why* (e.g. "invalid_client",
    // "ID Token expired") — surface it in the logs instead of a blanket 401,
    // since that's the only way to tell a channel-id mismatch apart from an
    // expired/malformed token from the Vercel function logs.
    const body = await res.text().catch(() => '');
    console.error('[line] id token verify failed', res.status, body, 'client_id=', env().LINE_CHANNEL_ID);
    throw new UnauthorizedError('Invalid LINE ID token');
  }

  const data = await res.json();
  return { sub: data.sub, name: data.name, picture: data.picture };
}

export type LineMessage = {
  type: string;
  [key: string]: unknown;
};

export async function pushMessage(userId: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${env().LINE_API_BASE}/v2/bot/message/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Push failed for ${userId}: ${res.status} ${body}`);
  }
}

/** Reply message — FREE, ไม่นับ quota. ต้องใช้ภายใน 1 นาทีหลัง event เข้ามา */
export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${env().LINE_API_BASE}/v2/bot/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`[replyMessage] failed: ${res.status} ${body}`);
  } else {
    console.log(`[replyMessage] ok: ${res.status} ${body}`);
  }
}

export async function getProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string } | null> {
  const res = await fetch(`${env().LINE_API_BASE}/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}
