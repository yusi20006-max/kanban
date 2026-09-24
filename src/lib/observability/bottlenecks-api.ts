import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { bottleneckInputSchema,detectBottlenecks } from "./bottlenecks";
export const bottleneckDetectionFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(bottleneckInputSchema).handler(async({data,context})=>JSON.parse(JSON.stringify(await detectBottlenecks(context.userId,data))));
