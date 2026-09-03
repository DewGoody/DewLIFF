#!/usr/bin/env tsx
/**
 * Seed all campaign JSON files from campaigns/ into Supabase.
 * Inserts into both `campaigns` and `campaign_versions` tables.
 *
 * Usage:
 *   tsx scripts/seed-campaigns.ts              # seeds all campaigns/*.json
 *   tsx scripts/seed-campaigns.ts jbti         # seeds only campaigns/jbti.json
 */
import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

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

async function seedFile(filePath: string) {
  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  const id: string = raw.id;
  const version: number = raw.version ?? 1;
  const type: string = raw.type ?? 'buddy_quiz';

  console.log(`  Seeding "${id}" v${version} from ${path.basename(filePath)}...`);

  await upsert('campaigns', {
    id,
    type,
    status: 'live',
    current_version: version,
  });

  await upsert('campaign_versions', {
    campaign_id: id,
    version,
    config: raw,
    published_at: new Date().toISOString(),
  });

  console.log(`  ✓ "${id}" v${version} seeded`);
}

async function main() {
  const filter = process.argv[2]; // optional: campaign id to seed only one
  const dir = 'campaigns';
  const files = (await readdir(dir))
    .filter(f => f.endsWith('.json') && !f.includes('template'))
    .filter(f => !filter || f.startsWith(filter));

  if (files.length === 0) {
    console.error(`No campaign JSON files found${filter ? ` matching "${filter}"` : ''}`);
    process.exit(1);
  }

  console.log(`Seeding ${files.length} campaign(s)...`);
  for (const f of files) {
    await seedFile(path.join(dir, f));
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
