import { getSql } from "@/lib/db";
import { createAgentTask, claimTask } from "./lease";
import { startExecution } from "./execution";
import { transitionAgent } from "@/lib/kanban-domain";
import { startCardExecutionInputSchema, buildCardExecutionPlan, type CardExecutionPlan } from "./card-execution-contract";

export async function startCardExecution(userId: string, input: unknown) {
  const data = startCardExecutionInputSchema.parse(input);
  const sql = await getSql();

  if (data.idempotencyKey) {
    const prior = await sql.query<{ result: CardExecutionPlan }>(
      "select result from kanban_idempotency where actor_user_id=$1 and operation_key=$2 and action='agent.card.start'",
      [userId, data.idempotencyKey],
    );
    if (prior[0]) return { ...prior[0].result, reused: true };
  }

  const card = await sql.query<{
    id: string;
    title: string;
    agent_state: string;
    workflow_phase: string;
    github_repo: string | null;
    github_issue_number: number | null;
  }>(
    "select c.id,c.title,c.agent_state,c.workflow_phase,c.github_repo,c.github_issue_number from kanban_cards c join kanban_boards b on b.id=c.board_id where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",
    [data.cardId, data.boardId, userId],
  );
  if (!card[0]) throw new Error("CARD_NOT_FOUND");
  if (card[0].agent_state !== "idle") throw new Error("CARD_NOT_IDLE");
  if (card[0].workflow_phase !== "inspect") throw new Error("CARD_NOT_AT_INSPECT");
  if (!card[0].github_repo || !card[0].github_issue_number) throw new Error("CARD_GITHUB_ISSUE_REQUIRED");

  const agents = await sql.query<{ id: string }>(
    data.agentId
      ? "select id from kanban_agents where owner_user_id=$1 and id=$2 and status='ready'"
      : "select id from kanban_agents where owner_user_id=$1 and status='ready' order by updated_at desc,id limit 1",
    data.agentId ? [userId, data.agentId] : [userId],
  );
  if (!agents[0]) throw new Error("NO_READY_AGENT");

  const plan = buildCardExecutionPlan(data.cardId, agents[0].id);
  const taskId = plan.taskId;

  await createAgentTask(userId, {
    taskId,
    title: `Execute Issue #${card[0].github_issue_number}: ${card[0].title}`,
    boardId: data.boardId,
    cardId: data.cardId,
  });

  const lease = await claimTask(userId, {
    taskId,
    agentId: plan.agentId,
    leaseTtlSeconds: data.leaseTtlSeconds,
    idempotencyKey: data.idempotencyKey ? `${data.idempotencyKey}:claim` : null,
  });

  const execution = await startExecution(userId, {
    executionId: plan.executionId,
    taskId,
    agentId: plan.agentId,
    timeoutSeconds: data.timeoutSeconds,
  });

  await transitionAgent(userId, {
    boardId: data.boardId,
    cardId: data.cardId,
    toState: "running",
    phase: "inspect",
    result: `Execution ${execution.executionId} started for Agent ${plan.agentId} with lease ${lease.leaseId}.`,
    idempotencyKey: data.idempotencyKey ? `${data.idempotencyKey}:transition` : null,
  });

  const result = {
    ...plan,
    leaseId: lease.leaseId,
    executionId: execution.executionId,
    taskStatus: "running",
    agentState: "running",
    workflowPhase: "inspect" as const,
    github: { repo: card[0].github_repo, issueNumber: card[0].github_issue_number },
    reused: false,
  };

  if (data.idempotencyKey) {
    await sql.query(
      "insert into kanban_idempotency(actor_user_id,operation_key,action,result) values($1,$2,'agent.card.start',$3::jsonb)",
      [userId, data.idempotencyKey, JSON.stringify(result)],
    );
  }

  return result;
}
