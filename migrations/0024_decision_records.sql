create table if not exists kanban_decision_records (
 id text primary key, owner_user_id text not null, board_id text, task_id text, title text not null,
 alternatives jsonb not null, rationale text not null, decision text not null, source_type text not null, source_ref text not null,
 finalized_at timestamptz, created_at timestamptz not null default now(),
 check ((finalized_at is null) or finalized_at >= created_at)
);
create index if not exists kanban_decision_lookup on kanban_decision_records(owner_user_id,task_id,created_at desc);
