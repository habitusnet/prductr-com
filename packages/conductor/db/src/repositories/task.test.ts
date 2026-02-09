import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTaskRepository } from "./task";

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: vi.fn().mockReturnValue("activity-uuid"),
});

describe("TaskRepository", () => {
  let mockDb: any;
  let repo: ReturnType<typeof createTaskRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    };
    repo = createTaskRepository(mockDb);
  });

  describe("create", () => {
    it("should create task with all fields", async () => {
      const task: any = {
        id: "task-123",
        projectId: "proj-123",
        parentId: "task-parent",
        title: "Test Task",
        description: "A test task",
        status: "pending" as const,
        priority: "high" as const,
        assignedTo: "agent-123",
        dueAt: new Date("2024-12-31"),
        dependencies: ["task-dep-1", "task-dep-2"],
        estimatedTokens: 5000,
        files: ["src/index.ts", "src/utils.ts"],
        tags: ["feature", "priority"],
        metadata: { source: "api" },
        createdBy: "user-123",
      };

      mockDb.returning.mockResolvedValue([{ ...task }]);
      // Mock for activity logging
      mockDb.values.mockReturnThis();

      const result = await repo.create(task);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "task-123",
          projectId: "proj-123",
          parentId: "task-parent",
          title: "Test Task",
          description: "A test task",
          status: "pending",
          priority: "high",
          assignedTo: "agent-123",
          dependencies: JSON.stringify(["task-dep-1", "task-dep-2"]),
          files: JSON.stringify(["src/index.ts", "src/utils.ts"]),
          tags: JSON.stringify(["feature", "priority"]),
          metadata: JSON.stringify({ source: "api" }),
        }),
      );
      expect(result).toBeDefined();
    });

    it("should create task with default values", async () => {
      const task: any = {
        id: "task-456",
        projectId: "proj-123",
        title: "Minimal Task",
      };

      mockDb.returning.mockResolvedValue([{}]);

      await repo.create(task);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
          priority: "medium",
          dependencies: "[]",
          files: "[]",
          tags: "[]",
          metadata: "{}",
        }),
      );
    });

    it("should log creation activity", async () => {
      const task: any = {
        id: "task-789",
        projectId: "proj-123",
        title: "Task with Activity",
      };

      mockDb.returning.mockResolvedValue([{ ...task }]);

      await repo.create(task);

      // Should have called insert twice: once for task, once for activity
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("findById", () => {
    it("should find task by id", async () => {
      const task = { id: "task-123", title: "Test Task" };
      mockDb.where.mockResolvedValue([task]);

      const result = await repo.findById("task-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(task);
    });

    it("should return null when task not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByProject", () => {
    it("should find all tasks in project", async () => {
      const tasks = [
        { id: "task-1", title: "Task 1" },
        { id: "task-2", title: "Task 2" },
      ];
      mockDb.orderBy.mockResolvedValue(tasks);

      const result = await repo.findByProject("proj-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(tasks);
    });

    it("should filter by status", async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await repo.findByProject("proj-123", { status: "pending" });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should filter by multiple statuses", async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await repo.findByProject("proj-123", {
        status: ["pending", "in_progress"],
      });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should filter by priority", async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await repo.findByProject("proj-123", { priority: "high" });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should filter by assignedTo", async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await repo.findByProject("proj-123", { assignedTo: "agent-123" });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("claim", () => {
    it("should claim pending task", async () => {
      const claimedTask = {
        id: "task-123",
        status: "claimed",
        assignedTo: "agent-123",
      };
      mockDb.returning.mockResolvedValue([claimedTask]);

      const result = await repo.claim("task-123", "agent-123");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "claimed",
          assignedTo: "agent-123",
          claimedAt: expect.any(String),
        }),
      );
      expect(result).toEqual(claimedTask);
    });

    it("should log claim activity", async () => {
      const claimedTask = { id: "task-123", status: "claimed" };
      mockDb.returning.mockResolvedValue([claimedTask]);

      await repo.claim("task-123", "agent-123");

      // Second insert is for activity
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should return undefined when task cannot be claimed", async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await repo.claim("task-123", "agent-123");

      expect(result).toBeUndefined();
    });
  });

  describe("start", () => {
    it("should start claimed task", async () => {
      const startedTask = {
        id: "task-123",
        status: "in_progress",
        assignedTo: "agent-123",
      };
      mockDb.returning.mockResolvedValue([startedTask]);

      const result = await repo.start("task-123");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "in_progress",
          startedAt: expect.any(String),
        }),
      );
      expect(result).toEqual(startedTask);
    });

    it("should log start activity", async () => {
      mockDb.returning.mockResolvedValue([{ assignedTo: "agent-123" }]);

      await repo.start("task-123");

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("complete", () => {
    it("should complete task with result", async () => {
      const completedTask = {
        id: "task-123",
        status: "completed",
        assignedTo: "agent-123",
      };
      mockDb.returning.mockResolvedValue([completedTask]);

      const result = await repo.complete(
        "task-123",
        "Task completed successfully",
        5000,
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          completedAt: expect.any(String),
          result: "Task completed successfully",
          actualTokens: 5000,
        }),
      );
      expect(result).toEqual(completedTask);
    });

    it("should complete task without result", async () => {
      mockDb.returning.mockResolvedValue([{ assignedTo: "agent-123" }]);

      await repo.complete("task-123");

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          result: undefined,
          actualTokens: undefined,
        }),
      );
    });

    it("should log complete activity", async () => {
      mockDb.returning.mockResolvedValue([{ assignedTo: "agent-123" }]);

      await repo.complete("task-123", "Done");

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("fail", () => {
    it("should mark task as failed with error", async () => {
      const failedTask = {
        id: "task-123",
        status: "failed",
        assignedTo: "agent-123",
      };
      mockDb.returning.mockResolvedValue([failedTask]);

      const result = await repo.fail("task-123", "Something went wrong");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          errorMessage: "Something went wrong",
        }),
      );
      expect(result).toEqual(failedTask);
    });

    it("should log fail activity", async () => {
      mockDb.returning.mockResolvedValue([{ assignedTo: "agent-123" }]);

      await repo.fail("task-123", "Error message");

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("updateProgress", () => {
    it("should log progress update", async () => {
      await repo.updateProgress("task-123", "Making progress", { percent: 50 });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-123",
          action: "progress_update",
          description: "Making progress",
          metadata: JSON.stringify({ percent: 50 }),
        }),
      );
    });

    it("should log progress without metadata", async () => {
      await repo.updateProgress("task-123", "Simple update");

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: "{}",
        }),
      );
    });
  });

  describe("logActivity", () => {
    it("should log task activity", async () => {
      const activity = {
        id: "activity-123",
        taskId: "task-123",
        agentId: "agent-123",
        action: "commented" as const,
        description: "A comment",
        metadata: { important: true },
      };

      await repo.logActivity(activity);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "activity-123",
        taskId: "task-123",
        agentId: "agent-123",
        action: "commented",
        description: "A comment",
        metadata: JSON.stringify({ important: true }),
      });
    });
  });

  describe("getActivities", () => {
    it("should get all activities for task", async () => {
      const activities = [
        { id: "act-1", action: "created" },
        { id: "act-2", action: "started" },
      ];
      mockDb.orderBy.mockResolvedValue(activities);

      const result = await repo.getActivities("task-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(activities);
    });
  });

  describe("getPendingTasks", () => {
    it("should get all pending tasks for project", async () => {
      const tasks = [
        { id: "task-1", status: "pending" },
        { id: "task-2", status: "pending" },
      ];
      mockDb.orderBy.mockResolvedValue(tasks);

      const result = await repo.getPendingTasks("proj-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(tasks);
    });
  });
});
