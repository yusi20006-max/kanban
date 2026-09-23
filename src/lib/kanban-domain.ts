import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertTransition, nextPhase, transitionInputSchema, recordPhaseInputSchema, type AgentState } from "@/lib/workflow";

export const columnIdSchema = z.enum(["todo", "doing", "done"]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const boardIdSchema = z.string().min(1).max(128);
export const cardIdSchema = z.string().min(1).max(128);

export const cardInputSchema = z.object({
  boardId: boardIdSchema,
  columnId: columnIdSchema,
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10000).default(""),
  priority: prioritySchema.default("medium"),
  dueDate: z.string().date().nullable().default(null),
});
export const updateCardInputSchema = cardInputSchema.extend({ cardId: cardIdSchema });
export const archiveCardInputSchema = z.object({ boardId: boardIdSchema, cardId: cardIdSchema });
export const moveCardInputSchema = z.object({
  boardId: boardIdSchema, cardId: cardIdSchema, columnId: columnIdSchema,
  beforeCardId: cardIdSchema.nullable().default(null),
});

export type CardInput = z.infer<typeof cardInputSchema>;
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;
export type MoveCardInput = z.infer<typeof moveCardInputSchema>;

export class DomainError extends Error {
  constructor(public readonly code: "BOARD_NOT_FOUND" | "CARD_NOT_FOUND", message = code) {
    super(message);
    this.name = "DomainError";
  }
}

async function assertBoardOwner(userId: string, boardId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    "select id from kanban_boards where id = $1 and owner_user_id = $2",
    [boardId, userId],
  );
  if (!rows[0]) throw new DomainError("BOARD_NOT_FOUND");
  return sql;
}

export async function listBoards(userId: string) {
  const sql = await getSql();
  return sql.query<{ id: string; name: string; created_at: string; updated_at: string }>(
    "select id, name, created_at, updated_at from kanban_boards where owner_user_id = $1 order by created_at, id",
    [userId],
  );
}

export async function listBoard(userId: string, boardId: string) {
  const sql = await assertBoardOwner(userId, boardId);
  const boards = await sql.query<{ id: string; name: string }>(
    "select id, name from kanban_boards where id = $1", [boardId],
  );
  const cards = await sql.query(
    "select id, column_id, position, title, description, priority, due_date, created_at, updated_at " +
    "from kanban_cards where board_id = $1 and archived_at is null " +
    "order by column_id, position, created_at",
    [boardId],
  );
  return { board: boards[0], cards };
}

export async function createCard(userId: string, data: CardInput) {
  const sql = await assertBoardOwner(userId, data.boardId);
  const id = crypto.randomUUID();
  const rows = await sql.query<{ position: number }>(
    "select coalesce(max(position), -1) + 1 as position from kanban_cards " +
    "where board_id = $1 and column_id = $2 and archived_at is null",
    [data.boardId, data.columnId],
  );
  const position = Number(rows[0]?.position ?? 0);
  await sql.query(
    "insert into kanban_cards (id, board_id, column_id, position, title, description, priority, due_date) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, data.boardId, data.columnId, position, data.title, data.description, data.priority, data.dueDate],
  );
  return { id };
}

export async function updateCard(userId: string, data: UpdateCardInput) {
  const sql = await assertBoardOwner(userId, data.boardId);
  const result = await sql.query(
    "update kanban_cards set column_id=$1,title=$2,description=$3,priority=$4,due_date=$5,updated_at=now() where id=$6 and board_id=$7 and archived_at is null",
    [data.columnId, data.title, data.description, data.priority, data.dueDate, data.cardId, data.boardId],
  );
  if (result.length === 0) throw new DomainError("CARD_NOT_FOUND");
  return { ok: true };
}

export async function archiveCard(userId: string, data: z.infer<typeof archiveCardInputSchema>) {
  const sql = await assertBoardOwner(userId, data.boardId);
  const result = await sql.query(
    "update kanban_cards set archived_at=now(),updated_at=now() where id=$1 and board_id=$2 and archived_at is null",
    [data.cardId, data.boardId],
  );
  if (result.length === 0) throw new DomainError("CARD_NOT_FOUND");
  return { ok: true };
}

