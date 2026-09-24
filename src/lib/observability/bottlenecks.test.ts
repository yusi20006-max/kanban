import test from "node:test";
import assert from "node:assert/strict";
import { bottleneckInputSchema } from "./bottlenecks";
test("bottleneck thresholds are explicit and bounded",()=>{const v=bottleneckInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z"});assert.equal(v.queueAgeMinutes,30);assert.equal(v.leaseAgeMinutes,30);assert.equal(v.ciAgeMinutes,60);assert.equal(v.providerFailureCount,3);});
test("bottleneck board scope is explicit",()=>{const v=bottleneckInputSchema.parse({from:"2026-01-01T00:00:00Z",to:"2026-01-02T00:00:00Z",boardId:"b",providerFailureCount:5});assert.equal(v.boardId,"b");assert.equal(v.providerFailureCount,5);});
