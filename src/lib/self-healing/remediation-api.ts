import { createServerFn } from "@tanstack/react-start";import { authMiddleware } from "@/lib/auth/middleware";import { createRemediationTask,listRemediationTasks } from "./remediation";
export const createRemediationTaskFn=createServerFn({method:"POST"}).middleware([authMiddleware]).handler(async({data,context})=>JSON.parse(JSON.stringify(await createRemediationTask(context.userId,data))));
export const listRemediationTasksFn=createServerFn({method:"GET"}).middleware([authMiddleware]).handler(async({context})=>JSON.parse(JSON.stringify(await listRemediationTasks(context.userId))));