export async function moveCard(userId: string, data: MoveCardInput) {
  const sql = await assertBoardOwner(userId, data.boardId);
  const exists = await sql.query<{ id: string }>(
    "select id from kanban_cards where id=$1 and board_id=$2 and archived_at is null",
    [data.cardId, data.boardId],
  );
  if (!exists[0]) throw new DomainError("CARD_NOT_FOUND");
  if (data.beforeCardId === data.cardId) throw new Error("INVALID_MOVE_TARGET");
  await sql.query(
    "update kanban_cards set column_id=$1,updated_at=now() where id=$2 and board_id=$3",
    [data.columnId, data.cardId, data.boardId],
  );
  const ordered = await sql.query<{ id: string }>(
    "select id from kanban_cards where board_id=$1 and column_id=$2 and archived_at is null and id <> $3 order by position, created_at",
    [data.boardId, data.columnId, data.cardId],
  );
  let position = ordered.length;
  if (data.beforeCardId) {
    const idx = ordered.findIndex((row) => row.id === data.beforeCardId);
    if (idx < 0) throw new Error("INVALID_MOVE_TARGET");
    position = idx;
  }
  const ids = [...ordered];
  ids.splice(position, 0, { id: data.cardId });
  for (let i = 0; i < ids.length; i += 1) {
    await sql.query("update kanban_cards set position=$1,updated_at=now() where id=$2 and board_id=$3", [i, ids[i].id, data.boardId]);
  }
  return { ok: true };
}

export async function transitionAgent(userId: string, data: z.infer<typeof transitionInputSchema>) {
  const sql = await assertBoardOwner(userId, data.boardId);
  const rows = await sql.query<{ agent_state: AgentState; workflow_phase: string }>(
    "select c.agent_state,c.workflow_phase from kanban_cards c join kanban_boards b on b.id=c.board_id " +
    "where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",
    [data.cardId, data.boardId, userId],
  );
  const current = rows[0];
  if (!current) throw new DomainError("CARD_NOT_FOUND");
  assertTransition(current.agent_state, data.toState);
  const phase = data.phase ?? current.workflow_phase;
  await sql.query(
    "update kanban_cards set agent_state=$1,workflow_phase=$2,updated_at=now() where id=$3 and board_id=$4",
    [data.toState, phase, data.cardId, data.boardId],
  );
  await sql.query(
    "insert into kanban_workflow_events (id,card_id,phase,agent_state,attempt,result) " +
    "values ($1,$2,$3,$4,(select count(*)+1 from kanban_workflow_events where card_id=$2 and phase=$3),$5)",
    [crypto.randomUUID(), data.cardId, phase, data.toState, data.result],
  );
  return { cardId: data.cardId, fromState: current.agent_state, toState: data.toState, phase };
}

export async function recordWorkflowPhase(userId: string, data: z.infer<typeof recordPhaseInputSchema>) {
  const sql = await assertBoardOwner(userId, data.boardId);
  const rows = await sql.query<{ agent_state: AgentState; workflow_phase: string }>(
    "select c.agent_state,c.workflow_phase from kanban_cards c join kanban_boards b on b.id=c.board_id " +
    "where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",
    [data.cardId, data.boardId, userId],
  );
  if (!rows[0]) throw new DomainError("CARD_NOT_FOUND");
  const target = nextPhase(data.phase);
  await sql.query(
    "update kanban_cards set workflow_phase=$1,updated_at=now() where id=$2 and board_id=$3",
    [target, data.cardId, data.boardId],
  );
  await sql.query(
    "insert into kanban_workflow_events (id,card_id,phase,agent_state,attempt,result) " +
    "values ($1,$2,$3,$4,(select count(*)+1 from kanban_workflow_events where card_id=$2 and phase=$3),$5)",
    [crypto.randomUUID(), data.cardId, data.phase, rows[0].agent_state, data.result],
  );
  return { cardId: data.cardId, completedPhase: data.phase, nextPhase: target };
}
