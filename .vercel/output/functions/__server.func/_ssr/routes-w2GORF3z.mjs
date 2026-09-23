import { i as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { _ as Slot, a as Overlay2, c as Title2, d as DialogContent$1, f as DialogDescription$1, h as DialogTitle$1, i as Description2, l as Dialog$1, m as DialogPortal$1, n as Cancel, o as Portal2, p as DialogOverlay$1, r as Content2, s as Root2, t as Action, u as DialogClose, v as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { i as GripVertical, r as Plus, t as X } from "../_libs/lucide-react.mjs";
import { _ as CSS, a as MouseSensor, c as defaultDropAnimationSideEffects, g as useSensors, h as useSensor, i as KeyboardSensor, m as useDroppable, n as DragOverlay, o as TouchSensor, s as closestCorners, t as DndContext } from "../_libs/@dnd-kit/core+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as verticalListSortingStrategy, n as sortableKeyboardCoordinates, r as useSortable, t as SortableContext } from "../_libs/dnd-kit__sortable.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as Root } from "../_libs/radix-ui__react-label.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-w2GORF3z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[color,background-color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:not-disabled:scale-[0.96]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
			outline: "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
			secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
			ghost: "text-foreground hover:bg-accent hover:text-accent-foreground"
		},
		size: {
			default: "h-11 rounded-md px-4",
			sm: "h-9 rounded-sm px-3 text-xs",
			lg: "h-12 rounded-lg px-5",
			icon: "size-11 rounded-md",
			"icon-sm": "size-9 rounded-sm"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var AlertDialog = Root2;
var AlertDialogPortal = Portal2;
var AlertDialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay2, {
	className: cn("fixed inset-0 z-50 bg-foreground/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props,
	ref
}));
AlertDialogOverlay.displayName = Overlay2.displayName;
var AlertDialogContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: cn("fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[var(--shadow-lift)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
	...props
})] }));
AlertDialogContent.displayName = Content2.displayName;
function AlertDialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-1.5 text-start", className),
		...props
	});
}
function AlertDialogFooter({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
		...props
	});
}
var AlertDialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title2, {
	ref,
	className: cn("text-lg font-semibold leading-snug", className),
	...props
}));
AlertDialogTitle.displayName = Title2.displayName;
var AlertDialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Description2, {
	ref,
	className: cn("text-sm text-muted-foreground leading-normal", className),
	...props
}));
AlertDialogDescription.displayName = Description2.displayName;
var AlertDialogAction = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Action, {
	ref,
	className: cn(buttonVariants({ variant: "destructive" }), className),
	...props
}));
AlertDialogAction.displayName = Action.displayName;
var AlertDialogCancel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cancel, {
	ref,
	className: cn(buttonVariants({ variant: "outline" }), className),
	...props
}));
AlertDialogCancel.displayName = Cancel.displayName;
var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
	ref,
	className: cn("fixed inset-0 z-50 bg-foreground/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props
}));
DialogOverlay.displayName = DialogOverlay$1.displayName;
var DialogContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
	ref,
	className: cn("fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[var(--shadow-lift)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
		className: "absolute top-3 left-3 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "بستن"
		})]
	})]
})] }));
DialogContent.displayName = DialogContent$1.displayName;
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-1.5 text-start pe-8", className),
		...props
	});
}
function DialogFooter({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
		...props
	});
}
var DialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
	ref,
	className: cn("text-lg font-semibold leading-snug tracking-tight", className),
	...props
}));
DialogTitle.displayName = DialogTitle$1.displayName;
var DialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
	ref,
	className: cn("text-sm text-muted-foreground leading-normal", className),
	...props
}));
DialogDescription.displayName = DialogDescription$1.displayName;
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground shadow-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-subtle focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn("text-sm font-medium leading-none text-foreground", className),
	...props
}));
Label.displayName = Root.displayName;
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-28 w-full rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-subtle focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Textarea.displayName = "Textarea";
var COLUMN_IDS = [
	"todo",
	"doing",
	"done"
];
var COLUMN_META = {
	todo: {
		title: "برای انجام",
		hint: "کارهای پیش رو",
		tone: "todo"
	},
	doing: {
		title: "در حال انجام",
		hint: "روی میز کار",
		tone: "doing"
	},
	done: {
		title: "انجام شده",
		hint: "به پایان رسیده",
		tone: "done"
	}
};
var SEED_CARDS = {
	"seed-1": {
		id: "seed-1",
		title: "طراحی صفحه ورود",
		description: "طرح اولیه را با فونت وزیرمتن و فاصله‌گذاری ثابت ببند.",
		createdAt: 1727e9
	},
	"seed-2": {
		id: "seed-2",
		title: "بازبینی مسیر پرداخت",
		description: "منطق تخفیف و مالیات را روی سه سناریو تست کن.",
		createdAt: 17270001e5
	},
	"seed-3": {
		id: "seed-3",
		title: "نوشتن مستندات API",
		description: "مسیرهای عمومی و کدهای خطا را مستند کن.",
		createdAt: 17270002e5
	},
	"seed-4": {
		id: "seed-4",
		title: "جلسه با تیم محصول",
		description: "بازخورد اسپرینت را جمع‌بندی و اولویت‌ها را مشخص کن.",
		createdAt: 17270003e5
	},
	"seed-5": {
		id: "seed-5",
		title: "آزمایش نسخه موبایل",
		description: "اسکرول افقی ستون‌ها و هدف‌های لمسی را چک کن.",
		createdAt: 17270004e5
	}
};
var SEED_COLUMNS = {
	todo: ["seed-1", "seed-2"],
	doing: ["seed-3", "seed-4"],
	done: ["seed-5"]
};
function newId() {
	return crypto.randomUUID();
}
function removeFromColumns(columns, cardId) {
	return {
		todo: columns.todo.filter((id) => id !== cardId),
		doing: columns.doing.filter((id) => id !== cardId),
		done: columns.done.filter((id) => id !== cardId)
	};
}
var useBoardStore = create()(persist((set, get) => ({
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
		const card = {
			id,
			title: title.trim(),
			description: description.trim(),
			createdAt: Date.now()
		};
		set((state) => ({
			cards: {
				...state.cards,
				[id]: card
			},
			columns: {
				...state.columns,
				[columnId]: [id, ...state.columns[columnId]]
			}
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
					description: description.trim()
				}
			};
			if (currentCol === columnId) return { cards: nextCards };
			const without = removeFromColumns(state.columns, id);
			return {
				cards: nextCards,
				columns: {
					...without,
					[columnId]: [id, ...without[columnId]]
				}
			};
		});
	},
	deleteCard: (id) => {
		set((state) => {
			const { [id]: _removed, ...rest } = state.cards;
			return {
				cards: rest,
				columns: removeFromColumns(state.columns, id)
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
				if (same.length === nextOver.length && same.every((id, i) => id === nextOver[i])) return state;
				return { columns: {
					...state.columns,
					[overContainer]: nextOver
				} };
			}
			return { columns: {
				...state.columns,
				[from]: state.columns[from].filter((id) => id !== activeId),
				[overContainer]: nextOver
			} };
		});
	}
}), {
	name: "jaryan-board-v1",
	skipHydration: true,
	partialize: (state) => ({
		columns: state.columns,
		cards: state.cards
	})
}));
function CardDialog({ state, onClose }) {
	const titleId = (0, import_react.useId)();
	const descId = (0, import_react.useId)();
	const cards = useBoardStore((s) => s.cards);
	const columns = useBoardStore((s) => s.columns);
	const addCard = useBoardStore((s) => s.addCard);
	const updateCard = useBoardStore((s) => s.updateCard);
	const deleteCard = useBoardStore((s) => s.deleteCard);
	const open = state.mode !== "closed";
	const editing = state.mode === "edit" ? cards[state.cardId] : void 0;
	const editingColumn = state.mode === "edit" ? COLUMN_IDS.find((id) => columns[id].includes(state.cardId)) : void 0;
	const [title, setTitle] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [columnId, setColumnId] = (0, import_react.useState)("todo");
	const [error, setError] = (0, import_react.useState)("");
	const [confirmDelete, setConfirmDelete] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
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
	}, [
		state,
		editing,
		editingColumn
	]);
	function handleSubmit(event) {
		event.preventDefault();
		const nextTitle = title.trim();
		if (!nextTitle) {
			setError("عنوان کارت را بنویسید.");
			return;
		}
		if (state.mode === "create") {
			addCard({
				title: nextTitle,
				description,
				columnId
			});
			toast("کارت افزوده شد");
		} else if (state.mode === "edit") {
			updateCard(state.cardId, {
				title: nextTitle,
				description,
				columnId
			});
			toast("کارت به‌روز شد");
		}
		onClose();
	}
	function handleDelete() {
		if (state.mode !== "edit") return;
		deleteCard(state.cardId);
		setConfirmDelete(false);
		onClose();
		toast("کارت حذف شد");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (next) => !next && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: handleSubmit,
			className: "grid gap-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: state.mode === "edit" ? "ویرایش کارت" : "کارت جدید" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: state.mode === "edit" ? "عنوان، توضیح یا ستون کارت را تغییر دهید." : "عنوان و توضیح را بنویسید و ستون را انتخاب کنید." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: titleId,
									children: "عنوان"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: titleId,
									value: title,
									onChange: (e) => {
										setTitle(e.target.value);
										if (error) setError("");
									},
									placeholder: "مثلاً بازبینی طرح",
									autoFocus: true,
									"aria-invalid": Boolean(error)
								}),
								error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-destructive",
									children: error
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: descId,
								children: "توضیحات"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: descId,
								value: description,
								onChange: (e) => setDescription(e.target.value),
								placeholder: "جزئیات اختیاری",
								rows: 4
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
							className: "grid gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
								className: "text-sm font-medium",
								children: "ستون"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-3 gap-1.5 rounded-lg bg-secondary p-1",
								children: COLUMN_IDS.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setColumnId(id),
									className: cn("h-10 rounded-md px-2 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]", columnId === id ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted-foreground hover:text-foreground"),
									children: COLUMN_META[id].title
								}, id))
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [
					state.mode === "edit" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						className: "sm:me-auto text-destructive hover:bg-destructive/10 hover:text-destructive",
						onClick: () => setConfirmDelete(true),
						children: "حذف کارت"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: onClose,
						children: "لغو"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						children: state.mode === "edit" ? "ذخیره" : "افزودن"
					})
				] })
			]
		}) })
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
		open: confirmDelete,
		onOpenChange: setConfirmDelete,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTitle, { children: "حذف این کارت؟" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogDescription, { children: [
			"کارت «",
			editing?.title,
			"» برای همیشه از تابلو برداشته می‌شود."
		] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "لغو" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
			onClick: handleDelete,
			children: "حذف"
		})] })] })
	})] });
}
function CardItem({ card, overlay = false, dragging = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
		className: cn("kanban-card relative rounded-lg bg-card p-3.5 text-start", overlay && "is-overlay w-72 sm:w-80", dragging && "is-dragging"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 text-subtle opacity-70",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripVertical, { className: "size-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-medium leading-snug text-foreground",
					children: card.title
				}), card.description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1.5 line-clamp-2 text-sm leading-normal text-muted-foreground",
					children: card.description
				}) : null]
			})]
		})
	});
}
function SortableCard({ card, onOpen }) {
	const ignoreClick = (0, import_react.useRef)(false);
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
	(0, import_react.useEffect)(() => {
		if (isDragging) ignoreClick.current = true;
	}, [isDragging]);
	const style = {
		transform: CSS.Transform.toString(transform),
		transition
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: setNodeRef,
		style,
		className: cn("kanban-sortable", isDragging && "z-10"),
		...attributes,
		...listeners,
		onClick: () => {
			if (ignoreClick.current) {
				ignoreClick.current = false;
				return;
			}
			onOpen(card.id);
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardItem, {
			card,
			dragging: isDragging
		})
	});
}
function StaticCard({ card, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "w-full rounded-lg text-start",
		onClick: () => onOpen(card.id),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardItem, { card })
	});
}
var TONE_CLASS = {
	todo: "bg-todo",
	doing: "bg-doing",
	done: "bg-done"
};
function Column({ id, cardIds, cards, onAdd, onOpenCard, interactive = false }) {
	if (interactive) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InteractiveColumn, {
		id,
		cardIds,
		cards,
		onAdd,
		onOpenCard
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ColumnFrame, {
		id,
		count: cardIds.length,
		onAdd,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardList, {
			cardIds,
			cards,
			onOpenCard,
			interactive: false
		})
	});
}
function InteractiveColumn({ id, cardIds, cards, onAdd, onOpenCard }) {
	const { setNodeRef, isOver } = useDroppable({ id });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ColumnFrame, {
		id,
		count: cardIds.length,
		onAdd,
		isOver,
		listRef: setNodeRef,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortableContext, {
			items: cardIds,
			strategy: verticalListSortingStrategy,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardList, {
				cardIds,
				cards,
				onOpenCard,
				interactive: true
			})
		})
	});
}
function CardList({ cardIds, cards, onOpenCard, interactive }) {
	const items = cardIds.map((cardId) => cards[cardId]).filter(Boolean);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: items.map((card) => interactive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortableCard, {
		card,
		onOpen: onOpenCard
	}, card.id) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StaticCard, {
		card,
		onOpen: onOpenCard
	}, card.id)) });
}
function ColumnFrame({ id, count, onAdd, isOver = false, listRef, children }) {
	const meta = COLUMN_META[id];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("flex h-full w-72 shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-surface p-2 sm:w-80 lg:w-auto lg:min-w-0 lg:flex-1", isOver && "ring-2 ring-ring/30"),
		"aria-label": meta.title,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-3 px-2 pt-1.5 pb-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("size-2.5 shrink-0 rounded-full", TONE_CLASS[id]),
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold leading-snug text-foreground",
							children: meta.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: meta.hint
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular-nums rounded-sm bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-border)]",
						"aria-label": `${count.toLocaleString("fa-IR")} کارت`,
						children: count.toLocaleString("fa-IR")
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: listRef,
				className: "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-0.5 pb-1",
				children: [children, count === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-1 items-center justify-center rounded-md border border-dashed border-border px-4 py-8 text-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "کارت را اینجا رها کنید"
					})
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "button",
				variant: "ghost",
				className: "mt-1 h-11 shrink-0 justify-start text-muted-foreground hover:text-foreground",
				onClick: () => onAdd(id),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "افزودن کارت"]
			})
		]
	});
}
var dropAnimation = {
	duration: 250,
	easing: "cubic-bezier(0.22, 1, 0.36, 1)",
	sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.35" } } })
};
function BoardMark() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 24 24",
		className: "size-6",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "2.5",
				y: "3.5",
				width: "5.5",
				height: "17",
				rx: "1.4",
				fill: "currentColor"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "9.25",
				y: "8",
				width: "5.5",
				height: "12.5",
				rx: "1.4",
				fill: "currentColor",
				opacity: "0.72"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "16",
				y: "5.5",
				width: "5.5",
				height: "15",
				rx: "1.4",
				fill: "currentColor",
				opacity: "0.45"
			})
		]
	});
}
function KanbanBoard() {
	const [dndReady, setDndReady] = (0, import_react.useState)(false);
	const [activeId, setActiveId] = (0, import_react.useState)(null);
	const [dialog, setDialog] = (0, import_react.useState)({ mode: "closed" });
	const columns = useBoardStore((s) => s.columns);
	const cards = useBoardStore((s) => s.cards);
	const moveCard = useBoardStore((s) => s.moveCard);
	const findContainer = useBoardStore((s) => s.findContainer);
	(0, import_react.useEffect)(() => {
		setDndReady(true);
		try {
			const result = useBoardStore.persist.rehydrate();
			Promise.resolve(result).then(() => {
				useBoardStore.getState().setHasHydrated(true);
			});
		} catch {
			useBoardStore.getState().setHasHydrated(true);
		}
	}, []);
	const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: {
		delay: 180,
		tolerance: 6
	} }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
	const total = columns.todo.length + columns.doing.length + columns.done.length;
	const activeCard = activeId ? cards[activeId] : void 0;
	const prefersReducedMotion = (0, import_react.useMemo)(() => {
		if (typeof window === "undefined") return false;
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}, []);
	function handleDragStart(event) {
		setActiveId(String(event.active.id));
	}
	function relocate(overId) {
		if (!activeId || !overId) return;
		const overContainer = findContainer(overId);
		if (!overContainer) return;
		const from = findContainer(activeId);
		if (!from) return;
		if (from === overContainer && overId === activeId) return;
		moveCard(activeId, overId, overContainer);
	}
	function handleDragOver(event) {
		const overId = event.over?.id ? String(event.over.id) : void 0;
		if (!overId || !activeId) return;
		const from = findContainer(activeId);
		const to = findContainer(overId);
		if (!from || !to || from === to) return;
		relocate(overId);
	}
	function handleDragEnd(event) {
		relocate(event.over?.id ? String(event.over.id) : void 0);
		setActiveId(null);
	}
	function handleDragCancel() {
		setActiveId(null);
	}
	const columnRow = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-full items-stretch gap-3 overflow-x-auto snap-x snap-mandatory lg:snap-none",
		children: COLUMN_IDS.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Column, {
			id,
			cardIds: columns[id],
			cards,
			interactive: dndReady,
			onAdd: (columnId) => setDialog({
				mode: "create",
				columnId
			}),
			onOpenCard: (cardId) => setDialog({
				mode: "edit",
				cardId
			})
		}, id))
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh flex-col overflow-hidden bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "shrink-0 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:px-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoardMark, {})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-lg font-semibold leading-tight tracking-tight",
								children: "جریان"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted-foreground",
								children: [
									"تابلوی کار · ",
									total.toLocaleString("fa-IR"),
									" کارت"
								]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						className: "shrink-0",
						onClick: () => setDialog({
							mode: "create",
							columnId: "todo"
						}),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "کارت جدید"]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "mx-auto min-h-0 w-full max-w-6xl flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-6",
				children: dndReady ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DndContext, {
					sensors,
					collisionDetection: closestCorners,
					onDragStart: handleDragStart,
					onDragOver: handleDragOver,
					onDragEnd: handleDragEnd,
					onDragCancel: handleDragCancel,
					children: [columnRow, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DragOverlay, {
						dropAnimation: prefersReducedMotion ? { duration: 0 } : dropAnimation,
						children: activeCard ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardItem, {
							card: activeCard,
							overlay: true
						}) : null
					})]
				}) : columnRow
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardDialog, {
				state: dialog,
				onClose: () => setDialog({ mode: "closed" })
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KanbanBoard, {});
}
//#endregion
export { Home as component };
