# Production Deployment Runbook

## Architecture

- Frontend and Kanban API: the TanStack Start/Nitro application.
- Production database: PostgreSQL via `DATABASE_URL`; local/preview uses PGLite.
- MCP: the same domain/tool registry is available through stdio and the independent Streamable HTTP sidecar at `/mcp`.
- PWA: dynamic manifest plus a conservative service worker that caches only the app shell/navigation/CSS. Mutating API calls are never queued offline.
- Health: `/health/live` is process liveness; `/health/ready` verifies database readiness.

## Required production environment

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `VITE_AUTH_ENABLED=true`
- `GROK_AUTH_ISSUER`
- `GROK_AUTH_CLIENT_ID`
- `GROK_AUTH_CLIENT_SECRET`
- `GITHUB_TOKEN` (server-only, minimum required GitHub permissions)
- `APP_VERSION`
- `VITE_PUBLIC_HOSTNAME`
- `KANBAN_MCP_TOKEN`
- `KANBAN_MCP_USER_ID`
- `MCP_HOST`
- `MCP_PORT`
- `MCP_ALLOWED_HOST`
- `MCP_ALLOWED_ORIGIN`

Never expose server-only variables through `VITE_*`.

## Deploy sequence

1. Build the application.
2. Run database migrations.
3. Start the application.
4. Start the MCP HTTP sidecar on its own process/container.
5. Verify `/health/live` and `/health/ready`.
6. Verify authenticated `POST /mcp` with a real MCP client.
7. Verify unauthenticated `/mcp` returns 401.
8. Verify PWA installability on mobile and desktop.
9. Run the final Agent → MCP → Kanban → GitHub → CI → Merge → Kanban smoke.

## Backup and restore

Backup:

```bash
DATABASE_URL='...' npm run db:backup
```

Restore is intentionally destructive and requires explicit confirmation:

```bash
DATABASE_URL='...' npm run db:restore -- artifacts/backups/kanban-YYYY-MM-DD.sql --confirm
```

Take a backup before destructive migrations or rollback.

## Rollback

- Keep the previous production application version available at the deployment provider.
- Roll back application code first if the database schema is backward-compatible.
- Never roll back a migration by deleting rows or columns from production without a reviewed reverse migration.
- Restore the latest verified database backup only when the application version requires data restoration.
- Re-run `npm run health:check` after rollback.

## Monitoring

Minimum monitoring targets:

- HTTP 5xx rate.
- `/health/live` availability.
- `/health/ready` availability and database failures.
- API/MCP `RATE_LIMITED` errors.
- GitHub authentication/rate-limit failures.
- Audit-event error outcomes.

The persistent `kanban_audit_events` table is the source for mutation traceability; external log/metric shipping can be added at the deployment edge without changing the application contract.

## MCP security boundary

The HTTP MCP sidecar uses a server-only bearer token and binds to an explicit host. It is suitable for the current single-principal deployment model. A multi-user/public MCP deployment should replace the static token verifier with a dedicated OAuth resource-server verifier before exposing it broadly.
