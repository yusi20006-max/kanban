import { z } from "zod";
export const recoveryEvidenceSchema=z.object({remediationId:z.string().trim().min(1).max(128),executionId:z.string().trim().min(1).max(128),originalFailureFingerprint:z.string().trim().min(1).max(128),reproduced:z.boolean(),checks:z.array(z.object({name:z.string().trim().min(1).max(256),passed:z.boolean(),evidence:z.record(z.string(),z.unknown())})).min(1).max(50)});
export type RecoveryState="recovered"|"unrecovered"|"unknown";
export function evaluateRecoveryEvidence(input:z.infer<typeof recoveryEvidenceSchema>):RecoveryState{if(input.reproduced)return "unrecovered";if(input.checks.length>0&&input.checks.every(c=>c.passed&&Object.keys(c.evidence).length>0))return "recovered";return "unknown";}
