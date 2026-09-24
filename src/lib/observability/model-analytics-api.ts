import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { modelUsageAnalyticsInputSchema,aggregateModelUsageAnalytics } from "./model-analytics";
export const modelUsageAnalyticsFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(modelUsageAnalyticsInputSchema).handler(async({data,context})=>JSON.parse(JSON.stringify(await aggregateModelUsageAnalytics(context.userId,data))));
