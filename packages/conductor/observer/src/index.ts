/**
 * @conductor/observer
 * Autonomous monitoring agent for Conductor E2B sandboxes
 */

export * from "./types.js";
export { RingBuffer } from "./utils/ring-buffer.js";
export { ConsoleWatcher } from "./console-watcher.js";
export type {
  ConsoleWatcherConfig,
  AgentConsoleState,
} from "./console-watcher.js";
export * from "./pattern-matcher/index.js";

// Decision Engine - consolidated exports
export {
  DecisionEngine,
  DEFAULT_THRESHOLDS,
  mergeThresholds,
  AgentStateTracker,
  DecisionRules,
  MetricsTracker,
  canActAutonomously,
} from "./decision-engine/index.js";
export type {
  AutonomyLevel,
  AgentState,
  DecisionEngineEvents,
  DecisionEngineConfig,
  ProcessResult,
  MetricRecord,
  EventStats,
  ThresholdSuggestion,
} from "./decision-engine/index.js";

// Escalation Queue - consolidated exports
export {
  EscalationQueue,
  EscalationStore,
  ActionLogger,
} from "./escalation-queue/index.js";
export type {
  EscalationQueueConfig,
  EscalationQueueEvents,
  CreateEscalationInput,
  UpdateEscalationInput,
  ListEscalationsOptions,
  StatusCounts,
  LogActionInput,
  ListActionsOptions,
} from "./escalation-queue/index.js";

// Action Executor - consolidated exports
export {
  ActionExecutor,
  ObserverMcpClient,
  handlePromptAgent,
  handleRestartAgent,
  handleReassignTask,
  handleRetryTask,
  handlePauseAgent,
  handleReleaseLock,
  handleUpdateTaskStatus,
} from "./action-executor/index.js";
export type { SandboxManagerLike } from "./action-executor/index.js";

export const VERSION = "0.1.0";
