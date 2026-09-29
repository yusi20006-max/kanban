import test from "node:test";
import assert from "node:assert/strict";
import { deriveRemediationExecutionStatus } from "./remediation-execution.ts";

test("successful fix and test complete execution", () => {
  assert.equal(deriveRemediationExecutionStatus(true, true), "succeeded");
});

test("failed fix or test keeps remediation from succeeding", () => {
  assert.equal(deriveRemediationExecutionStatus(false, true), "failed");
  assert.equal(deriveRemediationExecutionStatus(true, false), "failed");
});

test("both failing is terminal failure", () => {
  assert.equal(deriveRemediationExecutionStatus(false, false), "failed");
});
