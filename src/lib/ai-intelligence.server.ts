import { z } from "zod";
import { getSql } from "@/lib/db";

export const aiProviderSchema = z.enum(["gemini","qwen","yasin-ai"]);
export const aiAvailabilitySchema = z.enum(["available","degraded","unavailable","unknown"]);
export const aiCapabilitiesSchema = z.object({
  contextWindow: z.number().int().positive().optional(),
  inputTypes: z.array(z.string().trim().min(1)).default([]),
  outputTypes: z.array(z.string().trim().min(1)).default([]),
  toolCalling: z.boolean().default(false),
  structuredOutput: z.boolean().default(false),
  reasoning: z.boolean().default(false),
  streaming: z.boolean().default(true),
  local: z.boolean().default(false),
}).passthrough();

export const aiModelSchema = z.object({
  id: z.string().trim().min(1).max(128),
  provider: aiProviderSchema,
  model: z.string().trim().min(1).max(255),
  displayName: z.string().trim().min(1).max(255),
  capabilities: aiCapabilitiesSchema,
  availability: aiAvailabilitySchema.default("unknown"),
  enabled: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AiModel = z.infer<typeof aiModelSchema>;

const defaults: AiModel[] = [
  { id:"gemini-default", provider:"gemini", model:"gemini", displayName:"Gemini", capabilities:{contextWindow:1_000_000,inputTypes:["text"],outputTypes:["text"],toolCalling:true,structuredOutput:true,reasoning:true,streaming:true,local:false}, availability:"unknown", enabled:true, metadata:{} },
  { id:"qwen-local", provider:"qwen", model:"qwen", displayName:"Qwen", capabilities:{contextWindow:8192,inputTypes:["text"],outputTypes:["text"],toolCalling:true,structuredOutput:true,reasoning:true,streaming:true,local:true}, availability:"unknown", enabled:true, metadata:{} },
  { id:"yasin-ai-default", provider:"yasin-ai", model:"yasin-ai", displayName:"Yasin-AI", capabilities:{contextWindow:8192,inputTypes:["text"],outputTypes:["text"],toolCalling:true,structuredOutput:true,reasoning:true,streaming:true,local:true}, availability:"unknown", enabled:true, metadata:{} },
];

export async function ensureAiModelDefaults() {
  const sql = await getSql();
  for (const item of defaults) {
    await sql.query(
      "insert into kanban_ai_models(id,provider,model,display_name,capabilities,availability,enabled,metadata) values($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb) on conflict(provider,model) do nothing",
      [item.id,item.provider,item.model,item.displayName,JSON.stringify(item.capabilities),item.availability,item.enabled,JSON.stringify(item.metadata)],
    );
  }
}

export async function registerAiModel(input: unknown) {
  const data=aiModelSchema.parse(input);
  const sql=await getSql();
  await sql.query(
    "insert into kanban_ai_models(id,provider,model,display_name,capabilities,availability,enabled,metadata) values($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb) on conflict(provider,model) do update set id=excluded.id,display_name=excluded.display_name,capabilities=excluded.capabilities,availability=excluded.availability,enabled=excluded.enabled,metadata=excluded.metadata,updated_at=now()",
    [data.id,data.provider,data.model,data.displayName,JSON.stringify(data.capabilities),data.availability,data.enabled,JSON.stringify(data.metadata)],
  );
  return data;
}

export async function listAiModels() {
  await ensureAiModelDefaults();
  const sql=await getSql();
  return sql.query("select id,provider,model,display_name as \"displayName\",capabilities,availability,enabled,metadata,created_at as \"createdAt\",updated_at as \"updatedAt\" from kanban_ai_models order by provider,model");
}

export async function getAiModel(id: string) {
  const sql=await getSql();
  const rows=await sql.query("select id,provider,model,display_name as \"displayName\",capabilities,availability,enabled,metadata,created_at as \"createdAt\",updated_at as \"updatedAt\" from kanban_ai_models where id=$1",[id]);
  return rows[0] ?? null;
}

export const aiRoutingRequirementsSchema = z.object({
  capabilities: z.array(z.string().trim().min(1).max(128)).default([]),
  preferredProviders: z.array(aiProviderSchema).default([]),
  minContextWindow: z.number().int().positive().optional(),
  requireToolCalling: z.boolean().default(false),
  requireStructuredOutput: z.boolean().default(false),
  requireReasoning: z.boolean().default(false),
  requireLocal: z.boolean().default(false),
});
export type AiRoutingRequirements = z.infer<typeof aiRoutingRequirementsSchema>;

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}
async function sha256(value: string): Promise<string> {
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,"0")).join("");
}

