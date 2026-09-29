import { z } from "zod";

export const retrySafetyInputSchema = z.object({
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  lastAttemptAt: z.string().datetime().nullable(),
  now: z.string().datetime(),
  backoffSeconds: z.number().int().min(0).max(86400),
  loopSteps: z.number().int().min(0),
  maxLoopSteps: z.number().int().min(1),
  killSwitch: z.boolean(),
  duplicate: z.boolean(),
  recursive: z.boolean(),
});

export function evaluateRetrySafety(input: z.infer<typeof retrySafetyInputSchema>) {
  const d = retrySafetyInputSchema.parse(input);
  if (d.killSwitch) return { allowed: false as const, reason: "SELF_HEALING_KILL_SWITCH" };
  if (d.duplicate) return { allowed: false as const, reason: "DUPLICATE_REMEDIATION" };
  if (d.recursive) return { allowed: false as const, reason: "RECURSIVE_REMEDIATION" };
  if (d.attempts >= d.maxAttempts) return { allowed: false as const, reason: "RETRY_BUDGET_EXCEEDED" };
  if (d.loopSteps >= d.maxLoopSteps) return { allowed: false as const, reason: "LOOP_LIMIT_EXCEEDED" };
  if (d.lastAttemptAt) {
    const elapsed = Date.parse(d.now) - Date.parse(d.lastAttemptAt);
    if (elapsed < d.backoffSeconds * 1000) return { allowed: false as const, reason: "RETRY_BACKOFF_ACTIVE" };
  }
  return { allowed: true as const, reason: "SAFE" };
}
