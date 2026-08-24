-- Permanent per-user answers for each campaign.
-- A answers once; the link can be shared to unlimited Bs.
create table user_quiz_answers (
  user_id     text not null references users(line_user_id),
  campaign_id text not null references campaigns(id) on delete cascade,
  question_id text not null,
  option_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, campaign_id, question_id)
);

create index user_quiz_answers_user_campaign on user_quiz_answers (user_id, campaign_id);

alter table user_quiz_answers enable row level security;
