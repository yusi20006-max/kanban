alter table kanban_cards drop constraint if exists kanban_cards_column_id_check;
alter table kanban_boards add column if not exists project_key text;
alter table kanban_boards add column if not exists description text not null default '';
alter table kanban_boards add column if not exists archived_at timestamptz;

create unique index if not exists kanban_boards_owner_project_key_idx
  on kanban_boards(owner_user_id, project_key)
  where project_key is not null;

create table if not exists kanban_columns (
  id text not null,
  board_id text not null references kanban_boards(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (board_id, id)
);

create table if not exists kanban_labels (
  id text primary key,
  board_id text not null references kanban_boards(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (board_id, name)
);

create table if not exists kanban_card_labels (
  card_id text not null references kanban_cards(id) on delete cascade,
  label_id text not null references kanban_labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create table if not exists kanban_checklist_items (
  id text primary key,
  card_id text not null references kanban_cards(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kanban_comments (
  id text primary key,
  card_id text not null references kanban_cards(id) on delete cascade,
  author_user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists kanban_columns_board_position_idx on kanban_columns(board_id, position);
create index if not exists kanban_checklist_card_position_idx on kanban_checklist_items(card_id, position);
create index if not exists kanban_comments_card_created_idx on kanban_comments(card_id, created_at);

insert into kanban_columns (id, board_id, name, position)
select v.id, b.id, v.name, v.position
from kanban_boards b
cross join (values
  ('todo','Todo',0),
  ('doing','Doing',1),
  ('done','Done',2)
) as v(id,name,position)
on conflict (board_id,id) do nothing;
