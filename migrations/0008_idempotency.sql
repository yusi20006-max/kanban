create table if not exists kanban_idempotency (
  actor_user_id text not null,
  operation_key text not null,
  action text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, operation_key, action)
);

create index if not exists kanban_idempotency_created_idx
  on kanban_idempotency(created_at);

create unique index if not exists kanban_cards_board_column_position_idx on kanban_cards(board_id,column_id,position) where archived_at is null;
