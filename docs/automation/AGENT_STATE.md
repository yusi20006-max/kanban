# Agent State — Kanban

> Durable cross-agent checkpoint. This is a navigation aid, not the source of truth. Live GitHub and the actual checkout take precedence.

## Verified snapshot
- Snapshot date: 2026-10-10.
- Repository: `yusi20006-max/kanban`; default branch: `main`.
- Latest observed `main` SHA: `a4364790b1a961a13f7599f4146cd02987684422` (PR #212 squash merge).
- Main CI run [#688](https://github.com/yusi20006-max/kanban/actions/runs/38020038904) was in progress at checkpoint creation; re-check before relying on it.
- Local working-tree status: **UNKNOWN** to remote GitHub tools. Any agent with a checkout must run `git status --short --branch`, `git rev-parse HEAD`, and inspect unknown changes before editing.
- Recovery instructions: `docs/automation/AGENT_RECOVERY.md`; `AGENTS.md` references this contract.
- Baseline main SHA before the checkpoint feature: `5cbcbe9e87c5b05fe03157d6da9914c87f013d8a` (CI #661 passed).

## Last verified completed stage
- GitHub-hosted ephemeral Agent Runtime E2E merged through PR [#212](https://github.com/yusi20006-max/kanban/pull/212), merge SHA `a4364790b1a961a13f7599f4146cd02987684422`.
- PR head tested: `9b047f81934c0893335259ec5748c49200b34867`.
- CI quality run [#685](https://github.com/yusi20006-max/kanban/actions/runs/38019942306) passed on that exact PR head.
- Dedicated ephemeral E2E run [#2](https://github.com/yusi20006-max/kanban/actions/runs/38019942328) passed on that exact PR head; artifact `agent-runtime-e2e-evidence` is retained until 2026-10-24.
- Verified: execution succeeded, task completed, lease released, agent ready, dry-run reported `mutation: none`, fixture card state unchanged. This is worker lifecycle evidence against a disposable PostgreSQL service, not UI or persistent deployment proof.

## Completed
- Generic Agent Runtime worker merged via PR [#205](https://github.com/yusi20006-max/kanban/pull/205); supports PostgreSQL-backed leases, heartbeats, safe dry-run and explicit command mode.
- Durable recovery checkpoint merged via PR [#208](https://github.com/yusi20006-max/kanban/pull/208), merge SHA `9fd455c05064e671a035908e364cb6d0fec1558b`; main CI #672 passed on that SHA.
- Post-merge metadata PR [#209](https://github.com/yusi20006-max/kanban/pull/209), merge SHA `979d4bcfaa9327efb40758a83fd075ce727b01a6`; CI #675 passed on that SHA.
- Final state reconciliation PR [#210](https://github.com/yusi20006-max/kanban/pull/210), merge SHA `464b5b8c085cd72e64a8e48bed5ed5176ff82167`; main CI #677 passed on that SHA.
- GitHub-only ephemeral E2E PR #212 merged; Issue #211 is closed.
- Issues #207, #210, and #211 are closed. Do not reimplement their completed work.

## Branch / PR / commits
- PR #208: merged at `9fd455c05064e671a035908e364cb6d0fec1558b`.
- PR #209: merged at `979d4bcfaa9327efb40758a83fd075ce727b01a6`.
- PR #210: merged at `464b5b8c085cd72e64a8e48bed5ed5176ff82167`.
- PR #212: merged at `a4364790b1a961a13f7599f4146cd02987684422`.
- Current documentation-only branch: `docs/213-reconcile-post-e2e-checkpoint`; PR for Issue #213 not yet created at checkpoint refresh time.

## Active work
- Issue [#213 — Reconcile recovery checkpoint after GitHub-only runtime E2E merge](https://github.com/yusi20006-max/kanban/issues/213).
- Parent blockers still open: [#206 — shared persistent environment](https://github.com/yusi20006-max/kanban/issues/206) and [#181 — real Kanban Control Plane E2E](https://github.com/yusi20006-max/kanban/issues/181).
- #206/#181 still need a stable deployed Kanban URL, a persistent database shared by app and worker across runner termination, and an actual browser/UI Start execution. GitHub Pages is static hosting; Actions service containers and processes are ephemeral. No Railway or paid infrastructure was created.

## Tests, lint, and CI evidence
- Main CI #677 passed on `464b5b8c085cd72e64a8e48bed5ed5176ff82167`.
- PR #212 CI #685 passed on `9b047f81934c0893335259ec5748c49200b34867`.
- Agent Runtime E2E run #2 passed on `9b047f81934c0893335259ec5748c49200b34867`; sanitized artifact uploaded.
- Main CI #688 on merge SHA `a4364790b1a961a13f7599f4146cd02987684422` was pending at checkpoint creation; verify its final result.
- Never carry a green result from a different SHA.

## Blockers and stop reason
- No persistent host or durable shared database is configured.
- No public deployed Kanban URL or browser/UI E2E is claimed.
- The ephemeral E2E uses a synthetic card referencing Kanban Issue #211 and performs no external GitHub writes; it does not mutate `yusi20006-max/yasin-chess`.
- Local working-tree status cannot be verified remotely; the actual checkout must be inspected before edits.

## Exact next action
1. Verify CI #688 for merge SHA `a4364790b1a961a13f7599f4146cd02987684422`.
2. Merge this documentation reconciliation PR only after CI is green on its exact head.
3. After merge, verify the new `main` SHA and CI for that exact SHA, then refresh this checkpoint if needed.
4. Continue #206 only within the no-paid-resource constraint; do not equate Actions artifacts with a persistent runtime.

## Recovery history
- 2026-10-10 — Remote-only recovery review found stale post-merge fields in the prior checkpoint; replaced them with current GitHub facts.
- 2026-10-10 — PR #212 merged at `a4364790b1a961a13f7599f4146cd02987684422`; quality and ephemeral worker E2E passed on its exact head `9b047f81934c0893335259ec5748c49200b34867`.
- 2026-10-10 — Remote-only drill verified current GitHub SHA/PR/CI and identified remaining blocker accurately. The local-checkout leg remains unverified because remote tools cannot inspect an actual developer filesystem.
