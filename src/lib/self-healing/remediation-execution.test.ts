import test from "node:test";
import assert from "node:assert/strict";
import { deriveRemediationExecutionStatus } from "./remediation-execution-contract.ts";
test("successful fix and test complete execution", () => assert.equal(deriveRemediationExecutionStatus(true, true), "succeeded"));
test("failed fix or test cannot succeed", () => {
  assert.equal(deriveRemediationExecutionStatus(false, true), "failed");
  assert.equal(deriveRemediationExecutionStatus(true, false), "failed");
});
