import test from "node:test";
import assert from "node:assert/strict";
import { telemetryEventSchema } from "./telemetry";
test("telemetry contract requires an event type and normalizes optional fields",()=>{const v=telemetryEventSchema.parse({eventType:"execution.started"});assert.equal(v.eventType,"execution.started");assert.equal(v.taskId,null);assert.deepEqual(v.payload,{});});
test("telemetry contract preserves real lifecycle identifiers",()=>{const v=telemetryEventSchema.parse({taskId:"task-1",executionId:"exec-1",agentId:"agent-1",eventType:"execution.finished",fromState:"running",toState:"succeeded",payload:{attempt:2}});assert.equal(v.executionId,"exec-1");assert.equal(v.payload.attempt,2);});
