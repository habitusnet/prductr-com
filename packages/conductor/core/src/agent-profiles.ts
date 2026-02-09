import type { AgentProfile } from "./types.js";

/**
 * Default agent profiles with known capabilities and pricing
 */
export const DEFAULT_AGENT_PROFILES: Record<string, AgentProfile> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    provider: "anthropic",
    model: "claude-opus-4",
    capabilities: [
      "typescript",
      "javascript",
      "react",
      "nextjs",
      "nodejs",
      "python",
      "architecture",
      "testing",
      "code-review",
      "refactoring",
      "mcp",
      "documentation",
    ],
    costPerToken: {
      input: 0.000015, // Claude Opus 4
      output: 0.000075,
    },
    status: "idle",
    metadata: {},
  },
  "claude-sonnet": {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    provider: "anthropic",
    model: "claude-sonnet-4",
    capabilities: [
      "typescript",
      "javascript",
      "react",
      "nodejs",
      "testing",
      "refactoring",
    ],
    costPerToken: {
      input: 0.000003, // Claude Sonnet 4
      output: 0.000015,
    },
    status: "idle",
    metadata: {},
  },
  "claude-haiku": {
    id: "claude-haiku",
    name: "Claude Haiku",
    provider: "anthropic",
    model: "claude-haiku",
    capabilities: ["typescript", "javascript", "simple-tasks", "formatting"],
    costPerToken: {
      input: 0.00000025, // Claude Haiku
      output: 0.00000125,
    },
    status: "idle",
    metadata: {},
  },
  gemini: {
    id: "gemini",
    name: "Gemini 2.0 Flash",
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: [
      "typescript",
      "javascript",
      "react",
      "nextjs",
      "frontend",
      "css",
      "accessibility",
      "documentation",
      "research",
    ],
    costPerToken: {
      input: 0.0000001, // Gemini 2.0 Flash
      output: 0.0000004,
    },
    status: "idle",
    metadata: {},
  },
  codex: {
    id: "codex",
    name: "OpenAI Codex CLI",
    provider: "openai",
    model: "codex",
    capabilities: [
      "typescript",
      "javascript",
      "testing",
      "linting",
      "automation",
      "ci-cd",
      "refactoring",
    ],
    costPerToken: {
      input: 0, // Free tier
      output: 0,
    },
    status: "idle",
    metadata: {},
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    capabilities: [
      "typescript",
      "javascript",
      "python",
      "architecture",
      "documentation",
    ],
    costPerToken: {
      input: 0.0000025, // GPT-4o
      output: 0.00001,
    },
    status: "idle",
    metadata: {},
  },
  /**
   * Z.ai GLM-4.7 via Claude Code
   * Uses z.ai as Anthropic-compatible proxy for cost-effective coding
   * Configure Claude Code with:
   *   ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
   *   ANTHROPIC_AUTH_TOKEN=your_zai_api_key
   * @see https://docs.z.ai/devpack/tool/claude
   */
  "zai-glm": {
    id: "zai-glm",
    name: "Z.ai GLM-4.7 (via Claude Code)",
    provider: "anthropic", // Uses Anthropic-compatible API
    model: "glm-4.7",
    capabilities: [
      "typescript",
      "javascript",
      "python",
      "java",
      "go",
      "rust",
      "csharp",
      "php",
      "ruby",
      "swift",
      "kotlin",
      "react",
      "nextjs",
      "nodejs",
      "testing",
      "refactoring",
      "code-review",
      "mcp",
      "vision",
      "web-search",
    ],
    costPerToken: {
      input: 0, // Subscription-based pricing
      output: 0,
    },
    status: "idle",
    metadata: {
      pricingModel: "subscription",
      plans: {
        lite: { price: 3, promptsPer5Hours: 120 },
        pro: { price: 15, promptsPer5Hours: 600 },
        max: { price: 99, promptsPer5Hours: 2400 },
      },
      baseUrl: "https://api.z.ai/api/anthropic",
      tools: ["claude-code", "cline", "roo-code", "kilo-code", "opencode", "crush", "goose"],
    },
  },
};

/**
 * Model pricing per million tokens (for reference and calculations)
 */
export const MODEL_PRICING = {
  "claude-opus-4": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku": { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  "gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gemini-2.0-pro": { inputPerMillion: 1.25, outputPerMillion: 5 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  codex: { inputPerMillion: 0, outputPerMillion: 0 },
  // Z.ai GLM models - subscription-based pricing ($3-99/month)
  // Lite: ~120 prompts/5hrs, Pro: ~600, Max: ~2400
  "glm-4.7": { inputPerMillion: 0, outputPerMillion: 0 },
  "glm-4.5-air": { inputPerMillion: 0, outputPerMillion: 0 },
} as const;

/**
 * Create an agent profile with defaults
 */
export function createAgentProfile(
  id: string,
  overrides: Partial<AgentProfile> = {},
): AgentProfile {
  // Filter out undefined values from overrides
  const cleanOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined),
  ) as Partial<AgentProfile>;

  const base = DEFAULT_AGENT_PROFILES[id];

  if (base) {
    return { ...base, ...cleanOverrides, id };
  }

  // For custom agents (not in defaults), provider and model should be specified
  // Fall back to 'custom' provider if not specified
  return {
    id,
    name: cleanOverrides.name || id,
    provider: cleanOverrides.provider || "custom",
    model: cleanOverrides.model || id,
    capabilities: cleanOverrides.capabilities || [],
    costPerToken: cleanOverrides.costPerToken || { input: 0, output: 0 },
    status: cleanOverrides.status || "idle",
    metadata: cleanOverrides.metadata || {},
    ...cleanOverrides,
  };
}

/**
 * Check if an agent has a specific capability
 */
export function hasCapability(
  agent: AgentProfile,
  capability: string,
): boolean {
  return agent.capabilities.includes(capability);
}

/**
 * Check if an agent has all required capabilities
 */
export function hasAllCapabilities(
  agent: AgentProfile,
  capabilities: string[],
): boolean {
  return capabilities.every((cap) => agent.capabilities.includes(cap));
}

/**
 * Get agents that have a specific capability
 */
export function getAgentsWithCapability(
  agents: AgentProfile[],
  capability: string,
): AgentProfile[] {
  return agents.filter((agent) => hasCapability(agent, capability));
}

/**
 * Calculate estimated cost for a task
 */
export function estimateCost(
  agent: AgentProfile,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    inputTokens * agent.costPerToken.input +
    outputTokens * agent.costPerToken.output
  );
}
