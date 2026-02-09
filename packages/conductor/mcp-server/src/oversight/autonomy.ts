/**
 * Autonomy Level System
 *
 * Configurable autonomy for the oversight agent from full automation to manual control.
 */

export type AutonomyLevel = "full_auto" | "supervised" | "assisted" | "manual";

export interface AutonomyConfig {
  level: AutonomyLevel;
  projectId?: string; // If set, applies to specific project; otherwise global
  allowedActions?: string[]; // Whitelist of actions allowed at this level
  deniedActions?: string[]; // Blacklist of specific actions to deny
}

export interface Decision {
  id: string;
  type: string; // e.g., "reassign_task", "restart_agent", "pause_agent"
  reason: string;
  autonomyLevel: AutonomyLevel;
  projectId?: string;
  taskId?: string;
  agentId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  decidedAt?: Date;
  executedAt?: Date;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  approvedBy?: string; // userId
  result?: string;
}

/**
 * Check if an action is allowed at the given autonomy level.
 */
export function canExecuteAction(
  config: AutonomyConfig,
  actionType: string,
): boolean {
  const level = config.level;

  // Check explicit allow/deny lists first
  if (config.deniedActions?.includes(actionType)) {
    return false;
  }
  if (config.allowedActions?.includes(actionType)) {
    return true;
  }

  // Default action permissions by level
  switch (level) {
    case "full_auto":
      // Can execute everything except critical actions
      return !isCriticalAction(actionType);

    case "supervised":
      // Can execute routine actions, critical need approval
      return isRoutineAction(actionType);

    case "assisted":
      // Cannot execute, can only recommend
      return false;

    case "manual":
      // No autonomous execution
      return false;

    default:
      return false;
  }
}

/**
 * Check if action requires human approval at this autonomy level.
 */
export function requiresApproval(
  config: AutonomyConfig,
  actionType: string,
): boolean {
  const level = config.level;

  switch (level) {
    case "full_auto":
      // Critical actions need approval even in full auto
      return isCriticalAction(actionType);

    case "supervised":
      // Critical actions need approval, routine actions auto-execute but are logged
      return isCriticalAction(actionType);

    case "assisted":
      // Everything needs approval
      return true;

    case "manual":
      // Everything needs approval
      return true;

    default:
      return true;
  }
}

/**
 * Classify actions as critical (require human judgment).
 */
export function isCriticalAction(actionType: string): boolean {
  const criticalActions = [
    "delete_project",
    "delete_organization",
    "revoke_agent_access",
    "force_push",
    "destructive_git_operation",
    "escalate_external", // Escalating to external service/person
  ];

  return criticalActions.includes(actionType);
}

/**
 * Classify actions as routine (safe for automation).
 */
export function isRoutineAction(actionType: string): boolean {
  const routineActions = [
    "reassign_task",
    "retry_task",
    "restart_agent",
    "cleanup_locks",
    "prompt_agent",
    "update_status",
  ];

  return routineActions.includes(actionType);
}

/**
 * Get autonomy level from project settings.
 */
export function getAutonomyLevel(
  projectSettings: Record<string, unknown>,
): AutonomyLevel {
  const level = projectSettings["autonomy_level"] as AutonomyLevel | undefined;
  return level || "supervised"; // Default to supervised
}

/**
 * Create a decision record for audit trail.
 */
export function createDecision(
  actionType: string,
  reason: string,
  autonomyLevel: AutonomyLevel,
  metadata: Record<string, unknown> = {},
): Decision {
  return {
    id: crypto.randomUUID(),
    type: actionType,
    reason,
    autonomyLevel,
    metadata,
    createdAt: new Date(),
    status: requiresApproval(
      { level: autonomyLevel },
      actionType,
    )
      ? "pending"
      : "approved",
  };
}

/**
 * Get description of autonomy level for UI.
 */
export function getAutonomyDescription(level: AutonomyLevel): string {
  switch (level) {
    case "full_auto":
      return "Observer handles all routine decisions automatically. Critical actions require approval.";
    case "supervised":
      return "Observer executes routine actions and logs for review. Critical actions require approval.";
    case "assisted":
      return "Observer recommends actions but waits for human approval before executing.";
    case "manual":
      return "Observer monitors only. All actions require explicit human approval.";
  }
}

/**
 * Get recommended autonomy level based on project characteristics.
 */
export function recommendAutonomyLevel(project: {
  conflictStrategy?: string;
  budget?: { total?: number };
  isProduction?: boolean;
}): AutonomyLevel {
  // Production projects with high budget should default to assisted/manual
  if (project.isProduction || (project.budget?.total && project.budget.total > 1000)) {
    return "assisted";
  }

  // Aggressive conflict strategies (merge) benefit from supervision
  if (project.conflictStrategy === "merge") {
    return "supervised";
  }

  // Conservative conflict strategies (lock, review) can be more automated
  return "supervised";
}
