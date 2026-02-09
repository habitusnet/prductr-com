/**
 * Conflict Detector Tests
 * Tests for ConflictDetector and ZoneManager classes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ConflictDetector,
  ZoneManager,
  type FileZone,
} from "./conflict-detector.js";
import type { Task, FileConflict } from "./types.js";
import * as childProcess from "child_process";

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

// Promisify mock helper
const mockExec = (stdout: string, stderr = "") => {
  const execMock = childProcess.exec as unknown as ReturnType<typeof vi.fn>;
  execMock.mockImplementation(
    (
      _cmd: string,
      _opts: unknown,
      callback?: (
        err: Error | null,
        result: { stdout: string; stderr: string },
      ) => void,
    ) => {
      if (callback) {
        callback(null, { stdout, stderr });
      }
      return { stdout, stderr };
    },
  );
};

const mockExecError = (error: Error) => {
  const execMock = childProcess.exec as unknown as ReturnType<typeof vi.fn>;
  execMock.mockImplementation(
    (
      _cmd: string,
      _opts: unknown,
      callback?: (
        err: Error | null,
        result: { stdout: string; stderr: string },
      ) => void,
    ) => {
      if (callback) {
        callback(error, { stdout: "", stderr: "" });
      }
      return {};
    },
  );
};

describe("ConflictDetector", () => {
  let detector: ConflictDetector;
  const projectRoot = "/test/project";

  beforeEach(() => {
    detector = new ConflictDetector(projectRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectOverlappingTasks", () => {
    it("should detect tasks working on the same file", async () => {
      const tasks: Task[] = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          projectId: "project-1",
          title: "Task 1",
          status: "in_progress",
          priority: "medium",
          assignedTo: "claude",
          files: ["src/auth.ts", "src/utils.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          projectId: "project-1",
          title: "Task 2",
          status: "in_progress",
          priority: "medium",
          assignedTo: "gemini",
          files: ["src/auth.ts", "src/api.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const conflicts = await detector.detectOverlappingTasks(
        tasks,
        "project-1",
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].filePath).toBe("src/auth.ts");
      expect(conflicts[0].agents).toContain("claude");
      expect(conflicts[0].agents).toContain("gemini");
      expect(conflicts[0].strategy).toBe("review");
    });

    it("should not detect conflicts for non-overlapping tasks", async () => {
      const tasks: Task[] = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          projectId: "project-1",
          title: "Task 1",
          status: "in_progress",
          priority: "medium",
          assignedTo: "claude",
          files: ["src/auth.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          projectId: "project-1",
          title: "Task 2",
          status: "in_progress",
          priority: "medium",
          assignedTo: "gemini",
          files: ["src/api.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const conflicts = await detector.detectOverlappingTasks(
        tasks,
        "project-1",
      );
      expect(conflicts).toHaveLength(0);
    });

    it("should ignore tasks that are not in_progress", async () => {
      const tasks: Task[] = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          projectId: "project-1",
          title: "Task 1",
          status: "in_progress",
          priority: "medium",
          assignedTo: "claude",
          files: ["src/auth.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          projectId: "project-1",
          title: "Task 2",
          status: "completed", // Not in_progress
          priority: "medium",
          assignedTo: "gemini",
          files: ["src/auth.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const conflicts = await detector.detectOverlappingTasks(
        tasks,
        "project-1",
      );
      expect(conflicts).toHaveLength(0);
    });

    it("should detect multiple conflicts", async () => {
      const tasks: Task[] = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          projectId: "project-1",
          title: "Task 1",
          status: "in_progress",
          priority: "medium",
          assignedTo: "claude",
          files: ["src/auth.ts", "src/utils.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          projectId: "project-1",
          title: "Task 2",
          status: "in_progress",
          priority: "medium",
          assignedTo: "gemini",
          files: ["src/auth.ts", "src/utils.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const conflicts = await detector.detectOverlappingTasks(
        tasks,
        "project-1",
      );
      expect(conflicts).toHaveLength(2);
    });

    it("should filter out tasks without assignedTo", async () => {
      const tasks: Task[] = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          projectId: "project-1",
          title: "Task 1",
          status: "in_progress",
          priority: "medium",
          // No assignedTo
          files: ["src/auth.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          projectId: "project-1",
          title: "Task 2",
          status: "in_progress",
          priority: "medium",
          assignedTo: "gemini",
          files: ["src/auth.ts"],
          dependencies: [],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const conflicts = await detector.detectOverlappingTasks(
        tasks,
        "project-1",
      );
      expect(conflicts).toHaveLength(1);
      // Only gemini should be in agents (undefined filtered out)
      expect(conflicts[0].agents).toEqual(["gemini"]);
    });
  });

  describe("detectGitConflicts", () => {
    it("should detect files modified in both branches", async () => {
      // First call returns files for branch1
      // Second call returns files for branch2
      const execMock = childProcess.exec as unknown as ReturnType<typeof vi.fn>;
      let callCount = 0;
      execMock.mockImplementation(
        (
          _cmd: string,
          _opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          callCount++;
          const stdout =
            callCount === 1
              ? "src/auth.ts\nsrc/utils.ts\n"
              : "src/auth.ts\nsrc/api.ts\n";
          if (callback) {
            callback(null, { stdout, stderr: "" });
          }
          return { stdout, stderr: "" };
        },
      );

      const conflicts = await detector.detectGitConflicts("branch1", "branch2");

      expect(conflicts).toContain("src/auth.ts");
      expect(conflicts).not.toContain("src/utils.ts");
      expect(conflicts).not.toContain("src/api.ts");
    });

    it("should return empty array when git command fails", async () => {
      mockExecError(new Error("Git error"));

      const conflicts = await detector.detectGitConflicts("branch1", "branch2");
      expect(conflicts).toEqual([]);
    });

    it("should handle empty branch diff", async () => {
      mockExec("");

      const conflicts = await detector.detectGitConflicts("branch1", "branch2");
      expect(conflicts).toEqual([]);
    });
  });

  describe("getFileLastModifier", () => {
    it("should return the last modifier name", async () => {
      mockExec("John Doe\n");

      const result = await detector.getFileLastModifier("src/auth.ts");
      expect(result).toBe("John Doe");
    });

    it("should return null on error", async () => {
      mockExecError(new Error("Git error"));

      const result = await detector.getFileLastModifier("src/auth.ts");
      expect(result).toBeNull();
    });

    it("should return null for empty response", async () => {
      mockExec("");

      const result = await detector.getFileLastModifier("src/auth.ts");
      expect(result).toBeNull();
    });
  });

  describe("getFilesModifiedBy", () => {
    it("should return files modified by author", async () => {
      mockExec("src/auth.ts\nsrc/utils.ts\nsrc/auth.ts\n"); // Duplicate to test dedup

      const result = await detector.getFilesModifiedBy("Claude");
      expect(result).toHaveLength(2);
      expect(result).toContain("src/auth.ts");
      expect(result).toContain("src/utils.ts");
    });

    it("should support since date filter", async () => {
      mockExec("src/auth.ts\n");

      const since = new Date("2024-01-01");
      const result = await detector.getFilesModifiedBy("Claude", since);
      expect(result).toHaveLength(1);
    });

    it("should return empty array on error", async () => {
      mockExecError(new Error("Git error"));

      const result = await detector.getFilesModifiedBy("Claude");
      expect(result).toEqual([]);
    });
  });

  describe("resolveStrategy", () => {
    it("should return wait for lock strategy", () => {
      const conflict: FileConflict = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "project-1",
        filePath: "src/auth.ts",
        agents: ["claude", "gemini"],
        strategy: "lock",
        createdAt: new Date(),
      };

      const result = detector.resolveStrategy(conflict, "lock");
      expect(result).toBe("wait");
    });

    it("should return merge for merge strategy", () => {
      const conflict: FileConflict = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "project-1",
        filePath: "src/auth.ts",
        agents: ["claude", "gemini"],
        strategy: "merge",
        createdAt: new Date(),
      };

      const result = detector.resolveStrategy(conflict, "merge");
      expect(result).toBe("merge");
    });

    it("should return wait for zone strategy", () => {
      const conflict: FileConflict = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "project-1",
        filePath: "src/auth.ts",
        agents: ["claude", "gemini"],
        strategy: "zone",
        createdAt: new Date(),
      };

      const result = detector.resolveStrategy(conflict, "zone");
      expect(result).toBe("wait");
    });

    it("should return human for review strategy", () => {
      const conflict: FileConflict = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "project-1",
        filePath: "src/auth.ts",
        agents: ["claude", "gemini"],
        strategy: "review",
        createdAt: new Date(),
      };

      const result = detector.resolveStrategy(conflict, "review");
      expect(result).toBe("human");
    });

    it("should use project strategy as fallback", () => {
      const conflict: FileConflict = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "project-1",
        filePath: "src/auth.ts",
        agents: ["claude", "gemini"],
        strategy: "lock", // Conflict strategy
        createdAt: new Date(),
      };

      // Conflict has its own strategy, should use that
      const result = detector.resolveStrategy(conflict, "merge");
      expect(result).toBe("wait"); // Uses conflict's 'lock' strategy
    });
  });

  describe("isFileSafeToModify", () => {
    it("should return safe for new files (no git history)", async () => {
      mockExec("");

      const result = await detector.isFileSafeToModify(
        "src/new-file.ts",
        "Claude",
      );
      expect(result.safe).toBe(true);
    });

    it("should return safe when same agent modified recently", async () => {
      const recentDate = new Date().toISOString();
      mockExec(`Claude|${recentDate}`);

      const result = await detector.isFileSafeToModify("src/auth.ts", "Claude");
      expect(result.safe).toBe(true);
      expect(result.lastModifier).toBe("Claude");
    });

    it("should return unsafe when different agent modified recently", async () => {
      const recentDate = new Date().toISOString();
      mockExec(`Gemini|${recentDate}`);

      const result = await detector.isFileSafeToModify("src/auth.ts", "Claude");
      expect(result.safe).toBe(false);
      expect(result.lastModifier).toBe("Gemini");
    });

    it("should return safe when different agent modified long ago", async () => {
      const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      mockExec(`Gemini|${oldDate}`);

      const result = await detector.isFileSafeToModify(
        "src/auth.ts",
        "Claude",
        5,
      );
      expect(result.safe).toBe(true);
    });

    it("should return safe on git error", async () => {
      mockExecError(new Error("Git error"));

      const result = await detector.isFileSafeToModify("src/auth.ts", "Claude");
      expect(result.safe).toBe(true);
    });

    it("should return safe for invalid git log format", async () => {
      mockExec("invalid-format");

      const result = await detector.isFileSafeToModify("src/auth.ts", "Claude");
      expect(result.safe).toBe(true);
    });
  });
});

describe("ZoneManager", () => {
  describe("getFileOwner", () => {
    it("should return owner for matching file", () => {
      const zones: FileZone[] = [
        { pattern: "src/auth/**", owner: "claude", readonly: false },
        { pattern: "src/api/**", owner: "gemini", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.getFileOwner("src/auth/login.ts")).toBe("claude");
      expect(manager.getFileOwner("src/api/routes.ts")).toBe("gemini");
    });

    it("should return null for unmatched file", () => {
      const zones: FileZone[] = [
        { pattern: "src/auth/**", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.getFileOwner("src/utils.ts")).toBeNull();
    });

    it("should match first matching zone", () => {
      const zones: FileZone[] = [
        { pattern: "src/**", owner: "claude", readonly: false },
        { pattern: "src/auth/**", owner: "gemini", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      // First matching pattern wins
      expect(manager.getFileOwner("src/auth/login.ts")).toBe("claude");
    });
  });

  describe("canModify", () => {
    it("should allow owner to modify", () => {
      const zones: FileZone[] = [
        { pattern: "src/auth/**", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.canModify("src/auth/login.ts", "claude")).toBe(true);
    });

    it("should deny non-owner modification", () => {
      const zones: FileZone[] = [
        { pattern: "src/auth/**", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.canModify("src/auth/login.ts", "gemini")).toBe(false);
    });

    it("should deny modification for readonly zones", () => {
      const zones: FileZone[] = [
        { pattern: "src/config/**", owner: "claude", readonly: true },
      ];
      const manager = new ZoneManager(zones);

      // Even owner cannot modify readonly
      expect(manager.canModify("src/config/settings.ts", "claude")).toBe(false);
    });

    it("should allow modification for unzoned files", () => {
      const zones: FileZone[] = [
        { pattern: "src/auth/**", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.canModify("src/utils.ts", "gemini")).toBe(true);
    });
  });

  describe("pattern matching", () => {
    it("should match double star patterns", () => {
      const zones: FileZone[] = [
        { pattern: "src/**/*.ts", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.getFileOwner("src/auth/login.ts")).toBe("claude");
      expect(manager.getFileOwner("src/deep/nested/file.ts")).toBe("claude");
      expect(manager.getFileOwner("src/auth/login.js")).toBeNull();
    });

    it("should match single star patterns", () => {
      const zones: FileZone[] = [
        { pattern: "src/*.ts", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.getFileOwner("src/utils.ts")).toBe("claude");
      expect(manager.getFileOwner("src/auth/login.ts")).toBeNull(); // No nested
    });

    it("should match question mark patterns", () => {
      const zones: FileZone[] = [
        { pattern: "src/file?.ts", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.getFileOwner("src/file1.ts")).toBe("claude");
      expect(manager.getFileOwner("src/fileA.ts")).toBe("claude");
      expect(manager.getFileOwner("src/file.ts")).toBeNull();
      expect(manager.getFileOwner("src/file12.ts")).toBeNull();
    });

    it("should match exact patterns", () => {
      const zones: FileZone[] = [
        { pattern: "src/main.ts", owner: "claude", readonly: false },
      ];
      const manager = new ZoneManager(zones);

      expect(manager.getFileOwner("src/main.ts")).toBe("claude");
      expect(manager.getFileOwner("src/main.tsx")).toBeNull();
    });
  });
});
