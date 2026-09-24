create table if not exists kanban_project_memory (
 id text primary key, owner_user_id text not null, board_id text, key text not null, value jsonb not null,
 source_type text not null, source_ref text not null, version integer not null default 1, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_user_id,board_id,key,version)
);
create index if not exists kanban_project_memory_lookup on kanban_project_memory(owner_user_id,board_id,key,active);
