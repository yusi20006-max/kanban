create table if not exists kanban_agent_delegations (
  id text primary key,
  owner_user_id text not null,
  parent_task_id text not null references kanban_agent_tasks(id) on delete cascade,
  child_task_id text not null references kanban_agent_tasks(id) on delete cascade,
  parent_execution_id text references kanban_agent_executions(id) on delete set null,
  child_execution_id text references kanban_agent_executions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(parent_task_id, child_task_id)
);
create index if not exists kanban_agent_delegations_owner_idx on kanban_agent_delegations(owner_user_id);
create index if not exists kanban_agent_delegations_parent_idx on kanban_agent_delegations(parent_task_id);
create index if not exists kanban_agent_delegations_child_idx on kanban_agent_delegations(child_task_id);
