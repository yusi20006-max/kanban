#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const path = process.argv[2] || "provision-result.json";
const result = JSON.parse(await readFile(path, "utf8"));

const expected = {
  status: "passed",
  columnCount: 10,
  cardCount: 7,
  githubReferencesVerified: 7,
  idempotency: "passed",
};

for (const [key, value] of Object.entries(expected)) {
  if (result[key] !== value) {
    throw new Error(`Rollout verification failed: expected ${key}=${value}, got ${result[key]}`);
  }
}

const workflow = result.workflow?.find((item) => item.issueNumber === 422);
if (!workflow || workflow.agentState !== "idle" || workflow.workflowPhase !== "inspect") {
  throw new Error("Rollout verification failed: Issue #422 must remain idle at workflow phase inspect");
}

if (result.persistence !== "process-local-in-memory-pglite") {
  throw new Error("Rollout verification failed: unexpected persistence mode");
}

console.log(JSON.stringify({
  status: "passed",
  project: result.board?.name,
  boardId: result.boardId,
  columns: result.columnCount,
  cards: result.cardCount,
  githubReferencesVerified: result.githubReferencesVerified,
  idempotency: result.idempotency,
  issue422: workflow,
  persistence: result.persistence,
}, null, 2));
