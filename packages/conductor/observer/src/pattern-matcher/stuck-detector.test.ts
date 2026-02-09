import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StuckDetector } from "./stuck-detector.js";
import type { StuckEvent } from "../types.js";

describe("StuckDetector", () => {
  let detector: StuckDetector;
  const agentId = "agent-1";
  const sandboxId = "sandbox-1";

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new StuckDetector();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not emit event for active agents within threshold", () => {
    const listener = vi.fn();

    detector.trackAgent(agentId, sandboxId);
    detector.on("detection", listener);

    // Advance time by 4 minutes (below 5 minute default threshold)
    vi.advanceTimersByTime(4 * 60 * 1000);
    detector.check();

    expect(listener).not.toHaveBeenCalled();
  });

  it("should emit stuck event when agent silent beyond threshold", () => {
    return new Promise<void>((resolve) => {
      detector.trackAgent(agentId, sandboxId);

      detector.on("detection", (event) => {
        expect(event.type).toBe("stuck");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        expect((event as StuckEvent).silentDurationMs).toBe(5 * 60 * 1000);
        expect(event.timestamp).toBeDefined();
        resolve();
      });

      // Advance time by 5 minutes (at threshold)
      vi.advanceTimersByTime(5 * 60 * 1000);
      detector.check();
    });
  });

  it("should reset timer when activity is recorded", () => {
    const listener = vi.fn();

    detector.trackAgent(agentId, sandboxId);
    detector.on("detection", listener);

    // Advance time by 4 minutes
    vi.advanceTimersByTime(4 * 60 * 1000);

    // Record activity
    detector.recordActivity(agentId);

    // Advance another 4 minutes (total 8 minutes from start, but only 4 from activity)
    vi.advanceTimersByTime(4 * 60 * 1000);
    detector.check();

    // Should not emit because only 4 minutes have passed since activity
    expect(listener).not.toHaveBeenCalled();
  });

  it("should not emit events for untracked agents", () => {
    const listener = vi.fn();

    detector.trackAgent(agentId, sandboxId);
    detector.untrackAgent(agentId);
    detector.on("detection", listener);

    // Advance time by 6 minutes
    vi.advanceTimersByTime(6 * 60 * 1000);
    detector.check();

    expect(listener).not.toHaveBeenCalled();
  });

  it("should respect custom silence threshold", () => {
    return new Promise<void>((resolve) => {
      const customDetector = new StuckDetector({
        silenceThresholdMs: 2 * 60 * 1000,
      });
      customDetector.trackAgent(agentId, sandboxId);

      customDetector.on("detection", (event) => {
        expect(event.type).toBe("stuck");
        expect((event as StuckEvent).silentDurationMs).toBe(2 * 60 * 1000);
        resolve();
      });

      // Advance time by 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);
      customDetector.check();
    });
  });

  it("should respect disabled state", () => {
    const listener = vi.fn();

    detector.trackAgent(agentId, sandboxId);
    detector.disable();
    detector.on("detection", listener);

    // Advance time by 6 minutes
    vi.advanceTimersByTime(6 * 60 * 1000);
    detector.check();

    expect(listener).not.toHaveBeenCalled();
  });

  it("should emit event after being re-enabled", () => {
    return new Promise<void>((resolve) => {
      detector.trackAgent(agentId, sandboxId);

      detector.on("detection", (event) => {
        expect(event.type).toBe("stuck");
        resolve();
      });

      detector.disable();

      // Advance time by 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);
      detector.check();

      detector.enable();
      detector.check();
    });
  });
});
