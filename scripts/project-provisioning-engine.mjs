#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";
import { validateProjectProvisioningConfig } from "./project-provisioning-contract.mjs";

export class ProjectProvisioningError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectProvisioningError";
  }
}

function fail(message) {
  throw new ProjectProvisioningError(message);
}

export async function verifyGitHubReferences(config, githubRequest) {
  let count = 0;
  for (const card of config.cards) {
    const issue = await githubRequest("/repos/" + config.project.repository + "/issues/" + card.issueNumber);
    if (issue.pull_request || issue.number !== card.issueNumber) {
      fail("Invalid GitHub Issue #" + card.issueNumber);
    }
    if (card.prNumber !== undefined) {
      const pr = await githubRequest("/repos/" + config.project.repository + "/pulls/" + card.prNumber);
      if (pr.number !== card.prNumber || pr.base?.repo?.full_name !== config.project.repository) {
        fail("Invalid GitHub PR #" + card.prNumber);
      }
    }
    count += 1;
  }
  return count;
}

export async function openDatabase(migrationsDir) {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");

  const entries = await readdir(migrationsDir);
  const applied = (await pg.query("select name from _migrations")).rows.map((row) => row.name);
  for (const migration of pendingMigrations(entries, applied)) {
    const sql = await readFile(join(migrationsDir, migration.name), "utf8");
    await pg.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into _migrations (name) values ($1)", [migration.name]);
    });
  }
  return pg;
}

function cardDescription(config, card) {
  const lines = ["Source: " + config.project.repository + "#" + card.issueNumber];
  if (card.workflowPhases?.length) lines.push("Workflow: " + card.workflowPhases.join(" -> "));
  if (card.prNumber !== undefined) lines.push("PR reference: #" + card.prNumber);
  return lines.join("\n");
}

export async function provisionProject(pg, config, {
  actorUserId = config.ownerUserId,
  requestId = "local",
  source = "project-provisioner"
} = {}) {
  validateProjectProvisioningConfig(config);

  let board = (await pg.query(
    "select id from kanban_boards where owner_user_id=$1 and project_key=$2 and archived_at is null",
    [config.ownerUserId, config.project.key],
  )).rows[0];

  if (!board) {
    board = { id: randomUUID() };
    await pg.query(
      "insert into kanban_boards(id,name,description,project_key,owner_user_id) values($1,$2,$3,$4,$5)",
      [board.id, config.project.name, "Managed project: " + config.project.repository, config.project.key, config.ownerUserId],
    );
  } else {
    await pg.query(
      "update kanban_boards set name=$1,description=$2,updated_at=now() where id=$3",
      [config.project.name, "Managed project: " + config.project.repository, board.id],
    );
  }

  const existingColumns = (await pg.query(
    "select id from kanban_columns where board_id=$1", [board.id],
  )).rows.map((row) => row.id);
  const desiredIds = new Set(config.columns.map((column) => column.id));

  for (const id of existingColumns.filter((value) => !desiredIds.has(value))) {
    const count = Number((await pg.query(
      "select count(*)::int as count from kanban_cards where board_id=$1 and column_id=$2 and archived_at is null",
      [board.id, id],
    )).rows[0].count);
    if (count !== 0) fail("Cannot remove non-empty unexpected column " + id);
    await pg.query("delete from kanban_columns where board_id=$1 and id=$2", [board.id, id]);
  }

  for (const column of config.columns) {
    await pg.query(
      "insert into kanban_columns(id,board_id,name,position) values($1,$2,$3,$4) on conflict(board_id,id) do update set name=excluded.name,position=excluded.position,updated_at=now()",
      [column.id, board.id, column.name, column.position],
    );
  }

  for (const card of config.cards) {
    const existing = (await pg.query(
      "select id from kanban_cards where board_id=$1 and github_repo=$2 and github_issue_number=$3 and archived_at is null",
      [board.id, config.project.repository, card.issueNumber],
    )).rows[0];
    const cardId = existing?.id || ("github-" + config.project.repository.replace("/", "-") + "-" + card.issueNumber);
    const description = cardDescription(config, card);

    if (!existing) {
      await pg.query(
        "insert into kanban_cards(id,board_id,column_id,position,title,description,priority,github_repo,github_issue_number,github_pr_number) values($1,$2,$3,$4,$5,$6,'medium',$7,$8,$9)",
        [cardId, board.id, card.columnId, card.issueNumber, "GitHub #" + card.issueNumber, description, config.project.repository, card.issueNumber, card.prNumber ?? null],
      );
    } else {
      await pg.query(
        "update kanban_cards set column_id=$1,title=$2,description=$3,github_pr_number=$4,updated_at=now() where id=$5 and board_id=$6",
        [card.columnId, "GitHub #" + card.issueNumber, description, card.prNumber ?? null, cardId, board.id],
      );
    }

    if (card.workflowPhases?.length) {
      await pg.query(
        "update kanban_cards set workflow_phase=$1,agent_state='idle',updated_at=now() where id=$2",
        [card.workflowPhases[0], cardId],
      );
    }

    await pg.query(
      "insert into kanban_audit_events(id,actor_user_id,source,action,board_id,card_id,request_id,outcome) values($1,$2,$3,'provision.card',$4,$5,$6,'success')",
      [randomUUID(), actorUserId, source, board.id, cardId, requestId],
    );
  }

  await pg.query(
    "insert into kanban_audit_events(id,actor_user_id,source,action,board_id,request_id,outcome) values($1,$2,$3,'provision.board',$4,$5,'success')",
    [randomUUID(), actorUserId, source, board.id, requestId],
  );

  return board.id;
}

