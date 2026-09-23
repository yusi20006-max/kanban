# Kanban

A Persian-first Kanban board built with React, TanStack Start, Zustand, dnd-kit and a shared SQL layer.

## Agent/API boundary

Board and card operations are exposed through authenticated server functions in `src/lib/kanban-api.ts`. This is the persistence boundary for the domain and is intentionally independent of React/Zustand internals.

Core operations:

- `listBoard`
- `createCard`
- `updateCard`
- `moveCard`
- `archiveCard`

GitHub remains the source of truth for repository, Issue, PR and CI state. The Kanban layer should store references/metadata rather than duplicate GitHub state.

The API boundary is deliberately suitable for a future MCP adapter: an MCP server can map tool calls to these domain operations without exposing the browser store directly.

## MCP / Agent interface

The Kanban domain is exposed through an official MCP stdio server using the current Model Context Protocol TypeScript server SDK.

### MCP tools

- `kanban_list_boards`
- `kanban_get_board`
- `kanban_create_card`
- `kanban_update_card`
- `kanban_move_card`
- `kanban_archive_card`

The MCP server uses the same authenticated domain boundary as the web server and enforces board ownership. It is intentionally stdio-only in this phase; remote Streamable HTTP/OAuth deployment is deferred to Phase 7.

Required environment:

- `KANBAN_MCP_TOKEN`: non-empty secret required before the server starts.
- `KANBAN_MCP_USER_ID`: authenticated identity used by the MCP process; defaults to `dev-user` for local development.

Local commands:

```bash
npm run mcp:server
npm run mcp:smoke
```
