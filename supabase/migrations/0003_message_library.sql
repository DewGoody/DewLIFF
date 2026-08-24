-- Message Library: reusable message templates for the OA
create table message_library (
  id          bigserial primary key,
  name        text not null,
  type        text not null
                check (type in ('text', 'flex', 'image', 'imagemap', 'video')),
  body        text not null default '',
  title       text not null default '',
  cta         text not null default '',
  action      text not null default '',
  image_url   text not null default '',
  usage       text[] not null default '{}',
  areas       jsonb,                          -- imagemap tap areas [{label, action}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index message_library_type_idx on message_library (type);

alter table message_library enable row level security;

-- Seed default messages
insert into message_library (name, type, body, title, cta, action, usage) values
  ('แนะนำควิซ', 'flex', 'ตอบ 5 ข้อ แล้วส่งให้เพื่อนร่วมงานตอบ', 'คู่หูสายไหน', 'เริ่มเลย', 'uri · liff', ARRAY['Keyword']),
  ('การ์ดผลลัพธ์ (auto)', 'flex', '{result.body}', '{result.title}', 'อวดผลให้คนอื่น', 'uri · share', ARRAY['Chat Trigger']),
  ('ต้อนรับ follower ใหม่', 'text', 'สวัสดี 🎯 พิมพ์ว่า "ควิซ" เพื่อเริ่มเล่นได้เลย', '', '', '', ARRAY['Welcome']),
  ('คู่หูตอบแล้ว (push)', 'flex', 'ผลของคุณสองคนพร้อมแล้ว', 'คู่หูตอบแล้ว มาดูผลกัน', 'ดูผลลัพธ์', 'uri · liff', ARRAY['Push']);
