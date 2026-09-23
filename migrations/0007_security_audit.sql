create table if not exists kanban_audit_events (
  id text primary key,
  actor_user_id text not null,
  source text not null,
  action text not null,
  board_id text,
  card_id text,
  request_id text not null,
  outcome text not null,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists kanban_audit_events_actor_created_idx
  on kanban_audit_events(actor_user_id, created_at);
create index if not exists kanban_audit_events_target_created_idx
  on kanban_audit_events(board_id, card_id, created_at);

create table if not exists kanban_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);
