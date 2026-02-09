import { describe, it, expect } from "vitest";
import {
  VERSION,
  DecisionEngine,
  DEFAULT_THRESHOLDS,
  mergeThresholds,
  AgentStateTracker,
  DecisionRules,
  MetricsTracker,
  canActAutonomously,
  EscalationQueue,
  EscalationStore,
  ActionLogger,
  ActionExecutor,
  ObserverMcpClient,
} from "./index.js";
import type { AutonomyLevel } from "./index.js";

describe("@conductor/observer", () => {
  it("exports VERSION constant", () => {
    expect(VERSION).toBe("0.1.0");
  });

  describe("Decision Engine exports", () => {
    it("should export DecisionEngine", () => {
      expect(DecisionEngine).toBeDefined();
    });

    it("should export AgentStateTracker", () => {
      expect(AgentStateTracker).toBeDefined();
    });

    it("should export DecisionRules", () => {
      expect(DecisionRules).toBeDefined();
    });

    it("should export MetricsTracker", () => {
      expect(MetricsTracker).toBeDefined();
    });

    it("should export DEFAULT_THRESHOLDS", () => {
      expect(DEFAULT_THRESHOLDS).toBeDefined();
      expect(DEFAULT_THRESHOLDS.stuck).toBeDefined();
    });

    it("should export mergeThresholds function", () => {
      expect(mergeThresholds).toBeDefined();
      expect(typeof mergeThresholds).toBe("function");
    });

    it("should export canActAutonomously function", () => {
      expect(canActAutonomously).toBeDefined();
      expect(typeof canActAutonomously).toBe("function");
    });

    it("should export AutonomyLevel type", () => {
      // Type checks happen at compile time, but we verify it's used
      const autonomyLevel: AutonomyLevel = "full";
      expect(autonomyLevel).toBe("full");
    });
  });

  describe("Escalation Queue exports", () => {
    it("should export EscalationQueue", () => {
      expect(EscalationQueue).toBeDefined();
    });

    it("should export EscalationStore", () => {
      expect(EscalationStore).toBeDefined();
    });

    it("should export ActionLogger", () => {
      expect(ActionLogger).toBeDefined();
    });
  });

  describe("Action Executor exports", () => {
    it("should export ActionExecutor", () => {
      expect(ActionExecutor).toBeDefined();
    });

    it("should export ObserverMcpClient", () => {
      expect(ObserverMcpClient).toBeDefined();
    });
  });
});
