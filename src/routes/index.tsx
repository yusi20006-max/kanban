import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban/board";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <KanbanBoard />;
}
