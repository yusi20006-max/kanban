import test from "node:test";
import assert from "node:assert/strict";
import { aiFallbackInputSchema } from "./ai-intelligence.server.ts";
test("fallback rejects unsafe retries",()=>assert.equal(aiFallbackInputSchema.parse({failedModelId:"m",reason:"timeout",retrySafe:false}).retrySafe,false));
test("fallback reason is constrained",()=>assert.throws(()=>aiFallbackInputSchema.parse({failedModelId:"m",reason:"side_effect"})));
