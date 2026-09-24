create table if not exists kanban_remediation_tasks (
 id text primary key,
 owner_user_id text not null,
 failure_signal_id text not null references kanban_failure_signals(id) on delete cascade,
 task_id text not null unique references kanban_agent_tasks(id) on delete cascade,
 status text not null default 'active' check (status in ('active','resolved','cancelled')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create unique index if not exists kanban_remediation_active_signal_idx on kanban_remediation_tasks(owner_user_id,failure_signal_id) where status='active';
