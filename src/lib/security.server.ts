import { getSql } from "@/lib/db";

export type AuditSource = "web" | "mcp" | "system";

export async function assertRateLimit(actorUserId: string, source: AuditSource, limit = 120) {
  const sql = await getSql();
  const key = source + ":" + actorUserId;
  await sql.query(
    "insert into kanban_rate_limits(bucket_key,window_started_at,request_count) values($1,now(),1) " +
    "on conflict(bucket_key) do update set " +
    "request_count=case when now()-kanban_rate_limits.window_started_at >= interval '1 minute' then 1 else kanban_rate_limits.request_count+1 end, " +
    "window_started_at=case when now()-kanban_rate_limits.window_started_at >= interval '1 minute' then now() else kanban_rate_limits.window_started_at end",
    [key],
  );
  const rows = await sql.query<{ request_count: number }>("select request_count from kanban_rate_limits where bucket_key=$1",[key]);
  if (Number(rows[0]?.request_count ?? 0) > limit) throw new Error("RATE_LIMITED");
}

export async function auditMutation(input: {
  actorUserId: string; source: AuditSource; action: string;
  boardId?: string | null; cardId?: string | null; requestId: string;
  outcome: "success" | "error"; errorCode?: string | null;
}) {
  const sql = await getSql();
  await sql.query(
    "insert into kanban_audit_events(id,actor_user_id,source,action,board_id,card_id,request_id,outcome,error_code) " +
    "values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [crypto.randomUUID(), input.actorUserId, input.source, input.action, input.boardId ?? null,
     input.cardId ?? null, input.requestId, input.outcome, input.errorCode ?? null],
  );
}
