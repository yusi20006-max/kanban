import test from "node:test";
import assert from "node:assert/strict";
import { claimTaskSchema, leaseStatusSchema } from "./contracts";
test("lease contract defaults and bounds claim TTL",()=>{assert.equal(claimTaskSchema.parse({taskId:"t",agentId:"a"}).leaseTtlSeconds,300);assert.throws(()=>claimTaskSchema.parse({taskId:"t",agentId:"a",leaseTtlSeconds:86401}));});
test("lease status vocabulary is explicit",()=>{assert.equal(leaseStatusSchema.parse("active"),"active");assert.throws(()=>leaseStatusSchema.parse("ownerless"));});
