import { z } from "zod";
import { getSql } from "@/lib/db";

export const recoveryEvidenceSchema = z.object({
  remediationId: z.string().trim().min(1).max(128),
  executionId: z.string().trim().min(1).max(128),
  originalFailureFingerprint: z.string().trim().min(1).max(128),
  reproduced: z.boolean(),
  checks: z.array(z.object({
    name: z.string().trim().min(1).max(256),
    passed: z.boolean(),
    evidence: z.record(z.string(), z.unknown()),
  })).min(1).max(50),
});

export type RecoveryState = "recovered" | "unrecovered" | "unknown";

export function evaluateRecoveryEvidence(input: z.infer<typeof recoveryEvidenceSchema>): RecoveryState {
  if (!input.originalFailureFingerprint || input.checks.length === 0) return "unknown";
  if (input.reproduced) return "unrecovered";
  if (input.checks.every((check) => check.passed && Object.keys(check.evidence).length > 0)) return "recovered";
  return "unknown";
}

export async function verifyRecovery(userId: string, input: unknown) {
  const d = recoveryEvidenceSchema.parse(input);
  const sql = await getSql();
  const rows = await sql.query<{ task_id: string; failure_signal_id: string; status: string }>(
    "select task_id,failure_signal_id,status from kanban_remediation_tasks where id=$1 and owner_user_id=$2",
    [d.remediationId, userId],
  );
  if (!rows[0]) throw new Error("REMEDIATION_NOT_FOUND");
  const signal = await sql.query<{ fingerprint: string }>(
    "select fingerprint from kanban_failure_signals where id=$1 and owner_user_id=$2",
    [rows[0].failure_signal_id, userId],
  );
  if (!signal[0]) throw new Error("FAILURE_SIGNAL_NOT_FOUND");
  if (signal[0].fingerprint !== d.originalFailureFingerprint) throw new Error("FAILURE_FINGERPRINT_MISMATCH");
  const execution = await sql.query<{ task_id: string }>(
    "select task_id from kanban_agent_executions where id=$1 and owner_user_id=$2",
    [d.executionId, userId],
  );
  if (!execution[0] || execution[0].task_id !== rows[0].task_id) throw new Error("EXECUTION_NOT_FOUND");

  const state = evaluateRecoveryEvidence(d);
  await sql.query(
    "update kanban_remediation_tasks set verification_state=$1,verification_evidence=$2::jsonb,verified_at=now(),status=status where id=$3 and owner_user_id=$4",
    [state, JSON.stringify({ executionId: d.executionId, checks: d.checks, reproduced: d.reproduced }), d.remediationId, userId],
  );
  return { remediationId: d.remediationId, executionId: d.executionId, state, evidence: d.checks };
}
