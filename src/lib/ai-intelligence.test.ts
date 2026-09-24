import test from "node:test";
import assert from "node:assert/strict";
import { aiModelSchema } from "./ai-intelligence.server.ts";

test("AI model registry accepts machine-readable capabilities",()=>{
  const model=aiModelSchema.parse({id:"m1",provider:"qwen",model:"qwen",displayName:"Qwen",capabilities:{contextWindow:8192,toolCalling:true}});
  assert.equal(model.provider,"qwen");
  assert.equal(model.capabilities.toolCalling,true);
});
test("AI model registry rejects unknown providers",()=>{
  assert.throws(()=>aiModelSchema.parse({id:"m1",provider:"other",model:"x",displayName:"x",capabilities:{}}));
});
