-- Reward pools (admin-managed library)
create type reward_pool_type as enum ('code_pool', 'single_code', 'raffle', 'voucher_link', 'points_bonus');
create type reward_pool_status as enum ('active', 'exhausted', 'expired', 'draft');

create table reward_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type reward_pool_type not null,
  description text,
  expires_at timestamptz,
  meta jsonb not null default '{}',
  status reward_pool_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual codes inside a pool (used for code_pool and raffle types)
create table reward_codes (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references reward_pools(id) on delete cascade,
  code text not null,
  claimed_by text references users(line_user_id) on delete set null,
  claimed_at timestamptz,
  claim_id uuid,
  created_at timestamptz not null default now(),
  unique(pool_id, code)
);

-- Issued rewards to users
create table reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(line_user_id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  pool_id uuid not null references reward_pools(id),
  milestone_key text not null,
  code_id uuid references reward_codes(id),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  meta jsonb not null default '{}',
  unique(user_id, campaign_id, milestone_key)
);

-- Back-reference from code to claim
alter table reward_codes add constraint fk_code_claim foreign key (claim_id) references reward_claims(id) on delete set null;

-- Index for claim lookups
create index on reward_claims(user_id, campaign_id);
create index on reward_codes(pool_id) where claimed_by is null;
