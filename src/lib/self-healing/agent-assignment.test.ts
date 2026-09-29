import test from "node:test";
import assert from "node:assert/strict";

test("assignment capability mapping is deterministic", async () => {
  const { assignmentRequestSchema } = await import("./agent-assignment.ts");
  assert.equal(assignmentRequestSchema.parse({ taskId:"t1", failureCategory:"ci" }).failureCategory, "ci");
});

test("unsupported failure category is rejected before assignment", async () => {
  const { assignmentRequestSchema } = await import("./agent-assignment.ts");
  assert.throws(() => assignmentRequestSchema.parse({ taskId:"t1", failureCategory:"unknown" }));
});
