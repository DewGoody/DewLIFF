import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.js';
import WebSocket from 'ws';

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    // @ts-expect-error — polyfill WebSocket for Node < 22
    if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

    _client = createClient(env().SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
