-- Keyword auto-reply rules
create table keyword_rules (
  id          bigserial primary key,
  keyword     text not null,
  campaign_id text references campaigns(id) on delete cascade,
  reply_type  text not null default 'flex_campaign'
                check (reply_type in ('flex_campaign', 'text', 'flex_custom')),
  reply_text  text,            -- for reply_type = 'text'
  reply_flex  jsonb,           -- for reply_type = 'flex_custom'
  enabled     boolean not null default true,
  priority    integer not null default 0,  -- higher = matched first
  created_at  timestamptz not null default now(),
  unique (keyword)             -- one keyword = one rule, no conflicts
);

create index keyword_rules_enabled_idx on keyword_rules (enabled, priority desc);

-- OA settings (welcome message, etc.)
create table oa_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed welcome message
insert into oa_settings (key, value) values
  ('welcome_message', '{"text": "ยินดีต้อนรับ! 🎯\nพิมพ์ \"ควิซ\" เพื่อเริ่มเล่นควิซคู่หู"}'::jsonb);

-- RLS
alter table keyword_rules enable row level security;
alter table oa_settings enable row level security;
