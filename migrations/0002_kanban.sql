create table if not exists kanban_boards (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kanban_cards (
  id text primary key,
  board_id text not null references kanban_boards(id) on delete cascade,
  column_id text not null check (column_id in ('todo', 'doing', 'done')),
  position integer not null default 0,
  title text not null,
  description text not null default '',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kanban_cards_board_column_position_idx
  on kanban_cards(board_id, column_id, position);

create index if not exists kanban_cards_board_updated_idx
  on kanban_cards(board_id, updated_at);

insert into kanban_boards (id, name)
values ('default', 'جریان')
on conflict (id) do nothing;