import { z } from "zod";
import { getSql } from "@/lib/db";
import { executionStatusSchema } from "./contracts";
import { LeaseError } from "./lease";
import { AgentRegistryError } from "./registry";
import { appendAgentEvent } from "./history";
import { recordTelemetry } from "@/lib/observability/telemetry";

const startSchema=z.object({executionId:z.string().trim().min(1).max(128),taskId:z.string().trim().min(1).max(128),agentId:z.string().trim().min(1).max(128),timeoutSeconds:z.number().int().min(1).max(86_400).nullable().default(null)});
const finishSchema=z.object({executionId:z.string().trim().min(1).max(128),status:executionStatusSchema.extract(["succeeded","failed","timed_out","cancelled"]),result:z.record(z.string(),z.unknown()).nullable().default(null),error:z.record(z.string(),z.unknown()).nullable().default(null)});

async function assertAgent(sql: Awaited<ReturnType<typeof getSql>>, userId:string, agentId:string){
  const rows=await sql.query<{id:string;status:string}>("select id,status from kanban_agents where owner_user_id=$1 and id=$2",[userId,agentId]);
  if(!rows[0]) throw new AgentRegistryError("AGENT_NOT_FOUND");
  if(rows[0].status==="disabled") throw new AgentRegistryError("AGENT_DISABLED");
}

export async function startExecution(userId:string,input:unknown){
  const data=startSchema.parse(input); const sql=await getSql();
  await assertAgent(sql,userId,data.agentId);
  return sql.transaction(async(tx)=>{
    const lease=await tx.query<{id:string;agent_id:string;expires_at:string}>("select id,agent_id,expires_at from kanban_agent_leases where task_id=$1 and owner_user_id=$2 and status='active' for update",[data.taskId,userId]);
    if(!lease[0] || lease[0].agent_id!==data.agentId || new Date(lease[0].expires_at).getTime()<=Date.now()) throw new LeaseError("TASK_NOT_CLAIMABLE");
    const task=await tx.query<{status:string}>("select status from kanban_agent_tasks where id=$1 and owner_user_id=$2 for update",[data.taskId,userId]);
    if(!task[0]) throw new LeaseError("TASK_NOT_FOUND");
    if(!["claimed","running"].includes(task[0].status)) throw new LeaseError("TASK_NOT_CLAIMABLE");
    const attemptRows=await tx.query<{attempt:number|string}>("select coalesce(max(attempt),0)+1 as attempt from kanban_agent_executions where task_id=$1",[data.taskId]);
    const attempt=Number(attemptRows[0]?.attempt??1); const now=new Date(); const deadline=data.timeoutSeconds ? new Date(now.getTime()+data.timeoutSeconds*1000) : null;
    await tx.query("insert into kanban_agent_executions(id,owner_user_id,task_id,agent_id,attempt,status,started_at,deadline_at) values($1,$2,$3,$4,$5,'running',$6,$7)",[data.executionId,userId,data.taskId,data.agentId,attempt,now.toISOString(),deadline?.toISOString() ?? null]);
    await tx.query("update kanban_agent_tasks set status='running',updated_at=now() where id=$1",[data.taskId]);
    await appendAgentEvent(userId,{taskId:data.taskId,executionId:data.executionId,agentId:data.agentId,eventType:'started',fromState:'claimed',toState:'running',payload:{attempt}},tx);
    await tx.query("update kanban_agents set status='busy',updated_at=now() where owner_user_id=$1 and id=$2",[userId,data.agentId]);
    await recordTelemetry(userId,{taskId:data.taskId,executionId:data.executionId,agentId:data.agentId,eventType:"execution.started",fromState:"claimed",toState:"running",payload:{attempt}},tx);
    return {executionId:data.executionId,taskId:data.taskId,agentId:data.agentId,attempt,status:"running" as const,startedAt:now};
  });
}

export async function finishExecution(userId:string,input:unknown){
  const data=finishSchema.parse(input); const sql=await getSql();
  return sql.transaction(async(tx)=>{
    const rows=await tx.query<{task_id:string;agent_id:string;status:string}>("select task_id,agent_id,status from kanban_agent_executions where id=$1 and owner_user_id=$2 for update",[data.executionId,userId]);
    if(!rows[0]) throw new Error("EXECUTION_NOT_FOUND");
    if(rows[0].status!=="running") return {executionId:data.executionId,status:rows[0].status};
    const ended=new Date().toISOString();
    await tx.query("update kanban_agent_executions set status=$1,ended_at=$2,result=$3::jsonb,error=$4::jsonb,updated_at=now() where id=$5",[data.status,ended,JSON.stringify(data.result),JSON.stringify(data.error),data.executionId]);
    const taskStatus=data.status==="succeeded"?"completed":data.status==="cancelled"?"cancelled":"failed";
    await tx.query("update kanban_agent_tasks set status=$1,updated_at=now() where id=$2 and owner_user_id=$3 and status='running'",[taskStatus,rows[0].task_id,userId]);
    await appendAgentEvent(userId,{taskId:rows[0].task_id,executionId:data.executionId,agentId:rows[0].agent_id,eventType:data.status,fromState:'running',toState:data.status,payload:{result:data.result,error:data.error}},tx);
    await tx.query("update kanban_agents set status='ready',updated_at=now() where owner_user_id=$1 and id=$2 and status='busy'",[userId,rows[0].agent_id]);
    await recordTelemetry(userId,{taskId:rows[0].task_id,executionId:data.executionId,agentId:rows[0].agent_id,eventType:"execution.finished",fromState:"running",toState:data.status,payload:{result:data.result,error:data.error}},tx);
    return {executionId:data.executionId,status:data.status,endedAt:ended,taskStatus};
  });
}
