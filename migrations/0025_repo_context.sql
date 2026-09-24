create table if not exists kanban_repo_context (
 id text primary key, owner_user_id text not null, task_id text references kanban_agent_tasks(id) on delete cascade,
 repo text not null, branch text not null, commit_sha text not null, relevant_files jsonb not null default '[]'::jsonb,
 contract_version text not null, snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists kanban_repo_context_lookup on kanban_repo_context(owner_user_id,task_id,created_at desc);
