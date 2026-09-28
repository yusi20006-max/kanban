alter table kanban_failure_signals
  add column if not exists identifier text not null default 'legacy',
  add column if not exists detected_commit_sha text,
  add column if not exists severity text not null default 'error',
  add column if not exists signal_type text not null default 'failure';

alter table kanban_failure_signals
  drop constraint if exists kanban_failure_signals_severity_check;
alter table kanban_failure_signals
  add constraint kanban_failure_signals_severity_check
  check (severity in ('info', 'warning', 'error', 'critical'));

alter table kanban_failure_signals
  drop constraint if exists kanban_failure_signals_signal_type_check;
alter table kanban_failure_signals
  add constraint kanban_failure_signals_signal_type_check
  check (signal_type in ('failure', 'anomaly'));

create index if not exists kanban_failure_signals_identity_idx
  on kanban_failure_signals(owner_user_id, source, identifier, detected_at);
