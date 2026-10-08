import { z } from "zod";
import { getSql } from "@/lib/db";
import { appendAgentEvent } from "@/lib/agent-control-plane/history";

export const assignmentRequestSchema = z.object({
  taskId: z.string().trim().min(1).max(128),
  failureCategory: z.enum(["ci", "test", "runtime"]),
  preferredAgentId: z.string().trim().min(1).max(128).nullable().default(null),
});

export type AssignmentResult =
  | { assigned: true; taskId: string; agentId: string; capability: string; reason: string }
  | { assigned: false; taskId: string; reason: "NO_CAPABLE_AGENT" | "PREFERRED_AGENT_UNAVAILABLE" };

const capabilityFor = (category: "ci" | "test" | "runtime") => `self-healing:${category}`;

export async function assignRemediationAgent(userId: string, input: unknown): Promise<AssignmentResult> {
  const request = assignmentRequestSchema.parse(input);
  const sql = await getSql();
  const capability = capabilityFor(request.failureCategory);

  const candidates = await sql.query<{id:string;capabilities:string[];status:string;last_seen_at:string|null}>(
    "select id,capabilities,status,last_seen_at from kanban_agents where owner_user_id=$1 and status in ('ready','busy') order by case when status='ready' then 0 else 1 end,last_seen_at desc nulls last,id",
    [userId],
  );

  const capable = candidates.filter((agent) =>
    Array.isArray(agent.capabilities) && agent.capabilities.map(String).includes(capability),
  );

  const selected = request.preferredAgentId
    ? capable.find((agent) => agent.id === request.preferredAgentId)
    : capable[0];

  if (request.preferredAgentId && !selected) {
    await appendAgentEvent(userId, {
      taskId: request.taskId,
      agentId: request.preferredAgentId,
      eventType: "assignment_failed",
      fromState: "pending",
      toState: "blocked",
      payload: { capability, reason: "PREFERRED_AGENT_UNAVAILABLE" },
    });
    return { assigned: false, taskId: request.taskId, reason: "PREFERRED_AGENT_UNAVAILABLE" };
  }

  if (!selected) {
    await appendAgentEvent(userId, {
      taskId: request.taskId,
      eventType: "assignment_failed",
      fromState: "pending",
      toState: "blocked",
      payload: { capability, reason: "NO_CAPABLE_AGENT" },
    });
    return { assigned: false, taskId: request.taskId, reason: "NO_CAPABLE_AGENT" };
  }

  await sql.query(
    "update kanban_agent_tasks set status='pending',updated_at=now() where owner_user_id=$1 and id=$2 and status in ('pending','blocked')",
    [userId, request.taskId],
  );
  await appendAgentEvent(userId, {
    taskId: request.taskId,
    agentId: selected.id,
    eventType: "assigned",
    fromState: "pending",
    toState: "pending",
    payload: { capability, reason: request.preferredAgentId ? "preferred_match" : "capability_match" },
  });

  return {
    assigned: true,
    taskId: request.taskId,
    agentId: selected.id,
    capability,
    reason: request.preferredAgentId ? "preferred_match" : "capability_match",
  };
}
