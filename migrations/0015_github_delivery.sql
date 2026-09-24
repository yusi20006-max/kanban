create table if not exists kanban_github_deliveries (
  id text primary key,
  owner_user_id text not null,
  board_id text not null references kanban_boards(id) on delete cascade,
  card_id text not null references kanban_cards(id) on delete cascade,
  repo text not null,
  issue_number integer,
  branch_name text,
  branch_sha text,
  pr_number integer,
  pr_head_sha text,
  ci_run_id bigint,
  ci_state text,
  ci_observed_at timestamptz,
  merged_commit_sha text,
  verified_at timestamptz,
  verification_state text,
  release_ref text,
  release_observed_at timestamptz,
  remediation_task_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,repo,issue_number),
  unique(owner_user_id,repo,card_id)
);
create index if not exists kanban_github_delivery_pr_idx on kanban_github_deliveries(owner_user_id,repo,pr_number);
create index if not exists kanban_github_delivery_ci_idx on kanban_github_deliveries(owner_user_id,repo,ci_run_id);
