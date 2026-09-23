import { getSql } from "@/lib/db";

export class GithubIntegrationError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
    this.name = "GithubIntegrationError";
  }
}

function token() {
  const value = process.env.GITHUB_TOKEN?.trim();
  if (!value) throw new GithubIntegrationError("GITHUB_TOKEN_NOT_CONFIGURED");
  return value;
}

function assertRepo(value: string) {
  if (!/^[^/]+\/[^/]+$/.test(value)) throw new GithubIntegrationError("INVALID_GITHUB_REPO");
  return value;
}

async function githubRequest<T>(path: string): Promise<T> {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      Authorization: "Bearer " + token(),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new GithubIntegrationError("GITHUB_AUTH_OR_RATE_LIMIT");
    if (response.status === 404) throw new GithubIntegrationError("GITHUB_NOT_FOUND");
    if (response.status === 429) throw new GithubIntegrationError("GITHUB_RATE_LIMIT");
    throw new GithubIntegrationError("GITHUB_HTTP_" + response.status);
  }
  return response.json() as Promise<T>;
}

type GithubIssue = { state: string; html_url: string; number: number };
type GithubPr = { state: string; merged: boolean; html_url: string; number: number; head: { sha: string } };
type WorkflowRun = { id: number; status: string; conclusion: string | null; html_url: string };

export async function linkGithubCard(userId: string, data: {
  boardId: string; cardId: string; repo: string; issueNumber?: number | null; prNumber?: number | null;
}) {
  assertRepo(data.repo);
  const sql = await getSql();
  const owned = await sql.query<{ id: string }>(
    "select c.id from kanban_cards c join kanban_boards b on b.id=c.board_id " +
    "where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",
    [data.cardId, data.boardId, userId],
  );
  if (!owned[0]) throw new GithubIntegrationError("CARD_NOT_FOUND");
  if (!data.issueNumber && !data.prNumber) throw new GithubIntegrationError("GITHUB_REFERENCE_REQUIRED");

  let issue: GithubIssue | undefined;
  let pr: GithubPr | undefined;
  if (data.issueNumber) issue = await githubRequest<GithubIssue>("/repos/" + data.repo + "/issues/" + data.issueNumber);
  if (data.prNumber) pr = await githubRequest<GithubPr>("/repos/" + data.repo + "/pulls/" + data.prNumber);

  await sql.query(
    "update kanban_cards set github_repo=$1,github_issue_number=$2,github_pr_number=$3," +
    "github_commit_sha=$4,github_issue_state=$5,github_pr_state=$6,github_pr_merged=$7,github_synced_at=now(),updated_at=now() " +
    "where id=$8 and board_id=$9",
    [data.repo, data.issueNumber ?? null, data.prNumber ?? null, pr?.head.sha ?? null,
     issue?.state ?? null, pr?.state ?? null, pr?.merged ?? null, data.cardId, data.boardId],
  );
  return { repo: data.repo, issueUrl: issue?.html_url ?? null, prUrl: pr?.html_url ?? null };
}

export async function refreshGithubCard(userId: string, data: { boardId: string; cardId: string }) {
  const sql = await getSql();
  const rows = await sql.query<{
    github_repo: string | null; github_issue_number: number | null; github_pr_number: number | null;
  }>(
    "select c.github_repo,c.github_issue_number,c.github_pr_number from kanban_cards c " +
    "join kanban_boards b on b.id=c.board_id where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",
    [data.cardId, data.boardId, userId],
  );
  const card = rows[0];
  if (!card) throw new GithubIntegrationError("CARD_NOT_FOUND");
  if (!card.github_repo) throw new GithubIntegrationError("GITHUB_REFERENCE_REQUIRED");

  const issue = card.github_issue_number
    ? await githubRequest<GithubIssue>("/repos/" + card.github_repo + "/issues/" + card.github_issue_number)
    : undefined;
  const pr = card.github_pr_number
    ? await githubRequest<GithubPr>("/repos/" + card.github_repo + "/pulls/" + card.github_pr_number)
    : undefined;

  let ciState: string | null = null;
  let workflowRunId: number | null = null;
  if (pr?.head.sha) {
    const runs = await githubRequest<{ workflow_runs: WorkflowRun[] }>(
      "/repos/" + card.github_repo + "/actions/runs?head_sha=" + encodeURIComponent(pr.head.sha) + "&per_page=20",
    );
    const run = runs.workflow_runs[0];
    if (run) {
      workflowRunId = run.id;
      ciState = run.status === "completed" ? (run.conclusion ?? "unknown") : run.status;
    }
  }

  await sql.query(
    "update kanban_cards set github_commit_sha=$1,github_issue_state=$2,github_pr_state=$3," +
    "github_pr_merged=$4,github_workflow_run_id=$5,github_ci_state=$6,github_synced_at=now(),updated_at=now() " +
    "where id=$7 and board_id=$8",
    [pr?.head.sha ?? null, issue?.state ?? null, pr?.state ?? null, pr?.merged ?? null,
     workflowRunId, ciState, data.cardId, data.boardId],
  );
  return {
    repo: card.github_repo,
    issueState: issue?.state ?? null,
    prState: pr?.state ?? null,
    prMerged: pr?.merged ?? null,
    commitSha: pr?.head.sha ?? null,
    ciState,
    workflowRunId,
    syncedAt: new Date().toISOString(),
  };
}
