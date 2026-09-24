import { z } from "zod";
import { getSql } from "@/lib/db";
export const memorySourceSchema=z.object({type:z.string().trim().min(1).max(64),ref:z.string().trim().min(1).max(512)});
export const projectMemorySchema=z.object({boardId:z.string().trim().min(1).max(128).nullable().default(null),key:z.string().trim().min(1).max(256),value:z.unknown(),source:memorySourceSchema});
export async function writeProjectMemory(userId:string,input:unknown){
 const d=projectMemorySchema.parse(input),sql=await getSql();
 const latest=await sql.query<{version:number|string}>("select coalesce(max(version),0)+1 as version from kanban_project_memory where owner_user_id=$1 and board_id is not distinct from $2 and key=$3",[userId,d.boardId,d.key]);
 const version=Number(latest[0]?.version??1),id=crypto.randomUUID();
 await sql.query("update kanban_project_memory set active=false,updated_at=now() where owner_user_id=$1 and board_id is not distinct from $2 and key=$3 and active=true",[userId,d.boardId,d.key]);
 await sql.query("insert into kanban_project_memory(id,owner_user_id,board_id,key,value,source_type,source_ref,version) values($1,$2,$3,$4,$5::jsonb,$6,$7,$8)",[id,userId,d.boardId,d.key,JSON.stringify(d.value),d.source.type,d.source.ref,version]);
 return {id,boardId:d.boardId,key:d.key,value:d.value,source:d.source,version};
}
export async function getProjectMemory(userId:string,boardId:string|null,key?:string){
 const sql=await getSql(); const p=[userId,boardId] as unknown[]; let q="select id,board_id as \"boardId\",key,value,source_type as \"sourceType\",source_ref as \"sourceRef\",version,created_at as \"createdAt\",updated_at as \"updatedAt\" from kanban_project_memory where owner_user_id=$1 and board_id is not distinct from $2 and active=true";
 if(key){p.push(key);q+=" and key=$3"} q+=" order by key"; return sql.query(q,p);
}