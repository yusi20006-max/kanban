import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim(),
            password,
          });

      if (result.error) {
        setError("ورود یا ثبت‌نام انجام نشد. اطلاعات را بررسی کنید یا بعداً دوباره تلاش کنید.");
        return;
      }
      window.location.assign("/");
    } catch (cause) {
      setError("ورود یا ثبت‌نام انجام نشد. اطلاعات را بررسی کنید یا بعداً دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">جریان · تابلوی کار</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === "signin" ? "ورود به حساب" : "ساخت حساب"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            برای ذخیره کارت‌ها در پایگاه داده مشترک، با حساب خود وارد شوید.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); }}
            className={mode === "signin" ? "rounded-md bg-background px-3 py-2 text-sm font-medium shadow-sm" : "rounded-md px-3 py-2 text-sm text-muted-foreground"}
            aria-pressed={mode === "signin"}
          >
            ورود
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); }}
            className={mode === "signup" ? "rounded-md bg-background px-3 py-2 text-sm font-medium shadow-sm" : "rounded-md px-3 py-2 text-sm text-muted-foreground"}
            aria-pressed={mode === "signup"}
          >
            ساخت حساب
          </button>
        </div>

        <form onSubmit={submit} className="grid gap-4">
          {mode === "signup" ? (
            <label className="grid gap-2 text-sm font-medium">
              نام
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 rounded-md border border-border bg-background px-3"
                maxLength={120}
              />
            </label>
          ) : null}

          <label className="grid gap-2 text-sm font-medium">
            ایمیل
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-md border border-border bg-background px-3"
              maxLength={254}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            گذرواژه
            <input
              required
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-md border border-border bg-background px-3"
              minLength={8}
              maxLength={128}
            />
            {mode === "signup" ? (
              <span className="text-xs font-normal text-muted-foreground">حداقل ۸ نویسه</span>
            ) : null}
          </label>

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "در حال بررسی…" : mode === "signin" ? "ورود" : "ساخت حساب"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">بازگشت به تابلو</Link>
        </p>
      </section>
    </main>
  );
}
