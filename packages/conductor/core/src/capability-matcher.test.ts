import { describe, it, expect } from "vitest";
import {
  scoreCapabilityMatch,
  extractRequiredCapabilities,
  findBestAgent,
} from "./capability-matcher.js";
import type { AgentProfile } from "./types.js";

function makeAgent(
  id: string,
  capabilities: string[],
  status: AgentProfile["status"] = "idle",
  costInput = 0.01,
  costOutput = 0.03,
): AgentProfile {
  return {
    id,
    name: `Agent ${id}`,
    provider: "anthropic",
    model: "claude-opus-4",
    capabilities,
    costPerToken: { input: costInput, output: costOutput },
    status,
    metadata: {},
  };
}

describe("scoreCapabilityMatch", () => {
  it("should return 1.0 for perfect match", () => {
    const agent = makeAgent("a", ["typescript", "testing", "react"]);
    const result = scoreCapabilityMatch(agent, ["typescript", "testing"]);

    expect(result.score).toBe(1);
    expect(result.matchedCapabilities).toEqual(["typescript", "testing"]);
    expect(result.missingCapabilities).toEqual([]);
  });

  it("should return 0.5 for partial match", () => {
    const agent = makeAgent("a", ["typescript"]);
    const result = scoreCapabilityMatch(agent, ["typescript", "testing"]);

    expect(result.score).toBe(0.5);
    expect(result.matchedCapabilities).toEqual(["typescript"]);
    expect(result.missingCapabilities).toEqual(["testing"]);
  });

  it("should return 0 for no match", () => {
    const agent = makeAgent("a", ["python"]);
    const result = scoreCapabilityMatch(agent, ["typescript", "testing"]);

    expect(result.score).toBe(0);
    expect(result.missingCapabilities).toEqual(["typescript", "testing"]);
  });

  it("should return 1.0 when no capabilities required", () => {
    const agent = makeAgent("a", ["typescript"]);
    const result = scoreCapabilityMatch(agent, []);

    expect(result.score).toBe(1);
  });

  it("should include agentId in result", () => {
    const agent = makeAgent("claude-1", ["typescript"]);
    const result = scoreCapabilityMatch(agent, ["typescript"]);
    expect(result.agentId).toBe("claude-1");
  });
});

describe("extractRequiredCapabilities", () => {
  it("should extract from requires: tags", () => {
    const tags = ["requires:typescript", "requires:testing", "bug", "urgent"];
    const result = extractRequiredCapabilities(tags);

    expect(result).toContain("typescript");
    expect(result).toContain("testing");
    expect(result).not.toContain("bug");
    expect(result).toHaveLength(2);
  });

  it("should extract from metadata.requiredCapabilities", () => {
    const tags: string[] = [];
    const metadata = { requiredCapabilities: ["react", "graphql"] };
    const result = extractRequiredCapabilities(tags, metadata);

    expect(result).toContain("react");
    expect(result).toContain("graphql");
  });

  it("should deduplicate capabilities from both sources", () => {
    const tags = ["requires:typescript"];
    const metadata = { requiredCapabilities: ["typescript", "testing"] };
    const result = extractRequiredCapabilities(tags, metadata);

    expect(result).toHaveLength(2);
    expect(result).toContain("typescript");
    expect(result).toContain("testing");
  });

  it("should return empty array for no requirements", () => {
    const result = extractRequiredCapabilities([]);
    expect(result).toEqual([]);
  });

  it("should handle missing metadata gracefully", () => {
    const result = extractRequiredCapabilities(["requires:ts"], undefined);
    expect(result).toEqual(["ts"]);
  });

  it("should handle non-array requiredCapabilities in metadata", () => {
    const result = extractRequiredCapabilities([], {
      requiredCapabilities: "not-an-array",
    });
    expect(result).toEqual([]);
  });
});

describe("findBestAgent", () => {
  const agents = [
    makeAgent("claude", ["typescript", "testing", "react"], "idle", 0.015, 0.075),
    makeAgent("gemini", ["typescript", "frontend"], "idle", 0.001, 0.004),
    makeAgent("codex", ["typescript", "testing"], "idle", 0.01, 0.03),
    makeAgent("offline-agent", ["typescript", "testing"], "offline"),
    makeAgent("blocked-agent", ["typescript", "testing"], "blocked"),
  ];

  it("should find best matching agent", () => {
    const result = findBestAgent(agents, ["typescript", "testing"]);

    expect(result).not.toBeNull();
    expect(result!.score.score).toBe(1);
    // Both claude and codex have perfect match; codex is cheaper
    expect(result!.agent.id).toBe("codex");
  });

  it("should prefer higher capability score over cost", () => {
    const result = findBestAgent(agents, ["typescript", "testing", "react"]);

    expect(result).not.toBeNull();
    // Claude matches 3/3, codex matches 2/3, gemini matches 1/3
    expect(result!.agent.id).toBe("claude");
    expect(result!.score.score).toBeCloseTo(1);
  });

  it("should exclude offline agents", () => {
    const result = findBestAgent(agents, ["typescript"]);

    expect(result).not.toBeNull();
    expect(result!.agent.id).not.toBe("offline-agent");
    expect(result!.agent.id).not.toBe("blocked-agent");
  });

  it("should exclude specific agent IDs", () => {
    const result = findBestAgent(agents, ["typescript", "testing"], {
      excludeAgentIds: ["codex"],
    });

    expect(result).not.toBeNull();
    expect(result!.agent.id).toBe("claude"); // Codex excluded, claude is next
  });

  it("should return null when no agents match", () => {
    const result = findBestAgent(agents, ["python", "machine-learning"], {
      minScore: 0.5,
    });

    expect(result).toBeNull();
  });

  it("should return null for empty agent list", () => {
    const result = findBestAgent([], ["typescript"]);
    expect(result).toBeNull();
  });

  it("should respect minScore filter", () => {
    const result = findBestAgent(agents, ["typescript", "testing", "react"], {
      minScore: 0.9,
    });

    expect(result).not.toBeNull();
    expect(result!.agent.id).toBe("claude"); // Only claude has 1.0 score
  });

  it("should match any agent when no capabilities required", () => {
    const result = findBestAgent(agents, []);

    expect(result).not.toBeNull();
    // All available agents score 1.0, cheapest wins
    expect(result!.agent.id).toBe("gemini"); // Cheapest
  });
});
