create table if not exists kanban_execution_roles (
  execution_id text primary key references kanban_agent_executions(id) on delete cascade,
  owner_user_id text not null,
  role text not null check (role in ('planner','coder','test','security','review')),
  assigned_agent_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists kanban_execution_roles_owner_role_idx on kanban_execution_roles(owner_user_id,role);
