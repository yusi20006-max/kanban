create table if not exists kanban_orchestration_recovery_events (
  id text primary key,
  owner_user_id text not null,
  plan_id text,
  task_id text,
  execution_id text,
  event_type text not null check (event_type in ('lease_expired','execution_timed_out','task_requeued')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists kanban_orchestration_recovery_once_idx
  on kanban_orchestration_recovery_events(owner_user_id,coalesce(execution_id,''),event_type)
  where execution_id is not null;
