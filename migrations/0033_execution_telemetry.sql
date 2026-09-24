create table if not exists kanban_execution_telemetry (
  id text primary key,
  owner_user_id text not null,
  task_id text references kanban_agent_tasks(id) on delete cascade,
  execution_id text references kanban_agent_executions(id) on delete cascade,
  agent_id text references kanban_agents(id) on delete set null,
  event_type text not null,
  from_state text,
  to_state text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists kanban_execution_telemetry_owner_time_idx on kanban_execution_telemetry(owner_user_id,occurred_at,id);
create index if not exists kanban_execution_telemetry_task_idx on kanban_execution_telemetry(owner_user_id,task_id,occurred_at,id);
create index if not exists kanban_execution_telemetry_execution_idx on kanban_execution_telemetry(owner_user_id,execution_id,occurred_at,id);
create index if not exists kanban_execution_telemetry_agent_idx on kanban_execution_telemetry(owner_user_id,agent_id,occurred_at,id);
