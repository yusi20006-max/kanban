create index if not exists kanban_agent_executions_success_time_idx on kanban_agent_executions(owner_user_id,ended_at) where status='succeeded';
create index if not exists kanban_agent_tasks_owner_created_idx on kanban_agent_tasks(owner_user_id,created_at);
