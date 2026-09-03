import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { CampaignConfig } from './schema.js';
import { db } from '../db/client.js';

/**
 * THE ONLY PLACE the rest of the app reads config from.
 *
 * Phase 2: reads from Supabase campaign_versions table.
 * Falls back to JSON files if DB query fails (for local dev / validate script).
 */

const CAMPAIGN_DIR = process.env.CAMPAIGN_DIR ?? 'campaigns';

// Disable in-memory cache on serverless (each invocation is a fresh process anyway)
const CACHE_ENABLED = process.env.VERCEL !== '1';
const cache = new Map<string, CampaignConfig>();
const key = (id: string, v: number) => `${id}@${v}`;

// Preprocess group archetypes (fix null conditions + ensure each size tier has a fallback), then validate.
function parseConfigRow(raw: Record<string, unknown>, id: string, version: number): CampaignConfig {
  if (Array.isArray((raw?.group as Record<string, unknown>)?.archetypes)) {
    const archetypes = (raw.group as Record<string, unknown[]>).archetypes as Record<string, unknown>[];

    // Fix: replace null conditions with undefined (Zod optional() rejects null)
    // Fix: if a min_group_size tier has no fallback archetype, mark the first one as fallback
    const fixed: Record<string, unknown>[] = archetypes.map((a) => ({
      ...a,
      condition: (a['condition'] ?? undefined) as unknown,
    }));

    const tiers = [...new Set(fixed.map((a) => a['min_group_size'] as number))];
    for (const tier of tiers) {
      const hasFallback = fixed.some((a) => a['min_group_size'] === tier && a['fallback'] === true);
      if (!hasFallback) {
        const idx = fixed.findIndex((a) => a['min_group_size'] === tier);
        if (idx >= 0) fixed[idx] = { ...fixed[idx], fallback: true };
      }
    }

    (raw.group as Record<string, unknown[]>).archetypes = fixed;
  }
  const parsed = CampaignConfig.safeParse(raw);
  if (!parsed.success) {
    console.error('[loader] config parse failed for', id, '@', version, JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new Error('Config validation failed: ' + parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message).join(', '));
  }
  return parsed.data;
}

async function loadVersion(id: string, version: number): Promise<CampaignConfig | null> {
  // Try Supabase first
  try {
    const { data, error } = await db()
      .from('campaign_versions')
      .select('config')
      .eq('campaign_id', id)
      .eq('version', version)
      .single();

    if (!error && data) {
      return parseConfigRow(data.config as Record<string, unknown>, id, version);
    }
  } catch (e) {
    console.error('[loader] DB load failed for', id, '@', version, e instanceof Error ? e.message : e);
    throw e;
  }

  // Fallback: JSON files
  try {
    const files = await readdir(CAMPAIGN_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = JSON.parse(await readFile(path.join(CAMPAIGN_DIR, f), 'utf8'));
      if (raw?.id === id && raw?.version === version) return CampaignConfig.parse(raw);
    }
  } catch (e) {
    // No files either
  }

  return null;
}

// Single round-trip for the common "give me whatever's live" read (via the
// current_campaign_configs view — see supabase/migrations/0011). Returns null
// if the view isn't there yet (older DB) or the campaign has no live version,
// so callers can fall back to the two-query path below.
async function loadCurrentVersionConfig(id: string): Promise<{ version: number; config: CampaignConfig } | null> {
  try {
    const { data, error } = await db()
      .from('current_campaign_configs')
      .select('current_version, config')
      .eq('campaign_id', id)
      .single();

    if (!error && data) {
      return { version: data.current_version, config: parseConfigRow(data.config as Record<string, unknown>, id, data.current_version) };
    }
  } catch (e) {
    // view missing or query failed — caller falls back to loadCurrentVersion + loadVersion
  }
  return null;
}

async function loadCurrentVersion(id: string): Promise<number | null> {
  // Try Supabase first
  try {
    const { data, error } = await db()
      .from('campaigns')
      .select('current_version')
      .eq('id', id)
      .single();

    if (!error && data) {
      return data.current_version;
    }
  } catch (e) {
    // DB not available — fall through to file
  }

  // Fallback: JSON files
  try {
    const files = await readdir(CAMPAIGN_DIR);
    let best: number | null = null;
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = JSON.parse(await readFile(path.join(CAMPAIGN_DIR, f), 'utf8'));
      if (raw?.id === id && typeof raw.version === 'number') {
        best = best === null ? raw.version : Math.max(best, raw.version);
      }
    }
    return best;
  } catch (e) {
    return null;
  }
}

export async function getConfig(id: string, version?: number): Promise<CampaignConfig> {
  if (version === undefined) {
    const current = await loadCurrentVersionConfig(id);
    if (current) {
      cache.set(key(id, current.version), current.config);
      return current.config;
    }
    // View unavailable — fall through to the explicit two-query path below.
  }

  const v = version ?? (await loadCurrentVersion(id));
  if (v === null) throw new Error(`campaign not found: ${id}`);

  const cached = CACHE_ENABLED ? cache.get(key(id, v)) : undefined;
  if (cached) return cached;

  const cfg = await loadVersion(id, v);
  if (!cfg) throw new Error(`campaign version not found: ${id}@${v}`);

  cache.set(key(id, v), cfg);
  return cfg;
}

export async function validateAll(): Promise<{ id: string; version: number }[]> {
  const out: { id: string; version: number }[] = [];

  // Validate from DB
  try {
    const { data } = await db()
      .from('campaign_versions')
      .select('campaign_id, version, config');

    if (data) {
      for (const row of data) {
        const cfg = CampaignConfig.parse(row.config);
        out.push({ id: cfg.id, version: cfg.version });
      }
      if (out.length > 0) return out;
    }
  } catch (e) {
    // Fall through to files
  }

  // Fallback: JSON files
  const files = await readdir(CAMPAIGN_DIR);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const raw = JSON.parse(await readFile(path.join(CAMPAIGN_DIR, f), 'utf8'));
    const cfg = CampaignConfig.parse(raw);
    out.push({ id: cfg.id, version: cfg.version });
  }
  return out;
}

export function clearCache() {
  cache.clear();
}
