import { z } from "zod";
import { getSql } from "@/lib/db";

export const telemetryEventSchema = z.object({
  taskId: z.string().trim().min(1).max(128).nullable().default(null),
  executionId: z.string().trim().min(1).max(128).nullable().default(null),
  agentId: z.string().trim().min(1).max(128).nullable().default(null),
  eventType: z.string().trim().min(1).max(128),
  fromState: z.string().trim().max(128).nullable().default(null),
  toState: z.string().trim().max(128).nullable().default(null),
  payload: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.coerce.date().optional(),
});
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export async function recordTelemetry(userId:string,input:unknown,sqlOverride?:Awaited<ReturnType<typeof getSql>>) {
  const data=telemetryEventSchema.parse(input);
  const sql=sqlOverride ?? await getSql();
  const id=crypto.randomUUID();
  await sql.query(
    "insert into kanban_execution_telemetry(id,owner_user_id,task_id,execution_id,agent_id,event_type,from_state,to_state,payload,occurred_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)",
    [id,userId,data.taskId,data.executionId,data.agentId,data.eventType,data.fromState,data.toState,JSON.stringify(data.payload), (data.occurredAt??new Date()).toISOString()],
  );
  return {id,...data,occurredAt:(data.occurredAt??new Date()).toISOString()};
}

export async function listTelemetry(userId:string,input?:{taskId?:string;executionId?:string;agentId?:string;eventType?:string;limit?:number}) {
  const sql=await getSql();
  const where=["owner_user_id=$1"], params:[unknown]=[userId];
  if(input?.taskId){params.push(input.taskId);where.push("task_id=$"+params.length);}
  if(input?.executionId){params.push(input.executionId);where.push("execution_id=$"+params.length);}
  if(input?.agentId){params.push(input.agentId);where.push("agent_id=$"+params.length);}
  if(input?.eventType){params.push(input.eventType);where.push("event_type=$"+params.length);}
  const limit=Math.min(Math.max(input?.limit??200,1),1000);
  return sql.query("select id,task_id as \"taskId\",execution_id as \"executionId\",agent_id as \"agentId\",event_type as \"eventType\",from_state as \"fromState\",to_state as \"toState\",payload,occurred_at as \"occurredAt\" from kanban_execution_telemetry where "+where.join(" and ")+" order by occurred_at,id limit "+limit,params);
}
