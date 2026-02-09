import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createConnector,
  GitHubConnector,
  ClaudeConnector,
  GeminiConnector,
  OpenAIConnector,
  WebhookConnector,
} from "./index";

// Mock external dependencies used by connectors
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    users: {
      getAuthenticated: vi.fn().mockResolvedValue({ data: { login: "test" } }),
    },
    repos: {
      get: vi.fn(),
      listBranches: vi.fn(),
      getContent: vi.fn(),
      createOrUpdateFileContents: vi.fn(),
    },
    issues: { create: vi.fn() },
    pulls: { create: vi.fn() },
  })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn(() => ({ generateContent: vi.fn() })),
  })),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));

// Mock global fetch for webhook
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", mockFetch);

describe("createConnector factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("github connector", () => {
    it("should create GitHub connector", () => {
      const config = { token: "test-token" };
      const connector = createConnector("github", config);

      expect(connector.name).toBe("GitHub");
      expect(connector.type).toBe("github");
      expect(connector).toBeInstanceOf(GitHubConnector);
    });

    it("should create connector with full config", () => {
      const config = { token: "my-token", owner: "myorg", repo: "myrepo" };
      const connector = createConnector("github", config);

      expect(connector).toBeInstanceOf(GitHubConnector);
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe("claude connector", () => {
    it("should create Claude connector", () => {
      const config = { apiKey: "test-key" };
      const connector = createConnector("claude", config);

      expect(connector.name).toBe("Claude");
      expect(connector.type).toBe("claude");
      expect(connector).toBeInstanceOf(ClaudeConnector);
    });

    it("should create connector with custom model", () => {
      const config = { apiKey: "my-key", model: "claude-3-opus" };
      const connector = createConnector("claude", config);

      expect(connector).toBeInstanceOf(ClaudeConnector);
    });
  });

  describe("gemini connector", () => {
    it("should create Gemini connector", () => {
      const config = { apiKey: "test-key" };
      const connector = createConnector("gemini", config);

      expect(connector.name).toBe("Gemini");
      expect(connector.type).toBe("gemini");
      expect(connector).toBeInstanceOf(GeminiConnector);
    });

    it("should create connector with custom model", () => {
      const config = { apiKey: "my-key", model: "gemini-pro-vision" };
      const connector = createConnector("gemini", config);

      expect(connector).toBeInstanceOf(GeminiConnector);
    });
  });

  describe("openai connector", () => {
    it("should create OpenAI connector", () => {
      const config = { apiKey: "test-key" };
      const connector = createConnector("openai", config);

      expect(connector.name).toBe("OpenAI");
      expect(connector.type).toBe("openai");
      expect(connector).toBeInstanceOf(OpenAIConnector);
    });

    it("should create connector with organization", () => {
      const config = {
        apiKey: "my-key",
        model: "gpt-4o",
        organization: "org-123",
      };
      const connector = createConnector("openai", config);

      expect(connector).toBeInstanceOf(OpenAIConnector);
    });
  });

  describe("webhook connector", () => {
    it("should create Webhook connector", () => {
      const config = { url: "https://example.com/webhook" };
      const connector = createConnector("webhook", config);

      expect(connector.name).toBe("Webhook");
      expect(connector.type).toBe("webhook");
      expect(connector).toBeInstanceOf(WebhookConnector);
    });

    it("should create connector with full config", () => {
      const config = {
        url: "https://example.com/webhook",
        secret: "my-secret",
        headers: { "X-Custom": "value" },
      };
      const connector = createConnector("webhook", config);

      expect(connector).toBeInstanceOf(WebhookConnector);
    });
  });

  describe("unknown connector type", () => {
    it("should throw error for unknown type", () => {
      expect(() => createConnector("unknown", {})).toThrow(
        "Unknown connector type: unknown",
      );
    });

    it("should throw error for empty type", () => {
      expect(() => createConnector("", {})).toThrow("Unknown connector type: ");
    });

    it("should throw error for invalid type", () => {
      expect(() => createConnector("invalid", {})).toThrow(
        "Unknown connector type: invalid",
      );
    });
  });

  describe("connector interface", () => {
    it("should return connectors with required interface methods", () => {
      const testConfigs = [
        { type: "github", config: { token: "token" } },
        { type: "claude", config: { apiKey: "key" } },
        { type: "gemini", config: { apiKey: "key" } },
        { type: "openai", config: { apiKey: "key" } },
        { type: "webhook", config: { url: "https://example.com" } },
      ];

      for (const { type, config } of testConfigs) {
        const connector = createConnector(type, config);

        expect(connector).toHaveProperty("name");
        expect(connector).toHaveProperty("type");
        expect(connector).toHaveProperty("isConnected");
        expect(connector).toHaveProperty("connect");
        expect(connector).toHaveProperty("disconnect");
        expect(typeof connector.isConnected).toBe("function");
        expect(typeof connector.connect).toBe("function");
        expect(typeof connector.disconnect).toBe("function");
      }
    });

    it("should create connectors that start disconnected", () => {
      const connector = createConnector("github", { token: "test" });
      expect(connector.isConnected()).toBe(false);
    });
  });
});
