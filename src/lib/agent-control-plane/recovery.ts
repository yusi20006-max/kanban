import { z } from "zod";
import { getSql } from "@/lib/db";

const retrySchema=z.object({executionId:z.string().trim().min(1).max(128)});
const executionIdSchema=z.string().trim().min(1).max(128);

export async function retryExecution(userId:string,input:unknown){
  const data=retrySchema.parse(input); const sql=await getSql();
  return sql.transaction(async(tx)=>{
    const rows=await tx.query<{task_id:string;agent_id:string;status:string}>("select task_id,agent_id,status from kanban_agent_executions where id=$1 and owner_user_id=$2 for update",[data.executionId,userId]);
    if(!rows[0]) throw new Error("EXECUTION_NOT_FOUND");
    if(!["failed","timed_out"].includes(rows[0].status)) throw new Error("EXECUTION_NOT_RETRYABLE");
    await tx.query("update kanban_agent_tasks set status='pending',updated_at=now() where id=$1 and owner_user_id=$2",[rows[0].task_id,userId]);
    await tx.query("update kanban_agent_leases set status='released',released_at=now() where task_id=$1 and owner_user_id=$2 and status='active'",[rows[0].task_id,userId]);
    return {taskId:rows[0].task_id,previousExecutionId:data.executionId,status:"pending" as const};
  });
}

export async function timeoutExecution(userId:string,executionId:string){
  executionIdSchema.parse(executionId); const sql=await getSql();
  return sql.transaction(async(tx)=>{
    const rows=await tx.query<{task_id:string;agent_id:string;status:string;deadline_at:string|null}>("select task_id,agent_id,status,deadline_at from kanban_agent_executions where id=$1 and owner_user_id=$2 for update",[executionId,userId]);
    if(!rows[0]) throw new Error("EXECUTION_NOT_FOUND");
    if(rows[0].status!=="running") return {executionId,status:rows[0].status};
    if(!rows[0].deadline_at || new Date(rows[0].deadline_at).getTime()>Date.now()) throw new Error("EXECUTION_NOT_DUE");
    const ended=new Date().toISOString();
    await tx.query("update kanban_agent_executions set status='timed_out',ended_at=$1,updated_at=now() where id=$2",[ended,executionId]);
    await tx.query("update kanban_agent_tasks set status='failed',updated_at=now() where id=$1 and owner_user_id=$2 and status='running'",[rows[0].task_id,userId]);
    await tx.query("update kanban_agent_leases set status='expired' where task_id=$1 and owner_user_id=$2 and status='active'",[rows[0].task_id,userId]);
    await tx.query("update kanban_agents set status='ready',updated_at=now() where owner_user_id=$1 and id=$2 and status='busy'",[userId,rows[0].agent_id]);
    return {executionId,status:"timed_out" as const,endedAt:ended};
  });
}

export async function cancelExecution(userId:string,executionId:string){
  executionIdSchema.parse(executionId); const sql=await getSql();
  return sql.transaction(async(tx)=>{
    const rows=await tx.query<{task_id:string;agent_id:string;status:string}>("select task_id,agent_id,status from kanban_agent_executions where id=$1 and owner_user_id=$2 for update",[executionId,userId]);
    if(!rows[0]) throw new Error("EXECUTION_NOT_FOUND");
    if(rows[0].status!=="running") return {executionId,status:rows[0].status};
    await tx.query("update kanban_agent_executions set status='cancelled',ended_at=now(),updated_at=now() where id=$1",[executionId]);
    await tx.query("update kanban_agent_tasks set status='cancelled',updated_at=now() where id=$1 and owner_user_id=$2 and status='running'",[rows[0].task_id,userId]);
    await tx.query("update kanban_agent_leases set status='released',released_at=now() where task_id=$1 and owner_user_id=$2 and status='active'",[rows[0].task_id,userId]);
    await tx.query("update kanban_agents set status='ready',updated_at=now() where owner_user_id=$1 and id=$2 and status='busy'",[userId,rows[0].agent_id]);
    return {executionId,status:"cancelled" as const};
  });
}
