import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { CardDialog, type CardDialogState } from "@/components/kanban/card-dialog";
import { CardItem } from "@/components/kanban/card-item";
import { Column } from "@/components/kanban/column";
import { Button } from "@/components/ui/button";
import { COLUMN_IDS, useBoardStore, type ColumnId } from "@/lib/board-store";

const dropAnimation: DropAnimation = {
  duration: 250,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: "0.35" },
    },
  }),
};

function BoardMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <rect x="2.5" y="3.5" width="5.5" height="17" rx="1.4" fill="currentColor" />
      <rect x="9.25" y="8" width="5.5" height="12.5" rx="1.4" fill="currentColor" opacity="0.72" />
      <rect x="16" y="5.5" width="5.5" height="15" rx="1.4" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function KanbanBoard() {
  const [dndReady, setDndReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CardDialogState>({ mode: "closed" });

  const columns = useBoardStore((s) => s.columns);
  const cards = useBoardStore((s) => s.cards);
  const moveCard = useBoardStore((s) => s.moveCard);
  const findContainer = useBoardStore((s) => s.findContainer);

  useEffect(() => {
    setDndReady(true);
    void useBoardStore.getState().hydrate();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const total = columns.todo.length + columns.doing.length + columns.done.length;
  const activeCard = activeId ? cards[activeId] : undefined;

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function relocate(overId: string | undefined) {
    if (!activeId || !overId) return;
    const overContainer = findContainer(overId);
    if (!overContainer) return;
    const from = findContainer(activeId);
    if (!from) return;
    if (from === overContainer && overId === activeId) return;
    moveCard(activeId, overId, overContainer as ColumnId);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id ? String(event.over.id) : undefined;
    if (!overId || !activeId) return;
    const from = findContainer(activeId);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;
    relocate(overId);
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id ? String(event.over.id) : undefined;
    relocate(overId);
    setActiveId(null);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  const columnRow = (
    <div className="flex h-full items-stretch gap-3 overflow-x-auto snap-x snap-mandatory lg:snap-none">
      {COLUMN_IDS.map((id) => (
        <Column
          key={id}
          id={id}
          cardIds={columns[id]}
          cards={cards}
          interactive={dndReady}
          onAdd={(columnId) => setDialog({ mode: "create", columnId })}
          onOpenCard={(cardId) => setDialog({ mode: "edit", cardId })}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BoardMark />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight tracking-tight">جریان</p>
              <p className="text-xs text-muted-foreground">
                تابلوی کار · {total.toLocaleString("fa-IR")} کارت
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="shrink-0"
            onClick={() => setDialog({ mode: "create", columnId: "todo" })}
          >
            <Plus className="size-4" />
            کارت جدید
          </Button>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-6xl flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-6">
        {dndReady ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {columnRow}
            <DragOverlay dropAnimation={prefersReducedMotion ? { duration: 0 } : dropAnimation}>
              {activeCard ? <CardItem card={activeCard} overlay /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          columnRow
        )}
      </main>

      <CardDialog state={dialog} onClose={() => setDialog({ mode: "closed" })} />
    </div>
  );
}
