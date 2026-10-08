import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("push provisioning workflow uses the GitHub event before SHA explicitly", async () => {
  const workflow = await readFile(".github/workflows/kanban-provision.yml", "utf8");
  assert.match(workflow, /GITHUB_EVENT_BEFORE:\s*\$\{\{\s*github\.event\.before/);
  assert.match(workflow, /git diff --name-only "\$GITHUB_EVENT_BEFORE" "\$GITHUB_SHA"/);
});

test("repository protection is guarded until repository resolution succeeded", async () => {
  const workflow = await readFile(".github/workflows/kanban-provision.yml", "utf8");
  assert.match(workflow, /if:\s*\$\{\{\s*always\(\).*REFERENCE_REPOSITORY.*hashFiles/);
});
