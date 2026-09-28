import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export async function verifyReleaseCi({
  sha = process.env.GITHUB_SHA?.trim(),
  repository = process.env.GITHUB_REPOSITORY?.trim(),
  token = process.env.GITHUB_TOKEN?.trim(),
  apiUrl = (process.env.GITHUB_API_URL?.trim() || "https://api.github.com"),
} = {}) {
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("release CI gate requires a full 40-character GITHUB_SHA");
  }
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error("release CI gate requires GITHUB_REPOSITORY=owner/repository");
  }
  if (!token) throw new Error("release CI gate requires GITHUB_TOKEN");

  const url = new URL(
    `repos/${repository}/actions/workflows/ci.yml/runs`,
    apiUrl.endsWith("/") ? apiUrl : apiUrl + "/",
  );
  url.searchParams.set("head_sha", sha);
  url.searchParams.set("status", "completed");
  url.searchParams.set("per_page", "20");

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`release CI lookup failed: HTTP ${response.status}`);

  const payload = await response.json();
  const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
  const matching = runs.filter((run) =>
    run?.head_sha?.toLowerCase() === sha.toLowerCase() &&
    run?.name === "CI" &&
    run?.status === "completed"
  );
  const successful = matching.find((run) => run.conclusion === "success");

  if (!successful) {
    const conclusions = matching.map((run) => run.conclusion || "unknown").join(", ") || "none";
    throw new Error(
      `release commit ${sha} has no successful CI workflow run (observed conclusions: ${conclusions})`,
    );
  }

  return {
    workflow: successful.name,
    runId: successful.id,
    runNumber: successful.run_number,
    sha: successful.head_sha,
    conclusion: successful.conclusion,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await verifyReleaseCi();
  console.log(`release CI gate PASS: CI run #${result.runNumber} -> ${result.sha} -> ${pkg.version}`);
}
