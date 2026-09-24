create table if not exists kanban_agent_execution_events (
  id text primary key,
  owner_user_id text not null,
  task_id text references kanban_agent_tasks(id) on delete cascade,
  execution_id text references kanban_agent_executions(id) on delete cascade,
  agent_id text,
  event_type text not null,
  from_state text,
  to_state text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kanban_agent_events_task_idx on kanban_agent_execution_events(owner_user_id,task_id,created_at,id);
create index if not exists kanban_agent_events_execution_idx on kanban_agent_execution_events(owner_user_id,execution_id,created_at,id);
