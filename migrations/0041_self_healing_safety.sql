create table if not exists kanban_self_healing_safety (
 owner_user_id text primary key,
 max_attempts integer not null default 5 check (max_attempts between 1 and 100),
 max_loop_steps integer not null default 10 check (max_loop_steps between 1 and 1000),
 kill_switch boolean not null default false,
 protected_branches jsonb not null default '[\"main\",\"master\"]'::jsonb,
 updated_at timestamptz not null default now()
);
