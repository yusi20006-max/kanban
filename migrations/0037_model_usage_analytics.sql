create index if not exists kanban_ai_usage_owner_created_idx on kanban_ai_usage(owner_user_id,created_at,provider,model_id);
create index if not exists kanban_ai_usage_execution_created_idx on kanban_ai_usage(execution_id,created_at);
