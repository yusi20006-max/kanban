import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRecoveryEvidence, recoveryEvidenceSchema } from "./recovery-verification.ts";

const base = {
  remediationId: "r1",
  executionId: "e1",
  originalFailureFingerprint: "fp",
  reproduced: false,
  checks: [{ name: "regression", passed: true, evidence: { observed: "healthy" } }],
};

test("recovery requires independent evidence", () => {
  assert.equal(evaluateRecoveryEvidence(base), "recovered");
});

test("reproduced failure is unrecovered", () => {
  assert.equal(evaluateRecoveryEvidence({ ...base, reproduced: true }), "unrecovered");
});

test("missing check evidence is unknown", () => {
  assert.equal(evaluateRecoveryEvidence({ ...base, checks: [{ name: "regression", passed: true, evidence: {} }] }), "unknown");
});

test("contract validates correlation fields", () => {
  assert.equal(recoveryEvidenceSchema.parse(base).executionId, "e1");
});
