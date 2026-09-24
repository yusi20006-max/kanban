# GitHub synchronization contract

GitHub remains the source of truth. Kanban stores references and the latest observed snapshot.

A refresh deterministically selects the workflow run with the newest `updated_at` (falling back to `created_at`). Consumers should treat a snapshot as stale when its `github_synced_at` age exceeds `GITHUB_SYNC_STALE_MS`, defaulting to 300000 ms.

Normalized transport classes are:
- `GITHUB_AUTH`
- `GITHUB_FORBIDDEN`
- `GITHUB_NOT_FOUND`
- `GITHUB_RATE_LIMIT`
- `GITHUB_TRANSIENT`

Other HTTP statuses retain their explicit `GITHUB_HTTP_<status>` code.
