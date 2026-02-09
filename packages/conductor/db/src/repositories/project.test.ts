import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProjectRepository } from "./project";

describe("ProjectRepository", () => {
  let mockDb: any;
  let repo: ReturnType<typeof createProjectRepository>;

  beforeEach(() => {
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
    repo = createProjectRepository(mockDb);
  });

  describe("create", () => {
    it("should create project with all fields", async () => {
      const project: any = {
        id: "proj-123",
        organizationId: "org-123",
        name: "Test Project",
        slug: "test-project",
        description: "A test project",
        rootPath: "/path/to/project",
        gitRemote: "https://github.com/org/repo",
        gitBranch: "develop",
        conflictStrategy: "merge" as const,
        budget: { total: 1000, spent: 100, alertThreshold: 90 },
        settings: { autoAssign: true },
        isActive: true,
      };

      mockDb.returning.mockResolvedValue([{ ...project }]);

      const result = await repo.create(project);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "proj-123",
        organizationId: "org-123",
        name: "Test Project",
        slug: "test-project",
        description: "A test project",
        rootPath: "/path/to/project",
        gitRemote: "https://github.com/org/repo",
        gitBranch: "develop",
        conflictStrategy: "merge",
        budgetTotal: 1000,
        budgetSpent: 100,
        budgetAlertThreshold: 90,
        settings: JSON.stringify({ autoAssign: true }),
        isActive: true,
      });
      expect(result).toBeDefined();
    });

    it("should create project with default values", async () => {
      const project: any = {
        id: "proj-456",
        organizationId: "org-123",
        name: "Minimal Project",
        slug: "minimal-project",
      };

      mockDb.returning.mockResolvedValue([{}]);

      await repo.create(project);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          gitBranch: "main",
          conflictStrategy: "lock",
          budgetSpent: 0,
          budgetAlertThreshold: 80,
          settings: "{}",
          isActive: true,
        }),
      );
    });
  });

  describe("findById", () => {
    it("should find project by id", async () => {
      const project = { id: "proj-123", name: "Test Project" };
      mockDb.where.mockResolvedValue([project]);

      const result = await repo.findById("proj-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(project);
    });

    it("should return null when project not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByOrganization", () => {
    it("should find all projects in organization", async () => {
      const projects = [
        { id: "proj-1", name: "Project 1" },
        { id: "proj-2", name: "Project 2" },
      ];
      mockDb.where.mockResolvedValue(projects);

      const result = await repo.findByOrganization("org-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(projects);
    });

    it("should return empty array when no projects found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.findByOrganization("org-123");

      expect(result).toEqual([]);
    });
  });

  describe("findBySlug", () => {
    it("should find project by organization and slug", async () => {
      const project = { id: "proj-123", slug: "test-project" };
      mockDb.where.mockResolvedValue([project]);

      const result = await repo.findBySlug("org-123", "test-project");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(project);
    });

    it("should return null when project not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.findBySlug("org-123", "non-existent");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update project fields", async () => {
      const updated = { id: "proj-123", name: "Updated Project" };
      mockDb.returning.mockResolvedValue([updated]);

      const result = await repo.update("proj-123", { name: "Updated Project" });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Project",
          updatedAt: expect.any(String),
        }),
      );
      expect(result).toEqual(updated);
    });

    it("should serialize settings when updating", async () => {
      mockDb.returning.mockResolvedValue([{}]);

      await repo.update("proj-123", { settings: { autoAssign: false } });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: JSON.stringify({ autoAssign: false }),
        }),
      );
    });

    it("should update budget fields separately", async () => {
      mockDb.returning.mockResolvedValue([{}]);

      await repo.update("proj-123", {
        budget: {
          total: 2000,
          spent: 500,
          alertThreshold: 75,
          currency: "USD" as const,
        },
      });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetTotal: 2000,
          budgetSpent: 500,
          budgetAlertThreshold: 75,
        }),
      );
    });
  });

  describe("delete", () => {
    it("should delete project by id", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repo.delete("proj-123");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("addAgent", () => {
    it("should add agent to project", async () => {
      const binding: any = {
        id: "binding-123",
        projectId: "proj-123",
        agentId: "agent-456",
        role: "lead" as const,
        customInstructions: "Be thorough",
        instructionsFile: "CLAUDE.md",
        allowedPaths: ["src/**"],
        deniedPaths: ["secrets/**"],
        tokenBudget: 10000,
        isEnabled: true,
      };

      mockDb.returning.mockResolvedValue([{ ...binding }]);

      const result = await repo.addAgent(binding);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "binding-123",
        projectId: "proj-123",
        agentId: "agent-456",
        role: "lead",
        customInstructions: "Be thorough",
        instructionsFile: "CLAUDE.md",
        allowedPaths: JSON.stringify(["src/**"]),
        deniedPaths: JSON.stringify(["secrets/**"]),
        tokenBudget: 10000,
        isEnabled: true,
      });
      expect(result).toBeDefined();
    });

    it("should add agent with default values", async () => {
      const binding: any = {
        id: "binding-456",
        projectId: "proj-123",
        agentId: "agent-789",
      };

      mockDb.returning.mockResolvedValue([{}]);

      await repo.addAgent(binding);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "contributor",
          allowedPaths: "[]",
          deniedPaths: "[]",
          isEnabled: true,
        }),
      );
    });
  });

  describe("getAgents", () => {
    it("should get all agents for project", async () => {
      const agents = [
        { id: "binding-1", agentId: "agent-1" },
        { id: "binding-2", agentId: "agent-2" },
      ];
      mockDb.where.mockResolvedValue(agents);

      const result = await repo.getAgents("proj-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(agents);
    });
  });

  describe("removeAgent", () => {
    it("should remove agent from project", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repo.removeAgent("proj-123", "agent-456");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
