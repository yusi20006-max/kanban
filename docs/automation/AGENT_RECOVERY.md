# Agent Recovery Contract

This contract is tool-independent. It applies to Claude Code, OpenCode, Qwen Code, Cline, Codex, and any future agent.

## Authority order
1. Live GitHub state (default branch SHA, Issues, PRs, review/check results, workflow runs).
2. Actual checkout state (branch, HEAD, staged/unstaged/untracked files, remotes).
3. `docs/automation/AGENT_STATE.md` as a durable navigation/checkpoint aid.
4. Prior conversation or agent memory (helpful hints only; never authoritative).

If sources conflict, do not silently overwrite anything. Record the conflict and reconcile against GitHub and the actual checkout.

## Start of every session
1. Read this contract and `docs/automation/AGENT_STATE.md`.
2. Inspect `git status --short --branch`, `git branch --show-current`, `git rev-parse HEAD`, and the configured remotes. Never assume the working tree is clean.
3. Fetch the live default branch SHA, open Issues, open PRs, and current checks for any active PR. Confirm whether the checkpoint's Issue/PR is open, closed, merged, or superseded.
4. Compare local HEAD and the checkpoint SHA with the live remote. A newer remote SHA does not mean local changes should be discarded.
5. Identify changes not understood by the current agent. Preserve them; inspect diffs before edits. Never run destructive reset/clean/checkout commands or replace files blindly.
6. Select one existing active Issue. Do not begin implementation without an Issue. If its PR is already merged or the acceptance criteria are already met, verify evidence and continue to the next action instead of repeating work.
7. Write down the exact next action before making changes.

## During work
- Work on an Issue-linked branch and use a PR. Keep changes scoped to the Issue.
- After each meaningful milestone, record commit SHA, changed files, checks run and outcomes, and the next concrete action in `AGENT_STATE.md`.
- Do not report a test, lint, browser test, or CI result unless it was actually run and its result observed. Separate local test results from GitHub CI results.
- Do not store credentials, access tokens, cookies, private keys, or secret values in state files, issues, PR bodies, logs, or artifacts. Record only variable names and whether required configuration is present.
- Keep logs/artifacts free of secrets and unnecessary personal data.
- Before stopping, leave a recoverable checkpoint even if the task is blocked; include the exact blocker and safe next command/action.
- If a long-running process or phone/session disappears, a new agent should reconstruct state from GitHub and the checkout, not rely on the previous conversation.

## Before PR / merge
1. Confirm the PR diff and link the Issue.
2. Run the checks required by the repo and wait for the PR's latest required GitHub checks to complete.
3. Do not merge on pending, failed, stale, or unverified checks. Do not claim green based on an earlier SHA.
4. Immediately before merge, verify the PR is open, the head SHA is the one tested, and the base branch has not moved in a way that invalidates the result.
5. After merge, verify GitHub reports merged, capture the merge commit SHA, read the resulting `main` SHA, and verify CI on that exact SHA.
6. Update `AGENT_STATE.md` with the actual merge SHA, new main SHA, check-run URL/result, and next Issue.

## Read-only recovery drill
The drill validates reconciliation logic without editing application data:
1. Read the checkpoint and copy its claimed baseline SHA and active Issue/PR.
2. Independently query GitHub for the current `main` SHA and the active Issue/PR/check status.
3. Inspect local `git status` and HEAD. Do not mutate the tree.
4. Simulate a lost session by ignoring all previous chat/memory; derive the next action only from the checkpoint plus the live GitHub/checkout evidence.
5. Confirm the selected action does not repeat a merged change, overwrite unknown files, or merge an unverified PR.
6. Record which fields reconciled, which were stale, and any mismatch. A documentation-only simulation is not the same as proving a real cross-device/agent runtime.

## What GitHub persistence does and does not mean
- Commits, Issues, PRs, checks, and workflow artifacts can persist evidence beyond a local session, subject to repository retention/settings.
- This checkpoint does not itself restart an agent, keep a process alive, or execute after a phone shuts down.
- Phone-independent autonomous continuation requires a separately deployed/scheduled runner or hosted orchestration with access to the repository and necessary secrets. A GitHub Actions job can run after a trigger, but its runner is ephemeral; it is not a permanent agent session.
- Never claim autonomous continuation merely because the checkpoint file exists.
