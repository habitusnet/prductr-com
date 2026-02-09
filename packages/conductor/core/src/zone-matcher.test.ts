import { describe, it, expect } from "vitest";
import {
  ZoneMatcher,
  ZoneDefinitionSchema,
  ProjectZoneConfigSchema,
  type ProjectZoneConfig,
} from "./zone-matcher.js";

describe("ZoneMatcher", () => {
  describe("schema validation", () => {
    it("should validate a ZoneDefinition", () => {
      const result = ZoneDefinitionSchema.parse({
        pattern: "src/frontend/**",
        owners: ["claude"],
        shared: false,
      });
      expect(result.pattern).toBe("src/frontend/**");
      expect(result.owners).toEqual(["claude"]);
    });

    it("should default shared to false", () => {
      const result = ZoneDefinitionSchema.parse({
        pattern: "docs/**",
        owners: [],
      });
      expect(result.shared).toBe(false);
    });

    it("should validate a ProjectZoneConfig", () => {
      const result = ProjectZoneConfigSchema.parse({
        zones: [
          { pattern: "src/**", owners: ["claude"], shared: false },
        ],
        defaultPolicy: "allow",
      });
      expect(result.zones).toHaveLength(1);
      expect(result.defaultPolicy).toBe("allow");
    });

    it("should default zones and defaultPolicy", () => {
      const result = ProjectZoneConfigSchema.parse({});
      expect(result.zones).toEqual([]);
      expect(result.defaultPolicy).toBe("allow");
    });
  });

  describe("checkAccess", () => {
    const config: ProjectZoneConfig = {
      zones: [
        {
          pattern: "src/frontend/**",
          owners: ["claude"],
          shared: false,
        },
        {
          pattern: "src/backend/**",
          owners: ["gemini"],
          shared: false,
        },
        {
          pattern: "docs/**",
          owners: [],
          shared: true,
        },
        {
          pattern: "src/shared/**",
          owners: ["claude", "gemini"],
          shared: false,
        },
      ],
      defaultPolicy: "allow",
    };

    it("should allow owner to access their zone", () => {
      const matcher = new ZoneMatcher(config);
      const result = matcher.checkAccess(
        "src/frontend/App.tsx",
        "claude",
      );
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Agent owns this zone");
    });

    it("should deny non-owner access to a zone", () => {
      const matcher = new ZoneMatcher(config);
      const result = matcher.checkAccess(
        "src/frontend/App.tsx",
        "gemini",
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("owned by [claude]");
    });

    it("should allow all agents to access shared zones", () => {
      const matcher = new ZoneMatcher(config);

      const r1 = matcher.checkAccess("docs/README.md", "claude");
      expect(r1.allowed).toBe(true);
      expect(r1.reason).toBe("File is in a shared zone");

      const r2 = matcher.checkAccess("docs/README.md", "gemini");
      expect(r2.allowed).toBe(true);

      const r3 = matcher.checkAccess("docs/README.md", "unknown-agent");
      expect(r3.allowed).toBe(true);
    });

    it("should allow multiple owners for a zone", () => {
      const matcher = new ZoneMatcher(config);

      const r1 = matcher.checkAccess("src/shared/utils.ts", "claude");
      expect(r1.allowed).toBe(true);

      const r2 = matcher.checkAccess("src/shared/utils.ts", "gemini");
      expect(r2.allowed).toBe(true);

      const r3 = matcher.checkAccess("src/shared/utils.ts", "codex");
      expect(r3.allowed).toBe(false);
    });

    it("should allow access to unzoned files with default 'allow' policy", () => {
      const matcher = new ZoneMatcher(config);
      const result = matcher.checkAccess("package.json", "anyone");
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain("unzoned");
    });

    it("should deny access to unzoned files with default 'deny' policy", () => {
      const strictConfig: ProjectZoneConfig = {
        ...config,
        defaultPolicy: "deny",
      };
      const matcher = new ZoneMatcher(strictConfig);
      const result = matcher.checkAccess("package.json", "anyone");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("default policy is deny");
    });

    it("should match nested paths with double-star globs", () => {
      const matcher = new ZoneMatcher(config);
      const result = matcher.checkAccess(
        "src/frontend/components/deep/Component.tsx",
        "claude",
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("getMatchingZones", () => {
    it("should return all matching zones for a file", () => {
      const config: ProjectZoneConfig = {
        zones: [
          { pattern: "src/**", owners: ["claude"], shared: false },
          { pattern: "src/frontend/**", owners: ["gemini"], shared: false },
        ],
        defaultPolicy: "allow",
      };
      const matcher = new ZoneMatcher(config);

      const zones = matcher.getMatchingZones("src/frontend/App.tsx");
      expect(zones).toHaveLength(2);
    });

    it("should return empty array for unmatched files", () => {
      const config: ProjectZoneConfig = {
        zones: [
          { pattern: "src/**", owners: ["claude"], shared: false },
        ],
        defaultPolicy: "allow",
      };
      const matcher = new ZoneMatcher(config);

      const zones = matcher.getMatchingZones("package.json");
      expect(zones).toHaveLength(0);
    });
  });

  describe("getAgentZones", () => {
    it("should return zones owned by an agent", () => {
      const config: ProjectZoneConfig = {
        zones: [
          { pattern: "src/frontend/**", owners: ["claude"], shared: false },
          { pattern: "src/backend/**", owners: ["gemini"], shared: false },
          { pattern: "docs/**", owners: [], shared: true },
        ],
        defaultPolicy: "allow",
      };
      const matcher = new ZoneMatcher(config);

      const claudeZones = matcher.getAgentZones("claude");
      expect(claudeZones).toHaveLength(2); // frontend + shared docs

      const geminiZones = matcher.getAgentZones("gemini");
      expect(geminiZones).toHaveLength(2); // backend + shared docs
    });
  });

  describe("glob pattern matching", () => {
    it("should match single star patterns", () => {
      const config: ProjectZoneConfig = {
        zones: [
          { pattern: "src/*.ts", owners: ["claude"], shared: false },
        ],
        defaultPolicy: "allow",
      };
      const matcher = new ZoneMatcher(config);

      expect(matcher.checkAccess("src/index.ts", "claude").allowed).toBe(true);
      expect(matcher.checkAccess("src/deep/index.ts", "claude").allowed).toBe(
        true,
      ); // unzoned, default allow
      // single star doesn't match path separators
      const deepResult = matcher.checkAccess("src/deep/index.ts", "gemini");
      expect(deepResult.allowed).toBe(true); // unzoned
    });

    it("should match question mark patterns", () => {
      const config: ProjectZoneConfig = {
        zones: [
          { pattern: "src/?.ts", owners: ["claude"], shared: false },
        ],
        defaultPolicy: "allow",
      };
      const matcher = new ZoneMatcher(config);

      expect(matcher.checkAccess("src/a.ts", "claude").allowed).toBe(true);
      expect(
        matcher.checkAccess("src/ab.ts", "claude").allowed,
      ).toBe(true); // unzoned
    });
  });
});
