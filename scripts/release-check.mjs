import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tag = process.env.RELEASE_TAG?.trim() || process.env.GITHUB_REF_NAME?.trim();

if (!tag) {
  console.log("release check PASS: no release tag supplied");
  process.exit(0);
}

const expected = "v" + pkg.version;
if (tag !== expected) {
  throw new Error(`release tag ${tag} does not match package version ${pkg.version}; expected ${expected}`);
}

const sha = process.env.GITHUB_SHA?.trim();
if (sha && !/^[0-9a-f]{40}$/i.test(sha)) {
  throw new Error("GITHUB_SHA must be a full 40-character commit SHA");
}

const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (sha && head !== sha) {
  throw new Error(`GITHUB_SHA ${sha} does not match checked-out HEAD ${head}`);
}

console.log(`release check PASS: ${tag} -> ${head} -> ${pkg.version}`);
