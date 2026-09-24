import test from "node:test";
import assert from "node:assert/strict";
import { aiRoutingRequirementsSchema } from "./ai-intelligence.server.ts";
test("routing requirements are deterministic machine-readable input",()=>{
 const r=aiRoutingRequirementsSchema.parse({capabilities:["toolCalling"],preferredProviders:["yasin-ai"],requireToolCalling:true});
 assert.deepEqual(r.preferredProviders,["yasin-ai"]);
 assert.equal(r.requireToolCalling,true);
});
