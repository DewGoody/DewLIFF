-- Buddy quiz — initial schema
-- All access goes through the backend using the service_role key.
-- RLS is enabled with zero policies so the anon key can never read these tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- users
create table users (
  line_user_id   text primary key,            -- 'sub' from the verified ID token
  display_name   text,
  is_friend      boolean not null default false,
  followed_at    timestamptz,
  unfollowed_at  timestamptz,
  first_seen_via text,                        -- 'direct' | 'invite' | 'richmenu' | ...
  invited_by     text references users(line_user_id),
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------ campaigns
-- Phase 1 keeps config in JSON files; these tables are ready for phase 2.
create table campaigns (
  id              text primary key,
  type            text not null,
  status          text not null default 'draft'
                    check (status in ('draft','live','ended')),
  current_version integer not null default 1,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Immutable snapshots. Never UPDATE a published row — insert a new version.
create table campaign_versions (
  campaign_id  text not null references campaigns(id) on delete cascade,
  version      integer not null,
  config       jsonb not null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (campaign_id, version)
);

-- ---------------------------------------------------------------- pairs
create table pairs (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    text not null references campaigns(id),
  config_version integer not null,            -- frozen at creation; never changes
  a_user         text not null references users(line_user_id),
  b_user         text references users(line_user_id),
  status         text not null default 'waiting'
                   check (status in ('waiting','completed','expired')),
  result_code    text,
  scores         jsonb,                       -- { a: {...}, b: {...}, combined: {...} }
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  expires_at     timestamptz not null,
  foreign key (campaign_id, config_version)
    references campaign_versions(campaign_id, version),
  constraint no_self_pair check (b_user is null or b_user <> a_user)
);

create index pairs_a_user_idx  on pairs (a_user, created_at desc);
create index pairs_b_user_idx  on pairs (b_user, created_at desc);
create index pairs_pending_idx on pairs (status, expires_at) where status = 'waiting';

-- -------------------------------------------------------------- answers
-- Stored as ids, never as text or index — see the loader notes on versioning.
create table answers (
  pair_id     uuid not null references pairs(id) on delete cascade,
  user_id     text not null references users(line_user_id),
  question_id text not null,
  option_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (pair_id, user_id, question_id)   -- double-tap protection
);

-- --------------------------------------------------------- invite tokens
-- Only the hash is stored, so a database leak yields nothing usable.
create table invite_tokens (
  token_hash text primary key,
  pair_id    uuid not null references pairs(id) on delete cascade,
  used_by    text references users(line_user_id),
  used_at    timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- One live invite per pair at a time.
create unique index invite_tokens_one_open_per_pair
  on invite_tokens (pair_id) where used_at is null;

-- --------------------------------------------------------------- events
-- Every meaningful action. This table is what the dashboard is built from —
-- populate it from day one, it is very cheap now and impossible to backfill.
create table events (
  id         bigserial primary key,
  user_id    text references users(line_user_id),
  pair_id    uuid references pairs(id) on delete set null,
  campaign_id text references campaigns(id),
  type       text not null,   -- open | quiz_start | quiz_done | share_click |
                              -- invite_open | pair_done | follow | unfollow | push_sent
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_type_time_idx on events (type, created_at desc);
create index events_campaign_idx  on events (campaign_id, created_at desc);

-- Webhook deliveries can repeat; dedupe on the id LINE gives you.
create table webhook_seen (
  webhook_event_id text primary key,
  received_at      timestamptz not null default now()
);

-- ------------------------------------------------------------------ RLS
alter table users             enable row level security;
alter table campaigns         enable row level security;
alter table campaign_versions enable row level security;
alter table pairs             enable row level security;
alter table answers           enable row level security;
alter table invite_tokens     enable row level security;
alter table events            enable row level security;
alter table webhook_seen      enable row level security;

-- No policies are created on purpose: anon and authenticated get nothing,
-- and service_role bypasses RLS. Keep the service key server-side only.
