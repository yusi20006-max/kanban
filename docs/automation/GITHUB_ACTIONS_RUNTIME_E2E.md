# GitHub Actions Agent Runtime E2E

## What this proves

The `Agent Runtime E2E (GitHub-hosted)` workflow starts a disposable PostgreSQL service inside a GitHub-hosted Actions job, applies the repository migrations, seeds an isolated Kanban card/task/lease/execution fixture, starts the generic worker in `dry-run` mode, and verifies that:

- the running execution becomes `succeeded`;
- the task becomes `completed`;
- the lease becomes `released`;
- the agent returns to `ready`;
- the dry-run result reports `mutation: none` and phases `inspect → execute → verify`;
- the fixture card's workflow/agent state remains unchanged;
- a redacted JSON evidence file is uploaded as an Actions artifact for 14 days.

The workflow uses no external database, no deploy platform, no repository write token, and no credentials beyond the ephemeral Actions service. Its test repository reference points to the Kanban test Issue #211; the worker does not call GitHub APIs in dry-run mode.

## What this does not prove

This is an **ephemeral integration E2E**, not a persistent deployment. The PostgreSQL service and worker disappear when the Actions job ends. Artifacts preserve evidence, not database state. GitHub Pages can host static output but cannot run this server-side TanStack application/API or keep the PostgreSQL-backed worker alive.

Therefore it does not satisfy these #206/#181 criteria:

- a stable, publicly reachable Kanban URL;
- a database shared across independent app/worker deployments and surviving runner termination;
- a user clicking Start in the deployed browser UI;
- an always-on worker continuing after a phone/session stops.

Those require an explicitly authorized persistent host and database. Do not infer a free tier or create billable resources without checking account-specific terms and user authorization.

## Run and inspect

Run the workflow manually from GitHub Actions, or inspect its pull-request check. Download the `agent-runtime-e2e-evidence` artifact. It contains statuses and synthetic fixture IDs only; it does not include database credentials or environment values.

The main CI remains authoritative for typecheck, unit tests, build, and smoke checks. A green ephemeral E2E is additional evidence for the worker's database lifecycle, not a replacement for the deployed UI E2E.
