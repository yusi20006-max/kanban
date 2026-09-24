import { z } from "zod";
import { getSql } from "@/lib/db";

const schema=z.object({
  parentTaskId:z.string().trim().min(1).max(128),
  childTaskId:z.string().trim().min(1).max(128),
  title:z.string().trim().min(1).max(500),
  boardId:z.string().trim().min(1).max(128).nullable().default(null),
  cardId:z.string().trim().min(1).max(128).nullable().default(null),
  parentExecutionId:z.string().trim().min(1).max(128).nullable().default(null),
});

export async function delegateTask(userId:string,input:unknown){
  const data=schema.parse(input); if(data.parentTaskId===data.childTaskId) throw new Error("INVALID_DELEGATION");
  const sql=await getSql();
  return sql.transaction(async(tx)=>{
    const parent=await tx.query("select id from kanban_agent_tasks where id=$1 and owner_user_id=$2",[data.parentTaskId,userId]);
    if(!parent[0]) throw new Error("TASK_NOT_FOUND");
    if(data.parentExecutionId){
      const execution=await tx.query("select id from kanban_agent_executions where id=$1 and task_id=$2 and owner_user_id=$3",[data.parentExecutionId,data.parentTaskId,userId]);
      if(!execution[0]) throw new Error("EXECUTION_NOT_FOUND");
    }
    const child=await tx.query("select id from kanban_agent_tasks where id=$1 and owner_user_id=$2",[data.childTaskId,userId]);
    if(!child[0]) await tx.query("insert into kanban_agent_tasks(id,owner_user_id,board_id,card_id,title) values($1,$2,$3,$4,$5)",[data.childTaskId,userId,data.boardId,data.cardId,data.title]);
    else await tx.query("update kanban_agent_tasks set title=$1 where id=$2 and owner_user_id=$3",[data.title,data.childTaskId,userId]);
    const id=crypto.randomUUID();
    await tx.query("insert into kanban_agent_delegations(id,owner_user_id,parent_task_id,child_task_id,parent_execution_id) values($1,$2,$3,$4,$5) on conflict(parent_task_id,child_task_id) do update set parent_execution_id=excluded.parent_execution_id",[id,userId,data.parentTaskId,data.childTaskId,data.parentExecutionId]);
    return {delegationId:id,parentTaskId:data.parentTaskId,childTaskId:data.childTaskId,parentExecutionId:data.parentExecutionId};
  });
}

export async function listDelegations(userId:string,taskId:string){
  const sql=await getSql();
  return sql.query("select id,parent_task_id,child_task_id,parent_execution_id,child_execution_id,created_at from kanban_agent_delegations where owner_user_id=$1 and (parent_task_id=$2 or child_task_id=$2) order by created_at",[userId,taskId]);
}


export async function linkChildExecution(userId:string,delegationId:string,childExecutionId:string){
  const sql=await getSql();
  const result=await sql.query("update kanban_agent_delegations d set child_execution_id=$1 where d.id=$2 and d.owner_user_id=$3 and exists(select 1 from kanban_agent_executions e where e.id=$1 and e.task_id=d.child_task_id and e.owner_user_id=$3)",[childExecutionId,delegationId,userId]);
  if(!result.length) throw new Error("DELEGATION_NOT_FOUND");
  return {delegationId,childExecutionId};
}
