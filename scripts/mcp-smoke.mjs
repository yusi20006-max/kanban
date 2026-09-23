import { spawn } from "node:child_process";

const child = spawn("npx", ["tsx", "src/mcp/server.ts"], {
  env: { ...process.env, KANBAN_MCP_TOKEN: "smoke-token", KANBAN_MCP_USER_ID: "dev-user" },
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const waitForResponse = (id) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { cleanup(); reject(new Error("MCP response timeout")); }, 15000);
  const onData = (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id === id) { cleanup(); resolve(message); return; }
    }
  };
  const onExit = (code) => { cleanup(); reject(new Error("MCP server exited: " + code)); };
  const cleanup = () => {
    clearTimeout(timer);
    child.stdout.off("data", onData);
    child.off("exit", onExit);
  };
  child.stdout.on("data", onData);
  child.on("exit", onExit);
});

child.stdin.write(JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: {
    protocolVersion: "2025-11-25", capabilities: {},
    clientInfo: { name: "kanban-smoke", version: "1.0.0" },
  },
}) + "\n");

const init = await waitForResponse(1);
if (!init.result?.serverInfo) throw new Error("MCP initialize did not return serverInfo");

child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");

const tools = await waitForResponse(2);
const names = (tools.result?.tools ?? []).map((tool) => tool.name);
const expected = [
  "kanban_list_boards", "kanban_get_board", "kanban_create_card",
  "kanban_update_card", "kanban_move_card", "kanban_archive_card",
];
for (const name of expected) if (!names.includes(name)) throw new Error("Missing MCP tool: " + name);

child.kill();
console.log("MCP smoke: initialize + tools/list PASS");
