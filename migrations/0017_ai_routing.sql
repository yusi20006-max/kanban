create table if not exists kanban_ai_routing_decisions (
  id text primary key,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  selected_model_id text not null references kanban_ai_models(id),
  requirements jsonb not null,
  candidates jsonb not null,
  decision_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists kanban_ai_routing_task_idx on kanban_ai_routing_decisions(owner_user_id,task_id,created_at desc);
create unique index if not exists kanban_ai_routing_repro_idx on kanban_ai_routing_decisions(owner_user_id,task_id,decision_hash);
