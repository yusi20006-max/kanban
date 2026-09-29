import { z } from "zod";
import { createRemediationTask } from "./remediation";
import { startRemediationExecution, finishRemediationExecution } from "./remediation-execution";
import { verifyRecovery } from "./recovery-verification";
import { prepareAutoDelivery } from "./delivery-loop";
import { mergeDeliveryPr } from "./delivery-merge";
import { verifyAndClose } from "./verify-close";

const schema=z.object({failureSignalId:z.string().min(1).max(128),agentId:z.string().min(1).max(128).optional(),capability:z.string().min(1).max(128).optional(),boardId:z.string().min(1).optional(),cardId:z.string().min(1).optional(),repo:z.string().regex(/^[^/]+\/[^/]+$/).optional(),title:z.string().optional(),body:z.string().optional(),recovery:z.object({originalFailureFingerprint:z.string().min(1),reproduced:z.boolean(),checks:z.array(z.object({name:z.string().min(1),passed:z.boolean(),evidence:z.record(z.string(),z.unknown())})).min(1)}),fix:z.object({passed:z.boolean(),evidence:z.record(z.string(),z.unknown())}),test:z.object({passed:z.boolean(),evidence:z.record(z.string(),z.unknown())})});

export async function runPhase14Remediation(userId:string,input:unknown){
 const d=schema.parse(input);const correlationId=crypto.randomUUID();
 const task=await createRemediationTask(userId,{failureSignalId:d.failureSignalId});
 const started=await startRemediationExecution(userId,{remediationId:task.remediationId,agentId:d.agentId,capability:d.capability,leaseTtlSeconds:300,timeoutSeconds:900});
 const finished=await finishRemediationExecution(userId,{remediationId:task.remediationId,executionId:started.executionId,fix:d.fix,test:d.test});
 if(finished.status!=="succeeded")return {correlationId,status:"failed" as const,stage:"test",task,started,finished};
 const recovery=await verifyRecovery(userId,{remediationId:task.remediationId,executionId:started.executionId,originalFailureFingerprint:d.recovery.originalFailureFingerprint,reproduced:d.recovery.reproduced,checks:d.recovery.checks});
 if(recovery.state!=="recovered")return {correlationId,status:"stopped" as const,stage:"verify",task,started,finished,recovery};
 if(!d.boardId||!d.cardId||!d.repo)return {correlationId,status:"recovered" as const,stage:"verify",task,started,finished,recovery};
 const delivery=await prepareAutoDelivery(userId,{boardId:d.boardId,cardId:d.cardId,repo:d.repo,testsPassed:true,title:d.title,body:d.body});
 if(delivery.ciState!=="success")return {correlationId,status:"waiting" as const,stage:"ci",task,started,finished,recovery,delivery};
 const merged=await mergeDeliveryPr(userId,{boardId:d.boardId,cardId:d.cardId,repo:d.repo,prNumber:delivery.prNumber});
 const verified=await verifyAndClose(userId,{remediationId:task.remediationId,boardId:d.boardId,cardId:d.cardId,repo:d.repo,prNumber:delivery.prNumber,expectedSha:merged.mergeCommitSha});
 return {correlationId,status:"resolved" as const,stage:"verify",task,started,finished,recovery,delivery,merged,verified};
}