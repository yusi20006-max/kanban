import test from "node:test";
import assert from "node:assert/strict";
import { executionStatusSchema } from "./contracts";
test("execution terminal states are explicit",()=>{for(const value of ["succeeded","failed","timed_out","cancelled"]) assert.equal(executionStatusSchema.parse(value),value);});
test("invalid execution state is rejected",()=>{assert.throws(()=>executionStatusSchema.parse("done"));});
