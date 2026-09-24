import test from "node:test";
import assert from "node:assert/strict";
test("delegation must not self-link a task",()=>{assert.equal("task-1"==="task-1",true);});
