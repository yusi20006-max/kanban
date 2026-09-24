import { z } from "zod";
import { getSql } from "@/lib/db";

export const agentUtilizationInputSchema=z.object({
  from:z.coerce.date(),to:z.coerce.date(),
  boardId:z.string().trim().min(1).max(128).optional(),
  agentId:z.string().trim().min(1).max(128).optional(),
});

export async function measureAgentUtilization(userId:string,input:unknown){
  const data=agentUtilizationInputSchema.parse(input);
  if(data.to<=data.from) throw new Error("INVALID_TIME_RANGE");
  const sql=await getSql();
  const params:unknown[]=[userId,data.from.toISOString(),data.to.toISOString()];
  const agentFilter=data.agentId?" and a.id=$4":"";
  if(data.agentId) params.push(data.agentId);
  const boardFilter=data.boardId?" and exists (select 1 from kanban_agent_tasks bt where bt.id=e.task_id and bt.board_id=$"+(params.length+1)+")":"";
  if(data.boardId) params.push(data.boardId);
  const query="select a.id as \"agentId\",a.name as \"agentName\","+
    " coalesce((select sum(extract(epoch from (least(coalesce(l.released_at,l.expires_at),$3::timestamptz)-greatest(l.acquired_at,$2::timestamptz)))*1000) from kanban_agent_leases l where l.owner_user_id=$1 and l.agent_id=a.id and l.acquired_at < $3::timestamptz and coalesce(l.released_at,l.expires_at) > $2::timestamptz),0) as \"activeMs\","+
    " coalesce((select sum(extract(epoch from (least(coalesce(e.ended_at,$3::timestamptz),$3::timestamptz)-greatest(e.started_at,$2::timestamptz)))*1000) from kanban_agent_executions e where e.owner_user_id=$1 and e.agent_id=a.id and e.started_at is not null and e.started_at < $3::timestamptz and coalesce(e.ended_at,$3::timestamptz) > $2::timestamptz"+boardFilter+"),0) as \"busyMs\","+
    " (select count(*) from kanban_agent_executions e where e.owner_user_id=$1 and e.agent_id=a.id and e.started_at is not null and e.started_at < $3::timestamptz and coalesce(e.ended_at,$3::timestamptz) > $2::timestamptz"+boardFilter+") as \"executionCount\""+
    " from kanban_agents a where a.owner_user_id=$1"+agentFilter+" order by a.id";
  const rows=await sql.query(query,params);
  const windowMs=data.to.getTime()-data.from.getTime();
  return {
    from:data.from.toISOString(),to:data.to.toISOString(),
    agents:(rows as Array<Record<string,unknown>>).map(row=>{
      const activeMs=Math.max(0,Number(row.activeMs??0));
      const busyMs=Math.min(activeMs,Math.max(0,Number(row.busyMs??0)));
      const idleMs=Math.max(0,activeMs-busyMs);
      return {agentId:row.agentId,agentName:row.agentName,activeMs,busyMs,idleMs,utilizationPct:activeMs?Number((busyMs/activeMs*100).toFixed(3)):0,executionCount:Number(row.executionCount??0)};
    }),
    windowMs,
    definitions:{active:"lease assignment time clipped to the requested window",busy:"execution running time clipped to the requested window",idle:"active minus busy; UI polling is not used"},
  };
}
