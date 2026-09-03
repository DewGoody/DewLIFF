#!/usr/bin/env tsx
/**
 * Publish a campaign JSON file to Supabase.
 * Usage: tsx scripts/publish-campaign.ts campaigns/jbti.json
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  'Content-Type': 'application/json',
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Prefer': 'resolution=merge-duplicates',
};

async function upsert(table: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${table} upsert failed: ${await res.text()}`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/publish-campaign.ts <path-to-config.json>');
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(file, 'utf8'));
  const id: string = raw.id;
  const version: number = raw.version ?? 1;

  console.log(`Publishing campaign "${id}" v${version}...`);

  await upsert('campaigns', { id, type: 'buddy_quiz', status: 'live', current_version: version });
  await upsert('campaign_versions', { campaign_id: id, version, config: raw, published_at: new Date().toISOString() });

  console.log(`✓ "${id}" v${version} is now live`);
}

main().catch((e) => { console.error(e); process.exit(1); });
