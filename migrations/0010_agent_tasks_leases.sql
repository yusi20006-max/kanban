create table if not exists kanban_agent_tasks (
  id text primary key,
  owner_user_id text not null,
  board_id text references kanban_boards(id) on delete set null,
  card_id text references kanban_cards(id) on delete set null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','claimed','running','blocked','completed','failed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kanban_agent_tasks_owner_status_idx on kanban_agent_tasks(owner_user_id,status);
create table if not exists kanban_agent_leases (
  id text primary key,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  agent_id text not null,
  status text not null default 'active' check (status in ('active','expired','released')),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists kanban_agent_active_lease_task_idx on kanban_agent_leases(task_id) where status='active';
create index if not exists kanban_agent_leases_owner_agent_idx on kanban_agent_leases(owner_user_id,agent_id,status);
create index if not exists kanban_agent_leases_expiry_idx on kanban_agent_leases(expires_at) where status='active';
