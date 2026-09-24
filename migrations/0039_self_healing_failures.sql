create table if not exists kanban_failure_signals (
 id text primary key,
 owner_user_id text not null,
 task_id text references kanban_agent_tasks(id) on delete cascade,
 execution_id text references kanban_agent_executions(id) on delete cascade,
 board_id text references kanban_boards(id) on delete cascade,
 source text not null check (source in ('execution','ci','check')),
 failure_type text not null,
 fingerprint text not null,
 evidence jsonb not null default '{}'::jsonb,
 detected_at timestamptz not null default now()
);
create index if not exists kanban_failure_signals_owner_detected_idx on kanban_failure_signals(owner_user_id,detected_at);
create unique index if not exists kanban_failure_signals_fingerprint_idx on kanban_failure_signals(owner_user_id,fingerprint);
