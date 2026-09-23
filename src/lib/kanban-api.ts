import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export const cardInputSchema = z.object({
  boardId: z.string().min(1).max(128),
  columnId: z.enum(["todo", "doing", "done"]),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10000).default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate: z.string().date().nullable().default(null),
});

const cardIdSchema = z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128) });

export const listBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const boards = await sql<{ id: string; name: string }>`select id, name from kanban_boards where id = ${data.boardId}`;
    if (!boards[0]) throw new Error("BOARD_NOT_FOUND");
    const cards = await sql<{
      id: string; column_id: "todo" | "doing" | "done"; position: number;
      title: string; description: string; priority: "low" | "medium" | "high" | "critical";
      due_date: string | null; created_at: string; updated_at: string;
    }>`select id, column_id, position, title, description, priority, due_date, created_at, updated_at
       from kanban_cards
       where board_id = ${data.boardId} and archived_at is null
       order by column_id, position, created_at`;
    return { board: boards[0], cards };
  });

export const createCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(cardInputSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    const rows = await sql<{ position: number }>`select coalesce(max(position), -1) + 1 as position from kanban_cards where board_id = ${data.boardId} and column_id = ${data.columnId} and archived_at is null`;
    const position = Number(rows[0]?.position ?? 0);
    await sql`insert into kanban_cards
      (id, board_id, column_id, position, title, description, priority, due_date)
      values (${id}, ${data.boardId}, ${data.columnId}, ${position}, ${data.title}, ${data.description}, ${data.priority}, ${data.dueDate})`;
    return { id };
  });

export const updateCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(cardInputSchema.extend({ cardId: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const result = await sql`update kanban_cards
      set column_id = ${data.columnId}, title = ${data.title}, description = ${data.description},
          priority = ${data.priority}, due_date = ${data.dueDate}, updated_at = now()
      where id = ${data.cardId} and board_id = ${data.boardId} and archived_at is null`;
    if (result.length === 0) throw new Error("CARD_NOT_FOUND");
    return { ok: true };
  });

export const archiveCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(cardIdSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const result = await sql`update kanban_cards set archived_at = now(), updated_at = now()
      where id = ${data.cardId} and board_id = ${data.boardId} and archived_at is null`;
    if (result.length === 0) throw new Error("CARD_NOT_FOUND");
    return { ok: true };
  });

export const moveCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({
    boardId: z.string().min(1).max(128),
    cardId: z.string().min(1).max(128),
    columnId: z.enum(["todo", "doing", "done"]),
    beforeCardId: z.string().min(1).max(128).nullable().default(null),
  }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const exists = await sql<{ id: string }>`select id from kanban_cards where id = ${data.cardId} and board_id = ${data.boardId} and archived_at is null`;
    if (!exists[0]) throw new Error("CARD_NOT_FOUND");
    await sql`update kanban_cards set column_id = ${data.columnId}, updated_at = now()
      where id = ${data.cardId} and board_id = ${data.boardId}`;
    const ordered = await sql<{ id: string }>`select id from kanban_cards
      where board_id = ${data.boardId} and column_id = ${data.columnId} and archived_at is null and id <> ${data.cardId}
      order by position, created_at`;
    let position = ordered.length;
    if (data.beforeCardId) {
      const idx = ordered.findIndex((row) => row.id === data.beforeCardId);
      if (idx >= 0) position = idx;
    }
    const ids = [...ordered];
    ids.splice(position, 0, { id: data.cardId });
    for (let i = 0; i < ids.length; i += 1) {
      await sql`update kanban_cards set position = ${i}, updated_at = now() where id = ${ids[i].id} and board_id = ${data.boardId}`;
    }
    return { ok: true };
  });