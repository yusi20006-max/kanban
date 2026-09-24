import test from "node:test";import assert from "node:assert/strict";import { classifyFailure } from "./failure-detection";
test("classifies execution timeout",()=>assert.equal(classifyFailure("execution",{status:"timed_out"}),"execution_timeout"));
test("classifies CI failure only from explicit evidence",()=>assert.equal(classifyFailure("ci",{conclusion:"failure"}),"ci_failure"));
test("does not invent CI failure",()=>assert.equal(classifyFailure("ci",{conclusion:"success"}),"ci_check_failure"));
