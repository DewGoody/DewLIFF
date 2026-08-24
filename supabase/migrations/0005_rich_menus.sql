create table rich_menus (
  id          text primary key,              -- e.g. 'main', 'campaign_hub', 'settings'
  name        text not null,
  alias_id    text not null unique,          -- LINE richMenuAliasId e.g. 'richmenu-main'
  line_id     text,                          -- LINE's richMenuId after upload
  size        text not null default 'full'   -- 'full' (2500x1686) or 'compact' (2500x843)
                check (size in ('full', 'compact')),
  layout      text not null default '3x2',   -- '3x2', '3x1', '2x1', '2x2'
  areas       jsonb not null default '[]',   -- array of area configs
  image_url   text,                          -- uploaded background image URL
  is_default  boolean not null default false,
  deployed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table rich_menus enable row level security;
