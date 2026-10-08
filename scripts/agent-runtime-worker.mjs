#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { Pool } from "pg";
import { buildDryRunResult, buildExecutionInput, validateRuntimeConfig } from "./agent-runtime-contract.mjs";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const USER_ID = process.env.KANBAN_AGENT_USER_ID?.trim() || "dev-user";
const AGENT_ID = process.env.KANBAN_AGENT_ID?.trim();
const AGENT_NAME = process.env.KANBAN_AGENT_NAME?.trim() || AGENT_ID;
const MODE = process.env.AGENT_RUNTIME_MODE?.trim() || "dry-run";
const POLL_MS = Number(process.env.AGENT_RUNTIME_POLL_MS || 2000);
const LEASE_EXTENSION_SECONDS = Number(process.env.AGENT_RUNTIME_LEASE_EXTENSION_SECONDS || 300);
const COMMAND = process.env.AGENT_RUNTIME_COMMAND?.trim() || "";

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!AGENT_ID) throw new Error("KANBAN_AGENT_ID is required");
if (!Number.isFinite(POLL_MS) || POLL_MS < 250) throw new Error("AGENT_RUNTIME_POLL_MS must be >= 250");
validateRuntimeConfig({ mode: MODE, command: COMMAND });

const pool = new Pool({ connectionString: DATABASE_URL });

function log(event, payload = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, agentId: AGENT_ID, ...payload }));
}

async function register() {
  await pool.query(
    `insert into kanban_agents(id,owner_user_id,name,capabilities,metadata,status,last_seen_at)
     values($1,$2,$3,$4::jsonb,$5::jsonb,'ready',now())
     on conflict (id) do update set
       name=excluded.name,
       capabilities=excluded.capabilities,
       metadata=excluded.metadata,
       status=case when kanban_agents.status='disabled' then kanban_agents.status else 'ready' end,
       last_seen_at=now(),
       updated_at=now()
     where kanban_agents.owner_user_id=excluded.owner_user_id`,
    [AGENT_ID, USER_ID, AGENT_NAME, JSON.stringify(["kanban-execution"]), JSON.stringify({ runtime: "generic-worker", mode: MODE })],
  );
  log("agent.ready");
}

async function heartbeat(taskId, leaseId) {
  await pool.query(
    "update kanban_agents set last_seen_at=now(),updated_at=now() where owner_user_id=$1 and id=$2 and status='busy'",
    [USER_ID, AGENT_ID],
  );
  await pool.query(
    "update kanban_agent_leases set expires_at=now() + ($1 * interval '1 second') where id=$2 and owner_user_id=$3 and agent_id=$4 and status='active'",
    [LEASE_EXTENSION_SECONDS, leaseId, USER_ID, AGENT_ID],
  );
  log("heartbeat", { taskId, leaseId });
}

async function dryRun(task) {
  return {
    mode: "dry-run",
    safe: true,
    taskId: task.task_id,
    cardId: task.card_id,
    githubRepo: task.github_repo,
    githubIssueNumber: task.github_issue_number,
    phases: ["inspect", "execute", "verify"],
    mutation: "none",
  };
}

function commandArgs(task) {
  return [JSON.stringify({
    taskId: task.task_id,
    executionId: task.execution_id,
    cardId: task.card_id,
    githubRepo: task.github_repo,
    githubIssueNumber: task.github_issue_number,
  })];
}

async function commandRun(task) {
  return await new Promise((resolve, reject) => {
    const child = spawn(COMMAND, commandArgs(task), {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`AGENT_RUNTIME_COMMAND_FAILED:${code}:${stderr.slice(-4000)}`));
      else resolve({ mode: "command", exitCode: code, stdout: stdout.slice(-8000), stderr: stderr.slice(-4000) });
    });
  });
}

async function execute(task) {
  const client = await pool.connect();
  let heartbeatTimer;
  try {
    const lock = await client.query("select pg_try_advisory_lock(hashtext($1)) as acquired", [task.execution_id]);
    if (!lock.rows[0].acquired) return false;

    await client.query(
      "update kanban_agents set status='busy',last_seen_at=now(),updated_at=now() where owner_user_id=$1 and id=$2 and status in ('ready','busy')",
      [USER_ID, AGENT_ID],
    );
    log("execution.claimed", { executionId: task.execution_id, taskId: task.task_id });

    heartbeatTimer = setInterval(() => {
      heartbeat(task.task_id, task.lease_id).catch((error) => log("heartbeat.error", { error: String(error) }));
    }, Math.max(1000, Math.floor((LEASE_EXTENSION_SECONDS * 1000) / 3)));

    const result = MODE === "command" ? await commandRun(task) : await dryRun(task);
    await client.query(
      "update kanban_agent_executions set status='succeeded',ended_at=now(),result=$1::jsonb,updated_at=now() where id=$2 and owner_user_id=$3 and status='running'",
      [JSON.stringify(result), task.execution_id, USER_ID],
    );
    await client.query(
      "update kanban_agent_tasks set status='completed',updated_at=now() where id=$1 and owner_user_id=$2 and status='running'",
      [task.task_id, USER_ID],
    );
    await client.query(
      "update kanban_agents set status='ready',last_seen_at=now(),updated_at=now() where owner_user_id=$1 and id=$2 and status='busy'",
      [USER_ID, AGENT_ID],
    );
    await client.query(
      "update kanban_agent_leases set status='released',released_at=now() where id=$1 and owner_user_id=$2 and status='active'",
      [task.lease_id, USER_ID],
    );
    log("execution.succeeded", { executionId: task.execution_id, taskId: task.task_id, result });
    return true;
  } catch (error) {
    await client.query(
      "update kanban_agent_executions set status='failed',ended_at=now(),error=$1::jsonb,updated_at=now() where id=$2 and owner_user_id=$3 and status='running'",
      [JSON.stringify({ message: error instanceof Error ? error.message : String(error) }), task.execution_id, USER_ID],
    ).catch(() => undefined);
    await client.query(
      "update kanban_agent_tasks set status='failed',updated_at=now() where id=$1 and owner_user_id=$2 and status='running'",
      [task.task_id, USER_ID],
    ).catch(() => undefined);
    await client.query(
      "update kanban_agents set status='ready',last_seen_at=now(),updated_at=now() where owner_user_id=$1 and id=$2 and status='busy'",
      [USER_ID, AGENT_ID],
    ).catch(() => undefined);
    log("execution.failed", { executionId: task.execution_id, taskId: task.task_id, error: String(error) });
    return true;
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    await client.query("select pg_advisory_unlock(hashtext($1))", [task.execution_id]).catch(() => undefined);
    client.release();
  }
}

async function findExecution() {
  const { rows } = await pool.query(
    `select e.id as execution_id,e.task_id,e.agent_id,t.card_id,
            c.github_repo,c.github_issue_number,
            l.id as lease_id,l.expires_at
       from kanban_agent_executions e
       join kanban_agent_tasks t on t.id=e.task_id
       join kanban_agent_leases l on l.task_id=e.task_id and l.agent_id=e.agent_id and l.status='active'
       left join kanban_cards c on c.id=t.card_id
      where e.owner_user_id=$1 and e.agent_id=$2 and e.status='running'
        and l.expires_at > now()
      order by e.started_at,e.id
      limit 1`,
    [USER_ID, AGENT_ID],
  );
  return rows[0] ?? null;
}

async function shutdown(signal) {
  log("shutdown", { signal });
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await register();
log("worker.started", { mode: MODE, pollMs: POLL_MS });

while (true) {
  const task = await findExecution();
  if (task) await execute(task);
  else await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
