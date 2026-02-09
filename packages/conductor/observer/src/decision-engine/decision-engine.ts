import { EventEmitter } from "eventemitter3";
import { Decision, DetectionEvent, DetectionEventType } from "../types.js";
import { ThresholdConfig } from "../types.js";
import { DEFAULT_THRESHOLDS, mergeThresholds } from "./thresholds.js";
import { AgentStateTracker } from "./agent-state.js";
import { AutonomyLevel } from "./autonomy.js";
import { DecisionRules } from "./rules.js";
import {
  MetricsTracker,
  EventStats,
  ThresholdSuggestion,
} from "./metrics-tracker.js";

/**
 * Events emitted by the DecisionEngine
 */
export interface DecisionEngineEvents {
  decision: (event: DetectionEvent, decision: Decision) => void;
}

/**
 * Configuration for DecisionEngine
 */
export interface DecisionEngineConfig {
  thresholds?: Partial<ThresholdConfig>;
  autonomyLevel?: AutonomyLevel;
}

/**
 * Result of processing an event
 */
export interface ProcessResult {
  decision: Decision;
  metricId: string;
}

/**
 * DecisionEngine orchestrates all components of the decision-making system.
 *
 * Combines:
 * - ThresholdConfig: Configuration for decision thresholds
 * - AgentStateTracker: Tracks per-agent state (attempts, retries, crashes)
 * - DecisionRules: Implements decision logic for each event type
 * - MetricsTracker: Records decisions and outcomes for adaptive tuning
 * - AutonomyLevel: Restricts autonomous actions based on trust level
 *
 * The engine processes detection events and:
 * 1. Makes a decision (autonomous action or escalation)
 * 2. Records the decision for metrics tracking
 * 3. Emits a decision event
 * 4. Returns the decision and metric ID
 *
 * @example
 * const engine = new DecisionEngine({ autonomyLevel: 'supervised' });
 * const { decision, metricId } = engine.processEvent(detectionEvent);
 * // Later, record outcome
 * engine.recordOutcome(metricId, 'success');
 * engine.dispose();
 */
export class DecisionEngine extends EventEmitter<DecisionEngineEvents> {
  private thresholds: ThresholdConfig;
  private stateTracker: AgentStateTracker;
  private metricsTracker: MetricsTracker;
  private rules: DecisionRules;
  private disposed: boolean = false;

  constructor(config: DecisionEngineConfig) {
    super();

    // Merge threshold overrides with defaults
    this.thresholds = mergeThresholds(config.thresholds);

    // Create component instances
    this.stateTracker = new AgentStateTracker();
    this.metricsTracker = new MetricsTracker();

    // Create decision rules with merged thresholds, state tracker, and autonomy level
    const autonomyLevel: AutonomyLevel = config.autonomyLevel ?? "full_auto";
    this.rules = new DecisionRules(
      this.thresholds,
      this.stateTracker,
      autonomyLevel,
    );
  }

  /**
   * Process a detection event and return decision with metric ID
   *
   * @param event - The detection event to process
   * @returns Object containing the decision and a unique metric ID for tracking
   */
  processEvent(event: DetectionEvent): ProcessResult {
    // Get decision from rules engine
    const decision = this.rules.decide(event);

    // Record decision for metrics tracking
    const metricId = this.metricsTracker.recordDecision(event, decision);

    // Emit decision event if not disposed
    if (!this.disposed) {
      this.emit("decision", event, decision);
    }

    return { decision, metricId };
  }

  /**
   * Record the outcome of a decision
   *
   * @param metricId - The metric ID returned from processEvent
   * @param outcome - Whether the decision was successful or failed
   * @param details - Optional details about the outcome
   */
  recordOutcome(
    metricId: string,
    outcome: "success" | "failure",
    details?: string,
  ): void {
    this.metricsTracker.recordOutcome(metricId, outcome, details);
  }

  /**
   * Record a human override of a decision
   *
   * @param metricId - The metric ID returned from processEvent
   * @param overriddenBy - ID or name of the person who overrode
   * @param overrideAction - What action was taken instead
   * @param reason - Optional reason for the override
   */
  recordOverride(
    metricId: string,
    overriddenBy: string,
    overrideAction: string,
    reason?: string,
  ): void {
    this.metricsTracker.recordOverride(
      metricId,
      overriddenBy,
      overrideAction,
      reason,
    );
  }

  /**
   * Get aggregated statistics for a specific event type
   *
   * @param eventType - The type of event to get stats for
   * @returns Statistics including counts and success/failure rates
   */
  getStats(eventType: DetectionEventType): EventStats {
    return this.metricsTracker.getStats(eventType);
  }

  /**
   * Get threshold tuning suggestions based on current metrics
   *
   * Analyzes failure patterns and suggests threshold adjustments
   *
   * @returns Array of threshold suggestions with confidence levels
   */
  getThresholdSuggestions(): ThresholdSuggestion[] {
    return this.metricsTracker.getThresholdSuggestions();
  }

  /**
   * Clear all tracked state for a specific agent
   *
   * Resets stuck attempts, retry counts, and crash counts for the agent
   *
   * @param agentId - The ID of the agent to reset
   */
  resetAgentState(agentId: string): void {
    this.stateTracker.clearAgent(agentId);
  }

  /**
   * Cleanup and prepare for disposal
   *
   * Prevents further event emissions and cleans up listeners
   */
  dispose(): void {
    this.disposed = true;
    this.removeAllListeners();
  }
}
