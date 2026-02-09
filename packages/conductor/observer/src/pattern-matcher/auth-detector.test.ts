import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthDetector } from "./auth-detector.js";
import type { AuthRequiredEvent } from "../types.js";

describe("AuthDetector", () => {
  let detector: AuthDetector;
  const agentId = "agent-1";
  const sandboxId = "sandbox-1";

  beforeEach(() => {
    detector = new AuthDetector();
  });

  it("should detect Anthropic OAuth URL and extract authUrl", () => {
    return new Promise<void>((resolve) => {
      const line =
        "Please authenticate at https://console.anthropic.com/oauth/authorize";

      detector.on("detection", (event) => {
        expect(event.type).toBe("auth_required");
        expect(event.agentId).toBe(agentId);
        expect(event.sandboxId).toBe(sandboxId);
        expect((event as AuthRequiredEvent).provider).toBe("anthropic");
        expect((event as AuthRequiredEvent).authUrl).toBe(
          "https://console.anthropic.com/oauth/authorize",
        );
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should detect Google OAuth URL", () => {
    return new Promise<void>((resolve) => {
      const line =
        "Redirecting to https://accounts.google.com/o/oauth/authorize?client_id=123";

      detector.on("detection", (event) => {
        expect(event.type).toBe("auth_required");
        expect((event as AuthRequiredEvent).provider).toBe("google");
        expect((event as AuthRequiredEvent).authUrl).toBe(
          "https://accounts.google.com/o/oauth/authorize?client_id=123",
        );
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should detect OpenAI auth URL", () => {
    return new Promise<void>((resolve) => {
      const line = "Authentication required at https://auth.openai.com/login";

      detector.on("detection", (event) => {
        expect(event.type).toBe("auth_required");
        expect((event as AuthRequiredEvent).provider).toBe("openai");
        expect((event as AuthRequiredEvent).authUrl).toBe(
          "https://auth.openai.com/login",
        );
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should detect generic auth prompt", () => {
    return new Promise<void>((resolve) => {
      const line = "Authentication required to continue";

      detector.on("detection", (event) => {
        expect(event.type).toBe("auth_required");
        expect((event as AuthRequiredEvent).provider).toBe("unknown");
        expect((event as AuthRequiredEvent).authUrl).toBeUndefined();
        resolve();
      });

      detector.process(agentId, sandboxId, line);
    });
  });

  it("should not emit event for normal URLs", () => {
    const line = "Documentation available at https://docs.anthropic.com/api";
    const listener = vi.fn();

    detector.on("detection", listener);
    detector.process(agentId, sandboxId, line);

    expect(listener).not.toHaveBeenCalled();
  });

  it("should not emit for empty lines", () => {
    const listener = vi.fn();
    detector.on("detection", listener);

    detector.process(agentId, sandboxId, "");
    detector.process(agentId, sandboxId, "   ");

    expect(listener).not.toHaveBeenCalled();
  });
});
