alter table kanban_cards add column if not exists workflow_phase text not null default 'inspect';
alter table kanban_cards add column if not exists agent_state text not null default 'idle';
alter table kanban_cards add column if not exists workflow_version integer not null default 1;

create table if not exists kanban_workflow_events (
  id text primary key,
  card_id text not null references kanban_cards(id) on delete cascade,
  phase text not null,
  agent_state text not null,
  attempt integer not null default 1,
  result text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists kanban_workflow_events_card_idx
  on kanban_workflow_events(card_id, created_at);
