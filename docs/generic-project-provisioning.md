# Generic Project Provisioning

Kanban project provisioning is configuration-driven. A future project is added by creating a `projects/<project-key>/board.json` that satisfies `projects/board.schema.json`; project-specific provisioning code is not required.

## Operational flow

project config -> generic provisioner -> same-runtime verification -> GitHub reference verification -> idempotency check -> rollout acceptance

The reusable implementation lives in:

- `scripts/project-provisioning-contract.mjs` — validates the generic contract.
- `scripts/project-provisioning-engine.mjs` — creates/updates the board, columns and cards and verifies the resulting state.
- `scripts/provision-project.mjs` — GitHub Actions entrypoint.
- `scripts/verify-provisioning-rollout.mjs` — final acceptance gate for the reference rollout.
- `.github/workflows/kanban-provision.yml` — generic workflow.

## Adding a project

1. Create `projects/<project-key>/board.json`.
2. Set `project.key`, `project.name`, `project.repository`, `ownerUserId`, columns and GitHub-backed cards.
3. Validate the configuration through the existing contract tests.
4. Push the configuration to `main`. The generic workflow resolves the single changed `projects/*/board.json`.
5. Inspect the workflow summary. A successful rollout must report `status: passed`, configured column/card counts, GitHub references verified, `idempotency: passed`, and expected workflow metadata.
6. For manual runs, use the workflow's `workflow_dispatch` input `project_config`.

No project-specific migration or provisioning script should be added for a new project.

## Reference rollout: Yasin Chess

The reference configuration is `projects/yasin-chess/board.json`.

The accepted result is:

- 10 columns
- 7 initial cards for Issues #409–#414 and #422
- PR #423 linked to Issue #422
- 7 GitHub references verified
- idempotency passed
- Issue #422 remains `agentState=idle`, `workflowPhase=inspect`
- `yusi20006-max/yasin-chess` remains untouched by provisioning.

The provisioner uses process-local in-memory PGlite. Provisioning and verification therefore run in the same Node process/runtime. The workflow proves the result before the process exits; the runtime database itself is not intended to be durable state.

## Change boundaries

GitHub remains the source of truth for repository, Issue, PR and CI state. Kanban stores references and project metadata rather than duplicating GitHub state.

A project rollout must not mutate the referenced project repository. Provisioning changes only Kanban runtime state and its own repository configuration.

## CI and acceptance

The repository CI must remain green. The provisioning workflow additionally runs the rollout acceptance script and compares the reference repository metadata before and after provisioning.

This completes the generalized provisioning architecture introduced by Issues #167–#171.
