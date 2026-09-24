import { getSql } from "@/lib/db";
import { heartbeatSchema, type AgentStatus } from "./contracts";
import { AgentRegistryError } from "./registry";

export const DEFAULT_STALE_AFTER_SECONDS = 60;
export const DEFAULT_OFFLINE_AFTER_SECONDS = 300;

export function deriveLiveness(lastSeenAt: Date | string | null, now = new Date(), staleAfterSeconds = DEFAULT_STALE_AFTER_SECONDS, offlineAfterSeconds = DEFAULT_OFFLINE_AFTER_SECONDS): Extract<AgentStatus, "ready" | "stale" | "offline"> {
  if (!lastSeenAt) return "offline";
  const ageSeconds = Math.max(0, (now.getTime() - new Date(lastSeenAt).getTime()) / 1000);
  if (ageSeconds >= offlineAfterSeconds) return "offline";
  if (ageSeconds >= staleAfterSeconds) return "stale";
  return "ready";
}

export async function heartbeatAgent(userId: string, input: unknown) {
  const data = heartbeatSchema.parse(input);
  const sql = await getSql();
  const rows = await sql.query<{ id: string; status: AgentStatus }>(
    "select id,status from kanban_agents where owner_user_id=$1 and id=$2",
    [userId, data.agentId],
  );
  if (!rows[0]) throw new AgentRegistryError("AGENT_NOT_FOUND");
  if (rows[0].status === "disabled") throw new AgentRegistryError("AGENT_DISABLED");
  const observedAt = data.observedAt ?? new Date();
  await sql.query(
    "update kanban_agents set last_seen_at=$1,status=case when status='busy' then 'busy' else 'ready' end,updated_at=now() where owner_user_id=$2 and id=$3",
    [observedAt.toISOString(), userId, data.agentId],
  );
  return { id: data.agentId, status: rows[0].status === "busy" ? "busy" : "ready", lastSeenAt: observedAt.toISOString() };
}

export async function listAgentsWithLiveness(userId: string, now = new Date()) {
  const sql = await getSql();
  const rows = await sql.query<{ id:string; name:string; capabilities:unknown; metadata:unknown; status:AgentStatus; last_seen_at:string|null; created_at:string; updated_at:string }>(
    "select id,name,capabilities,metadata,status,last_seen_at,created_at,updated_at from kanban_agents where owner_user_id=$1 order by created_at,id",
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    effectiveStatus: row.status === "disabled" ? "disabled" : row.status === "busy" ? "busy" : deriveLiveness(row.last_seen_at, now),
  }));
}
