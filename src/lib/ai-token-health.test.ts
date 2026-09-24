import test from "node:test";
import assert from "node:assert/strict";
import { aiTokenHealthStateSchema } from "./ai-intelligence.server.ts";
test("token health states classify missing and expired credentials",()=>{
 assert.equal(aiTokenHealthStateSchema.parse("missing"),"missing");
 assert.equal(aiTokenHealthStateSchema.parse("expired"),"expired");
});
