import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  archiveCard, archiveCardInputSchema, createCard, cardInputSchema, listBoard, listBoards,
  moveCard, moveCardInputSchema, updateCard, updateCardInputSchema,
  recordWorkflowPhase, transitionAgent,
  createBoard, updateBoard, archiveBoard, upsertColumn, addLabel, setCardLabel,
  addChecklistItem, setChecklistItem, addComment, searchCards,
} from "@/lib/kanban-domain";
import { linkGithubCard as linkGithub, refreshGithubCard as refreshGithub } from "@/lib/github-api.server";
import { auditMutation, assertRateLimit } from "@/lib/security.server";
import { recordPhaseInputSchema, transitionInputSchema } from "@/lib/workflow";
import { KANBAN_CONTRACT_VERSION, publicErrorCode } from "@/lib/contract";
import { recordTelemetry, listTelemetry } from "@/lib/observability/telemetry";
import { throughputMetricsInputSchema, measureThroughputAndCycleTime } from "@/lib/observability/throughput";
import { failureMetricsInputSchema, measureFailureMetrics } from "@/lib/observability/failure-metrics";
import { agentUtilizationInputSchema, measureAgentUtilization } from "@/lib/observability/agent-utilization";
import { modelUsageAnalyticsInputSchema, aggregateModelUsageAnalytics } from "@/lib/observability/model-analytics";
import { bottleneckInputSchema, detectBottlenecks } from "@/lib/observability/bottlenecks";
import { failureDetectionInputSchema, detectFailure, listFailureSignals } from "@/lib/self-healing/failure-detection";
import { agentRegistrationSchema, heartbeatSchema } from "@/lib/agent-control-plane/contracts";
import { heartbeatAgent, listAgentsWithLiveness } from "@/lib/agent-control-plane/liveness";
import { claimTaskSchema } from "@/lib/agent-control-plane/contracts";
import { claimTask, createAgentTask, releaseLease } from "@/lib/agent-control-plane/lease";
import { startExecution, finishExecution } from "@/lib/agent-control-plane/execution";
import { retryExecution, timeoutExecution, cancelExecution } from "@/lib/agent-control-plane/recovery";
import { delegateTask, listDelegations, linkChildExecution } from "@/lib/agent-control-plane/delegation";
import { listExecutionHistory, listTaskHistory } from "@/lib/agent-control-plane/history";
import { ingestIssueToCard, cardToBranch, branchToPr, refreshDeliveryCi, ciFailureToTask, verifyMerge, releaseToDone } from "@/lib/github-delivery.server";
import { registerAgent, unregisterAgent, listAgents, getAgent } from "@/lib/agent-control-plane/registry";
import { assignAgentRole, listAgentRoles, findAgentsForRole, createPlannerGraph, getPlannerGraph, routeSpecializedExecution, getExecutionRole, listSchedulableTasks, scheduleTask, createOrchestrationGate, resolveOrchestrationGate, listOrchestrationGates, assertOrchestrationGatesClear, recoverOrchestration } from "@/lib/agent-control-plane/orchestration";

type Guard = () => void | Promise<void>;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, contractVersion: KANBAN_CONTRACT_VERSION, data }) }] };
}
function fail(error: unknown) {
  const code = publicErrorCode(error);
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, contractVersion: KANBAN_CONTRACT_VERSION, error: { code, message: "Operation failed" } }) }], isError: true };
}

async function audited(
  userId: string, guard: Guard, action: string,
  data: { boardId?: string; cardId?: string }, operation: () => Promise<unknown>,
) {
  const requestId = crypto.randomUUID();
  try {
    await guard();
    await assertRateLimit(userId, "mcp");
    const result = await operation();
    await auditMutation({ actorUserId: userId, source: "mcp", action, boardId: data.boardId, cardId: data.cardId, requestId, outcome: "success" });
    return ok(result);
  } catch (error) {
    await auditMutation({ actorUserId: userId, source: "mcp", action, boardId: data.boardId, cardId: data.cardId, requestId, outcome: "error", errorCode: error instanceof Error ? error.message : "INTERNAL_ERROR" });
    return fail(error);
  }
}

