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
