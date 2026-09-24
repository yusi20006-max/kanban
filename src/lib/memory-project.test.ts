import test from "node:test"; import assert from "node:assert/strict"; import {projectMemorySchema} from "./memory.server.ts";
test("project memory requires provenance",()=>{const x=projectMemorySchema.parse({key:"architecture",value:{x:1},source:{type:"decision",ref:"dec-1"}});assert.equal(x.source.ref,"dec-1")});
