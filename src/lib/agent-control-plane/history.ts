import { z } from "zod";
import { getSql } from "@/lib/db";

const eventSchema=z.object({
  taskId:z.string().trim().min(1).max(128).nullable().default(null),
  executionId:z.string().trim().min(1).max(128).nullable().default(null),
  agentId:z.string().trim().min(1).max(128).nullable().default(null),
  eventType:z.string().trim().min(1).max(100),
  fromState:z.string().nullable().default(null),
  toState:z.string().nullable().default(null),
  payload:z.record(z.string(),z.unknown()).default({}),
});

export async function appendAgentEvent(userId:string,input:unknown,sqlArg?:Awaited<ReturnType<typeof getSql>>){
  const data=eventSchema.parse(input); const sql=sqlArg??await getSql();
  await sql.query("insert into kanban_agent_execution_events(id,owner_user_id,task_id,execution_id,agent_id,event_type,from_state,to_state,payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",[crypto.randomUUID(),userId,data.taskId,data.executionId,data.agentId,data.eventType,data.fromState,data.toState,JSON.stringify(data.payload)]);
}

type HistoryRow={id:string;task_id:string|null;execution_id:string|null;agent_id:string|null;event_type:string;from_state:string|null;to_state:string|null;payload:unknown;created_at:string};
function serialise(rows:HistoryRow[]){return rows.map(row=>({...row,payload:JSON.stringify(row.payload??{})}));}
export async function listExecutionHistory(userId:string,executionId:string):Promise<Array<Omit<HistoryRow,"payload">&{payload:string}>>{
  const sql=await getSql();
  const rows=await sql.query<HistoryRow>("select id,task_id,execution_id,agent_id,event_type,from_state,to_state,payload,created_at from kanban_agent_execution_events where owner_user_id=$1 and execution_id=$2 order by created_at,id",[userId,executionId]); return serialise(rows);
}

export async function listTaskHistory(userId:string,taskId:string):Promise<Array<Omit<HistoryRow,"payload">&{payload:string}>>{
  const sql=await getSql();
  const rows=await sql.query<HistoryRow>("select id,task_id,execution_id,agent_id,event_type,from_state,to_state,payload,created_at from kanban_agent_execution_events where owner_user_id=$1 and task_id=$2 order by created_at,id",[userId,taskId]); return serialise(rows);
}
