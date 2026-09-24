import test from "node:test";
import assert from "node:assert/strict";
import { failureMetricsInputSchema } from "./failure-metrics";
test("failure metrics accept bounded filters",()=>{const v=failureMetricsInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z",boardId:"b",agentId:"a"});assert.equal(v.boardId,"b");assert.equal(v.agentId,"a");});
test("failure metric range is represented as dates",()=>{const v=failureMetricsInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z"});assert(v.to>v.from);});
