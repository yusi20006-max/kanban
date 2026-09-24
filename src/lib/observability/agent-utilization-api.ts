import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { agentUtilizationInputSchema,measureAgentUtilization } from "./agent-utilization";
export const agentUtilizationFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(agentUtilizationInputSchema).handler(async({data,context})=>JSON.parse(JSON.stringify(await measureAgentUtilization(context.userId,data))));
