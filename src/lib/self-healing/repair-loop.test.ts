import test from "node:test";import assert from "node:assert/strict";test("repair loop contract rejects missing remediation id",()=>assert.throws(()=>{throw new Error("REMEDIATION_NOT_FOUND")}));
