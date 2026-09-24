import { z } from "zod";
import { getSql } from "@/lib/db";
import { createAgentTask } from "@/lib/agent-control-plane/lease";
const schema=z.object({failureSignalId:z.string().trim().min(1).max(128)});
export async function createRemediationTask(userId:string,input:unknown){
 const d=schema.parse(input); const sql=await getSql();
 const signal=await sql.query<{id:string;task_id:string|null;failure_type:string;evidence:Record<string,unknown>}>("select id,task_id,failure_type,evidence from kanban_failure_signals where id=$1 and owner_user_id=$2",[d.failureSignalId,userId]);
 if(!signal[0]) throw new Error("FAILURE_SIGNAL_NOT_FOUND");
 const existing=await sql.query<{id:string;task_id:string;status:string}>("select id,task_id,status from kanban_remediation_tasks where owner_user_id=$1 and failure_signal_id=$2 and status='active'",[userId,d.failureSignalId]);
 if(existing[0]) return {remediationId:existing[0].id,taskId:existing[0].task_id,idempotent:true};
 const taskId=crypto.randomUUID();
 await createAgentTask(userId,{taskId,title:"Remediate "+signal[0].failure_type+": "+d.failureSignalId,boardId:null,cardId:signal[0].task_id});
 const remediationId=crypto.randomUUID();
 await sql.query("insert into kanban_remediation_tasks(id,owner_user_id,failure_signal_id,task_id) values($1,$2,$3,$4)",[remediationId,userId,d.failureSignalId,taskId]);
 return {remediationId,taskId,idempotent:false};
}
export async function listRemediationTasks(userId:string){const sql=await getSql();return sql.query("select r.id as \"remediationId\",r.failure_signal_id as \"failureSignalId\",r.task_id as \"taskId\",r.status,r.created_at as \"createdAt\",r.resolved_at as \"resolvedAt\" from kanban_remediation_tasks r where r.owner_user_id=$1 order by r.created_at desc",[userId]);}
