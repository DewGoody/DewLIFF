import { test } from 'node:test';
import assert from 'node:assert/strict';

import { writeResultToLineKit } from './lineKitClient.js';

/** Snapshot + restore the three LineKit env vars around each test that touches them. */
function withLineKitEnv(vars: Partial<Record<'LINEKIT_BASE_URL' | 'LINEKIT_LIFF_ID' | 'LINEKIT_API_KEY', string | undefined>>, fn: () => Promise<void>) {
  const keys = ['LINEKIT_BASE_URL', 'LINEKIT_LIFF_ID', 'LINEKIT_API_KEY'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) {
    const v = vars[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

test('fails soft (no throw) when LINEKIT_LIFF_ID and LINEKIT_API_KEY are unset', async () => {
  await withLineKitEnv({ LINEKIT_BASE_URL: 'http://localhost:3000', LINEKIT_LIFF_ID: undefined, LINEKIT_API_KEY: undefined }, async () => {
    await assert.doesNotReject(() => writeResultToLineKit('U123', { resultCode: 'fire_fire' }));
  });
});

test('fails soft when LINEKIT_BASE_URL is unset', async () => {
  await withLineKitEnv({ LINEKIT_BASE_URL: undefined, LINEKIT_LIFF_ID: 'liff-123', LINEKIT_API_KEY: 'key-123' }, async () => {
    await assert.doesNotReject(() => writeResultToLineKit('U123', { resultCode: 'fire_fire' }));
  });
});

test('fails soft when the configured LineKit endpoint is unreachable', async () => {
  // Nothing is listening on this port — the fetch itself will reject, and
  // writeResultToLineKit must swallow that rather than propagate it.
  await withLineKitEnv(
    { LINEKIT_BASE_URL: 'http://127.0.0.1:1', LINEKIT_LIFF_ID: 'liff-123', LINEKIT_API_KEY: 'key-123' },
    async () => {
      await assert.doesNotReject(() => writeResultToLineKit('U123', { resultCode: 'fire_fire' }));
    },
  );
});

test('sends the expected request shape when fully configured', async () => {
  const originalFetch = globalThis.fetch;
  const captured: { url?: string; init?: RequestInit } = {};

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    captured.url = String(url);
    captured.init = init;
    return new Response(JSON.stringify({ session: { id: 's1' } }), { status: 200 });
  }) as typeof fetch;

  try {
    await withLineKitEnv(
      { LINEKIT_BASE_URL: 'http://localhost:3000', LINEKIT_LIFF_ID: 'buddy-quiz', LINEKIT_API_KEY: 'secret-key' },
      async () => {
        await writeResultToLineKit('Uabc', { resultCode: 'fire_fire', scores: { a: 1 } }, 'pair-42');
      },
    );

    if (!captured.init) throw new Error('fetch should have been called');
    const init = captured.init;
    assert.equal(captured.url, 'http://localhost:3000/api/liff/buddy-quiz/session');
    assert.equal(init.method, 'PUT');
    const headers = init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer secret-key');
    assert.equal(headers['X-Line-User-Id'], 'Uabc');
    const body = JSON.parse(init.body as string);
    assert.deepEqual(body, { data: { resultCode: 'fire_fire', scores: { a: 1 } }, externalKey: 'pair-42' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
