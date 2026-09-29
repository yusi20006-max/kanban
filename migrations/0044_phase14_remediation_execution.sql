alter table kanban_remediation_tasks
  add column if not exists correlation_id text,
  add column if not exists retry_after timestamptz,
  add column if not exists terminal_reason text,
  add column if not exists verification_state text check (verification_state in ('recovered','unrecovered','unknown')),
  add column if not exists verification_evidence jsonb,
  add column if not exists verified_at timestamptz;

create index if not exists kanban_remediation_correlation_idx
  on kanban_remediation_tasks(owner_user_id, correlation_id);

create index if not exists kanban_remediation_retry_idx
  on kanban_remediation_tasks(owner_user_id, retry_after)
  where status='active';