export async function verifyProject(pg, config, boardId) {
  validateProjectProvisioningConfig(config);

  const board = (await pg.query(
    "select id,name,project_key,owner_user_id from kanban_boards where id=$1 and archived_at is null",
    [boardId],
  )).rows[0];
  if (!board) fail("Board read-back failed");
  if (board.name !== config.project.name || board.project_key !== config.project.key || board.owner_user_id !== config.ownerUserId) {
    fail("Board metadata verification failed");
  }

  const columns = (await pg.query(
    "select id,name,position from kanban_columns where board_id=$1 order by position,id", [boardId],
  )).rows;
  if (columns.length !== config.columns.length) fail("Expected exactly " + config.columns.length + " columns");
  for (let i = 0; i < config.columns.length; i += 1) {
    const expected = [...config.columns].sort((a, b) => a.position - b.position)[i];
    const actual = columns[i];
    if (actual.id !== expected.id || actual.name !== expected.name || Number(actual.position) !== expected.position) {
      fail("Column verification failed at position " + i);
    }
  }

  const cards = (await pg.query(
    "select id,github_issue_number,github_pr_number,column_id,agent_state,workflow_phase from kanban_cards where board_id=$1 and archived_at is null order by github_issue_number",
    [boardId],
  )).rows;
  if (cards.length !== config.cards.length) fail("Expected exactly " + config.cards.length + " cards");

  for (const expected of config.cards) {
    const actual = cards.find((card) => Number(card.github_issue_number) === expected.issueNumber);
    if (!actual) fail("Missing card for GitHub Issue #" + expected.issueNumber);
    if (Number(actual.github_pr_number || 0) !== Number(expected.prNumber || 0)) fail("PR reference mismatch for #" + expected.issueNumber);
    if (actual.column_id !== expected.columnId) fail("Column mismatch for #" + expected.issueNumber);
    if (expected.workflowPhases?.length &&
        (actual.agent_state !== "idle" || actual.workflow_phase !== expected.workflowPhases[0])) {
      fail("Workflow/agent state verification failed for #" + expected.issueNumber);
    }
  }

  const boardCount = Number((await pg.query(
    "select count(*)::int as count from kanban_boards where owner_user_id=$1 and project_key=$2 and archived_at is null",
    [config.ownerUserId, config.project.key],
  )).rows[0].count);
  if (boardCount !== 1) fail("Expected exactly one managed board");

  return { board, columns, cards };
}

export async function provisionAndVerify(pg, config, options = {}) {
  const githubReferencesVerified = options.githubRequest
    ? await verifyGitHubReferences(config, options.githubRequest)
    : null;

  const boardId = await provisionProject(pg, config, options);
  const first = await verifyProject(pg, config, boardId);
  const secondBoardId = await provisionProject(pg, config, options);
  if (secondBoardId !== boardId) fail("Idempotency failed: board identity changed");
  const second = await verifyProject(pg, config, secondBoardId);

  const cardCount = Number((await pg.query(
    "select count(*)::int as count from kanban_cards where board_id=$1 and archived_at is null",
    [boardId],
  )).rows[0].count);
  if (cardCount !== config.cards.length) fail("Idempotency failed: duplicate cards detected");

  return {
    status: "passed",
    persistence: "process-local-in-memory-pglite",
    boardId,
    board: first.board,
    columnCount: second.columns.length,
    cardCount,
    githubReferencesVerified,
    idempotency: "passed",
    workflow: config.cards
      .filter((card) => card.workflowPhases?.length)
      .map((card) => ({
        issueNumber: card.issueNumber,
        agentState: second.cards.find((item) => Number(item.github_issue_number) === card.issueNumber)?.agent_state,
        workflowPhase: second.cards.find((item) => Number(item.github_issue_number) === card.issueNumber)?.workflow_phase,
      })),
  };
}
