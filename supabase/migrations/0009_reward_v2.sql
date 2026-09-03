-- Reward system v2: triggers, delivery, entitlements, brand separation

-- ── 1. New pool types ──────────────────────────────────────────────────────
alter type reward_pool_type add value if not exists 'physical';
alter type reward_pool_type add value if not exists 'webhook';

-- ── 2. Enrich reward_pools ─────────────────────────────────────────────────
alter table reward_pools
  add column if not exists brand_id       text,
  add column if not exists gives          text not null default 'reward'
    check (gives in ('reward', 'entitlement')),
  add column if not exists claim_mode     text not null default 'auto'
    check (claim_mode in ('auto', 'manual')),
  add column if not exists max_claims_per_user integer not null default 1,
  add column if not exists expiry_mode    text not null default 'never'
    check (expiry_mode in ('never', 'days', 'campaign_end')),
  add column if not exists expiry_days    integer,
  add column if not exists daily_cap      integer,
  add column if not exists stock_total    integer,
  add column if not exists stock_remaining integer;

create index if not exists reward_pools_brand_id on reward_pools(brand_id);

-- ── 3. reward_triggers — maps campaign events to pools ─────────────────────
create table if not exists reward_triggers (
  id           uuid primary key default gen_random_uuid(),
  pool_id      uuid not null references reward_pools(id) on delete cascade,
  campaign_id  text references campaigns(id) on delete cascade,
  -- trigger_type: quiz_complete | pair_milestone | group_complete | checkin | push
  trigger_type text not null,
  -- condition jsonb — trigger-specific params, e.g. { "pairs_required": 3 }
  condition    jsonb not null default '{}',
  units_granted integer not null default 1,
  enabled      boolean not null default true,
  label        text,                          -- display label shown to user
  created_at   timestamptz not null default now()
);

create index if not exists reward_triggers_campaign on reward_triggers(campaign_id);
create index if not exists reward_triggers_pool    on reward_triggers(pool_id);

-- ── 4. Enrich reward_claims — delivery + trigger ref + status ──────────────
alter table reward_claims
  add column if not exists trigger_id      uuid references reward_triggers(id) on delete set null,
  add column if not exists status          text not null default 'issued'
    check (status in ('issued', 'claimed', 'redeemed', 'expired')),
  add column if not exists delivery_mode   text
    check (delivery_mode in ('digital', 'onsite', 'delivery')),
  add column if not exists address         jsonb,
  add column if not exists delivery_status text
    check (delivery_status in ('pending', 'approved', 'shipped', 'delivered', 'cancelled')),
  add column if not exists tracking_number text,
  add column if not exists expires_at      timestamptz,
  add column if not exists admin_note      text;

create index if not exists reward_claims_status on reward_claims(status);
create index if not exists reward_claims_delivery on reward_claims(delivery_status) where delivery_status is not null;

-- ── 5. entitlements — ticket system for raffle/draw (Phase 3 schema) ───────
create table if not exists entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references users(line_user_id) on delete cascade,
  pool_id     uuid not null references reward_pools(id) on delete cascade,
  trigger_id  uuid references reward_triggers(id) on delete set null,
  units       integer not null default 1,
  -- source_type: quiz | checkin | receipt | oa_activity | push
  source_type text not null default 'quiz',
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz,
  used_at     timestamptz
);

create index if not exists entitlements_user_pool on entitlements(user_id, pool_id);
create index if not exists entitlements_pool      on entitlements(pool_id);
