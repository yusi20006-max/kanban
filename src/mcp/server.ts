import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {
  archiveCard, archiveCardInputSchema, createCard, cardInputSchema,
  listBoard, listBoards, moveCard, moveCardInputSchema,
  updateCard, updateCardInputSchema,
} from "@/lib/kanban-domain";
import { linkGithubCard, refreshGithubCard } from "@/lib/github-api.server";
import { recordWorkflowPhase, transitionAgent, createBoard, updateBoard, archiveBoard, upsertColumn, addLabel, setCardLabel, addChecklistItem, setChecklistItem, addComment, searchCards } from "@/lib/kanban-domain";
import { recordPhaseInputSchema, transitionInputSchema } from "@/lib/workflow";

const token = process.env.KANBAN_MCP_TOKEN?.trim();
const userId = process.env.KANBAN_MCP_USER_ID?.trim() || "dev-user";
if (!token) throw new Error("KANBAN_MCP_TOKEN is required; refusing unauthenticated MCP startup");

const server = new McpServer({ name: "yasin-kanban", version: "1.0.0" });

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
    boardId: z.string().min(1).max(128), columnId: z.string().trim().min(1).max(128),
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

server.registerTool("kanban_link_github", {
  description: "Link an owned card to a GitHub repository Issue and/or Pull Request.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
    repo: z.string().regex(/^[^/]+\\/[^/]+$/),
    issueNumber: z.number().int().positive().nullable().default(null),
    prNumber: z.number().int().positive().nullable().default(null),
  }),
}, async (args) => { try { guard(); return ok(await linkGithubCard(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_refresh_github", {
  description: "Refresh GitHub Issue, PR and latest CI state for an owned card.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
  }),
}, async (args) => { try { guard(); return ok(await refreshGithubCard(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_transition_agent", {
  description: "Transition the execution state of an owned card using the workflow state machine.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
    toState: z.enum(["idle", "running", "blocked", "waiting-ci", "waiting-review", "completed", "failed"]),
    phase: z.enum(["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"]).optional(),
    result: z.string().max(20000).default(""),
  }),
}, async (args) => { try { guard(); return ok(await transitionAgent(userId, transitionInputSchema.parse(args))); } catch (e) { return fail(e); } });

server.registerTool("kanban_record_phase", {
  description: "Record a workflow phase result and advance the card to the next phase.",
  inputSchema: z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
    phase: z.enum(["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"]),
    result: z.string().max(20000).default(""),
  }),
}, async (args) => { try { guard(); return ok(await recordWorkflowPhase(userId, recordPhaseInputSchema.parse(args))); } catch (e) { return fail(e); } });

server.registerTool("kanban_create_board", {
  description: "Create an isolated Kanban board/project for the authenticated identity.",
  inputSchema: z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }),
}, async (args) => { try { guard(); return ok(await createBoard(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_update_board", {
  description: "Update an owned Kanban board/project.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }),
}, async (args) => { try { guard(); return ok(await updateBoard(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_archive_board", {
  description: "Archive an owned board by deleting its project data.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128) }),
}, async ({ boardId }) => { try { guard(); return ok(await archiveBoard(userId, boardId)); } catch (e) { return fail(e); } });

server.registerTool("kanban_upsert_column", {
  description: "Create or reorder a custom column on an owned board.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), id: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), position: z.number().int().min(0) }),
}, async (args) => { try { guard(); return ok(await upsertColumn(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_add_label", {
  description: "Create a label on an owned board.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(100) }),
}, async (args) => { try { guard(); return ok(await addLabel(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_set_card_label", {
  description: "Enable or disable a label on an owned card.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), labelId: z.string().min(1).max(128), enabled: z.boolean() }),
}, async (args) => { try { guard(); return ok(await setCardLabel(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_add_checklist_item", {
  description: "Add a checklist item to an owned card.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), title: z.string().trim().min(1).max(500) }),
}, async (args) => { try { guard(); return ok(await addChecklistItem(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_set_checklist_item", {
  description: "Mark an owned card checklist item complete or incomplete.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), itemId: z.string().min(1).max(128), completed: z.boolean() }),
}, async (args) => { try { guard(); return ok(await setChecklistItem(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_add_comment", {
  description: "Add an authenticated comment to an owned card.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), body: z.string().trim().min(1).max(20000) }),
}, async (args) => { try { guard(); return ok(await addComment(userId, args)); } catch (e) { return fail(e); } });

server.registerTool("kanban_search_cards", {
  description: "Search active cards by title or description within an owned board.",
  inputSchema: z.object({ boardId: z.string().min(1).max(128), query: z.string().trim().min(1).max(200) }),
}, async (args) => { try { guard(); return ok(await searchCards(userId, args)); } catch (e) { return fail(e); } });

await server.connect(new StdioServerTransport());
