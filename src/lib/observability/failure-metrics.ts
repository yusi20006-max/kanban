import { z } from "zod";
import { getSql } from "@/lib/db";

export const failureMetricsInputSchema=z.object({
  from:z.coerce.date(),to:z.coerce.date(),
  boardId:z.string().trim().min(1).max(128).optional(),
  agentId:z.string().trim().min(1).max(128).optional(),
});

export async function measureFailureMetrics(userId:string,input:unknown){
  const data=failureMetricsInputSchema.parse(input);
  if(data.to<=data.from) throw new Error("INVALID_TIME_RANGE");
  const sql=await getSql();
  const params:unknown[]=[userId,data.from.toISOString(),data.to.toISOString()];
  const filters=["e.owner_user_id=$1","e.ended_at >= $2","e.ended_at < $3"];
  if(data.boardId){params.push(data.boardId);filters.push("t.board_id=$"+params.length);}
  if(data.agentId){params.push(data.agentId);filters.push("e.agent_id=$"+params.length);}
  const rows=await sql.query(
    "select count(*) filter(where e.status='failed') as \"failedExecutions\","+
    " count(*) filter(where e.status='timed_out') as \"timeouts\","+
    " count(*) filter(where e.status='cancelled') as \"cancellations\","+
    " count(*) filter(where e.attempt>1) as \"retries\","+
    " count(distinct e.task_id) filter(where e.status in ('failed','timed_out')) as \"failedTasks\""+
    " from kanban_agent_executions e join kanban_agent_tasks t on t.id=e.task_id where "+filters.join(" and "),
    params);
  const ciParams:unknown[]=[userId,data.from.toISOString(),data.to.toISOString()];
  const ciFilters=["owner_user_id=$1","ci_observed_at >= $2","ci_observed_at < $3","ci_state='failure'"];
  if(data.boardId){ciParams.push(data.boardId);ciFilters.push("board_id=$"+ciParams.length);}
  const ci=await sql.query("select count(*) as \"ciFailures\" from kanban_github_deliveries where "+ciFilters.join(" and "),ciParams);
  const row=rows[0] as Record<string,unknown>|undefined;
  return {
    from:data.from.toISOString(),to:data.to.toISOString(),
    failures:{failedExecutions:Number(row?.failedExecutions??0),failedTasks:Number(row?.failedTasks??0),retries:Number(row?.retries??0),timeouts:Number(row?.timeouts??0),cancellations:Number(row?.cancellations??0),ciFailures:Number((ci[0] as Record<string,unknown>|undefined)?.ciFailures??0)},
    definitions:{failedExecutions:"executions ending with status failed",retries:"execution attempts with attempt > 1",timeouts:"executions ending timed_out",cancellations:"executions ending cancelled",ciFailures:"GitHub delivery records observed with ci_state=failure"},
  };
}
