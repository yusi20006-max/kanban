create table if not exists kanban_ai_fallback_attempts (
  id text primary key,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  execution_id text references kanban_agent_executions(id) on delete cascade,
  failed_model_id text not null,
  fallback_model_id text,
  reason text not null,
  retry_safe boolean not null,
  sequence integer not null,
  created_at timestamptz not null default now()
);
create index if not exists kanban_ai_fallback_task_idx on kanban_ai_fallback_attempts(owner_user_id,task_id,created_at desc);
