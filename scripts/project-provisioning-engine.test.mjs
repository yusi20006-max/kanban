import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { provisionAndVerify, openDatabase } from "./project-provisioning-engine.mjs";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

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

test("generic engine provisions a project and is idempotent", async () => {
  const pg = await openDatabase(MIGRATIONS_DIR);
  try {
    const config = configFor("acme/example", "ACME-EXAMPLE");
    const result = await provisionAndVerify(pg, config, {
      requestId: "test:generic",
      source: "test",
      githubRequest: async (path) => {
        assert.equal(path, "/repos/acme/example/issues/1");
        return { number: 1 };
      },
    });
    assert.equal(result.status, "passed");
    assert.equal(result.columnCount, 2);
    assert.equal(result.cardCount, 1);
    assert.equal(result.githubReferencesVerified, 1);
    assert.equal(result.idempotency, "passed");
    assert.deepEqual(result.workflow, [{ issueNumber: 1, agentState: "idle", workflowPhase: "inspect" }]);

    const boards = (await pg.query("select count(*)::int as count from kanban_boards where project_key=$1", [config.project.key])).rows[0].count;
    const cards = (await pg.query("select count(*)::int as count from kanban_cards where github_repo=$1", [config.project.repository])).rows[0].count;
    assert.equal(Number(boards), 1);
    assert.equal(Number(cards), 1);
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
    assert.equal(Number((await pg.query("select count(*)::int as count from kanban_boards where project_key in ($1,$2)", [first.project.key, second.project.key])).rows[0].count), 2);
    assert.equal(Number((await pg.query("select count(*)::int as count from kanban_cards where github_repo in ($1,$2)", [first.project.repository, second.project.repository])).rows[0].count), 2);
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
