alter table kanban_cards add column if not exists github_repo text;
alter table kanban_cards add column if not exists github_issue_number integer;
alter table kanban_cards add column if not exists github_pr_number integer;
alter table kanban_cards add column if not exists github_commit_sha text;
alter table kanban_cards add column if not exists github_workflow_run_id bigint;
alter table kanban_cards add column if not exists github_issue_state text;
alter table kanban_cards add column if not exists github_pr_state text;
alter table kanban_cards add column if not exists github_pr_merged boolean;
alter table kanban_cards add column if not exists github_ci_state text;
alter table kanban_cards add column if not exists github_synced_at timestamptz;

create index if not exists kanban_cards_github_issue_idx
  on kanban_cards(github_repo, github_issue_number)
  where github_issue_number is not null;

create index if not exists kanban_cards_github_pr_idx
  on kanban_cards(github_repo, github_pr_number)
  where github_pr_number is not null;
