/**
 * Decision Engine
 *
 * Orchestrates autonomous decision-making based on pattern detection and autonomy levels.
 */

import type {
  AutonomyLevel,
  AutonomyConfig,
  Decision,
} from "./autonomy.js";
import {
  canExecuteAction,
  requiresApproval,
  createDecision,
  getAutonomyLevel,
} from "./autonomy.js";

export interface PatternMatch {
  type: string; // e.g., "stuck", "error", "auth_required"
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-1
  context: {
    taskId?: string;
    agentId?: string;
    projectId?: string;
    [key: string]: unknown;
  };
  suggestedAction: string;
  reason: string;
}

export interface ActionResult {
  success: boolean;
  decision: Decision;
  executed: boolean;
  error?: string;
}

/**
 * Decision Engine orchestrates pattern detection → decision → execution flow.
 */
export class DecisionEngine {
  private decisionLog: Decision[] = [];

  /**
   * Process a detected pattern and decide/execute appropriate action.
   */
  async processPattern(
    pattern: PatternMatch,
    autonomyConfig: AutonomyConfig,
  ): Promise<ActionResult> {
    // Create decision record
    const decision = createDecision(
      pattern.suggestedAction,
      pattern.reason,
      autonomyConfig.level,
      {
        pattern: pattern.type,
        severity: pattern.severity,
        confidence: pattern.confidence,
        context: pattern.context,
      },
    );

    decision.projectId = pattern.context.projectId;
    decision.taskId = pattern.context.taskId;
    decision.agentId = pattern.context.agentId;

    // Log decision for audit trail
    this.decisionLog.push(decision);

    // Check if we can execute at this autonomy level
    const canExecute = canExecuteAction(autonomyConfig, pattern.suggestedAction);
    const needsApproval = requiresApproval(
      autonomyConfig,
      pattern.suggestedAction,
    );

    if (!canExecute || needsApproval) {
      decision.status = "pending";
      return {
        success: false,
        decision,
        executed: false,
      };
    }

    // Execute action
    try {
      await this.executeAction(decision);
      decision.status = "executed";
      decision.executedAt = new Date();

      return {
        success: true,
        decision,
        executed: true,
      };
    } catch (error: any) {
      decision.status = "failed";
      decision.result = error.message;

      return {
        success: false,
        decision,
        executed: false,
        error: error.message,
      };
    }
  }

  /**
   * Approve a pending decision and execute it.
   */
  async approveDecision(decisionId: string, approvedBy: string): Promise<void> {
    const decision = this.decisionLog.find((d) => d.id === decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    if (decision.status !== "pending") {
      throw new Error(`Decision ${decisionId} is not pending (status: ${decision.status})`);
    }

    decision.status = "approved";
    decision.approvedBy = approvedBy;
    decision.decidedAt = new Date();

    // Execute the approved action
    try {
      await this.executeAction(decision);
      decision.status = "executed";
      decision.executedAt = new Date();
    } catch (error: any) {
      decision.status = "failed";
      decision.result = error.message;
      throw error;
    }
  }

  /**
   * Reject a pending decision.
   */
  rejectDecision(decisionId: string, reason: string): void {
    const decision = this.decisionLog.find((d) => d.id === decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    decision.status = "rejected";
    decision.result = reason;
    decision.decidedAt = new Date();
  }

  /**
   * Execute an action based on decision type.
   */
  private async executeAction(decision: Decision): Promise<void> {
    // In a real implementation, this would call actual state store methods
    // For now, we just simulate execution
    switch (decision.type) {
      case "reassign_task":
        await this.reassignTask(decision);
        break;

      case "restart_agent":
        await this.restartAgent(decision);
        break;

      case "pause_agent":
        await this.pauseAgent(decision);
        break;

      case "retry_task":
        await this.retryTask(decision);
        break;

      case "cleanup_locks":
        await this.cleanupLocks(decision);
        break;

      case "prompt_agent":
        await this.promptAgent(decision);
        break;

      case "update_status":
        await this.updateStatus(decision);
        break;

      default:
        throw new Error(`Unknown action type: ${decision.type}`);
    }

    decision.result = "Action executed successfully";
  }

  // Action implementations (stubs for now, would integrate with actual state store)

  private async reassignTask(decision: Decision): Promise<void> {
    // Would call task repository to reassign
    console.log(`[DecisionEngine] Reassigning task ${decision.taskId}`);
  }

  private async restartAgent(decision: Decision): Promise<void> {
    // Would call agent repository/E2B to restart
    console.log(`[DecisionEngine] Restarting agent ${decision.agentId}`);
  }

  private async pauseAgent(decision: Decision): Promise<void> {
    // Would call agent repository to pause
    console.log(`[DecisionEngine] Pausing agent ${decision.agentId}`);
  }

  private async retryTask(decision: Decision): Promise<void> {
    // Would reset task status and dependencies
    console.log(`[DecisionEngine] Retrying task ${decision.taskId}`);
  }

  private async cleanupLocks(decision: Decision): Promise<void> {
    // Would call file lock cleanup
    console.log(`[DecisionEngine] Cleaning up locks for project ${decision.projectId}`);
  }

  private async promptAgent(decision: Decision): Promise<void> {
    // Would send notification/prompt to agent
    console.log(`[DecisionEngine] Prompting agent ${decision.agentId}`);
  }

  private async updateStatus(decision: Decision): Promise<void> {
    // Would update entity status
    console.log(`[DecisionEngine] Updating status for ${decision.taskId || decision.agentId}`);
  }

  /**
   * Get decisions for audit/review.
   */
  getDecisions(filter?: {
    status?: Decision["status"];
    projectId?: string;
    agentId?: string;
  }): Decision[] {
    let results = this.decisionLog;

    if (filter?.status) {
      results = results.filter((d) => d.status === filter.status);
    }
    if (filter?.projectId) {
      results = results.filter((d) => d.projectId === filter.projectId);
    }
    if (filter?.agentId) {
      results = results.filter((d) => d.agentId === filter.agentId);
    }

    return results;
  }

  /**
   * Get pending decisions that need approval.
   */
  getPendingDecisions(projectId?: string): Decision[] {
    return this.getDecisions({ status: "pending", projectId });
  }

  /**
   * Clear old decisions from memory (for cleanup).
   */
  clearOldDecisions(olderThan: Date): void {
    this.decisionLog = this.decisionLog.filter(
      (d) => d.createdAt > olderThan,
    );
  }
}
