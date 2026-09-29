import test from "node:test";
import assert from "node:assert/strict";
import { assignmentRequestSchema } from "./agent-assignment.ts";

test("assignment capability mapping input is deterministic", () => {
  assert.equal(assignmentRequestSchema.parse({ taskId: "t1", failureCategory: "ci" }).failureCategory, "ci");
});

test("unsupported failure category is rejected before assignment", () => {
  assert.throws(() => assignmentRequestSchema.parse({ taskId: "t1", failureCategory: "unknown" }));
});
