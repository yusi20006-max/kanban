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

const names = [];
let cursor;
let requestId = 2;
do {
  const params = cursor ? { cursor } : {};
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: requestId, method: "tools/list", params }) + "\n");
  const tools = await waitForResponse(requestId);
  names.push(...(tools.result?.tools ?? []).map((tool) => tool.name));
  cursor = tools.result?.nextCursor;
  requestId += 1;
} while (cursor);

const expected = [
  "kanban_list_boards", "kanban_get_board", "kanban_create_card",
  "kanban_update_card", "kanban_move_card", "kanban_archive_card", "kanban_link_github", "kanban_refresh_github", "kanban_transition_agent", "kanban_record_phase", "kanban_create_board", "kanban_update_board", "kanban_archive_board", "kanban_upsert_column", "kanban_add_label", "kanban_set_card_label", "kanban_add_checklist_item", "kanban_set_checklist_item", "kanban_add_comment", "kanban_search_cards",
];
for (const name of expected) if (!names.includes(name)) throw new Error("Missing MCP tool: " + name + "; available: " + names.join(", "));

child.kill();
console.log("MCP smoke: initialize + tools/list PASS");
