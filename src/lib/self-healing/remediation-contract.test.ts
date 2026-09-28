import test from "node:test";
import assert from "node:assert/strict";
import { buildRemediationTaskContext } from "./remediation-contract.ts";

test("builds evidence-backed remediation context", () => {
  const context = buildRemediationTaskContext(
    { id: "signal-1", source: "ci", identifier: "run-1", evidence: { conclusion: "failure" } },
    { category: "ci", confidence: 1, reason: "explicit CI failure", autoRemediationAllowed: true },
  );
  assert.equal(context.failureSignalId, "signal-1");
  assert.deepEqual(context.evidence, { conclusion: "failure" });
});

test("rejects unsafe unknown classification", () => {
  assert.throws(() => buildRemediationTaskContext(
    { id: "signal-2", source: "check", identifier: "lint", evidence: { conclusion: "failure" } },
    { category: "unknown", confidence: 0.1, reason: "unsupported", autoRemediationAllowed: false },
  ), /UNSUPPORTED_FAILURE_CLASSIFICATION/);
});
