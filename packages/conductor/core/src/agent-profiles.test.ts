/**
 * Agent Profiles Tests
 * Tests for agent profile utilities and defaults
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_AGENT_PROFILES,
  MODEL_PRICING,
  createAgentProfile,
  hasCapability,
  hasAllCapabilities,
  getAgentsWithCapability,
  estimateCost,
} from "./agent-profiles.js";
import type { AgentProfile } from "./types.js";

describe("Agent Profiles", () => {
  describe("DEFAULT_AGENT_PROFILES", () => {
    it("should have claude profile", () => {
      expect(DEFAULT_AGENT_PROFILES.claude).toBeDefined();
      expect(DEFAULT_AGENT_PROFILES.claude.name).toBe("Claude Code");
      expect(DEFAULT_AGENT_PROFILES.claude.provider).toBe("anthropic");
      expect(DEFAULT_AGENT_PROFILES.claude.model).toBe("claude-opus-4");
    });

    it("should have claude-sonnet profile", () => {
      expect(DEFAULT_AGENT_PROFILES["claude-sonnet"]).toBeDefined();
      expect(DEFAULT_AGENT_PROFILES["claude-sonnet"].provider).toBe(
        "anthropic",
      );
      expect(DEFAULT_AGENT_PROFILES["claude-sonnet"].model).toBe(
        "claude-sonnet-4",
      );
    });

    it("should have claude-haiku profile", () => {
      expect(DEFAULT_AGENT_PROFILES["claude-haiku"]).toBeDefined();
      expect(DEFAULT_AGENT_PROFILES["claude-haiku"].provider).toBe("anthropic");
    });

    it("should have gemini profile", () => {
      expect(DEFAULT_AGENT_PROFILES.gemini).toBeDefined();
      expect(DEFAULT_AGENT_PROFILES.gemini.provider).toBe("google");
      expect(DEFAULT_AGENT_PROFILES.gemini.model).toBe("gemini-2.0-flash");
    });

    it("should have codex profile", () => {
      expect(DEFAULT_AGENT_PROFILES.codex).toBeDefined();
      expect(DEFAULT_AGENT_PROFILES.codex.provider).toBe("openai");
      expect(DEFAULT_AGENT_PROFILES.codex.costPerToken.input).toBe(0);
      expect(DEFAULT_AGENT_PROFILES.codex.costPerToken.output).toBe(0);
    });

    it("should have gpt-4o profile", () => {
      expect(DEFAULT_AGENT_PROFILES["gpt-4o"]).toBeDefined();
      expect(DEFAULT_AGENT_PROFILES["gpt-4o"].provider).toBe("openai");
    });

    it("should have appropriate capabilities for each agent", () => {
      expect(DEFAULT_AGENT_PROFILES.claude.capabilities).toContain(
        "typescript",
      );
      expect(DEFAULT_AGENT_PROFILES.claude.capabilities).toContain("mcp");
      expect(DEFAULT_AGENT_PROFILES.gemini.capabilities).toContain("frontend");
      expect(DEFAULT_AGENT_PROFILES.codex.capabilities).toContain("ci-cd");
    });

    it("should have valid cost structure", () => {
      for (const [id, profile] of Object.entries(DEFAULT_AGENT_PROFILES)) {
        expect(profile.costPerToken).toBeDefined();
        expect(typeof profile.costPerToken.input).toBe("number");
        expect(typeof profile.costPerToken.output).toBe("number");
        expect(profile.costPerToken.input).toBeGreaterThanOrEqual(0);
        expect(profile.costPerToken.output).toBeGreaterThanOrEqual(0);
      }
    });

    it("should have idle status by default", () => {
      for (const profile of Object.values(DEFAULT_AGENT_PROFILES)) {
        expect(profile.status).toBe("idle");
      }
    });
  });

  describe("MODEL_PRICING", () => {
    it("should have pricing for claude models", () => {
      expect(MODEL_PRICING["claude-opus-4"]).toEqual({
        inputPerMillion: 15,
        outputPerMillion: 75,
      });
      expect(MODEL_PRICING["claude-sonnet-4"]).toEqual({
        inputPerMillion: 3,
        outputPerMillion: 15,
      });
      expect(MODEL_PRICING["claude-haiku"]).toEqual({
        inputPerMillion: 0.25,
        outputPerMillion: 1.25,
      });
    });

    it("should have pricing for gemini models", () => {
      expect(MODEL_PRICING["gemini-2.0-flash"]).toEqual({
        inputPerMillion: 0.1,
        outputPerMillion: 0.4,
      });
      expect(MODEL_PRICING["gemini-2.0-pro"]).toEqual({
        inputPerMillion: 1.25,
        outputPerMillion: 5,
      });
    });

    it("should have pricing for openai models", () => {
      expect(MODEL_PRICING["gpt-4o"]).toEqual({
        inputPerMillion: 2.5,
        outputPerMillion: 10,
      });
      expect(MODEL_PRICING["gpt-4o-mini"]).toEqual({
        inputPerMillion: 0.15,
        outputPerMillion: 0.6,
      });
    });

    it("should have free tier for codex", () => {
      expect(MODEL_PRICING.codex).toEqual({
        inputPerMillion: 0,
        outputPerMillion: 0,
      });
    });
  });

  describe("createAgentProfile", () => {
    it("should create profile from default", () => {
      const profile = createAgentProfile("claude");

      expect(profile.id).toBe("claude");
      expect(profile.name).toBe("Claude Code");
      expect(profile.provider).toBe("anthropic");
    });

    it("should merge overrides with default", () => {
      const profile = createAgentProfile("claude", {
        name: "Custom Claude",
        capabilities: ["custom-cap"],
      });

      expect(profile.id).toBe("claude");
      expect(profile.name).toBe("Custom Claude");
      expect(profile.capabilities).toEqual(["custom-cap"]);
      expect(profile.provider).toBe("anthropic"); // From default
    });

    it("should create custom agent profile", () => {
      const profile = createAgentProfile("my-agent", {
        name: "My Custom Agent",
        provider: "custom",
        model: "my-model",
        capabilities: ["python", "data-analysis"],
        costPerToken: { input: 0.001, output: 0.002 },
      });

      expect(profile.id).toBe("my-agent");
      expect(profile.name).toBe("My Custom Agent");
      expect(profile.provider).toBe("custom");
      expect(profile.model).toBe("my-model");
    });

    it("should use id as name fallback for custom agents", () => {
      const profile = createAgentProfile("custom-agent");

      expect(profile.name).toBe("custom-agent");
    });

    it("should default to custom provider for unknown agents", () => {
      const profile = createAgentProfile("unknown-agent");

      expect(profile.provider).toBe("custom");
    });

    it("should set default empty arrays and objects", () => {
      const profile = createAgentProfile("custom-agent");

      expect(profile.capabilities).toEqual([]);
      expect(profile.metadata).toEqual({});
    });

    it("should filter out undefined overrides", () => {
      const profile = createAgentProfile("claude", {
        name: undefined,
        capabilities: ["test"],
      });

      // Should keep default name, not override with undefined
      expect(profile.name).toBe("Claude Code");
      expect(profile.capabilities).toEqual(["test"]);
    });

    it("should preserve organization binding", () => {
      const profile = createAgentProfile("claude", {
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(profile.organizationId).toBe(
        "123e4567-e89b-12d3-a456-426614174000",
      );
    });
  });

  describe("hasCapability", () => {
    const testAgent: AgentProfile = {
      id: "test",
      name: "Test Agent",
      provider: "custom",
      model: "test-model",
      capabilities: ["typescript", "react", "testing"],
      costPerToken: { input: 0.01, output: 0.03 },
      status: "idle",
      metadata: {},
    };

    it("should return true for existing capability", () => {
      expect(hasCapability(testAgent, "typescript")).toBe(true);
      expect(hasCapability(testAgent, "react")).toBe(true);
      expect(hasCapability(testAgent, "testing")).toBe(true);
    });

    it("should return false for non-existing capability", () => {
      expect(hasCapability(testAgent, "python")).toBe(false);
      expect(hasCapability(testAgent, "rust")).toBe(false);
    });

    it("should handle empty capabilities", () => {
      const emptyAgent: AgentProfile = {
        ...testAgent,
        capabilities: [],
      };

      expect(hasCapability(emptyAgent, "anything")).toBe(false);
    });
  });

  describe("hasAllCapabilities", () => {
    const testAgent: AgentProfile = {
      id: "test",
      name: "Test Agent",
      provider: "custom",
      model: "test-model",
      capabilities: ["typescript", "react", "testing", "nodejs"],
      costPerToken: { input: 0.01, output: 0.03 },
      status: "idle",
      metadata: {},
    };

    it("should return true when agent has all required capabilities", () => {
      expect(hasAllCapabilities(testAgent, ["typescript", "react"])).toBe(true);
      expect(hasAllCapabilities(testAgent, ["testing"])).toBe(true);
      expect(
        hasAllCapabilities(testAgent, [
          "typescript",
          "react",
          "testing",
          "nodejs",
        ]),
      ).toBe(true);
    });

    it("should return false when agent is missing any capability", () => {
      expect(hasAllCapabilities(testAgent, ["typescript", "python"])).toBe(
        false,
      );
      expect(hasAllCapabilities(testAgent, ["unknown"])).toBe(false);
    });

    it("should return true for empty requirements", () => {
      expect(hasAllCapabilities(testAgent, [])).toBe(true);
    });
  });

  describe("getAgentsWithCapability", () => {
    const agents: AgentProfile[] = [
      {
        id: "agent1",
        name: "Agent 1",
        provider: "custom",
        model: "model1",
        capabilities: ["typescript", "react"],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      },
      {
        id: "agent2",
        name: "Agent 2",
        provider: "custom",
        model: "model2",
        capabilities: ["python", "data-analysis"],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      },
      {
        id: "agent3",
        name: "Agent 3",
        provider: "custom",
        model: "model3",
        capabilities: ["typescript", "nodejs"],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      },
    ];

    it("should return agents with matching capability", () => {
      const result = getAgentsWithCapability(agents, "typescript");

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toContain("agent1");
      expect(result.map((a) => a.id)).toContain("agent3");
    });

    it("should return single agent when only one matches", () => {
      const result = getAgentsWithCapability(agents, "python");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("agent2");
    });

    it("should return empty array when no agents match", () => {
      const result = getAgentsWithCapability(agents, "rust");

      expect(result).toHaveLength(0);
    });

    it("should handle empty agent list", () => {
      const result = getAgentsWithCapability([], "typescript");

      expect(result).toHaveLength(0);
    });
  });

  describe("estimateCost", () => {
    it("should calculate cost correctly", () => {
      const agent: AgentProfile = {
        id: "test",
        name: "Test",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: [],
        costPerToken: {
          input: 0.000015, // $15 per million
          output: 0.000075, // $75 per million
        },
        status: "idle",
        metadata: {},
      };

      // 1000 input tokens + 500 output tokens
      const cost = estimateCost(agent, 1000, 500);

      // 1000 * 0.000015 + 500 * 0.000075 = 0.015 + 0.0375 = 0.0525
      expect(cost).toBeCloseTo(0.0525, 6);
    });

    it("should return 0 for free tier models", () => {
      const agent: AgentProfile = {
        id: "codex",
        name: "Codex",
        provider: "openai",
        model: "codex",
        capabilities: [],
        costPerToken: { input: 0, output: 0 },
        status: "idle",
        metadata: {},
      };

      const cost = estimateCost(agent, 100000, 50000);
      expect(cost).toBe(0);
    });

    it("should handle large token counts", () => {
      const agent: AgentProfile = {
        id: "test",
        name: "Test",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: [],
        costPerToken: {
          input: 0.000015,
          output: 0.000075,
        },
        status: "idle",
        metadata: {},
      };

      // 1 million input + 1 million output
      const cost = estimateCost(agent, 1000000, 1000000);

      // 1M * 0.000015 + 1M * 0.000075 = 15 + 75 = 90
      expect(cost).toBeCloseTo(90, 2);
    });

    it("should handle zero tokens", () => {
      const agent: AgentProfile = {
        id: "test",
        name: "Test",
        provider: "custom",
        model: "test",
        capabilities: [],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      };

      expect(estimateCost(agent, 0, 0)).toBe(0);
      expect(estimateCost(agent, 100, 0)).toBeCloseTo(1, 6);
      expect(estimateCost(agent, 0, 100)).toBeCloseTo(3, 6);
    });
  });

  describe("Integration with DEFAULT_AGENT_PROFILES", () => {
    it("should correctly estimate Claude opus costs", () => {
      const claude = DEFAULT_AGENT_PROFILES.claude;

      // Based on MODEL_PRICING: $15 input, $75 output per million
      const cost = estimateCost(claude, 1000000, 1000000);

      expect(cost).toBeCloseTo(90, 2); // $15 + $75 = $90
    });

    it("should correctly estimate Gemini Flash costs", () => {
      const gemini = DEFAULT_AGENT_PROFILES.gemini;

      // Based on MODEL_PRICING: $0.1 input, $0.4 output per million
      const cost = estimateCost(gemini, 1000000, 1000000);

      expect(cost).toBeCloseTo(0.5, 2); // $0.1 + $0.4 = $0.5
    });

    it("should find typescript-capable agents from defaults", () => {
      const agents = Object.values(DEFAULT_AGENT_PROFILES);
      const tsAgents = getAgentsWithCapability(agents, "typescript");

      expect(tsAgents.length).toBeGreaterThan(0);
      expect(tsAgents.map((a) => a.id)).toContain("claude");
      expect(tsAgents.map((a) => a.id)).toContain("gemini");
    });

    it("should find MCP-capable agents (Claude and Z.ai)", () => {
      const agents = Object.values(DEFAULT_AGENT_PROFILES);
      const mcpAgents = getAgentsWithCapability(agents, "mcp");

      expect(mcpAgents).toHaveLength(2);
      expect(mcpAgents.map((a) => a.id)).toContain("claude");
      expect(mcpAgents.map((a) => a.id)).toContain("zai-glm");
    });
  });
});
