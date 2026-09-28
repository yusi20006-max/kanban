import test from "node:test";
import assert from "node:assert/strict";
import { classifyDetectedFailure } from "./failure-classification.ts";

const base = {
  identifier: "run-42",
  detectedAt: "2026-09-28T20:00:00+00:00",
  commitSha: null,
  severity: "error",
  signalType: "failure",
  evidence: {},
  taskId: null,
  executionId: null,
  runId: null,
};

test("classifies explicit CI failure", () => {
  assert.deepEqual(classifyDetectedFailure({ ...base, source: "ci", evidence: { conclusion: "failure" } }), {
    category: "ci", confidence: 1, reason: "CI detection has an explicit failure conclusion.", autoRemediationAllowed: true,
  });
});

test("classifies execution failure as runtime", () => {
  assert.equal(classifyDetectedFailure({ ...base, source: "execution", evidence: { status: "failed" } }).category, "runtime");
});

test("classifies explicit test check", () => {
  assert.equal(classifyDetectedFailure({ ...base, source: "check", identifier: "test-suite", evidence: { conclusion: "failure" } }).category, "test");
});

test("unknown classification is a safe stop", () => {
  const result = classifyDetectedFailure({ ...base, source: "check", identifier: "lint-check", evidence: { conclusion: "failure" } });
  assert.equal(result.category, "unknown");
  assert.equal(result.autoRemediationAllowed, false);
});
