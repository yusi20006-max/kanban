interface HealthEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function healthMiddleware(
  event: HealthEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET") return next();

  if (event.url.pathname === "/health/live") {
    return Response.json({ ok: true, status: "live", version: process.env.APP_VERSION ?? "dev" }, {
      headers: { "cache-control": "no-store" },
    });
  }

  if (event.url.pathname !== "/health/ready") return next();

  try {
    const { getSql } = await import("@/lib/db");
    await getSql();
    return Response.json({
      ok: true,
      status: "ready",
      database: process.env.DATABASE_URL?.trim() ? "neon" : "pglite",
      version: process.env.APP_VERSION ?? "dev",
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, status: "not-ready" }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
