# Machine Contract

The Kanban API/MCP machine boundary is versioned independently from the UI.

Current contract: **1.1.0**

MCP success responses include `contractVersion`. Failure responses include the same version plus a stable `error.code`.

Agents must branch on `error.code`, not exception text. Unknown/internal failures are normalized to `INTERNAL_ERROR` and internal diagnostics are not returned by the MCP response.

Compatibility rule: additive fields are backward-compatible; changing/removing existing tool names, input fields, response fields, or stable error codes requires a contract version change.
