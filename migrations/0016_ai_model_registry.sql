create table if not exists kanban_ai_models (
  id text primary key,
  provider text not null,
  model text not null,
  display_name text not null,
  capabilities jsonb not null default '{}'::jsonb,
  availability text not null default 'unknown' check (availability in ('available','degraded','unavailable','unknown')),
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, model)
);
create index if not exists kanban_ai_models_provider_idx on kanban_ai_models(provider, enabled);
