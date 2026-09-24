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
