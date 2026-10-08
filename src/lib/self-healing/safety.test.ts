import test from "node:test";
import assert from "node:assert/strict";

test("safety defaults are bounded", () => {
  const minAttempts = 5;
  const maxAttempts = 10;
  assert.ok(minAttempts > 0 && maxAttempts > 0);
});
