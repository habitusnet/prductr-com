// Types
export * from "./types.js";

// Agent Profiles
export {
  DEFAULT_AGENT_PROFILES,
  MODEL_PRICING,
  createAgentProfile,
  hasCapability,
  hasAllCapabilities,
  getAgentsWithCapability,
  estimateCost,
} from "./agent-profiles.js";

// Conflict Detection
export {
  ConflictDetector,
  ZoneManager,
  type FileZone,
} from "./conflict-detector.js";

// Zone Ownership
export {
  ZoneMatcher,
  ZoneDefinitionSchema,
  ProjectZoneConfigSchema,
  type ZoneDefinition,
  type ProjectZoneConfig,
  type ZoneAccessResult,
} from "./zone-matcher.js";

// Capability Matching
export {
  scoreCapabilityMatch,
  extractRequiredCapabilities,
  findBestAgent,
  type CapabilityScore,
} from "./capability-matcher.js";

// Utility functions
export function generateId(): string {
  return crypto.randomUUID();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < attempts - 1) {
        await sleep(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  throw lastError;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 * Format token count for display
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Parse capability requirements from task tags
 */
export function parseCapabilityRequirements(tags: string[]): string[] {
  return tags
    .filter((t) => t.startsWith("requires:"))
    .map((t) => t.replace("requires:", ""));
}

/**
 * Check if a task is blocked by dependencies
 */
export function isTaskBlocked(
  task: { dependencies: string[]; blockedBy?: string[] },
  completedTaskIds: Set<string>,
): boolean {
  // Check explicit blockers
  if (task.blockedBy && task.blockedBy.length > 0) {
    return true;
  }

  // Check dependencies
  return task.dependencies.some((dep) => !completedTaskIds.has(dep));
}

/**
 * Priority weights for scoring
 */
export const PRIORITY_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

/**
 * Get numeric weight for a priority
 */
export function getPriorityWeight(
  priority: keyof typeof PRIORITY_WEIGHTS,
): number {
  return PRIORITY_WEIGHTS[priority];
}
