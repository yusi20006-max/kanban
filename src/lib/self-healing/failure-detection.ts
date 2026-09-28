import { getSql } from "@/lib/db";
import { detectionContractSchema, parseDetectionContract, detectionFingerprint } from "./detection-contract";

export const failureDetectionInputSchema = detectionContractSchema;

export function classifyFailure(
  source: "execution" | "ci" | "check",
  evidence: Record<string, unknown>,
) {
  if (source === "ci") return evidence.conclusion === "failure" ? "ci_failure" : "ci_check_failure";
  if (source === "check") return "check_failure";
  const status = String(evidence.status ?? "failed");
  return status === "timed_out"
    ? "execution_timeout"
    : status === "cancelled"
      ? "execution_cancelled"
      : status === "failed"
        ? "execution_failure"
        : "execution_unknown";
}

export async function detectFailure(userId: string, input: unknown) {
  const detection = parseDetectionContract(input);
  const failureType = classifyFailure(detection.source, detection.evidence);

  const sql = await getSql();
  const fingerprint = detectionFingerprint(detection);
  const rows = await sql.query(
    'insert into kanban_failure_signals(id,owner_user_id,task_id,execution_id,source,failure_type,fingerprint,evidence,identifier,detected_commit_sha,severity,signal_type,detected_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13) on conflict(owner_user_id,fingerprint) do update set evidence=excluded.evidence,identifier=excluded.identifier,detected_commit_sha=excluded.detected_commit_sha,severity=excluded.severity,signal_type=excluded.signal_type,detected_at=excluded.detected_at returning id,task_id,execution_id,source,failure_type,fingerprint,evidence,identifier,detected_commit_sha as "commitSha",severity,signal_type as "signalType",detected_at as "detectedAt"',
    [
      crypto.randomUUID(),
      userId,
      detection.taskId,
      detection.executionId,
      detection.source,
      failureType,
      fingerprint,
      JSON.stringify(detection.evidence),
      detection.identifier,
      detection.commitSha,
      detection.severity,
      detection.signalType,
      detection.detectedAt,
    ],
  );
  return rows[0];
}

export async function listFailureSignals(userId: string, limit = 50) {
  const sql = await getSql();
  return sql.query(
    'select id,task_id as "taskId",execution_id as "executionId",source,failure_type as "failureType",fingerprint,evidence,identifier,detected_commit_sha as "commitSha",severity,signal_type as "signalType",detected_at as "detectedAt" from kanban_failure_signals where owner_user_id=$1 order by detected_at desc limit $2',
    [userId, Math.min(Math.max(limit, 1), 200)],
  );
}
