import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const commit =
  process.env.GITHUB_SHA?.trim() ||
  process.env.COMMIT_SHA?.trim() ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(pkg.version ?? "")) {
  throw new Error("package.json version must be a valid semantic version");
}
if (!/^[0-9a-f]{40}$/i.test(commit)) {
  throw new Error("release metadata commit must be a full 40-character SHA");
}

const tag = process.env.GITHUB_REF_NAME?.trim() || null;
console.log(JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  commit,
  tag,
}, null, 2));
