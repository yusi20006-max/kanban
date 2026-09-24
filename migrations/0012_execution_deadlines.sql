alter table kanban_agent_executions add column if not exists deadline_at timestamptz;
create index if not exists kanban_agent_executions_deadline_idx on kanban_agent_executions(deadline_at) where status='running';
