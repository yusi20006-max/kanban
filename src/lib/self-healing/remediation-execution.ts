import { z } from "zod";
import { getSql } from "@/lib/db";
import { appendAgentEvent } from "@/lib/agent-control-plane/history";
import { finishExecution } from "@/lib/agent-control-plane/execution";
import { assignAndStartRepair } from "./repair-loop";
import { deriveRemediationExecutionStatus } from "./remediation-execution-contract";

export { deriveRemediationExecutionStatus };

export const remediationExecutionOutcomeSchema = z.object({
  remediationId: z.string().trim().min(1).max(128),
  executionId: z.string().trim().min(1).max(128),
  fix: z.object({ passed: z.boolean(), evidence: z.record(z.string(), z.unknown()) }),
  test: z.object({ passed: z.boolean(), evidence: z.record(z.string(), z.unknown()) }),
});
export const remediationTerminalSchema = z.object({
  remediationId: z.string().trim().min(1).max(128),
  executionId: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(1).max(256).optional(),
});

export async function startRemediationExecution(userId: string, input: unknown) {
  return assignAndStartRepair(userId, input);
}

export async function finishRemediationExecution(userId: string, input: unknown) {
  const d = remediationExecutionOutcomeSchema.parse(input);
  const sql = await getSql();
  const rows = await sql.query<{ task_id: string; failure_signal_id: string }>(
    "select task_id,failure_signal_id from kanban_remediation_tasks where id=$1 and owner_user_id=$2",
    [d.remediationId, userId],
  );
  if (!rows[0]) throw new Error("REMEDIATION_NOT_FOUND");
  const execution = await sql.query<{ task_id: string; status: string; agent_id: string }>(
    "select task_id,status,agent_id from kanban_agent_executions where id=$1 and owner_user_id=$2",
    [d.executionId, userId],
  );
  if (!execution[0] || execution[0].task_id !== rows[0].task_id) throw new Error("EXECUTION_NOT_FOUND");
  if (execution[0].status !== "running") throw new Error("EXECUTION_NOT_RUNNING");

  const status = deriveRemediationExecutionStatus(d.fix.passed, d.test.passed);
  const result = { fix: d.fix, test: d.test };
  const finished = await finishExecution(userId, {
    executionId: d.executionId,
    status,
    result,
    error: status === "failed" ? { code: "REMEDIATION_FIX_OR_TEST_FAILED" } : null,
  });
  await sql.query(
    "update kanban_remediation_tasks set retry_after=case when $1='failed' then now()+interval '30 seconds' else null end,terminal_reason=case when $1='failed' then 'fix_or_test_failed' else null end where id=$2 and owner_user_id=$3",
    [status, d.remediationId, userId],
  );
  await appendAgentEvent(userId, {
    taskId: rows[0].task_id,
    executionId: d.executionId,
    agentId: execution[0].agent_id,
    eventType: "remediation_fix_tested",
    fromState: "running",
    toState: status,
    payload: result,
  });
  return { ...finished, remediationId: d.remediationId, failureSignalId: rows[0].failure_signal_id, result };
}

export async function cancelRemediationExecution(userId: string, input: unknown) {
  return finishRemediationTerminal(userId, input, "cancelled", "remediation_cancelled");
}
export async function timeoutRemediationExecution(userId: string, input: unknown) {
  return finishRemediationTerminal(userId, input, "timed_out", "remediation_timeout");
}

async function finishRemediationTerminal(userId: string, input: unknown, status: "cancelled" | "timed_out", reason: string) {
  const d = remediationTerminalSchema.parse(input);
  const sql = await getSql();
  const rows = await sql.query<{ task_id: string }>(
    "select task_id from kanban_remediation_tasks where id=$1 and owner_user_id=$2",
    [d.remediationId, userId],
  );
  if (!rows[0]) throw new Error("REMEDIATION_NOT_FOUND");
  const finished = await finishExecution(userId, {
    executionId: d.executionId,
    status,
    result: null,
    error: { code: reason, detail: d.reason ?? null },
  });
  await sql.query(
    "update kanban_remediation_tasks set status='cancelled',terminal_reason=$1,retry_after=null where id=$2 and owner_user_id=$3",
    [d.reason ?? reason, d.remediationId, userId],
  );
  return { ...finished, remediationId: d.remediationId, terminal: true, reason: d.reason ?? reason };
}
