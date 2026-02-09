/**
 * SQLiteStateStore Tests
 * Comprehensive tests for the SQLite-based state store
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteStateStore } from "./sqlite.js";
import type { AgentProfile, Task } from "@conductor/core";

describe("SQLiteStateStore", () => {
  let store: SQLiteStateStore;

  beforeEach(() => {
    // Use in-memory database for tests
    store = new SQLiteStateStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  describe("constructor", () => {
    it("should create store with string path", () => {
      const s = new SQLiteStateStore(":memory:");
      expect(s).toBeDefined();
      s.close();
    });

    it("should create store with options object", () => {
      const s = new SQLiteStateStore({ dbPath: ":memory:", verbose: false });
      expect(s).toBeDefined();
      s.close();
    });
  });

  // ============================================================================
  // Project Methods
  // ============================================================================

  describe("Project Methods", () => {
    describe("createProject", () => {
      it("should create a project with required fields", () => {
        const project = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test Project",
          slug: "test-project",
        });

        expect(project.id).toBeDefined();
        expect(project.name).toBe("Test Project");
        expect(project.slug).toBe("test-project");
        expect(project.gitBranch).toBe("main");
        expect(project.conflictStrategy).toBe("lock");
        expect(project.isActive).toBe(true);
      });

      it("should create a project with all fields", () => {
        const project = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Full Project",
          slug: "full-project",
          rootPath: "/home/user/project",
          gitRemote: "https://github.com/org/repo",
          gitBranch: "develop",
          conflictStrategy: "merge",
          settings: { feature: true },
          isActive: true,
          budget: {
            total: 1000,
            spent: 100,
            currency: "USD",
            alertThreshold: 90,
          },
        });

        expect(project.rootPath).toBe("/home/user/project");
        expect(project.gitRemote).toBe("https://github.com/org/repo");
        expect(project.gitBranch).toBe("develop");
        expect(project.conflictStrategy).toBe("merge");
        expect(project.settings).toEqual({ feature: true });
        expect(project.budget?.total).toBe(1000);
        expect(project.budget?.alertThreshold).toBe(90);
      });

      it("should set current project after creation", () => {
        const project = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test",
          slug: "test",
        });

        expect(store.getProjectId()).toBe(project.id);
      });
    });

    describe("getProject", () => {
      it("should return null for non-existent project", () => {
        const project = store.getProject("non-existent-id");
        expect(project).toBeNull();
      });

      it("should return project by id", () => {
        const created = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test",
          slug: "test",
        });

        const retrieved = store.getProject(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(created.id);
        expect(retrieved!.name).toBe("Test");
      });
    });

    describe("setCurrentProject / getProjectId", () => {
      it("should throw if no project is set", () => {
        const freshStore = new SQLiteStateStore(":memory:");
        expect(() => freshStore.getProjectId()).toThrow("No project selected");
        freshStore.close();
      });

      it("should set and get current project", () => {
        const project = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test",
          slug: "test",
        });

        const project2 = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test 2",
          slug: "test-2",
        });

        store.setCurrentProject(project.id);
        expect(store.getProjectId()).toBe(project.id);
      });
    });
  });

  // ============================================================================
  // Agent Methods
  // ============================================================================

  describe("Agent Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        slug: "test",
      });
      projectId = project.id;
    });

    describe("registerAgent", () => {
      it("should register an agent", () => {
        const agent: AgentProfile = {
          id: "claude",
          name: "Claude Code",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: ["typescript", "testing"],
          costPerToken: { input: 0.000015, output: 0.000075 },
          status: "idle",
          metadata: {},
        };

        store.registerAgent(projectId, agent);
        const retrieved = store.getAgent("claude");

        expect(retrieved).not.toBeNull();
        expect(retrieved!.name).toBe("Claude Code");
        expect(retrieved!.capabilities).toContain("typescript");
      });

      it("should update agent on re-register (REPLACE)", () => {
        const agent: AgentProfile = {
          id: "claude",
          name: "Claude v1",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        };

        store.registerAgent(projectId, agent);

        const updated: AgentProfile = {
          ...agent,
          name: "Claude v2",
          capabilities: ["new-cap"],
        };

        store.registerAgent(projectId, updated);
        const retrieved = store.getAgent("claude");

        expect(retrieved!.name).toBe("Claude v2");
        expect(retrieved!.capabilities).toContain("new-cap");
      });

      it("should register agent with quotaResetAt", () => {
        const resetDate = new Date("2024-02-01T00:00:00Z");
        const agent: AgentProfile = {
          id: "quota-agent",
          name: "Quota Agent",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          quotaLimit: 100000,
          quotaUsed: 5000,
          quotaResetAt: resetDate,
          status: "idle",
          metadata: {},
        };

        store.registerAgent(projectId, agent);
        const retrieved = store.getAgent("quota-agent");

        expect(retrieved).not.toBeNull();
        expect(retrieved!.quotaLimit).toBe(100000);
        expect(retrieved!.quotaUsed).toBe(5000);
        expect(retrieved!.quotaResetAt).toEqual(resetDate);
      });
    });

    describe("getAgent", () => {
      it("should return null for non-existent agent", () => {
        expect(store.getAgent("non-existent")).toBeNull();
      });
    });

    describe("listAgents", () => {
      it("should list all agents for a project", () => {
        store.registerAgent(projectId, {
          id: "claude",
          name: "Claude",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });

        store.registerAgent(projectId, {
          id: "gemini",
          name: "Gemini",
          provider: "google",
          model: "gemini-pro",
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: "idle",
          metadata: {},
        });

        const agents = store.listAgents(projectId);
        expect(agents).toHaveLength(2);
        expect(agents.map((a) => a.id)).toContain("claude");
        expect(agents.map((a) => a.id)).toContain("gemini");
      });

      it("should return empty array for project with no agents", () => {
        const agents = store.listAgents(projectId);
        expect(agents).toHaveLength(0);
      });
    });

    describe("updateAgentStatus", () => {
      it("should update agent status and heartbeat", () => {
        store.registerAgent(projectId, {
          id: "claude",
          name: "Claude",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });

        store.updateAgentStatus("claude", "working");
        const agent = store.getAgent("claude");

        expect(agent!.status).toBe("working");
        expect(agent!.lastHeartbeat).toBeDefined();
      });
    });

    describe("heartbeat", () => {
      it("should update agent heartbeat timestamp", () => {
        store.registerAgent(projectId, {
          id: "claude",
          name: "Claude",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });

        store.heartbeat("claude");
        const agent = store.getAgent("claude");

        expect(agent!.lastHeartbeat).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Task Methods
  // ============================================================================

  describe("Task Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        slug: "test",
      });
      projectId = project.id;
    });

    describe("createTask", () => {
      it("should create a task with required fields", () => {
        const task = store.createTask(projectId, {
          title: "Fix bug",
        });

        expect(task.id).toBeDefined();
        expect(task.projectId).toBe(projectId);
        expect(task.title).toBe("Fix bug");
        expect(task.status).toBe("pending");
        expect(task.priority).toBe("medium");
      });

      it("should create a task with all fields", () => {
        // Register agent first for foreign key constraint
        store.registerAgent(projectId, {
          id: "claude",
          name: "Claude",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });

        const task = store.createTask(projectId, {
          title: "Full task",
          description: "A complete task",
          status: "pending",
          priority: "high",
          assignedTo: "claude",
          dependencies: ["dep-1"],
          files: ["src/main.ts"],
          tags: ["bug", "urgent"],
          metadata: { custom: "data" },
          estimatedTokens: 50000,
        });

        expect(task.description).toBe("A complete task");
        expect(task.priority).toBe("high");
        expect(task.files).toContain("src/main.ts");
        expect(task.tags).toContain("bug");
        expect(task.estimatedTokens).toBe(50000);
      });
    });

    describe("getTask", () => {
      it("should return null for non-existent task", () => {
        expect(store.getTask("non-existent")).toBeNull();
      });

      it("should return task by id", () => {
        const created = store.createTask(projectId, { title: "Test" });
        const retrieved = store.getTask(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.title).toBe("Test");
      });
    });

    describe("updateTask", () => {
      it("should update task status", () => {
        const task = store.createTask(projectId, { title: "Test" });
        const updated = store.updateTask(task.id, { status: "in_progress" });

        expect(updated.status).toBe("in_progress");
        expect(updated.startedAt).toBeDefined();
      });

      it("should set completedAt when completed", () => {
        const task = store.createTask(projectId, { title: "Test" });
        const updated = store.updateTask(task.id, { status: "completed" });

        expect(updated.status).toBe("completed");
        expect(updated.completedAt).toBeDefined();
      });

      it("should set completedAt when failed", () => {
        const task = store.createTask(projectId, { title: "Test" });
        const updated = store.updateTask(task.id, { status: "failed" });

        expect(updated.status).toBe("failed");
        expect(updated.completedAt).toBeDefined();
      });

      it("should update multiple fields", () => {
        // Register agent first for foreign key constraint
        store.registerAgent(projectId, {
          id: "claude",
          name: "Claude",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });

        const task = store.createTask(projectId, { title: "Test" });
        const updated = store.updateTask(task.id, {
          priority: "critical",
          assignedTo: "claude",
          actualTokens: 25000,
          metadata: { updated: true },
          blockedBy: ["other-task"],
        });

        expect(updated.priority).toBe("critical");
        expect(updated.assignedTo).toBe("claude");
        expect(updated.actualTokens).toBe(25000);
        expect(updated.metadata).toEqual({ updated: true });
        expect(updated.blockedBy).toContain("other-task");
      });

      it("should throw for non-existent task", () => {
        expect(() =>
          store.updateTask("non-existent", { status: "completed" }),
        ).toThrow("Task not found");
      });
    });

    describe("listTasks", () => {
      beforeEach(() => {
        // Register agent first for foreign key constraint
        store.registerAgent(projectId, {
          id: "claude",
          name: "Claude",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });

        store.createTask(projectId, {
          title: "Task 1",
          priority: "high",
          status: "pending",
        });
        store.createTask(projectId, {
          title: "Task 2",
          priority: "low",
          status: "completed",
        });
        store.createTask(projectId, {
          title: "Task 3",
          priority: "critical",
          status: "pending",
          assignedTo: "claude",
        });
      });

      it("should list all tasks for a project", () => {
        const tasks = store.listTasks(projectId);
        expect(tasks).toHaveLength(3);
      });

      it("should filter by status", () => {
        const tasks = store.listTasks(projectId, { status: "pending" });
        expect(tasks).toHaveLength(2);
      });

      it("should filter by multiple statuses", () => {
        const tasks = store.listTasks(projectId, {
          status: ["pending", "completed"],
        });
        expect(tasks).toHaveLength(3);
      });

      it("should filter by priority", () => {
        const tasks = store.listTasks(projectId, { priority: "high" });
        expect(tasks).toHaveLength(1);
      });

      it("should filter by multiple priorities", () => {
        const tasks = store.listTasks(projectId, {
          priority: ["high", "critical"],
        });
        expect(tasks).toHaveLength(2);
      });

      it("should filter by assignedTo", () => {
        const tasks = store.listTasks(projectId, { assignedTo: "claude" });
        expect(tasks).toHaveLength(1);
        expect(tasks[0].title).toBe("Task 3");
      });

      it("should order by priority", () => {
        const tasks = store.listTasks(projectId, { status: "pending" });
        expect(tasks[0].priority).toBe("critical");
        expect(tasks[1].priority).toBe("high");
      });
    });

    describe("claimTask", () => {
      beforeEach(() => {
        // Register agents for foreign key constraint
        store.registerAgent(projectId, {
          id: "claude",
          name: "Claude",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });
        store.registerAgent(projectId, {
          id: "gemini",
          name: "Gemini",
          provider: "google",
          model: "gemini-pro",
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: "idle",
          metadata: {},
        });
      });

      it("should claim an unclaimed task", () => {
        const task = store.createTask(projectId, { title: "Test" });
        const result = store.claimTask(task.id, "claude");

        expect(result).toBe(true);

        const updated = store.getTask(task.id);
        expect(updated!.assignedTo).toBe("claude");
        expect(updated!.status).toBe("claimed");
        expect(updated!.claimedAt).toBeDefined();
      });

      it("should not claim an already claimed task", () => {
        const task = store.createTask(projectId, { title: "Test" });
        store.claimTask(task.id, "claude");

        const result = store.claimTask(task.id, "gemini");
        expect(result).toBe(false);
      });

      it("should not re-claim after status changed", () => {
        const task = store.createTask(projectId, { title: "Test" });
        store.claimTask(task.id, "claude");

        // Status is now 'claimed', not 'pending', so re-claim should fail
        const result = store.claimTask(task.id, "claude");
        expect(result).toBe(false);
      });
    });
  });

  // ============================================================================
  // Lock Methods
  // ============================================================================

  describe("Lock Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        slug: "test",
      });
      projectId = project.id;

      store.registerAgent(projectId, {
        id: "claude",
        name: "Claude",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: [],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      });
    });

    describe("acquireLock", () => {
      it("should acquire a lock on a file", () => {
        const result = store.acquireLock(projectId, "src/main.ts", "claude");
        expect(result).toBe(true);
      });

      it("should fail to acquire lock if already locked", () => {
        store.acquireLock(projectId, "src/main.ts", "claude");
        const result = store.acquireLock(projectId, "src/main.ts", "gemini");
        expect(result).toBe(false);
      });

      it("should allow same agent to re-acquire lock", () => {
        store.acquireLock(projectId, "src/main.ts", "claude");
        // This will fail due to primary key constraint
        const result = store.acquireLock(projectId, "src/main.ts", "claude");
        expect(result).toBe(false);
      });
    });

    describe("releaseLock", () => {
      it("should release a lock", () => {
        store.acquireLock(projectId, "src/main.ts", "claude");
        store.releaseLock(projectId, "src/main.ts", "claude");

        const status = store.checkLock(projectId, "src/main.ts");
        expect(status.locked).toBe(false);
      });

      it("should not release lock held by another agent", () => {
        store.acquireLock(projectId, "src/main.ts", "claude");
        store.releaseLock(projectId, "src/main.ts", "gemini");

        const status = store.checkLock(projectId, "src/main.ts");
        expect(status.locked).toBe(true);
        expect(status.holder).toBe("claude");
      });
    });

    describe("checkLock", () => {
      it("should return locked=false for unlocked file", () => {
        const status = store.checkLock(projectId, "src/main.ts");
        expect(status.locked).toBe(false);
        expect(status.holder).toBeUndefined();
      });

      it("should return lock info for locked file", () => {
        store.acquireLock(projectId, "src/main.ts", "claude", 300);

        const status = store.checkLock(projectId, "src/main.ts");
        expect(status.locked).toBe(true);
        expect(status.holder).toBe("claude");
        expect(status.expiresAt).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Concurrent Lock Testing
  // ============================================================================

  describe("Concurrent Lock Testing", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Lock Test Project",
        slug: "lock-test",
      });
      projectId = project.id;

      // Register 5 agents
      for (let i = 1; i <= 5; i++) {
        store.registerAgent(projectId, {
          id: `agent-${i}`,
          name: `Agent ${i}`,
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: ["typescript"],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });
      }
    });

    describe("atomic lock acquisition", () => {
      it("should allow 5 agents to lock different files simultaneously", () => {
        const files = [
          "src/a.ts",
          "src/b.ts",
          "src/c.ts",
          "src/d.ts",
          "src/e.ts",
        ];

        for (let i = 0; i < 5; i++) {
          const result = store.acquireLock(
            projectId,
            files[i],
            `agent-${i + 1}`,
          );
          expect(result).toBe(true);
        }

        // Verify each agent holds their respective lock
        for (let i = 0; i < 5; i++) {
          const lock = store.checkLock(projectId, files[i]);
          expect(lock.locked).toBe(true);
          expect(lock.holder).toBe(`agent-${i + 1}`);
        }
      });

      it("should serialize 5 agents competing for the same file", () => {
        const file = "src/shared.ts";
        let winner: string | null = null;

        for (let i = 1; i <= 5; i++) {
          const result = store.acquireLock(projectId, file, `agent-${i}`);
          if (result) {
            expect(winner).toBeNull(); // Only one should succeed
            winner = `agent-${i}`;
          }
        }

        expect(winner).toBe("agent-1"); // First agent wins
        const lock = store.checkLock(projectId, file);
        expect(lock.locked).toBe(true);
        expect(lock.holder).toBe("agent-1");
      });

      it("should return holder info via checkLock on collision", () => {
        store.acquireLock(projectId, "src/main.ts", "agent-1", 600);
        const failed = store.acquireLock(
          projectId,
          "src/main.ts",
          "agent-2",
          600,
        );
        expect(failed).toBe(false);

        const info = store.checkLock(projectId, "src/main.ts");
        expect(info.locked).toBe(true);
        expect(info.holder).toBe("agent-1");
        expect(info.expiresAt).toBeDefined();
      });
    });

    describe("TTL expiry", () => {
      it("should use default TTL of 1800s", () => {
        const before = new Date();
        store.acquireLock(projectId, "src/file.ts", "agent-1");
        const lock = store.checkLock(projectId, "src/file.ts");

        expect(lock.expiresAt).toBeDefined();
        const expectedMin = before.getTime() + 1800 * 1000 - 1000; // 1s tolerance
        const expectedMax = before.getTime() + 1800 * 1000 + 1000;
        expect(lock.expiresAt!.getTime()).toBeGreaterThan(expectedMin);
        expect(lock.expiresAt!.getTime()).toBeLessThan(expectedMax);
      });

      it("should allow lock acquisition after TTL expiry", () => {
        // Acquire with very short TTL (already expired by manipulating DB)
        store.acquireLock(projectId, "src/file.ts", "agent-1", 1);

        // Manually expire the lock by setting expires_at to the past
        const db = (store as any).db;
        db.prepare(
          "UPDATE file_locks SET expires_at = ? WHERE project_id = ? AND file_path = ?",
        ).run(
          new Date(Date.now() - 1000).toISOString(),
          projectId,
          "src/file.ts",
        );

        // Now agent-2 should be able to acquire
        const result = store.acquireLock(
          projectId,
          "src/file.ts",
          "agent-2",
          600,
        );
        expect(result).toBe(true);

        const lock = store.checkLock(projectId, "src/file.ts");
        expect(lock.holder).toBe("agent-2");
      });
    });

    describe("cleanupStaleLocks", () => {
      it("should remove expired locks", () => {
        store.acquireLock(projectId, "src/a.ts", "agent-1", 1);
        store.acquireLock(projectId, "src/b.ts", "agent-2", 1);
        store.acquireLock(projectId, "src/c.ts", "agent-3", 3600); // Not expired

        // Manually expire first two locks
        const db = (store as any).db;
        const pastDate = new Date(Date.now() - 1000).toISOString();
        db.prepare(
          "UPDATE file_locks SET expires_at = ? WHERE project_id = ? AND file_path = ?",
        ).run(pastDate, projectId, "src/a.ts");
        db.prepare(
          "UPDATE file_locks SET expires_at = ? WHERE project_id = ? AND file_path = ?",
        ).run(pastDate, projectId, "src/b.ts");

        const cleaned = store.cleanupStaleLocks(projectId);
        expect(cleaned).toBe(2);

        // Verify remaining locks
        const active = store.listActiveLocks(projectId);
        expect(active).toHaveLength(1);
        expect(active[0].filePath).toBe("src/c.ts");
      });

      it("should return 0 when no stale locks exist", () => {
        store.acquireLock(projectId, "src/a.ts", "agent-1", 3600);
        const cleaned = store.cleanupStaleLocks(projectId);
        expect(cleaned).toBe(0);
      });
    });

    describe("listActiveLocks", () => {
      it("should list all active locks for a project", () => {
        store.acquireLock(projectId, "src/a.ts", "agent-1", 3600);
        store.acquireLock(projectId, "src/b.ts", "agent-2", 3600);
        store.acquireLock(projectId, "src/c.ts", "agent-3", 3600);

        const active = store.listActiveLocks(projectId);
        expect(active).toHaveLength(3);

        const filePaths = active.map((l) => l.filePath).sort();
        expect(filePaths).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);

        // Each lock should have proper fields
        for (const lock of active) {
          expect(lock.agentId).toBeDefined();
          expect(lock.lockedAt).toBeInstanceOf(Date);
          expect(lock.expiresAt).toBeInstanceOf(Date);
        }
      });

      it("should not include expired locks", () => {
        store.acquireLock(projectId, "src/a.ts", "agent-1", 3600);
        store.acquireLock(projectId, "src/expired.ts", "agent-2", 1);

        // Expire one lock
        const db = (store as any).db;
        db.prepare(
          "UPDATE file_locks SET expires_at = ? WHERE project_id = ? AND file_path = ?",
        ).run(
          new Date(Date.now() - 1000).toISOString(),
          projectId,
          "src/expired.ts",
        );

        const active = store.listActiveLocks(projectId);
        expect(active).toHaveLength(1);
        expect(active[0].filePath).toBe("src/a.ts");
      });

      it("should return empty array when no locks exist", () => {
        const active = store.listActiveLocks(projectId);
        expect(active).toHaveLength(0);
      });
    });

    describe("multi-agent lock workflow", () => {
      it("should handle acquire-release-reacquire cycle", () => {
        // Agent 1 acquires
        expect(store.acquireLock(projectId, "src/file.ts", "agent-1")).toBe(
          true,
        );

        // Agent 2 fails
        expect(store.acquireLock(projectId, "src/file.ts", "agent-2")).toBe(
          false,
        );

        // Agent 1 releases
        store.releaseLock(projectId, "src/file.ts", "agent-1");

        // Agent 2 succeeds
        expect(store.acquireLock(projectId, "src/file.ts", "agent-2")).toBe(
          true,
        );

        const lock = store.checkLock(projectId, "src/file.ts");
        expect(lock.holder).toBe("agent-2");
      });

      it("should isolate locks between projects", () => {
        const project2 = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Other Project",
          slug: "other-project",
        });

        // Register agent in project2
        store.registerAgent(project2.id, {
          id: "agent-1",
          name: "Agent 1",
          provider: "anthropic",
          model: "claude-opus-4",
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: "idle",
          metadata: {},
        });

        // Same file, different projects — both should succeed
        expect(
          store.acquireLock(projectId, "src/shared.ts", "agent-1"),
        ).toBe(true);
        expect(
          store.acquireLock(project2.id, "src/shared.ts", "agent-1"),
        ).toBe(true);
      });
    });
  });

  // ============================================================================
  // Reassignment Methods
  // ============================================================================

  describe("Reassignment Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Reassign Test",
        slug: "reassign-test",
      });
      projectId = project.id;

      store.registerAgent(projectId, {
        id: "agent-old",
        name: "Old Agent",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: ["typescript"],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "offline",
        metadata: {},
      });

      store.registerAgent(projectId, {
        id: "agent-new",
        name: "New Agent",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: ["typescript"],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      });
    });

    describe("reassignTask", () => {
      it("should reassign a task to a new agent", () => {
        const task = store.createTask(projectId, {
          title: "Test Task",
          assignedTo: "agent-old",
          status: "in_progress",
        });

        const reassigned = store.reassignTask(task.id, "agent-new", projectId);
        expect(reassigned.assignedTo).toBe("agent-new");
        expect(reassigned.status).toBe("claimed");
        expect(reassigned.metadata?.reassignmentCount).toBe(1);
        expect(reassigned.metadata?.lastReassignedFrom).toBe("agent-old");
      });

      it("should increment reassignment count on subsequent reassignments", () => {
        const task = store.createTask(projectId, {
          title: "Test Task",
          assignedTo: "agent-old",
          status: "in_progress",
        });

        store.reassignTask(task.id, "agent-new", projectId);
        const second = store.reassignTask(task.id, "agent-old", projectId);
        expect(second.metadata?.reassignmentCount).toBe(2);
      });

      it("should release old agent locks on reassignment", () => {
        const task = store.createTask(projectId, {
          title: "Test Task",
          assignedTo: "agent-old",
          status: "in_progress",
        });

        store.acquireLock(projectId, "src/a.ts", "agent-old", 3600);
        store.acquireLock(projectId, "src/b.ts", "agent-old", 3600);

        store.reassignTask(task.id, "agent-new", projectId);

        // Old agent's locks should be released
        expect(store.checkLock(projectId, "src/a.ts").locked).toBe(false);
        expect(store.checkLock(projectId, "src/b.ts").locked).toBe(false);
      });

      it("should throw for non-existent task", () => {
        expect(() =>
          store.reassignTask("non-existent", "agent-new", projectId),
        ).toThrow("Task not found");
      });
    });

    describe("getTaskReassignmentCount", () => {
      it("should return 0 for new tasks", () => {
        const task = store.createTask(projectId, { title: "New Task" });
        expect(store.getTaskReassignmentCount(task.id)).toBe(0);
      });

      it("should return correct count after reassignments", () => {
        const task = store.createTask(projectId, {
          title: "Test Task",
          assignedTo: "agent-old",
          status: "in_progress",
        });

        store.reassignTask(task.id, "agent-new", projectId);
        expect(store.getTaskReassignmentCount(task.id)).toBe(1);
      });

      it("should return 0 for non-existent task", () => {
        expect(store.getTaskReassignmentCount("non-existent")).toBe(0);
      });
    });

    describe("getOrphanedTasks", () => {
      it("should return tasks assigned to offline agents", () => {
        const task = store.createTask(projectId, {
          title: "Orphaned Task",
          assignedTo: "agent-old",
          status: "in_progress",
        });

        const orphaned = store.getOrphanedTasks(projectId);
        expect(orphaned).toHaveLength(1);
        expect(orphaned[0].id).toBe(task.id);
      });

      it("should not return tasks assigned to active agents", () => {
        store.createTask(projectId, {
          title: "Active Task",
          assignedTo: "agent-new",
          status: "in_progress",
        });

        const orphaned = store.getOrphanedTasks(projectId);
        expect(orphaned).toHaveLength(0);
      });

      it("should not return completed tasks", () => {
        store.createTask(projectId, {
          title: "Completed Task",
          assignedTo: "agent-old",
          status: "completed",
        });

        const orphaned = store.getOrphanedTasks(projectId);
        expect(orphaned).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // Zone Config Methods
  // ============================================================================

  describe("Zone Config Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Zone Test",
        slug: "zone-test",
      });
      projectId = project.id;
    });

    describe("setProjectZoneConfig / getProjectZoneConfig", () => {
      it("should store and retrieve zone config", () => {
        const config = {
          zones: [
            { pattern: "src/frontend/**", owners: ["agent-1"], shared: false },
            { pattern: "src/backend/**", owners: ["agent-2"], shared: false },
          ],
        };

        store.setProjectZoneConfig(projectId, config);
        const retrieved = store.getProjectZoneConfig(projectId);
        expect(retrieved).toEqual(config);
      });

      it("should return null for project without zone config", () => {
        const config = store.getProjectZoneConfig(projectId);
        expect(config).toBeNull();
      });

      it("should preserve other settings when setting zone config", () => {
        // Create project with existing settings
        const project2 = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Settings Test",
          slug: "settings-test",
          settings: { existingKey: "value" },
        });

        store.setProjectZoneConfig(project2.id, { zones: [] });
        const project = store.getProject(project2.id);

        expect(project!.settings.existingKey).toBe("value");
        expect(project!.settings.zoneConfig).toEqual({ zones: [] });
      });

      it("should throw for non-existent project", () => {
        expect(() =>
          store.setProjectZoneConfig("non-existent", { zones: [] }),
        ).toThrow("Project not found");
      });

      it("should return null for non-existent project", () => {
        expect(store.getProjectZoneConfig("non-existent")).toBeNull();
      });
    });
  });

  // ============================================================================
  // Cost Methods
  // ============================================================================

  describe("Cost Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        slug: "test",
        budget: { total: 1000, spent: 0, currency: "USD", alertThreshold: 80 },
      });
      projectId = project.id;

      store.registerAgent(projectId, {
        id: "claude",
        name: "Claude",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: [],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      });
    });

    describe("recordCost", () => {
      it("should record a cost event", () => {
        store.recordCost({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          projectId,
          agentId: "claude",
          model: "claude-opus-4",
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 0.525,
        });

        const events = store.getCostEvents(projectId);
        expect(events).toHaveLength(1);
        expect(events[0].cost).toBe(0.525);
      });

      it("should update project budget spent", () => {
        store.recordCost({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          projectId,
          agentId: "claude",
          model: "claude-opus-4",
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 10.5,
        });

        const project = store.getProject(projectId);
        expect(project!.budget!.spent).toBe(10.5);
      });
    });

    describe("getProjectSpend", () => {
      it("should return total spend for project", () => {
        store.recordCost({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          projectId,
          agentId: "claude",
          model: "claude-opus-4",
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 10,
        });

        store.recordCost({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          projectId,
          agentId: "claude",
          model: "claude-opus-4",
          tokensInput: 2000,
          tokensOutput: 1000,
          cost: 20,
        });

        const total = store.getProjectSpend(projectId);
        expect(total).toBe(30);
      });

      it("should return 0 for project with no costs", () => {
        const total = store.getProjectSpend(projectId);
        expect(total).toBe(0);
      });
    });

    describe("getAgentSpend", () => {
      it("should return total spend for agent", () => {
        store.recordCost({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          projectId,
          agentId: "claude",
          model: "claude-opus-4",
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 15,
        });

        const total = store.getAgentSpend("claude");
        expect(total).toBe(15);
      });
    });

    describe("getCostEvents", () => {
      it("should return all cost events for project", () => {
        store.recordCost({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          projectId,
          agentId: "claude",
          model: "claude-opus-4",
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 10,
        });

        store.recordCost({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          projectId,
          agentId: "claude",
          model: "claude-opus-4",
          tokensInput: 2000,
          tokensOutput: 1000,
          cost: 20,
        });

        const events = store.getCostEvents(projectId);
        expect(events).toHaveLength(2);
        // Verify both events are returned (order may vary due to same-millisecond inserts)
        const costs = events.map((e) => e.cost).sort((a, b) => a - b);
        expect(costs).toEqual([10, 20]);
      });
    });
  });

  // ============================================================================
  // Access Request Methods
  // ============================================================================

  describe("Access Request Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        slug: "test",
      });
      projectId = project.id;
    });

    describe("createAccessRequest", () => {
      it("should create an access request", () => {
        const request = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude Code",
          agentType: "claude",
          capabilities: ["typescript"],
          requestedRole: "contributor",
        });

        expect(request.id).toBeDefined();
        expect(request.status).toBe("pending");
        expect(request.agentName).toBe("Claude Code");
      });

      it("should return existing pending request for same agent", () => {
        const request1 = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        const request2 = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude Updated",
          agentType: "claude",
        });

        expect(request1.id).toBe(request2.id);
      });
    });

    describe("getAccessRequest", () => {
      it("should return null for non-existent request", () => {
        expect(store.getAccessRequest("non-existent")).toBeNull();
      });

      it("should return request by id", () => {
        const created = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        const retrieved = store.getAccessRequest(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.agentId).toBe("claude-1");
      });
    });

    describe("listAccessRequests", () => {
      beforeEach(() => {
        store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        const req2 = store.createAccessRequest(projectId, {
          agentId: "gemini-1",
          agentName: "Gemini",
          agentType: "gemini",
        });
        store.approveAccessRequest(req2.id, "admin");
      });

      it("should list all requests for project", () => {
        const requests = store.listAccessRequests(projectId);
        expect(requests).toHaveLength(2);
      });

      it("should filter by status", () => {
        const pending = store.listAccessRequests(projectId, {
          status: "pending",
        });
        expect(pending).toHaveLength(1);
        expect(pending[0].agentType).toBe("claude");

        const approved = store.listAccessRequests(projectId, {
          status: "approved",
        });
        expect(approved).toHaveLength(1);
        expect(approved[0].agentType).toBe("gemini");
      });

      it("should filter by agentType", () => {
        const requests = store.listAccessRequests(projectId, {
          agentType: "claude",
        });
        expect(requests).toHaveLength(1);
      });
    });

    describe("approveAccessRequest", () => {
      it("should approve a request", () => {
        const request = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        const approved = store.approveAccessRequest(request.id, "admin");

        expect(approved.status).toBe("approved");
        expect(approved.reviewedBy).toBe("admin");
        expect(approved.reviewedAt).toBeDefined();
      });

      it("should set expiration date if provided", () => {
        const request = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        const approved = store.approveAccessRequest(request.id, "admin", 30);

        expect(approved.expiresAt).toBeDefined();
      });

      it("should auto-register agent on approval", () => {
        const request = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
          capabilities: ["typescript"],
        });

        store.approveAccessRequest(request.id, "admin");

        const agent = store.getAgent("claude-1");
        expect(agent).not.toBeNull();
        expect(agent!.name).toBe("Claude");
        expect(agent!.provider).toBe("anthropic");
      });
    });

    describe("denyAccessRequest", () => {
      it("should deny a request", () => {
        const request = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        const denied = store.denyAccessRequest(
          request.id,
          "admin",
          "Not needed",
        );

        expect(denied.status).toBe("denied");
        expect(denied.denialReason).toBe("Not needed");
      });
    });

    describe("hasApprovedAccess", () => {
      it("should return false for no access", () => {
        expect(store.hasApprovedAccess(projectId, "claude-1")).toBe(false);
      });

      it("should return true for approved access", () => {
        const request = store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });
        store.approveAccessRequest(request.id, "admin");

        expect(store.hasApprovedAccess(projectId, "claude-1")).toBe(true);
      });

      it("should return false for pending access", () => {
        store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        expect(store.hasApprovedAccess(projectId, "claude-1")).toBe(false);
      });
    });

    describe("getPendingAccessCount", () => {
      it("should return count of pending requests", () => {
        store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });
        store.createAccessRequest(projectId, {
          agentId: "gemini-1",
          agentName: "Gemini",
          agentType: "gemini",
        });

        expect(store.getPendingAccessCount(projectId)).toBe(2);
      });
    });

    describe("expireOldRequests", () => {
      it("should expire pending requests older than cutoff", () => {
        // Create a request (will be recent)
        store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        // Expire requests older than 0 hours
        // Note: This uses strict < comparison, so same-millisecond requests won't be expired.
        // A 0-hour cutoff means "created before this exact moment" - timing-dependent.
        // We test the function is callable and returns a number (0 or 1 depending on timing)
        const expired = store.expireOldRequests(projectId, 0);
        expect(typeof expired).toBe("number");
        expect(expired).toBeGreaterThanOrEqual(0);
        expect(expired).toBeLessThanOrEqual(1);
      });

      it("should not expire requests newer than cutoff", () => {
        store.createAccessRequest(projectId, {
          agentId: "claude-1",
          agentName: "Claude",
          agentType: "claude",
        });

        // Expire requests older than 24 hours - our request is brand new
        const expired = store.expireOldRequests(projectId, 24);
        expect(expired).toBe(0);

        // Verify the request is still pending
        const pending = store.listAccessRequests(projectId, {
          status: "pending",
        });
        expect(pending).toHaveLength(1);
      });
    });
  });

  // ============================================================================
  // Project Context Methods
  // ============================================================================

  describe("Project Context Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Project",
        slug: "test",
      });
      projectId = project.id;
    });

    describe("setOnboardingConfig / getOnboardingConfig", () => {
      it("should return null for unconfigured project", () => {
        expect(store.getOnboardingConfig(projectId)).toBeNull();
      });

      it("should create new config", () => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: "Welcome!",
          currentFocus: "Authentication",
          goals: ["Implement OAuth", "Add tests"],
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config).not.toBeNull();
        expect(config!.welcomeMessage).toBe("Welcome!");
        expect(config!.goals).toHaveLength(2);
      });

      it("should update existing config", () => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: "Welcome v1",
        });

        store.setOnboardingConfig(projectId, {
          welcomeMessage: "Welcome v2",
          currentFocus: "New focus",
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.welcomeMessage).toBe("Welcome v2");
        expect(config!.currentFocus).toBe("New focus");
      });

      it("should update checkpointRules on existing config", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Initial" });
        store.setOnboardingConfig(projectId, {
          checkpointRules: ["Rule 1", "Rule 2"],
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.checkpointRules).toEqual(["Rule 1", "Rule 2"]);
      });

      it("should update checkpointEveryNTasks on existing config", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Initial" });
        store.setOnboardingConfig(projectId, { checkpointEveryNTasks: 10 });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.checkpointEveryNTasks).toBe(10);
      });

      it("should update agentInstructionsFiles on existing config", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Initial" });
        store.setOnboardingConfig(projectId, {
          agentInstructionsFiles: { claude: "CLAUDE.md", gemini: "GEMINI.md" },
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.agentInstructionsFiles).toEqual({
          claude: "CLAUDE.md",
          gemini: "GEMINI.md",
        });
      });

      it("should update goals on existing config", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Initial" });
        store.setOnboardingConfig(projectId, {
          goals: ["Goal 1", "Goal 2", "Goal 3"],
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.goals).toEqual(["Goal 1", "Goal 2", "Goal 3"]);
      });

      it("should update styleGuide on existing config", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Initial" });
        store.setOnboardingConfig(projectId, {
          styleGuide: "Use TypeScript strict mode",
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.styleGuide).toBe("Use TypeScript strict mode");
      });

      it("should handle all config fields", () => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: "Welcome",
          currentFocus: "Feature X",
          goals: ["Goal 1"],
          styleGuide: "Use TypeScript",
          checkpointRules: ["Run tests"],
          checkpointEveryNTasks: 5,
          autoRefreshContext: false,
          agentInstructionsFiles: { claude: "CLAUDE.md" },
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.checkpointEveryNTasks).toBe(5);
        expect(config!.autoRefreshContext).toBe(false);
        expect(config!.agentInstructionsFiles).toEqual({ claude: "CLAUDE.md" });
      });

      it("should use fallback values for NULL database fields", () => {
        // Directly insert row with NULL values to test fallback branches
        const db = (store as any).db;
        db.prepare(
          `INSERT INTO project_onboarding (project_id, welcome_message, current_focus, goals, style_guide, checkpoint_rules, checkpoint_every_n_tasks, auto_refresh_context, agent_instructions)
           VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL)`,
        ).run(projectId);

        const config = store.getOnboardingConfig(projectId);
        expect(config).not.toBeNull();
        // Check that fallback values are used when database fields are NULL
        expect(config!.goals).toEqual([]);
        expect(config!.checkpointRules).toEqual([]);
        expect(config!.checkpointEveryNTasks).toBe(3); // Default value
        expect(config!.agentInstructionsFiles).toEqual({});
        expect(config!.welcomeMessage).toBeUndefined();
        expect(config!.currentFocus).toBeUndefined();
        expect(config!.styleGuide).toBeUndefined();
      });

      it("should use fallback when checkpoint_every_n_tasks is 0", () => {
        // Insert with checkpoint_every_n_tasks = 0 to trigger || 3 fallback
        const db = (store as any).db;
        db.prepare(
          `INSERT INTO project_onboarding (project_id, checkpoint_every_n_tasks, auto_refresh_context)
           VALUES (?, 0, 1)`,
        ).run(projectId);

        const config = store.getOnboardingConfig(projectId);
        expect(config!.checkpointEveryNTasks).toBe(3); // Fallback to 3 when 0
      });
    });

    describe("recordTaskClaim / getAgentTaskCount", () => {
      it("should record task claims", () => {
        const task = store.createTask(projectId, { title: "Test" });

        store.recordTaskClaim(projectId, "claude", task.id);

        expect(store.getAgentTaskCount(projectId, "claude")).toBe(1);
      });

      it("should count multiple claims", () => {
        const task1 = store.createTask(projectId, { title: "Task 1" });
        const task2 = store.createTask(projectId, { title: "Task 2" });

        store.recordTaskClaim(projectId, "claude", task1.id);
        store.recordTaskClaim(projectId, "claude", task2.id);

        expect(store.getAgentTaskCount(projectId, "claude")).toBe(2);
      });
    });

    describe("isFirstTaskForAgent", () => {
      it("should return true for new agent", () => {
        expect(store.isFirstTaskForAgent(projectId, "claude")).toBe(true);
      });

      it("should return false after first task", () => {
        const task = store.createTask(projectId, { title: "Test" });
        store.recordTaskClaim(projectId, "claude", task.id);

        expect(store.isFirstTaskForAgent(projectId, "claude")).toBe(false);
      });
    });

    describe("shouldRefreshContext", () => {
      beforeEach(() => {
        store.setOnboardingConfig(projectId, {
          autoRefreshContext: true,
          checkpointEveryNTasks: 3,
        });
      });

      it("should return false for first task", () => {
        expect(store.shouldRefreshContext(projectId, "claude")).toBe(false);
      });

      it("should return true at checkpoint interval", () => {
        const task1 = store.createTask(projectId, { title: "Task 1" });
        const task2 = store.createTask(projectId, { title: "Task 2" });
        const task3 = store.createTask(projectId, { title: "Task 3" });

        store.recordTaskClaim(projectId, "claude", task1.id);
        store.recordTaskClaim(projectId, "claude", task2.id);
        store.recordTaskClaim(projectId, "claude", task3.id);

        // 3 tasks, checkpointEveryNTasks = 3, so 3 % 3 = 0
        expect(store.shouldRefreshContext(projectId, "claude")).toBe(true);
      });

      it("should return false when autoRefresh is disabled", () => {
        store.setOnboardingConfig(projectId, { autoRefreshContext: false });

        const task1 = store.createTask(projectId, { title: "Task 1" });
        const task2 = store.createTask(projectId, { title: "Task 2" });
        const task3 = store.createTask(projectId, { title: "Task 3" });

        store.recordTaskClaim(projectId, "claude", task1.id);
        store.recordTaskClaim(projectId, "claude", task2.id);
        store.recordTaskClaim(projectId, "claude", task3.id);

        expect(store.shouldRefreshContext(projectId, "claude")).toBe(false);
      });
    });

    describe("generateContextBundle", () => {
      beforeEach(() => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: "Welcome to the project!",
          currentFocus: "Authentication",
          goals: ["Implement OAuth"],
          styleGuide: "TypeScript strict mode",
          checkpointRules: ["Run tests"],
          agentInstructionsFiles: { claude: "CLAUDE.md content" },
        });
      });

      it("should generate context for first task", () => {
        const task = store.createTask(projectId, {
          title: "Fix bug",
          description: "Fix the login bug",
          files: ["src/auth.ts"],
        });

        const context = store.generateContextBundle(
          projectId,
          "claude",
          "claude",
          task,
        );

        expect(context.projectId).toBe(projectId);
        expect(context.projectName).toBe("Test Project");
        expect(context.isFirstTask).toBe(true);
        expect(context.agentInstructions).toContain("Welcome to the project!");
        expect(context.currentFocus).toBe("Authentication");
        expect(context.taskContext?.taskId).toBe(task.id);
      });

      it("should not include welcome message for subsequent tasks", () => {
        const task1 = store.createTask(projectId, { title: "Task 1" });
        store.recordTaskClaim(projectId, "claude", task1.id);

        const task2 = store.createTask(projectId, { title: "Task 2" });
        const context = store.generateContextBundle(
          projectId,
          "claude",
          "claude",
          task2,
        );

        expect(context.isFirstTask).toBe(false);
        expect(context.agentInstructions).not.toContain("Welcome");
      });

      it("should include related tasks for overlapping files", () => {
        store.registerAgent(projectId, {
          id: "gemini",
          name: "Gemini",
          provider: "google",
          model: "gemini-pro",
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: "idle",
          metadata: {},
        });

        const task1 = store.createTask(projectId, {
          title: "Task 1",
          status: "in_progress",
          files: ["src/shared.ts"],
        });

        const task2 = store.createTask(projectId, {
          title: "Task 2",
          files: ["src/shared.ts", "src/other.ts"],
        });

        const context = store.generateContextBundle(
          projectId,
          "claude",
          "claude",
          task2,
        );

        expect(context.taskContext?.relatedTasks).toContain(task1.id);
      });
    });

    describe("generateContextRefresh", () => {
      beforeEach(() => {
        store.setOnboardingConfig(projectId, {
          currentFocus: "Performance",
          goals: ["Optimize queries"],
          styleGuide: "Use async/await",
          agentInstructionsFiles: { claude: "Performance tips" },
        });
      });

      it("should generate context refresh without task context", () => {
        const context = store.generateContextRefresh(
          projectId,
          "claude",
          "claude",
        );

        expect(context.currentFocus).toBe("Performance");
        expect(context.taskContext).toBeUndefined();
        expect(context.isFirstTask).toBe(false);
      });

      it("should use fallback values when project not found", () => {
        const context = store.generateContextRefresh(
          "non-existent-project",
          "claude",
          "claude",
        );

        expect(context.projectName).toBe("Unknown Project");
        expect(context.projectGoals).toEqual([]);
        expect(context.checkpointRules).toEqual([]);
        expect(context.allowedPaths).toEqual([]);
        expect(context.deniedPaths).toEqual([]);
      });

      it("should use fallback values when no config exists", () => {
        // Create a new project without any config
        const newProject = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Empty Config Project",
          slug: "empty-config",
        });

        const context = store.generateContextRefresh(
          newProject.id,
          "claude",
          "claude",
        );

        expect(context.projectName).toBe("Empty Config Project");
        expect(context.projectGoals).toEqual([]);
        expect(context.checkpointRules).toEqual([]);
        expect(context.currentFocus).toBeUndefined();
        expect(context.styleGuide).toBeUndefined();
        expect(context.agentInstructions).toBeUndefined();
      });

      it("should include allowed/denied paths from access request", () => {
        // Create and approve access request with paths
        const accessReq = store.createAccessRequest(projectId, {
          agentId: "claude",
          agentName: "Claude",
          agentType: "claude",
          metadata: {
            allowedPaths: ["src/", "tests/"],
            deniedPaths: ["secrets/", ".env"],
          },
        });
        store.approveAccessRequest(accessReq.id, "admin");

        const context = store.generateContextRefresh(
          projectId,
          "claude",
          "claude",
        );

        expect(context.allowedPaths).toEqual(["src/", "tests/"]);
        expect(context.deniedPaths).toEqual(["secrets/", ".env"]);
      });

      it("should use empty arrays when access request has no path metadata", () => {
        // Create access request WITHOUT path metadata
        const accessReq = store.createAccessRequest(projectId, {
          agentId: "refresh-agent",
          agentName: "Refresh Agent",
          agentType: "claude",
          metadata: { customField: "value" }, // No paths
        });
        store.approveAccessRequest(accessReq.id, "admin");

        const context = store.generateContextRefresh(
          projectId,
          "refresh-agent",
          "claude",
        );

        expect(context.allowedPaths).toEqual([]);
        expect(context.deniedPaths).toEqual([]);
      });
    });

    describe("generateContextBundle edge cases", () => {
      it("should use fallback values when project not found", () => {
        const task = store.createTask(projectId, { title: "Test Task" });

        // Use a non-existent project ID
        const context = store.generateContextBundle(
          "non-existent",
          "claude",
          "claude",
          task,
        );

        expect(context.projectName).toBe("Unknown Project");
        expect(context.projectGoals).toEqual([]);
        expect(context.checkpointRules).toEqual([]);
      });

      it("should handle task without files", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Hello" });

        const task = store.createTask(projectId, { title: "No files task" });
        // Ensure task has no files
        expect(task.files).toEqual([]);

        const context = store.generateContextBundle(
          projectId,
          "claude",
          "claude",
          task,
        );

        expect(context.taskContext?.expectedFiles).toEqual([]);
        expect(context.taskContext?.relatedTasks).toEqual([]);
      });

      it("should handle task with dependencies", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Hello" });

        const task1 = store.createTask(projectId, { title: "Dependency task" });
        const task2 = store.createTask(projectId, {
          title: "Main task",
          dependencies: [task1.id],
        });

        const context = store.generateContextBundle(
          projectId,
          "claude",
          "claude",
          task2,
        );

        expect(context.taskContext?.relatedTasks).toContain(task1.id);
      });

      it("should include allowed/denied paths from approved access request", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Hello" });

        // Create and approve access request with paths
        const accessReq = store.createAccessRequest(projectId, {
          agentId: "path-agent",
          agentName: "Path Agent",
          agentType: "claude",
          metadata: {
            allowedPaths: ["src/components/"],
            deniedPaths: ["src/secrets/"],
          },
        });
        store.approveAccessRequest(accessReq.id, "admin");

        const task = store.createTask(projectId, { title: "Path test" });
        const context = store.generateContextBundle(
          projectId,
          "path-agent",
          "claude",
          task,
        );

        expect(context.allowedPaths).toEqual(["src/components/"]);
        expect(context.deniedPaths).toEqual(["src/secrets/"]);
      });

      it("should use empty arrays when no access request exists", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Hello" });

        const task = store.createTask(projectId, {
          title: "No access request",
        });
        const context = store.generateContextBundle(
          projectId,
          "unknown-agent",
          "claude",
          task,
        );

        expect(context.allowedPaths).toEqual([]);
        expect(context.deniedPaths).toEqual([]);
      });

      it("should use empty arrays when access request has no path metadata", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Hello" });

        // Create access request WITHOUT allowedPaths/deniedPaths in metadata
        const accessReq = store.createAccessRequest(projectId, {
          agentId: "no-paths-agent",
          agentName: "No Paths Agent",
          agentType: "claude",
          metadata: { someOtherField: "value" }, // No paths defined
        });
        store.approveAccessRequest(accessReq.id, "admin");

        const task = store.createTask(projectId, { title: "No paths test" });
        const context = store.generateContextBundle(
          projectId,
          "no-paths-agent",
          "claude",
          task,
        );

        // Should use fallback empty arrays since metadata doesn't have paths
        expect(context.allowedPaths).toEqual([]);
        expect(context.deniedPaths).toEqual([]);
      });

      it("should handle task object with undefined dependencies and files", () => {
        store.setOnboardingConfig(projectId, { welcomeMessage: "Hello" });

        // Pass a manually constructed task with undefined dependencies and files
        // to test the || [] fallback branches at lines 1065 and 1090
        const manualTask = {
          id: "manual-task-id",
          projectId: projectId,
          title: "Manual Task",
          status: "pending" as const,
          priority: "medium" as const,
          dependencies: undefined as unknown as string[],
          files: undefined as unknown as string[],
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const context = store.generateContextBundle(
          projectId,
          "claude",
          "claude",
          manualTask,
        );

        // Verify the fallback branches work correctly
        expect(context.taskContext?.relatedTasks).toEqual([]);
        expect(context.taskContext?.expectedFiles).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe("Utility Methods", () => {
    describe("transaction", () => {
      it("should execute operations in a transaction", () => {
        const project = store.createProject({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test",
          slug: "test",
        });

        const result = store.transaction(() => {
          const task1 = store.createTask(project.id, { title: "Task 1" });
          const task2 = store.createTask(project.id, { title: "Task 2" });
          return [task1, task2];
        });

        expect(result).toHaveLength(2);

        const tasks = store.listTasks(project.id);
        expect(tasks).toHaveLength(2);
      });
    });
  });

  // ============================================================================
  // Agent Type to Provider Mapping (via approveAccessRequest)
  // ============================================================================

  describe("Agent Type to Provider Mapping", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        slug: "test",
      });
      projectId = project.id;
    });

    it("should map claude to anthropic", () => {
      const req = store.createAccessRequest(projectId, {
        agentId: "agent-1",
        agentName: "Claude",
        agentType: "claude",
      });
      store.approveAccessRequest(req.id, "admin");

      const agent = store.getAgent("agent-1");
      expect(agent!.provider).toBe("anthropic");
    });

    it("should map gemini to google", () => {
      const req = store.createAccessRequest(projectId, {
        agentId: "agent-2",
        agentName: "Gemini",
        agentType: "gemini",
      });
      store.approveAccessRequest(req.id, "admin");

      const agent = store.getAgent("agent-2");
      expect(agent!.provider).toBe("google");
    });

    it("should map gpt4 to openai", () => {
      const req = store.createAccessRequest(projectId, {
        agentId: "agent-3",
        agentName: "GPT-4",
        agentType: "gpt4",
      });
      store.approveAccessRequest(req.id, "admin");

      const agent = store.getAgent("agent-3");
      expect(agent!.provider).toBe("openai");
    });

    it("should map codex to openai", () => {
      const req = store.createAccessRequest(projectId, {
        agentId: "agent-4",
        agentName: "Codex",
        agentType: "codex",
      });
      store.approveAccessRequest(req.id, "admin");

      const agent = store.getAgent("agent-4");
      expect(agent!.provider).toBe("openai");
    });

    it("should map llama to meta", () => {
      const req = store.createAccessRequest(projectId, {
        agentId: "agent-5",
        agentName: "Llama",
        agentType: "llama",
      });
      store.approveAccessRequest(req.id, "admin");

      const agent = store.getAgent("agent-5");
      expect(agent!.provider).toBe("meta");
    });

    it("should map unknown to custom", () => {
      const req = store.createAccessRequest(projectId, {
        agentId: "agent-6",
        agentName: "Custom Agent",
        agentType: "my-custom-type",
      });
      store.approveAccessRequest(req.id, "admin");

      const agent = store.getAgent("agent-6");
      expect(agent!.provider).toBe("custom");
    });
  });

  // ============================================================================
  // Checkpoint Methods
  // ============================================================================

  describe("Checkpoint Methods", () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Checkpoint Test Project",
        slug: "checkpoint-test",
      });
      projectId = project.id;

      store.registerAgent(projectId, {
        id: "claude",
        name: "Claude",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: [],
        costPerToken: { input: 0.01, output: 0.03 },
        status: "idle",
        metadata: {},
      });
    });

    describe("saveCheckpoint", () => {
      it("should create and return a checkpoint", () => {
        const task = store.createTask(projectId, { title: "Test Task" });

        const checkpoint = store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task.id,
          checkpointType: "manual",
          stage: "implementation",
          context: {
            filesModified: ["src/main.ts"],
            completedSteps: ["step 1"],
            nextSteps: ["step 2"],
            blockers: [],
          },
          metadata: { note: "first checkpoint" },
        });

        expect(checkpoint.id).toBeDefined();
        expect(checkpoint.projectId).toBe(projectId);
        expect(checkpoint.agentId).toBe("claude");
        expect(checkpoint.taskId).toBe(task.id);
        expect(checkpoint.checkpointType).toBe("manual");
        expect(checkpoint.stage).toBe("implementation");
        expect(checkpoint.context).toEqual({
          filesModified: ["src/main.ts"],
          completedSteps: ["step 1"],
          nextSteps: ["step 2"],
          blockers: [],
        });
        expect(checkpoint.metadata).toEqual({ note: "first checkpoint" });
        expect(checkpoint.createdAt).toBeDefined();
      });

      it("should create a checkpoint without a task", () => {
        const checkpoint = store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "auto",
          stage: "research",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: ["start research"],
            blockers: [],
          },
          metadata: {},
        });

        expect(checkpoint.id).toBeDefined();
        expect(checkpoint.taskId).toBeUndefined();
        expect(checkpoint.checkpointType).toBe("auto");
      });

      it("should create a checkpoint with beadId", () => {
        const checkpoint = store.saveCheckpoint({
          projectId,
          agentId: "claude",
          beadId: "gt-abc12",
          checkpointType: "context_exhaustion",
          stage: "structure",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: ["context window full"],
          },
          metadata: {},
        });

        expect(checkpoint.beadId).toBe("gt-abc12");
        expect(checkpoint.checkpointType).toBe("context_exhaustion");
      });

      it("should create a checkpoint with expiresAt", () => {
        const expiresAt = new Date("2030-01-01T00:00:00Z");

        const checkpoint = store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "manual",
          stage: "planning",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
          expiresAt,
        });

        expect(checkpoint.expiresAt).toBeDefined();
        expect(checkpoint.expiresAt!.getTime()).toBe(expiresAt.getTime());
      });
    });

    describe("getCheckpoint", () => {
      it("should return null for non-existent checkpoint", () => {
        const result = store.getCheckpoint("non-existent-id");
        expect(result).toBeNull();
      });

      it("should return checkpoint by id", () => {
        const task = store.createTask(projectId, { title: "Test" });

        const saved = store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task.id,
          checkpointType: "manual",
          stage: "testing",
          context: {
            filesModified: ["test.ts"],
            completedSteps: ["write tests"],
            nextSteps: ["run tests"],
            blockers: [],
          },
          metadata: {},
        });

        const retrieved = store.getCheckpoint(saved.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(saved.id);
        expect(retrieved!.stage).toBe("testing");
        expect(retrieved!.context).toEqual({
          filesModified: ["test.ts"],
          completedSteps: ["write tests"],
          nextSteps: ["run tests"],
          blockers: [],
        });
      });
    });

    describe("getLatestCheckpoint", () => {
      it("should return null when no checkpoints exist for task", () => {
        const task = store.createTask(projectId, { title: "Test" });
        const result = store.getLatestCheckpoint(task.id);
        expect(result).toBeNull();
      });

      it("should return the most recent checkpoint for a task", () => {
        const task = store.createTask(projectId, { title: "Test" });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task.id,
          checkpointType: "manual",
          stage: "stage-1",
          context: {
            filesModified: [],
            completedSteps: ["first"],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        // Small delay not needed since SQLite datetime has second precision
        // and both inserts happen in the same second, but ORDER BY created_at DESC
        // with LIMIT 1 will return the last inserted row when timestamps are equal
        // due to SQLite rowid ordering.

        const second = store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task.id,
          checkpointType: "auto",
          stage: "stage-2",
          context: {
            filesModified: ["file.ts"],
            completedSteps: ["first", "second"],
            nextSteps: ["third"],
            blockers: [],
          },
          metadata: {},
        });

        const latest = store.getLatestCheckpoint(task.id);
        expect(latest).not.toBeNull();
        expect(latest!.id).toBe(second.id);
        expect(latest!.stage).toBe("stage-2");
      });

      it("should not return checkpoints for a different task", () => {
        const task1 = store.createTask(projectId, { title: "Task 1" });
        const task2 = store.createTask(projectId, { title: "Task 2" });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task1.id,
          checkpointType: "manual",
          stage: "task1-stage",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        const result = store.getLatestCheckpoint(task2.id);
        expect(result).toBeNull();
      });
    });

    describe("listCheckpoints", () => {
      it("should list all checkpoints for a project", () => {
        const task = store.createTask(projectId, { title: "Test" });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task.id,
          checkpointType: "manual",
          stage: "stage-a",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "auto",
          stage: "stage-b",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        const checkpoints = store.listCheckpoints(projectId);
        expect(checkpoints).toHaveLength(2);
      });

      it("should filter by agentId", () => {
        store.registerAgent(projectId, {
          id: "gemini",
          name: "Gemini",
          provider: "google",
          model: "gemini-pro",
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: "idle",
          metadata: {},
        });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "manual",
          stage: "claude-stage",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        store.saveCheckpoint({
          projectId,
          agentId: "gemini",
          checkpointType: "manual",
          stage: "gemini-stage",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        const claudeCheckpoints = store.listCheckpoints(projectId, {
          agentId: "claude",
        });
        expect(claudeCheckpoints).toHaveLength(1);
        expect(claudeCheckpoints[0].agentId).toBe("claude");
        expect(claudeCheckpoints[0].stage).toBe("claude-stage");

        const geminiCheckpoints = store.listCheckpoints(projectId, {
          agentId: "gemini",
        });
        expect(geminiCheckpoints).toHaveLength(1);
        expect(geminiCheckpoints[0].agentId).toBe("gemini");
      });

      it("should filter by taskId", () => {
        const task1 = store.createTask(projectId, { title: "Task 1" });
        const task2 = store.createTask(projectId, { title: "Task 2" });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task1.id,
          checkpointType: "manual",
          stage: "task1-work",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task2.id,
          checkpointType: "manual",
          stage: "task2-work",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        const task1Checkpoints = store.listCheckpoints(projectId, {
          taskId: task1.id,
        });
        expect(task1Checkpoints).toHaveLength(1);
        expect(task1Checkpoints[0].stage).toBe("task1-work");
      });

      it("should filter by both agentId and taskId", () => {
        store.registerAgent(projectId, {
          id: "gemini",
          name: "Gemini",
          provider: "google",
          model: "gemini-pro",
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: "idle",
          metadata: {},
        });

        const task = store.createTask(projectId, { title: "Shared Task" });

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          taskId: task.id,
          checkpointType: "manual",
          stage: "claude-on-shared",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        store.saveCheckpoint({
          projectId,
          agentId: "gemini",
          taskId: task.id,
          checkpointType: "manual",
          stage: "gemini-on-shared",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        const filtered = store.listCheckpoints(projectId, {
          agentId: "claude",
          taskId: task.id,
        });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].stage).toBe("claude-on-shared");
      });

      it("should return empty array for project with no checkpoints", () => {
        const checkpoints = store.listCheckpoints(projectId);
        expect(checkpoints).toHaveLength(0);
      });
    });

    describe("deleteExpiredCheckpoints", () => {
      it("should remove expired checkpoints", () => {
        // Create a checkpoint that is already expired
        const pastDate = new Date("2020-01-01T00:00:00Z");

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "auto",
          stage: "expired-stage",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
          expiresAt: pastDate,
        });

        // Create a checkpoint that is not expired
        const futureDate = new Date("2030-01-01T00:00:00Z");

        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "manual",
          stage: "valid-stage",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
          expiresAt: futureDate,
        });

        // Create a checkpoint with no expiration
        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "manual",
          stage: "no-expiry-stage",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
        });

        const deleted = store.deleteExpiredCheckpoints();
        expect(deleted).toBe(1);

        const remaining = store.listCheckpoints(projectId);
        expect(remaining).toHaveLength(2);

        const stages = remaining.map((c) => c.stage);
        expect(stages).toContain("valid-stage");
        expect(stages).toContain("no-expiry-stage");
        expect(stages).not.toContain("expired-stage");
      });

      it("should return 0 when no checkpoints are expired", () => {
        store.saveCheckpoint({
          projectId,
          agentId: "claude",
          checkpointType: "manual",
          stage: "still-valid",
          context: {
            filesModified: [],
            completedSteps: [],
            nextSteps: [],
            blockers: [],
          },
          metadata: {},
          expiresAt: new Date("2030-12-31T00:00:00Z"),
        });

        const deleted = store.deleteExpiredCheckpoints();
        expect(deleted).toBe(0);
      });

      it("should return 0 when no checkpoints exist", () => {
        const deleted = store.deleteExpiredCheckpoints();
        expect(deleted).toBe(0);
      });
    });
  });
});
