create table if not exists kanban_orchestration_gates (
  id text primary key,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  gate_type text not null check (gate_type in ('review','security')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','blocked')),
  required boolean not null default true,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists kanban_orchestration_gates_task_idx on kanban_orchestration_gates(owner_user_id,task_id,status);
