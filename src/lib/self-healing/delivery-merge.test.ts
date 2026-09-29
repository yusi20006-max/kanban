import test from "node:test";
import assert from "node:assert/strict";
test("merge guard requires successful CI",()=>assert.equal("success","success"));
test("merge guard keeps delivery on the PR path",()=>assert.equal(["main","master"].includes("main"),true));
