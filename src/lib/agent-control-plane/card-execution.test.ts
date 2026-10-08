import test from "node:test";
import assert from "node:assert/strict";
import { buildCardExecutionPlan, startCardExecutionInputSchema } from "./card-execution.ts";

test("card execution plan binds task to card and starts at inspect", () => {
  const plan = buildCardExecutionPlan("card-422", "agent-a");
  assert.equal(plan.taskId, "card:card-422:execution");
  assert.equal(plan.agentId, "agent-a");
  assert.equal(plan.phase, "inspect");
  assert.match(plan.executionId, /^[0-9a-f-]{36}$/);
});

test("card execution input requires a board and card", () => {
  assert.throws(
    () => startCardExecutionInputSchema.parse({ boardId: "", cardId: "" }),
    /Too small/,
  );
});

test("card execution input bounds lease and timeout values", () => {
  assert.throws(
    () => startCardExecutionInputSchema.parse({
      boardId: "default",
      cardId: "card-422",
      leaseTtlSeconds: 0,
    }),
  );
  assert.throws(
    () => startCardExecutionInputSchema.parse({
      boardId: "default",
      cardId: "card-422",
      timeoutSeconds: 86401,
    }),
  );
});
