import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { writeProjectMemory,getProjectMemory,writeTaskMemory,getTaskMemory,createDecisionRecord,finalizeDecisionRecord,listDecisionRecords,saveRepoContext,getRepoContext,writeLesson,searchLessons,searchMemory } from "@/lib/memory.server";

const serializable = (value: unknown) => JSON.parse(JSON.stringify(value));

export const memoryProjectWriteFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.any()).handler(async({data,context})=>serializable(await writeProjectMemory(context.userId,data)));
export const memoryProjectListFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({boardId:z.string().nullable().default(null),key:z.string().optional()})).handler(async({data,context})=>serializable(await getProjectMemory(context.userId,data.boardId,data.key)));
export const memoryTaskWriteFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.any()).handler(async({data,context})=>serializable(await writeTaskMemory(context.userId,data)));
export const memoryTaskListFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string()})).handler(async({data,context})=>serializable(await getTaskMemory(context.userId,data.taskId)));
export const memoryDecisionCreateFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.any()).handler(async({data,context})=>serializable(await createDecisionRecord(context.userId,data)));
export const memoryDecisionFinalizeFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.object({id:z.string()})).handler(async({data,context})=>serializable(await finalizeDecisionRecord(context.userId,data.id)));
export const memoryDecisionListFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string().optional()})).handler(async({data,context})=>serializable(await listDecisionRecords(context.userId,data.taskId)));
export const memoryRepoWriteFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.any()).handler(async({data,context})=>serializable(await saveRepoContext(context.userId,data)));
export const memoryRepoListFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({taskId:z.string()})).handler(async({data,context})=>serializable(await getRepoContext(context.userId,data.taskId)));
export const memoryLessonWriteFn=createServerFn({method:"POST"}).middleware([authMiddleware]).inputValidator(z.any()).handler(async({data,context})=>serializable(await writeLesson(context.userId,data)));
export const memoryLessonSearchFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.object({query:z.string().optional()})).handler(async({data,context})=>serializable(await searchLessons(context.userId,data.query)));
export const memorySearchFn=createServerFn({method:"GET"}).middleware([authMiddleware]).inputValidator(z.any()).handler(async({data,context})=>serializable(await searchMemory(context.userId,data)));
