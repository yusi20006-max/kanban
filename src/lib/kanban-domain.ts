import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertTransition, nextPhase, transitionInputSchema, recordPhaseInputSchema, type AgentState } from "@/lib/workflow";

export const columnIdSchema = z.string().trim().min(1).max(128);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const boardIdSchema = z.string().min(1).max(128);
export const cardIdSchema = z.string().min(1).max(128);

export const cardInputSchema = z.object({
  boardId: boardIdSchema, columnId: columnIdSchema,
  title: z.string().trim().min(1).max(500), description: z.string().max(10000).default(""),
  priority: prioritySchema.default("medium"), dueDate: z.string().date().nullable().default(null), idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
});
export const updateCardInputSchema = cardInputSchema.extend({ cardId: cardIdSchema });
export const archiveCardInputSchema = z.object({ boardId: boardIdSchema, cardId: cardIdSchema });
export const moveCardInputSchema = z.object({
  boardId: boardIdSchema, cardId: cardIdSchema, columnId: columnIdSchema,
  beforeCardId: cardIdSchema.nullable().default(null),
  idempotencyKey: z.string().trim().min(1).max(200).nullable().default(null),
});
export type CardInput = z.infer<typeof cardInputSchema>;
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;
export type MoveCardInput = z.infer<typeof moveCardInputSchema>;

export class DomainError extends Error {
  constructor(public readonly code: "BOARD_NOT_FOUND" | "CARD_NOT_FOUND" | "COLUMN_NOT_FOUND" | "CROSS_BOARD_COLUMN", message = code) {
    super(message); this.name = "DomainError";
  }
}

async function assertBoardOwner(userId: string, boardId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    "select id from kanban_boards where id=$1 and owner_user_id=$2 and archived_at is null", [boardId, userId],
  );
  if (!rows[0]) throw new DomainError("BOARD_NOT_FOUND");
  return sql;
}

async function assertColumnOnBoard(sql: Awaited<ReturnType<typeof getSql>>, boardId: string, columnId: string) {
  const rows = await sql.query<{ id: string }>(
    "select id from kanban_columns where id=$1 and board_id=$2", [columnId, boardId],
  );
  if (!rows[0]) throw new DomainError("COLUMN_NOT_FOUND");
}

export async function listBoards(userId: string) {
  const sql = await getSql();
  return sql.query<{ id:string; name:string; created_at:string; updated_at:string }>(
    "select id,name,created_at,updated_at from kanban_boards where owner_user_id=$1 and archived_at is null order by created_at,id", [userId],
  );
}

type BoardColumn = { id:string; name:string; position:number };
type BoardCard = { id:string; column_id:string; position:number; title:string; description:string; priority:"low"|"medium"|"high"|"critical"; due_date:string|null; created_at:string; updated_at:string; agent_state:AgentState; workflow_phase:string; github_repo:string|null; github_issue_number:number|null; github_pr_number:number|null; github_issue_state:string|null; github_pr_state:string|null; github_pr_merged:boolean|null; github_ci_state:string|null; github_synced_at:string|null };
export async function listBoard(userId: string, boardId: string): Promise<{board:{id:string;name:string};columns:BoardColumn[];cards:BoardCard[]}> {
  const sql = await assertBoardOwner(userId, boardId);
  const boards = await sql.query<{ id:string; name:string }>("select id,name from kanban_boards where id=$1",[boardId]);
  const columns = await sql.query<BoardColumn>("select id,name,position from kanban_columns where board_id=$1 order by position,id",[boardId]);
  const cards = await sql.query<BoardCard>("select id,column_id,position,title,description,priority,due_date,created_at,updated_at,agent_state,workflow_phase,github_repo,github_issue_number,github_pr_number,github_issue_state,github_pr_state,github_pr_merged,github_ci_state,github_synced_at from kanban_cards where board_id=$1 and archived_at is null order by column_id,position,created_at",[boardId]);
  return { board: boards[0], columns, cards };
}

