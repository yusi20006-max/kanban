import test from "node:test";
import assert from "node:assert/strict";
import { agentRegistrationSchema } from "./contracts";

test("agent registration contract rejects empty identities", () => {
  assert.throws(() => agentRegistrationSchema.parse({ agentId: "", name: "worker" }));
});
test("agent registration contract accepts capabilities and metadata", () => {
  const value = agentRegistrationSchema.parse({ agentId: "worker-1", name: "Worker", capabilities: ["code", "test"], metadata: { runtime: "termux" } });
  assert.deepEqual(value.capabilities, ["code", "test"]);
  assert.equal(value.metadata.runtime, "termux");
});
