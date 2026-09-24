import { z } from "zod";
import { getSql } from "@/lib/db";

export const agentRoleSchema = z.enum(["planner","coder","test","security","review"]);
export const assignAgentRoleSchema = z.object({
  agentId:z.string().trim().min(1).max(128),
  role:agentRoleSchema,
  capabilities:z.array(z.string().trim().min(1).max(128)).max(100).default([]),
});

export async function assignAgentRole(userId:string,input:unknown){
  const d=assignAgentRoleSchema.parse(input),sql=await getSql();
  const agent=await sql.query("select id,status from kanban_agents where id=$1 and owner_user_id=$2",[d.agentId,userId]);
  if(!agent[0]) throw new Error("AGENT_NOT_FOUND");
  if(agent[0].status==="disabled") throw new Error("AGENT_DISABLED");
  const id=crypto.randomUUID();
  const rows=await sql.query(
    "insert into kanban_agent_roles(id,owner_user_id,agent_id,role,capabilities) values($1,$2,$3,$4,$5::jsonb) on conflict(owner_user_id,agent_id) do update set role=excluded.role,capabilities=excluded.capabilities,updated_at=now() returning id,agent_id as \"agentId\",role,capabilities",
    [id,userId,d.agentId,d.role,JSON.stringify(d.capabilities)]
  );
  return rows[0];
}

export async function listAgentRoles(userId:string){
  const sql=await getSql();
  return sql.query("select id,agent_id as \"agentId\",role,capabilities,assigned_at as \"assignedAt\",updated_at as \"updatedAt\" from kanban_agent_roles where owner_user_id=$1 order by role,agent_id",[userId]);
}

export async function findAgentsForRole(userId:string,role:string){
  const parsed=agentRoleSchema.parse(role),sql=await getSql();
  return sql.query("select r.agent_id as \"agentId\",r.role,r.capabilities,a.name,a.status,a.last_seen_at as \"lastSeenAt\" from kanban_agent_roles r join kanban_agents a on a.id=r.agent_id and a.owner_user_id=r.owner_user_id where r.owner_user_id=$1 and r.role=$2 and a.status not in ('disabled','offline') order by a.status,a.id",[userId,parsed]);
}


export const plannerNodeSchema=z.object({
  taskId:z.string().trim().min(1).max(128),
  title:z.string().trim().min(1).max(500),
  role:agentRoleSchema.nullable().default(null),
  acceptanceCriteria:z.array(z.string().trim().min(1).max(2000)).max(50).default([]),
  dependsOn:z.array(z.string().trim().min(1).max(128)).max(100).default([]),
});
export const plannerSchema=z.object({
  title:z.string().trim().min(1).max(500),
  sourceTaskId:z.string().trim().min(1).max(128).nullable().default(null),
  nodes:z.array(plannerNodeSchema).min(1).max(200),
});

export async function createPlannerGraph(userId:string,input:unknown){
  const d=plannerSchema.parse(input),sql=await getSql(),planId=crypto.randomUUID();
  if(d.sourceTaskId){
    const r=await sql.query("select id from kanban_agent_tasks where id=$1 and owner_user_id=$2",[d.sourceTaskId,userId]);
    if(!r[0]) throw new Error("TASK_NOT_FOUND");
  }
  return sql.transaction(async tx=>{
    await tx.query("insert into kanban_orchestration_plans(id,owner_user_id,title,source_task_id) values($1,$2,$3,$4)",[planId,userId,d.title,d.sourceTaskId]);
    const ids=new Set(d.nodes.map(n=>n.taskId));
    for(let i=0;i<d.nodes.length;i++){
      const n=d.nodes[i];
      if(!ids.has(n.taskId)) throw new Error("INVALID_PLAN_NODE");
      await tx.query("insert into kanban_agent_tasks(id,owner_user_id,title) values($1,$2,$3) on conflict(id) do nothing",[n.taskId,userId,n.title]);
      await tx.query("insert into kanban_orchestration_plan_nodes(id,owner_user_id,plan_id,task_id,role,acceptance_criteria,position) values($1,$2,$3,$4,$5,$6::jsonb,$7)",[crypto.randomUUID(),userId,planId,n.taskId,n.role,JSON.stringify(n.acceptanceCriteria),i]);
      for(const dep of n.dependsOn){
        if(!ids.has(dep)) throw new Error("INVALID_PLAN_DEPENDENCY");
        await tx.query("insert into kanban_orchestration_dependencies(plan_id,owner_user_id,task_id,depends_on_task_id) values($1,$2,$3,$4)",[planId,userId,n.taskId,dep]);
      }
    }
    return {planId,title:d.title,nodeCount:d.nodes.length,status:"planned" as const};
  });
}
export async function getPlannerGraph(userId:string,planId:string){
  const sql=await getSql();
  const p=await sql.query("select id,title,source_task_id as \"sourceTaskId\",status,created_at as \"createdAt\",updated_at as \"updatedAt\" from kanban_orchestration_plans where id=$1 and owner_user_id=$2",[planId,userId]);
  if(!p[0]) throw new Error("PLAN_NOT_FOUND");
  const nodes=await sql.query("select task_id as \"taskId\",role,acceptance_criteria as \"acceptanceCriteria\",position from kanban_orchestration_plan_nodes where plan_id=$1 and owner_user_id=$2 order by position",[planId,userId]);
  const deps=await sql.query("select task_id as \"taskId\",depends_on_task_id as \"dependsOnTaskId\" from kanban_orchestration_dependencies where plan_id=$1 and owner_user_id=$2",[planId,userId]);
  return {...p[0],nodes,dependencies:deps};
}
