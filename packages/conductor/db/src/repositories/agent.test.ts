import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAgentRepository } from "./agent";

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: vi.fn().mockReturnValue("lock-uuid"),
});

describe("AgentRepository", () => {
  let mockDb: any;
  let repo: ReturnType<typeof createAgentRepository>;

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
      delete: vi.fn().mockReturnThis(),
    };
    repo = createAgentRepository(mockDb);
  });

  describe("create", () => {
    it("should create agent with all fields", async () => {
      const agent = {
        id: "agent-123",
        organizationId: "org-123",
        name: "Claude",
        provider: "anthropic" as const,
        model: "claude-3-opus",
        capabilities: ["code", "analysis", "writing"],
        costPerToken: { input: 0.015, output: 0.075 },
        quotaLimit: 100000,
        quotaUsed: 5000,
        quotaResetAt: new Date("2024-02-01"),
        metadata: { version: "3" },
      };

      mockDb.returning.mockResolvedValue([{ ...agent }]);

      const result = await repo.create(agent);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "agent-123",
        organizationId: "org-123",
        name: "Claude",
        provider: "anthropic",
        model: "claude-3-opus",
        capabilities: JSON.stringify(["code", "analysis", "writing"]),
        costPerTokenInput: 0.015,
        costPerTokenOutput: 0.075,
        quotaLimit: 100000,
        quotaUsed: 5000,
        quotaResetAt: expect.any(String),
        metadata: JSON.stringify({ version: "3" }),
      });
      expect(result).toBeDefined();
    });

    it("should create agent with default values", async () => {
      const agent: any = {
        id: "agent-456",
        name: "GPT-4",
        provider: "openai" as const,
        model: "gpt-4-turbo",
      };

      mockDb.returning.mockResolvedValue([{}]);

      await repo.create(agent);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilities: "[]",
          costPerTokenInput: 0,
          costPerTokenOutput: 0,
          quotaUsed: 0,
          metadata: "{}",
        }),
      );
    });
  });

  describe("findById", () => {
    it("should find agent by id", async () => {
      const agent = { id: "agent-123", name: "Claude" };
      mockDb.where.mockResolvedValue([agent]);

      const result = await repo.findById("agent-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(agent);
    });

    it("should return null when agent not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findGlobal", () => {
    it("should find all global agents", async () => {
      const agents = [
        { id: "agent-1", name: "Claude", organizationId: null },
        { id: "agent-2", name: "GPT", organizationId: null },
      ];
      mockDb.where.mockResolvedValue(agents);

      const result = await repo.findGlobal();

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(agents);
    });
  });

  describe("findByOrganization", () => {
    it("should find all agents in organization", async () => {
      const agents = [
        { id: "agent-1", name: "Custom Claude" },
        { id: "agent-2", name: "Custom GPT" },
      ];
      mockDb.where.mockResolvedValue(agents);

      const result = await repo.findByOrganization("org-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(agents);
    });
  });

  describe("updateStatus", () => {
    it("should update agent status", async () => {
      mockDb.where.mockResolvedValue([{}]);

      await repo.updateStatus("agent-123", "working");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({
        status: "working",
        lastHeartbeat: expect.any(String),
      });
    });
  });

  describe("heartbeat", () => {
    it("should update last heartbeat", async () => {
      mockDb.where.mockResolvedValue([{}]);

      await repo.heartbeat("agent-123");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({
        lastHeartbeat: expect.any(String),
      });
    });
  });

  describe("registerInstance", () => {
    it("should register new agent instance", async () => {
      const instance = {
        id: "instance-123",
        agentId: "agent-123",
        projectId: "proj-123",
        sessionId: "session-abc",
        status: "idle" as const,
        currentTaskId: "task-123",
        lastHeartbeat: new Date("2024-01-01T12:00:00Z"),
        metadata: { host: "server1" },
      };

      mockDb.returning.mockResolvedValue([{ ...instance }]);

      const result = await repo.registerInstance(instance);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "instance-123",
        agentId: "agent-123",
        projectId: "proj-123",
        sessionId: "session-abc",
        status: "idle",
        currentTaskId: "task-123",
        lastHeartbeat: expect.any(String),
        metadata: JSON.stringify({ host: "server1" }),
      });
      expect(result).toBeDefined();
    });

    it("should register instance with default status", async () => {
      const instance: any = {
        id: "instance-456",
        agentId: "agent-123",
        projectId: "proj-123",
        sessionId: "session-def",
        lastHeartbeat: new Date(),
      };

      mockDb.returning.mockResolvedValue([{}]);

      await repo.registerInstance(instance);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "idle",
          metadata: "{}",
        }),
      );
    });
  });

  describe("updateInstance", () => {
    it("should update instance fields", async () => {
      mockDb.where.mockResolvedValue([{}]);

      await repo.updateInstance("session-abc", { status: "working" });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ status: "working" });
    });

    it("should serialize lastHeartbeat when updating", async () => {
      mockDb.where.mockResolvedValue([{}]);

      await repo.updateInstance("session-abc", {
        lastHeartbeat: new Date("2024-01-01T12:00:00Z"),
      });

      expect(mockDb.set).toHaveBeenCalledWith({
        lastHeartbeat: expect.any(String),
      });
    });

    it("should serialize metadata when updating", async () => {
      mockDb.where.mockResolvedValue([{}]);

      await repo.updateInstance("session-abc", {
        metadata: { updated: true },
      });

      expect(mockDb.set).toHaveBeenCalledWith({
        metadata: JSON.stringify({ updated: true }),
      });
    });
  });

  describe("getActiveInstances", () => {
    it("should get active instances for project", async () => {
      const instances = [
        { id: "inst-1", sessionId: "session-1" },
        { id: "inst-2", sessionId: "session-2" },
      ];
      mockDb.where.mockResolvedValue(instances);

      const result = await repo.getActiveInstances("proj-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(instances);
    });
  });

  describe("removeInstance", () => {
    it("should remove instance by session id", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repo.removeInstance("session-abc");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("acquireLock", () => {
    it("should acquire lock on file", async () => {
      const lock = {
        projectId: "proj-123",
        filePath: "src/index.ts",
        agentId: "agent-123",
        taskId: "task-123",
        expiresAt: new Date("2024-01-01T13:00:00Z"),
      };

      // No existing lock
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.returning.mockResolvedValue([{ id: "lock-uuid", ...lock }]);

      const result = await repo.acquireLock(lock);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "lock-uuid",
        projectId: "proj-123",
        filePath: "src/index.ts",
        agentId: "agent-123",
        taskId: "task-123",
        expiresAt: expect.any(String),
      });
      expect(result).toBeDefined();
    });

    it("should return null when lock already exists", async () => {
      // Existing non-expired lock
      mockDb.where.mockResolvedValueOnce([
        {
          id: "existing-lock",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      ]);

      const result = await repo.acquireLock({
        projectId: "proj-123",
        filePath: "src/index.ts",
        agentId: "agent-456",
      });

      expect(result).toBeNull();
    });

    it("should acquire lock when existing lock is expired", async () => {
      // Existing expired lock
      const expiredTime = new Date(Date.now() - 60000).toISOString();
      mockDb.where
        .mockResolvedValueOnce([{ id: "expired-lock", expiresAt: expiredTime }])
        .mockResolvedValueOnce([]); // For delete
      mockDb.returning.mockResolvedValue([{ id: "new-lock" }]);

      const result = await repo.acquireLock({
        projectId: "proj-123",
        filePath: "src/index.ts",
        agentId: "agent-789",
      });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should return null when lock has no expiry", async () => {
      // Existing lock without expiry
      mockDb.where.mockResolvedValueOnce([
        { id: "permanent-lock", expiresAt: null },
      ]);

      const result = await repo.acquireLock({
        projectId: "proj-123",
        filePath: "src/index.ts",
        agentId: "agent-456",
      });

      expect(result).toBeNull();
    });
  });

  describe("releaseLock", () => {
    it("should release lock on file", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repo.releaseLock("proj-123", "src/index.ts", "agent-123");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("getLocksForProject", () => {
    it("should get all locks for project", async () => {
      const locks = [
        { id: "lock-1", filePath: "src/index.ts" },
        { id: "lock-2", filePath: "src/utils.ts" },
      ];
      mockDb.where.mockResolvedValue(locks);

      const result = await repo.getLocksForProject("proj-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(locks);
    });
  });

  describe("cleanupExpiredLocks", () => {
    it("should delete expired locks", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repo.cleanupExpiredLocks();

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
