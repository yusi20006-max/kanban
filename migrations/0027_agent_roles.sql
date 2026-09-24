create table if not exists kanban_agent_roles (
  id text primary key,
  owner_user_id text not null,
  agent_id text not null references kanban_agents(id) on delete cascade,
  role text not null check (role in ('planner','coder','test','security','review')),
  capabilities jsonb not null default '[]'::jsonb,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,agent_id)
);
create index if not exists kanban_agent_roles_owner_role_idx on kanban_agent_roles(owner_user_id,role);
