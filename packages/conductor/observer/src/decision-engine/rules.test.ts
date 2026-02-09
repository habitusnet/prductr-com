import { describe, it, expect, beforeEach } from "vitest";
import { DecisionRules } from "./rules";
import { AgentStateTracker } from "./agent-state";
import { DEFAULT_THRESHOLDS } from "./thresholds";
import {
  StuckEvent,
  ErrorEvent,
  AuthRequiredEvent,
  TestFailureEvent,
  BuildFailureEvent,
  RateLimitedEvent,
  GitConflictEvent,
  CrashEvent,
  HeartbeatTimeoutEvent,
  ContextExhaustionEvent,
  AutonomousDecision,
  EscalateDecision,
} from "../types";
import { AutonomyLevel } from "./autonomy";

describe("DecisionRules", () => {
  let stateTracker: AgentStateTracker;
  let rules: DecisionRules;

  const createBaseEvent = (overrides: Record<string, unknown> = {}) => ({
    agentId: "agent-1",
    sandboxId: "sandbox-1",
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    stateTracker = new AgentStateTracker();
    rules = new DecisionRules(DEFAULT_THRESHOLDS, stateTracker, "full_auto");
  });

  describe("stuck event", () => {
    it("should return autonomous prompt_agent when attempts <= escalateAfterAttempts", () => {
      const event: StuckEvent = {
        type: "stuck",
        silentDurationMs: 60000,
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("prompt_agent");
      expect(decision.reason).toContain("stuck");
    });

    it("should increment stuck attempts before deciding", () => {
      const event: StuckEvent = {
        type: "stuck",
        silentDurationMs: 60000,
        ...createBaseEvent(),
      };

      rules.decide(event);
      const state = stateTracker.getState("agent-1");
      expect(state.stuckPromptAttempts).toBe(1);
    });

    it("should return autonomous prompt_agent on second attempt", () => {
      const event: StuckEvent = {
        type: "stuck",
        silentDurationMs: 60000,
        ...createBaseEvent(),
      };

      rules.decide(event);
      const decision2 = rules.decide(event);

      expect(decision2.action).toBe("autonomous");
      expect((decision2 as AutonomousDecision).actionType).toBe("prompt_agent");
    });

    it("should escalate when attempts exceed escalateAfterAttempts", () => {
      const event: StuckEvent = {
        type: "stuck",
        silentDurationMs: 60000,
        ...createBaseEvent(),
      };

      // Make escalateAfterAttempts attempts
      for (let i = 0; i < DEFAULT_THRESHOLDS.stuck.escalateAfterAttempts; i++) {
        rules.decide(event);
      }

      // Next attempt should escalate
      const decision = rules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("high");
      expect(decision.reason).toContain("stuck");
    });
  });

  describe("crash event", () => {
    it("should return autonomous restart_agent when restarts <= autoRestartMax and cooldown passed", () => {
      const event: CrashEvent = {
        type: "crash",
        exitCode: 1,
        ...createBaseEvent(),
      };

      // First crash - should allow restart
      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("restart_agent");
      expect(decision.reason).toContain("crash");
    });

    it("should record crash in state tracker", () => {
      const event: CrashEvent = {
        type: "crash",
        exitCode: 1,
        ...createBaseEvent(),
      };

      rules.decide(event);
      const state = stateTracker.getState("agent-1");

      expect(state.crashRestartCount).toBe(1);
      expect(state.lastCrashAt).toBeDefined();
    });

    it("should escalate when restarts exceed autoRestartMax", () => {
      const event: CrashEvent = {
        type: "crash",
        exitCode: 1,
        ...createBaseEvent(),
      };

      // Make autoRestartMax restarts
      for (let i = 0; i < DEFAULT_THRESHOLDS.agentCrash.autoRestartMax; i++) {
        rules.decide(event);
      }

      // Next restart should escalate
      const decision = rules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("high");
      expect(decision.reason).toContain("crash");
    });

    it("should escalate when cooldown has not elapsed", () => {
      const event: CrashEvent = {
        type: "crash",
        exitCode: 1,
        ...createBaseEvent(),
      };

      // Immediately create a crash with no cooldown passage
      rules.decide(event);

      // Record another crash immediately (before cooldown)
      const rules2 = new DecisionRules(
        DEFAULT_THRESHOLDS,
        stateTracker,
        "full_auto",
      );
      const decision = rules2.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("high");
    });
  });

  describe("auth_required event", () => {
    it("should always escalate with priority critical", () => {
      const event: AuthRequiredEvent = {
        type: "auth_required",
        provider: "github",
        authUrl: "https://github.com/login",
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("critical");
      expect(decision.reason).toContain("Authentication");
    });

    it("should escalate critical even in full_auto mode", () => {
      const event: AuthRequiredEvent = {
        type: "auth_required",
        provider: "oauth",
        ...createBaseEvent(),
      };

      const fullAutoRules = new DecisionRules(
        DEFAULT_THRESHOLDS,
        stateTracker,
        "full_auto",
      );
      const decision = fullAutoRules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("critical");
    });
  });

  describe("test_failure event", () => {
    it("should return autonomous retry_task when retries <= autoRetryMax", () => {
      const event: TestFailureEvent = {
        type: "test_failure",
        failedTests: 2,
        totalTests: 10,
        output: "Test output",
        ...createBaseEvent({ agentId: "agent-1" }),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("retry_task");
      expect(decision.reason).toContain("test");
    });

    it("should increment task retry count", () => {
      const event: TestFailureEvent = {
        type: "test_failure",
        failedTests: 1,
        output: "Failed",
        ...createBaseEvent(),
      };

      rules.decide(event);
      const state = stateTracker.getState("agent-1");

      // Test failure should use a generic task ID
      expect(state.taskRetryCounts.size).toBeGreaterThan(0);
    });

    it("should escalate when retries exceed autoRetryMax", () => {
      const event: TestFailureEvent = {
        type: "test_failure",
        failedTests: 1,
        output: "Failed",
        ...createBaseEvent(),
      };

      // Make autoRetryMax retries
      for (let i = 0; i < DEFAULT_THRESHOLDS.taskFailure.autoRetryMax; i++) {
        rules.decide(event);
      }

      // Next retry should escalate
      const decision = rules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("normal");
      expect(decision.reason).toContain("Test failures");
    });
  });

  describe("build_failure event", () => {
    it("should return autonomous prompt_agent", () => {
      const event: BuildFailureEvent = {
        type: "build_failure",
        output: "Build failed",
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("prompt_agent");
      expect(decision.reason).toContain("Build failure");
    });
  });

  describe("rate_limited event", () => {
    it("should return autonomous pause_agent when autoBackoff is true", () => {
      const event: RateLimitedEvent = {
        type: "rate_limited",
        provider: "github",
        retryAfterMs: 60000,
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("pause_agent");
      expect(decision.reason).toContain("Rate limit");
    });

    it("should escalate when autoBackoff is false", () => {
      const customThresholds = {
        ...DEFAULT_THRESHOLDS,
        rateLimit: { ...DEFAULT_THRESHOLDS.rateLimit, autoBackoff: false },
      };
      const customRules = new DecisionRules(
        customThresholds,
        stateTracker,
        "full_auto",
      );

      const event: RateLimitedEvent = {
        type: "rate_limited",
        provider: "api",
        ...createBaseEvent(),
      };

      const decision = customRules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("normal");
    });
  });

  describe("error event", () => {
    it("should escalate when severity is fatal", () => {
      const event: ErrorEvent = {
        type: "error",
        message: "Fatal error occurred",
        severity: "fatal",
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("critical");
      expect(decision.reason).toContain("Fatal error");
    });

    it("should return autonomous prompt_agent for non-fatal errors", () => {
      const event: ErrorEvent = {
        type: "error",
        message: "Some error",
        severity: "error",
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("prompt_agent");
    });

    it("should return autonomous prompt_agent for warning severity", () => {
      const event: ErrorEvent = {
        type: "error",
        message: "Warning message",
        severity: "warning",
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("prompt_agent");
    });
  });

  describe("git_conflict event", () => {
    it("should always escalate with priority normal", () => {
      const event: GitConflictEvent = {
        type: "git_conflict",
        files: ["src/file1.ts", "src/file2.ts"],
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("normal");
      expect(decision.reason).toContain("conflict");
    });
  });

  describe("heartbeat_timeout event", () => {
    it("should return autonomous prompt_agent when pingBeforeRestart is true", () => {
      const event: HeartbeatTimeoutEvent = {
        type: "heartbeat_timeout",
        lastHeartbeat: new Date(Date.now() - 3 * 60 * 1000),
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("prompt_agent");
      expect(decision.reason).toContain("Heartbeat timeout");
    });

    it("should return autonomous restart_agent when pingBeforeRestart is false", () => {
      const customThresholds = {
        ...DEFAULT_THRESHOLDS,
        heartbeat: {
          ...DEFAULT_THRESHOLDS.heartbeat,
          pingBeforeRestart: false,
        },
      };
      const customRules = new DecisionRules(
        customThresholds,
        stateTracker,
        "full_auto",
      );

      const event: HeartbeatTimeoutEvent = {
        type: "heartbeat_timeout",
        lastHeartbeat: new Date(Date.now() - 3 * 60 * 1000),
        ...createBaseEvent(),
      };

      const decision = customRules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("restart_agent");
    });
  });

  describe("autonomy level restrictions", () => {
    it("should convert autonomous action to escalation in manual mode", () => {
      const manualRules = new DecisionRules(
        DEFAULT_THRESHOLDS,
        stateTracker,
        "manual",
      );

      const event: StuckEvent = {
        type: "stuck",
        silentDurationMs: 60000,
        ...createBaseEvent(),
      };

      const decision = manualRules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("high");
    });

    it("should respect supervised mode restrictions", () => {
      const supervisedRules = new DecisionRules(
        DEFAULT_THRESHOLDS,
        stateTracker,
        "supervised",
      );

      // restart_agent is not allowed in supervised mode
      const event: CrashEvent = {
        type: "crash",
        exitCode: 1,
        ...createBaseEvent(),
      };

      const decision = supervisedRules.decide(event);

      expect(decision.action).toBe("escalate");
      expect((decision as EscalateDecision).priority).toBe("high");
    });

    it("should respect assisted mode restrictions", () => {
      const assistedRules = new DecisionRules(
        DEFAULT_THRESHOLDS,
        stateTracker,
        "assisted",
      );

      // retry_task is not allowed in assisted mode
      const event: TestFailureEvent = {
        type: "test_failure",
        failedTests: 1,
        output: "Failed",
        ...createBaseEvent(),
      };

      const decision = assistedRules.decide(event);

      expect(decision.action).toBe("escalate");
      // When autonomous action not allowed at this level, escalates with 'high' priority
      expect((decision as EscalateDecision).priority).toBe("high");
    });

    it("should allow prompt_agent in supervised mode", () => {
      const supervisedRules = new DecisionRules(
        DEFAULT_THRESHOLDS,
        stateTracker,
        "supervised",
      );

      const event: BuildFailureEvent = {
        type: "build_failure",
        output: "Failed",
        ...createBaseEvent(),
      };

      const decision = supervisedRules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("prompt_agent");
    });

    it("should allow retry_task in supervised mode", () => {
      const supervisedRules = new DecisionRules(
        DEFAULT_THRESHOLDS,
        stateTracker,
        "supervised",
      );

      const event: TestFailureEvent = {
        type: "test_failure",
        failedTests: 1,
        output: "Failed",
        ...createBaseEvent(),
      };

      const decision = supervisedRules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe("retry_task");
    });
  });

  describe("decision reasons", () => {
    it("should include descriptive reason in autonomous decisions", () => {
      const event: BuildFailureEvent = {
        type: "build_failure",
        output: "Build failed due to syntax error",
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.reason).toBeDefined();
      expect(decision.reason.length).toBeGreaterThan(0);
    });

    it("should include descriptive reason in escalation decisions", () => {
      const event: AuthRequiredEvent = {
        type: "auth_required",
        provider: "github",
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.reason).toBeDefined();
      expect(decision.reason.length).toBeGreaterThan(0);
    });
  });

  describe("context_exhaustion event", () => {
    it("should return save_checkpoint_and_pause action", () => {
      const event: ContextExhaustionEvent = {
        type: "context_exhaustion",
        tokenCount: 185000,
        tokenLimit: 200000,
        usagePercent: 92.5,
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.action).toBe("autonomous");
      expect((decision as AutonomousDecision).actionType).toBe(
        "save_checkpoint_and_pause",
      );
    });

    it("should include usage percentage in reason", () => {
      const event: ContextExhaustionEvent = {
        type: "context_exhaustion",
        tokenCount: 185000,
        tokenLimit: 200000,
        usagePercent: 92.5,
        ...createBaseEvent(),
      };

      const decision = rules.decide(event);

      expect(decision.reason).toContain("92.5%");
    });
  });

  describe("multiple agents", () => {
    it("should track state separately for different agents", () => {
      const stuck1: StuckEvent = {
        type: "stuck",
        silentDurationMs: 60000,
        ...createBaseEvent({ agentId: "agent-1" }),
      };

      const stuck2: StuckEvent = {
        type: "stuck",
        silentDurationMs: 60000,
        ...createBaseEvent({ agentId: "agent-2" }),
      };

      rules.decide(stuck1);
      rules.decide(stuck2);

      const state1 = stateTracker.getState("agent-1");
      const state2 = stateTracker.getState("agent-2");

      expect(state1.stuckPromptAttempts).toBe(1);
      expect(state2.stuckPromptAttempts).toBe(1);
    });
  });
});
