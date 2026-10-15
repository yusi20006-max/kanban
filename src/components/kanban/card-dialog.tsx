import { useEffect, useId, useState, type FormEvent } from "react";
import { Play, RefreshCw, Square, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ColumnId,
  useBoardStore,
} from "@/lib/board-store";
import { cn } from "@/lib/utils";
import { startCardExecutionFn, transitionAgentFn, refreshGithubFn } from "@/lib/kanban-api";

export type CardDialogState =
  | { mode: "closed" }
  | { mode: "create"; columnId: ColumnId }
  | { mode: "edit"; cardId: string };

type CardDialogProps = {
  state: CardDialogState;
  onClose: () => void;
};

export function CardDialog({ state, onClose }: CardDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cards = useBoardStore((s) => s.cards);
  const columns = useBoardStore((s) => s.columns);
  const addCard = useBoardStore((s) => s.addCard);
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);

  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? cards[state.cardId] : undefined;
  const editingColumn = state.mode === "edit" ? Object.keys(columns).find((id) => columns[id].includes(state.cardId)) : undefined;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState<ColumnId>("todo");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (state.mode === "create") {
      setTitle("");
      setDescription("");
      setColumnId(state.columnId);
      setError("");
      setConfirmDelete(false);
    } else if (state.mode === "edit" && editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setColumnId(editingColumn ?? Object.keys(columns)[0] ?? "");
      setError("");
      setConfirmDelete(false);
    }
  }, [state, editing, editingColumn]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("عنوان کارت را بنویسید.");
      return;
    }
    if (state.mode === "create") {
      await addCard({ title: nextTitle, description, columnId });
      toast("کارت افزوده شد");
    } else if (state.mode === "edit") {
      await updateCard(state.cardId, { title: nextTitle, description, columnId });
      toast("کارت به‌روز شد");
    }
    onClose();
  }

  async function startExecution() {
    if (state.mode !== "edit") return;
    try {
      await startCardExecutionFn({ data: { boardId: useBoardStore.getState().boardId, cardId: state.cardId, idempotencyKey: `card-start:${state.cardId}:${Date.now()}` } });
      await useBoardStore.getState().hydrate();
      toast("Task و Execution Agent شروع شد");
    } catch (error) {
      toast(error instanceof Error ? error.message : "CONTROL_PLANE_START_FAILED");
    }
  }

  async function handleTransition(toState: "running" | "blocked" | "completed") {
    if (state.mode !== "edit") return;
    try {
      await transitionAgentFn({ data: { boardId: useBoardStore.getState().boardId, cardId: state.cardId, toState } });
      await useBoardStore.getState().hydrate();
      toast(toState === "running" ? "اجرای Agent شروع شد" : toState === "completed" ? "Agent تکمیل شد" : "Agent متوقف شد");
    } catch (error) {
      toast(error instanceof Error ? error.message : "CONTROL_PLANE_ACTION_FAILED");
    }
  }

  async function refreshGithub() {
    if (state.mode !== "edit" || !editing?.githubRepo) return;
    try {
      await refreshGithubFn({ data: { boardId: useBoardStore.getState().boardId, cardId: state.cardId } });
      await useBoardStore.getState().hydrate();
      toast("وضعیت GitHub به‌روز شد");
    } catch (error) {
      toast(error instanceof Error ? error.message : "GITHUB_REFRESH_FAILED");
    }
  }

  async function handleDelete() {
    if (state.mode !== "edit") return;
    await deleteCard(state.cardId);
    setConfirmDelete(false);
    onClose();
    toast("کارت حذف شد");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{state.mode === "edit" ? "ویرایش کارت" : "کارت جدید"}</DialogTitle>
              <DialogDescription>
                {state.mode === "edit"
                  ? "عنوان، توضیح یا ستون کارت را تغییر دهید."
                  : "عنوان و توضیح را بنویسید و ستون را انتخاب کنید."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor={titleId}>عنوان</Label>
                <Input
                  id={titleId}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="مثلاً بازبینی طرح"
                  autoFocus
                  aria-invalid={Boolean(error)}
                />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={descId}>توضیحات</Label>
                <Textarea
                  id={descId}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="جزئیات اختیاری"
                  rows={4}
                />
              </div>

              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">ستون</legend>
                <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-secondary p-1">
                  {Object.keys(columns).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setColumnId(id)}
                      className={cn(
                        "h-10 rounded-md px-2 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                        columnId === id
                          ? "bg-card text-foreground shadow-[var(--shadow-border)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {useBoardStore.getState().columnMeta[id]?.title ?? id}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {state.mode === "edit" && editing ? (
              <section className="grid gap-3 rounded-lg border border-border bg-secondary/40 p-3" aria-label="کنترل اجرای Agent">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">کنترل اجرای Agent</p>
                    <p className="text-xs text-muted-foreground">وضعیت و فاز مستقل از ستون Kanban نگهداری می‌شوند.</p>
                  </div>
                  <span className="rounded-full bg-card px-2.5 py-1 text-xs font-medium">{editing.agentState}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>فاز: {editing.workflowPhase}</span>
                  {editing.githubIssueNumber ? <span>Issue #{editing.githubIssueNumber}</span> : null}
                  {editing.githubPrNumber ? <span>PR #{editing.githubPrNumber}</span> : null}
                  {editing.githubCiState ? <span>CI: {editing.githubCiState}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing.agentState === "idle" ? <Button type="button" size="sm" onClick={() => void startExecution()}><Play className="size-4" />شروع</Button> : null}
                  {editing.agentState === "running" ? <>
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleTransition("blocked")}><Square className="size-4" />توقف/مسدود</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleTransition("completed")}><XCircle className="size-4" />تکمیل</Button>
                  </> : null}
                  {editing.agentState === "blocked" || editing.agentState === "waiting-ci" || editing.agentState === "waiting-review" ? <Button type="button" size="sm" onClick={() => void handleTransition("running")}><Play className="size-4" />ادامه</Button> : null}
                  {editing.agentState === "failed" || editing.agentState === "completed" ? <Button type="button" size="sm" onClick={() => void handleTransition("running")}><Play className="size-4" />اجرای مجدد</Button> : null}
                  {editing.githubRepo ? <Button type="button" size="sm" variant="outline" onClick={() => void refreshGithub()}><RefreshCw className="size-4" />به‌روزرسانی GitHub</Button> : null}
                </div>
              </section>
            ) : null}

            <DialogFooter>
              {state.mode === "edit" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:me-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  حذف کارت
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>
                لغو
              </Button>
              <Button type="submit">{state.mode === "edit" ? "ذخیره" : "افزودن"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف این کارت؟</AlertDialogTitle>
            <AlertDialogDescription>
              کارت «{editing?.title}» برای همیشه از تابلو برداشته می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>لغو</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
