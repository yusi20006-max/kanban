# Agent Control Plane — Contract & Architecture

Phase 8 establishes a persistent control-plane model separate from the existing human Kanban card workflow.

## Domain model
- Agent: registered execution identity owned by an authenticated Kanban user. Registration is keyed by owner_user_id plus agent_id.
- Task: unit of work an agent may claim. A task is independent from its executions.
- Execution: one attempt to execute a task. A task may have many executions; terminal attempts are retained.
- Lease: time-bounded ownership record. At most one active lease may exist for a task.
- Execution event: immutable lifecycle evidence for reconstructing history.
- Delegation link: explicit parent/child task or execution linkage.

## State contracts
Agent lifecycle is registered, ready, busy, stale, offline, or disabled. Stale/offline are derived from heartbeat age.
Task lifecycle is pending, claimed, running, blocked, completed, failed, or cancelled.
Execution lifecycle is queued, running, succeeded, failed, timed_out, or cancelled.

The existing kanban_cards.agent_state remains the UI/workflow state. Phase 8 execution state is persisted independently.

## Ownership and authorization
All control-plane rows are scoped to the authenticated owner identity. Every API/MCP operation resolves targets through that owner boundary before reading or mutating them. Agent IDs are not global authorization credentials.

## Lease semantics
Claim is atomic and race-safe. A task has zero or one active lease. Expiry makes a lease reclaimable without deleting execution history. Release is idempotent for the current owner and rejects a different active owner. Idempotency keys reuse the existing actor_user_id, operation_key, action scope.

## API and MCP boundary
Web server functions and MCP tools call the same domain functions. Browser state and MCP transports never write control-plane tables directly.

## Migration strategy
Phase 8 schema changes are additive numbered SQL migrations. Existing board/card/workflow data is preserved. Migrations use the existing tracker and do not require the optional auth schema.

## Compatibility
The public Kanban contract version is independent from the Agent Control Plane contract version. New control-plane fields are additive and all state values are explicit enums.
