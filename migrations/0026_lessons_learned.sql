create table if not exists kanban_lessons_learned (
 id text primary key, owner_user_id text not null, task_id text not null references kanban_agent_tasks(id) on delete cascade,
 execution_id text references kanban_agent_executions(id) on delete cascade, outcome text not null, lesson text not null,
 evidence_type text not null, evidence_ref text not null, created_at timestamptz not null default now()
);
create index if not exists kanban_lessons_lookup on kanban_lessons_learned(owner_user_id,task_id,created_at desc);
