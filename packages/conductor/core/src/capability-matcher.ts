import type { AgentProfile } from "./types.js";

export interface CapabilityScore {
  agentId: string;
  score: number;
  matchedCapabilities: string[];
  missingCapabilities: string[];
}

/**
 * Score how well an agent's capabilities match a set of required capabilities.
 * Returns a value from 0 to 1 (1 = perfect match).
 */
export function scoreCapabilityMatch(
  agent: AgentProfile,
  requiredCapabilities: string[],
): CapabilityScore {
  if (requiredCapabilities.length === 0) {
    return {
      agentId: agent.id,
      score: 1, // No requirements = any agent is a perfect match
      matchedCapabilities: [],
      missingCapabilities: [],
    };
  }

  const agentCaps = new Set(agent.capabilities);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const cap of requiredCapabilities) {
    if (agentCaps.has(cap)) {
      matched.push(cap);
    } else {
      missing.push(cap);
    }
  }

  const score = matched.length / requiredCapabilities.length;

  return {
    agentId: agent.id,
    score,
    matchedCapabilities: matched,
    missingCapabilities: missing,
  };
}

/**
 * Extract required capabilities from task tags and metadata.
 * Looks for tags like "requires:typescript", "requires:testing"
 * and metadata.requiredCapabilities array.
 */
export function extractRequiredCapabilities(
  tags: string[],
  metadata?: Record<string, unknown>,
): string[] {
  const fromTags = tags
    .filter((t) => t.startsWith("requires:"))
    .map((t) => t.replace("requires:", ""));

  const fromMetadata = Array.isArray(metadata?.["requiredCapabilities"])
    ? (metadata["requiredCapabilities"] as string[])
    : [];

  return [...new Set([...fromTags, ...fromMetadata])];
}

/**
 * Find the best available agent for a set of required capabilities.
 * Filters agents by:
 * 1. Status must be 'idle' or 'working' (not 'offline' or 'blocked')
 * 2. Capability score > 0 (must match at least one capability, or no caps required)
 * 3. Sorted by score descending, then by cost ascending
 *
 * Returns the best matching agent, or null if none found.
 */
export function findBestAgent(
  agents: AgentProfile[],
  requiredCapabilities: string[],
  options?: {
    excludeAgentIds?: string[];
    minScore?: number;
  },
): { agent: AgentProfile; score: CapabilityScore } | null {
  const excludeSet = new Set(options?.excludeAgentIds ?? []);
  const minScore = options?.minScore ?? 0;

  const candidates = agents
    .filter((a) => {
      // Must be available
      if (a.status === "offline" || a.status === "blocked") return false;
      // Must not be excluded
      if (excludeSet.has(a.id)) return false;
      return true;
    })
    .map((agent) => ({
      agent,
      score: scoreCapabilityMatch(agent, requiredCapabilities),
    }))
    .filter((c) => c.score.score > minScore)
    .sort((a, b) => {
      // Sort by score descending
      if (b.score.score !== a.score.score) {
        return b.score.score - a.score.score;
      }
      // Then by cost ascending (prefer cheaper agents)
      const costA = a.agent.costPerToken.input + a.agent.costPerToken.output;
      const costB = b.agent.costPerToken.input + b.agent.costPerToken.output;
      return costA - costB;
    });

  const best = candidates[0];
  return best ?? null;
}
