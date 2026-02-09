import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextExhaustionDetector } from "./context-exhaustion-detector.js";
import type { ContextExhaustionEvent } from "../types.js";

describe("ContextExhaustionDetector", () => {
  let detector: ContextExhaustionDetector;
  const agentId = "agent-1";
  const sandboxId = "sandbox-1";

  beforeEach(() => {
    detector = new ContextExhaustionDetector();
  });

  it('should detect "context limit reached" pattern', () => {
    return new Promise<void>((resolve) => {
      const line = "context limit reached — please start a new conversation";

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        expect((event as ContextExhaustionEvent).usagePercent).toBe(100);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "token budget exceeded" pattern', () => {
    return new Promise<void>((resolve) => {
      const line = "token budget exceeded, truncating input";

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "maximum context length" pattern', () => {
    return new Promise<void>((resolve) => {
      const line =
        "maximum context length is 128000 tokens, request was 130452 tokens";

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "context_length_exceeded" pattern', () => {
    return new Promise<void>((resolve) => {
      const line =
        '{"error": {"code": "context_length_exceeded", "message": "too many tokens"}}';

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "max_tokens_exceeded" pattern', () => {
    return new Promise<void>((resolve) => {
      const line = "API error: max_tokens_exceeded";

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should not emit event for normal output lines", () => {
    const lines = [
      "Build completed successfully",
      "Running tests...",
      "context: initializing workspace",
      "Token generated for auth",
      "Processing 50000 tokens of input",
    ];
    const listener = vi.fn();

    detector.on("detection", listener);

    for (const line of lines) {
      detector.process(agentId, sandboxId, line);
    }

    expect(listener).not.toHaveBeenCalled();
  });

  it("should not emit events when disabled", () => {
    const line = "context limit reached";
    const listener = vi.fn();

    detector.on("detection", listener);
    detector.disable();
    detector.process(agentId, sandboxId, line);

    expect(listener).not.toHaveBeenCalled();
  });

  it("should resume emitting events after re-enabling", () => {
    return new Promise<void>((resolve) => {
      const line = "context limit reached";

      detector.disable();
      detector.enable();

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "conversation too long" pattern', () => {
    return new Promise<void>((resolve) => {
      const line = "This conversation is too long, please start a new one";

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "context window full" pattern', () => {
    return new Promise<void>((resolve) => {
      const line = "context window full — summarizing and continuing";

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "running out of context" pattern', () => {
    return new Promise<void>((resolve) => {
      const line = "Warning: running out of context space";

      detector.on("detection", (event) => {
        expect(event.type).toBe("context_exhaustion");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });
});
