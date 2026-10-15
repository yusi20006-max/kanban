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

async function stop(child, processGroup = false) {
  if (!child || child.exitCode !== null) return;
  const signal = (name) => {
    try {
      if (processGroup && process.platform !== "win32" && child.pid) {
        process.kill(-child.pid, name);
      } else {
        child.kill(name);
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
    }
  };
  signal("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    wait(3000),
  ]);
  if (child.exitCode === null) signal("SIGKILL");
}

async function waitForApp() {
  let lastProbe = "NO_RESPONSE";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (app.exitCode !== null) throw new Error(`APP_EXITED_EARLY:${app.exitCode}`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) });
      lastProbe = `HTTP_${response.status}`;
      if (response.ok) return;
    } catch (error) {
      lastProbe = error instanceof Error ? error.name : "FETCH_ERROR";
    }
    await wait(500);
  }
  throw new Error(`APP_START_TIMEOUT:${lastProbe}`);
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
    detached: process.platform !== "win32",
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
      AGENT_RUNTIME_POLL_MS: "250",
      AGENT_RUNTIME_LEASE_EXTENSION_SECONDS: "120",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.on("data", (chunk) => { workerOutput += chunk.toString(); });
  worker.stderr.on("data", (chunk) => { workerOutput += chunk.toString(); });

  browser = await chromium.launch({ headless: true });
  // The auth client reads the synthetic session token from sessionStorage and
  // attaches it only to same-origin auth/server-function requests. Do not set a
  // browser-wide Authorization header: that leaks into cross-origin font requests
  // and triggers CORS preflights unrelated to the app's authenticated requests.
  const context = await browser.newContext();
  const page = await context.newPage();
  // The app's auth client forwards the preview bearer through its middleware
  // context from sessionStorage; a browser-wide header alone does not populate
  // that context for TanStack server functions.
  await page.addInitScript((bearerToken) => {
    window.sessionStorage.setItem("grok-auth.bearer-token", bearerToken);
  }, token);
  page.setDefaultTimeout(15000);
  page.on("pageerror", () => { report.pageError = { type: "pageerror" }; });
  const pageResponses = [];
  page.on("response", (response) => {
    const requestUrl = new URL(response.url());
    pageResponses.push({ path: requestUrl.pathname, status: response.status(), method: response.request().method() });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      // Console text can contain URLs, user input, or backend details. Keep only
      // the event type in the CI artifact; never persist raw browser messages.
      report.browserConsoleErrors = [...(report.browserConsoleErrors ?? []), { type: "error" }].slice(-10);
    }
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("[browser-e2e] page loaded; waiting for fixture card");

  // Safe diagnostics: never record request headers, cookies, session tokens, or DB URLs.
  const fixtureState = await pool.query(
    `select b.id as board_id, (b.owner_user_id=$2) as board_owned_by_test_user,
            count(distinct c.id)::int as visible_fixture_cards,
            count(distinct col.id)::int as board_columns
       from kanban_boards b
       left join kanban_cards c on c.board_id=b.id and c.id=$1 and c.archived_at is null
       left join kanban_columns col on col.board_id=b.id
      where b.id='default' group by b.id,b.owner_user_id`,
    [cardId, userId],
  );
  const sessionCheck = await pool.query(
    `select exists(
       select 1 from "session" s join "user" u on u."id"=s."userId"
        where s."token"=$1 and s."userId"=$2 and s."expiresAt">now()
     ) as valid_session`,
    [token, userId],
  );
  let authEndpoint = { status: null, authenticatedAsTestUser: false };
  try {
    const authResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    const authBody = await authResponse.json().catch(() => null);
    authEndpoint = {
      status: authResponse.status,
      authenticatedAsTestUser: authBody?.user?.id === userId,
    };
  } catch (error) {
    authEndpoint = { status: null, authenticatedAsTestUser: false, errorType: error instanceof Error ? error.name : "FETCH_ERROR" };
  }
  report.diagnostics = {
    currentPath: new URL(page.url()).pathname,
    pageTitle: await page.title().catch(() => ""),
    visibleText: (await page.locator("body").innerText().catch(() => "")).slice(0, 1600),
    pageResponses: pageResponses.slice(-30),
    session: {
      validSyntheticSessionInDatabase: sessionCheck.rows[0]?.valid_session === true,
      authEndpointStatus: authEndpoint.status,
      authEndpointRecognizedTestUser: authEndpoint.authenticatedAsTestUser,
      authEndpointErrorType: authEndpoint.errorType ?? null,
    },
    fixture: fixtureState.rows[0] ?? { boardFound: false },
  };
  const fixtureCard = page.getByRole("heading", { name: cardTitle, exact: true });
  try {
    await fixtureCard.waitFor({ state: "visible" });
  } catch (error) {
    report.diagnostics.pageResponses = pageResponses.slice(-50);
    report.diagnostics.fixtureHeadingVisible = false;
    report.diagnostics.loginVisible = await page.getByRole("heading", { name: /ورود به جریان/ }).count().catch(() => 0) > 0;
    report.diagnostics.notFoundVisible = /not found|صفحه.*پیدا نشد/i.test(report.diagnostics.visibleText);
    await page.screenshot({ path: "artifacts/agent-runtime-browser-e2e-failure.png", fullPage: true }).catch(() => {});
    throw new Error(`FIXTURE_CARD_NOT_VISIBLE:${JSON.stringify({
      path: report.diagnostics.currentPath,
      loginVisible: report.diagnostics.loginVisible,
      notFoundVisible: report.diagnostics.notFoundVisible,
      session: report.diagnostics.session,
      fixture: report.diagnostics.fixture,
      recentResponses: report.diagnostics.pageResponses.slice(-12),
      visibleText: report.diagnostics.visibleText.slice(0, 500),
      cause: error instanceof Error ? error.message : String(error),
    })}`);
  }
  report.diagnostics.fixtureHeadingVisible = true;
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
  await stop(app, true);
  if (browser) await browser.close();
  await writeReport();
  await pool.end();
}