export function registerKanbanTools(server: McpServer, userId: string, guard: Guard) {
  server.registerTool("kanban_throughput_metrics",{description:"Measure reproducible task throughput and cycle-time metrics from persisted execution timestamps.",inputSchema:z.object({from:z.iso.datetime(),to:z.iso.datetime(),boardId:z.string().trim().min(1).max(128).optional(),agentId:z.string().trim().min(1).max(128).optional()})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await measureThroughputAndCycleTime(userId,throughputMetricsInputSchema.parse(args)));}catch(e){return fail(e);}});  server.registerTool("kanban_failure_metrics",{description:"Aggregate persisted execution failures, retries, timeouts, cancellations and observed GitHub CI failures.",inputSchema:z.object({from:z.iso.datetime(),to:z.iso.datetime(),boardId:z.string().trim().min(1).max(128).optional(),agentId:z.string().trim().min(1).max(128).optional()})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await measureFailureMetrics(userId,failureMetricsInputSchema.parse(args)));}catch(e){return fail(e);}});  server.registerTool("kanban_agent_utilization",{description:"Measure agent active, busy and idle time from persisted leases and executions.",inputSchema:z.object({from:z.iso.datetime(),to:z.iso.datetime(),boardId:z.string().trim().min(1).max(128).optional(),agentId:z.string().trim().min(1).max(128).optional()})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await measureAgentUtilization(userId,agentUtilizationInputSchema.parse(args)));}catch(e){return fail(e);}});  server.registerTool("kanban_model_usage_analytics",{description:"Aggregate persisted provider/model usage, latency and cost by project, task and agent.",inputSchema:z.object({from:z.iso.datetime(),to:z.iso.datetime(),boardId:z.string().trim().min(1).max(128).optional(),taskId:z.string().trim().min(1).max(128).optional(),agentId:z.string().trim().min(1).max(128).optional()})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await aggregateModelUsageAnalytics(userId,modelUsageAnalyticsInputSchema.parse(args)));}catch(e){return fail(e);}});  server.registerTool("kanban_bottleneck_detection",{description:"Detect explicit queue, dependency, CI, agent and provider bottlenecks and return linked evidence.",inputSchema:z.object({from:z.iso.datetime(),to:z.iso.datetime(),boardId:z.string().trim().min(1).max(128).optional(),queueAgeMinutes:z.number().positive().max(10080).default(30),leaseAgeMinutes:z.number().positive().max(10080).default(30),ciAgeMinutes:z.number().positive().max(10080).default(60),providerFailureCount:z.number().int().positive().max(1000).default(3)})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await detectBottlenecks(userId,bottleneckInputSchema.parse(args)));}catch(e){return fail(e);}});  server.registerTool("kanban_detect_failure",{description:"Classify and persist an evidence-backed execution, CI, or check failure.",inputSchema:z.object({taskId:z.string().trim().min(1).max(128).optional(),executionId:z.string().trim().min(1).max(128).optional(),runId:z.number().int().positive().optional(),source:z.enum(["execution","ci","check"]),evidence:z.record(z.string(),z.unknown()).default({})})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await detectFailure(userId,failureDetectionInputSchema.parse(args)));}catch(e){return fail(e);}});
  server.registerTool("kanban_list_failure_signals",{description:"List persisted evidence-backed failure signals.",inputSchema:z.object({limit:z.number().int().positive().max(200).default(50)})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await listFailureSignals(userId,args.limit));}catch(e){return fail(e);}});

  server.registerTool("kanban_record_telemetry",{description:"Record an authenticated structured execution telemetry event.",inputSchema:z.object({taskId:z.string().nullable().default(null),executionId:z.string().nullable().default(null),agentId:z.string().nullable().default(null),eventType:z.string().min(1).max(128),fromState:z.string().nullable().default(null),toState:z.string().nullable().default(null),payload:z.record(z.string(),z.unknown()).default({})})},async(args)=>audited(userId,guard,"observability.telemetry",{},()=>recordTelemetry(userId,args)));
  server.registerTool("kanban_list_telemetry",{description:"List owned structured execution telemetry.",inputSchema:z.object({taskId:z.string().optional(),executionId:z.string().optional(),agentId:z.string().optional(),eventType:z.string().optional(),limit:z.number().int().min(1).max(1000).default(200)})},async(args)=>{try{await guard();await assertRateLimit(userId,"mcp");return ok(await listTelemetry(userId,args));}catch(e){return fail(e);}});

  server.registerTool("kanban_start_execution", {
    description: "Start an execution attempt under the caller's active task lease.",
    inputSchema: z.object({ executionId: z.string().trim().min(1).max(128), taskId: z.string().trim().min(1).max(128), agentId: z.string().trim().min(1).max(128), timeoutSeconds: z.number().int().min(1).max(86400).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "agent.execution.start", {}, () => startExecution(userId, args)));

  server.registerTool("kanban_execution_history", {
    description: "Read immutable lifecycle events for an owned execution.",
    inputSchema: z.object({ executionId:z.string().trim().min(1).max(128) }),
  }, async ({ executionId }) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listExecutionHistory(userId, executionId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_task_history", {
    description: "Read immutable lifecycle events for an owned task and its executions.",
    inputSchema: z.object({ taskId:z.string().trim().min(1).max(128) }),
  }, async ({ taskId }) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listTaskHistory(userId, taskId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_delegate_task", {
    description: "Create a traceable child task under an owned parent task or execution.",
    inputSchema: z.object({ parentTaskId:z.string().trim().min(1).max(128), childTaskId:z.string().trim().min(1).max(128), title:z.string().trim().min(1).max(500), boardId:z.string().trim().min(1).max(128).nullable().default(null), cardId:z.string().trim().min(1).max(128).nullable().default(null), parentExecutionId:z.string().trim().min(1).max(128).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "agent.delegate", {}, () => delegateTask(userId, args)));

  server.registerTool("kanban_list_delegations", {
    description: "List delegation links touching an owned task.",
    inputSchema: z.object({ taskId:z.string().trim().min(1).max(128) }),
  }, async ({ taskId }) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listDelegations(userId, taskId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_link_child_execution", {
    description: "Attach an owned child execution to a delegation link.",
    inputSchema: z.object({ delegationId:z.string().trim().min(1).max(128), childExecutionId:z.string().trim().min(1).max(128) }),
  }, async (args) => audited(userId, guard, "agent.delegate.link", {}, () => linkChildExecution(userId, args.delegationId, args.childExecutionId)));

  server.registerTool("kanban_retry_execution", {
    description: "Return a failed or timed-out task to pending for a new leased execution attempt.",
    inputSchema: z.object({ executionId: z.string().trim().min(1).max(128) }),
  }, async (args) => audited(userId, guard, "agent.execution.retry", {}, () => retryExecution(userId, args)));

  server.registerTool("kanban_timeout_execution", {
    description: "Mark an overdue running execution as timed out.",
    inputSchema: z.object({ executionId: z.string().trim().min(1).max(128) }),
  }, async ({ executionId }) => audited(userId, guard, "agent.execution.timeout", {}, () => timeoutExecution(userId, executionId)));

  server.registerTool("kanban_cancel_execution", {
    description: "Cancel a running execution and release its task lease.",
    inputSchema: z.object({ executionId: z.string().trim().min(1).max(128) }),
  }, async ({ executionId }) => audited(userId, guard, "agent.execution.cancel", {}, () => cancelExecution(userId, executionId)));

  server.registerTool("kanban_finish_execution", {
    description: "Finish an owned execution with an explicit terminal status and metadata.",
    inputSchema: z.object({ executionId: z.string().trim().min(1).max(128), status: z.enum(["succeeded","failed","timed_out","cancelled"]), result: z.record(z.string(), z.unknown()).nullable().default(null), error: z.record(z.string(), z.unknown()).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "agent.execution.finish", {}, () => finishExecution(userId, args)));

  server.registerTool("kanban_create_agent_task", {
    description: "Create an owned execution task.",
    inputSchema: z.object({ taskId: z.string().trim().min(1).max(128), title: z.string().trim().min(1).max(500), boardId: z.string().trim().min(1).max(128).nullable().default(null), cardId: z.string().trim().min(1).max(128).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "agent.task.create", {}, () => createAgentTask(userId, args)));

  server.registerTool("kanban_claim_agent_task", {
    description: "Atomically claim an owned task with a time-bounded lease.",
    inputSchema: z.object({ taskId: z.string().trim().min(1).max(128), agentId: z.string().trim().min(1).max(128), leaseTtlSeconds: z.number().int().min(1).max(86400).default(300), idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "agent.claim", {}, () => claimTask(userId, claimTaskSchema.parse(args))));

  server.registerTool("kanban_release_agent_lease", {
    description: "Release an owned active agent task lease.",
    inputSchema: z.object({ leaseId: z.string().trim().min(1).max(128), agentId: z.string().trim().min(1).max(128) }),
  }, async ({ leaseId, agentId }) => audited(userId, guard, "agent.release", {}, () => releaseLease(userId, leaseId, agentId)));

  server.registerTool("kanban_agent_heartbeat", {
    description: "Record an authenticated agent heartbeat and refresh liveness.",
    inputSchema: z.object({ agentId: z.string().trim().min(1).max(128), observedAt: z.iso.datetime().optional() }),
  }, async (args) => audited(userId, guard, "agent.heartbeat", {}, () => heartbeatAgent(userId, heartbeatSchema.parse({ ...args, observedAt: args.observedAt ? new Date(args.observedAt) : undefined }))));

  server.registerTool("kanban_list_agents_liveness", {
    description: "List owned agents with deterministic effective liveness status.",
    inputSchema: z.object({}),
  }, async () => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listAgentsWithLiveness(userId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_register_agent", {
    description: "Register or refresh an execution agent owned by the authenticated identity.",
    inputSchema: z.object({ agentId: z.string().trim().min(1).max(128), name: z.string().trim().min(1).max(200), capabilities: z.array(z.string().trim().min(1).max(128)).max(100).default([]), metadata: z.record(z.string(), z.unknown()).default({}) }),
  }, async (args) => audited(userId, guard, "agent.register", {}, () => registerAgent(userId, agentRegistrationSchema.parse(args))));

  server.registerTool("kanban_unregister_agent", {
    description: "Disable an owned execution agent.",
    inputSchema: z.object({ agentId: z.string().trim().min(1).max(128) }),
  }, async ({ agentId }) => audited(userId, guard, "agent.unregister", {}, () => unregisterAgent(userId, agentId)));

  server.registerTool("kanban_recover_orchestration", {
    description: "Recover an owned orchestration plan after expired leases or execution timeouts.",
    inputSchema: z.object({ planId:z.string().trim().min(1).max(128).nullable().default(null) }),
  }, async ({planId}) => audited(userId, guard, "orchestration.recover", {}, () => recoverOrchestration(userId,planId ?? undefined)));

  server.registerTool("kanban_create_orchestration_gate", {
    description: "Create an explicit required review or security gate for an owned task.",
    inputSchema: z.object({ taskId:z.string().trim().min(1).max(128), gateType:z.enum(["review","security"]), required:z.boolean().default(true) }),
  }, async (args) => audited(userId, guard, "orchestration.gate.create", {}, () => createOrchestrationGate(userId,args)));

  server.registerTool("kanban_resolve_orchestration_gate", {
    description: "Resolve an owned review/security gate with auditable evidence.",
    inputSchema: z.object({ gateId:z.string().trim().min(1).max(128), status:z.enum(["approved","rejected","blocked"]), evidence:z.record(z.string(),z.unknown()).default({}) }),
  }, async (args) => audited(userId, guard, "orchestration.gate.resolve", {}, () => resolveOrchestrationGate(userId,args)));

  server.registerTool("kanban_list_orchestration_gates", {
    description: "List review/security gates for an owned task.",
    inputSchema: z.object({ taskId:z.string().trim().min(1).max(128) }),
  }, async ({taskId}) => { try { await guard(); await assertRateLimit(userId,"mcp"); return ok(await listOrchestrationGates(userId,taskId)); } catch(e){ return fail(e); } });

  server.registerTool("kanban_assert_gates_clear", {
    description: "Verify all required orchestration gates are approved before progression.",
    inputSchema: z.object({ taskId:z.string().trim().min(1).max(128) }),
  }, async ({taskId}) => audited(userId, guard, "orchestration.gate.assert", {}, () => assertOrchestrationGatesClear(userId,taskId)));

  server.registerTool("kanban_list_schedulable_tasks", {
    description: "List plan tasks whose dependencies are complete and whose leases are free.",
    inputSchema: z.object({ planId:z.string().trim().min(1).max(128) }),
  }, async ({planId}) => { try { await guard(); await assertRateLimit(userId,"mcp"); return ok(await listSchedulableTasks(userId,planId)); } catch(e){ return fail(e); } });

  server.registerTool("kanban_schedule_task", {
    description: "Atomically schedule a task only when dependencies and lease constraints permit.",
    inputSchema: z.object({ planId:z.string().trim().min(1).max(128), taskId:z.string().trim().min(1).max(128), agentId:z.string().trim().min(1).max(128), leaseTtlSeconds:z.number().int().min(1).max(86400).default(300) }),
  }, async (args) => audited(userId, guard, "orchestration.schedule", {}, () => scheduleTask(userId,args.planId,args.taskId,args.agentId,args.leaseTtlSeconds)));

  server.registerTool("kanban_route_specialized_execution", {
    description: "Route a task to an eligible role-assigned agent and create an explicitly role-bound execution.",
    inputSchema: z.object({ taskId:z.string().trim().min(1).max(128), role:z.enum(["planner","coder","test","security","review"]), executionId:z.string().trim().min(1).max(128), leaseTtlSeconds:z.number().int().min(1).max(86400).default(300), timeoutSeconds:z.number().int().min(1).max(86400).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "orchestration.route", {}, () => routeSpecializedExecution(userId,args)));

  server.registerTool("kanban_get_execution_role", {
    description: "Read the explicit role and agent assignment for an owned execution.",
    inputSchema: z.object({ executionId:z.string().trim().min(1).max(128) }),
  }, async ({executionId}) => { try { await guard(); await assertRateLimit(userId,"mcp"); return ok(await getExecutionRole(userId,executionId)); } catch(e){ return fail(e); } });

  server.registerTool("kanban_create_planner_graph", {
    description: "Persist a high-level task decomposition with roles, acceptance criteria, and dependencies.",
    inputSchema: z.object({ title:z.string().trim().min(1).max(500), sourceTaskId:z.string().trim().min(1).max(128).nullable().default(null), nodes:z.array(z.object({ taskId:z.string().trim().min(1).max(128), title:z.string().trim().min(1).max(500), role:z.enum(["planner","coder","test","security","review"]).nullable().default(null), acceptanceCriteria:z.array(z.string().trim().min(1).max(2000)).max(50).default([]), dependsOn:z.array(z.string().trim().min(1).max(128)).max(100).default([]) })).min(1).max(200) }),
  }, async (args) => audited(userId, guard, "orchestration.plan.create", {}, () => createPlannerGraph(userId,args)));

  server.registerTool("kanban_get_planner_graph", {
    description: "Read an owned persisted planner graph.",
    inputSchema: z.object({ planId:z.string().trim().min(1).max(128) }),
  }, async ({planId}) => { try { await guard(); await assertRateLimit(userId,"mcp"); return ok(await getPlannerGraph(userId,planId)); } catch(e){ return fail(e); } });

  server.registerTool("kanban_assign_agent_role", {
    description: "Assign one machine-readable orchestration role and capabilities to an owned agent.",
    inputSchema: z.object({ agentId:z.string().trim().min(1).max(128), role:z.enum(["planner","coder","test","security","review"]), capabilities:z.array(z.string().trim().min(1).max(128)).max(100).default([]) }),
  }, async (args) => audited(userId, guard, "orchestration.role.assign", {}, () => assignAgentRole(userId,args)));

  server.registerTool("kanban_list_agent_roles", {
    description: "List machine-readable roles assigned to owned agents.",
    inputSchema: z.object({}),
  }, async () => { try { await guard(); await assertRateLimit(userId,"mcp"); return ok(await listAgentRoles(userId)); } catch(e){ return fail(e); } });

  server.registerTool("kanban_find_agents_for_role", {
    description: "Find owned active agents eligible for a specific orchestration role.",
    inputSchema: z.object({ role:z.enum(["planner","coder","test","security","review"]) }),
  }, async ({role}) => { try { await guard(); await assertRateLimit(userId,"mcp"); return ok(await findAgentsForRole(userId,role)); } catch(e){ return fail(e); } });

  server.registerTool("kanban_list_agents", {
    description: "List execution agents owned by the authenticated identity.",
    inputSchema: z.object({}),
  }, async () => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listAgents(userId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_get_agent", {
    description: "Read one owned execution agent.",
    inputSchema: z.object({ agentId: z.string().trim().min(1).max(128) }),
  }, async ({ agentId }) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await getAgent(userId, agentId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_list_boards", {
    description: "List Kanban boards owned by the authenticated identity.",
    inputSchema: z.object({}),
  }, async () => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listBoards(userId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_get_board", {
    description: "Read one owned Kanban board and its active cards.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128) }),
  }, async ({ boardId }) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await listBoard(userId, boardId)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_create_card", {
    description: "Create a card in an owned Kanban board.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), columnId: z.string().trim().min(1).max(128),
      title: z.string().trim().min(1).max(500), description: z.string().max(10000).default(""),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      dueDate: z.string().date().nullable().default(null), idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "card.create", args, () => createCard(userId, cardInputSchema.parse(args))));

  server.registerTool("kanban_update_card", {
    description: "Update an active card in an owned Kanban board.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      columnId: z.string().trim().min(1).max(128), title: z.string().trim().min(1).max(500),
      description: z.string().max(10000).default(""), priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      dueDate: z.string().date().nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "card.update", args, () => updateCard(userId, updateCardInputSchema.parse(args))));

  server.registerTool("kanban_move_card", {
    description: "Move an active card within an owned board.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      columnId: z.string().trim().min(1).max(128), beforeCardId: z.string().min(1).max(128).nullable().default(null), idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "card.move", args, () => moveCard(userId, moveCardInputSchema.parse(args))));

  server.registerTool("kanban_archive_card", {
    description: "Archive an active card in an owned Kanban board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128) }),
  }, async (args) => audited(userId, guard, "card.archive", args, () => archiveCard(userId, archiveCardInputSchema.parse(args))));

  server.registerTool("kanban_link_github", {
    description: "Link an owned card to a GitHub repository Issue and/or Pull Request.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      repo: z.string().regex(new RegExp("^[^/]+/[^/]+$")), issueNumber: z.number().int().positive().nullable().default(null),
      prNumber: z.number().int().positive().nullable().default(null),
    }),
  }, async (args) => audited(userId, guard, "github.link", args, () => linkGithub(userId, args)));

  server.registerTool("kanban_refresh_github", {
    description: "Refresh GitHub Issue, PR and latest CI state for an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128) }),
  }, async (args) => audited(userId, guard, "github.refresh", args, () => refreshGithub(userId, args)));

  server.registerTool("kanban_transition_agent", {
    description: "Transition the execution state of an owned card using the workflow state machine.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      toState: z.enum(["idle", "running", "blocked", "waiting-ci", "waiting-review", "completed", "failed"]),
      phase: z.enum(["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"]).optional(),
      result: z.string().max(20000).default(""),
    }),
  }, async (args) => audited(userId, guard, "workflow.transition", args, () => transitionAgent(userId, transitionInputSchema.parse(args))));

  server.registerTool("kanban_record_phase", {
    description: "Record a workflow phase result and advance the card to the next phase.",
    inputSchema: z.object({
      boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128),
      phase: z.enum(["inspect", "implement", "test", "pr", "ci", "merge", "verify", "completed"]),
      result: z.string().max(20000).default(""),
    }),
  }, async (args) => audited(userId, guard, "workflow.phase", args, () => recordWorkflowPhase(userId, recordPhaseInputSchema.parse(args))));

  server.registerTool("kanban_create_board", {
    description: "Create an isolated Kanban board/project.",
    inputSchema: z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "board.create", {}, () => createBoard(userId, args)));

  server.registerTool("kanban_update_board", {
    description: "Update an owned Kanban board/project.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""), projectKey: z.string().trim().max(100).nullable().default(null) }),
  }, async (args) => audited(userId, guard, "board.update", args, () => updateBoard(userId, args)));

  server.registerTool("kanban_archive_board", {
    description: "Archive an owned board without deleting project data.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128) }),
  }, async ({ boardId }) => audited(userId, guard, "board.archive", { boardId }, () => archiveBoard(userId, boardId)));

  server.registerTool("kanban_upsert_column", {
    description: "Create or reorder a custom column on an owned board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), id: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), position: z.number().int().min(0) }),
  }, async (args) => audited(userId, guard, "column.upsert", args, () => upsertColumn(userId, args)));

  server.registerTool("kanban_add_label", {
    description: "Create a label on an owned board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), name: z.string().trim().min(1).max(100) }),
  }, async (args) => audited(userId, guard, "label.add", args, () => addLabel(userId, args)));

  server.registerTool("kanban_set_card_label", {
    description: "Enable or disable a label on an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), labelId: z.string().min(1).max(128), enabled: z.boolean() }),
  }, async (args) => audited(userId, guard, "card.label", args, () => setCardLabel(userId, args)));

  server.registerTool("kanban_add_checklist_item", {
    description: "Add a checklist item to an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), title: z.string().trim().min(1).max(500) }),
  }, async (args) => audited(userId, guard, "checklist.add", args, () => addChecklistItem(userId, args)));

  server.registerTool("kanban_set_checklist_item", {
    description: "Mark an owned card checklist item complete or incomplete.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), itemId: z.string().min(1).max(128), completed: z.boolean() }),
  }, async (args) => audited(userId, guard, "checklist.update", args, () => setChecklistItem(userId, args)));

  server.registerTool("kanban_add_comment", {
    description: "Add an authenticated comment to an owned card.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), cardId: z.string().min(1).max(128), body: z.string().trim().min(1).max(20000) }),
  }, async (args) => audited(userId, guard, "comment.add", args, () => addComment(userId, args)));

  server.registerTool("kanban_search_cards", {
    description: "Search active cards by title or description within an owned board.",
    inputSchema: z.object({ boardId: z.string().min(1).max(128), query: z.string().trim().min(1).max(200) }),
  }, async (args) => { try { await guard(); await assertRateLimit(userId, "mcp"); return ok(await searchCards(userId, args)); } catch (e) { return fail(e); } });

  server.registerTool("kanban_github_issue_to_card",{description:"Ingest a GitHub Issue into an owned Kanban card idempotently.",inputSchema:z.object({boardId:z.string().min(1).max(128),repo:z.string().regex(new RegExp("^[^/]+/[^/]+$")),issueNumber:z.number().int().positive(),columnId:z.string().min(1).max(128)})},async(args)=>audited(userId,guard,"github.issue_to_card",args,()=>ingestIssueToCard(userId,args)));
  server.registerTool("kanban_github_card_to_branch",{description:"Create or reuse the deterministic GitHub branch for a card.",inputSchema:z.object({boardId:z.string().min(1).max(128),cardId:z.string().min(1).max(128),repo:z.string().regex(new RegExp("^[^/]+/[^/]+$")),base:z.string().trim().min(1).max(255).default("main")})},async(args)=>audited(userId,guard,"github.card_to_branch",args,()=>cardToBranch(userId,args)));
  server.registerTool("kanban_github_branch_to_pr",{description:"Create or reuse a pull request for a linked card branch.",inputSchema:z.object({boardId:z.string().min(1).max(128),cardId:z.string().min(1).max(128),repo:z.string().regex(new RegExp("^[^/]+/[^/]+$")),title:z.string().trim().min(1).max(500).optional(),body:z.string().max(20000).optional(),base:z.string().trim().min(1).max(255).default("main")})},async(args)=>audited(userId,guard,"github.branch_to_pr",args,()=>branchToPr(userId,args)));
  server.registerTool("kanban_github_refresh_ci",{description:"Refresh PR CI state using the newest run for the current PR head SHA.",inputSchema:z.object({boardId:z.string().min(1).max(128),cardId:z.string().min(1).max(128),repo:z.string().regex(new RegExp("^[^/]+/[^/]+$")),prNumber:z.number().int().positive().optional()})},async(args)=>audited(userId,guard,"github.refresh_ci",args,()=>refreshDeliveryCi(userId,args)));
  server.registerTool("kanban_github_ci_failure_task",{description:"Create one deduplicated agent remediation task for a failed GitHub Actions run.",inputSchema:z.object({boardId:z.string().min(1).max(128),cardId:z.string().min(1).max(128),repo:z.string().regex(new RegExp("^[^/]+/[^/]+$")),runId:z.number().int().positive(),errorContext:z.string().max(20000).default("")})},async(args)=>audited(userId,guard,"github.ci_failure_task",args,()=>ciFailureToTask(userId,args)));
  server.registerTool("kanban_github_verify_merge",{description:"Explicitly verify a merged PR and persist the merge commit.",inputSchema:z.object({boardId:z.string().min(1).max(128),cardId:z.string().min(1).max(128),repo:z.string().regex(new RegExp("^[^/]+/[^/]+$")),prNumber:z.number().int().positive().optional(),expectedSha:z.string().trim().min(7).max(64).optional()})},async(args)=>audited(userId,guard,"github.verify_merge",args,()=>verifyMerge(userId,args)));
  server.registerTool("kanban_github_release_done",{description:"Allow Done only after explicit merge verification and optional release/tag verification.",inputSchema:z.object({boardId:z.string().min(1).max(128),cardId:z.string().min(1).max(128),repo:z.string().regex(new RegExp("^[^/]+/[^/]+$")),tag:z.string().trim().min(1).max(255).optional()})},async(args)=>audited(userId,guard,"github.release_done",args,()=>releaseToDone(userId,args)));

}