import { create } from "zustand";
import { persist } from "zustand/middleware";

export const COLUMN_IDS = ["todo", "doing", "done"] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];

export type Card = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
};

export type Columns = Record<ColumnId, string[]>;

export const COLUMN_META: Record<
  ColumnId,
  { title: string; hint: string; tone: "todo" | "doing" | "done" }
> = {
  todo: { title: "برای انجام", hint: "کارهای پیش رو", tone: "todo" },
  doing: { title: "در حال انجام", hint: "روی میز کار", tone: "doing" },
  done: { title: "انجام شده", hint: "به پایان رسیده", tone: "done" },
};

const SEED_CARDS: Record<string, Card> = {
  "seed-1": {
    id: "seed-1",
    title: "طراحی صفحه ورود",
    description: "طرح اولیه را با فونت وزیرمتن و فاصله‌گذاری ثابت ببند.",
    createdAt: 1_727_000_000_000,
  },
  "seed-2": {
    id: "seed-2",
    title: "بازبینی مسیر پرداخت",
    description: "منطق تخفیف و مالیات را روی سه سناریو تست کن.",
    createdAt: 1_727_000_100_000,
  },
  "seed-3": {
    id: "seed-3",
    title: "نوشتن مستندات API",
    description: "مسیرهای عمومی و کدهای خطا را مستند کن.",
    createdAt: 1_727_000_200_000,
  },
  "seed-4": {
    id: "seed-4",
    title: "جلسه با تیم محصول",
    description: "بازخورد اسپرینت را جمع‌بندی و اولویت‌ها را مشخص کن.",
    createdAt: 1_727_000_300_000,
  },
  "seed-5": {
    id: "seed-5",
    title: "آزمایش نسخه موبایل",
    description: "اسکرول افقی ستون‌ها و هدف‌های لمسی را چک کن.",
    createdAt: 1_727_000_400_000,
  },
};

const SEED_COLUMNS: Columns = {
  todo: ["seed-1", "seed-2"],
  doing: ["seed-3", "seed-4"],
  done: ["seed-5"],
};

function newId() {
  return crypto.randomUUID();
}

type BoardState = {
  columns: Columns;
  cards: Record<string, Card>;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addCard: (input: { title: string; description: string; columnId: ColumnId }) => string;
  updateCard: (id: string, input: { title: string; description: string; columnId: ColumnId }) => void;
  deleteCard: (id: string) => void;
  moveCard: (activeId: string, overId: string | null, overContainer: ColumnId) => void;
  findContainer: (id: string) => ColumnId | undefined;
};

function removeFromColumns(columns: Columns, cardId: string): Columns {
  return {
    todo: columns.todo.filter((id) => id !== cardId),
    doing: columns.doing.filter((id) => id !== cardId),
    done: columns.done.filter((id) => id !== cardId),
  };
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      columns: SEED_COLUMNS,
      cards: SEED_CARDS,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      findContainer: (id) => {
        if (id === "todo" || id === "doing" || id === "done") return id;
        const { columns } = get();
        return COLUMN_IDS.find((key) => columns[key].includes(id));
      },
      addCard: ({ title, description, columnId }) => {
        const id = newId();
        const card: Card = {
          id,
          title: title.trim(),
          description: description.trim(),
          createdAt: Date.now(),
        };
        set((state) => ({
          cards: { ...state.cards, [id]: card },
          columns: {
            ...state.columns,
            [columnId]: [id, ...state.columns[columnId]],
          },
        }));
        return id;
      },
      updateCard: (id, { title, description, columnId }) => {
        set((state) => {
          const existing = state.cards[id];
          if (!existing) return state;
          const currentCol = COLUMN_IDS.find((key) => state.columns[key].includes(id));
          const nextCards = {
            ...state.cards,
            [id]: {
              ...existing,
              title: title.trim(),
              description: description.trim(),
            },
          };
          if (currentCol === columnId) {
            return { cards: nextCards };
          }
          const without = removeFromColumns(state.columns, id);
          return {
            cards: nextCards,
            columns: {
              ...without,
              [columnId]: [id, ...without[columnId]],
            },
          };
        });
      },
      deleteCard: (id) => {
        set((state) => {
          const { [id]: _removed, ...rest } = state.cards;
          return {
            cards: rest,
            columns: removeFromColumns(state.columns, id),
          };
        });
      },
      moveCard: (activeId, overId, overContainer) => {
        set((state) => {
          const from = COLUMN_IDS.find((key) => state.columns[key].includes(activeId));
          if (!from) return state;

          const overItems = state.columns[overContainer].filter((id) => id !== activeId);
          let insertIndex = overItems.length;

          if (overId && overId !== overContainer) {
            const idx = overItems.indexOf(overId);
            if (idx >= 0) insertIndex = idx;
          }

          const nextOver = [...overItems];
          nextOver.splice(insertIndex, 0, activeId);

          if (from === overContainer) {
            const same = state.columns[from];
            if (same.length === nextOver.length && same.every((id, i) => id === nextOver[i])) {
              return state;
            }
            return {
              columns: {
                ...state.columns,
                [overContainer]: nextOver,
              },
            };
          }

          return {
            columns: {
              ...state.columns,
              [from]: state.columns[from].filter((id) => id !== activeId),
              [overContainer]: nextOver,
            },
          };
        });
      },
    }),
    {
      name: "jaryan-board-v1",
      skipHydration: true,
      partialize: (state) => ({
        columns: state.columns,
        cards: state.cards,
      }),
    },
  ),
);
