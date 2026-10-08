import test from "node:test";
import assert from "node:assert/strict";
import { buildDryRunResult, buildExecutionInput, validateRuntimeConfig } from "./agent-runtime-contract.mjs";

test("runtime defaults to safe dry-run contract", () => {
  assert.deepEqual(validateRuntimeConfig(), { mode: "dry-run", command: null });
});

test("command mode requires an explicit command", () => {
  assert.throws(() => validateRuntimeConfig({ mode: "command" }), /AGENT_RUNTIME_COMMAND_REQUIRED/);
});

test("runtime rejects unknown modes", () => {
  assert.throws(() => validateRuntimeConfig({ mode: "unknown" }), /AGENT_RUNTIME_MODE_INVALID/);
});

test("execution payload contains only delivery references", () => {
  assert.deepEqual(buildExecutionInput({
    task_id: "task-1",
    execution_id: "exec-1",
    card_id: "card-422",
    github_repo: "yusi20006-max/yasin-chess",
    github_issue_number: 422,
  }), {
    taskId: "task-1",
    executionId: "exec-1",
    cardId: "card-422",
    githubRepo: "yusi20006-max/yasin-chess",
    githubIssueNumber: 422,
  });
});

test("dry-run explicitly proves no repository mutation", () => {
  const result = buildDryRunResult({
    task_id: "task-1",
    card_id: "card-422",
    github_repo: "yusi20006-max/yasin-chess",
    github_issue_number: 422,
  });
  assert.equal(result.safe, true);
  assert.equal(result.mutation, "none");
  assert.deepEqual(result.phases, ["inspect", "execute", "verify"]);
});
