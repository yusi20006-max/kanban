import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  archiveCard, archiveCardInputSchema, createCard, cardInputSchema, listBoard, listBoards,
  moveCard, moveCardInputSchema, updateCard, updateCardInputSchema,
  recordWorkflowPhase, transitionAgent,
  createBoard, updateBoard, archiveBoard, upsertColumn, addLabel, setCardLabel,
  addChecklistItem, setChecklistItem, addComment, searchCards,
} from "@/lib/kanban-domain";
import { linkGithubCard as linkGithub, refreshGithubCard as refreshGithub } from "@/lib/github-api.server";
import { auditMutation, assertRateLimit } from "@/lib/security.server";
import { recordPhaseInputSchema, transitionInputSchema } from "@/lib/workflow";
import { KANBAN_CONTRACT_VERSION, publicErrorCode } from "@/lib/contract";
import { agentRegistrationSchema } from "@/lib/agent-control-plane/contracts";
import { registerAgent, unregisterAgent, listAgents, getAgent } from "@/lib/agent-control-plane/registry";

type Guard = () => void | Promise<void>;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, contractVersion: KANBAN_CONTRACT_VERSION, data }) }] };
}
function fail(error: unknown) {
  const code = publicErrorCode(error);
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, contractVersion: KANBAN_CONTRACT_VERSION, error: { code, message: "Operation failed" } }) }], isError: true };
}

async function audited(
  userId: string, guard: Guard, action: string,
  data: { boardId?: string; cardId?: string }, operation: () => Promise<unknown>,
) {
  const requestId = crypto.randomUUID();
  try {
    await guard();
    await assertRateLimit(userId, "mcp");
    const result = await operation();
    await auditMutation({ actorUserId: userId, source: "mcp", action, boardId: data.boardId, cardId: data.cardId, requestId, outcome: "success" });
    return ok(result);
  } catch (error) {
    await auditMutation({ actorUserId: userId, source: "mcp", action, boardId: data.boardId, cardId: data.cardId, requestId, outcome: "error", errorCode: error instanceof Error ? error.message : "INTERNAL_ERROR" });
    return fail(error);
  }
}

