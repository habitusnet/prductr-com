import { AutonomousActionType } from "../types.js";

/**
 * Autonomy levels define the degree of autonomous action permitted
 *
 * - full_auto: All autonomous actions are permitted
 * - supervised: Restricted set of safe actions (prompt, retry, update)
 * - assisted: Minimal actions requiring high confidence (prompt, update)
 * - manual: No autonomous actions; all decisions require human approval
 */
export type AutonomyLevel = "full_auto" | "supervised" | "assisted" | "manual";

/**
 * Permission matrix defining which actions are allowed at each autonomy level
 */
const AUTONOMY_PERMISSIONS: Record<AutonomyLevel, Set<AutonomousActionType>> = {
  full_auto: new Set([
    "prompt_agent",
    "restart_agent",
    "reassign_task",
    "retry_task",
    "pause_agent",
    "release_lock",
    "update_task_status",
    "save_checkpoint_and_pause",
  ]),
  supervised: new Set([
    "prompt_agent",
    "retry_task",
    "update_task_status",
    "save_checkpoint_and_pause",
  ]),
  assisted: new Set(["prompt_agent", "update_task_status"]),
  manual: new Set(),
};

/**
 * Determines if a given autonomous action is permitted at the specified autonomy level
 *
 * @param level - The autonomy level to check
 * @param action - The autonomous action to verify
 * @returns true if the action is permitted, false otherwise
 *
 * @example
 * // Allow agent prompts in supervised mode
 * if (canActAutonomously('supervised', 'prompt_agent')) {
 *   await promptAgent(...);
 * }
 */
export function canActAutonomously(
  level: AutonomyLevel,
  action: AutonomousActionType,
): boolean {
  const allowedActions = AUTONOMY_PERMISSIONS[level];
  return allowedActions.has(action);
}
