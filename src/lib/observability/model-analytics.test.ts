import test from "node:test";
import assert from "node:assert/strict";
import { modelUsageAnalyticsInputSchema } from "./model-analytics";
test("model analytics supports project task and agent filters",()=>{const v=modelUsageAnalyticsInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z",boardId:"b",taskId:"t",agentId:"a"});assert.equal(v.boardId,"b");assert.equal(v.taskId,"t");assert.equal(v.agentId,"a");});
test("model analytics uses an explicit time window",()=>{const v=modelUsageAnalyticsInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z"});assert(v.to>v.from);});
