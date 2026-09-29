import { z } from "zod";
import { getSql } from "@/lib/db";
import { evaluateRetrySafety } from "./retry-safety";

const configSchema=z.object({
  maxAttempts:z.number().int().min(1).max(100).default(5),
  maxLoopSteps:z.number().int().min(1).max(1000).default(10),
  killSwitch:z.boolean().default(false),
  protectedBranches:z.array(z.string().min(1).max(200)).max(20).default(["main","master"]),
  backoffSeconds:z.number().int().min(0).max(86400).default(30),
});

export async function getSafetyConfig(userId:string){
  const sql=await getSql();
  const rows=await sql.query<{maxAttempts:number;maxLoopSteps:number;killSwitch:boolean;protectedBranches:string[];backoffSeconds:number}>(
    "select max_attempts as \"maxAttempts\",max_loop_steps as \"maxLoopSteps\",kill_switch as \"killSwitch\",protected_branches as \"protectedBranches\",coalesce((select 30),30) as \"backoffSeconds\" from kanban_self_healing_safety where owner_user_id=$1",
    [userId],
  );
  return rows[0]??{maxAttempts:5,maxLoopSteps:10,killSwitch:false,protectedBranches:["main","master"],backoffSeconds:30};
}

export async function setSafetyConfig(userId:string,input:unknown){
  const d=configSchema.parse(input);
  const sql=await getSql();
  await sql.query("insert into kanban_self_healing_safety(owner_user_id,max_attempts,max_loop_steps,kill_switch,protected_branches) values($1,$2,$3,$4,$5::jsonb) on conflict(owner_user_id) do update set max_attempts=excluded.max_attempts,max_loop_steps=excluded.max_loop_steps,kill_switch=excluded.kill_switch,protected_branches=excluded.protected_branches,updated_at=now()",
    [userId,d.maxAttempts,d.maxLoopSteps,d.killSwitch,JSON.stringify(d.protectedBranches)]);
  return d;
}

export async function assertRemediationSafe(userId:string,remediationId:string){
  const sql=await getSql();
  const c=await getSafetyConfig(userId);
  const r=await sql.query<{task_id:string;failure_signal_id:string;status:string;retry_after:string|null;context:Record<string,unknown>}>(
    "select task_id,failure_signal_id,status,retry_after,context from kanban_remediation_tasks where id=$1 and owner_user_id=$2",
    [remediationId,userId],
  );
  if(!r[0])throw new Error("REMEDIATION_NOT_FOUND");
  if(r[0].status!=="active")throw new Error("REMEDIATION_TERMINAL");
  const attempts=await sql.query<{attempts:string}>("select count(*)::int as attempts from kanban_agent_executions where owner_user_id=$1 and task_id=$2",[userId,r[0].task_id]);
  const steps=await sql.query<{steps:string}>("select count(*)::int as steps from kanban_execution_telemetry where owner_user_id=$1 and task_id=$2",[userId,r[0].task_id]);
  const parentId=typeof r[0].context?.parentRemediationId==="string"?r[0].context.parentRemediationId:null;
  const duplicate=Boolean(parentId&&parentId===remediationId);
  const decision=evaluateRetrySafety({
    attempts:Number(attempts[0]?.attempts??0),
    maxAttempts:c.maxAttempts,
    lastAttemptAt:r[0].retry_after ? new Date(new Date(r[0].retry_after).getTime()-c.backoffSeconds*1000).toISOString() : null,
    now:new Date().toISOString(),
    backoffSeconds:c.backoffSeconds,
    loopSteps:Number(steps[0]?.steps??0),
    maxLoopSteps:c.maxLoopSteps,
    killSwitch:c.killSwitch,
    duplicate,
    recursive:parentId!==null,
  });
  if(!decision.allowed)throw new Error(decision.reason);
  return {safe:true,protectedBranches:c.protectedBranches};
}
