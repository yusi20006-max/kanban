#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(ROOT, "projects/yasin-chess/board.json");
const MIGRATIONS_DIR = join(ROOT, "migrations");
const GH_API = "https://api.github.com";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const REQUEST_ID = "github-actions:" + RUN_ID;
const ACTOR = process.env.KANBAN_PROVISION_OWNER || "dev-user";

const EXPECTED_COLUMNS = [
  ["todo", "Backlog"], ["ready", "Ready"], ["doing", "In Progress"],
  ["testing", "Testing"], ["pr", "PR"], ["ci", "CI"], ["review", "Review"],
  ["verify", "Verify"], ["done", "Done"], ["blocked", "Blocked"]
];

function fail(message) {
  throw new Error(message);
}

async function readConfig() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  if (config.version !== 1) fail("Unsupported board.json version");
  if (config.project.repository !== "yusi20006-max/yasin-chess") fail("Unexpected repository");
  if (config.project.key !== "YASIN-CHESS") fail("Unexpected project key");
  if (config.project.name !== "Yasin Chess") fail("Unexpected board name");
  if (config.ownerUserId !== ACTOR) fail("board.json ownerUserId must match KANBAN_PROVISION_OWNER");
  if (config.columns.length !== 10) fail("board.json must contain exactly 10 columns");

  const sorted = [...config.columns].sort((a, b) => a.position - b.position);
  for (let i = 0; i < EXPECTED_COLUMNS.length; i += 1) {
    const expected = EXPECTED_COLUMNS[i];
    const actual = sorted[i];
    if (!actual || actual.position !== i || actual.id !== expected[0] || actual.name !== expected[1]) {
      fail("Invalid column at position " + i);
    }
  }
  if (new Set(config.columns.map((column) => column.id)).size !== 10) fail("Column IDs must be unique");

  const issueNumbers = config.cards.map((card) => card.issueNumber);
  const required = [409, 410, 411, 412, 413, 414, 422];
  if (JSON.stringify([...issueNumbers].sort((a, b) => a - b)) !== JSON.stringify(required)) {
    fail("Card set must be exactly #409-#414 and #422");
  }
  if (new Set(issueNumbers).size !== issueNumbers.length) fail("Issue numbers must be unique");

  const card422 = config.cards.find((card) => card.issueNumber === 422);
  const phases = ["inspect", "implement", "test", "pr", "ci", "verify"];
  if (!card422 || card422.prNumber !== 423 || JSON.stringify(card422.workflowPhases) !== JSON.stringify(phases)) {
    fail("#422 must reference PR #423 and the required workflow phases");
  }
  return config;
}

async function githubRequest(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) fail("GITHUB_TOKEN is required");
  const response = await fetch(GH_API + path, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "kanban-yasin-chess-provision"
    }
  });
  const body = await response.text();
  if (!response.ok) fail("GitHub API " + response.status + " for " + path + ": " + body.slice(0, 400));
  return JSON.parse(body);
}

async function verifyGitHubReferences(config) {
  const repo = config.project.repository;
  let count = 0;
  for (const card of config.cards) {
    const issue = await githubRequest("/repos/" + repo + "/issues/" + card.issueNumber);
    if (issue.pull_request || issue.number !== card.issueNumber) fail("Invalid GitHub Issue #" + card.issueNumber);
    if (card.prNumber) {
      const pr = await githubRequest("/repos/" + repo + "/pulls/" + card.prNumber);
      if (pr.number !== card.prNumber || pr.base?.repo?.full_name !== repo) {
        fail("Invalid GitHub PR #" + card.prNumber);
      }
    }
    count += 1;
  }
  return count;
}

