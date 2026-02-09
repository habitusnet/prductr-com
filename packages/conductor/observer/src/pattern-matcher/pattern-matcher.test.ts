import { describe, it, expect, vi, beforeEach } from "vitest";
import { PatternMatcher } from "./pattern-matcher.js";
import type {
  DetectionEvent,
  ErrorEvent,
  AuthRequiredEvent,
  TestFailureEvent,
} from "../types.js";

describe("PatternMatcher", () => {
  let matcher: PatternMatcher;
  const agentId = "test-agent";
  const sandboxId = "test-sandbox";

  beforeEach(() => {
    matcher = new PatternMatcher();
  });

  it("should aggregate detections from multiple detectors (error detection works)", () => {
    return new Promise<void>((resolve) => {
      matcher.on("detection", (event) => {
        expect(event).toBeDefined();
        expect(event.type).toBe("error");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);

        const errorEvent = event as ErrorEvent;
        expect(errorEvent.message).toContain("Error:");
        expect(errorEvent.severity).toBe("error");

        resolve();
      });

      matcher.processLine(agentId, sandboxId, "Error: Something went wrong");
    });
  });

  it("should detect auth events (auth detection works)", () => {
    return new Promise<void>((resolve) => {
      matcher.on("detection", (event) => {
        expect(event).toBeDefined();
        expect(event.type).toBe("auth_required");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);

        const authEvent = event as AuthRequiredEvent;
        expect(authEvent.provider).toBe("github");

        resolve();
      });

      matcher.processLine(
        agentId,
        sandboxId,
        "Visit https://github.com/login/oauth to authenticate",
      );
    });
  });

  it("should allow disabling specific detectors", () => {
    const detections: DetectionEvent[] = [];

    matcher.on("detection", (event) => {
      detections.push(event);
    });

    // Disable error detector
    matcher.disableDetector("error");

    // Try to process an error line
    matcher.processLine(
      agentId,
      sandboxId,
      "Error: This should not be detected",
    );
    expect(detections).toHaveLength(0);

    // Re-enable error detector
    matcher.enableDetector("error");

    // Process error line again
    matcher.processLine(agentId, sandboxId, "Error: This should be detected");
    expect(detections).toHaveLength(1);
    expect(detections[0]!.type).toBe("error");
  });

  it("should process multiple lines with processOutput()", () => {
    return new Promise<void>((resolve) => {
      const detections: DetectionEvent[] = [];

      matcher.on("detection", (event) => {
        detections.push(event);

        // Wait for all detections
        if (detections.length === 2) {
          expect(detections).toHaveLength(2);

          // First detection should be error
          expect(detections[0]!.type).toBe("error");
          expect((detections[0] as ErrorEvent).severity).toBe("fatal");

          // Second detection should be test failure
          expect(detections[1]!.type).toBe("test_failure");
          expect((detections[1] as TestFailureEvent).failedTests).toBe(3);

          resolve();
        }
      });

      const multilineOutput = `
        Some initial output
        FATAL: Database connection failed
        More output
        Tests: 3 failed, 5 passed
        Final output
      `;

      matcher.processOutput(agentId, sandboxId, multilineOutput);
    });
  });

  it("should have default detectors registered", () => {
    const detectorNames = matcher.listDetectors();
    expect(detectorNames).toContain("error");
    expect(detectorNames).toContain("auth");
    expect(detectorNames).toContain("test");
  });

  it("should allow retrieving detectors by name", () => {
    const errorDetector = matcher.getDetector("error");
    expect(errorDetector).toBeDefined();
    expect(errorDetector?.name).toBe("error");
  });

  it("should not emit detection events for empty lines", () => {
    const detections: DetectionEvent[] = [];

    matcher.on("detection", (event) => {
      detections.push(event);
    });

    matcher.processOutput(agentId, sandboxId, "\n\n\n   \n");
    expect(detections).toHaveLength(0);
  });

  it("should throw error when enabling unknown detector", () => {
    expect(() => {
      matcher.enableDetector("unknown-detector");
    }).toThrow("Detector 'unknown-detector' not found");
  });

  it("should throw error when disabling unknown detector", () => {
    expect(() => {
      matcher.disableDetector("unknown-detector");
    }).toThrow("Detector 'unknown-detector' not found");
  });

  it("should verify detector state after enable/disable", () => {
    const errorDetector = matcher.getDetector("error");
    expect(errorDetector).toBeDefined();

    // Initially enabled
    expect(errorDetector?.isEnabled()).toBe(true);

    // Disable it
    matcher.disableDetector("error");
    expect(errorDetector?.isEnabled()).toBe(false);

    // Re-enable it
    matcher.enableDetector("error");
    expect(errorDetector?.isEnabled()).toBe(true);
  });

  it("should dispose and clean up all listeners", () => {
    const detections: DetectionEvent[] = [];

    matcher.on("detection", (event) => {
      detections.push(event);
    });

    // Verify detection works before dispose
    matcher.processLine(agentId, sandboxId, "Error: Test error");
    expect(detections).toHaveLength(1);

    // Dispose
    matcher.dispose();

    // Clear detections array
    detections.length = 0;

    // Try to process after dispose - should not emit
    matcher.processLine(agentId, sandboxId, "Error: After dispose");
    expect(detections).toHaveLength(0);

    // Verify detectors map is cleared
    expect(matcher.listDetectors()).toHaveLength(0);
  });
});
