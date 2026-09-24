import test from "node:test";
import assert from "node:assert/strict";
import { canExecutionTransition, canTaskTransition } from "./state-machine";
test("task lifecycle permits claim, run and terminal transitions",()=>{assert.equal(canTaskTransition("pending","claimed"),true);assert.equal(canTaskTransition("claimed","running"),true);assert.equal(canTaskTransition("running","completed"),true);});
test("execution lifecycle rejects terminal rewrites",()=>{assert.equal(canExecutionTransition("running","failed"),true);assert.equal(canExecutionTransition("succeeded","running"),false);});
