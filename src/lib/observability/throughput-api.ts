import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { throughputMetricsInputSchema,measureThroughputAndCycleTime } from "./throughput";

export const throughputMetricsFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(throughputMetricsInputSchema).handler(async({data,context})=>JSON.parse(JSON.stringify(await measureThroughputAndCycleTime(context.userId,data))));
