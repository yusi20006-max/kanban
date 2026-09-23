import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Card } from "@/lib/board-store";
import { cn } from "@/lib/utils";

type CardItemProps = {
  card: Card;
  overlay?: boolean;
  dragging?: boolean;
};

export function CardItem({ card, overlay = false, dragging = false }: CardItemProps) {
  return (
    <article
      className={cn(
        "kanban-card relative rounded-lg bg-card p-3.5 text-start",
        overlay && "is-overlay w-72 sm:w-80",
        dragging && "is-dragging",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-subtle opacity-70" aria-hidden="true">
          <GripVertical className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug text-foreground">{card.title}</h3>
          {card.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-normal text-muted-foreground">
              {card.description}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type SortableCardProps = {
  card: Card;
  onOpen: (id: string) => void;
};

export function SortableCard({ card, onOpen }: SortableCardProps) {
  const ignoreClick = useRef(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  useEffect(() => {
    if (isDragging) ignoreClick.current = true;
  }, [isDragging]);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("kanban-sortable", isDragging && "z-10")}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (ignoreClick.current) {
          ignoreClick.current = false;
          return;
        }
        onOpen(card.id);
      }}
    >
      <CardItem card={card} dragging={isDragging} />
    </div>
  );
}

type StaticCardProps = {
  card: Card;
  onOpen: (id: string) => void;
};

export function StaticCard({ card, onOpen }: StaticCardProps) {
  return (
    <button type="button" className="w-full rounded-lg text-start" onClick={() => onOpen(card.id)}>
      <CardItem card={card} />
    </button>
  );
}
