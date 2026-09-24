import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { failureMetricsInputSchema,measureFailureMetrics } from "./failure-metrics";
export const failureMetricsFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(failureMetricsInputSchema).handler(async({data,context})=>JSON.parse(JSON.stringify(await measureFailureMetrics(context.userId,data))));