export async function createCard(userId:string,data:CardInput) {
  const sql=await assertBoardOwner(userId,data.boardId);
  await assertColumnOnBoard(sql,data.boardId,data.columnId);
  if (data.idempotencyKey) {
    const prior = await sql.query<{ result: { id: string } }>("select result from kanban_idempotency where actor_user_id=$1 and operation_key=$2 and action=$3",[userId,data.idempotencyKey,"card.create"]);
    if (prior[0]) return prior[0].result;
  }
  const id=crypto.randomUUID();
  const rows=await sql.query<{position:number}>(
    "select coalesce(max(position),-1)+1 as position from kanban_cards where board_id=$1 and column_id=$2 and archived_at is null",
    [data.boardId,data.columnId],
  );
  const position=Number(rows[0]?.position ?? 0);
  const value={id};
  return sql.transaction(async (tx) => {
    await tx.query("insert into kanban_cards(id,board_id,column_id,position,title,description,priority,due_date) values($1,$2,$3,$4,$5,$6,$7,$8)",[id,data.boardId,data.columnId,position,data.title,data.description,data.priority,data.dueDate]);
    if(data.idempotencyKey) await tx.query("insert into kanban_idempotency(actor_user_id,operation_key,action,result) values($1,$2,$3,$4::jsonb)",[userId,data.idempotencyKey,"card.create",JSON.stringify(value)]);
    return value;
  });
}

export async function updateCard(userId:string,data:UpdateCardInput) {
  const sql=await assertBoardOwner(userId,data.boardId);
  await assertColumnOnBoard(sql,data.boardId,data.columnId);
  const updated=await sql.query<{id:string}>(
    "update kanban_cards set column_id=$1,title=$2,description=$3,priority=$4,due_date=$5,updated_at=now() where id=$6 and board_id=$7 and archived_at is null returning id",
    [data.columnId,data.title,data.description,data.priority,data.dueDate,data.cardId,data.boardId],
  );
  if(updated.length===0) throw new DomainError("CARD_NOT_FOUND");
  return {ok:true};
}

export async function archiveCard(userId:string,data:z.infer<typeof archiveCardInputSchema>) {
  const sql=await assertBoardOwner(userId,data.boardId);
  const archived=await sql.query<{id:string}>("update kanban_cards set archived_at=now(),updated_at=now() where id=$1 and board_id=$2 and archived_at is null returning id",[data.cardId,data.boardId]);
  if(archived.length===0) throw new DomainError("CARD_NOT_FOUND");
  return {ok:true};
}

export async function moveCard(userId:string,data:MoveCardInput) {
  const sql=await assertBoardOwner(userId,data.boardId);
  await assertColumnOnBoard(sql,data.boardId,data.columnId);
  const exists=await sql.query<{id:string}>("select id from kanban_cards where id=$1 and board_id=$2 and archived_at is null",[data.cardId,data.boardId]);
  if(!exists[0]) throw new DomainError("CARD_NOT_FOUND");
  if(data.beforeCardId===data.cardId) throw new Error("INVALID_MOVE_TARGET");
  if(data.idempotencyKey){const prior=await sql.query<{result:{ok:true}}>("select result from kanban_idempotency where actor_user_id=$1 and operation_key=$2 and action=$3",[userId,data.idempotencyKey,"card.move"]);if(prior[0])return prior[0].result;}
  if(data.beforeCardId){
    const target=await sql.query<{id:string}>("select id from kanban_cards where id=$1 and board_id=$2 and column_id=$3 and archived_at is null",[data.beforeCardId,data.boardId,data.columnId]);
    if(!target[0]) throw new Error("INVALID_MOVE_TARGET");
  }
  const ordered=await sql.query<{id:string}>("select id from kanban_cards where board_id=$1 and column_id=$2 and archived_at is null and id<>$3 order by position,created_at",[data.boardId,data.columnId,data.cardId]);
  let position=ordered.length;
  if(data.beforeCardId){ const idx=ordered.findIndex((row)=>row.id===data.beforeCardId); if(idx<0) throw new Error("INVALID_MOVE_TARGET"); position=idx; }
  const ids=[...ordered]; ids.splice(position,0,{id:data.cardId});
  const value={ok:true as const};
  return sql.transaction(async (tx) => {
    await tx.query("update kanban_cards set column_id=$1,updated_at=now() where id=$2 and board_id=$3",[data.columnId,data.cardId,data.boardId]);
    for(let i=0;i<ids.length;i+=1) await tx.query("update kanban_cards set position=$1,updated_at=now() where id=$2 and board_id=$3",[i,ids[i].id,data.boardId]);
    if(data.idempotencyKey) await tx.query("insert into kanban_idempotency(actor_user_id,operation_key,action,result) values($1,$2,$3,$4::jsonb)",[userId,data.idempotencyKey,"card.move",JSON.stringify(value)]);
    return value;
  });
}

