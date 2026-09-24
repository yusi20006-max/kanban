import test from "node:test";import assert from "node:assert/strict";import { z } from "zod";
test("remediation input requires a signal id",()=>assert.throws(()=>z.object({failureSignalId:z.string().min(1)}).parse({failureSignalId:""})));