export function registerKanbanTools(server: McpServer, userId: string, guard: Guard) {
  server.registerTool("kanban_register_agent", {
    description: "Register or refresh an execution agent owned by the authenticated identity.",
    inputSchema: z.object({ agentId: z.string().trim().min(1).max(128), name: z.string().trim().min(1).max(200), capabilities: z.array(z.string().trim().min(1).max(128)).max(100).default([]), metadata: z.record(z.string(), z.unknown()).default({}) }),
  }, async (args) => audited(userId, guard, "agent.register", {}, () => registerAgent(userId, agentRegistrationSchema.parse(args))));

  server.registerTool("kanban_unregister_agent", {
    description: "Disable an owned execution agent.",
    inputSchema: z.object({ agentId: z.string().trim().min(1).max(128) }),
  }, async ({ agentId }) => audited(userId, guard, "agent.unregister", {}, () => unregisterAgent(userId, agentId)));

  server.registerTool("kanban_list_agents", {
    description: "List execution agents owned by the authenticated identity.",
    inputSchema: z.object({}),
  }, async () => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listAgents(userId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_get_agent", {
    description: "Read one owned execution agent.",
    inputSchema: z.object({ agentId: z.string().trim().min(1).max(128) }),
  }, async ({ agentId }) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await getAgent(userId, agentId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_list_boards", {
    description: "List Kanban boards owned by the authenticated identity.",
    inputSchema: z.object({}),
  }, async () => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listBoards(userId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_get_board", {
    description: "Read one owned Kanban board and its active cards.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128) }),
  }, async ({ boardId }) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listBoard(userId, boardId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_create_card", {
    description: "Create a card in an owned Kanban board.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), columnId: z.string().trim().min(1).max(128),
      title: z.string().trim().min(1).max(500), description: z.string().max(10000).default(""),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      dueDate: z.string().date().nullable().default(null), idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "card.create", args, () => createCard(userId, cardInputSchema.parse(args))));

  server.registerTool("kanban_update_card", {
    description: "Update an active card in an owned Kanban board.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      columnId: z.string().trim().min(1).max(128), title: z.string().trim().min(1).max(500),
      description: z.string().max(10000).default(""), priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      dueDate: z.string().date().nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "card.update", args, () => updateCard(userId, updateCardInputSchema.parse(args))));

  server.registerTool("kanban_move_card", {
    description: "Move an active card within an owned board.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      columnId: z.string().trim().min(1).max(128), beforeCardId: z.string().min(1).max(128).nullable().default(null), idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "card.move", args, () => moveCard(userId, moveCardInputSchema.parse(args))));

  server.registerTool("kanban_archive_card", {
    description: "Archive an active card in an owned Kanban board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128) }),
  }, async (args) => audited(userId, guard, "card.archive", args, () => archiveCard(userId, archiveCardInputSchema.parse(args))));

  server.registerTool("kanban_link_github", {
    description: "Link an owned card to a GitHub repository Issue and/or Pull Request.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      repo: z.string().regex(/^[^/]+\\/[^/]+$/), issueNumber: z.number().int().positive().nullable().default(null),
      prNumber: z.number().int().positive().nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "github.link", args, () => linkGithub(userId, args)));

  server.registerTool("kanban_refresh_github", {
    description: "Refresh GitHub Issue, PR and latest CI state for an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128) }),
  }, async (args) => audited(userId, guard, "github.refresh", args, () => refreshGithub(userId, args)));

  server.registerTool("kanban_transition_agent", {
    description: "Transition the execution state of an owned card using the workflow state machine.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      toState: z.enum(["idle", "running", "blocked", "waiting-ci", "waiting-review", "completed", "failed"]),
      phase: z.enum(["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"]).optional(),
      result: z.string().max(20000).default(""),
    }),
  }, async (args) => audited(userId, guard, "workflow.transition", args, () => transitionAgent(userId, transitionInputSchema.parse(args))));

  server.registerTool("kanban_record_phase", {
    description: "Record a workflow phase result and advance the card to the next phase.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      phase: z.enum(["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"]),
      result: z.string().max(20000).default(""),
    }),
  }, async (args) => audited(userId, guard, "workflow.phase", args, () => recordWorkflowPhase(userId, recordPhaseInputSchema.parse(args))));

  server.registerTool("kanban_create_board", {
    description: "Create an isolated Kanban board/project.",
    inputSchema: z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "board.create", {}, () => createBoard(userId, args)));

  server.registerTool("kanban_update_board", {
    description: "Update an owned Kanban board/project.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "board.update", args, () => updateBoard(userId, args)));

  server.registerTool("kanban_archive_board", {
    description: "Archive an owned board without deleting project data.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128) }),
  }, async ({ boardId }) => audited(userId, guard, "board.archive", { boardId }, () => archiveBoard(userId, boardId)));

  server.registerTool("kanban_upsert_column", {
    description: "Create or reorder a custom column on an owned board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), id: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), position: z.number().int().min(0) }),
  }, async (args) => audited(userId, guard, "column.upsert", args, () => upsertColumn(userId, args)));

  server.registerTool("kanban_add_label", {
    description: "Create a label on an owned board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(100) }),
  }, async (args) => audited(userId, guard, "label.add", args, () => addLabel(userId, args)));

  server.registerTool("kanban_set_card_label", {
    description: "Enable or disable a label on an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), labelId: z.string().min(1).max(128), enabled: z.boolean() }),
  }, async (args) => audited(userId, guard, "card.label", args, () => setCardLabel(userId, args)));

  server.registerTool("kanban_add_checklist_item", {
    description: "Add a checklist item to an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), title: z.string().trim().min(1).max(500) }),
  }, async (args) => audited(userId, guard, "checklist.add", args, () => addChecklistItem(userId, args)));

  server.registerTool("kanban_set_checklist_item", {
    description: "Mark an owned card checklist item complete or incomplete.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), itemId: z.string().min(1).max(128), completed: z.boolean() }),
  }, async (args) => audited(userId, guard, "checklist.update", args, () => setChecklistItem(userId, args)));

  server.registerTool("kanban_add_comment", {
    description: "Add an authenticated comment to an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), body: z.string().trim().min(1).max(20000) }),
  }, async (args) => audited(userId, guard, "comment.add", args, () => addComment(userId, args)));

  server.registerTool("kanban_search_cards", {
    description: "Search active cards by title or description within an owned board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), query: z.string().trim().min(1).max(200) }),
  }, async (args) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await searchCards(userId, args)); } catch (e) { return fail(e); } });
}
