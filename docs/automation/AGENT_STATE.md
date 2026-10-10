# Agent State — Kanban

> Durable cross-agent checkpoint. This is a navigation aid, not the source of truth. Live GitHub and the actual checkout take precedence.

## Verified snapshot
- Snapshot date: 2026-10-10.
- Repository: `yusi20006-max/kanban`; default branch: `main`.
- Latest verified `main` SHA at session start: `464b5b8c085cd72e64a8e48bed5ed5176ff82167`.
- Main CI run [#677](https://github.com/yusi20006-max/kanban/actions/runs/37953617077) passed on that exact SHA.
- Local checkout status: **UNKNOWN** to remote GitHub tools. Any agent with a checkout must run `git status --short --branch`, `git rev-parse HEAD`, and inspect unknown changes before editing.
- Recovery instructions: `docs/automation/AGENT_RECOVERY.md`; `AGENTS.md` references this contract.

## Completed
- Generic Agent Runtime worker merged via PR [#205](https://github.com/yusi20006-max/kanban/pull/205); supports PostgreSQL-backed leases, heartbeats, safe dry-run and explicit command mode.
- Durable recovery checkpoint merged via PR [#208](https://github.com/yusi20006-max/kanban/pull/208), merge SHA `9fd455c05064e671a035908e364cb6d0fec1558b`.
- Post-merge metadata PR [#209](https://github.com/yusi20006-max/kanban/pull/209), merge SHA `979d4bcfaa9327efb40758a83fd075ce727b01a6`.
- Final state reconciliation PR [#210](https://github.com/yusi20006-max/kanban/pull/210), merge SHA `464b5b8c085cd72e64a8e48bed5ed5176ff82167`.
- CI #672 passed on #208 merge SHA; CI #675 passed on #209 merge SHA; CI #677 passed on current main SHA.
- Issues #207 and #210 are closed. Their changes must not be reimplemented.

## Active work
- Issue [#211 — GitHub-only ephemeral Agent Runtime E2E](https://github.com/yusi20006-max/kanban/issues/211).
- Working branch: `feat/211-github-actions-agent-runtime-e2e`.
- Current PR: not yet created at snapshot time; create one after reviewing the branch diff and checking workflow/script consistency.
- Parent blockers: [#206 — shared persistent environment](https://github.com/yusi20006-max/kanban/issues/206) and [#181 — real Kanban Control Plane E2E](https://github.com/yusi20006-max/kanban/issues/181), both remain open.
- Current feature adds a GitHub Actions ephemeral PostgreSQL + generic worker dry-run test and a redacted evidence artifact. It is **not** a persistent deployment and does not prove the deployed browser Start button.

## Files changed for Issue #211
- `.github/workflows/agent-runtime-e2e.yml` — PR/manual workflow using a disposable PostgreSQL service container.
- `scripts/agent-runtime-e2e.mjs` — seeds an isolated synthetic card/task/lease/execution, runs the generic worker in dry-run mode, and verifies terminal statuses and no card mutation.
- `docs/automation/GITHUB_ACTIONS_RUNTIME_E2E.md` — states proven boundaries and limitations.

## Tests and evidence
- Main baseline typecheck/test/build/smoke: CI #677 passed on `464b5b8c085cd72e64a8e48bed5ed5176ff82167`.
- Issue #211 E2E has not yet run on this branch at snapshot time; wait for the PR workflow and inspect its exact head SHA and uploaded artifact.
- Never carry a green result from a different SHA.
- Evidence artifact should contain only synthetic fixture IDs/statuses and no credentials or secret values.

## What GitHub-only can and cannot provide
- GitHub Actions can run this integration E2E on an ephemeral runner and preserve a short-lived artifact.
- GitHub Pages is static hosting; it cannot host the server-side TanStack API or a continuously running PostgreSQL worker.
- Actions service containers and databases disappear when the job ends. Artifacts are evidence storage, not a persistent database.
- No Railway/paid cloud resource has been created. No stable public Kanban URL or persistent shared database is currently proven.
- Do not claim phone-independent autonomous execution until a genuinely persistent, authorized runtime exists.

## Exact next actions
1. Inspect the three Issue #211 files and run the dedicated workflow via PR.
2. Fix all failures on the Issue #211 branch; do not merge until all required checks are green on the exact PR head.
3. Review the JSON evidence artifact; ensure execution succeeded, task completed, lease released, agent ready, dry-run mutation is none, and fixture card state remained unchanged.
4. Merge only after CI passes; then verify PR merged SHA, current `main` SHA, and CI on that exact `main` SHA.
5. Update this file after merge with exact SHAs and observed run IDs.
6. Record the limited proof in #206 and #181. Keep both open because this ephemeral run does not satisfy persistent deployment or browser/UI acceptance.

## Recovery drill record
- 2026-10-10 — Remote-only recovery review re-read live main, PRs/issues, and CI. It exposed stale post-merge claims in the prior checkpoint. Those claims have been replaced with the observed main SHA and CI #677. The remote-only drill does not inspect local working-tree state; a real checkout recovery must still run the required Git status/HEAD checks.
