import { agentStatusSchema, executionStatusSchema, taskStatusSchema, type AgentStatus, type ExecutionStatus, type TaskStatus } from "./contracts";

const taskTransitions:Record<TaskStatus,TaskStatus[]>={
  pending:["claimed"],claimed:["running","pending"],running:["completed","failed","cancelled"],blocked:["pending","failed"],completed:["pending"],failed:["pending"],cancelled:["pending"],
};
const executionTransitions:Record<ExecutionStatus,ExecutionStatus[]>={
  queued:["running","cancelled"],running:["succeeded","failed","timed_out","cancelled"],succeeded:[],failed:[],timed_out:[],cancelled:[],
};
const agentTransitions:Record<AgentStatus,AgentStatus[]>={
  registered:["ready","disabled"],ready:["busy","stale","offline","disabled"],busy:["ready","stale","offline","disabled"],stale:["ready","offline","disabled"],offline:["ready","disabled"],disabled:["registered"],
};

export function canTaskTransition(from:TaskStatus,to:TaskStatus){return taskTransitions[from].includes(to);}
export function canExecutionTransition(from:ExecutionStatus,to:ExecutionStatus){return executionTransitions[from].includes(to);}
export function canAgentTransition(from:AgentStatus,to:AgentStatus){return agentTransitions[from].includes(to);}
export function assertStateTransition(kind:"task"|"execution"|"agent",from:string,to:string){
  if(kind==="task"){taskStatusSchema.parse(from);taskStatusSchema.parse(to);if(!canTaskTransition(from as TaskStatus,to as TaskStatus))throw new Error("INVALID_TASK_STATE_TRANSITION");}
  if(kind==="execution"){executionStatusSchema.parse(from);executionStatusSchema.parse(to);if(!canExecutionTransition(from as ExecutionStatus,to as ExecutionStatus))throw new Error("INVALID_EXECUTION_STATE_TRANSITION");}
  if(kind==="agent"){agentStatusSchema.parse(from);agentStatusSchema.parse(to);if(!canAgentTransition(from as AgentStatus,to as AgentStatus))throw new Error("INVALID_AGENT_STATE_TRANSITION");}
}
