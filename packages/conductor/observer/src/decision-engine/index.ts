/**
 * Decision Engine - Autonomous decision-making system for the Observer Agent
 *
 * Provides classes and utilities for:
 * - Making autonomy decisions based on agent state and confidence metrics
 * - Tracking agent state and execution patterns
 * - Evaluating decision rules and thresholds
 * - Recording metrics for continuous improvement
 *
 * @module @conductor/observer/decision-engine
 */

// Classes
export { DecisionEngine } from "./decision-engine.js";
export { AgentStateTracker } from "./agent-state.js";
export { DecisionRules } from "./rules.js";
export { MetricsTracker } from "./metrics-tracker.js";

// Functions
export { DEFAULT_THRESHOLDS, mergeThresholds } from "./thresholds.js";
export { canActAutonomously } from "./autonomy.js";

// Types
export type { AutonomyLevel } from "./autonomy.js";
export type { AgentState } from "./agent-state.js";
export type {
  DecisionEngineEvents,
  DecisionEngineConfig,
  ProcessResult,
} from "./decision-engine.js";
export type {
  MetricRecord,
  EventStats,
  ThresholdSuggestion,
} from "./metrics-tracker.js";
