import test from "node:test";
import assert from "node:assert/strict";
import { aiContextSelectionSchema, aiIntelligenceTaskInputSchema } from "./ai-intelligence.server.ts";
test("context selection is auditable and bounded",()=>{
 const x=aiContextSelectionSchema.parse({sources:["task","card","repo"],maxSources:2,capabilities:["reasoning"]});
 assert.equal(x.maxSources,2); assert.deepEqual(x.sources,["task","card","repo"]);
});
test("intelligence plan requires a task",()=>assert.throws(()=>aiIntelligenceTaskInputSchema.parse({})));
