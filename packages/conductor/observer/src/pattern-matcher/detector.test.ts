import { describe, it, expect, vi } from "vitest";
import { BaseDetector } from "./detector.js";
import type { DetectionEvent } from "../types.js";

class TestDetector extends BaseDetector {
  readonly name = "test";

  protected doProcess(
    agentId: string,
    sandboxId: string,
    line: string,
  ): DetectionEvent | null {
    if (line.includes("ERROR")) {
      return {
        type: "error",
        agentId,
        sandboxId,
        timestamp: new Date(),
        message: line,
        severity: "error",
      };
    }
    return null;
  }
}

describe("BaseDetector", () => {
  it("should emit detection events", () => {
    const detector = new TestDetector();
    const handler = vi.fn();
    detector.on("detection", handler);

    detector.process("agent-1", "sandbox-1", "This is an ERROR line");

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        agentId: "agent-1",
        message: "This is an ERROR line",
      }),
    );
  });

  it("should not emit for non-matching lines", () => {
    const detector = new TestDetector();
    const handler = vi.fn();
    detector.on("detection", handler);

    detector.process("agent-1", "sandbox-1", "This is a normal line");

    expect(handler).not.toHaveBeenCalled();
  });

  it("should be disableable", () => {
    const detector = new TestDetector();
    detector.disable();
    const handler = vi.fn();
    detector.on("detection", handler);

    detector.process("agent-1", "sandbox-1", "This is an ERROR line");

    expect(handler).not.toHaveBeenCalled();
  });
});
