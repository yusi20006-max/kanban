import { z } from "zod";
import { getSql } from "@/lib/db";
import { agentRegistrationSchema, type AgentStatus } from "./contracts";
import { appendAgentEvent } from "./history";

type JsonScalar = string | number | boolean | null;
type AgentMetadata = Record<string, JsonScalar>;
type AgentRecord = { id:string; name:string; capabilities:string[]; metadata:AgentMetadata; status:AgentStatus; last_seen_at:string|null; created_at:string; updated_at:string };

export class AgentRegistryError extends Error {
  constructor(public readonly code: "AGENT_NOT_FOUND" | "AGENT_DISABLED") { super(code); this.name = "AgentRegistryError"; }
}

export async function registerAgent(userId: string, input: z.infer<typeof agentRegistrationSchema>) {
  const data = agentRegistrationSchema.parse(input);
  const sql = await getSql();
  const existing = await sql.query<{ id: string; status: AgentStatus }>(
    "select id,status from kanban_agents where owner_user_id=$1 and id=$2",
    [userId, data.agentId],
  );
  if (existing[0]?.status === "disabled") throw new AgentRegistryError("AGENT_DISABLED");
  if (existing[0]) {
    await sql.query(
      "update kanban_agents set name=$1,capabilities=$2::jsonb,metadata=$3::jsonb,status='ready',updated_at=now() where owner_user_id=$4 and id=$5",
      [data.name, JSON.stringify(data.capabilities), JSON.stringify(data.metadata), userId, data.agentId],
    );
    await appendAgentEvent(userId,{agentId:data.agentId,eventType:'registered',fromState:existing[0].status,toState:'ready',payload:{name:data.name}});
    return { id: data.agentId, status: "ready" as const, updated: true };
  }
  await sql.query(
    "insert into kanban_agents(id,owner_user_id,name,capabilities,metadata,status,last_seen_at) values($1,$2,$3,$4::jsonb,$5::jsonb,'ready',now())",
    [data.agentId, userId, data.name, JSON.stringify(data.capabilities), JSON.stringify(data.metadata)],
  );
  await appendAgentEvent(userId,{agentId:data.agentId,eventType:'registered',fromState:'registered',toState:'ready',payload:{name:data.name}});
  return { id: data.agentId, status: "ready" as const, updated: false };
}

export async function unregisterAgent(userId: string, agentId: string) {
  const sql = await getSql();
  const result = await sql.query(
    "update kanban_agents set status='disabled',updated_at=now() where owner_user_id=$1 and id=$2 and status<>'disabled'",
    [userId, agentId],
  );
  if (!result.length) throw new AgentRegistryError("AGENT_NOT_FOUND");
  await appendAgentEvent(userId,{agentId,eventType:'disabled',fromState:'ready',toState:'disabled',payload:{}});
  return { id: agentId, status: "disabled" as const };
}

export async function listAgents(userId: string): Promise<AgentRecord[]> {
  const sql = await getSql();
  const rows=await sql.query<AgentRecord>("select id,name,capabilities,metadata,status,last_seen_at,created_at,updated_at from kanban_agents where owner_user_id=$1 order by created_at,id",[userId]);
  return rows.map(row=>({...row,capabilities:Array.isArray(row.capabilities)?row.capabilities.map(String):[],metadata:(row.metadata&&typeof row.metadata==="object"?row.metadata:{}) as AgentMetadata}));
}

export async function getAgent(userId: string, agentId: string): Promise<AgentRecord> {
  const sql = await getSql();
  const rows = await sql.query<AgentRecord>("select id,name,capabilities,metadata,status,last_seen_at,created_at,updated_at from kanban_agents where owner_user_id=$1 and id=$2",[userId, agentId]);
  if (!rows[0]) throw new AgentRegistryError("AGENT_NOT_FOUND");
  const row=rows[0]; return {...row,capabilities:Array.isArray(row.capabilities)?row.capabilities.map(String):[],metadata:(row.metadata&&typeof row.metadata==="object"?row.metadata:{}) as AgentMetadata};
}
