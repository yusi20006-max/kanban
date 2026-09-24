import test from "node:test";
import assert from "node:assert/strict";
import { aiUsageSchema } from "./ai-intelligence.server.ts";
test("usage contract tracks tokens latency and cost",()=>{
 const u=aiUsageSchema.parse({executionId:"e",provider:"gemini",inputTokens:10,outputTokens:20,latencyMs:50,estimatedCost:.01});
 assert.equal(u.inputTokens,10); assert.equal(u.estimatedCost,.01);
});
test("usage rejects negative counters",()=>assert.throws(()=>aiUsageSchema.parse({executionId:"e",provider:"qwen",inputTokens:-1})));
