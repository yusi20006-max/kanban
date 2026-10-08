export const RUNTIME_MODES = Object.freeze(["dry-run", "command"]);

export function validateRuntimeConfig({ mode = "dry-run", command = "" } = {}) {
  if (!RUNTIME_MODES.includes(mode)) throw new Error("AGENT_RUNTIME_MODE_INVALID");
  if (mode === "command" && !command.trim()) throw new Error("AGENT_RUNTIME_COMMAND_REQUIRED");
  return { mode, command: command.trim() || null };
}

export function buildExecutionInput(task) {
  return {
    taskId: task.task_id,
    executionId: task.execution_id,
    cardId: task.card_id ?? null,
    githubRepo: task.github_repo ?? null,
    githubIssueNumber: task.github_issue_number ?? null,
  };
}

export function buildDryRunResult(task) {
  return {
    mode: "dry-run",
    safe: true,
    taskId: task.task_id,
    cardId: task.card_id ?? null,
    githubRepo: task.github_repo ?? null,
    githubIssueNumber: task.github_issue_number ?? null,
    phases: ["inspect", "execute", "verify"],
    mutation: "none",
  };
}
