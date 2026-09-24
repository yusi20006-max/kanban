create table if not exists kanban_orchestration_schedule_events (
  id text primary key,
  owner_user_id text not null,
  plan_id text not null references kanban_orchestration_plans(id) on delete cascade,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  agent_id text not null,
  outcome text not null check (outcome in ('claimed','blocked','duplicate')),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists kanban_orchestration_schedule_events_task_idx on kanban_orchestration_schedule_events(task_id,created_at desc);
