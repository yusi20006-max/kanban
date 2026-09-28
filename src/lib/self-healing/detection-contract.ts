import { createHash } from "node:crypto";
import { z } from "zod";

export const detectionSourceSchema = z.enum(["execution", "ci", "check"]);
export const detectionSignalTypeSchema = z.enum(["failure", "anomaly"]);
export const detectionSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const detectionContractSchema = z.object({
  source: detectionSourceSchema,
  identifier: z.string().trim().min(1).max(256),
  detectedAt: z.string().datetime({ offset: true }),
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i).nullable().default(null),
  severity: detectionSeveritySchema,
  signalType: detectionSignalTypeSchema,
  evidence: z.record(z.string(), z.unknown()).default({}),
  taskId: z.string().trim().min(1).max(128).nullable().default(null),
  executionId: z.string().trim().min(1).max(128).nullable().default(null),
  runId: z.number().int().positive().nullable().default(null),
});

export type DetectionContract = z.infer<typeof detectionContractSchema>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ":" + stableJson(item))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}

export function detectionFingerprint(detection: DetectionContract): string {
  const identity = {
    source: detection.source,
    identifier: detection.identifier,
    commitSha: detection.commitSha,
    signalType: detection.signalType,
    evidence: detection.evidence,
  };
  return createHash("sha256").update(stableJson(identity)).digest("hex");
}

export function parseDetectionContract(input: unknown): DetectionContract {
  return detectionContractSchema.parse(input);
}
