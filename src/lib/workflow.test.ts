import test from "node:test";
import assert from "node:assert/strict";
import { assertTransition, canTransition, nextPhase } from "./workflow.ts";

test("workflow rejects duplicate transitions", () => {
  assert.equal(canTransition("idle", "running"), true);
  assert.equal(canTransition("idle", "idle"), false);
  assert.throws(() => assertTransition("idle", "idle"), /DUPLICATE_AGENT_TRANSITION/);
});

test("workflow rejects invalid jumps", () => {
  assert.equal(canTransition("idle", "completed"), false);
  assert.throws(() => assertTransition("idle", "completed"), /INVALID_AGENT_TRANSITION/);
});

test("workflow advances phases deterministically", () => {
  assert.equal(nextPhase("inspect"), "implement");
  assert.equal(nextPhase("verify"), "completed");
  assert.equal(nextPhase("completed"), "completed");
});
