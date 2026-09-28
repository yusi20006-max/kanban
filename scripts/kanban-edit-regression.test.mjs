import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN_FILE = join(ROOT, "src/lib/kanban-domain.ts");

test("updateCard uses RETURNING for successful UPDATE detection (#135)", async () => {
  const source = await readFile(DOMAIN_FILE, "utf8");
  const start = source.indexOf("export async function updateCard");
  const end = source.indexOf("export async function archiveCard");
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /update\s+kanban_cards[\s\S]*?returning\s+id/i);
  assert.match(block, /updated\.length\s*===\s*0/);
  assert.match(block, /CARD_NOT_FOUND/);
});

test("archiveCard uses RETURNING for the same Sql result contract (#135)", async () => {
  const source = await readFile(DOMAIN_FILE, "utf8");
  const start = source.indexOf("export async function archiveCard");
  const end = source.indexOf("export async function moveCard");
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /update\s+kanban_cards[\s\S]*?returning\s+id/i);
  assert.match(block, /archived\.length\s*===\s*0/);
});

test("updateCard SQL persists all editable fields (#135)", async () => {
  const source = await readFile(DOMAIN_FILE, "utf8");
  const start = source.indexOf("export async function updateCard");
  const end = source.indexOf("export async function archiveCard");
  const block = source.slice(start, end);
  for (const field of ["column_id=$1","title=$2","description=$3","priority=$4","due_date=$5","updated_at=now()"]) assert.ok(block.includes(field), field);
});
