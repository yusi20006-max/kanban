create table if not exists kanban_ai_token_health (
  id text primary key,
  owner_user_id text not null,
  provider text not null,
  state text not null check (state in ('healthy','unhealthy','expired','missing','unknown')),
  error_code text,
  expires_at timestamptz,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(owner_user_id,provider)
);
create index if not exists kanban_ai_token_health_state_idx on kanban_ai_token_health(owner_user_id,provider,state);
