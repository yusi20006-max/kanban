# Production Deployment Runbook

## Architecture

- Frontend and Kanban API: the TanStack Start/Nitro application.
- Production database: PostgreSQL via `DATABASE_URL`; local/preview uses PGLite.
- Authentication: Better Auth with email/password stored in the same PostgreSQL database. OAuth federation is optional and requires per-app broker credentials.
- MCP: the same domain/tool registry is available through stdio and the independent Streamable HTTP sidecar at `/mcp`.
- PWA: dynamic manifest plus a conservative service worker that caches only the app shell/navigation/CSS. Mutating API calls are never queued offline.
- Health: `/health/live` is process liveness; `/health/ready` verifies database readiness.

## Required production environment

Set these on the deployed application service:

- `DATABASE_URL` — Neon pooled PostgreSQL connection string.
- `BETTER_AUTH_SECRET` — unique, high-entropy secret; keep it stable across deploys and restarts.
- `BETTER_AUTH_URL` — exact public origin, e.g. `https://kanban-web-production-692a.up.railway.app`.
- `VITE_AUTH_ENABLED=true` — keep the browser and server auth modes aligned.
- `APP_VERSION`
- `VITE_PUBLIC_HOSTNAME`

Email/password sign-in is enabled by the application. The deploy migrator applies `migrations/0001_auth.sql` to create Better Auth's `user`, `session`, `account` and `verification` tables. Do not apply schema SQL manually when the migration runner can apply it.

Optional integrations:

- `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET` — only when enabling the Google/X OAuth broker buttons; use credentials provisioned for this production origin, not the live-preview client.
- `GITHUB_TOKEN` — server-only, minimum required GitHub permissions; needed for GitHub integration features.
- `KANBAN_MCP_TOKEN`, `KANBAN_MCP_USER_ID`, `MCP_HOST`, `MCP_PORT`, `MCP_ALLOWED_HOST`, `MCP_ALLOWED_ORIGIN` — only if deploying the separate MCP HTTP sidecar.

Never expose server-only variables through `VITE_*`; the only variable above intended for the client bundle is the non-secret `VITE_AUTH_ENABLED` flag. Never log or paste secret values into issues, PRs or deployment output.

## Deploy sequence

1. Configure the production variables above before exposing the deployment.
2. Build the application.
3. Run database migrations.
4. Start the application.
5. Verify `/health/live` and `/health/ready`.
6. Register an account at `/login`, sign in, and create a test card from the deployed UI.
7. Verify the card row exists in Neon and survives an application restart.
8. If the MCP HTTP sidecar is deployed, verify authenticated `POST /mcp` with a real MCP client and confirm unauthenticated `/mcp` returns 401.
9. Verify PWA installability on mobile and desktop.
10. Run the final Agent → MCP → Kanban → GitHub → CI → Merge → Kanban smoke.

CI must not receive production credentials.

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
- Authentication/session failures.
- GitHub authentication/rate-limit failures.
- Audit-event error outcomes.

The persistent `kanban_audit_events` table is the source for mutation traceability; external log/metric shipping can be added at the deployment edge without changing the application contract.

## MCP security boundary

The HTTP MCP sidecar uses a server-only bearer token and binds to an explicit host. It is suitable for the current single-principal deployment model. A multi-user/public MCP deployment should replace the static token verifier with a dedicated OAuth resource-server verifier before exposing it broadly.
