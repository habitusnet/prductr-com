import { describe, it, expect, vi, beforeEach } from "vitest";
import { TestDetector } from "./test-detector.js";
import type { TestFailureEvent } from "../types.js";

describe("TestDetector", () => {
  let detector: TestDetector;
  const agentId = "agent-1";
  const sandboxId = "sandbox-1";

  beforeEach(() => {
    detector = new TestDetector();
  });

  it("should detect vitest FAIL marker", () => {
    return new Promise<void>((resolve) => {
      const line = "FAIL src/utils.test.ts";

      detector.on("detection", (event) => {
        expect(event.type).toBe("test_failure");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        expect((event as TestFailureEvent).failedTests).toBe(1);
        expect((event as TestFailureEvent).output).toBe(line);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should detect jest summary with failed tests count", () => {
    return new Promise<void>((resolve) => {
      const line = "Tests: 3 failed, 10 passed";

      detector.on("detection", (event) => {
        expect(event.type).toBe("test_failure");
        expect((event as TestFailureEvent).failedTests).toBe(3);
        expect((event as TestFailureEvent).output).toBe(line);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should detect pytest failures with count", () => {
    return new Promise<void>((resolve) => {
      const line = "=== 2 failed, 5 passed ===";

      detector.on("detection", (event) => {
        expect(event.type).toBe("test_failure");
        expect((event as TestFailureEvent).failedTests).toBe(2);
        expect((event as TestFailureEvent).output).toBe(line);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should not emit event for passing tests", () => {
    const line = "Tests: 10 passed, 10 total";
    const listener = vi.fn();

    detector.on("detection", listener);
    detector.process(agentId, sandboxId, line);

    expect(listener).not.toHaveBeenCalled();
  });
});
