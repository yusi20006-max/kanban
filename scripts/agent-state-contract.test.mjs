import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const state = await readFile("docs/automation/AGENT_STATE.md", "utf8");
const recovery = await readFile("docs/automation/AGENT_RECOVERY.md", "utf8");
const instructions = await readFile("AGENTS.md", "utf8");

test("agent checkpoint contains the required recovery fields", () => {
  for (const heading of [
    "Last verified completed stage",
    "Active work",
    "Branch / PR / commits",
    "Tests, lint, and CI evidence",
    "Blockers and stop reason",
    "Exact next action",
    "Recovery history",
  ]) {
    assert.ok(state.includes(heading), `missing checkpoint section: ${heading}`);
  }
  assert.match(state, /Local working-tree status: \*\*UNKNOWN\*\*/);
  assert.match(state, /5cbcbe9e87c5b05fe03157d6da9914c87f013d8a/);
});

test("recovery contract forbids destructive assumptions and unsupported claims", () => {
  for (const phrase of [
    "Start of every session",
    "Never assume the working tree is clean",
    "Preserve them",
    "Do not report a test",
    "After merge",
    "Read-only recovery drill",
    "does not itself restart an agent",
  ]) assert.ok(recovery.includes(phrase), `missing recovery safeguard: ${phrase}`);
});

test("AGENTS.md links agents to the durable recovery contract", () => {
  assert.ok(instructions.includes("docs/automation/AGENT_RECOVERY.md"));
  assert.ok(instructions.includes("docs/automation/AGENT_STATE.md"));
});

test("checkpoint and recovery instructions do not contain common secret assignments", () => {
  const combined = state + recovery;
  assert.doesNotMatch(combined, /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})/);
  assert.doesNotMatch(combined, /(?:TOKEN|SECRET|PASSWORD)\s*=\s*["'][^"']{8,}["']/i);
});
