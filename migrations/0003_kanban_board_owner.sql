alter table kanban_boards add column if not exists owner_user_id text;

update kanban_boards
set owner_user_id = 'dev-user'
where owner_user_id is null;

alter table kanban_boards alter column owner_user_id set not null;

create index if not exists kanban_boards_owner_idx
  on kanban_boards(owner_user_id);
