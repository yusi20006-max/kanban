import { z } from "zod";
import { getSql } from "@/lib/db";

export const bottleneckInputSchema=z.object({
  from:z.coerce.date(),to:z.coerce.date(),
  boardId:z.string().trim().min(1).max(128).optional(),
  queueAgeMinutes:z.number().positive().max(10080).default(30),
  leaseAgeMinutes:z.number().positive().max(10080).default(30),
  ciAgeMinutes:z.number().positive().max(10080).default(60),
  providerFailureCount:z.number().int().positive().max(1000).default(3),
});

export async function detectBottlenecks(userId:string,input:unknown){
  const data=bottleneckInputSchema.parse(input);
  if(data.to<=data.from) throw new Error("INVALID_TIME_RANGE");
  const sql=await getSql();
  const boardFilter=data.boardId?" and t.board_id=$4":"";
  const baseParams:unknown[]=[userId,data.from.toISOString(),data.to.toISOString()];
  if(data.boardId) baseParams.push(data.boardId);
  const findings:Array<Record<string,unknown>>=[];
  const queue=await sql.query("select t.id as \"taskId\",t.status,t.created_at as \"createdAt\",extract(epoch from ($3::timestamptz-t.created_at))/60 as \"ageMinutes\" from kanban_agent_tasks t where t.owner_user_id=$1 and t.status in ('pending','claimed') and t.created_at >= $2 and t.created_at < $3 and extract(epoch from ($3::timestamptz-t.created_at))/60 > "+data.queueAgeMinutes+boardFilter+" order by t.created_at",baseParams);
  for(const row of queue as Array<Record<string,unknown>>) findings.push({type:"queue",key:"task:"+row.taskId,evidence:row,rule:"pending/claimed task age exceeds queueAgeMinutes"});
  const deps=await sql.query("select d.task_id as \"taskId\",count(*)::int as \"unmetDependencies\" from kanban_orchestration_dependencies d join kanban_agent_tasks t on t.id=d.task_id join kanban_agent_tasks dep on dep.id=d.depends_on_task_id where d.owner_user_id=$1 and t.status not in ('completed','cancelled') and dep.status <> 'completed'"+(data.boardId?" and t.board_id=$4":"")+" group by d.task_id having count(*)>0",baseParams);
  for(const row of deps as Array<Record<string,unknown>>) findings.push({type:"dependency",key:"task:"+row.taskId,evidence:row,rule:"non-terminal task has one or more incomplete dependencies"});
  const ci=await sql.query("select repo,count(*)::int as \"failureCount\",max(ci_observed_at) as \"lastObservedAt\" from kanban_github_deliveries where owner_user_id=$1 and ci_state='failure' and ci_observed_at >= $2 and ci_observed_at < $3"+(data.boardId?" and board_id=$4":"")+" group by repo having count(*) >= "+data.providerFailureCount,baseParams);
  for(const row of ci as Array<Record<string,unknown>>) findings.push({type:"ci",key:"repo:"+row.repo,evidence:row,rule:"observed CI failure count meets providerFailureCount threshold"});
  const leases=await sql.query("select id as \"leaseId\",task_id as \"taskId\",agent_id as \"agentId\",expires_at as \"expiresAt\",extract(epoch from ($3::timestamptz-greatest(acquired_at,$2::timestamptz)))/60 as \"ageMinutes\" from kanban_agent_leases where owner_user_id=$1 and status='active' and acquired_at < $3 and expires_at > $2 and extract(epoch from ($3::timestamptz-greatest(acquired_at,$2::timestamptz)))/60 > "+data.leaseAgeMinutes,baseParams);
  for(const row of leases as Array<Record<string,unknown>>) findings.push({type:"agent",key:"lease:"+row.leaseId,evidence:row,rule:"active lease age exceeds leaseAgeMinutes"});
  const providers=await sql.query("select failed_model_id as \"modelId\",count(*)::int as \"failureCount\",max(created_at) as \"lastFailureAt\" from kanban_ai_fallback_attempts where owner_user_id=$1 and created_at >= $2 and created_at < $3 group by failed_model_id having count(*) >= "+data.providerFailureCount,baseParams.slice(0,3));
  for(const row of providers as Array<Record<string,unknown>>) findings.push({type:"provider",key:"model:"+row.modelId,evidence:row,rule:"fallback failures for a model meet providerFailureCount threshold"});
  return {from:data.from.toISOString(),to:data.to.toISOString(),thresholds:{queueAgeMinutes:data.queueAgeMinutes,leaseAgeMinutes:data.leaseAgeMinutes,ciAgeMinutes:data.ciAgeMinutes,providerFailureCount:data.providerFailureCount},findings,definitions:{queue:"pending/claimed task age",dependency:"incomplete dependency blocking a non-terminal task",ci:"repeated observed GitHub CI failures",agent:"long-lived active lease",provider:"repeated fallback failures for a model"},evidenceRequired:true};
}
