import { createServer } from "node:http";
import { createMcpHandler, McpServer, hostHeaderValidationResponse, originValidationResponse } from "@modelcontextprotocol/server";
import { registerKanbanTools } from "@/mcp/register-tools";

const token = process.env.KANBAN_MCP_TOKEN?.trim();
const defaultUserId = process.env.KANBAN_MCP_USER_ID?.trim() || "dev-user";
const host = process.env.MCP_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.MCP_PORT || 3000);
const allowedHost = process.env.MCP_ALLOWED_HOST?.trim() || host;
const allowedOrigin = process.env.MCP_ALLOWED_ORIGIN?.trim();

if (!token) throw new Error("KANBAN_MCP_TOKEN is required");

function bearer(req: import("node:http").IncomingMessage) {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice(7).trim();
}

function authError(status: number, message: string) {
  return Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, {
    status,
    headers: { "www-authenticate": 'Bearer realm="kanban-mcp"' },
  });
}

const handler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.clientId || defaultUserId;
  const server = new McpServer({ name: "yasin-kanban", version: "1.1.0" });
  registerKanbanTools(server, userId, () => undefined);
  return server;
}, { responseMode: "json", onerror: (error) => console.error("[kanban-mcp]", error) });

async function toRequest(req: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  const url = "http://" + (req.headers.host || host + ":" + port) + (req.url || "/");
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks);
  return new Request(url, { method: req.method, headers, body });
}

async function send(res: import("node:http").ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = createServer(async (req, res) => {
  try {
    if (req.url?.split("?")[0] === "/health") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, service: "kanban-mcp" }));
      return;
    }
    if (req.url?.split("?")[0] !== "/mcp") {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const request = await toRequest(req);
    const rejected = hostHeaderValidationResponse(request, [allowedHost]) ??
      (allowedOrigin ? originValidationResponse(request, [allowedOrigin]) : null);
    if (rejected) { await send(res, rejected); return; }

    if (bearer(req) !== token) { await send(res, authError(401, "Invalid bearer token")); return; }

    const authInfo = {
      token,
      clientId: defaultUserId,
      scopes: ["mcp"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    await send(res, await handler.fetch(request, { authInfo }));
  } catch (error) {
    console.error("[kanban-mcp] request failed", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "INTERNAL_SERVER_ERROR" }));
    }
  }
});

server.listen(port, host, () => console.error("[kanban-mcp] listening on " + host + ":" + port + "/mcp"));
