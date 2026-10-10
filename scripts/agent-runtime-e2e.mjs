#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
if (!process.env.CI) throw new Error("CI_REQUIRED_FOR_EPHEMERAL_RUNTIME_E2E");

const userId = "dev-user";
const suffix = randomUUID();
const boardId = `e2e-board-${suffix}`;
const cardId = `e2e-card-${suffix}`;
const agentId = `e2e-agent-${suffix}`;
const taskId = `e2e-task-${suffix}`;
const leaseId = `e2e-lease-${suffix}`;
const executionId = `e2e-execution-${suffix}`;
const reportPath = "artifacts/agent-runtime-e2e.json";
const pool = new Pool({ connectionString: databaseUrl });
let worker;
let workerOutput = "";
let report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  environment: "github-actions-ephemeral-runner",
  runtimeMode: "dry-run",
  safety: { externalGitHubWrites: false, targetRepositoryMutation: "none", secretsIncluded: false },
  outcome: "failed",
  checks: {},
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function writeReport() {
  report.finishedAt = new Date().toISOString();
  await mkdir("artifacts", { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}

try {
  const ready = await pool.query("select to_regclass('public.kanban_agent_executions') as executions");
  assert.ok(ready.rows[0].executions, "migrations must create agent execution schema");

  await pool.query(
    "insert into kanban_boards(id,name,owner_user_id,project_key) values($1,$2,$3,$4)",
    [boardId, "Ephemeral Agent Runtime E2E", userId, suffix],
  );
  await pool.query(
    `insert into kanban_cards(id,board_id,column_id,position,title,github_repo,github_issue_number,workflow_phase,agent_state)
     values($1,$2,'todo',0,$3,'yusi20006-max/kanban',211,'inspect','idle')`,
    [cardId, boardId, "Ephemeral runtime fixture"],
  );
  await pool.query(
    `insert into kanban_agents(id,owner_user_id,name,capabilities,metadata,status,last_seen_at)
     values($1,$2,$3,'["kanban-execution"]'::jsonb,'{"runtime":"e2e"}'::jsonb,'ready',now())`,
    [agentId, userId, "ephemeral-e2e-agent"],
  );
  await pool.query(
    `insert into kanban_agent_tasks(id,owner_user_id,board_id,card_id,title,status)
     values($1,$2,$3,$4,$5,'running')`,
    [taskId, userId, boardId, cardId, "Safe dry-run execution lifecycle"],
  );
  await pool.query(
    `insert into kanban_agent_leases(id,owner_user_id,task_id,agent_id,status,expires_at)
     values($1,$2,$3,$4,'active',now() + interval '2 minutes')`,
    [leaseId, userId, taskId, agentId],
  );
  await pool.query(
    `insert into kanban_agent_executions(id,owner_user_id,task_id,agent_id,attempt,status,started_at)
     values($1,$2,$3,$4,1,'running',now())`,
    [executionId, userId, taskId, agentId],
  );

  worker = spawn(process.execPath, ["scripts/agent-runtime-worker.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      KANBAN_AGENT_ID: agentId,
      KANBAN_AGENT_USER_ID: userId,
      KANBAN_AGENT_NAME: "ephemeral-e2e-agent",
      AGENT_RUNTIME_MODE: "dry-run",
      AGENT_RUNTIME_POLL_MS: "250",
      AGENT_RUNTIME_LEASE_EXTENSION_SECONDS: "120",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.on("data", (chunk) => { workerOutput += chunk.toString(); });
  worker.stderr.on("data", (chunk) => { workerOutput += chunk.toString(); });

  let observed;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await pool.query(
      `select e.status as execution_status,e.result,t.status as task_status,
              l.status as lease_status,a.status as agent_status
         from kanban_agent_executions e
         join kanban_agent_tasks t on t.id=e.task_id
         join kanban_agent_leases l on l.task_id=t.id and l.agent_id=e.agent_id
         join kanban_agents a on a.id=e.agent_id
        where e.id=$1`,
      [executionId],
    );
    observed = result.rows[0];
    if (observed?.execution_status === "succeeded") break;
    if (worker.exitCode !== null) throw new Error(`WORKER_EXITED_EARLY:${worker.exitCode}`);
    await wait(250);
  }

  assert.equal(observed?.execution_status, "succeeded", "worker should complete execution");
  assert.equal(observed?.task_status, "completed", "worker should complete task");
  assert.equal(observed?.lease_status, "released", "worker should release lease");
  assert.equal(observed?.agent_status, "ready", "worker should return agent to ready");
  assert.equal(observed?.result?.mode, "dry-run");
  assert.equal(observed?.result?.safe, true);
  assert.equal(observed?.result?.mutation, "none");
  assert.deepEqual(observed?.result?.phases, ["inspect", "execute", "verify"]);

  const card = await pool.query(
    "select agent_state,workflow_phase,github_repo,github_issue_number from kanban_cards where id=$1",
    [cardId],
  );
  assert.deepEqual(card.rows[0], {
    agent_state: "idle",
    workflow_phase: "inspect",
    github_repo: "yusi20006-max/kanban",
    github_issue_number: 211,
  }, "worker dry-run must not mutate card workflow state or touch the referenced repository");

  report.outcome = "passed";
  report.checks = {
    migrationsPresent: true,
    workerClaimedExecution: true,
    executionStatus: observed.execution_status,
    taskStatus: observed.task_status,
    leaseStatus: observed.lease_status,
    agentStatus: observed.agent_status,
    dryRunSafe: observed.result.safe,
    mutation: observed.result.mutation,
    phases: observed.result.phases,
    cardStateUnchanged: true,
    externalGitHubWrites: false,
  };
  report.fixture = { boardId, cardId, agentId, taskId, leaseId, executionId, githubReference: "yusi20006-max/kanban#211" };
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  report.workerLogTail = workerOutput.split("\n").slice(-30).join("\n");
  process.exitCode = 1;
} finally {
  if (worker && worker.exitCode === null) {
    worker.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => worker.once("exit", resolve)),
      wait(3000),
    ]);
    if (worker.exitCode === null) worker.kill("SIGKILL");
  }
  await writeReport();
  await pool.end();
}
