import { exec } from "child_process";
import { promisify } from "util";
import type { Task, FileConflict, ConflictStrategy } from "./types.js";

const execAsync = promisify(exec);

/**
 * Conflict detection and resolution utilities
 */
export class ConflictDetector {
  constructor(private projectRoot: string) {}

  /**
   * Detect tasks that are working on overlapping files
   */
  async detectOverlappingTasks(
    tasks: Task[],
    projectId: string,
  ): Promise<FileConflict[]> {
    const conflicts: FileConflict[] = [];
    const fileToTasks = new Map<string, Task[]>();

    // Group in-progress tasks by file
    for (const task of tasks) {
      if (task.status !== "in_progress") continue;
      for (const file of task.files) {
        const existing = fileToTasks.get(file) || [];
        existing.push(task);
        fileToTasks.set(file, existing);
      }
    }

    // Find files with multiple tasks
    for (const [file, fileTasks] of fileToTasks) {
      if (fileTasks.length > 1) {
        conflicts.push({
          id: crypto.randomUUID(),
          projectId,
          filePath: file,
          agents: fileTasks
            .map((t) => t.assignedTo)
            .filter((a): a is string => a !== undefined),
          strategy: "review", // Default to human review for detected conflicts
          createdAt: new Date(),
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect files modified in multiple git branches
   */
  async detectGitConflicts(
    branch1: string,
    branch2: string,
    baseBranch = "main",
  ): Promise<string[]> {
    try {
      // Get files modified in each branch compared to base
      const { stdout: files1 } = await execAsync(
        `git diff --name-only ${baseBranch}...${branch1}`,
        { cwd: this.projectRoot },
      );
      const { stdout: files2 } = await execAsync(
        `git diff --name-only ${baseBranch}...${branch2}`,
        { cwd: this.projectRoot },
      );

      const set1 = new Set(
        files1
          .trim()
          .split("\n")
          .filter((f) => f),
      );
      const set2 = new Set(
        files2
          .trim()
          .split("\n")
          .filter((f) => f),
      );

      // Find intersection (files modified in both branches)
      return [...set1].filter((f) => set2.has(f));
    } catch {
      return [];
    }
  }

  /**
   * Get the last modifier of a file
   */
  async getFileLastModifier(filePath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        `git log -1 --format='%an' -- "${filePath}"`,
        { cwd: this.projectRoot },
      );
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get files modified by a specific author
   */
  async getFilesModifiedBy(author: string, since?: Date): Promise<string[]> {
    try {
      let command = `git log --author="${author}" --name-only --format=''`;
      if (since) {
        command += ` --since="${since.toISOString()}"`;
      }

      const { stdout } = await execAsync(command, { cwd: this.projectRoot });
      const files = stdout
        .trim()
        .split("\n")
        .filter((f) => f);
      return [...new Set(files)];
    } catch {
      return [];
    }
  }

  /**
   * Determine resolution action based on strategy
   */
  resolveStrategy(
    conflict: FileConflict,
    projectStrategy: ConflictStrategy,
  ): "wait" | "merge" | "human" {
    // If conflict has its own strategy, use that
    const strategy = conflict.strategy || projectStrategy;

    switch (strategy) {
      case "lock":
        // Second agent waits for lock release
        return "wait";
      case "merge":
        // Attempt automatic merge
        return "merge";
      case "zone":
        // Zone-based - check if agents are in different zones
        // Simplified for MVP: just wait
        return "wait";
      case "review":
      default:
        // Human review required
        return "human";
    }
  }

  /**
   * Check if a file is safe to modify (no recent changes by others)
   */
  async isFileSafeToModify(
    filePath: string,
    agentName: string,
    windowMinutes = 5,
  ): Promise<{ safe: boolean; lastModifier?: string; lastModified?: Date }> {
    try {
      const { stdout } = await execAsync(
        `git log -1 --format='%an|%aI' -- "${filePath}"`,
        { cwd: this.projectRoot },
      );

      if (!stdout.trim()) {
        return { safe: true }; // No git history, safe to create
      }

      const parts = stdout.trim().split("|");
      const lastModifier = parts[0];
      const lastModifiedStr = parts[1];

      if (!lastModifier || !lastModifiedStr) {
        return { safe: true }; // Invalid format, assume safe
      }

      const lastModified = new Date(lastModifiedStr);
      const windowMs = windowMinutes * 60 * 1000;
      const isRecent = Date.now() - lastModified.getTime() < windowMs;

      // Safe if not recently modified by another agent
      const safe = !isRecent || lastModifier === agentName;

      return { safe, lastModifier, lastModified };
    } catch {
      return { safe: true }; // Can't determine, assume safe
    }
  }
}

/**
 * Zone-based file ownership for conflict prevention
 */
export interface FileZone {
  pattern: string; // glob pattern
  owner: string; // agent ID
  readonly: boolean;
}

export class ZoneManager {
  constructor(private zones: FileZone[]) {}

  /**
   * Get the owner of a file based on zone patterns
   */
  getFileOwner(filePath: string): string | null {
    for (const zone of this.zones) {
      if (this.matchPattern(filePath, zone.pattern)) {
        return zone.owner;
      }
    }
    return null;
  }

  /**
   * Check if an agent can modify a file
   */
  canModify(filePath: string, agentId: string): boolean {
    for (const zone of this.zones) {
      if (this.matchPattern(filePath, zone.pattern)) {
        if (zone.readonly) return false;
        if (zone.owner && zone.owner !== agentId) return false;
      }
    }
    return true;
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // Convert glob to regex
    const regex = pattern
      .replace(/\*\*/g, "<<DOUBLESTAR>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<DOUBLESTAR>>/g, ".*")
      .replace(/\?/g, ".");

    return new RegExp(`^${regex}$`).test(filePath);
  }
}