async function openDatabase() {
  const pg = new PGlite();
  await pg.waitReady();
  await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");

  const entries = await readdir(MIGRATIONS_DIR);
  const applied = (await pg.query("select name from _migrations")).rows.map((row) => row.name);
  for (const migration of pendingMigrations(entries, applied)) {
    const sql = await readFile(join(MIGRATIONS_DIR, migration.name), "utf8");
    await pg.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into _migrations (name) values ($1)", [migration.name]);
    });
  }
  return pg;
}

async function provision(pg, config) {
  let board = (await pg.query(
    "select id from kanban_boards where owner_user_id=$1 and project_key=$2 and archived_at is null",
    [config.ownerUserId, config.project.key]
  )).rows[0];

  if (!board) {
    board = { id: randomUUID() };
    await pg.query(
      "insert into kanban_boards(id,name,description,project_key,owner_user_id) values($1,$2,$3,$4,$5)",
      [board.id, config.project.name, "Managed project: " + config.project.repository, config.project.key, config.ownerUserId]
    );
  } else {
    await pg.query(
      "update kanban_boards set name=$1,description=$2,updated_at=now() where id=$3",
      [config.project.name, "Managed project: " + config.project.repository, board.id]
    );
  }

  const existingColumns = (await pg.query(
    "select id from kanban_columns where board_id=$1", [board.id]
  )).rows.map((row) => row.id);
  const desiredIds = new Set(config.columns.map((column) => column.id));
  for (const id of existingColumns.filter((value) => !desiredIds.has(value))) {
    const count = Number((await pg.query(
      "select count(*)::int as count from kanban_cards where board_id=$1 and column_id=$2 and archived_at is null",
      [board.id, id]
    )).rows[0].count);
    if (count !== 0) fail("Cannot remove non-empty unexpected column " + id);
    await pg.query("delete from kanban_columns where board_id=$1 and id=$2", [board.id, id]);
  }

  for (const column of config.columns) {
    await pg.query(
      "insert into kanban_columns(id,board_id,name,position) values($1,$2,$3,$4) on conflict(board_id,id) do update set name=excluded.name,position=excluded.position,updated_at=now()",
      [column.id, board.id, column.name, column.position]
    );
  }

  for (const card of config.cards) {
    const existing = (await pg.query(
      "select id from kanban_cards where board_id=$1 and github_repo=$2 and github_issue_number=$3 and archived_at is null",
      [board.id, config.project.repository, card.issueNumber]
    )).rows[0];
    const cardId = existing?.id || ("github-" + config.project.repository.replace("/", "-") + "-" + card.issueNumber);
    const description = card.workflowPhases
      ? "Source: " + config.project.repository + "#" + card.issueNumber + "\nWorkflow: " + card.workflowPhases.join(" -> ") + "\nPR reference: #" + card.prNumber
      : "Source: " + config.project.repository + "#" + card.issueNumber;

    if (!existing) {
      await pg.query(
        "insert into kanban_cards(id,board_id,column_id,position,title,description,priority,github_repo,github_issue_number,github_pr_number) values($1,$2,$3,$4,$5,$6,'medium',$7,$8,$9)",
        [cardId, board.id, card.columnId, card.issueNumber, "GitHub #" + card.issueNumber, description, config.project.repository, card.issueNumber, card.prNumber || null]
      );
    } else {
      await pg.query(
        "update kanban_cards set column_id=$1,title=$2,description=$3,github_pr_number=$4,updated_at=now() where id=$5 and board_id=$6",
        [card.columnId, "GitHub #" + card.issueNumber, description, card.prNumber || null, cardId, board.id]
      );
    }

    if (card.issueNumber === 422) {
      await pg.query(
        "update kanban_cards set workflow_phase='inspect',agent_state='idle',updated_at=now() where id=$1",
        [cardId]
      );
    }

    await pg.query(
      "insert into kanban_audit_events(id,actor_user_id,source,action,board_id,card_id,request_id,outcome) values($1,$2,'github-action','provision.card',$3,$4,$5,'success')",
      [randomUUID(), config.ownerUserId, board.id, cardId, REQUEST_ID]
    );
  }

  await pg.query(
    "insert into kanban_audit_events(id,actor_user_id,source,action,board_id,request_id,outcome) values($1,$2,'github-action','provision.board',$3,$4,'success')",
    [randomUUID(), config.ownerUserId, board.id, REQUEST_ID]
  );

  return board.id;
}

