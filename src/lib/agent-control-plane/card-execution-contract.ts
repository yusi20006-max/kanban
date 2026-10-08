import { z } from "zod";

export const startCardExecutionInputSchema = z.object({
  boardId: z.string().trim().min(1).max(128),
  cardId: z.string().trim().min(1).max(128),
  agentId: z.string().trim().min(1).max(128).nullable().default(null),
  leaseTtlSeconds: z.number().int().min(1).max(86400).default(300),
  timeoutSeconds: z.number().int().min(1).max(86400).nullable().default(null),
  idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
});

export type CardExecutionPlan = {
  taskId: string;
  executionId: string;
  agentId: string;
  phase: "inspect";
};

export function buildCardExecutionPlan(cardId: string, agentId: string): CardExecutionPlan {
  return {
    taskId: `card:${cardId}:execution`,
    executionId: crypto.randomUUID(),
    agentId,
    phase: "inspect",
  };
}
