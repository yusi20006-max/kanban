alter table kanban_remediation_tasks
  add column if not exists context jsonb not null default '{}'::jsonb;

create index if not exists kanban_remediation_failure_status_idx
  on kanban_remediation_tasks(owner_user_id, failure_signal_id, status);
