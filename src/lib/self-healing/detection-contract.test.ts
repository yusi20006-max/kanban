import test from "node:test";
import assert from "node:assert/strict";
import { detectionFingerprint, parseDetectionContract } from "./detection-contract.ts";

const base = {
  source: "ci",
  identifier: "run-42",
  detectedAt: "2026-09-28T20:00:00+00:00",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  severity: "error",
  signalType: "failure",
  evidence: { conclusion: "failure", job: "test" },
};

test("detection contract requires source, identifier, timestamp, severity and signal type", () => {
  const parsed = parseDetectionContract(base);
  assert.equal(parsed.identifier, "run-42");
  assert.equal(parsed.severity, "error");
  assert.equal(parsed.signalType, "failure");
});

test("fingerprint is deterministic and evidence-backed", () => {
  assert.equal(detectionFingerprint(parseDetectionContract(base)), detectionFingerprint(parseDetectionContract({
    ...base,
    evidence: { job: "test", conclusion: "failure" },
  })));
});

test("different detection identity produces a different fingerprint", () => {
  const first = detectionFingerprint(parseDetectionContract(base));
  const second = detectionFingerprint(parseDetectionContract({ ...base, identifier: "run-43" }));
  assert.notEqual(first, second);
});

test("invalid commit SHA is rejected", () => {
  assert.throws(() => parseDetectionContract({ ...base, commitSha: "bad" }));
});
