create table if not exists kanban_orchestration_plans (
  id text primary key,
  owner_user_id text not null,
  title text not null,
  source_task_id text references kanban_agent_tasks(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','running','completed','failed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists kanban_orchestration_plan_nodes (
  id text primary key,
  owner_user_id text not null,
  plan_id text not null references kanban_orchestration_plans(id) on delete cascade,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  role text check (role in ('planner','coder','test','security','review')),
  acceptance_criteria jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  unique(plan_id,task_id)
);
create table if not exists kanban_orchestration_dependencies (
  plan_id text not null references kanban_orchestration_plans(id) on delete cascade,
  owner_user_id text not null,
  task_id text not null references kanban_agent_tasks(id) on delete cascade,
  depends_on_task_id text not null references kanban_agent_tasks(id) on delete cascade,
  primary key(plan_id,task_id,depends_on_task_id),
  check(task_id<>depends_on_task_id)
);
create index if not exists kanban_orchestration_plans_owner_idx on kanban_orchestration_plans(owner_user_id);
create index if not exists kanban_orchestration_nodes_plan_idx on kanban_orchestration_plan_nodes(plan_id,position);