export async function transitionAgent(userId:string,data:z.infer<typeof transitionInputSchema>) {
  const sql=await assertBoardOwner(userId,data.boardId);
  const rows=await sql.query<{agent_state:AgentState;workflow_phase:string}>(
    "select c.agent_state,c.workflow_phase from kanban_cards c join kanban_boards b on b.id=c.board_id where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",
    [data.cardId,data.boardId,userId],
  );
  const current=rows[0]; if(!current) throw new DomainError("CARD_NOT_FOUND");
  if(data.idempotencyKey){const prior=await sql.query<{result:{cardId:string;fromState:AgentState;toState:AgentState;phase:string}}>("select result from kanban_idempotency where actor_user_id=$1 and operation_key=$2 and action=$3",[userId,data.idempotencyKey,"workflow.transition"]);if(prior[0])return prior[0].result;}
  assertTransition(current.agent_state,data.toState);
  const phase=data.phase??current.workflow_phase;
  const value={cardId:data.cardId,fromState:current.agent_state,toState:data.toState,phase};
  return sql.transaction(async (tx) => {
    const updated=await tx.query("update kanban_cards set agent_state=$1,workflow_phase=$2,updated_at=now() where id=$3 and board_id=$4 and agent_state=$5",[data.toState,phase,data.cardId,data.boardId,current.agent_state]);
    if(updated.length===0) throw new Error("CONCURRENT_AGENT_STATE_CHANGE");
    await tx.query("insert into kanban_workflow_events(id,card_id,phase,agent_state,attempt,result) values($1,$2,$3,$4,(select coalesce(max(attempt),0)+1 from kanban_workflow_events where card_id=$2 and phase=$3),$5)",[crypto.randomUUID(),data.cardId,phase,data.toState,data.result]);
    if(data.idempotencyKey) await tx.query("insert into kanban_idempotency(actor_user_id,operation_key,action,result) values($1,$2,$3,$4::jsonb)",[userId,data.idempotencyKey,"workflow.transition",JSON.stringify(value)]);
    return value;
  });
}

export async function recordWorkflowPhase(userId:string,data:z.infer<typeof recordPhaseInputSchema>) {
  const sql=await assertBoardOwner(userId,data.boardId);
  const rows=await sql.query<{agent_state:AgentState;workflow_phase:string}>(
    "select c.agent_state,c.workflow_phase from kanban_cards c join kanban_boards b on b.id=c.board_id where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",[data.cardId,data.boardId,userId]);
  if(!rows[0]) throw new DomainError("CARD_NOT_FOUND");
  const target=nextPhase(data.phase);
  await sql.query("update kanban_cards set workflow_phase=$1,updated_at=now() where id=$2 and board_id=$3",[target,data.cardId,data.boardId]);
  await sql.query("insert into kanban_workflow_events(id,card_id,phase,agent_state,attempt,result) values($1,$2,$3,$4,(select count(*)+1 from kanban_workflow_events where card_id=$2 and phase=$3),$5)",
    [crypto.randomUUID(),data.cardId,data.phase,rows[0].agent_state,data.result]);
  return {cardId:data.cardId,completedPhase:data.phase,nextPhase:target};
}

export async function createBoard(userId:string,data:{name:string;description?:string;projectKey?:string|null}) {
  const sql=await getSql(); const id=crypto.randomUUID();
  await sql.query("insert into kanban_boards(id,name,description,project_key,owner_user_id) values($1,$2,$3,$4,$5)",[id,data.name.trim(),data.description??"",data.projectKey??null,userId]);
  for(const [columnId,name,position] of [["todo","Todo",0],["doing","Doing",1],["done","Done",2]] as const)
    await sql.query("insert into kanban_columns(id,board_id,name,position) values($1,$2,$3,$4)",[columnId,id,name,position]);
  return {id};
}

