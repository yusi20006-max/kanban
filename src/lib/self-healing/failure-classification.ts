import { z } from "zod";
import type { DetectionContract } from "./detection-contract";

export const failureCategorySchema = z.enum(["ci", "test", "runtime", "unknown"]);
export const failureClassificationSchema = z.object({
  category: failureCategorySchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(512),
  autoRemediationAllowed: z.boolean(),
});

export type FailureClassification = z.infer<typeof failureClassificationSchema>;

export function classifyDetectedFailure(detection: DetectionContract): FailureClassification {
  if (detection.source === "ci") {
    if (detection.evidence.conclusion === "failure") {
      return { category: "ci", confidence: 1, reason: "CI detection has an explicit failure conclusion.", autoRemediationAllowed: true };
    }
    return { category: "unknown", confidence: 0.2, reason: "CI detection lacks an explicit failure conclusion.", autoRemediationAllowed: false };
  }

  if (detection.source === "execution") {
    const status = String(detection.evidence.status ?? "");
    if (["failed", "timed_out", "cancelled"].includes(status)) {
      return { category: "runtime", confidence: 1, reason: "Execution evidence contains a terminal failure status.", autoRemediationAllowed: true };
    }
    return { category: "unknown", confidence: 0.2, reason: "Execution evidence does not contain a recognized failure status.", autoRemediationAllowed: false };
  }

  const marker = String(detection.evidence.category ?? detection.evidence.type ?? detection.identifier).toLowerCase();
  if (/(^|[^a-z])test([^a-z]|$)/.test(marker)) {
    return { category: "test", confidence: 0.9, reason: "Check evidence explicitly identifies a test failure.", autoRemediationAllowed: true };
  }

  return { category: "unknown", confidence: 0.1, reason: "Check evidence does not identify a supported failure category.", autoRemediationAllowed: false };
}
