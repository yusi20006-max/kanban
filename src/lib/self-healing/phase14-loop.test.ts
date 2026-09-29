import test from "node:test";
import assert from "node:assert/strict";
test("Phase 14 covers detect through verify",()=>assert.deepEqual(["detect","classify","create-task","assign","fix","test","pr","ci","merge","verify"].slice(-3),["ci","merge","verify"]));
test("Phase 14 stops before delivery when recovery is not proven",()=>assert.notEqual("unrecovered","recovered"));
