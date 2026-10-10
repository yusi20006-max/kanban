# GitHub Actions Agent Runtime E2E

## What this proves

The `Agent Runtime E2E (GitHub-hosted)` workflow starts a disposable PostgreSQL service inside a GitHub-hosted Actions job, applies the repository migrations, seeds an isolated board/card/ready agent, invokes the production `startCardExecution` orchestration to create the task/lease/execution and transition the card to `Agent=running / Workflow=inspect`, then starts the generic worker in `dry-run` mode and verifies that:

- the running execution becomes `succeeded`;
- the task becomes `completed`;
- the lease becomes `released`;
- the agent returns to `ready`;
- the dry-run result reports `mutation: none` and phases `inspect → execute → verify`;
- the card remains at the state created by Start (`Agent=running / Workflow=inspect`) after worker completion;
- a redacted JSON evidence file is uploaded as an Actions artifact for 14 days.

The workflow uses no external database, no deploy platform, no repository write token, and no credentials beyond the ephemeral Actions service. Its test repository reference points to the Kanban test Issue #211. The test invokes the real server-side Start orchestration function but does not click the browser UI; the worker does not call GitHub APIs in dry-run mode.

## What this does not prove

This is an **ephemeral integration E2E**, not a persistent deployment. It verifies the server-side Card Start orchestration plus worker lifecycle, but not the deployed browser click path. The PostgreSQL service and worker disappear when the Actions job ends. Artifacts preserve evidence, not database state. GitHub Pages can host static output but cannot run this server-side TanStack application/API or keep the PostgreSQL-backed worker alive.

Therefore it does not satisfy these #206/#181 criteria:

- a stable, publicly reachable Kanban URL;
- a database shared across independent app/worker deployments and surviving runner termination;
- a user clicking Start in the deployed browser UI;
- an always-on worker continuing after a phone/session stops.

Those require an explicitly authorized persistent host and database. Do not infer a free tier or create billable resources without checking account-specific terms and user authorization.

## Run and inspect

Run the workflow manually from GitHub Actions, or inspect its pull-request check. Download the `agent-runtime-e2e-evidence` artifact. It contains statuses and synthetic fixture IDs only; it does not include database credentials or environment values.

The main CI remains authoritative for typecheck, unit tests, build, and smoke checks. A green ephemeral E2E is additional evidence for the worker's database lifecycle, not a replacement for the deployed UI E2E.


## Browser-level Card Start E2E (Issue #220)

The same workflow additionally installs Chromium and runs `scripts/agent-runtime-browser-e2e.mjs`. That test seeds a synthetic session and fixture in the disposable PostgreSQL, starts the actual Vite/TanStack app, opens the UI with Playwright, clicks the fixture card and the real **شروع** button, then observes the production server-function audit event and the worker's database lifecycle. It uploads a JSON report and screenshot. The session token is generated per run and is never written to logs or the artifact.

A passing run proves the UI action reaches the production Card Start path in an ephemeral, authenticated browser test. It still does not prove a stable deployed URL, durable database across jobs, or execution that continues after the Actions runner exits.
