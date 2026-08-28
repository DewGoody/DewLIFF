import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  LINE_CHANNEL_ID: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),

  LIFF_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().default('https://liff.line.me'),

  LINE_API_BASE: z.string().url().default('https://api.line.me'),
  CRON_SECRET: z.string().default('cron-local'),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;
  _env = EnvSchema.parse(process.env);
  return _env;
}

export function env(): Env {
  if (!_env) throw new Error('loadEnv() has not been called yet');
  return _env;
}

/**
 * This deployment's own public base URL (e.g. for building absolute image URLs
 * LINE's servers fetch, like /api/og). DewLIFF is deployed as its own separate
 * Vercel project from KimLIFF's, so this must never hardcode KimLIFF's domain
 * (laan-kijjakam.vercel.app) the way some of KimLIFF's own code does.
 *
 * Resolution order:
 *  1. APP_BASE_URL — explicit override, set this in Vercel if you want a custom domain.
 *  2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL — set automatically by Vercel for
 *     every deployment (production and preview alike), so this self-configures
 *     correctly on whatever domain this project actually deploys to.
 *  3. http://localhost:${PORT} — local dev fallback (LINE can't reach this anyway;
 *     only matters for code paths that build a URL without actually pushing it).
 */
export function getAppBaseUrl(): string {
  const override = process.env.APP_BASE_URL;
  if (override) return override.replace(/\/+$/, '');

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;

  return `http://localhost:${process.env.PORT || 8080}`;
}
