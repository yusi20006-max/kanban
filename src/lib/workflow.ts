import { z } from "zod";

export const workflowPhaseSchema = z.enum(["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"]);
export const agentStateSchema = z.enum(["idle", "running", "blocked", "waiting-ci", "waiting-review", "completed", "failed"]);
export type WorkflowPhase = z.infer<typeof workflowPhaseSchema>;
export type AgentState = z.infer<typeof agentStateSchema>;

const allowed: Record<AgentState, AgentState[]> = {
  idle: ["running"],
  running: ["blocked", "waiting-ci", "waiting-review", "completed", "failed"],
  blocked: ["running", "failed"],
  "waiting-ci": ["running", "completed", "failed"],
  "waiting-review": ["running", "completed", "failed"],
  completed: ["running"],
  failed: ["running"],
};

export function canTransition(from: AgentState, to: AgentState) {
  return allowed[from].includes(to);
}

export function assertTransition(from: AgentState, to: AgentState) {
  if (from === to) throw new Error("DUPLICATE_AGENT_TRANSITION");
  if (!canTransition(from, to)) throw new Error("INVALID_AGENT_TRANSITION");
}

export function nextPhase(phase: WorkflowPhase): WorkflowPhase {
  const phases: WorkflowPhase[] = ["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"];
  const index = phases.indexOf(phase);
  return phases[Math.min(index + 1, phases.length - 1)];
}

export const transitionInputSchema = z.object({
  boardId: z.string().min(1).max(128),
  cardId: z.string().min(1).max(128),
  toState: agentStateSchema,
  phase: workflowPhaseSchema.optional(),
  result: z.string().max(20000).default(""),
  idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
});

export const recordPhaseInputSchema = z.object({
  boardId: z.string().min(1).max(128),
  cardId: z.string().min(1).max(128),
  phase: workflowPhaseSchema,
  result: z.string().max(20000).default(""),
});
