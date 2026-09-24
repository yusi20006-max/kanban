import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerKanbanTools } from "@/mcp/register-tools";

const token = process.env.KANBAN_MCP_TOKEN?.trim();
const userId = process.env.KANBAN_MCP_USER_ID?.trim() || "dev-user";
if (!token) throw new Error("KANBAN_MCP_TOKEN is required; refusing unauthenticated MCP startup");

const buildServer = () => {
  const server = new McpServer({ name: "yasin-kanban", version: "1.1.0" });
  registerKanbanTools(server, userId, () => {
    if (process.env.KANBAN_MCP_TOKEN?.trim() !== token) throw new Error("MCP_AUTH_FAILED");
  });
  return server;
};

void serveStdio(buildServer);
console.error("[kanban] MCP stdio server running");
