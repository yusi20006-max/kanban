import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth";
import { recordTelemetry, listTelemetry } from "./telemetry";

const recordInput=z.object({taskId:z.string().nullable().default(null),executionId:z.string().nullable().default(null),agentId:z.string().nullable().default(null),eventType:z.string().min(1).max(128),fromState:z.string().nullable().default(null),toState:z.string().nullable().default(null),payload:z.record(z.string(),z.unknown()).default({})});
const listInput=z.object({taskId:z.string().optional(),executionId:z.string().optional(),agentId:z.string().optional(),eventType:z.string().optional(),limit:z.number().int().min(1).max(1000).default(200)});

export const recordTelemetryFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(recordInput).handler(async({data,context})=>JSON.parse(JSON.stringify(await recordTelemetry(context.userId,data))));
export const listTelemetryFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(listInput).handler(async({data,context})=>JSON.parse(JSON.stringify(await listTelemetry(context.userId,data))));
