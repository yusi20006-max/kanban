import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRetrySafety } from "./retry-safety.ts";

const now = "2026-09-28T00:00:00.000Z";

test("retry budget blocks infinite remediation", () => {
  assert.equal(evaluateRetrySafety({ attempts: 5, maxAttempts: 5, lastAttemptAt: null, now, backoffSeconds: 30, loopSteps: 0, maxLoopSteps: 10, killSwitch: false, duplicate: false, recursive: false }).allowed, false);
});

test("backoff blocks immediate retry", () => {
  const result = evaluateRetrySafety({ attempts: 1, maxAttempts: 5, lastAttemptAt: "2026-09-27T23:59:50.000Z", now, backoffSeconds: 30, loopSteps: 0, maxLoopSteps: 10, killSwitch: false, duplicate: false, recursive: false });
  assert.equal(result.reason, "RETRY_BACKOFF_ACTIVE");
});

test("duplicate and recursive remediation stop safely", () => {
  assert.equal(evaluateRetrySafety({ attempts: 0, maxAttempts: 5, lastAttemptAt: null, now, backoffSeconds: 0, loopSteps: 0, maxLoopSteps: 10, killSwitch: false, duplicate: true, recursive: false }).reason, "DUPLICATE_REMEDIATION");
  assert.equal(evaluateRetrySafety({ attempts: 0, maxAttempts: 5, lastAttemptAt: null, now, backoffSeconds: 0, loopSteps: 0, maxLoopSteps: 10, killSwitch: false, duplicate: false, recursive: true }).reason, "RECURSIVE_REMEDIATION");
});

test("kill switch and loop guard are terminal", () => {
  assert.equal(evaluateRetrySafety({ attempts: 0, maxAttempts: 5, lastAttemptAt: null, now, backoffSeconds: 0, loopSteps: 10, maxLoopSteps: 10, killSwitch: false, duplicate: false, recursive: false }).allowed, false);
  assert.equal(evaluateRetrySafety({ attempts: 0, maxAttempts: 5, lastAttemptAt: null, now, backoffSeconds: 0, loopSteps: 0, maxLoopSteps: 10, killSwitch: true, duplicate: false, recursive: false }).allowed, false);
});
