create table if not exists kanban_agents (
  id text primary key,
  owner_user_id text not null,
  name text not null,
  capabilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'registered' check (status in ('registered','ready','busy','stale','offline','disabled')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, id)
);
create index if not exists kanban_agents_owner_status_idx on kanban_agents(owner_user_id, status);
create index if not exists kanban_agents_last_seen_idx on kanban_agents(last_seen_at);
