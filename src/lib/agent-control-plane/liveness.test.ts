import test from "node:test";
import assert from "node:assert/strict";
import { deriveLiveness } from "./liveness";

const now = new Date("2026-09-24T00:00:00.000Z");
test("liveness is deterministic at threshold boundaries", () => {
  assert.equal(deriveLiveness(new Date(now.getTime() - 30_000), now), "ready");
  assert.equal(deriveLiveness(new Date(now.getTime() - 60_000), now), "stale");
  assert.equal(deriveLiveness(new Date(now.getTime() - 300_000), now), "offline");
});
test("missing heartbeat is offline", () => { assert.equal(deriveLiveness(null, now), "offline"); });
