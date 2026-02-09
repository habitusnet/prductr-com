import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAIConnector } from "./openai";

// Mock OpenAI SDK (vitest v4+)
const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe("OpenAIConnector", () => {
  let connector: OpenAIConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new OpenAIConnector({ apiKey: "test-api-key" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with required config", () => {
      expect(connector.name).toBe("OpenAI");
      expect(connector.type).toBe("openai");
    });

    it("should use default model", () => {
      const defaultConnector = new OpenAIConnector({ apiKey: "test-key" });
      expect(defaultConnector.name).toBe("OpenAI");
    });

    it("should accept custom model and organization", () => {
      const customConnector = new OpenAIConnector({
        apiKey: "test-key",
        model: "gpt-4o",
        organization: "org-123",
      });
      expect(customConnector.name).toBe("OpenAI");
    });
  });

  describe("isConnected", () => {
    it("should return false when not connected", () => {
      expect(connector.isConnected()).toBe(false);
    });

    it("should return true when connected", async () => {
      await connector.connect();
      expect(connector.isConnected()).toBe(true);
    });
  });

  describe("connect", () => {
    it("should initialize the OpenAI client", async () => {
      await connector.connect();
      expect(connector.isConnected()).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("should set connected state to false", async () => {
      await connector.connect();
      expect(connector.isConnected()).toBe(true);

      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe("sendMessage", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.sendMessage([{ role: "user", content: "Hello" }]),
      ).rejects.toThrow("Not connected");
    });

    it("should send message and return response", async () => {
      await connector.connect();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: "Hello, world!" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
      ]);

      expect(result).toEqual({
        content: "Hello, world!",
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: "Hello" }],
      });
    });

    it("should handle system messages", async () => {
      await connector.connect();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: "Response" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
      });

      const result = await connector.sendMessage([
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
      ]);

      expect(result.content).toBe("Response");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hello" },
        ],
      });
    });

    it("should handle empty choices", async () => {
      await connector.connect();

      mockCreate.mockResolvedValue({
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
      ]);
      expect(result.content).toBe("");
    });

    it("should handle missing message content", async () => {
      await connector.connect();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: null },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
      ]);
      expect(result.content).toBe("");
    });

    it("should handle missing usage data", async () => {
      await connector.connect();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: "Response" },
            finish_reason: "stop",
          },
        ],
        usage: null,
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
      ]);
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    });

    it("should handle multi-turn conversations", async () => {
      await connector.connect();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: "Continuing the conversation" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 15 },
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ]);

      expect(result.content).toBe("Continuing the conversation");
    });
  });

  describe("analyzeTask", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.analyzeTask("Implement feature X", "Project context"),
      ).rejects.toThrow("Not connected");
    });

    it("should analyze task and return estimate", async () => {
      await connector.connect();

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content:
                "Complexity: High\nTokens: 5000\nCapabilities: Python\nRisks: Complex logic",
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      const result = await connector.analyzeTask(
        "Implement ML model",
        "Python project",
      );

      expect(result.content).toContain("Complexity: High");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "system",
              content: expect.stringContaining("task analysis assistant"),
            },
            {
              role: "user",
              content: expect.stringContaining("Implement ML model"),
            },
          ],
        }),
      );
    });
  });

  describe("getCostEstimate", () => {
    it("should calculate GPT-4 Turbo cost correctly", () => {
      const cost = connector.getCostEstimate(1_000_000, 500_000);
      // $10/1M input + $30/1M output * 0.5 = $10 + $15 = $25
      expect(cost).toBe(25);
    });

    it("should handle small token counts", () => {
      const cost = connector.getCostEstimate(1000, 500);
      // $0.01 + $0.015 = $0.025
      expect(cost).toBeCloseTo(0.025, 4);
    });

    it("should return 0 for no tokens", () => {
      const cost = connector.getCostEstimate(0, 0);
      expect(cost).toBe(0);
    });

    it("should handle input only", () => {
      const cost = connector.getCostEstimate(1_000_000, 0);
      expect(cost).toBe(10.0);
    });

    it("should handle output only", () => {
      const cost = connector.getCostEstimate(0, 1_000_000);
      expect(cost).toBe(30.0);
    });
  });
});