export async function routeAiTask(userId: string, taskId: string, input: unknown) {
  const requirements=aiRoutingRequirementsSchema.parse(input);
  const sql=await getSql();
  const task=await sql.query<{id:string}>("select id from kanban_agent_tasks where id=$1 and owner_user_id=$2",[taskId,userId]);
  if(!task[0]) throw new Error("TASK_NOT_FOUND");
  const models=await listAiModels() as Array<AiModel & {id:string}>;
  const required=new Set(requirements.capabilities);
  const candidates=models.filter(model=>{
    if(!model.enabled || model.availability==="unavailable") return false;
    const c=model.capabilities as Record<string,unknown>;
    const names=new Set(Object.entries(c).filter(([,v])=>v===true).map(([k])=>k));
    if([...required].some(x=>!names.has(x))) return false;
    if(requirements.minContextWindow && Number(c.contextWindow??0)<requirements.minContextWindow) return false;
    if(requirements.requireToolCalling && c.toolCalling!==true) return false;
    if(requirements.requireStructuredOutput && c.structuredOutput!==true) return false;
    if(requirements.requireReasoning && c.reasoning!==true) return false;
    if(requirements.requireLocal && c.local!==true) return false;
    return true;
  }).sort((a,b)=>{
    const ap=requirements.preferredProviders.indexOf(a.provider), bp=requirements.preferredProviders.indexOf(b.provider);
    const as=ap<0?requirements.preferredProviders.length:ap, bs=bp<0?requirements.preferredProviders.length:bp;
    return as-bs || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model);
  });
  if(!candidates.length) throw new Error("NO_CAPABLE_MODEL");
  const selected=candidates[0];
  const canonical=stableJson({taskId,requirements,selectedModelId:selected.id,candidates:candidates.map(c=>c.id)});
  const decisionHash=await sha256(canonical);
  const existing=await sql.query("select id,task_id,selected_model_id as \"selectedModelId\",requirements,candidates,decision_hash as \"decisionHash\",created_at as \"createdAt\" from kanban_ai_routing_decisions where owner_user_id=$1 and task_id=$2 and decision_hash=$3",[userId,taskId,decisionHash]);
  if(existing[0]) return {...existing[0],idempotent:true};
  const id=crypto.randomUUID();
  await sql.query("insert into kanban_ai_routing_decisions(id,owner_user_id,task_id,selected_model_id,requirements,candidates,decision_hash) values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)",[id,userId,taskId,selected.id,JSON.stringify(requirements),JSON.stringify(candidates.map(c=>c.id)),decisionHash]);
  return {id,taskId,selectedModelId:selected.id,requirements,candidates:candidates.map(c=>c.id),decisionHash,idempotent:false};
}

export async function listAiRoutingDecisions(userId:string,taskId:string) {
  const sql=await getSql();
  return sql.query("select id,task_id as \"taskId\",selected_model_id as \"selectedModelId\",requirements,candidates,decision_hash as \"decisionHash\",created_at as \"createdAt\" from kanban_ai_routing_decisions where owner_user_id=$1 and task_id=$2 order by created_at desc",[userId,taskId]);
}

export const aiFallbackInputSchema = z.object({
  failedModelId: z.string().trim().min(1).max(128),
  reason: z.enum(["unavailable","timeout","rate_limit","auth","capacity","provider_error","unknown"]),
  retrySafe: z.boolean().default(true),
});
export type AiFallbackInput = z.infer<typeof aiFallbackInputSchema>;

export async function planAiFallback(userId:string, taskId:string, input:unknown) {
  const data=aiFallbackInputSchema.parse(input);
  const sql=await getSql();
  const task=await sql.query<{id:string}>("select id from kanban_agent_tasks where id=$1 and owner_user_id=$2",[taskId,userId]);
  if(!task[0]) throw new Error("TASK_NOT_FOUND");
  if(!data.retrySafe) throw new Error("FALLBACK_RETRY_NOT_SAFE");
  const latest=await sql.query<{selected_model_id:string;candidates:string[]}>("select selected_model_id,candidates from kanban_ai_routing_decisions where owner_user_id=$1 and task_id=$2 order by created_at desc limit 1",[userId,taskId]);
  if(!latest[0]) throw new Error("ROUTING_NOT_FOUND");
  const candidates=Array.isArray(latest[0].candidates)?latest[0].candidates:[];
  const failedIndex=candidates.indexOf(data.failedModelId);
  const nextId=candidates.slice(failedIndex+1).find(Boolean) ?? null;
  const sequenceRows=await sql.query<{n:number|string}>("select coalesce(max(sequence),0)+1 as n from kanban_ai_fallback_attempts where owner_user_id=$1 and task_id=$2",[userId,taskId]);
  const sequence=Number(sequenceRows[0]?.n??1);
  const id=crypto.randomUUID();
  await sql.query("insert into kanban_ai_fallback_attempts(id,owner_user_id,task_id,failed_model_id,fallback_model_id,reason,retry_safe,sequence) values($1,$2,$3,$4,$5,$6,$7,$8)",[id,userId,taskId,data.failedModelId,nextId,data.reason,data.retrySafe,sequence]);
  return {id,taskId,failedModelId:data.failedModelId,fallbackModelId:nextId,reason:data.reason,retrySafe:data.retrySafe,sequence,exhausted:nextId===null};
}
