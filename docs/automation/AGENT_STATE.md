# Agent State — Kanban

> Durable cross-agent checkpoint. This is a timestamped navigation snapshot, not the source of truth. Live GitHub and the actual checkout take precedence. The commit containing this file advances `main`; therefore always query GitHub at session start instead of treating the recorded SHA as the current SHA.

## Verified snapshot
- Snapshot date: 2026-10-10.
- Repository: `yusi20006-max/kanban`; default branch: `main`.
- Main SHA observed immediately before this checkpoint refresh: `b8ce24f39c8cfe15af1588d5c810908ec857debc`.
- Main CI [#695](https://github.com/yusi20006-max/kanban/actions/runs/38020673155) passed on that exact SHA.
- Local working-tree status: **UNKNOWN** to remote GitHub tools. Any agent with a checkout must run `git status --short --branch`, `git rev-parse HEAD`, inspect remotes, and review unknown changes before editing.
- Recovery contract: `docs/automation/AGENT_RECOVERY.md`; `AGENTS.md` links to it.
- Baseline before the recovery-checkpoint feature: `5cbcbe9e87c5b05fe03157d6da9914c87f013d8a` (CI #661 passed).

## Last verified completed stage
- Real server-side Card Start orchestration plus generic Agent Runtime worker E2E passed on PR head `e6f29f77dc732370bf39dc0b434c10d2f7180819`.
- PR [#216](https://github.com/yusi20006-max/kanban/pull/216) merged to main as `b8ce24f39c8cfe15af1588d5c810908ec857debc`.
- Quality CI passed on that exact PR head; post-merge main CI #695 passed on the merge SHA.
- Agent Runtime E2E run [#8](https://github.com/yusi20006-max/kanban/actions/runs/38020585617) passed on that exact PR head and uploaded `agent-runtime-e2e-evidence`, retained until 2026-10-24.
- The E2E invokes production `startCardExecution` to create Task/Lease/Execution and set `Agent=running / Workflow=inspect`, then runs the worker against the same disposable PostgreSQL. Terminal states verified: Execution=succeeded, Task=completed, Lease=released, Agent=ready. Dry-run reports `mutation=none`; the card stays at the state Start set.
- The test exposed and fixed two real SQL bugs: ambiguous `id` in the Card Start select, and a missing `RETURNING id` in the agent-state transition's optimistic concurrency check.

## Completed
- Generic Agent Runtime worker merged via PR [#205](https://github.com/yusi20006-max/kanban/pull/205); PostgreSQL-backed leases/heartbeats, safe dry-run and explicit command mode.
- Recovery checkpoint and contract merged via PR [#208](https://github.com/yusi20006-max/kanban/pull/208), SHA `9fd455c05064e671a035908e364cb6d0fec1558b`; main CI #672 passed on that SHA.
- Metadata refresh PR [#209](https://github.com/yusi20006-max/kanban/pull/209), SHA `979d4bcfaa9327efb40758a83fd075ce727b01a6`; CI #675 passed.
- Reconciliation PR [#210](https://github.com/yusi20006-max/kanban/pull/210), SHA `464b5b8c085cd72e64a8e48bed5ed5176ff82167`; main CI #677 passed.
- GitHub-only ephemeral worker E2E PR [#212](https://github.com/yusi20006-max/kanban/pull/212), SHA `a4364790b1a961a13f7599f4146cd02987684422`; main CI #688 passed.
- Real Card Start orchestration E2E PR #216 is merged; Issue #215 is closed. Issues #207, #210, #211, #213 and #215 are closed.

## Branch / PR / commits
- PR #208: `9fd455c05064e671a035908e364cb6d0fec1558b`.
- PR #209: `979d4bcfaa9327efb40758a83fd075ce727b01a6`.
- PR #210: `464b5b8c085cd72e64a8e48bed5ed5176ff82167`.
- PR #212: `a4364790b1a961a13f7599f4146cd02987684422`.
- PR #216: `b8ce24f39c8cfe15af1588d5c810908ec857debc`.
- Current checkpoint revision is tracked by Issue #217. Do not infer any transient branch/PR status from this file; query live GitHub.

## Active work
- Functional blockers remain: [#206 — shared persistent environment](https://github.com/yusi20006-max/kanban/issues/206) and [#181 — real Kanban Control Plane E2E](https://github.com/yusi20006-max/kanban/issues/181), both open.
- #206/#181 still require a stable deployed Kanban URL, a persistent database shared by app and worker across runner termination, and an actual browser/UI Start click with observable execution.
- GitHub Pages is static hosting. GitHub Actions runners/service containers are ephemeral; artifacts preserve evidence, not live database state.
- No Railway or other paid infrastructure was created.

## Tests, lint, and CI evidence
- Main CI #695 passed on `b8ce24f39c8cfe15af1588d5c810908ec857debc`.
- PR #216 quality CI passed on `e6f29f77dc732370bf39dc0b434c10d2f7180819`.
- Agent Runtime E2E #8 passed on the same PR head and uploaded a sanitized evidence artifact.
- Earlier main checks: #688 passed on `a4364790b1a961a13f7599f4146cd02987684422`; #690 passed on `6740099530b20566d02a778b26c925935270df32`.
- Never carry a green result from a different SHA.

## Blockers and stop reason
- No persistent host or durable shared database is configured.
- No public deployed Kanban URL or deployed browser/UI click E2E is claimed.
- The E2E uses synthetic fixture rows referencing Kanban Issue #211; it has no GitHub write token and does not mutate `yusi20006-max/yasin-chess`.
- Local working-tree state cannot be verified remotely; inspect the actual checkout before any edits.

## Exact next action
1. At session start, fetch the live `main` SHA and check CI for that exact SHA; inspect current open Issues/PRs and the actual checkout.
2. Read `docs/automation/AGENT_RECOVERY.md` and preserve any unknown local changes.
3. Resume #206 only within the no-paid-resource constraint. First evaluate whether the user has an explicitly available/free, persistent hosting/database option; do not treat Pages or Actions artifacts as that runtime.
4. Keep #206 and #181 open until persistent app/DB/worker and deployed browser/UI evidence are actually available.

## Recovery history
- 2026-10-10 — Remote-only recovery review corrected stale checkpoint details and re-confirmed that local working-tree status remains unknown.
- 2026-10-10 — PR #212 proved the generic worker lifecycle on disposable PostgreSQL; it did not test the real Card Start orchestration.
- 2026-10-10 — PR #216 invoked production `startCardExecution`, exposed/fixed two SQL defects, and passed quality CI plus E2E #8 on the exact PR head.
- 2026-10-10 — GitHub-only feasibility conclusion: ephemeral Actions E2E is possible without paid services, but a persistent public runtime is not provided by GitHub Pages/Actions alone.
