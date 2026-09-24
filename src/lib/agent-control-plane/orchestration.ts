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

export const routeExecutionSchema=z.object({
  taskId:z.string().trim().min(1).max(128),
  role:agentRoleSchema,
  executionId:z.string().trim().min(1).max(128),
  leaseTtlSeconds:z.number().int().min(1).max(86400).default(300),
  timeoutSeconds:z.number().int().min(1).max(86400).nullable().default(null),
});
export async function routeSpecializedExecution(userId:string,input:unknown){
  const d=routeExecutionSchema.parse(input),sql=await getSql();
  const candidates=await findAgentsForRole(userId,d.role);
  const agent=candidates.find((a:any)=>a.status==="ready");
  if(!agent) throw new Error("NO_ELIGIBLE_AGENT");
  const claim=await import("./lease").then(m=>m.claimTask(userId,{taskId:d.taskId,agentId:agent.agentId,leaseTtlSeconds:d.leaseTtlSeconds,idempotencyKey:null}));
  const started=await import("./execution").then(m=>m.startExecution(userId,{executionId:d.executionId,taskId:d.taskId,agentId:agent.agentId,timeoutSeconds:d.timeoutSeconds}));
  await sql.query("insert into kanban_execution_roles(execution_id,owner_user_id,role,assigned_agent_id) values($1,$2,$3,$4)",[d.executionId,userId,d.role,agent.agentId]);
  return {...started,role:d.role,leaseId:claim.leaseId};
}
export async function getExecutionRole(userId:string,executionId:string){
  const sql=await getSql();
  const rows=await sql.query("select execution_id as \"executionId\",role,assigned_agent_id as \"assignedAgentId\",created_at as \"createdAt\" from kanban_execution_roles where execution_id=$1 and owner_user_id=$2",[executionId,userId]);
  if(!rows[0]) throw new Error("EXECUTION_ROLE_NOT_FOUND");
  return rows[0];
}

export async function listSchedulableTasks(userId:string,planId:string){
  const sql=await getSql();
  return sql.query(`select n.task_id as "taskId",n.role,t.status from kanban_orchestration_plan_nodes n join kanban_agent_tasks t on t.id=n.task_id and t.owner_user_id=n.owner_user_id where n.plan_id=$1 and n.owner_user_id=$2 and t.status in ('pending','failed','blocked') and not exists (select 1 from kanban_agent_leases l where l.task_id=t.id and l.status='active' and l.expires_at>now()) and not exists (select 1 from kanban_orchestration_dependencies d join kanban_agent_tasks dep on dep.id=d.depends_on_task_id where d.plan_id=n.plan_id and d.task_id=n.task_id and dep.status<>'completed') order by n.position`,[planId,userId]);
}
export async function scheduleTask(userId:string,planId:string,taskId:string,agentId:string,leaseTtlSeconds=300){
  const sql=await getSql();
  return sql.transaction(async tx=>{
    const task=await tx.query<{id:string;status:string}>("select id,status from kanban_agent_tasks where id=$1 and owner_user_id=$2 for update",[taskId,userId]);
    if(!task[0]) throw new Error("TASK_NOT_FOUND");
    const plan=await tx.query("select id from kanban_orchestration_plans where id=$1 and owner_user_id=$2",[planId,userId]);
    if(!plan[0]) throw new Error("PLAN_NOT_FOUND");
    const deps=await tx.query<{status:string}>(`select dep.status from kanban_orchestration_dependencies d join kanban_agent_tasks dep on dep.id=d.depends_on_task_id where d.plan_id=$1 and d.task_id=$2 for update`,[planId,taskId]);
    if(deps.some(d=>d.status!=="completed")){
      await tx.query("insert into kanban_orchestration_schedule_events(id,owner_user_id,plan_id,task_id,agent_id,outcome,reason) values($1,$2,$3,$4,$5,'blocked','dependencies')",[crypto.randomUUID(),userId,planId,taskId,agentId]);
      throw new Error("DEPENDENCIES_NOT_SATISFIED");
    }
    const active=await tx.query<{id:string;expires_at:string}>( "select id,expires_at from kanban_agent_leases where task_id=$1 and status='active' for update",[taskId]);
    if(active[0] && new Date(active[0].expires_at).getTime()>Date.now()) {
      await tx.query("insert into kanban_orchestration_schedule_events(id,owner_user_id,plan_id,task_id,agent_id,outcome,reason) values($1,$2,$3,$4,$5,'duplicate','active_lease')",[crypto.randomUUID(),userId,planId,taskId,agentId]);
      throw new Error("TASK_ALREADY_LEASED");
    }
    if(!["pending","failed","blocked"].includes(task[0].status)) throw new Error("TASK_NOT_SCHEDULABLE");
    const agent=await tx.query<{id:string;status:string}>( "select id,status from kanban_agents where id=$1 and owner_user_id=$2 for update",[agentId,userId]);
    if(!agent[0]) throw new Error("AGENT_NOT_FOUND");
    if(!["ready","busy"].includes(agent[0].status)) throw new Error("AGENT_NOT_AVAILABLE");
    const now=new Date(),expires=new Date(now.getTime()+leaseTtlSeconds*1000),leaseId=crypto.randomUUID();
    await tx.query("insert into kanban_agent_leases(id,owner_user_id,task_id,agent_id,status,acquired_at,expires_at) values($1,$2,$3,$4,'active',$5,$6)",[leaseId,userId,taskId,agentId,now.toISOString(),expires.toISOString()]);
    await tx.query("update kanban_agent_tasks set status='claimed',updated_at=now() where id=$1",[taskId]);
    await tx.query("insert into kanban_orchestration_schedule_events(id,owner_user_id,plan_id,task_id,agent_id,outcome) values($1,$2,$3,$4,$5,'claimed')",[crypto.randomUUID(),userId,planId,taskId,agentId]);
    return {taskId,agentId,leaseId,expiresAt:expires.toISOString(),status:"claimed" as const};
  });
}
