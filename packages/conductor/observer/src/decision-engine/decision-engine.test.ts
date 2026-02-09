import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DecisionEngine } from "./decision-engine";
import {
  StuckEvent,
  CrashEvent,
  TestFailureEvent,
  BuildFailureEvent,
} from "../types.js";

describe("DecisionEngine", () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine({});
  });

  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create engine with default config", () => {
      const e = new DecisionEngine({});
      expect(e).toBeDefined();
      e.dispose();
    });

    it("should merge threshold overrides with defaults", () => {
      const customThresholds = {
        stuck: {
          promptAfterMs: 10 * 60 * 1000,
        },
      };
      const e = new DecisionEngine({ thresholds: customThresholds });
      expect(e).toBeDefined();
      e.dispose();
    });

    it("should use specified autonomy level", () => {
      const e = new DecisionEngine({ autonomyLevel: "supervised" });
      expect(e).toBeDefined();
      e.dispose();
    });

    it("should default to full_auto autonomy level", () => {
      const e = new DecisionEngine({});
      expect(e).toBeDefined();
      e.dispose();
    });
  });

  describe("processEvent", () => {
    it("should return decision and metricId", () => {
      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const result = engine.processEvent(event);

      expect(result).toHaveProperty("decision");
      expect(result).toHaveProperty("metricId");
      expect(typeof result.metricId).toBe("string");
      expect(result.metricId.length).toBeGreaterThan(0);
    });

    it("should return autonomous decision for build failure", () => {
      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const result = engine.processEvent(event);

      expect(result.decision.action).toBe("autonomous");
      expect(result.decision.actionType).toBe("prompt_agent");
    });

    it("should emit decision event when processing", () => {
      const listener = vi.fn();
      engine.on("decision", listener);

      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      engine.processEvent(event);

      expect(listener).toHaveBeenCalledOnce();
      const [emittedEvent, decision] = listener.mock.calls[0];
      expect(emittedEvent).toEqual(event);
      expect(decision.action).toBe("autonomous");
    });

    it("should escalate stuck events after threshold", () => {
      const event: StuckEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 30000,
      };

      // First attempt: autonomous prompt
      const result1 = engine.processEvent(event);
      expect(result1.decision.action).toBe("autonomous");

      // Second attempt: autonomous prompt
      const result2 = engine.processEvent(event);
      expect(result2.decision.action).toBe("autonomous");

      // Third attempt: escalate (exceeds default threshold of 2)
      const result3 = engine.processEvent(event);
      expect(result3.decision.action).toBe("escalate");
      expect(result3.decision.priority).toBe("high");
    });

    it("should handle crash with cooldown", () => {
      const event: CrashEvent = {
        type: "crash",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        exitCode: 1,
      };

      // First crash: should restart
      const result1 = engine.processEvent(event);
      expect(result1.decision.action).toBe("autonomous");
      expect(result1.decision.actionType).toBe("restart_agent");
    });

    it("should not emit event after dispose", () => {
      const listener = vi.fn();
      engine.on("decision", listener);
      engine.dispose();

      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      engine.processEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("recordOutcome", () => {
    it("should record success outcome for a metricId", () => {
      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const { metricId } = engine.processEvent(event);

      engine.recordOutcome(metricId, "success", "Fixed build issue");

      const stats = engine.getStats("build_failure");
      expect(stats.total).toBe(1);
    });

    it("should record failure outcome for a metricId", () => {
      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const { metricId } = engine.processEvent(event);

      engine.recordOutcome(metricId, "failure", "Still broken");

      const stats = engine.getStats("build_failure");
      expect(stats.total).toBe(1);
    });
  });

  describe("recordOverride", () => {
    it("should record human override", () => {
      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const { metricId } = engine.processEvent(event);

      engine.recordOverride(metricId, "human-1", "skip_rebuild", "Not needed");

      const stats = engine.getStats("build_failure");
      expect(stats.overrideRate).toBeGreaterThan(0);
    });
  });

  describe("getStats", () => {
    it("should return stats for event type", () => {
      const event1: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const event2: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-2",
        sandboxId: "sandbox-2",
        timestamp: new Date(),
        output: "build failed again",
      };

      engine.processEvent(event1);
      engine.processEvent(event2);

      const stats = engine.getStats("build_failure");

      expect(stats.total).toBe(2);
      expect(stats.autonomous).toBe(2);
      expect(stats.escalated).toBe(0);
    });

    it("should return zero stats for unknown event type", () => {
      const stats = engine.getStats("stuck");

      expect(stats.total).toBe(0);
      expect(stats.autonomous).toBe(0);
      expect(stats.escalated).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe("getThresholdSuggestions", () => {
    it("should return empty suggestions initially", () => {
      const suggestions = engine.getThresholdSuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    it("should return suggestions when thresholds have high failure rates", () => {
      // Create multiple test failures
      for (let i = 0; i < 15; i++) {
        const event: TestFailureEvent = {
          type: "test_failure",
          agentId: `agent-${i}`,
          sandboxId: `sandbox-${i}`,
          timestamp: new Date(),
          failedTests: 5,
          output: "tests failed",
        };

        const { metricId } = engine.processEvent(event);
        // Record all as failures
        engine.recordOutcome(metricId, "failure", "Tests still failing");
      }

      const suggestions = engine.getThresholdSuggestions();

      // Should have at least one suggestion for test_failure
      expect(suggestions.length).toBeGreaterThan(0);
      const testFailureSuggestion = suggestions.find(
        (s) => s.category === "taskFailure",
      );
      expect(testFailureSuggestion).toBeDefined();
      expect(testFailureSuggestion?.suggestion).toBe("decrease");
    });
  });

  describe("resetAgentState", () => {
    it("should clear state for specific agent", () => {
      const event: StuckEvent = {
        type: "stuck",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        silentDurationMs: 30000,
      };

      // First call to establish state
      engine.processEvent(event);

      // Reset agent state
      engine.resetAgentState("agent-1");

      // Next call should start fresh (attempt 1 again)
      const result = engine.processEvent(event);
      expect(result.decision.action).toBe("autonomous");
      expect(result.decision.actionType).toBe("prompt_agent");
    });
  });

  describe("dispose", () => {
    it("should prevent event emission after dispose", () => {
      const listener = vi.fn();
      engine.on("decision", listener);

      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      // Process before dispose
      engine.processEvent(event);
      expect(listener).toHaveBeenCalledOnce();

      // Dispose and reset mock
      engine.dispose();
      listener.mockClear();

      // Process after dispose
      engine.processEvent(event);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should remove all listeners on dispose", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      engine.on("decision", listener1);
      engine.on("decision", listener2);

      engine.dispose();

      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      engine.processEvent(event);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe("autonomy level restrictions", () => {
    it("should respect supervised autonomy level", () => {
      const supervisedEngine = new DecisionEngine({
        autonomyLevel: "supervised",
      });

      const event: CrashEvent = {
        type: "crash",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        exitCode: 1,
      };

      // Crash normally becomes restart_agent, but not allowed in supervised mode
      const result = supervisedEngine.processEvent(event);

      expect(result.decision.action).toBe("escalate");
      expect(result.decision.priority).toBe("high");

      supervisedEngine.dispose();
    });

    it("should allow prompt_agent in supervised mode", () => {
      const supervisedEngine = new DecisionEngine({
        autonomyLevel: "supervised",
      });

      const event: BuildFailureEvent = {
        type: "build_failure",
        agentId: "agent-1",
        sandboxId: "sandbox-1",
        timestamp: new Date(),
        output: "build failed",
      };

      const result = supervisedEngine.processEvent(event);

      // prompt_agent is allowed in supervised mode
      expect(result.decision.action).toBe("autonomous");
      expect(result.decision.actionType).toBe("prompt_agent");

      supervisedEngine.dispose();
    });
  });
});
