#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import process from "node:process";
import { Pool } from "pg";
import { chromium } from "playwright";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
if (!process.env.CI) throw new Error("CI_REQUIRED_FOR_BROWSER_E2E");

const baseUrl = "http://localhost:8080";
const userId = "dev-user";
const runId = randomUUID();
const agentId = `browser-e2e-agent-${runId}`;
const cardId = `browser-e2e-card-${runId}`;
const cardTitle = `E2E #220 Start button ${runId.slice(0, 8)}`;
const token = randomBytes(32).toString("hex");
const pool = new Pool({ connectionString: databaseUrl });
let app;
let worker;
let browser;
let appOutput = "";
let workerOutput = "";
const reportPath = "artifacts/agent-runtime-browser-e2e.json";
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  environment: "github-actions-ephemeral-runner",
  test: "real-browser-card-start",
  runtimeMode: "dry-run",
  secretsIncluded: false,
  externalGitHubWrites: false,
  outcome: "failed",
  checks: {},
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function writeReport() {
  report.finishedAt = new Date().toISOString();
  await mkdir("artifacts", { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    wait(3000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function waitForApp() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (app.exitCode !== null) throw new Error(`APP_EXITED_EARLY:${app.exitCode}`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      // The Vite server is still starting.
    }
    await wait(1000);
  }
  throw new Error("APP_START_TIMEOUT");
}

try {
  console.log("[browser-e2e] applying auth schema and seeding isolated fixture");
  const authSchema = await readFile("migrations/auth/0001_auth.sql", "utf8");
  await pool.query(authSchema);

  await pool.query(
    `insert into "user" ("id","name","email","emailVerified","createdAt","updatedAt")
     values($1,$2,$3,true,now(),now())
     on conflict ("id") do update set "name"=excluded."name","email"=excluded."email","emailVerified"=true,"updatedAt"=now()`,
    [userId, "Browser E2E User", "browser-e2e@example.invalid"],
  );
  await pool.query(
    `insert into "session" ("id","expiresAt","token","createdAt","updatedAt","userId")
     values($1,now() + interval '1 hour',$2,now(),now(),$3)`,
    [randomUUID(), token, userId],
  );

  await pool.query(
    `insert into kanban_boards(id,name,owner_user_id,project_key)
     values('default','Browser E2E Board',$1,null)
     on conflict(id) do update set owner_user_id=excluded.owner_user_id,archived_at=null`,
    [userId],
  );
  await pool.query(
    `insert into kanban_columns(id,board_id,name,position)
     values ('todo','default','Todo',0),('doing','default','In Progress',1),('done','default','Done',2)
     on conflict(board_id,id) do nothing`,
  );
  await pool.query(
    `insert into kanban_cards(id,board_id,column_id,position,title,description,github_repo,github_issue_number,workflow_phase,agent_state)
     values($1,'default','todo',0,$2,'Synthetic browser E2E fixture','yusi20006-max/kanban',220,'inspect','idle')`,
    [cardId, cardTitle],
  );
  await pool.query(
    `insert into kanban_agents(id,owner_user_id,name,capabilities,metadata,status,last_seen_at,updated_at)
     values($1,$2,$3,'["kanban-execution"]'::jsonb,'{"runtime":"browser-e2e"}'::jsonb,'ready',now(),now())`,
    [agentId, userId, "browser-e2e-agent"],
  );

  console.log("[browser-e2e] starting app server");
  app = spawn("npm", ["run", "dev"], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      VITE_AUTH_ENABLED: "true",
      BETTER_AUTH_URL: baseUrl,
      HOST: "0.0.0.0",
      PORT: "8080",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout.on("data", (chunk) => { appOutput += chunk.toString(); });
  app.stderr.on("data", (chunk) => { appOutput += chunk.toString(); });
  await waitForApp();
  console.log("[browser-e2e] app responded; starting worker and browser");

  worker = spawn(process.execPath, ["--import", "tsx", "scripts/agent-runtime-worker.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      KANBAN_AGENT_ID: agentId,
      KANBAN_AGENT_USER_ID: userId,
      KANBAN_AGENT_NAME: "browser-e2e-agent",
      AGENT_RUNTIME_MODE: "dry-run",
      AGENT_RUNTIME_POLL_MS: "200",
      AGENT_RUNTIME_LEASE_EXTENSION_SECONDS: "120",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.on("data", (chunk) => { workerOutput += chunk.toString(); });
  worker.stderr.on("data", (chunk) => { workerOutput += chunk.toString(); });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([{
    name: "__Host-grok-auth.session_token",
    value: token,
    url: baseUrl,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  }]);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => { report.pageError = error.message; });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("[browser-e2e] page loaded; waiting for fixture card");

  const fixtureCard = page.getByRole("heading", { name: cardTitle, exact: true });
  await fixtureCard.waitFor({ state: "visible" });
  await fixtureCard.click();

  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  console.log("[browser-e2e] clicking actual Start button");
  await dialog.getByRole("button", { name: "شروع", exact: true }).click();
  await page.getByText("Task و Execution Agent شروع شد", { exact: true }).waitFor({ state: "visible" });
  console.log("[browser-e2e] Start toast observed; checking worker lifecycle");

  let observed;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await pool.query(
      `select e.id as execution_id,e.status as execution_status,e.result,
              t.id as task_id,t.status as task_status,
              l.id as lease_id,l.status as lease_status,
              a.status as agent_status,c.agent_state,c.workflow_phase,
              c.github_repo,c.github_issue_number
         from kanban_cards c
         join kanban_agent_tasks t on t.card_id=c.id
         join kanban_agent_executions e on e.task_id=t.id
         join kanban_agent_leases l on l.task_id=t.id and l.agent_id=e.agent_id
         join kanban_agents a on a.id=e.agent_id
        where c.id=$1 order by e.created_at desc limit 1`,
      [cardId],
    );
    observed = result.rows[0];
    if (observed?.execution_status === "succeeded") break;
    if (worker.exitCode !== null) throw new Error(`WORKER_EXITED_EARLY:${worker.exitCode}`);
    await wait(200);
  }

  assert.ok(observed?.execution_id, "UI Start should create an execution");
  assert.equal(observed.execution_status, "succeeded");
  assert.equal(observed.task_status, "completed");
  assert.equal(observed.lease_status, "released");
  assert.equal(observed.agent_status, "ready");
  assert.equal(observed.agent_state, "running", "dry-run worker does not advance the card's Agent state");
  assert.equal(observed.workflow_phase, "inspect");
  assert.equal(observed.github_repo, "yusi20006-max/kanban");
  assert.equal(observed.github_issue_number, 220);
  assert.equal(observed.result?.mode, "dry-run");
  assert.equal(observed.result?.safe, true);
  assert.equal(observed.result?.mutation, "none");
  assert.deepEqual(observed.result?.phases, ["inspect", "execute", "verify"]);

  const audit = await pool.query(
    "select id from kanban_audit_events where action='agent.card.start' and board_id='default' and card_id=$1 and outcome='success' order by created_at desc limit 1",
    [cardId],
  );
  assert.ok(audit.rows[0], "the real server function should record the Card Start audit event");

  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/agent-runtime-browser-e2e.png", fullPage: true });
  report.outcome = "passed";
  console.log("[browser-e2e] all lifecycle assertions passed");
  report.checks = {
    appStarted: true,
    browserAuthenticatedWithSyntheticSession: true,
    actualCardStartButtonClicked: true,
    productionStartServerFunctionReached: true,
    auditEventRecorded: true,
    executionStatus: observed.execution_status,
    taskStatus: observed.task_status,
    leaseStatus: observed.lease_status,
    agentStatus: observed.agent_status,
    cardAgentState: observed.agent_state,
    workflowPhase: observed.workflow_phase,
    dryRunSafe: observed.result.safe,
    mutation: observed.result.mutation,
    phases: observed.result.phases,
    externalGitHubWrites: false,
  };
  report.fixture = { boardId: "default", cardId, agentId, executionId: observed.execution_id, githubReference: "yusi20006-max/kanban#220" };
  console.log("AGENT_RUNTIME_BROWSER_E2E_REPORT=" + JSON.stringify(report));
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  report.appLogTail = appOutput.split("\n").slice(-25).join("\n");
  report.workerLogTail = workerOutput.split("\n").slice(-25).join("\n");
  process.exitCode = 1;
} finally {
  await stop(worker);
  await stop(app);
  if (browser) await browser.close();
  await writeReport();
  await pool.end();
}
