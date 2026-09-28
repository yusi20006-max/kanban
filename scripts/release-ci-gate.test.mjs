import assert from "node:assert/strict";
import test from "node:test";
import { verifyReleaseCi } from "./release-ci-gate.mjs";

const SHA = "6f80094545fbd6f869e07bd1169a58c1cf62b633";

function mockFetch(payload, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  });
  return () => { globalThis.fetch = original; };
}

test("passes for successful CI on the exact release SHA", async () => {
  const restore = mockFetch({
    workflow_runs: [{ id: 1, run_number: 100, name: "CI", head_sha: SHA, status: "completed", conclusion: "success" }],
  });
  try {
    const result = await verifyReleaseCi({ sha: SHA, repository: "yusi20006-max/kanban", token: "test", apiUrl: "https://api.github.test" });
    assert.equal(result.sha, SHA);
    assert.equal(result.conclusion, "success");
    assert.equal(result.runNumber, 100);
  } finally { restore(); }
});

test("rejects when the exact release SHA has no successful CI", async () => {
  const restore = mockFetch({
    workflow_runs: [
      { id: 2, run_number: 101, name: "CI", head_sha: SHA, status: "completed", conclusion: "failure" },
      { id: 3, run_number: 102, name: "CI", head_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "completed", conclusion: "success" },
    ],
  });
  try {
    await assert.rejects(
      verifyReleaseCi({ sha: SHA, repository: "yusi20006-max/kanban", token: "test", apiUrl: "https://api.github.test" }),
      /no successful CI workflow run/,
    );
  } finally { restore(); }
});

test("rejects GitHub API errors", async () => {
  const restore = mockFetch({}, 500);
  try {
    await assert.rejects(
      verifyReleaseCi({ sha: SHA, repository: "yusi20006-max/kanban", token: "test", apiUrl: "https://api.github.test" }),
      /release CI lookup failed: HTTP 500/,
    );
  } finally { restore(); }
});
