import { Decision, DetectionEvent, DetectionEventType } from "../types.js";
import { randomUUID } from "crypto";

/**
 * Record of a single decision and its lifecycle
 */
export interface MetricRecord {
  id: string;
  eventType: DetectionEventType;
  decision: "autonomous" | "escalated";
  actionType?: string; // only for autonomous
  outcome: "success" | "failure" | "pending" | "overridden";
  outcomeDetails?: string;
  humanOverride?: {
    overriddenBy: string;
    overrideAction: string;
    reason?: string;
  };
  timestamp: Date;
}

/**
 * Aggregated statistics for an event type
 */
export interface EventStats {
  total: number;
  autonomous: number;
  escalated: number;
  successRate: number; // successes / resolved autonomous (percentage)
  failureRate: number; // failures / resolved autonomous (percentage)
  overrideRate: number; // overrides / total (percentage)
}

/**
 * Suggestion for threshold tuning based on metrics
 */
export interface ThresholdSuggestion {
  category: string; // e.g., 'taskFailure', 'stuck', 'crash'
  field: string; // e.g., 'autoRetryMax', 'escalateAfterAttempts'
  currentImplied: string;
  suggestion: "increase" | "decrease";
  reason: string;
  confidence: number; // 0-1
}

/**
 * MetricsTracker records all decisions and their outcomes for adaptive threshold tuning.
 *
 * Tracks the complete lifecycle of each decision:
 * 1. Decision is recorded with event type and action
 * 2. Outcome is recorded (success/failure) with optional details
 * 3. Human overrides can be recorded, changing final outcome
 *
 * Provides aggregated statistics per event type and generates threshold tuning
 * suggestions based on failure patterns.
 */
export class MetricsTracker {
  private records: Map<string, MetricRecord> = new Map();

  /**
   * Record a decision, returns unique metric ID
   */
  recordDecision(event: DetectionEvent, decision: Decision): string {
    const id = randomUUID();

    const record: MetricRecord = {
      id,
      eventType: event.type,
      decision: decision.action === "autonomous" ? "autonomous" : "escalated",
      actionType:
        decision.action === "autonomous" ? decision.actionType : undefined,
      outcome: "pending",
      timestamp: new Date(),
    };

    this.records.set(id, record);
    return id;
  }

  /**
   * Get a specific record by ID
   */
  getRecord(id: string): MetricRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Update outcome after action is taken
   */
  recordOutcome(
    id: string,
    outcome: "success" | "failure",
    details?: string,
  ): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }

    record.outcome = outcome;
    if (details) {
      record.outcomeDetails = details;
    }
  }

  /**
   * Record when human overrides an autonomous decision
   */
  recordOverride(
    id: string,
    overriddenBy: string,
    overrideAction: string,
    reason?: string,
  ): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }

    record.outcome = "overridden";
    record.humanOverride = {
      overriddenBy,
      overrideAction,
      reason,
    };
  }

  /**
   * Get aggregated stats for an event type
   */
  getStats(eventType: DetectionEventType): EventStats {
    const matchingRecords = Array.from(this.records.values()).filter(
      (r) => r.eventType === eventType,
    );

    const total = matchingRecords.length;
    const autonomous = matchingRecords.filter(
      (r) => r.decision === "autonomous",
    ).length;
    const escalated = matchingRecords.filter(
      (r) => r.decision === "escalated",
    ).length;

    // Only count resolved autonomous decisions for rates
    const resolvedAutonomous = matchingRecords.filter(
      (r) => r.decision === "autonomous" && r.outcome !== "pending",
    );

    const successes = resolvedAutonomous.filter(
      (r) => r.outcome === "success",
    ).length;
    const failures = resolvedAutonomous.filter(
      (r) => r.outcome === "failure",
    ).length;
    const overrides = matchingRecords.filter(
      (r) => r.outcome === "overridden",
    ).length;

    const successRate =
      resolvedAutonomous.length > 0
        ? (successes / resolvedAutonomous.length) * 100
        : 0;

    const failureRate =
      resolvedAutonomous.length > 0
        ? (failures / resolvedAutonomous.length) * 100
        : 0;

    const overrideRate = total > 0 ? (overrides / total) * 100 : 0;

    return {
      total,
      autonomous,
      escalated,
      successRate,
      failureRate,
      overrideRate,
    };
  }

  /**
   * Get threshold tuning suggestions based on metrics
   *
   * Logic:
   * - Minimum sample size: 10 decisions before suggesting
   * - High failure threshold: 70%+ failures suggests decreasing auto actions
   * - Checks test_failure, stuck, and crash event types
   * - Confidence = min(sampleSize / 20, 1)
   */
  getThresholdSuggestions(): ThresholdSuggestion[] {
    const suggestions: ThresholdSuggestion[] = [];

    // Check task failures (test_failure)
    const testFailureStats = this.getStats("test_failure");
    if (
      testFailureStats.autonomous >= 10 &&
      testFailureStats.failureRate >= 70
    ) {
      suggestions.push({
        category: "taskFailure",
        field: "autoRetryMax",
        currentImplied: "current retry threshold",
        suggestion: "decrease",
        reason: `Test failures have ${testFailureStats.failureRate.toFixed(1)}% failure rate across ${testFailureStats.autonomous} autonomous actions. Consider lowering autoRetryMax to escalate earlier.`,
        confidence: Math.min(testFailureStats.autonomous / 20, 1),
      });
    }

    // Check stuck events
    const stuckStats = this.getStats("stuck");
    if (stuckStats.autonomous >= 10 && stuckStats.failureRate >= 70) {
      suggestions.push({
        category: "stuck",
        field: "escalateAfterAttempts",
        currentImplied: "current escalation threshold",
        suggestion: "decrease",
        reason: `Stuck prompts have ${stuckStats.failureRate.toFixed(1)}% failure rate across ${stuckStats.autonomous} autonomous actions. Consider lowering escalateAfterAttempts to escalate earlier.`,
        confidence: Math.min(stuckStats.autonomous / 20, 1),
      });
    }

    // Check crash events
    const crashStats = this.getStats("crash");
    if (crashStats.autonomous >= 10 && crashStats.failureRate >= 70) {
      suggestions.push({
        category: "crash",
        field: "autoRestartMax",
        currentImplied: "current restart limit",
        suggestion: "decrease",
        reason: `Crash restarts have ${crashStats.failureRate.toFixed(1)}% failure rate across ${crashStats.autonomous} autonomous actions. Consider lowering autoRestartMax to escalate earlier.`,
        confidence: Math.min(crashStats.autonomous / 20, 1),
      });
    }

    return suggestions;
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records.clear();
  }
}
