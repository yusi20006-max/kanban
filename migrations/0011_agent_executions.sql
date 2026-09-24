create table if not exists kanban_agent_executions (
  id text primary key,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  agent_id text not null,
  attempt integer not null default 1 check (attempt > 0),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','timed_out','cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  result jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kanban_agent_executions_task_idx on kanban_agent_executions(task_id,attempt);
create index if not exists kanban_agent_executions_agent_idx on kanban_agent_executions(owner_user_id,agent_id,status);
