import { z } from "zod";
import { getSql } from "@/lib/db";
import { claimTaskSchema, taskIdSchema } from "./contracts";
import { AgentRegistryError } from "./registry";
import { appendAgentEvent } from "./history";
import { recordTelemetry } from "@/lib/observability/telemetry";

export class LeaseError extends Error {
  constructor(public readonly code: "TASK_NOT_FOUND" | "TASK_NOT_CLAIMABLE" | "LEASE_NOT_FOUND" | "LEASE_NOT_OWNER") { super(code); this.name = "LeaseError"; }
}

const createTaskSchema = z.object({
  taskId: taskIdSchema,
  title: z.string().trim().min(1).max(500),
  boardId: z.string().trim().min(1).max(128).nullable().default(null),
  cardId: z.string().trim().min(1).max(128).nullable().default(null),
});

export async function createAgentTask(userId: string, input: unknown) {
  const data = createTaskSchema.parse(input);
  const sql = await getSql();
  await sql.query("insert into kanban_agent_tasks(id,owner_user_id,board_id,card_id,title) values($1,$2,$3,$4,$5)", [data.taskId,userId,data.boardId,data.cardId,data.title]);
  await appendAgentEvent(userId,{taskId:data.taskId,eventType:'created',fromState:null,toState:'pending',payload:{title:data.title}});
  return { id: data.taskId, status: "pending" as const };
}

export async function claimTask(userId: string, input: unknown) {
  const data = claimTaskSchema.parse(input);
  const sql = await getSql();
  const agent = await sql.query<{id:string;status:string}>("select id,status from kanban_agents where owner_user_id=$1 and id=$2",[userId,data.agentId]);
  if (!agent[0]) throw new AgentRegistryError("AGENT_NOT_FOUND");
  if (agent[0].status === "disabled") throw new AgentRegistryError("AGENT_DISABLED");
  if (data.idempotencyKey) {
    const prior = await sql.query<{result:{taskId:string;agentId:string;leaseId:string;acquiredAt:string;expiresAt:string}}>("select result from kanban_idempotency where actor_user_id=$1 and operation_key=$2 and action='agent.claim'",[userId,data.idempotencyKey]);
    if (prior[0]) return prior[0].result;
  }
  return sql.transaction(async (tx) => {
    const task = await tx.query<{id:string;status:string}>("select id,status from kanban_agent_tasks where id=$1 and owner_user_id=$2 for update",[data.taskId,userId]);
    if (!task[0]) throw new LeaseError("TASK_NOT_FOUND");
    const active = await tx.query<{id:string;agent_id:string;expires_at:string}>("select id,agent_id,expires_at from kanban_agent_leases where task_id=$1 and status='active' for update",[data.taskId]);
    if (active[0]) {
      if (new Date(active[0].expires_at).getTime() > Date.now()) throw new LeaseError("TASK_NOT_CLAIMABLE");
      await tx.query("update kanban_agent_leases set status='expired' where id=$1",[active[0].id]);
    }
    if (!["pending","failed","blocked"].includes(task[0].status)) throw new LeaseError("TASK_NOT_CLAIMABLE");
    const leaseId=crypto.randomUUID();
    const acquiredAt=new Date();
    const expiresAt=new Date(acquiredAt.getTime()+data.leaseTtlSeconds*1000);
    await tx.query("insert into kanban_agent_leases(id,owner_user_id,task_id,agent_id,status,acquired_at,expires_at) values($1,$2,$3,$4,'active',$5,$6)",[leaseId,userId,data.taskId,data.agentId,acquiredAt.toISOString(),expiresAt.toISOString()]);
    await tx.query("update kanban_agent_tasks set status='claimed',updated_at=now() where id=$1",[data.taskId]);
    await appendAgentEvent(userId,{taskId:data.taskId,agentId:data.agentId,eventType:'claimed',fromState:task[0].status,toState:'claimed',payload:{leaseId}},tx);
    await recordTelemetry(userId,{taskId:data.taskId,agentId:data.agentId,eventType:"task.claimed",fromState:task[0].status,toState:"claimed",payload:{leaseId}},tx);
    const value={taskId:data.taskId,agentId:data.agentId,leaseId,acquiredAt:acquiredAt.toISOString(),expiresAt:expiresAt.toISOString()};
    if(data.idempotencyKey) await tx.query("insert into kanban_idempotency(actor_user_id,operation_key,action,result) values($1,$2,'agent.claim',$3::jsonb)",[userId,data.idempotencyKey,JSON.stringify(value)]);
    return value;
  });
}

export async function releaseLease(userId: string, leaseId: string, agentId: string) {
  const sql=await getSql();
  return sql.transaction(async (tx)=>{
    const rows=await tx.query<{id:string;task_id:string;agent_id:string;status:string}>("select id,task_id,agent_id,status from kanban_agent_leases where id=$1 and owner_user_id=$2 for update",[leaseId,userId]);
    if(!rows[0]) throw new LeaseError("LEASE_NOT_FOUND");
    if(rows[0].agent_id!==agentId) throw new LeaseError("LEASE_NOT_OWNER");
    if(rows[0].status!=="active") return {leaseId,status:rows[0].status};
    await tx.query("update kanban_agent_leases set status='released',released_at=now() where id=$1",[leaseId]);
    await tx.query("update kanban_agent_tasks set status='pending',updated_at=now() where id=$1 and owner_user_id=$2 and status='claimed'",[rows[0].task_id,userId]);
    await appendAgentEvent(userId,{taskId:rows[0].task_id,agentId, eventType:'released',fromState:'claimed',toState:'pending',payload:{leaseId}},tx);
    await recordTelemetry(userId,{taskId:rows[0].task_id,agentId,eventType:"lease.released",fromState:"claimed",toState:"pending",payload:{leaseId}},tx);
    return {leaseId,status:"released" as const,taskId:rows[0].task_id};
  });
}
