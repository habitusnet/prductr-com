import { ObserverMcpClient } from "./mcp-client.js";
import type {
  PromptAgentAction,
  RestartAgentAction,
  ReassignTaskAction,
  RetryTaskAction,
  PauseAgentAction,
  ReleaseLockAction,
  UpdateTaskStatusAction,
  ActionResult,
} from "../types.js";

/**
 * Interface for sandbox manager to allow for optional dependency injection
 */
export interface SandboxManagerLike {
  restartSandbox(agentId: string): Promise<void>;
}

/**
 * Handle prompt_agent action: send heartbeat with 'working' status
 */
export async function handlePromptAgent(
  action: PromptAgentAction,
  mcpClient: ObserverMcpClient
): Promise<ActionResult> {
  try {
    await mcpClient.sendHeartbeat(action.agentId, "working");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Handle restart_agent action: restart the agent's sandbox
 */
export async function handleRestartAgent(
  action: RestartAgentAction,
  mcpClient: ObserverMcpClient,
  sandboxManager: SandboxManagerLike | null
): Promise<ActionResult> {
  try {
    if (!sandboxManager) {
      return {
        success: false,
        error: "No sandbox manager available for restart",
      };
    }

    await sandboxManager.restartSandbox(action.agentId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Handle reassign_task action: reassign task to another agent or unassign
 */
export async function handleReassignTask(
  action: ReassignTaskAction,
  mcpClient: ObserverMcpClient
): Promise<ActionResult> {
  try {
    const notes = action.toAgent
      ? `Reassigned from ${action.fromAgent} to ${action.toAgent}`
      : `Reassigned from ${action.fromAgent}`;

    // Note: Can't set to "pending" via MCP - just update notes for reassignment
    await mcpClient.updateTask(action.taskId, {
      notes,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Handle retry_task action: reset task to pending for retry
 */
export async function handleRetryTask(
  action: RetryTaskAction,
  mcpClient: ObserverMcpClient
): Promise<ActionResult> {
  try {
    // Reset to in_progress for retry (can't use "pending" via MCP)
    await mcpClient.updateTask(action.taskId, {
      status: "in_progress",
      notes: "Retrying task after previous failure",
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Handle pause_agent action: send heartbeat with 'blocked' status
 */
export async function handlePauseAgent(
  action: PauseAgentAction,
  mcpClient: ObserverMcpClient
): Promise<ActionResult> {
  try {
    await mcpClient.sendHeartbeat(action.agentId, "blocked");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Handle release_lock action: unlock a file that was being held by an agent
 */
export async function handleReleaseLock(
  action: ReleaseLockAction,
  mcpClient: ObserverMcpClient
): Promise<ActionResult> {
  try {
    await mcpClient.unlockFile(action.filePath, action.agentId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Handle update_task_status action: directly update task status and notes
 */
export async function handleUpdateTaskStatus(
  action: UpdateTaskStatusAction,
  mcpClient: ObserverMcpClient
): Promise<ActionResult> {
  try {
    await mcpClient.updateTask(action.taskId, {
      status: action.status as
        | "in_progress"
        | "completed"
        | "failed"
        | "blocked",
      notes: action.notes,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
