import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { aggregateAiUsage, checkAiTokenHealth, listAiModels, listAiTokenHealth, listAiRoutingDecisions, listAiContextDecisions, planAiFallback, planAiIntelligence, registerAiModel, recordAiUsage, routeAiTask, selectAiContext } from "@/lib/ai-intelligence.server";
import { aiFallbackInputSchema, aiContextSelectionSchema, aiModelSchema, aiRoutingRequirementsSchema, aiUsageSchema, aiProviderSchema, aiTokenHealthStateSchema } from "@/lib/ai-intelligence.server";

const serializable=(value:unknown)=>JSON.parse(JSON.stringify(value));
export const aiModelsFn=createServerFn({method:"GET"}).middleware([authMiddleware]).handler(async()=>serializable(await listAiModels()));
export const aiRegisterModelFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(aiModelSchema).handler(async({data})=>serializable(await registerAiModel(data)));
export const aiRouteTaskFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().min(1).max(128),requirements:aiRoutingRequirementsSchema})).handler(async({data,context})=>serializable(await routeAiTask(context.userId,data.taskId,data.requirements)));
export const aiFallbackFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().min(1).max(128),input:aiFallbackInputSchema})).handler(async({data,context})=>serializable(await planAiFallback(context.userId,data.taskId,data.input)));
export const aiTokenHealthFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.object({provider:aiProviderSchema,state:aiTokenHealthStateSchema.optional(),errorCode:z.string().max(128).nullable().optional(),expiresAt:z.string().datetime().nullable().optional()})).handler(async({data,context})=>serializable(await checkAiTokenHealth(context.userId,data.provider,data)));
export const aiTokenHealthListFn=createServerFn({method:"GET"}).middleware([authMiddleware]).handler(async({context})=>serializable(await listAiTokenHealth(context.userId)));
export const aiUsageFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(aiUsageSchema).handler(async({data,context})=>serializable(await recordAiUsage(context.userId,data)));
export const aiUsageAggregateFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().min(1).max(128).optional()})).handler(async({data,context})=>serializable(await aggregateAiUsage(context.userId,data.taskId)));
export const aiContextFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().min(1).max(128),input:aiContextSelectionSchema})).handler(async({data,context})=>serializable(await selectAiContext(context.userId,data.taskId,data.input)));
export const aiPlanFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().min(1).max(128),routing:aiRoutingRequirementsSchema.optional(),context:aiContextSelectionSchema.optional()})).handler(async({data,context})=>serializable(await planAiIntelligence(context.userId,data)));
export const aiRoutingHistoryFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().min(1).max(128)})).handler(async({data,context})=>serializable(await listAiRoutingDecisions(context.userId,data.taskId)));
export const aiContextHistoryFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().min(1).max(128)})).handler(async({data,context})=>serializable(await listAiContextDecisions(context.userId,data.taskId)));
