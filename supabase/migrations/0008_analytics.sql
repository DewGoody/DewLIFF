-- Analytics layer: participant hashing, enhanced events, rollups, reports
-- All tables use RLS (no anon access); service_role bypasses RLS.

-- ── Brand salts ───────────────────────────────────────────────────────
-- One stable salt per brand (LINE OA). Used to hash participant IDs.
-- Never delete — losing the salt makes cross-campaign joins impossible.
create table if not exists brand_salts (
  brand_id   text primary key,           -- e.g. the LINE OA channel ID or brand slug
  salt       text not null,              -- 64-char hex random, generated once
  created_at timestamptz not null default now()
);
alter table brand_salts enable row level security;

-- ── Enhanced events columns ───────────────────────────────────────────
-- Backward-compatible additions to the existing events table.
alter table events
  add column if not exists participant_hash text,
  add column if not exists session_id       text,
  add column if not exists source           text,        -- organic | invite | richmenu | push
  add column if not exists ref_participant  text,        -- participant_hash of the referrer
  add column if not exists config_version   integer,
  add column if not exists tier             text,        -- solo | pair | group
  add column if not exists payload          jsonb,
  add column if not exists occurred_at      timestamptz;

create index if not exists events_participant_hash_idx
  on events (participant_hash, campaign_id)
  where participant_hash is not null;

create index if not exists events_session_idx
  on events (session_id)
  where session_id is not null;

-- ── Participants ──────────────────────────────────────────────────────
-- One row per (campaign_id, participant_hash).
-- Created on first interaction, updated on milestone events.
create table if not exists participants (
  campaign_id        text not null references campaigns(id),
  participant_hash   text not null,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  source             text,                               -- first-touch source
  ref_participant    text,                               -- who invited them (hash)
  referral_depth     integer not null default 0,
  result_id          text,                               -- final result / archetype code
  invites_sent       integer not null default 0,
  invites_converted  integer not null default 0,
  ms_spent           integer,                            -- total active ms in quiz
  status             text not null default 'started'
                       check (status in ('started','completed','dropped')),
  tags               jsonb not null default '[]'::jsonb,
  primary key (campaign_id, participant_hash)
);

create index if not exists participants_campaign_idx
  on participants (campaign_id, status);
create index if not exists participants_result_idx
  on participants (campaign_id, result_id)
  where result_id is not null;
create index if not exists participants_ref_idx
  on participants (campaign_id, ref_participant)
  where ref_participant is not null;

alter table participants enable row level security;

-- ── Daily rollups ─────────────────────────────────────────────────────
-- Pre-aggregated per (campaign, date, tier) for fast dashboard queries.
-- Computed nightly by the /api/cron/rollup-daily job.
create table if not exists daily_rollups (
  campaign_id         text not null references campaigns(id),
  date                date not null,
  tier                text not null default 'all',
  opens               integer not null default 0,
  starts              integer not null default 0,
  completions         integer not null default 0,
  pairs_done          integer not null default 0,
  shares              integer not null default 0,
  follows             integer not null default 0,
  unfollows           integer not null default 0,
  new_participants    integer not null default 0,
  invite_clicks       integer not null default 0,
  invite_conversions  integer not null default 0,
  primary key (campaign_id, date, tier)
);

create index if not exists daily_rollups_campaign_date_idx
  on daily_rollups (campaign_id, date desc);

alter table daily_rollups enable row level security;

-- ── Atomic increment helpers ──────────────────────────────────────────
create or replace function increment_participant_invites_sent(
  p_campaign_id text,
  p_hash        text
) returns void language sql security definer as $$
  update participants
  set invites_sent = invites_sent + 1, last_seen_at = now()
  where campaign_id = p_campaign_id and participant_hash = p_hash;
$$;

create or replace function increment_participant_invites_converted(
  p_campaign_id text,
  p_hash        text
) returns void language sql security definer as $$
  update participants
  set invites_converted = invites_converted + 1, last_seen_at = now()
  where campaign_id = p_campaign_id and participant_hash = p_hash;
$$;
