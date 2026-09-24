import { z } from "zod";
import { getSql } from "@/lib/db";

export const modelUsageAnalyticsInputSchema=z.object({
  from:z.coerce.date(),to:z.coerce.date(),
  boardId:z.string().trim().min(1).max(128).optional(),
  taskId:z.string().trim().min(1).max(128).optional(),
  agentId:z.string().trim().min(1).max(128).optional(),
});

export async function aggregateModelUsageAnalytics(userId:string,input:unknown){
  const data=modelUsageAnalyticsInputSchema.parse(input);
  if(data.to<=data.from) throw new Error("INVALID_TIME_RANGE");
  const sql=await getSql();
  const params:unknown[]=[userId,data.from.toISOString(),data.to.toISOString()];
  const filters=["u.owner_user_id=$1","u.created_at >= $2","u.created_at < $3"];
  if(data.boardId){params.push(data.boardId);filters.push("t.board_id=$"+params.length);}
  if(data.taskId){params.push(data.taskId);filters.push("u.task_id=$"+params.length);}
  if(data.agentId){params.push(data.agentId);filters.push("e.agent_id=$"+params.length);}
  const rows=await sql.query(
    "select t.board_id as \"projectId\",u.task_id as \"taskId\",e.agent_id as \"agentId\",u.provider,u.model_id as \"modelId\",u.currency,"+
    " count(*)::int as \"usageRecords\",sum(u.input_tokens)::bigint as \"inputTokens\",sum(u.output_tokens)::bigint as \"outputTokens\",sum(u.units)::bigint as units,"+
    " avg(u.latency_ms)::numeric as \"avgLatencyMs\",sum(u.estimated_cost)::numeric as \"estimatedCost\""+
    " from kanban_ai_usage u join kanban_agent_executions e on e.id=u.execution_id join kanban_agent_tasks t on t.id=u.task_id"+
    " where "+filters.join(" and ")+" group by t.board_id,u.task_id,e.agent_id,u.provider,u.model_id,u.currency"+
    " order by t.board_id,u.task_id,e.agent_id,u.provider,u.model_id",
    params);
  return {
    from:data.from.toISOString(),to:data.to.toISOString(),
    rows,
    definitions:{project:"kanban_agent_tasks.board_id",usage:"persisted kanban_ai_usage rows linked to their execution and task",cost:"sum of persisted estimated_cost",latency:"average persisted latency_ms"},
  };
}
