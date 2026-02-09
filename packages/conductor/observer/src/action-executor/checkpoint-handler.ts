import { ObserverMcpClient } from "./mcp-client.js";
import type {
  SaveCheckpointAndPauseAction,
  ActionResult,
} from "../types.js";

/**
 * Handle save_checkpoint_and_pause action:
 * 1. Save checkpoint via conductor_checkpoint MCP tool
 * 2. Update agent status to blocked
 * 3. Update task with needs_new_session flag
 * 4. Create escalation for human awareness
 */
export async function handleSaveCheckpointAndPause(
  action: SaveCheckpointAndPauseAction,
  mcpClient: ObserverMcpClient,
): Promise<ActionResult> {
  try {
    // Step 1: Save checkpoint via MCP
    await mcpClient.saveCheckpoint(
      action.agentId,
      action.taskId,
      action.stage,
      action.tokenCount,
    );

    // Step 2: Update agent status to blocked
    await mcpClient.sendHeartbeat(action.agentId, "blocked");

    // Step 3: Update task if we have a task ID
    if (action.taskId) {
      await mcpClient.updateTask(action.taskId, {
        status: "blocked",
        notes: `Context exhausted at ${action.tokenCount}/${action.tokenLimit} tokens. Checkpoint saved. Needs new session to continue.`,
      });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
