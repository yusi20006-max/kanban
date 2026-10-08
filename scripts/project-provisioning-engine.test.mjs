import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { provisionAndVerify, provisionProject, verifyProject, openDatabase } from "./project-provisioning-engine.mjs";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
const YASIN_CHESS_CONFIG = fileURLToPath(new URL("../projects/yasin-chess/board.json", import.meta.url));

function configFor(repository, key, issueNumber = 1) {
  return {
    version: 1,
    project: { key, name: "Generic Project", repository },
    ownerUserId: "dev-user",
    columns: [
      { position: 0, id: "todo", name: "Backlog" },
      { position: 1, id: "done", name: "Done" },
    ],
    cards: [
      { id: "issue-" + issueNumber, issueNumber, columnId: "todo", workflowPhases: ["inspect", "implement"] },
    ],
  };
}

async function loadYasinChess() {
  return JSON.parse(await readFile(YASIN_CHESS_CONFIG, "utf8"));
}

test("generic engine provisions a project, records audit metadata, and is idempotent", async () => {
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const config = configFor("acme/example", "ACME-EXAMPLE");
    const result = await provisionAndVerify(pg, config, {
      requestId: "test:generic",
      source: "test",
      actorUserId: "dev-user",
      githubRequest: async (path) => {
        assert.equal(path, "/repos/acme/example/issues/1");
        return { number: 1 };
      },
    });

    assert.equal(result.status, "passed");
    assert.equal(result.persistence, "process-local-in-memory-pglite");
    assert.equal(result.columnCount, 2);
    assert.equal(result.cardCount, 1);
    assert.equal(result.githubReferencesVerified, 1);
    assert.equal(result.idempotency, "passed");
    assert.deepEqual(result.workflow, [{ issueNumber: 1, agentState: "idle", workflowPhase: "inspect" }]);

    const boards = Number((await pg.query(
      "select count(*)::int as count from kanban_boards where project_key=$1", [config.project.key],
    )).rows[0].count);
    const cards = Number((await pg.query(
      "select count(*)::int as count from kanban_cards where github_repo=$1", [config.project.repository],
    )).rows[0].count);
    const audits = (await pg.query(
      "select action,actor_user_id,source,request_id,outcome from kanban_audit_events where board_id=$1 order by created_at,id",
      [result.boardId],
    )).rows;

    assert.equal(boards, 1);
    assert.equal(cards, 1);
    assert.equal(audits.length, 4);
    assert.deepEqual(
      audits.map((row) => [row.action, row.actor_user_id, row.source, row.request_id, row.outcome]).sort((a, b) => a[0].localeCompare(b[0])),
      [
        ["provision.board", "dev-user", "test", "test:generic", "success"],
        ["provision.board", "dev-user", "test", "test:generic", "success"],
        ["provision.card", "dev-user", "test", "test:generic", "success"],
        ["provision.card", "dev-user", "test", "test:generic", "success"],
      ],
    );
  } finally {
    await pg.close();
  }
});

test("generic engine supports multiple independent projects in one runtime", async () => {
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const first = configFor("acme/one", "ACME-ONE", 10);
    const second = configFor("acme/two", "ACME-TWO", 20);

    await provisionAndVerify(pg, first, {
      requestId: "test:first",
      source: "test",
      githubRequest: async (path) => ({ number: Number(path.split("/").pop()) }),
    });
    await provisionAndVerify(pg, second, {
      requestId: "test:second",
      source: "test",
      githubRequest: async (path) => ({ number: Number(path.split("/").pop()) }),
    });

    assert.equal(
      Number((await pg.query(
        "select count(*)::int as count from kanban_boards where project_key in ($1,$2)",
        [first.project.key, second.project.key],
      )).rows[0].count),
      2,
    );
    assert.equal(
      Number((await pg.query(
        "select count(*)::int as count from kanban_cards where github_repo in ($1,$2)",
        [first.project.repository, second.project.repository],
      )).rows[0].count),
      2,
    );
  } finally {
    await pg.close();
  }
});

test("provisioning and verification use the same PGlite runtime", async () => {
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const config = configFor("acme/same-runtime", "ACME-SAME-RUNTIME", 30);
    const boardId = await provisionProject(pg, config, { requestId: "test:same-runtime", source: "test" });
    const verification = await verifyProject(pg, config, boardId);

    assert.equal(verification.board.id, boardId);
    assert.equal(verification.cards.length, 1);
  } finally {
    await pg.close();
  }
});

test("a separate PGlite runtime does not observe process-local provisioning state", async () => {
  const config = configFor("acme/process-local", "ACME-PROCESS-LOCAL", 31);
  const firstRuntime = await openDatabase(MIGRATIONS_DIR);
  const boardId = await provisionProject(firstRuntime, config, { requestId: "test:process-local", source: "test" });
  await firstRuntime.close();

  const secondRuntime = await openDatabase(MIGRATIONS_DIR);
  try {
    await assert.rejects(
      verifyProject(secondRuntime, config, boardId),
      /Board read-back failed/,
    );
  } finally {
    await secondRuntime.close();
  }
});

test("generic engine rejects invalid configuration before mutating the database", async () => {
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const invalidConfig = configFor("acme/invalid", "ACME-INVALID", 32);
    invalidConfig.cards[0].columnId = "missing";

    await assert.rejects(
      provisionProject(pg, invalidConfig, { requestId: "test:invalid-config", source: "test" }),
      /config.cards\[0\].columnId/,
    );

    assert.equal(
      Number((await pg.query(
        "select count(*)::int as count from kanban_boards where project_key=$1",
        [invalidConfig.project.key],
      )).rows[0].count),
      0,
    );
  } finally {
    await pg.close();
  }
});

test("generic engine rejects a mismatched GitHub issue reference", async () => {
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const config = configFor("acme/example", "ACME-EXAMPLE", 7);
    await assert.rejects(
      provisionAndVerify(pg, config, {
        requestId: "test:invalid-ref",
        source: "test",
        githubRequest: async () => ({ number: 99 }),
      }),
      /Invalid GitHub Issue #7/,
    );
  } finally {
    await pg.close();
  }
});

test("Yasin Chess remains a generic provisioning regression fixture", async () => {
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const config = await loadYasinChess();
    const requestedPaths = [];

    const result = await provisionAndVerify(pg, config, {
      requestId: "test:yasin-chess-regression",
      source: "test",
      githubRequest: async (path) => {
        requestedPaths.push(path);
        const parts = path.split("/");
        const kind = parts.at(-2);
        const number = Number(parts.at(-1));
        assert.ok((kind === "issues" || kind === "pulls") && Number.isInteger(number), "unexpected GitHub path: " + path);
        return { number, ...(kind === "pulls" ? { base: { repo: { full_name: config.project.repository } } } : {}) };
      },
    });

    assert.equal(result.status, "passed");
    assert.equal(result.columnCount, 10);
    assert.equal(result.cardCount, 7);
    assert.equal(result.githubReferencesVerified, 7);
    assert.equal(result.idempotency, "passed");
    assert.deepEqual(result.workflow, [{ issueNumber: 422, agentState: "idle", workflowPhase: "inspect" }]);
    assert.ok(requestedPaths.includes("/repos/yusi20006-max/yasin-chess/issues/422"));
    assert.ok(requestedPaths.includes("/repos/yusi20006-max/yasin-chess/pulls/423"));
  } finally {
    await pg.close();
  }
});
