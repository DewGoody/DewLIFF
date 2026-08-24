const API_BASE = window.location.origin;

let idToken: string | null = null;

export function setToken(token: string | null) {
  idToken = token;
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
