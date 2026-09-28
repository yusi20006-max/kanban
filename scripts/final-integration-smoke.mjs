import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const base = (process.env.BASE_URL || "http://127.0.0.1:8081").replace(/\/$/, "");

async function get(path) {
  const r = await fetch(base + path);
  return { r, b: await r.text() };
}

for (const path of ["/health/live", "/health/ready", "/__grok/manifest.webmanifest", "/sw.js"]) {
  const { r } = await get(path);
  assert.equal(r.ok, true, "endpoint failed: " + path);
}

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.match(pkg.version ?? "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, "invalid package version");

const metadata = JSON.parse(
  execFileSync(process.execPath, ["scripts/release-metadata.mjs"], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_SHA: "", COMMIT_SHA: "" },
  }),
);
assert.equal(metadata.version, pkg.version, "release metadata version mismatch");
assert.match(metadata.commit, /^[0-9a-f]{40}$/i, "release metadata commit must be a full SHA");

const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(metadata.commit, head, "release metadata commit mismatch");

for (const name of [
  "test", "build", "db:backup", "db:restore", "mcp:smoke", "mcp:http:smoke",
  "production:smoke", "integration:smoke", "release:metadata", "release:check",
]) {
  assert.ok(pkg.scripts?.[name], "missing script: " + name);
}

console.log("final integration smoke PASS");
