import { z } from "zod";
import { getSql } from "@/lib/db";
import { getSafetyConfig } from "./safety";

const schema=z.object({boardId:z.string().min(1),cardId:z.string().min(1),repo:z.string().regex(/^[^/]+\/[^/]+$/),prNumber:z.number().int().positive(),expectedHeadSha:z.string().regex(/^[0-9a-f]{40}$/i).optional()});
function token(){const v=process.env.GITHUB_TOKEN?.trim();if(!v)throw new Error("GITHUB_TOKEN_NOT_CONFIGURED");return v;}
async function gh<T>(path:string,init:RequestInit={}){const r=await fetch("https://api.github.com"+path,{...init,headers:{Authorization:"Bearer "+token(),Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json",...(init.headers??{})}});if(!r.ok)throw new Error("GITHUB_HTTP_"+r.status);return r.status===204?undefined as T:await r.json() as T;}
export async function mergeDeliveryPr(userId:string,input:unknown){
 const d=schema.parse(input);const safety=await getSafetyConfig(userId);const sql=await getSql();
 const card=await sql.query<{id:string}>("select c.id from kanban_cards c join kanban_boards b on b.id=c.board_id where c.id=$1 and c.board_id=$2 and b.owner_user_id=$3 and c.archived_at is null",[d.cardId,d.boardId,userId]);if(!card[0])throw new Error("CARD_NOT_FOUND");
 const pr=await gh<{number:number;state:string;merged:boolean;head:{sha:string};base:{ref:string};merge_commit_sha:string|null}>(`/repos/${d.repo}/pulls/${d.prNumber}`);
 if(pr.state!=="open"||pr.merged)throw new Error("PR_NOT_OPEN");if(d.expectedHeadSha&&d.expectedHeadSha!==pr.head.sha)throw new Error("PR_HEAD_CHANGED");
 const delivery=await sql.query<{ci_state:string|null}>("select ci_state from kanban_github_deliveries where owner_user_id=$1 and board_id=$2 and card_id=$3 and repo=$4 and pr_number=$5",[userId,d.boardId,d.cardId,d.repo,d.prNumber]);
 if(delivery[0]?.ci_state!=="success")throw new Error("CI_GATE_FAILED");if(!safety.protectedBranches.includes(pr.base.ref))throw new Error("UNPROTECTED_DELIVERY_TARGET");
 const merged=await gh<{merged:boolean;sha:string|null}>(`/repos/${d.repo}/pulls/${d.prNumber}/merge`,{method:"PUT",body:JSON.stringify({merge_method:"squash"})});
 if(!merged.merged||!merged.sha)throw new Error("PR_MERGE_FAILED");
 await sql.query("update kanban_github_deliveries set merged_commit_sha=$1,verified_at=now(),verification_state='verified',updated_at=now() where owner_user_id=$2 and board_id=$3 and card_id=$4 and repo=$5 and pr_number=$6",[merged.sha,userId,d.boardId,d.cardId,d.repo,d.prNumber]);
 return {merged:true,mergeCommitSha:merged.sha,baseBranch:pr.base.ref};
}