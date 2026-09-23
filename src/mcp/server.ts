import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {
  archiveCard, archiveCardInputSchema, createCard, cardInputSchema,
  listBoard, listBoards, moveCard, moveCardInputSchema,
  updateCard, updateCardInputSchema,
} from "@/lib/kanban-domain";

const token = process.env.KANBAN_MCP_TOKEN?.trim();
const userId = process.env.KANBAN_MCP_USER_ID?.trim() || "dev-user";
if (!token) throw new Error("KANBAN_MCP_TOKEN is required; refusing unauthenticated MCP startup");

const server = new McpServer({ name: "yasin-kanban", version: "1.0.0" }, { capabilities: { tools: {} } });

function guard() {
  if (process.env.KANBAN_MCP_TOKEN?.trim() !== token) throw new Error("MCP_AUTH_FAILED");
}
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, data }) }] };
}
function fail(error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: { code } }) }], isError: true };
}

server.registerTool("kanban_list_boards", {
  description: "List Kanban boards owned by the authenticated MCP identity.",
  inputSchema: z.object({}),
}, async () => { try { guard(); return ok(await listBoards(userId)); } catch (e) { return fail(e); } });

server.registerTool("kanban_get_board", {
  description: "Read one owned Kanban board and its active cards.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128) }),
}, async ({ boardId }) => { try { guard(); return ok(await listBoard(userId, boardId)); } catch (e) { return fail(e); } });

server.registerTool("kanban_create_card", {
  description: "Create a card in an owned Kanban board.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), columnId: z.enum(["todo", "doing", "done"]),
    title: z.string().trim().min(1).max(500), description: z.string().max(10000).default(""),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    dueDate: z.string().date().nullable().default(null),
  }),
}, async (args) => { try { guard(); return ok(await createCard(userId, cardInputSchema.parse(args))); } catch (e) { return fail(e); } });

server.registerTool("kanban_update_card", {
  description: "Update an active card in an owned Kanban board.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
    columnId: z.enum(["todo", "doing", "done"]), title: z.string().trim().min(1).max(500),
    description: z.string().max(10000).default(""), priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    dueDate: z.string().date().nullable().default(null),
  }),
}, async (args) => { try { guard(); return ok(await updateCard(userId, updateCardInputSchema.parse(args))); } catch (e) { return fail(e); } });

server.registerTool("kanban_move_card", {
  description: "Move an active card within an owned board.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
    columnId: z.enum(["todo", "doing", "done"]), beforeCardId: z.string().min(1).max(128).nullable().default(null),
  }),
}, async (args) => { try { guard(); return ok(await moveCard(userId, moveCardInputSchema.parse(args))); } catch (e) { return fail(e); } });

server.registerTool("kanban_archive_card", {
  description: "Archive an active card in an owned Kanban board.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
  }),
}, async (args) => { try { guard(); return ok(await archiveCard(userId, archiveCardInputSchema.parse(args))); } catch (e) { return fail(e); } });

await server.connect(new StdioServerTransport());
