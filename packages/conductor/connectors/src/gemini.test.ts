import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiConnector } from "./gemini";

// Mock Google Generative AI SDK (vitest v4+)
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      getGenerativeModel = mockGetGenerativeModel;
    },
  };
});

describe("GeminiConnector", () => {
  let connector: GeminiConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new GeminiConnector({ apiKey: "test-api-key" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with required config", () => {
      expect(connector.name).toBe("Gemini");
      expect(connector.type).toBe("gemini");
    });

    it("should use default model", () => {
      const defaultConnector = new GeminiConnector({ apiKey: "test-key" });
      expect(defaultConnector.name).toBe("Gemini");
    });

    it("should accept custom model", () => {
      const customConnector = new GeminiConnector({
        apiKey: "test-key",
        model: "gemini-pro-vision",
      });
      expect(customConnector.name).toBe("Gemini");
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
    it("should initialize the Gemini client", async () => {
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
      await expect(connector.sendMessage("Hello")).rejects.toThrow(
        "Not connected",
      );
    });

    it("should send message and return response", async () => {
      await connector.connect();

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "Hello, world!",
        },
      });

      const result = await connector.sendMessage("Hello");

      expect(result).toEqual({
        content: "Hello, world!",
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: "gemini-pro",
        systemInstruction: undefined,
      });
      expect(mockGenerateContent).toHaveBeenCalledWith("Hello");
    });

    it("should send message with system instruction", async () => {
      await connector.connect();

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "Response with system",
        },
      });

      const result = await connector.sendMessage("Hello", "You are helpful");

      expect(result.content).toBe("Response with system");
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: "gemini-pro",
        systemInstruction: "You are helpful",
      });
    });

    it("should handle complex prompts", async () => {
      await connector.connect();

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "Detailed response",
        },
      });

      const result = await connector.sendMessage(
        "Explain quantum computing in simple terms",
      );

      expect(result.content).toBe("Detailed response");
      expect(mockGenerateContent).toHaveBeenCalledWith(
        "Explain quantum computing in simple terms",
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

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            "Complexity: Low\nEffort: 2 hours\nCapabilities: JavaScript\nRisks: None",
        },
      });

      const result = await connector.analyzeTask("Add button", "React project");

      expect(result.content).toContain("Complexity: Low");
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: "gemini-pro",
        systemInstruction: expect.stringContaining("task analysis assistant"),
      });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining("Add button"),
      );
    });
  });

  describe("generateCode", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.generateCode("Sort an array", "TypeScript"),
      ).rejects.toThrow("Not connected");
    });

    it("should generate code for the given prompt and language", async () => {
      await connector.connect();

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            "function sort(arr: number[]): number[] { return arr.sort((a, b) => a - b); }",
        },
      });

      const result = await connector.generateCode(
        "Sort an array",
        "TypeScript",
      );

      expect(result.content).toContain("function sort");
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: "gemini-pro",
        systemInstruction: expect.stringContaining("TypeScript developer"),
      });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining("Sort an array"),
      );
    });

    it("should generate code for different languages", async () => {
      await connector.connect();

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "def sort_list(arr): return sorted(arr)",
        },
      });

      const result = await connector.generateCode("Sort a list", "Python");

      expect(result.content).toContain("def sort_list");
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: "gemini-pro",
        systemInstruction: expect.stringContaining("Python developer"),
      });
    });
  });

  describe("getCostEstimate", () => {
    it("should calculate Gemini Pro cost correctly", () => {
      const cost = connector.getCostEstimate(1_000_000, 500_000);
      // $0.5/1M input + $1.5/1M output * 0.5 = $0.5 + $0.75 = $1.25
      expect(cost).toBe(1.25);
    });

    it("should handle small token counts", () => {
      const cost = connector.getCostEstimate(1000, 500);
      // $0.0005 + $0.00075 = $0.00125
      expect(cost).toBeCloseTo(0.00125, 5);
    });

    it("should return 0 for no tokens", () => {
      const cost = connector.getCostEstimate(0, 0);
      expect(cost).toBe(0);
    });

    it("should handle input only", () => {
      const cost = connector.getCostEstimate(1_000_000, 0);
      expect(cost).toBe(0.5);
    });

    it("should handle output only", () => {
      const cost = connector.getCostEstimate(0, 1_000_000);
      expect(cost).toBe(1.5);
    });
  });
});