export async function updateBoard(userId:string,data:{boardId:string;name:string;description?:string;projectKey?:string|null}) {
  const sql=await assertBoardOwner(userId,data.boardId);
  const result=await sql.query("update kanban_boards set name=$1,description=$2,project_key=$3,updated_at=now() where id=$4",[data.name.trim(),data.description??"",data.projectKey??null,data.boardId]);
  if(result.length===0) throw new DomainError("BOARD_NOT_FOUND"); return {ok:true};
}
export async function archiveBoard(userId:string,boardId:string){const sql=await assertBoardOwner(userId,boardId);await sql.query("update kanban_boards set archived_at=now(),updated_at=now() where id=$1",[boardId]);return {ok:true};}
export async function upsertColumn(userId:string,data:{boardId:string;id:string;name:string;position:number}){const sql=await assertBoardOwner(userId,data.boardId);await sql.query("insert into kanban_columns(id,board_id,name,position) values($1,$2,$3,$4) on conflict(board_id,id) do update set name=excluded.name,position=excluded.position,updated_at=now()",[data.id,data.boardId,data.name.trim(),data.position]);return {ok:true};}
export async function addLabel(userId:string,data:{boardId:string;name:string}){const sql=await assertBoardOwner(userId,data.boardId);const id=crypto.randomUUID();await sql.query("insert into kanban_labels(id,board_id,name) values($1,$2,$3) on conflict(board_id,name) do nothing",[id,data.boardId,data.name.trim()]);const rows=await sql.query<{id:string}>("select id from kanban_labels where board_id=$1 and name=$2",[data.boardId,data.name.trim()]);return{id:rows[0]?.id??id};}
export async function setCardLabel(userId:string,data:{boardId:string;cardId:string;labelId:string;enabled:boolean}){const sql=await assertBoardOwner(userId,data.boardId);const card=await sql.query("select id from kanban_cards where id=$1 and board_id=$2 and archived_at is null",[data.cardId,data.boardId]);const label=await sql.query("select id from kanban_labels where id=$1 and board_id=$2",[data.labelId,data.boardId]);if(!card[0])throw new DomainError("CARD_NOT_FOUND");if(!label[0])throw new Error("LABEL_NOT_FOUND");if(data.enabled)await sql.query("insert into kanban_card_labels(card_id,label_id) values($1,$2) on conflict do nothing",[data.cardId,data.labelId]);else await sql.query("delete from kanban_card_labels where card_id=$1 and label_id=$2",[data.cardId,data.labelId]);return{ok:true};}
export async function addChecklistItem(userId:string,data:{boardId:string;cardId:string;title:string}){const sql=await assertBoardOwner(userId,data.boardId);const card=await sql.query("select id from kanban_cards where id=$1 and board_id=$2",[data.cardId,data.boardId]);if(!card[0])throw new DomainError("CARD_NOT_FOUND");const rows=await sql.query<{position:number}>("select coalesce(max(position),-1)+1 as position from kanban_checklist_items where card_id=$1",[data.cardId]);const id=crypto.randomUUID();await sql.query("insert into kanban_checklist_items(id,card_id,title,position) values($1,$2,$3,$4)",[id,data.cardId,data.title.trim(),Number(rows[0]?.position??0)]);return{id};}
export async function setChecklistItem(userId:string,data:{boardId:string;cardId:string;itemId:string;completed:boolean}){const sql=await assertBoardOwner(userId,data.boardId);const result=await sql.query("update kanban_checklist_items set completed=$1,updated_at=now() where id=$2 and card_id=$3",[data.completed,data.itemId,data.cardId]);if(result.length===0)throw new Error("CHECKLIST_ITEM_NOT_FOUND");return{ok:true};}
export async function addComment(userId:string,data:{boardId:string;cardId:string;body:string}){const sql=await assertBoardOwner(userId,data.boardId);const card=await sql.query("select id from kanban_cards where id=$1 and board_id=$2",[data.cardId,data.boardId]);if(!card[0])throw new DomainError("CARD_NOT_FOUND");const id=crypto.randomUUID();await sql.query("insert into kanban_comments(id,card_id,author_user_id,body) values($1,$2,$3,$4)",[id,data.cardId,userId,data.body.trim()]);return{id};}
export async function searchCards(userId:string,data:{boardId:string;query:string}){const sql=await assertBoardOwner(userId,data.boardId);return sql.query<{id:string;title:string;description:string;column_id:string;priority:"low"|"medium"|"high"|"critical";updated_at:string}>("select id,title,description,column_id,priority,updated_at from kanban_cards where board_id=$1 and archived_at is null and (title ilike $2 or description ilike $2) order by updated_at desc",[data.boardId,"%"+data.query.trim()+"%"]);}