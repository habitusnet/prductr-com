import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClaudeConnector } from "./claude";

// Mock Anthropic SDK (vitest v4+)
const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockMessagesCreate,
      };
    },
  };
});

describe("ClaudeConnector", () => {
  let connector: ClaudeConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new ClaudeConnector({ apiKey: "test-api-key" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with required config", () => {
      expect(connector.name).toBe("Claude");
      expect(connector.type).toBe("claude");
    });

    it("should use default model and maxTokens", () => {
      const defaultConnector = new ClaudeConnector({ apiKey: "test-key" });
      expect(defaultConnector.name).toBe("Claude");
    });

    it("should accept custom model and maxTokens", () => {
      const customConnector = new ClaudeConnector({
        apiKey: "test-key",
        model: "claude-3-opus",
        maxTokens: 8192,
      });
      expect(customConnector.name).toBe("Claude");
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
    it("should initialize the Anthropic client", async () => {
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

      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "Hello, world!" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: "end_turn",
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
      ]);

      expect(result).toEqual({
        content: "Hello, world!",
        usage: { inputTokens: 10, outputTokens: 5 },
        stopReason: "end_turn",
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: undefined,
        messages: [{ role: "user", content: "Hello" }],
      });
    });

    it("should send message with system prompt", async () => {
      await connector.connect();

      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: "end_turn",
      });

      await connector.sendMessage(
        [{ role: "user", content: "Hello" }],
        "You are a helpful assistant",
      );

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: "You are a helpful assistant",
        messages: [{ role: "user", content: "Hello" }],
      });
    });

    it("should handle empty content blocks", async () => {
      await connector.connect();

      mockMessagesCreate.mockResolvedValue({
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
        stop_reason: "end_turn",
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
      ]);
      expect(result.content).toBe("");
    });

    it("should handle non-text content blocks", async () => {
      await connector.connect();

      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "tool_use", id: "tool123" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: "tool_use",
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
      ]);
      expect(result.content).toBe("");
    });

    it("should handle multi-turn conversations", async () => {
      await connector.connect();

      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "That sounds interesting!" }],
        usage: { input_tokens: 50, output_tokens: 15 },
        stop_reason: "end_turn",
      });

      const result = await connector.sendMessage([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "Tell me about AI" },
      ]);

      expect(result.content).toBe("That sounds interesting!");
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
            { role: "user", content: "Tell me about AI" },
          ],
        }),
      );
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

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "Complexity: Medium\nTokens: 2000\nCapabilities: TypeScript\nRisks: None",
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
        stop_reason: "end_turn",
      });

      const result = await connector.analyzeTask(
        "Implement feature X",
        "TypeScript project",
      );

      expect(result.content).toContain("Complexity: Medium");
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining("task analysis assistant"),
          messages: [
            {
              role: "user",
              content: expect.stringContaining("Implement feature X"),
            },
          ],
        }),
      );
    });
  });

  describe("generateImplementationPlan", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.generateImplementationPlan("Add auth", "Codebase context"),
      ).rejects.toThrow("Not connected");
    });

    it("should generate implementation plan", async () => {
      await connector.connect();

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "1. Create auth module\n2. Add middleware\n3. Write tests",
          },
        ],
        usage: { input_tokens: 150, output_tokens: 100 },
        stop_reason: "end_turn",
      });

      const result = await connector.generateImplementationPlan(
        "Add authentication",
        "Node.js Express project",
      );

      expect(result.content).toContain("Create auth module");
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining("software architect"),
          messages: [
            {
              role: "user",
              content: expect.stringContaining("Add authentication"),
            },
          ],
        }),
      );
    });
  });

  describe("getCostEstimate", () => {
    it("should calculate cost correctly", () => {
      const cost = connector.getCostEstimate(1_000_000, 500_000);
      // $3/1M input + $15/1M output * 0.5 = $3 + $7.50 = $10.50
      expect(cost).toBe(10.5);
    });

    it("should handle small token counts", () => {
      const cost = connector.getCostEstimate(1000, 500);
      // $0.003 + $0.0075 = $0.0105
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it("should return 0 for no tokens", () => {
      const cost = connector.getCostEstimate(0, 0);
      expect(cost).toBe(0);
    });

    it("should handle input only", () => {
      const cost = connector.getCostEstimate(1_000_000, 0);
      expect(cost).toBe(3.0);
    });

    it("should handle output only", () => {
      const cost = connector.getCostEstimate(0, 1_000_000);
      expect(cost).toBe(15.0);
    });
  });
});
