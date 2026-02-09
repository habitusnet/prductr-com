import { EventEmitter } from "eventemitter3";
import { ObserverMcpClient } from "./mcp-client.js";
import { ActionLogger } from "../escalation-queue/action-logger.js";
import type {
  AutonomousAction,
  DetectionEvent,
  ActionResult,
} from "../types.js";
import { SandboxManagerLike } from "./handlers.js";
import {
  handlePromptAgent,
  handleRestartAgent,
  handleReassignTask,
  handleRetryTask,
  handlePauseAgent,
  handleReleaseLock,
  handleUpdateTaskStatus,
} from "./handlers.js";
import { handleSaveCheckpointAndPause } from "./checkpoint-handler.js";

/**
 * Configuration for ActionExecutor
 */
export interface ActionExecutorConfig {
  projectId: string;
  observerId: string;
  mcpClient: ObserverMcpClient;
  actionLogger: ActionLogger;
  sandboxManager?: SandboxManagerLike;
}

/**
 * Events emitted by ActionExecutor
 */
interface ActionExecutorEvents {
  action: (action: AutonomousAction, result: ActionResult) => void;
}

/**
 * ActionExecutor - Coordinates execution of autonomous actions with audit logging
 *
 * Extends EventEmitter to emit 'action' events for metrics tracking.
 * Executes actions via appropriate handlers and logs all outcomes.
 */
export class ActionExecutor extends EventEmitter<ActionExecutorEvents> {
  private config: ActionExecutorConfig;

  constructor(config: ActionExecutorConfig) {
    super();
    this.config = config;
  }

  /**
   * Execute a single action with audit logging
   *
   * Flow:
   * 1. Log action to ActionLogger BEFORE execution (returns { id })
   * 2. Execute the action via appropriate handler
   * 3. Update ActionLogger outcome (success/failure)
   * 4. Emit 'action' event with (action, result)
   * 5. Return ActionResult
   *
   * @param action The autonomous action to execute
   * @param triggerEvent The detection event that triggered this action
   * @returns ActionResult with success status and optional error message
   */
  async execute(
    action: AutonomousAction,
    triggerEvent: DetectionEvent
  ): Promise<ActionResult> {
    // Step 1: Log action BEFORE execution
    const logEntry = this.config.actionLogger.logAction({
      projectId: this.config.projectId,
      observerId: this.config.observerId,
      action,
      triggerEvent,
    });

    // Step 2: Execute the action via appropriate handler
    let result: ActionResult;

    try {
      result = await this.executeHandler(action);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result = { success: false, error: errorMessage };
    }

    // Step 3: Update ActionLogger outcome
    if (result.success) {
      this.config.actionLogger.updateOutcome(logEntry.id, "success");
    } else {
      this.config.actionLogger.updateOutcome(
        logEntry.id,
        "failure",
        result.error
      );
    }

    // Step 4: Emit 'action' event
    this.emit("action", action, result);

    // Step 5: Return result
    return result;
  }

  /**
   * Execute multiple actions in sequence
   *
   * Continues executing actions even if one fails.
   * Each action is logged independently and emits its own event.
   *
   * @param actions Array of autonomous actions to execute
   * @param triggerEvent The detection event that triggered these actions
   * @returns Array of ActionResults in same order as actions
   */
  async executeAll(
    actions: AutonomousAction[],
    triggerEvent: DetectionEvent
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      const result = await this.execute(action, triggerEvent);
      results.push(result);
    }

    return results;
  }

  /**
   * Clean up resources and remove all event listeners
   */
  dispose(): void {
    this.removeAllListeners();
  }

  /**
   * Internal method to route action to appropriate handler
   *
   * @param action The autonomous action to execute
   * @returns ActionResult from the handler
   * @throws Error if action type is unknown
   */
  private async executeHandler(action: AutonomousAction): Promise<ActionResult> {
    switch (action.type) {
      case "prompt_agent":
        return handlePromptAgent(action, this.config.mcpClient);

      case "restart_agent":
        return handleRestartAgent(
          action,
          this.config.mcpClient,
          this.config.sandboxManager ?? null
        );

      case "reassign_task":
        return handleReassignTask(action, this.config.mcpClient);

      case "retry_task":
        return handleRetryTask(action, this.config.mcpClient);

      case "pause_agent":
        return handlePauseAgent(action, this.config.mcpClient);

      case "release_lock":
        return handleReleaseLock(action, this.config.mcpClient);

      case "update_task_status":
        return handleUpdateTaskStatus(action, this.config.mcpClient);

      case "save_checkpoint_and_pause":
        return handleSaveCheckpointAndPause(action, this.config.mcpClient);

      default:
        // Exhaustive check - TypeScript will error if new action types are added
        const exhaustiveCheck: never = action;
        throw new Error(`Unknown action type: ${(exhaustiveCheck as any).type}`);
    }
  }
}
