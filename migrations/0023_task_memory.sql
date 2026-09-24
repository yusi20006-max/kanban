create table if not exists kanban_task_memory (
 id text primary key, owner_user_id text not null, task_id text not null references kanban_agent_tasks(id) on delete cascade,
 execution_id text references kanban_agent_executions(id) on delete cascade, kind text not null, content jsonb not null,
 source_type text not null, source_ref text not null, created_at timestamptz not null default now()
);
create index if not exists kanban_task_memory_lookup on kanban_task_memory(owner_user_id,task_id,created_at desc);
