# Production verification

CI verifies the production-facing contract after build:

1. Start the preview server.
2. Check liveness and readiness.
3. Check the PWA manifest.
4. Check the service-worker asset.
5. Run the existing authenticated MCP HTTP smoke test separately.

Database backup/restore remains a production PostgreSQL operation because `pg_dump`/ `psql` require a real PostgreSQL endpoint. The runbook requires a verified backup before destructive changes and explicit `--confirm` for restore.

Required production variables are documented in `docs/DEPLOYMENT-RUNBOOK.md`. CI does not receive production credentials.
