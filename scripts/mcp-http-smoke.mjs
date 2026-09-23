import { spawn } from "node:child_process";

const port = 3137;
const token = "smoke-http-token";
const child = spawn("npx", ["tsx", "src/mcp/http-server.ts"], {
  env: {
    ...process.env, KANBAN_MCP_TOKEN: token, KANBAN_MCP_USER_ID: "dev-user",
    MCP_HOST: "127.0.0.1", MCP_PORT: String(port), MCP_ALLOWED_HOST: "127.0.0.1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stderr.on("data", () => {});

async function wait() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("MCP HTTP server did not start");
}

try {
  await wait();
  const live = await fetch("http://127.0.0.1:" + port + "/health");
  if (!live.ok) throw new Error("health failed");

  const unauthorized = await fetch("http://127.0.0.1:" + port + "/mcp", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  if (unauthorized.status !== 401) throw new Error("unauthorized MCP request was not rejected");

  const authorized = await fetch("http://127.0.0.1:" + port + "/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 2, method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "1.0.0" } },
    }),
  });
  if (!authorized.ok) throw new Error("authorized MCP initialize failed: " + authorized.status);
  const text = await authorized.text();
  if (!text.includes("serverInfo")) throw new Error("MCP initialize response missing serverInfo");
  console.log("MCP HTTP smoke: health + 401 + authenticated initialize PASS");
} finally {
  child.kill();
}
