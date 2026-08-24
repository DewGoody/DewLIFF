-- ── Group feature ────────────────────────────────────────────────────────────
--
-- Two tables:
--   groups        — one row per group session
--   group_members — one row per user-join (tracks axis scores at join time)
--
-- Reward batches (rolling mode) are tracked via batch_no on both tables.
-- When a batch fills, the backend locks those rows and issues reward_claims.
--
-- Group result (archetype) is computed at read-time from member axis_scores;
-- it is NOT stored so it self-updates as members join (until result_locks_at).
-- After locking, locked_archetype_code stores the final answer.
-- ─────────────────────────────────────────────────────────────────────────────

create type group_overflow_mode as enum ('hard_cap', 'rolling', 'creator_pick');
create type group_status as enum ('open', 'reward_locked', 'closed');

-- ── groups ───────────────────────────────────────────────────────────────────
create table groups (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     text not null references campaigns(id) on delete cascade,
  created_by      text not null references users(line_user_id) on delete cascade,

  -- mirrors config at creation time (denormalised for fast reads)
  overflow_mode   group_overflow_mode not null default 'rolling',
  min_members     int not null default 2,
  reward_members  int not null default 5,
  max_members     int not null default 50,
  batch_size      int,                      -- only for rolling

  -- current state
  status          group_status not null default 'open',
  current_batch   int not null default 1,   -- rolling batch counter

  -- locked once result_locks_at is reached (0 = never)
  locked_archetype_code text,
  locked_at       timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on groups(campaign_id);
create index on groups(created_by);
create index on groups(campaign_id, status);

-- ── group_members ─────────────────────────────────────────────────────────────
create table group_members (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  user_id         text not null references users(line_user_id) on delete cascade,

  -- quiz result snapshot at time of joining
  top_axis        text not null,             -- dominant axis id
  axis_scores     jsonb not null default '{}', -- { axis_id: normalised_score 0-1 }

  -- which reward batch this member belongs to (rolling mode)
  batch_no        int not null default 1,

  -- whether this member has been selected by creator (creator_pick mode)
  creator_picked  boolean not null default false,

  -- whether this member has claimed their group reward
  reward_claimed  boolean not null default false,
  reward_claim_id uuid references reward_claims(id) on delete set null,

  joined_at       timestamptz not null default now(),

  unique(group_id, user_id)
);

create index on group_members(group_id);
create index on group_members(user_id);
create index on group_members(group_id, batch_no);
-- fast lookup: unclaimed members in a completed batch
create index on group_members(group_id, batch_no, reward_claimed)
  where reward_claimed = false;

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- only add trigger if it doesn't already exist (idempotent)
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'groups_updated_at'
  ) then
    create trigger groups_updated_at
      before update on groups
      for each row execute function set_updated_at();
  end if;
end $$;

-- ── helper view: group summary ───────────────────────────────────────────────
-- Returns per-group member counts and axis distribution for quick reads.
--
-- NB (DewLIFF fork): the original single-query `group by g.id` version nested
-- jsonb_object_agg(..., count(...)) — two aggregates, one inside the other —
-- which Postgres rejects ("aggregate function calls cannot be nested"). Rewritten
-- with two LATERAL subqueries that each pre-aggregate to one row per group, so no
-- aggregate call ever wraps another. Same output shape as before.
create or replace view group_summary as
select
  g.id                                       as group_id,
  g.campaign_id,
  g.status,
  g.current_batch,
  g.overflow_mode,
  g.min_members,
  g.reward_members,
  g.max_members,
  g.locked_archetype_code,
  coalesce(counts.total_members, 0)          as total_members,
  coalesce(counts.current_batch_members, 0)  as current_batch_members,
  -- axis distribution: { axis_id: member_count }
  coalesce(axis.axis_counts, '{}'::jsonb)    as axis_counts,
  g.created_at,
  g.updated_at
from groups g
left join lateral (
  select
    count(*)::int as total_members,
    count(*) filter (where m.batch_no = g.current_batch)::int as current_batch_members
  from group_members m
  where m.group_id = g.id
) counts on true
left join lateral (
  select jsonb_object_agg(t.top_axis, t.cnt) as axis_counts
  from (
    select m.top_axis, count(*) as cnt
    from group_members m
    where m.group_id = g.id and m.top_axis is not null
    group by m.top_axis
  ) t
) axis on true;
