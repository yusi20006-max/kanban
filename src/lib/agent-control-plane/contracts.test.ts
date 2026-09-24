import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_CONTROL_PLANE_CONTRACT_VERSION, agentRegistrationSchema, agentStatusSchema, claimTaskSchema, executionStatusSchema, heartbeatSchema, taskStatusSchema } from "./contracts";
test("agent control plane contract exposes stable version and state enums", () => { assert.equal(AGENT_CONTROL_PLANE_CONTRACT_VERSION, "1.0.0"); assert.equal(agentStatusSchema.parse("ready"), "ready"); assert.equal(taskStatusSchema.parse("pending"), "pending"); assert.equal(executionStatusSchema.parse("queued"), "queued"); });
test("agent registration normalizes optional collections", () => { const value = agentRegistrationSchema.parse({ agentId: "agent-1", name: "Worker" }); assert.deepEqual(value.capabilities, []); assert.deepEqual(value.metadata, {}); });
test("heartbeat and claim contracts enforce bounded lease TTL", () => { assert.equal(heartbeatSchema.parse({ agentId: "agent-1" }).agentId, "agent-1"); assert.equal(claimTaskSchema.parse({ taskId: "task-1", agentId: "agent-1" }).leaseTtlSeconds, 300); assert.throws(() => claimTaskSchema.parse({ taskId: "task-1", agentId: "agent-1", leaseTtlSeconds: 0 })); });
