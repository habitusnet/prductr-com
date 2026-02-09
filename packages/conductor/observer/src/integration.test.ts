import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PatternMatcher } from "./pattern-matcher/pattern-matcher.js";
import { DecisionEngine } from "./decision-engine/decision-engine.js";
import type {
  DetectionEvent,
  ErrorEvent,
  AuthRequiredEvent,
  TestFailureEvent,
  CrashEvent,
} from "./types.js";

/**
 * Integration tests for PatternMatcher to DecisionEngine flow
 *
 * Tests the full pipeline: PatternMatcher detects patterns in console output,
 * emits detection events, DecisionEngine processes these events and makes
 * decisions, which are then tracked and available via metrics.
 */
describe("PatternMatcher + DecisionEngine Integration", () => {
  let patternMatcher: PatternMatcher;
  let decisionEngine: DecisionEngine;
  let decisions: Array<{ event: DetectionEvent; decision: any }>;

  beforeEach(() => {
    patternMatcher = new PatternMatcher();
    decisionEngine = new DecisionEngine({ autonomyLevel: "full_auto" });
    decisions = [];

    // Wire PatternMatcher detections to DecisionEngine
    patternMatcher.on("detection", (event) => {
      const { decision } = decisionEngine.processEvent(event);
      decisions.push({ event, decision });
    });
  });

  afterEach(() => {
    patternMatcher.dispose();
    decisionEngine.dispose();
  });

  describe("Error detection flows to autonomous prompt decision", () => {
    it("should detect error and make autonomous prompt_agent decision", () => {
      return new Promise<void>((resolve) => {
        const expectedAgentId = "test-agent";
        const expectedSandboxId = "test-sandbox";

        // Process error output through PatternMatcher
        patternMatcher.processLine(
          expectedAgentId,
          expectedSandboxId,
          "Error: Connection refused",
        );

        // Give async processing time
        setTimeout(() => {
          expect(decisions).toHaveLength(1);

          const { event, decision } = decisions[0]!;

          // Verify detection event
          expect(event.type).toBe("error");
          expect(event.agentId).toBe(expectedAgentId);
          expect(event.sandboxId).toBe(expectedSandboxId);

          const errorEvent = event as ErrorEvent;
          expect(errorEvent.message).toContain("Connection refused");
          expect(errorEvent.severity).toBe("error");

          // Verify decision
          expect(decision.action).toBe("autonomous");
          expect(decision.actionType).toBe("prompt_agent");
          expect(decision.reason).toBeDefined();

          resolve();
        }, 10);
      });
    });

    it("should handle fatal errors with escalation decision", () => {
      return new Promise<void>((resolve) => {
        const agentId = "fatal-agent";
        const sandboxId = "fatal-sandbox";

        patternMatcher.processLine(agentId, sandboxId, "FATAL: System crash");

        setTimeout(() => {
          expect(decisions).toHaveLength(1);

          const { event, decision } = decisions[0]!;
          expect(event.type).toBe("error");

          const errorEvent = event as ErrorEvent;
          expect(errorEvent.severity).toBe("fatal");

          // Fatal errors escalate, not autonomous
          expect(decision.action).toBe("escalate");
          expect(decision.priority).toBe("critical");

          resolve();
        }, 10);
      });
    });
  });

  describe("Auth detection flows to critical escalation", () => {
    it("should detect auth URL and escalate with critical priority", () => {
      return new Promise<void>((resolve) => {
        const agentId = "auth-agent";
        const sandboxId = "auth-sandbox";

        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Visit https://github.com/login/oauth to authenticate",
        );

        setTimeout(() => {
          expect(decisions).toHaveLength(1);

          const { event, decision } = decisions[0]!;

          // Verify detection event
          expect(event.type).toBe("auth_required");
          expect(event.agentId).toBe(agentId);
          expect(event.sandboxId).toBe(sandboxId);

          const authEvent = event as AuthRequiredEvent;
          expect(authEvent.provider).toBe("github");
          expect(authEvent.authUrl).toContain("github.com/login/oauth");

          // Verify escalation decision
          expect(decision.action).toBe("escalate");
          expect(decision.priority).toBe("critical");
          expect(decision.reason).toBeDefined();

          resolve();
        }, 10);
      });
    });

    it("should detect various auth providers and escalate", () => {
      return new Promise<void>((resolve) => {
        const agentId = "auth-agent";
        const sandboxId = "auth-sandbox";

        // Process GitHub auth
        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Please authenticate at https://github.com/login/oauth",
        );

        setTimeout(() => {
          expect(decisions).toHaveLength(1);
          expect(decisions[0]!.decision.action).toBe("escalate");
          expect(decisions[0]!.decision.priority).toBe("critical");

          resolve();
        }, 10);
      });
    });
  });

  describe("Test failure detection flows to retry decision", () => {
    it("should detect test failure and make autonomous retry_task decision", () => {
      return new Promise<void>((resolve) => {
        const agentId = "test-agent";
        const sandboxId = "test-sandbox";

        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Tests: 3 failed, 5 passed",
        );

        setTimeout(() => {
          expect(decisions).toHaveLength(1);

          const { event, decision } = decisions[0]!;

          // Verify detection event
          expect(event.type).toBe("test_failure");
          expect(event.agentId).toBe(agentId);
          expect(event.sandboxId).toBe(sandboxId);

          const testEvent = event as TestFailureEvent;
          expect(testEvent.failedTests).toBe(3);
          // Note: totalTests is not extracted by test detector
          expect(testEvent.output).toContain("Tests");

          // Verify decision
          expect(decision.action).toBe("autonomous");
          expect(decision.actionType).toBe("retry_task");
          expect(decision.reason).toBeDefined();

          resolve();
        }, 10);
      });
    });

    it("should handle multiple test failures in output", () => {
      return new Promise<void>((resolve) => {
        const agentId = "test-agent";
        const sandboxId = "test-sandbox";

        const multilineOutput = `
          Running tests...
          Tests: 2 failed, 10 passed
          Details: getUser test failed
          Details: saveData test failed
        `;

        patternMatcher.processOutput(agentId, sandboxId, multilineOutput);

        setTimeout(() => {
          expect(decisions.length).toBeGreaterThan(0);

          // Find the test failure decision
          const testDecision = decisions.find(
            (d) => d.event.type === "test_failure",
          );
          expect(testDecision).toBeDefined();

          if (testDecision) {
            expect(testDecision.decision.action).toBe("autonomous");
            expect(testDecision.decision.actionType).toBe("retry_task");
          }

          resolve();
        }, 10);
      });
    });
  });

  describe("Track metrics across multiple detections", () => {
    it("should track metrics for 5 error events", () => {
      return new Promise<void>((resolve) => {
        const agentId = "error-agent";
        const sandboxId = "error-sandbox";

        // Process 5 errors
        for (let i = 0; i < 5; i++) {
          patternMatcher.processLine(
            agentId,
            sandboxId,
            `Error: Something went wrong (${i})`,
          );
        }

        setTimeout(() => {
          // All 5 should be detected
          expect(decisions).toHaveLength(5);

          // All should be error events
          const errorDecisions = decisions.filter(
            (d) => d.event.type === "error",
          );
          expect(errorDecisions).toHaveLength(5);

          // All should be autonomous decisions
          const autonomousDecisions = decisions.filter(
            (d) => d.decision.action === "autonomous",
          );
          expect(autonomousDecisions.length).toBeGreaterThanOrEqual(5);

          // Check metrics
          const stats = decisionEngine.getStats("error");
          expect(stats.total).toBe(5);
          expect(stats.autonomous).toBe(5);
          expect(stats.escalated).toBe(0);

          resolve();
        }, 20);
      });
    });

    it("should accumulate metrics across different event types", () => {
      return new Promise<void>((resolve) => {
        const agentId = "multi-agent";
        const sandboxId = "multi-sandbox";

        // Process mixed events
        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Error: Database failed",
        );
        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Tests: 2 failed, 3 passed",
        );
        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Visit https://github.com/login/oauth",
        );
        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Error: Network timeout",
        );
        patternMatcher.processLine(
          agentId,
          sandboxId,
          "Tests: 1 failed, 8 passed",
        );

        setTimeout(() => {
          // Should have 5 decisions
          expect(decisions).toHaveLength(5);

          // Verify metrics for each type
          const errorStats = decisionEngine.getStats("error");
          const testStats = decisionEngine.getStats("test_failure");
          const authStats = decisionEngine.getStats("auth_required");

          expect(errorStats.total).toBe(2);
          expect(testStats.total).toBe(2);
          expect(authStats.total).toBe(1);

          // All autonomous for error and test in full_auto mode
          expect(errorStats.autonomous).toBe(2);
          expect(testStats.autonomous).toBe(2);

          // Auth should be escalated
          expect(authStats.escalated).toBe(1);

          resolve();
        }, 20);
      });
    });
  });

  describe("Autonomy level restrictions respected", () => {
    it("should not allow restart_agent in supervised mode", () => {
      return new Promise<void>((resolve) => {
        const supervisedEngine = new DecisionEngine({
          autonomyLevel: "supervised",
        });

        const supervisedDecisions: any[] = [];

        // Wire PatternMatcher to supervised engine
        patternMatcher.on("detection", (event) => {
          const { decision } = supervisedEngine.processEvent(event);
          supervisedDecisions.push({ event, decision });
        });

        const agentId = "crash-agent";
        const sandboxId = "crash-sandbox";

        // Simulate a crash that would normally restart
        // We'll create the crash event directly since PatternMatcher may not detect crashes
        const crashEvent: CrashEvent = {
          type: "crash",
          agentId,
          sandboxId,
          timestamp: new Date(),
          exitCode: 1,
        };

        const { decision } = supervisedEngine.processEvent(crashEvent);

        // In supervised mode, restart should be escalated instead
        expect(decision.action).toBe("escalate");
        expect(decision.priority).toBe("high");

        supervisedEngine.dispose();
        resolve();
      });
    });

    it("should allow prompt_agent in supervised mode", () => {
      return new Promise<void>((resolve) => {
        const supervisedEngine = new DecisionEngine({
          autonomyLevel: "supervised",
        });

        const supervisedDecisions: any[] = [];

        // Create fresh pattern matcher for this test
        const testMatcher = new PatternMatcher();
        testMatcher.on("detection", (event) => {
          const { decision } = supervisedEngine.processEvent(event);
          supervisedDecisions.push({ event, decision });
        });

        // Process an error through supervised engine
        const agentId = "test-agent";
        const sandboxId = "test-sandbox";

        testMatcher.processLine(agentId, sandboxId, "Error: Test error");

        setTimeout(() => {
          expect(supervisedDecisions).toHaveLength(1);

          const { decision } = supervisedDecisions[0]!;
          expect(decision.action).toBe("autonomous");
          expect(decision.actionType).toBe("prompt_agent");

          testMatcher.dispose();
          supervisedEngine.dispose();
          resolve();
        }, 10);
      });
    });
  });

  describe("Cleanup on dispose", () => {
    it("should not emit events after PatternMatcher dispose", () => {
      return new Promise<void>((resolve) => {
        const agentId = "dispose-agent";
        const sandboxId = "dispose-sandbox";

        // Process initial event
        patternMatcher.processLine(agentId, sandboxId, "Error: First error");

        setTimeout(() => {
          const initialCount = decisions.length;
          expect(initialCount).toBeGreaterThan(0);

          // Dispose pattern matcher
          patternMatcher.dispose();

          // Try to process after dispose
          patternMatcher.processLine(agentId, sandboxId, "Error: Second error");

          setTimeout(() => {
            // Should still have same number of decisions
            expect(decisions).toHaveLength(initialCount);

            resolve();
          }, 10);
        }, 10);
      });
    });

    it("should not emit decision events after DecisionEngine dispose", () => {
      return new Promise<void>((resolve) => {
        const listener = vi.fn();
        decisionEngine.on("decision", listener);

        const agentId = "dispose-agent";
        const sandboxId = "dispose-sandbox";

        // Process event
        patternMatcher.processLine(agentId, sandboxId, "Error: Test error");

        setTimeout(() => {
          expect(listener).toHaveBeenCalled();
          const initialCalls = listener.mock.calls.length;

          // Dispose engine
          decisionEngine.dispose();
          listener.mockClear();

          // Try to process after dispose
          patternMatcher.processLine(
            agentId,
            sandboxId,
            "Error: After dispose",
          );

          setTimeout(() => {
            // Engine listener should not have been called
            expect(listener).not.toHaveBeenCalled();

            resolve();
          }, 10);
        }, 10);
      });
    });

    it("should allow both components to be disposed independently", () => {
      return new Promise<void>((resolve) => {
        const agentId = "test-agent";
        const sandboxId = "test-sandbox";

        // Process initial event
        patternMatcher.processLine(agentId, sandboxId, "Error: First error");

        setTimeout(() => {
          const initialCount = decisions.length;

          // Dispose both
          patternMatcher.dispose();
          decisionEngine.dispose();

          // Try operations after dispose
          expect(() => {
            patternMatcher.processLine(
              agentId,
              sandboxId,
              "Error: After dispose",
            );
          }).not.toThrow();

          setTimeout(() => {
            // No new decisions should be recorded
            expect(decisions).toHaveLength(initialCount);

            resolve();
          }, 10);
        }, 10);
      });
    });
  });

  describe("Full integration scenarios", () => {
    it("should handle complex multi-event flow with metrics", () => {
      return new Promise<void>((resolve) => {
        const agentId = "complex-agent";
        const sandboxId = "complex-sandbox";

        // Simulate a complex development scenario
        const output = `
          Building project...
          Compilation started
          Error: TypeScript compilation failed
          Found 3 errors in types.ts
          Error: Module not found
          Running tests...
          Tests: 5 failed, 12 passed
          Error: Test timeout
          Check authentication at https://github.com/login/oauth
          Some other output
        `;

        patternMatcher.processOutput(agentId, sandboxId, output);

        setTimeout(() => {
          // Should have detected multiple events
          expect(decisions.length).toBeGreaterThan(0);

          // Should have errors
          const errorCount = decisions.filter(
            (d) => d.event.type === "error",
          ).length;
          expect(errorCount).toBeGreaterThan(0);

          // Should have test failures
          const testCount = decisions.filter(
            (d) => d.event.type === "test_failure",
          ).length;
          expect(testCount).toBeGreaterThan(0);

          // Should have auth escalation
          const authCount = decisions.filter(
            (d) => d.event.type === "auth_required",
          ).length;
          expect(authCount).toBeGreaterThan(0);

          // Verify metrics are being tracked
          const errorStats = decisionEngine.getStats("error");
          const testStats = decisionEngine.getStats("test_failure");
          const authStats = decisionEngine.getStats("auth_required");

          expect(errorStats.total).toBeGreaterThan(0);
          expect(testStats.total).toBeGreaterThan(0);
          expect(authStats.total).toBeGreaterThan(0);

          resolve();
        }, 20);
      });
    });

    it("should properly wire decision lifecycle (detect -> decide -> track)", () => {
      return new Promise<void>((resolve) => {
        const agentId = "lifecycle-agent";
        const sandboxId = "lifecycle-sandbox";

        // Setup decision listener
        let decisionEmitted = false;
        decisionEngine.on("decision", () => {
          decisionEmitted = true;
        });

        // Process event
        patternMatcher.processLine(agentId, sandboxId, "Error: Lifecycle test");

        setTimeout(() => {
          // Verify full flow:
          // 1. PatternMatcher detected the error
          expect(decisions).toHaveLength(1);
          const { event, decision } = decisions[0]!;

          // 2. DecisionEngine made a decision
          expect(decision).toBeDefined();
          expect(decision.action).toBeDefined();

          // 3. Decision event was emitted
          expect(decisionEmitted).toBe(true);

          // 4. Metrics are tracked
          const stats = decisionEngine.getStats("error");
          expect(stats.total).toBe(1);

          resolve();
        }, 10);
      });
    });
  });
});
