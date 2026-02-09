import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorDetector } from "./error-detector.js";
import type { ErrorEvent } from "../types.js";

describe("ErrorDetector", () => {
  let detector: ErrorDetector;
  const agentId = "agent-1";
  const sandboxId = "sandbox-1";

  beforeEach(() => {
    detector = new ErrorDetector();
  });

  it('should detect "Error:" pattern with severity error', () => {
    return new Promise<void>((resolve) => {
      const line = "Error: Something went wrong";

      detector.on("detection", (event) => {
        expect(event.type).toBe("error");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        expect(event.message).toBe(line);
        expect((event as ErrorEvent).severity).toBe("error");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "TypeError:" (Exception pattern) with severity error', () => {
    return new Promise<void>((resolve) => {
      const line = 'TypeError: Cannot read property "x" of undefined';

      detector.on("detection", (event) => {
        expect(event.type).toBe("error");
        expect((event as ErrorEvent).severity).toBe("error");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "FATAL:" with severity fatal', () => {
    return new Promise<void>((resolve) => {
      const line = "FATAL: Database connection lost";

      detector.on("detection", (event) => {
        expect(event.type).toBe("error");
        expect((event as ErrorEvent).severity).toBe("fatal");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it('should detect "Warning:" with severity warning', () => {
    return new Promise<void>((resolve) => {
      const line = "Warning: Deprecated API usage detected";

      detector.on("detection", (event) => {
        expect(event.type).toBe("error");
        expect((event as ErrorEvent).severity).toBe("warning");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should not emit event for normal lines", () => {
    const line = "Build completed successfully";
    const listener = vi.fn();

    detector.on("detection", listener);
    detector.process(agentId, sandboxId, line);

    expect(listener).not.toHaveBeenCalled();
  });

  it("should prioritize fatal over error patterns", () => {
    return new Promise<void>((resolve) => {
      const line = "FATAL Error: catastrophic failure";

      detector.on("detection", (event) => {
        expect(event.type).toBe("error");
        expect((event as ErrorEvent).severity).toBe("fatal");
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });
});
