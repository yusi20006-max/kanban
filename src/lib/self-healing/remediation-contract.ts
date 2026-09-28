import { z } from "zod";
import type { DetectionContract } from "./detection-contract";
import type { FailureClassification } from "./failure-classification";

export const remediationTaskContextSchema = z.object({
  failureSignalId: z.string().min(1).max(128),
  source: z.string().min(1).max(64),
  identifier: z.string().min(1).max(256),
  failureCategory: z.enum(["ci", "test", "runtime"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(512),
  evidence: z.record(z.string(), z.unknown()),
});

export function buildRemediationTaskContext(
  signal: Pick<DetectionContract, "source" | "identifier" | "evidence"> & { id: string },
  classification: FailureClassification,
) {
  if (!classification.autoRemediationAllowed || classification.category === "unknown") {
    throw new Error("UNSUPPORTED_FAILURE_CLASSIFICATION");
  }
  return remediationTaskContextSchema.parse({
    failureSignalId: signal.id,
    source: signal.source,
    identifier: signal.identifier,
    failureCategory: classification.category,
    confidence: classification.confidence,
    reason: classification.reason,
    evidence: signal.evidence,
  });
}
