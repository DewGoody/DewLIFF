# DewLIFF

KimLIFF's buddy-quiz LIFF ("ลานกิจกรรม") — a Node/Express backend + two Vite
frontends (`admin/`, `liff/`) — copied into its own repo/deploy and adapted to
also report finished quiz results to **LineKit**, a separate platform, over a
small server-to-server HTTP call. Cookies/scoring/game logic all stay exactly
as they are in the source project; DewLIFF does not reinvent any of that.

## What this is

- **Backend:** `src/index.ts` (Express). Owns the buddy-quiz domain data —
  campaigns, questions, pairs, answers, scores — in its own Postgres/Supabase
  schema (`supabase/migrations/0001..0007`). This stays the single source of
  truth for KimLIFF's own game rules and trust model; nothing was moved to
  the browser.
- **`liff/`** — the player-facing Vite app, served by Express in production,
  its own Vite dev server in dev.
- **`admin/`** — KimLIFF's campaign/message-manager console. Copied as-is;
  not specially adapted or debugged here (it does build cleanly — see
  Verification below — but isn't the focus of this fork).
- **LineKit integration** — `src/services/lineKitClient.ts`. At the moment a
  quiz result is finalized (same call sites as the existing
  `sendResultCard`/`sendPartnerDonePush` LINE pushes, in `src/services/pair.ts`,
  `src/services/solo.ts`, `src/services/match.ts`), this also `PUT`s the
  result to LineKit's LIFF platform API
  (`/api/liff/{liffId}/session`) so LineKit knows which LINE user got which
  result. It fails soft: if LineKit isn't configured or unreachable, it logs a
  warning and returns — it can never break KimLIFF's own DB write or reply to
  the player.

## Local setup

```bash
npm install
cd admin && npm install && cd ..
cd liff && npm install && cd ..

cp .env.example .env   # fill in real values as you get them (see below)
```

### Database

The app's actual runtime queries go through `@supabase/supabase-js`
(`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, an HTTP/PostgREST call) — the
raw `DATABASE_URL` env var is declared but not queried directly anywhere in
this codebase (only `pg-boss`'s `createBoss()` accepts a connection string,
and it's never actually invoked). So a local Postgres database is useful for
validating the schema/migrations, but does **not** by itself make the app
fully functional without either a real Supabase project or a local Supabase
CLI stack (`supabase start`) providing PostgREST on top of it.

To set up the local database used for schema validation:

```bash
createdb dewliff_dev
for f in supabase/migrations/000{1,2,3,4,5,6,7}_*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d dewliff_dev -f "$f"
done
```

Note: this fork's copy of `supabase/migrations/0007_groups.sql` fixes a real
bug in the `group_summary` view (`jsonb_object_agg(..., count(...))` nests
two aggregate calls, which Postgres rejects) — rewritten with lateral
subqueries, same output shape. All 7 migrations now apply cleanly end to end.

### LINE credentials

Local dev intentionally uses **fake placeholder values** for
`LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` (never
empty strings — `src/env.ts`'s zod schema requires them non-empty and would
crash `loadEnv()` on a truly blank value). The server boots and runs fine;
only outbound calls to LINE's API will fail, which is expected until real
credentials are set up.

### Running

```bash
npm run dev          # Express backend on :8080
cd liff && npm run dev   # Vite dev server for the player-facing app
```

## Connecting to LineKit

Three new env vars control the write-back:

| Var | Meaning |
|---|---|
| `LINEKIT_BASE_URL` | LineKit's own base URL (e.g. `http://localhost:3000` for local dev against LineKit's Next.js dev server) |
| `LINEKIT_LIFF_ID` | The `liff_id` this KimLIFF instance is registered as inside LineKit |
| `LINEKIT_API_KEY` | The server-to-server API key LineKit issued for that registration |

**`LINEKIT_LIFF_ID` and `LINEKIT_API_KEY` are intentionally left blank** in
`.env.example` and the local `.env` — `writeResultToLineKit()` fails soft
(logs a warning, does nothing) whenever they're unset, so the rest of the app
works normally without them.

To get real values: once LineKit's `feat/liff-platform` branch is merged and
running, register this LIFF for real at LineKit's own **`/liff-apps`** admin
screen, using the `channel_id` of whichever LineKit-managed OA this LIFF
should report into. That screen encrypts the API key and shows it exactly
once — copy it into this project's `.env` at that point. (No script or agent
should ever type a real API key into LineKit's database directly; that
bypasses the one safeguard this whole flow exists to provide.)

## Security note

The original source project (`KimLIFF/laan-kijjakam`, a different repo) has
real, live secrets committed into its own `.env.example` (Supabase DB
password, Supabase service-role JWT, LINE channel secret, LINE channel access
token). None of that was copied here — this repo's `.env.example` and `.env`
contain only placeholders / local-only fake values. If you have access to
that other repo, consider rotating those credentials.

## Deploy

Deployed separately from LineKit via this repo's own Vercel project
(`vercel.json`). Set the real env vars (Supabase, LINE, and the LineKit ones
above) in Vercel once they exist.
