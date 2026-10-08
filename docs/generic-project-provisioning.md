# Generic Project Provisioning

Kanban project provisioning is configuration-driven. A future project is added by creating a `projects/<project-key>/board.json` that satisfies `projects/board.schema.json`; project-specific provisioning code is not required.

## Operational flow

project config -> generic provisioner -> same-runtime verification -> GitHub reference verification -> idempotency check -> project-derived rollout acceptance

The reusable implementation lives in:

- `scripts/project-provisioning-contract.mjs` — validates the generic contract.
- `scripts/project-provisioning-engine.mjs` — creates/updates the board, columns and cards and verifies the resulting state.
- `scripts/provision-project.mjs` — GitHub Actions entrypoint.
- `scripts/verify-provisioning-rollout.mjs` — final acceptance gate; derives expected counts and workflow metadata from the selected project configuration.
- `.github/workflows/kanban-provision.yml` — generic workflow; derives the referenced repository from the selected project configuration.

## Adding a project

1. Create `projects/<project-key>/board.json`.
2. Set `project.key`, `project.name`, `project.repository`, `ownerUserId`, columns and GitHub-backed cards.
3. Validate the configuration through the existing contract tests.
4. Push the configuration to `main`. The generic workflow resolves the single changed `projects/*/board.json`.
5. The workflow derives the referenced repository from `project.repository`, provisions the project, verifies the repository was not mutated, and runs rollout acceptance against the same configuration.
6. Inspect the workflow summary. A successful rollout must report `status: passed`, configuration-derived column/card counts, GitHub references verified, `idempotency: passed`, and configuration-derived workflow metadata.
7. For manual runs, supply the desired `projects/*/board.json` path through the workflow's `workflow_dispatch` input.

No project-specific migration, provisioning script, acceptance assertion, or reference repository should be added for a new project.

## Reference regression

Yasin Chess remains a regression fixture in the automated test matrix through `projects/yasin-chess/board.json`. Its expected 10-column / 7-card / Issue #422 behavior belongs to that fixture and its tests, not to the generic workflow.

## Change boundaries

GitHub remains the source of truth for repository, Issue, PR and CI state. Kanban stores references and project metadata rather than duplicating GitHub state.

A project rollout must not mutate the referenced project repository. Provisioning changes only Kanban runtime state and its own repository configuration.

## CI and acceptance

The repository CI must remain green. The provisioning workflow additionally runs the project-independent rollout acceptance script and compares the selected project's referenced repository metadata before and after provisioning.

The generalized provisioning architecture introduced by Issues #167–#171 is now fully project-independent at the rollout acceptance layer.