async function readBack(pg, config, boardId) {
  const board = (await pg.query(
    "select id,name,project_key,owner_user_id from kanban_boards where id=$1 and archived_at is null",
    [boardId]
  )).rows[0];
  if (!board) fail("Board read-back failed");
  if (board.name !== config.project.name || board.project_key !== config.project.key || board.owner_user_id !== config.ownerUserId) {
    fail("Board metadata verification failed");
  }

  const columns = (await pg.query(
    "select id,name,position from kanban_columns where board_id=$1 order by position,id", [boardId]
  )).rows;
  if (columns.length !== 10) fail("Expected exactly 10 columns");
  for (let i = 0; i < 10; i += 1) {
    const expected = config.columns[i];
    const actual = columns[i];
    if (actual.id !== expected.id || actual.name !== expected.name || Number(actual.position) !== expected.position) {
      fail("Column verification failed at position " + i);
    }
  }

  const cards = (await pg.query(
    "select id,github_issue_number,github_pr_number,column_id,agent_state,workflow_phase from kanban_cards where board_id=$1 and archived_at is null order by github_issue_number",
    [boardId]
  )).rows;
  if (cards.length !== config.cards.length) fail("Expected exactly " + config.cards.length + " cards");
  for (const expected of config.cards) {
    const actual = cards.find((card) => Number(card.github_issue_number) === expected.issueNumber);
    if (!actual) fail("Missing card for GitHub Issue #" + expected.issueNumber);
    if (Number(actual.github_pr_number || 0) !== Number(expected.prNumber || 0)) fail("PR reference mismatch for #" + expected.issueNumber);
    if (actual.column_id !== expected.columnId) fail("Column mismatch for #" + expected.issueNumber);
    if (expected.issueNumber === 422 && (actual.agent_state !== "idle" || actual.workflow_phase !== "inspect")) {
      fail("Agent state/workflow phase verification failed for #422");
    }
  }

  const boardCount = Number((await pg.query(
    "select count(*)::int as count from kanban_boards where owner_user_id=$1 and project_key=$2 and archived_at is null",
    [config.ownerUserId, config.project.key]
  )).rows[0].count);
  if (boardCount !== 1) fail("Expected exactly one managed board");

  return { board, columns, cards };
}

async function main() {
  const config = await readConfig();
  const githubReferencesVerified = await verifyGitHubReferences(config);
  const pg = await openDatabase();

  try {
    const boardId = await provision(pg, config);
    const first = await readBack(pg, config, boardId);

    const secondBoardId = await provision(pg, config);
    if (secondBoardId !== boardId) fail("Idempotency failed: board identity changed");
    const second = await readBack(pg, config, secondBoardId);

    const cardCount = Number((await pg.query(
      "select count(*)::int as count from kanban_cards where board_id=$1 and archived_at is null",
      [boardId]
    )).rows[0].count);
    if (cardCount !== config.cards.length) fail("Idempotency failed: duplicate cards detected");

    const card422 = second.cards.find((card) => Number(card.github_issue_number) === 422);
    console.log(JSON.stringify({
      status: "passed",
      persistence: "process-local-in-memory-pglite",
      boardId,
      board: first.board,
      columnCount: second.columns.length,
      cardCount,
      githubReferencesVerified,
      idempotency: "passed",
      issue422: { agentState: card422.agent_state, workflowPhase: card422.workflow_phase }
    }, null, 2));
  } finally {
    await pg.close();
  }
}

main().catch((error) => {
  console.error("[provision] " + (error instanceof Error ? error.stack : error));
  process.exit(1);
});
