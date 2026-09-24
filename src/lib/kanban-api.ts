import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { auditMutation } from "@/lib/security.server";
import { linkGithubCard, refreshGithubCard } from "@/lib/github-api.server";
import {
  archiveCard as archiveCardDomain, archiveCardInputSchema,
  createCard as createCardDomain, cardInputSchema,
  listBoard as listBoardDomain, moveCard as moveCardDomain, moveCardInputSchema,
  updateCard as updateCardDomain, updateCardInputSchema,
  createBoard, updateBoard, archiveBoard, upsertColumn, addLabel, setCardLabel,
  addChecklistItem, setChecklistItem, addComment, searchCards,
  recordWorkflowPhase, transitionAgent,
} from "@/lib/kanban-domain";
import { recordPhaseInputSchema, transitionInputSchema } from "@/lib/workflow";
import { agentRegistrationSchema } from "@/lib/agent-control-plane/contracts";
import { registerAgent, unregisterAgent, listAgents, getAgent } from "@/lib/agent-control-plane/registry";

type RequestContext = { userId: string; requestId: string };

async function audited<T>(
  context: RequestContext,
  action: string,
  data: { boardId?: string; cardId?: string },
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const result = await operation();
    await auditMutation({
      actorUserId: context.userId, source: "web", action,
      boardId: data.boardId, cardId: data.cardId, requestId: context.requestId, outcome: "success",
    });
    return result;
  } catch (error) {
    await auditMutation({
      actorUserId: context.userId, source: "web", action,
      boardId: data.boardId, cardId: data.cardId, requestId: context.requestId, outcome: "error",
      errorCode: error instanceof Error ? error.message : "INTERNAL_ERROR",
    });
    throw error;
  }
}

export const listBoardFn = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128) }))
  .handler(async ({ data, context }) => listBoardDomain(context.userId, data.boardId));

export const createCardFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(cardInputSchema)
  .handler(async ({ data, context }) => audited(context, "card.create", data, () => createCardDomain(context.userId, data)));

export const updateCardFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(updateCardInputSchema)
  .handler(async ({ data, context }) => audited(context, "card.update", data, () => updateCardDomain(context.userId, data)));

export const archiveCardFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(archiveCardInputSchema)
  .handler(async ({ data, context }) => audited(context, "card.archive", data, () => archiveCardDomain(context.userId, data)));

export const moveCardFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(moveCardInputSchema)
  .handler(async ({ data, context }) => audited(context, "card.move", data, () => moveCardDomain(context.userId, data)));

export const listBoard = listBoardFn;
export const createCard = createCardFn;
export const updateCard = updateCardFn;
export const archiveCard = archiveCardFn;
export const moveCard = moveCardFn;

export const linkGithubFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({
    boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
    repo: z.string().regex(/^[^/]+\\/[^/]+$/),
    issueNumber: z.number().int().positive().nullable().default(null),
    prNumber: z.number().int().positive().nullable().default(null),
  }))
  .handler(async ({ data, context }) => audited(context, "github.link", data, () => linkGithubCard(context.userId, data)));

export const refreshGithubFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128) }))
  .handler(async ({ data, context }) => audited(context, "github.refresh", data, () => refreshGithubCard(context.userId, data)));

export const transitionAgentFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(transitionInputSchema)
  .handler(async ({ data, context }) => audited(context, "workflow.transition", data, () => transitionAgent(context.userId, data)));

export const recordWorkflowPhaseFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(recordPhaseInputSchema)
  .handler(async ({ data, context }) => audited(context, "workflow.phase", data, () => recordWorkflowPhase(context.userId, data)));

export const createBoardFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }))
  .handler(async ({ data, context }) => audited(context, "board.create", {}, () => createBoard(context.userId, data)));

export const updateBoardFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }))
  .handler(async ({ data, context }) => audited(context, "board.update", data, () => updateBoard(context.userId, data)));

export const archiveBoardFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128) }))
  .handler(async ({ data, context }) => audited(context, "board.archive", data, () => archiveBoard(context.userId, data.boardId)));

export const upsertColumnFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), id: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), position: z.number().int().min(0) }))
  .handler(async ({ data, context }) => audited(context, "column.upsert", data, () => upsertColumn(context.userId, data)));

export const addLabelFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(100) }))
  .handler(async ({ data, context }) => audited(context, "label.add", data, () => addLabel(context.userId, data)));

export const setCardLabelFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), labelId: z.string().min(1).max(128), enabled: z.boolean() }))
  .handler(async ({ data, context }) => audited(context, "card.label", data, () => setCardLabel(context.userId, data)));

export const addChecklistItemFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), title: z.string().trim().min(1).max(500) }))
  .handler(async ({ data, context }) => audited(context, "checklist.add", data, () => addChecklistItem(context.userId, data)));

export const setChecklistItemFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), itemId: z.string().min(1).max(128), completed: z.boolean() }))
  .handler(async ({ data, context }) => audited(context, "checklist.update", data, () => setChecklistItem(context.userId, data)));

export const addCommentFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), body: z.string().trim().min(1).max(20000) }))
  .handler(async ({ data, context }) => audited(context, "comment.add", data, () => addComment(context.userId, data)));

export const searchCardsFn = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128), query: z.string().trim().min(1).max(200) }))
  .handler(async ({ data, context }) => searchCards(context.userId, data));


export const registerAgentFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(agentRegistrationSchema)
  .handler(async ({ data, context }) => audited(context, "agent.register", {}, () => registerAgent(context.userId, data)));

export const unregisterAgentFn = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .inputValidator(z.object({ agentId: z.string().trim().min(1).max(128) }))
  .handler(async ({ data, context }) => audited(context, "agent.unregister", {}, () => unregisterAgent(context.userId, data.agentId)));

export const listAgentsFn = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .handler(async ({ context }) => listAgents(context.userId));

export const getAgentFn = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .inputValidator(z.object({ agentId: z.string().trim().min(1).max(128) }))
  .handler(async ({ data, context }) => getAgent(context.userId, data.agentId));
