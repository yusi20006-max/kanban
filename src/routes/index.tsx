import { createFileRoute, Link } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban/board";
import { SignInGate } from "@/lib/auth/gates";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <SignInGate
      fallback={
        <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
          <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
            <h1 className="text-2xl font-semibold">ورود به جریان</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              برای ساخت و ذخیره کارت‌ها، ابتدا وارد حساب خود شوید یا حساب بسازید.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-foreground"
            >
              ورود یا ساخت حساب
            </Link>
          </section>
        </main>
      }
    >
      <KanbanBoard />
    </SignInGate>
  );
}
