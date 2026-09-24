import test from "node:test";
import assert from "node:assert/strict";
import { throughputMetricsInputSchema } from "./throughput";
test("throughput metrics normalize ISO time ranges",()=>{const v=throughputMetricsInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z"});assert.equal(v.from.toISOString(),"2026-01-01T00:00:00.000Z");assert.equal(v.to.toISOString(),"2026-01-02T00:00:00.000Z");});
test("throughput metric filters are explicit",()=>{const v=throughputMetricsInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z",boardId:"board-1",agentId:"agent-1"});assert.equal(v.boardId,"board-1");assert.equal(v.agentId,"agent-1");});
