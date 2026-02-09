import { z } from "zod";

// ============================================================================
// Zone Definition Schemas
// ============================================================================

export const ZoneDefinitionSchema = z.object({
  pattern: z.string(), // glob pattern (e.g., "src/frontend/**")
  owners: z.array(z.string()), // agent IDs
  shared: z.boolean().default(false), // if true, all agents can access
  description: z.string().optional(),
});

export type ZoneDefinition = z.infer<typeof ZoneDefinitionSchema>;

export const ProjectZoneConfigSchema = z.object({
  zones: z.array(ZoneDefinitionSchema).default([]),
  defaultPolicy: z
    .enum(["allow", "deny"])
    .default("allow"), // for files not matching any zone
});

export type ProjectZoneConfig = z.infer<typeof ProjectZoneConfigSchema>;

export type ZoneAccessResult = {
  allowed: boolean;
  zone?: ZoneDefinition;
  reason: string;
};

// ============================================================================
// ZoneMatcher Class
// ============================================================================

export class ZoneMatcher {
  constructor(private config: ProjectZoneConfig) {}

  /**
   * Check if an agent can access a file path.
   */
  checkAccess(filePath: string, agentId: string): ZoneAccessResult {
    for (const zone of this.config.zones) {
      if (this.matchPattern(filePath, zone.pattern)) {
        if (zone.shared) {
          return { allowed: true, zone, reason: "File is in a shared zone" };
        }
        if (zone.owners.includes(agentId)) {
          return { allowed: true, zone, reason: "Agent owns this zone" };
        }
        return {
          allowed: false,
          zone,
          reason: `File is owned by [${zone.owners.join(", ")}], not ${agentId}`,
        };
      }
    }

    // No zone matched — use default policy
    if (this.config.defaultPolicy === "deny") {
      return { allowed: false, reason: "File is not in any zone and default policy is deny" };
    }
    return { allowed: true, reason: "File is not in any zone (unzoned, allowed by default)" };
  }

  /**
   * Get all zones that match a file path.
   */
  getMatchingZones(filePath: string): ZoneDefinition[] {
    return this.config.zones.filter((zone) =>
      this.matchPattern(filePath, zone.pattern),
    );
  }

  /**
   * Get all files patterns owned by an agent.
   */
  getAgentZones(agentId: string): ZoneDefinition[] {
    return this.config.zones.filter(
      (zone) => zone.owners.includes(agentId) || zone.shared,
    );
  }

  /**
   * Simple glob pattern matching (matches ZoneManager in conflict-detector.ts).
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\*\*/g, "<<DOUBLESTAR>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<DOUBLESTAR>>/g, ".*")
      .replace(/\?/g, ".");

    return new RegExp(`^${regex}$`).test(filePath);
  }
}
