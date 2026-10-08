import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProjectProvisioningConfig, ProjectProvisioningConfigError } from "./project-provisioning-contract.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const YASIN_CHESS_CONFIG = join(ROOT, "projects/yasin-chess/board.json");

async function loadYasinChess() {
  return JSON.parse(await readFile(YASIN_CHESS_CONFIG, "utf8"));
}

test("Yasin Chess board.json satisfies the generic provisioning contract", async () => {
  const config = await loadYasinChess();
  assert.equal(validateProjectProvisioningConfig(config), config);
  assert.equal(config.project.repository, "yusi20006-max/yasin-chess");
  assert.equal(config.columns.length, 10);
  assert.equal(config.cards.length, 7);
});

test("a minimal project configuration is valid", () => {
  const config = {
    version: 1,
    project: { key: "DEMO", name: "Demo", repository: "owner/repo" },
    ownerUserId: "owner",
    columns: [{ position: 0, id: "todo", name: "Todo" }],
    cards: []
  };
  assert.equal(validateProjectProvisioningConfig(config), config);
});

test("missing required project fields are rejected", () => {
  const config = {
    version: 1,
    project: { key: "DEMO", name: "Demo" },
    ownerUserId: "owner",
    columns: [{ position: 0, id: "todo", name: "Todo" }],
    cards: []
  };
  assert.throws(
    () => validateProjectProvisioningConfig(config),
    (error) => error instanceof ProjectProvisioningConfigError && error.path === "config.project.repository"
  );
});

test("duplicate column ids are rejected", () => {
  const config = {
    version: 1,
    project: { key: "DEMO", name: "Demo", repository: "owner/repo" },
    ownerUserId: "owner",
    columns: [
      { position: 0, id: "todo", name: "Todo" },
      { position: 1, id: "todo", name: "Again" }
    ],
    cards: []
  };
  assert.throws(
    () => validateProjectProvisioningConfig(config),
    (error) => error instanceof ProjectProvisioningConfigError && error.path === "config.columns.id"
  );
});

test("non-contiguous column positions are rejected", () => {
  const config = {
    version: 1,
    project: { key: "DEMO", name: "Demo", repository: "owner/repo" },
    ownerUserId: "owner",
    columns: [
      { position: 0, id: "todo", name: "Todo" },
      { position: 2, id: "done", name: "Done" }
    ],
    cards: []
  };
  assert.throws(
    () => validateProjectProvisioningConfig(config),
    (error) => error instanceof ProjectProvisioningConfigError && error.path === "config.columns.position"
  );
});

test("duplicate card issue numbers are rejected", () => {
  const baseCard = { id: "a", issueNumber: 10, columnId: "todo" };
  const config = {
    version: 1,
    project: { key: "DEMO", name: "Demo", repository: "owner/repo" },
    ownerUserId: "owner",
    columns: [{ position: 0, id: "todo", name: "Todo" }],
    cards: [baseCard, { ...baseCard, id: "b" }]
  };
  assert.throws(
    () => validateProjectProvisioningConfig(config),
    (error) => error instanceof ProjectProvisioningConfigError && error.path === "config.cards.issueNumber"
  );
});

test("unknown fields are rejected", () => {
  const config = {
    version: 1,
    project: { key: "DEMO", name: "Demo", repository: "owner/repo" },
    ownerUserId: "owner",
    columns: [{ position: 0, id: "todo", name: "Todo" }],
    cards: [],
    unexpected: true
  };
  assert.throws(
    () => validateProjectProvisioningConfig(config),
    (error) => error instanceof ProjectProvisioningConfigError && error.path === "config.unexpected"
  );
});

test("malformed cards are rejected", () => {
  const config = {
    version: 1,
    project: { key: "DEMO", name: "Demo", repository: "owner/repo" },
    ownerUserId: "owner",
    columns: [{ position: 0, id: "todo", name: "Todo" }],
    cards: [{ id: "card", issueNumber: 1, columnId: "missing" }]
  };
  assert.throws(
    () => validateProjectProvisioningConfig(config),
    (error) => error instanceof ProjectProvisioningConfigError && error.path === "config.cards[0].columnId"
  );
});
