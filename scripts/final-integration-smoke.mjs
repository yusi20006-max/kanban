import {readFileSync} from "node:fs";
import assert from "node:assert/strict";

const base = (process.env.BASE_URL || "http://127.0.0.1:8081").replace(/\/$/, "");

async function get(path) {
  const r = await fetch(base + path);
  return {r, b: await r.text()};
}

for (const path of ["/health/live", "/health/ready", "/__grok/manifest.webmanifest", "/sw.js"]) {
  const {r} = await get(path);
  assert.equal(r.ok, true, "endpoint failed: " + path);
}

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
for (const name of [
  "test",
  "build",
  "db:backup",
  "db:restore",
  "mcp:smoke",
  "mcp:http:smoke",
  "production:smoke",
]) {
  assert.ok(pkg.scripts?.[name], "missing script: " + name);
}

console.log("final integration smoke PASS");
