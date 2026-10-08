#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { provisionAndVerify, openDatabase } from "./project-provisioning-engine.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(ROOT, "projects/yasin-chess/board.json");
const MIGRATIONS_DIR = join(ROOT, "migrations");
const GH_API = "https://api.github.com";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";

async function githubRequest(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const response = await fetch(GH_API + path, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "kanban-project-provision",
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error("GitHub API " + response.status + " for " + path + ": " + body.slice(0, 400));
  return JSON.parse(body);
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const result = await provisionAndVerify(pg, config, {
      actorUserId: config.ownerUserId,
      requestId: "github-actions:" + RUN_ID,
      source: "github-action",
      githubRequest,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pg.close();
  }
}

main().catch((error) => {
  console.error("[provision] " + (error instanceof Error ? error.stack : error));
  process.exit(1);
});
