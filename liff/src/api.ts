const API_BASE = window.location.origin;

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Read the ID token fresh from the LIFF SDK on every call instead of caching
  // one snapshot for the whole session — the SDK keeps it refreshed internally
  // as long as the user stays logged in, but a string captured once at init
  // time goes stale (and gets rejected as "IdToken expired") well before a
  // long quiz session finishes.
  let idToken: string | null = null;
  try { idToken = liff.getIDToken(); } catch { /* liff not initialized (e.g. preview mode) */ }
  if (idToken) headers['Authorization'] = 'Bearer ' + idToken;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Request failed') as Error & { status: number; code: string };
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }

  return data as T;
}
