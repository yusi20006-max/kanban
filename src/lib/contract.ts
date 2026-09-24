export const KANBAN_CONTRACT_VERSION = "1.1.0";

export const ERROR_CODES = [
  "BOARD_NOT_FOUND","CARD_NOT_FOUND","COLUMN_NOT_FOUND","CROSS_BOARD_COLUMN",
  "INVALID_MOVE_TARGET","INVALID_AGENT_TRANSITION","DUPLICATE_AGENT_TRANSITION",
  "CONCURRENT_AGENT_STATE_CHANGE","LABEL_NOT_FOUND","CHECKLIST_ITEM_NOT_FOUND",
  "MCP_AUTH_FAILED","RATE_LIMITED","GITHUB_AUTH","GITHUB_FORBIDDEN","GITHUB_NOT_FOUND",
  "GITHUB_RATE_LIMIT","GITHUB_TRANSIENT","INTERNAL_ERROR",
] as const;

export type ErrorCode = typeof ERROR_CODES[number];

export function publicErrorCode(error: unknown): ErrorCode {
  const raw = error instanceof Error ? error.message : String(error);
  return (ERROR_CODES as readonly string[]).includes(raw) ? raw as ErrorCode : "INTERNAL_ERROR";
}
