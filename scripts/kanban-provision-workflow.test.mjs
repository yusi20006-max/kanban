import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("push provisioning workflow uses Compare first and commit-file fallback", async () => {
  const workflow = await readFile(".github/workflows/kanban-provision.yml", "utf8");
  assert.match(workflow, /api\.github\.com\/repos\/\\$\{repo\}\/compare\/\\$\{before\}\.\.\.\\$\{sha\}/);
  assert.match(workflow, /api\.github\.com\/repos\/\\$\{repo\}\/commits\/\\$\{sha\}/);
  assert.match(workflow, /payload\.files/);
  assert.doesNotMatch(workflow, /event\.commits/);
});

test("repository protection is guarded until repository resolution succeeded", async () => {
  const workflow = await readFile(".github/workflows/kanban-provision.yml", "utf8");
  assert.match(workflow, /if:\s*\$\{\{\s*always\(\).*REFERENCE_REPOSITORY.*hashFiles/);
});
