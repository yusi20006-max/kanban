create table if not exists kanban_ai_usage (
  id text primary key,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  execution_id text not null references kanban_agent_executions(id) on delete cascade,
  provider text not null,
  model_id text references kanban_ai_models(id),
  input_tokens bigint not null default 0 check (input_tokens>=0),
  output_tokens bigint not null default 0 check (output_tokens>=0),
  units bigint not null default 0 check (units>=0),
  latency_ms bigint check (latency_ms is null or latency_ms>=0),
  estimated_cost numeric(20,8) not null default 0 check (estimated_cost>=0),
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kanban_ai_usage_task_idx on kanban_ai_usage(owner_user_id,task_id,created_at desc);
create index if not exists kanban_ai_usage_execution_idx on kanban_ai_usage(owner_user_id,execution_id);
