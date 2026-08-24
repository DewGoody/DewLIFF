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
