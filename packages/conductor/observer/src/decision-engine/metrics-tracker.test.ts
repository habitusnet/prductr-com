import { describe, it, expect, beforeEach } from "vitest";
import {
  MetricsTracker,
  MetricRecord,
  EventStats,
  ThresholdSuggestion,
} from "./metrics-tracker.js";
import { Decision, DetectionEvent } from "../types.js";

describe("MetricsTracker", () => {
  let tracker: MetricsTracker;

  beforeEach(() => {
    tracker = new MetricsTracker();
  });

  describe("recordDecision", () => {
    it("should record a decision and return a unique metric ID", () => {
      const event: DetectionEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 5000,
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Agent stuck",
      };

      const id = tracker.recordDecision(event, decision);

      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate unique IDs for multiple decisions", () => {
      const event: DetectionEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 5000,
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Agent stuck",
      };

      const id1 = tracker.recordDecision(event, decision);
      const id2 = tracker.recordDecision(event, decision);

      expect(id1).not.toBe(id2);
    });

    it("should record autonomous decisions with action type", () => {
      const event: DetectionEvent = {
        type: "crash",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        exitCode: 1,
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "restart_agent",
        reason: "Agent crashed",
      };

      const id = tracker.recordDecision(event, decision);
      const record = tracker.getRecord(id);

      expect(record).toBeDefined();
      expect(record?.decision).toBe("autonomous");
      expect(record?.actionType).toBe("restart_agent");
      expect(record?.outcome).toBe("pending");
    });

    it("should record escalate decisions without action type", () => {
      const event: DetectionEvent = {
        type: "auth_required",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        provider: "github",
      };

      const decision: Decision = {
        action: "escalate",
        priority: "critical",
        reason: "Authentication required",
      };

      const id = tracker.recordDecision(event, decision);
      const record = tracker.getRecord(id);

      expect(record).toBeDefined();
      expect(record?.decision).toBe("escalated");
      expect(record?.actionType).toBeUndefined();
      expect(record?.outcome).toBe("pending");
    });

    it("should store event type in the record", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying failed tests",
      };

      const id = tracker.recordDecision(event, decision);
      const record = tracker.getRecord(id);

      expect(record?.eventType).toBe("test_failure");
    });
  });

  describe("getRecord", () => {
    it("should return undefined for non-existent record", () => {
      const record = tracker.getRecord("non-existent-id");
      expect(record).toBeUndefined();
    });

    it("should return recorded metric with correct structure", () => {
      const event: DetectionEvent = {
        type: "error",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        message: "Runtime error",
        severity: "warning",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Non-fatal error",
      };

      const id = tracker.recordDecision(event, decision);
      const record = tracker.getRecord(id);

      expect(record).toEqual({
        id,
        eventType: "error",
        decision: "autonomous",
        actionType: "prompt_agent",
        outcome: "pending",
        outcomeDetails: undefined,
        humanOverride: undefined,
        timestamp: expect.any(Date),
      });
    });
  });

  describe("recordOutcome", () => {
    it("should update outcome to success", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying failed tests",
      };

      const id = tracker.recordDecision(event, decision);
      tracker.recordOutcome(id, "success");

      const record = tracker.getRecord(id);
      expect(record?.outcome).toBe("success");
    });

    it("should update outcome to failure", () => {
      const event: DetectionEvent = {
        type: "crash",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        exitCode: 1,
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "restart_agent",
        reason: "Agent crashed",
      };

      const id = tracker.recordDecision(event, decision);
      tracker.recordOutcome(id, "failure", "Agent crashed again immediately");

      const record = tracker.getRecord(id);
      expect(record?.outcome).toBe("failure");
      expect(record?.outcomeDetails).toBe("Agent crashed again immediately");
    });

    it("should store outcome details when provided", () => {
      const event: DetectionEvent = {
        type: "error",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        message: "Error",
        severity: "error",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Error occurred",
      };

      const id = tracker.recordDecision(event, decision);
      tracker.recordOutcome(id, "success", "Agent recovered and continued");

      const record = tracker.getRecord(id);
      expect(record?.outcomeDetails).toBe("Agent recovered and continued");
    });

    it("should not modify non-existent records", () => {
      tracker.recordOutcome("non-existent-id", "success");
      const record = tracker.getRecord("non-existent-id");
      expect(record).toBeUndefined();
    });
  });

  describe("recordOverride", () => {
    it("should record human override on a decision", () => {
      const event: DetectionEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 5000,
      };

      const decision: Decision = {
        action: "escalate",
        priority: "normal",
        reason: "Agent stuck",
      };

      const id = tracker.recordDecision(event, decision);
      tracker.recordOverride(
        id,
        "user-123",
        "force_restart",
        "Override needed immediately",
      );

      const record = tracker.getRecord(id);
      expect(record?.outcome).toBe("overridden");
      expect(record?.humanOverride).toEqual({
        overriddenBy: "user-123",
        overrideAction: "force_restart",
        reason: "Override needed immediately",
      });
    });

    it("should record override without reason", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying failed tests",
      };

      const id = tracker.recordDecision(event, decision);
      tracker.recordOverride(id, "user-456", "skip_task");

      const record = tracker.getRecord(id);
      expect(record?.outcome).toBe("overridden");
      expect(record?.humanOverride?.reason).toBeUndefined();
    });

    it("should not modify non-existent records", () => {
      tracker.recordOverride("non-existent-id", "user-123", "restart");
      const record = tracker.getRecord("non-existent-id");
      expect(record).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should return initial stats with zero values for new event type", () => {
      const stats = tracker.getStats("stuck");

      expect(stats).toEqual({
        total: 0,
        autonomous: 0,
        escalated: 0,
        successRate: 0,
        failureRate: 0,
        overrideRate: 0,
      });
    });

    it("should count autonomous and escalated decisions correctly", () => {
      const stuckEvent: DetectionEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 5000,
      };

      const autonomousDecision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Stuck",
      };

      const escalateDecision: Decision = {
        action: "escalate",
        priority: "high",
        reason: "Stuck after attempts",
      };

      tracker.recordDecision(stuckEvent, autonomousDecision);
      tracker.recordDecision(stuckEvent, escalateDecision);
      tracker.recordDecision(stuckEvent, autonomousDecision);

      const stats = tracker.getStats("stuck");

      expect(stats.total).toBe(3);
      expect(stats.autonomous).toBe(2);
      expect(stats.escalated).toBe(1);
    });

    it("should calculate success rate for autonomous decisions", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      const id1 = tracker.recordDecision(event, decision);
      const id2 = tracker.recordDecision(event, decision);
      const id3 = tracker.recordDecision(event, decision);

      tracker.recordOutcome(id1, "success");
      tracker.recordOutcome(id2, "success");
      tracker.recordOutcome(id3, "failure");

      const stats = tracker.getStats("test_failure");

      // 2 successes out of 3 autonomous = 66.67%
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });

    it("should calculate failure rate for autonomous decisions", () => {
      const event: DetectionEvent = {
        type: "crash",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        exitCode: 1,
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "restart_agent",
        reason: "Crashed",
      };

      const id1 = tracker.recordDecision(event, decision);
      const id2 = tracker.recordDecision(event, decision);

      tracker.recordOutcome(id1, "failure");
      tracker.recordOutcome(id2, "success");

      const stats = tracker.getStats("crash");

      // 1 failure out of 2 autonomous = 50%
      expect(stats.failureRate).toBeCloseTo(50, 1);
    });

    it("should calculate override rate correctly", () => {
      const event: DetectionEvent = {
        type: "error",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        message: "Error",
        severity: "error",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Error",
      };

      const id1 = tracker.recordDecision(event, decision);
      const id2 = tracker.recordDecision(event, decision);
      const id3 = tracker.recordDecision(event, decision);
      const id4 = tracker.recordDecision(event, decision);

      tracker.recordOverride(id1, "user-1", "action-1");
      tracker.recordOverride(id2, "user-1", "action-2");

      const stats = tracker.getStats("error");

      // 2 overrides out of 4 total = 50%
      expect(stats.overrideRate).toBeCloseTo(50, 1);
    });

    it("should only count resolved outcomes when calculating rates", () => {
      const event: DetectionEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Build failed",
      };

      const id1 = tracker.recordDecision(event, decision);
      const id2 = tracker.recordDecision(event, decision);
      const id3 = tracker.recordDecision(event, decision);

      tracker.recordOutcome(id1, "success");
      // id2 left as pending
      tracker.recordOutcome(id3, "failure");

      const stats = tracker.getStats("build_failure");

      expect(stats.total).toBe(3);
      expect(stats.autonomous).toBe(3);
      // Rate should be calculated on 2 resolved decisions
      expect(stats.successRate).toBeCloseTo(50, 1);
      expect(stats.failureRate).toBeCloseTo(50, 1);
    });

    it("should handle different event types separately", () => {
      const stuckEvent: DetectionEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 5000,
      };

      const crashEvent: DetectionEvent = {
        type: "crash",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        exitCode: 1,
      };

      const autonomousDecision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Event",
      };

      tracker.recordDecision(stuckEvent, autonomousDecision);
      tracker.recordDecision(crashEvent, autonomousDecision);

      const stuckStats = tracker.getStats("stuck");
      const crashStats = tracker.getStats("crash");

      expect(stuckStats.total).toBe(1);
      expect(crashStats.total).toBe(1);
    });
  });

  describe("getThresholdSuggestions", () => {
    it("should return empty array if insufficient data", () => {
      const suggestions = tracker.getThresholdSuggestions();
      expect(suggestions).toEqual([]);
    });

    it("should return empty array if less than 10 decisions", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      for (let i = 0; i < 9; i++) {
        tracker.recordDecision(event, decision);
      }

      const suggestions = tracker.getThresholdSuggestions();
      expect(suggestions).toEqual([]);
    });

    it("should suggest decreasing threshold when failure rate is high (>70%)", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      // Create 10 decisions: 8 failures, 2 successes = 80% failure rate
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(tracker.recordDecision(event, decision));
      }

      for (let i = 0; i < 8; i++) {
        tracker.recordOutcome(ids[i], "failure");
      }
      for (let i = 8; i < 10; i++) {
        tracker.recordOutcome(ids[i], "success");
      }

      const suggestions = tracker.getThresholdSuggestions();

      const taskFailureSuggestion = suggestions.find(
        (s) => s.category === "taskFailure",
      );
      expect(taskFailureSuggestion).toBeDefined();
      expect(taskFailureSuggestion?.suggestion).toBe("decrease");
      expect(taskFailureSuggestion?.field).toBe("autoRetryMax");
    });

    it("should suggest decreasing threshold for stuck events with high failure rate", () => {
      const event: DetectionEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 5000,
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Stuck",
      };

      // Create 10 decisions: 8 failures, 2 successes = 80% failure rate
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(tracker.recordDecision(event, decision));
      }

      for (let i = 0; i < 8; i++) {
        tracker.recordOutcome(ids[i], "failure");
      }
      for (let i = 8; i < 10; i++) {
        tracker.recordOutcome(ids[i], "success");
      }

      const suggestions = tracker.getThresholdSuggestions();

      const stuckSuggestion = suggestions.find((s) => s.category === "stuck");
      expect(stuckSuggestion).toBeDefined();
      expect(stuckSuggestion?.suggestion).toBe("decrease");
      expect(stuckSuggestion?.field).toBe("escalateAfterAttempts");
    });

    it("should suggest decreasing threshold for crash events with high failure rate", () => {
      const event: DetectionEvent = {
        type: "crash",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        exitCode: 1,
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "restart_agent",
        reason: "Crashed",
      };

      // Create 10 decisions: 7 failures, 3 successes = 70% failure rate (at threshold)
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(tracker.recordDecision(event, decision));
      }

      for (let i = 0; i < 7; i++) {
        tracker.recordOutcome(ids[i], "failure");
      }
      for (let i = 7; i < 10; i++) {
        tracker.recordOutcome(ids[i], "success");
      }

      const suggestions = tracker.getThresholdSuggestions();

      const crashSuggestion = suggestions.find((s) => s.category === "crash");
      expect(crashSuggestion).toBeDefined();
      expect(crashSuggestion?.suggestion).toBe("decrease");
      expect(crashSuggestion?.field).toBe("autoRestartMax");
    });

    it("should not suggest for event types with low failure rate", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      // Create 10 decisions: 2 failures, 8 successes = 20% failure rate
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(tracker.recordDecision(event, decision));
      }

      for (let i = 0; i < 2; i++) {
        tracker.recordOutcome(ids[i], "failure");
      }
      for (let i = 2; i < 10; i++) {
        tracker.recordOutcome(ids[i], "success");
      }

      const suggestions = tracker.getThresholdSuggestions();

      const taskFailureSuggestion = suggestions.find(
        (s) => s.category === "taskFailure",
      );
      expect(taskFailureSuggestion).toBeUndefined();
    });

    it("should calculate confidence correctly", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      // Create exactly 10 decisions: 8 failures, 2 successes
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(tracker.recordDecision(event, decision));
      }

      for (let i = 0; i < 8; i++) {
        tracker.recordOutcome(ids[i], "failure");
      }
      for (let i = 8; i < 10; i++) {
        tracker.recordOutcome(ids[i], "success");
      }

      const suggestions = tracker.getThresholdSuggestions();
      const suggestion = suggestions[0];

      // confidence = min(10 / 20, 1) = 0.5
      expect(suggestion.confidence).toBe(0.5);
    });

    it("should cap confidence at 1", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      // Create 30 decisions with high failure rate
      const ids: string[] = [];
      for (let i = 0; i < 30; i++) {
        ids.push(tracker.recordDecision(event, decision));
      }

      for (let i = 0; i < 25; i++) {
        tracker.recordOutcome(ids[i], "failure");
      }
      for (let i = 25; i < 30; i++) {
        tracker.recordOutcome(ids[i], "success");
      }

      const suggestions = tracker.getThresholdSuggestions();
      const suggestion = suggestions[0];

      // confidence = min(30 / 20, 1) = 1
      expect(suggestion.confidence).toBe(1);
    });

    it("should include meaningful reason in suggestion", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(tracker.recordDecision(event, decision));
      }

      for (let i = 0; i < 8; i++) {
        tracker.recordOutcome(ids[i], "failure");
      }
      for (let i = 8; i < 10; i++) {
        tracker.recordOutcome(ids[i], "success");
      }

      const suggestions = tracker.getThresholdSuggestions();
      const suggestion = suggestions[0];

      expect(suggestion.reason.length).toBeGreaterThan(0);
      expect(suggestion.reason).toMatch(/80/); // Should mention the 80% failure rate
    });
  });

  describe("clear", () => {
    it("should clear all records", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      const id = tracker.recordDecision(event, decision);
      expect(tracker.getRecord(id)).toBeDefined();

      tracker.clear();

      expect(tracker.getRecord(id)).toBeUndefined();
      expect(tracker.getStats("test_failure")).toEqual({
        total: 0,
        autonomous: 0,
        escalated: 0,
        successRate: 0,
        failureRate: 0,
        overrideRate: 0,
      });
    });

    it("should allow recording after clear", () => {
      const event: DetectionEvent = {
        type: "error",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        message: "Error",
        severity: "error",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Error",
      };

      const id1 = tracker.recordDecision(event, decision);
      tracker.clear();
      const id2 = tracker.recordDecision(event, decision);

      expect(tracker.getRecord(id1)).toBeUndefined();
      expect(tracker.getRecord(id2)).toBeDefined();
    });
  });

  describe("integration scenarios", () => {
    it("should track complete lifecycle: record -> outcome -> override", () => {
      const event: DetectionEvent = {
        type: "test_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        failedTests: 5,
        output: "test output",
      };

      const decision: Decision = {
        action: "autonomous",
        actionType: "retry_task",
        reason: "Retrying",
      };

      const id = tracker.recordDecision(event, decision);
      let record = tracker.getRecord(id);
      expect(record?.outcome).toBe("pending");

      tracker.recordOutcome(id, "failure", "Still failing");
      record = tracker.getRecord(id);
      expect(record?.outcome).toBe("failure");

      tracker.recordOverride(id, "user-1", "skip_tests", "Skip tests for now");
      record = tracker.getRecord(id);
      expect(record?.outcome).toBe("overridden");
      expect(record?.humanOverride?.reason).toBe("Skip tests for now");
    });

    it("should provide accurate stats after mixed outcomes", () => {
      const stuckEvent: DetectionEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 5000,
      };

      const autonomousDecision: Decision = {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: "Stuck",
      };

      const escalateDecision: Decision = {
        action: "escalate",
        priority: "high",
        reason: "Stuck after attempts",
      };

      // Record mixed decisions
      const id1 = tracker.recordDecision(stuckEvent, autonomousDecision);
      const id2 = tracker.recordDecision(stuckEvent, escalateDecision);
      const id3 = tracker.recordDecision(stuckEvent, autonomousDecision);
      const id4 = tracker.recordDecision(stuckEvent, autonomousDecision);

      // Set outcomes
      tracker.recordOutcome(id1, "success");
      tracker.recordOutcome(id3, "failure");
      tracker.recordOutcome(id4, "success");

      // Override one
      tracker.recordOverride(id2, "user-1", "action");

      const stats = tracker.getStats("stuck");

      expect(stats.total).toBe(4);
      expect(stats.autonomous).toBe(3);
      expect(stats.escalated).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1); // 2 out of 3 autonomous
      expect(stats.failureRate).toBeCloseTo(33.33, 1); // 1 out of 3 autonomous
      expect(stats.overrideRate).toBe(25); // 1 out of 4 total
    });
  });
});
