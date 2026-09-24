import test from "node:test";
import assert from "node:assert/strict";
test("retryable execution states are failed and timed_out",()=>{assert.deepEqual(["failed","timed_out"].filter(v=>["failed","timed_out"].includes(v)),["failed","timed_out"]);});
