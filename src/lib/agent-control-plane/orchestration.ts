import { z } from "zod";
import { getSql } from "@/lib/db";

export const agentRoleSchema = z.enum(["planner","coder","test","security","review"]);
export const assignAgentRoleSchema = z.object({
  agentId:z.string().trim().min(1).max(128),
  role:agentRoleSchema,
  capabilities:z.array(z.string().trim().min(1).max(128)).max(100).default([]),
});

export async function assignAgentRole(userId:string,input:unknown){
  const d=assignAgentRoleSchema.parse(input),sql=await getSql();
  const agent=await sql.query("select id,status from kanban_agents where id=$1 and owner_user_id=$2",[d.agentId,userId]);
  if(!agent[0]) throw new Error("AGENT_NOT_FOUND");
  if(agent[0].status==="disabled") throw new Error("AGENT_DISABLED");
  const id=crypto.randomUUID();
  const rows=await sql.query(
    "insert into kanban_agent_roles(id,owner_user_id,agent_id,role,capabilities) values($1,$2,$3,$4,$5::jsonb) on conflict(owner_user_id,agent_id) do update set role=excluded.role,capabilities=excluded.capabilities,updated_at=now() returning id,agent_id as \"agentId\",role,capabilities",
    [id,userId,d.agentId,d.role,JSON.stringify(d.capabilities)]
  );
  return rows[0];
}

export async function listAgentRoles(userId:string){
  const sql=await getSql();
  return sql.query("select id,agent_id as \"agentId\",role,capabilities,assigned_at as \"assignedAt\",updated_at as \"updatedAt\" from kanban_agent_roles where owner_user_id=$1 order by role,agent_id",[userId]);
}

export async function findAgentsForRole(userId:string,role:string){
  const parsed=agentRoleSchema.parse(role),sql=await getSql();
  return sql.query("select r.agent_id as \"agentId\",r.role,r.capabilities,a.name,a.status,a.last_seen_at as \"lastSeenAt\" from kanban_agent_roles r join kanban_agents a on a.id=r.agent_id and a.owner_user_id=r.owner_user_id where r.owner_user_id=$1 and r.role=$2 and a.status not in ('disabled','offline') order by a.status,a.id",[userId,parsed]);
}
