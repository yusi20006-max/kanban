import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { SortableCard, StaticCard } from "@/components/kanban/card-item";
import { Button } from "@/components/ui/button";
import { type Card, type ColumnId, useBoardStore } from "@/lib/board-store";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  todo: "bg-todo",
  doing: "bg-doing",
  done: "bg-done",
};

type ColumnProps = {
  id: ColumnId;
  cardIds: string[];
  cards: Record<string, Card>;
  onAdd: (columnId: ColumnId) => void;
  onOpenCard: (id: string) => void;
  interactive?: boolean;
};

export function Column({
  id,
  cardIds,
  cards,
  onAdd,
  onOpenCard,
  interactive = false,
}: ColumnProps) {
  if (interactive) {
    return (
      <InteractiveColumn
        id={id}
        cardIds={cardIds}
        cards={cards}
        onAdd={onAdd}
        onOpenCard={onOpenCard}
      />
    );
  }
  return (
    <ColumnFrame id={id} count={cardIds.length} onAdd={onAdd}>
      <CardList cardIds={cardIds} cards={cards} onOpenCard={onOpenCard} interactive={false} />
    </ColumnFrame>
  );
}

function InteractiveColumn({ id, cardIds, cards, onAdd, onOpenCard }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <ColumnFrame id={id} count={cardIds.length} onAdd={onAdd} isOver={isOver} listRef={setNodeRef}>
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <CardList cardIds={cardIds} cards={cards} onOpenCard={onOpenCard} interactive />
      </SortableContext>
    </ColumnFrame>
  );
}

function CardList({
  cardIds,
  cards,
  onOpenCard,
  interactive,
}: {
  cardIds: string[];
  cards: Record<string, Card>;
  onOpenCard: (id: string) => void;
  interactive: boolean;
}) {
  const items = cardIds.map((cardId) => cards[cardId]).filter(Boolean);
  return (
    <>
      {items.map((card) =>
        interactive ? (
          <SortableCard key={card.id} card={card} onOpen={onOpenCard} />
        ) : (
          <StaticCard key={card.id} card={card} onOpen={onOpenCard} />
        ),
      )}
    </>
  );
}

function ColumnFrame({
  id,
  count,
  onAdd,
  isOver = false,
  listRef,
  children,
}: {
  id: ColumnId;
  count: number;
  onAdd: (columnId: ColumnId) => void;
  isOver?: boolean;
  listRef?: (node: HTMLElement | null) => void;
  children: ReactNode;
}) {
  const meta = useBoardStore.getState().columnMeta[id] ?? { title: id, hint: "کارت‌های این ستون", tone: id };
  return (
    <section
      className={cn(
        "flex h-full w-72 shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-surface p-2 sm:w-80 lg:w-auto lg:min-w-0 lg:flex-1",
        isOver && "ring-2 ring-ring/30",
      )}
      aria-label={meta.title}
    >
      <header className="flex items-center gap-3 px-2 pt-1.5 pb-3">
        <span className={cn("size-2.5 shrink-0 rounded-full", TONE_CLASS[meta.tone] ?? "bg-muted")} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-snug text-foreground">{meta.title}</h2>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
        </div>
        <span
          className="tabular-nums rounded-sm bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-border)]"
          aria-label={`${count.toLocaleString("fa-IR")} کارت`}
        >
          {count.toLocaleString("fa-IR")}
        </span>
      </header>

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-0.5 pb-1"
      >
        {children}
        {count === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">کارت را اینجا رها کنید</p>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-1 h-11 shrink-0 justify-start text-muted-foreground hover:text-foreground"
        onClick={() => onAdd(id)}
      >
        <Plus className="size-4" />
        افزودن کارت
      </Button>
    </section>
  );
}
