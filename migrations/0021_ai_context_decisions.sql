create table if not exists kanban_ai_context_decisions (
  id text primary key,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  selected_sources jsonb not null,
  requested_sources jsonb not null,
  capabilities jsonb not null,
  decision_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists kanban_ai_context_task_idx on kanban_ai_context_decisions(owner_user_id,task_id,created_at desc);
