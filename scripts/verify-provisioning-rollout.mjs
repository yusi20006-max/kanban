#!/usr/bin/env node
import { readFile } from "node:fs/promises";

export function verifyRollout(result, config) {
  if (result.status !== "passed") {
    throw new Error(`Rollout verification failed: expected status=passed, got ${result.status}`);
  }
  if (result.columnCount !== config.columns.length) {
    throw new Error(`Rollout verification failed: expected columnCount=${config.columns.length}, got ${result.columnCount}`);
  }
  if (result.cardCount !== config.cards.length) {
    throw new Error(`Rollout verification failed: expected cardCount=${config.cards.length}, got ${result.cardCount}`);
  }
  if (result.githubReferencesVerified !== config.cards.length) {
    throw new Error(`Rollout verification failed: expected githubReferencesVerified=${config.cards.length}, got ${result.githubReferencesVerified}`);
  }
  if (result.idempotency !== "passed") {
    throw new Error(`Rollout verification failed: expected idempotency=passed, got ${result.idempotency}`);
  }
  if (result.persistence !== "process-local-in-memory-pglite") {
    throw new Error(`Rollout verification failed: unexpected persistence mode ${result.persistence}`);
  }

  const expectedWorkflow = config.cards
    .filter((card) => card.workflowPhases?.length)
    .map((card) => ({
      issueNumber: card.issueNumber,
      agentState: "idle",
      workflowPhase: card.workflowPhases[0],
    }));
  if (JSON.stringify(result.workflow ?? []) !== JSON.stringify(expectedWorkflow)) {
    throw new Error("Rollout verification failed: workflow metadata does not match project configuration");
  }

  if (result.board?.name !== config.project.name) {
    throw new Error("Rollout verification failed: board name does not match project configuration");
  }

  return {
    status: "passed",
    project: config.project.name,
    repository: config.project.repository,
    boardId: result.boardId,
    columns: result.columnCount,
    cards: result.cardCount,
    githubReferencesVerified: result.githubReferencesVerified,
    idempotency: result.idempotency,
    workflow: result.workflow ?? [],
    persistence: result.persistence,
  };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const resultPath = process.argv[2] || "provision-result.json";
  const configPath = process.argv[3];
  if (!configPath) throw new Error("Project configuration path is required");
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  const config = JSON.parse(await readFile(configPath, "utf8"));
  console.log(JSON.stringify(verifyRollout(result, config), null, 2));
}
