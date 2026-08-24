/**
 * Server-to-server write-back of finalized quiz results into LineKit's LIFF
 * platform (PUT /api/liff/{liffId}/session — see LineKit's
 * app/api/liff/[liffId]/session/route.ts and lib/liff/auth.ts for the contract
 * this mirrors).
 *
 * KimLIFF's own Express backend + Postgres/Supabase schema stays the sole
 * source of truth for quiz data (questions, pairs, answers, scores) — this
 * module only *also* tells LineKit "this LINE user got this result", so
 * LineKit knows the player and result without owning any of the game logic.
 *
 * Deliberately reads process.env directly rather than going through
 * src/env.ts's loadEnv()/env() singleton: LINEKIT_LIFF_ID / LINEKIT_API_KEY
 * are expected to be unset until this LIFF is registered for real in
 * LineKit's /liff-apps admin screen, and this module must never make that a
 * hard failure the way env.ts's zod schema does for required vars.
 */

const LINEKIT_TIMEOUT_MS = 5000;

function isConfigured(): { baseUrl: string; liffId: string; apiKey: string } | null {
  const baseUrl = process.env.LINEKIT_BASE_URL;
  const liffId = process.env.LINEKIT_LIFF_ID;
  const apiKey = process.env.LINEKIT_API_KEY;

  if (!baseUrl || !liffId || !apiKey) return null;
  return { baseUrl, liffId, apiKey };
}

/**
 * Write (upsert) one player's result into LineKit. Fails soft: any missing
 * config or request failure logs a warning and resolves — it never throws,
 * so it can never break KimLIFF's own DB write or reply to the player.
 *
 * `externalKey` lets LineKit's session be looked up later by an app-chosen
 * key (e.g. a pairId or sessionId) instead of only by participant.
 */
export async function writeResultToLineKit(
  lineUserId: string,
  data: Record<string, unknown>,
  externalKey?: string,
): Promise<void> {
  const config = isConfigured();
  if (!config) {
    console.warn(
      '[lineKitClient] LINEKIT_BASE_URL/LINEKIT_LIFF_ID/LINEKIT_API_KEY not fully set — skipping LineKit write-back for',
      lineUserId,
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINEKIT_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.baseUrl}/api/liff/${config.liffId}/session`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-Line-User-Id': lineUserId,
      },
      body: JSON.stringify(externalKey ? { data, externalKey } : { data }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[lineKitClient] LineKit write-back failed for ${lineUserId}: ${res.status} ${body}`);
    }
  } catch (e) {
    console.warn(
      `[lineKitClient] LineKit write-back errored for ${lineUserId}:`,
      e instanceof Error ? e.message : e,
    );
  } finally {
    clearTimeout(timeout);
  }
}
