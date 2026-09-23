import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  archiveCard as archiveCardDomain, archiveCardInputSchema,
  createCard as createCardDomain, cardInputSchema,
  listBoard as listBoardDomain, moveCard as moveCardDomain, moveCardInputSchema,
  updateCard as updateCardDomain, updateCardInputSchema,
} from "@/lib/kanban-domain";

export const listBoardFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ boardId: z.string().min(1).max(128) }))
  .handler(async ({ data, context }) => listBoardDomain(context.userId, data.boardId));

export const createCardFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware]).inputValidator(cardInputSchema)
  .handler(async ({ data, context }) => createCardDomain(context.userId, data));

export const updateCardFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware]).inputValidator(updateCardInputSchema)
  .handler(async ({ data, context }) => updateCardDomain(context.userId, data));

export const archiveCardFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware]).inputValidator(archiveCardInputSchema)
  .handler(async ({ data, context }) => archiveCardDomain(context.userId, data));

export const moveCardFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware]).inputValidator(moveCardInputSchema)
  .handler(async ({ data, context }) => moveCardDomain(context.userId, data));

export const listBoard = listBoardFn;
export const createCard = createCardFn;
export const updateCard = updateCardFn;
export const archiveCard = archiveCardFn;
export const moveCard = moveCardFn;
