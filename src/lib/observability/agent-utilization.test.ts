import test from "node:test";
import assert from "node:assert/strict";
import { agentUtilizationInputSchema } from "./agent-utilization";
test("agent utilization accepts explicit window and filters",()=>{const v=agentUtilizationInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z",agentId:"a",boardId:"b"});assert.equal(v.agentId,"a");assert.equal(v.boardId,"b");assert(v.to>v.from);});
test("agent utilization rejects reversed windows",()=>{const v=agentUtilizationInputSchema.parse({from:"2026-01-02T00:00:00Z",to:"2026-01-01T00:00:00Z"});assert(v.to<v.from);});
