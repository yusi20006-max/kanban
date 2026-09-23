import { create } from "zustand";
import { listBoard, createCard, updateCard, moveCard as moveCardRemote, archiveCard } from "@/lib/kanban-api";

export const COLUMN_IDS = ["todo", "doing", "done"] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];

export type Priority = "low" | "medium" | "high" | "critical";

export type Card = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt?: number;
  priority: Priority;
  dueDate?: string | null;
};

export type Columns = Record<ColumnId, string[]>;

export const COLUMN_META: Record<ColumnId, { title: string; hint: string; tone: ColumnId }> = {
  todo: { title: "برای انجام", hint: "کارهای پیش رو", tone: "todo" },
  doing: { title: "در حال انجام", hint: "روی میز کار", tone: "doing" },
  done: { title: "انجام شده", hint: "به پایان رسیده", tone: "done" },
};

const BOARD_ID = "default";

type BoardState = {
  columns: Columns;
  cards: Record<string, Card>;
  hasHydrated: boolean;
  syncing: boolean;
  syncError: string | null;
  setHasHydrated: (value: boolean) => void;
  hydrate: () => Promise<void>;
  addCard: (input: { title: string; description: string; columnId: ColumnId }) => Promise<string>;
  updateCard: (id: string, input: { title: string; description: string; columnId: ColumnId }) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (activeId: string, overId: string | null, overContainer: ColumnId) => void;
  findContainer: (id: string) => ColumnId | undefined;
};

function toCard(row: {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}): Card {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

function fromRows(rows: Awaited<ReturnType<typeof listBoard>>["cards"]): {
  cards: Record<string, Card>;
  columns: Columns;
} {
  const cards: Record<string, Card> = {};
  const columns: Columns = { todo: [], doing: [], done: [] };
  for (const row of rows) {
    const card = toCard(row);
    cards[card.id] = card;
    columns[row.column_id].push(card.id);
  }
  return { cards, columns };
}

export const useBoardStore = create<BoardState>((set, get) => ({
  columns: { todo: [], doing: [], done: [] },
  cards: {},
  hasHydrated: false,
  syncing: false,
  syncError: null,

  setHasHydrated: (value) => set({ hasHydrated: value }),

  hydrate: async () => {
    set({ syncing: true, syncError: null });
    try {
      const result = await listBoard({ data: { boardId: BOARD_ID } });
      set({ ...fromRows(result.cards), hasHydrated: true, syncing: false });
    } catch (error) {
      set({
        hasHydrated: true,
        syncing: false,
        syncError: error instanceof Error ? error.message : "SYNC_FAILED",
      });
    }
  },

  findContainer: (id) => {
    if (id === "todo" || id === "doing" || id === "done") return id;
    const { columns } = get();
    return COLUMN_IDS.find((key) => columns[key].includes(id));
  },

  addCard: async ({ title, description, columnId }) => {
    set({ syncing: true, syncError: null });
    try {
      const result = await createCard({
        data: { boardId: BOARD_ID, title: title.trim(), description: description.trim(), columnId },
      });
      await get().hydrate();
      return result.id;
    } catch (error) {
      set({ syncing: false, syncError: error instanceof Error ? error.message : "CREATE_FAILED" });
      throw error;
    }
  },

  updateCard: async (id, { title, description, columnId }) => {
    const existing = get().cards[id];
    if (!existing) return;
    set({ syncing: true, syncError: null });
    try {
      await updateCard({
        data: {
          boardId: BOARD_ID,
          cardId: id,
          title: title.trim(),
          description: description.trim(),
          columnId,
          priority: existing.priority,
          dueDate: existing.dueDate ?? null,
        },
      });
      await get().hydrate();
    } catch (error) {
      set({ syncing: false, syncError: error instanceof Error ? error.message : "UPDATE_FAILED" });
      throw error;
    }
  },

  deleteCard: async (id) => {
    set({ syncing: true, syncError: null });
    try {
      await archiveCard({ data: { boardId: BOARD_ID, cardId: id } });
      await get().hydrate();
    } catch (error) {
      set({ syncing: false, syncError: error instanceof Error ? error.message : "ARCHIVE_FAILED" });
      throw error;
    }
  },

  moveCard: (activeId, overId, overContainer) => {
    const from = get().findContainer(activeId);
    if (!from) return;
    const current = get().columns[overContainer].filter((id) => id !== activeId);
    let insertIndex = current.length;
    if (overId && overId !== overContainer) {
      const index = current.indexOf(overId);
      if (index >= 0) insertIndex = index;
    }
    const next = [...current];
    next.splice(insertIndex, 0, activeId);
    if (from === overContainer && get().columns[from].every((id, i) => id === next[i])) return;
    set((state) => ({
      syncing: true,
      syncError: null,
      columns: {
        ...state.columns,
        [from]: state.columns[from].filter((id) => id !== activeId),
        [overContainer]: next,
      },
    }));
    void moveCardRemote({
      data: {
        boardId: BOARD_ID,
        cardId: activeId,
        columnId: overContainer,
        beforeCardId: next[next.indexOf(activeId) + 1] ?? null,
      },
    }).then(() => set({ syncing: false })).catch((error) => {
      set({ syncing: false, syncError: error instanceof Error ? error.message : "MOVE_FAILED" });
      void get().hydrate();
    });
  },
}));
