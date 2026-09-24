import { z } from "zod";
import { getSql } from "@/lib/db";

export const throughputMetricsInputSchema=z.object({
  from:z.coerce.date(),
  to:z.coerce.date(),
  boardId:z.string().trim().min(1).max(128).optional(),
  agentId:z.string().trim().min(1).max(128).optional(),
});
export type ThroughputMetricsInput=z.infer<typeof throughputMetricsInputSchema>;

export async function measureThroughputAndCycleTime(userId:string,input:unknown){
  const data=throughputMetricsInputSchema.parse(input);
  if(data.to<=data.from) throw new Error("INVALID_TIME_RANGE");
  const sql=await getSql();
  const params:unknown[]=[userId,data.from.toISOString(),data.to.toISOString()];
  const filters=["e.owner_user_id=$1","e.status='succeeded'","e.ended_at >= $2","e.ended_at < $3"];
  if(data.boardId){params.push(data.boardId);filters.push("t.board_id=$"+params.length);}
  if(data.agentId){params.push(data.agentId);filters.push("e.agent_id=$"+params.length);}
  const query="select count(distinct e.task_id) as \"completedTasks\", count(*) as \"successfulExecutions\","+
    " avg(extract(epoch from (e.ended_at-t.created_at))*1000) as \"avgCycleTimeMs\","+
    " percentile_cont(0.5) within group(order by extract(epoch from (e.ended_at-t.created_at))*1000) as \"p50CycleTimeMs\","+
    " min(extract(epoch from (e.ended_at-t.created_at))*1000) as \"minCycleTimeMs\","+
    " max(extract(epoch from (e.ended_at-t.created_at))*1000) as \"maxCycleTimeMs\""+
    " from kanban_agent_executions e join kanban_agent_tasks t on t.id=e.task_id where "+filters.join(" and ");
  const rows=await sql.query(query,params);
  const row=rows[0] as Record<string,unknown>|undefined;
  return {
    from:data.from.toISOString(),to:data.to.toISOString(),
    throughput:{completedTasks:Number(row?.completedTasks??0),successfulExecutions:Number(row?.successfulExecutions??0)},
    cycleTimeMs:{avg:Number(row?.avgCycleTimeMs??0),p50:Number(row?.p50CycleTimeMs??0),min:Number(row?.minCycleTimeMs??0),max:Number(row?.maxCycleTimeMs??0)},
    definitions:{throughput:"distinct tasks with a succeeded execution ending inside [from,to)",cycleTime:"task.created_at to successful execution.ended_at"},
  };
}
