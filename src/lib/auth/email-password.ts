/**
 * Self-hosted email/password sign-in backed by this app's Better Auth database.
 *
 * This is the production-safe fallback when per-app OAuth broker credentials
 * have not been provisioned. User accounts and sessions are stored in the
 * same PostgreSQL database as Kanban data; no shared dev identity is used.
 */
export const emailAndPasswordEnabled = true;
