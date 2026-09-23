import { useEffect, useId, useState, type FormEvent } from "react";
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
  COLUMN_IDS,
  COLUMN_META,
  type ColumnId,
  useBoardStore,
} from "@/lib/board-store";
import { cn } from "@/lib/utils";

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
  const editingColumn =
    state.mode === "edit"
      ? COLUMN_IDS.find((id) => columns[id].includes(state.cardId))
      : undefined;

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
      setColumnId(editingColumn ?? "todo");
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
                  {COLUMN_IDS.map((id) => (
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
                      {COLUMN_META[id].title}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

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
