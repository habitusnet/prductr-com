/**
 * Types Tests
 * Verify Zod schema validation and type inference
 */

import { describe, it, expect } from "vitest";
import {
  OrganizationSchema,
  OrganizationMemberSchema,
  AgentProfileSchema,
  BudgetSchema,
  ProjectSchema,
  ProjectAgentSchema,
  TaskSchema,
  TaskActivitySchema,
  FileConflictSchema,
  FileLockSchema,
  CostEventSchema,
  AgentInstanceSchema,
  ConnectorConfigSchema,
  AccessRequestSchema,
  ProjectContextSchema,
  ProjectOnboardingConfigSchema,
} from "./types.js";

describe("Types", () => {
  describe("OrganizationSchema", () => {
    it("should validate a complete organization", () => {
      const org = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Org",
        slug: "test-org",
        plan: "pro",
        billingEmail: "billing@test.com",
        apiKeys: ["key1", "key2"],
        settings: { theme: "dark" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = OrganizationSchema.parse(org);
      expect(result.name).toBe("Test Org");
      expect(result.plan).toBe("pro");
    });

    it("should apply defaults for optional fields", () => {
      const org = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Org",
        slug: "test-org",
      };

      const result = OrganizationSchema.parse(org);
      expect(result.plan).toBe("free");
      expect(result.apiKeys).toEqual([]);
      expect(result.settings).toEqual({});
    });

    it("should reject invalid slug format", () => {
      const org = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Org",
        slug: "Test Org!", // Invalid: contains uppercase and special char
      };

      expect(() => OrganizationSchema.parse(org)).toThrow();
    });

    it("should reject invalid UUID", () => {
      const org = {
        id: "not-a-uuid",
        name: "Test Org",
        slug: "test-org",
      };

      expect(() => OrganizationSchema.parse(org)).toThrow();
    });
  });

  describe("OrganizationMemberSchema", () => {
    it("should validate a member", () => {
      const member = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "123e4567-e89b-12d3-a456-426614174001",
        userId: "123e4567-e89b-12d3-a456-426614174002",
        role: "admin",
      };

      const result = OrganizationMemberSchema.parse(member);
      expect(result.role).toBe("admin");
    });

    it("should default role to member", () => {
      const member = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "123e4567-e89b-12d3-a456-426614174001",
        userId: "123e4567-e89b-12d3-a456-426614174002",
      };

      const result = OrganizationMemberSchema.parse(member);
      expect(result.role).toBe("member");
    });
  });

  describe("AgentProfileSchema", () => {
    it("should validate a complete agent profile", () => {
      const profile = {
        id: "claude",
        name: "Claude Code",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: ["typescript", "testing"],
        costPerToken: { input: 0.000015, output: 0.000075 },
        status: "idle",
        metadata: {},
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.provider).toBe("anthropic");
      expect(result.capabilities).toHaveLength(2);
    });

    it("should validate with optional organization binding", () => {
      const profile = {
        id: "org-claude",
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Org Claude",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: [],
        costPerToken: { input: 0.000015, output: 0.000075 },
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.organizationId).toBe(
        "123e4567-e89b-12d3-a456-426614174000",
      );
    });

    it("should validate quota fields", () => {
      const profile = {
        id: "claude",
        name: "Claude",
        provider: "anthropic",
        model: "claude-opus-4",
        capabilities: [],
        costPerToken: { input: 0.01, output: 0.03 },
        quotaLimit: 1000000,
        quotaUsed: 500000,
        quotaResetAt: new Date(),
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.quotaLimit).toBe(1000000);
      expect(result.quotaUsed).toBe(500000);
    });
  });

  describe("BudgetSchema", () => {
    it("should validate a budget", () => {
      const budget = {
        total: 1000,
        spent: 250,
        currency: "USD",
        alertThreshold: 90,
      };

      const result = BudgetSchema.parse(budget);
      expect(result.total).toBe(1000);
      expect(result.spent).toBe(250);
    });

    it("should apply defaults", () => {
      const budget = { total: 500 };

      const result = BudgetSchema.parse(budget);
      expect(result.spent).toBe(0);
      expect(result.currency).toBe("USD");
      expect(result.alertThreshold).toBe(80);
    });
  });

  describe("ProjectSchema", () => {
    it("should validate a complete project", () => {
      const project = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "123e4567-e89b-12d3-a456-426614174001",
        name: "Test Project",
        slug: "test-project",
        description: "A test project",
        rootPath: "/home/user/projects/test",
        gitRemote: "https://github.com/org/repo",
        gitBranch: "develop",
        conflictStrategy: "merge",
        budget: { total: 1000 },
        isActive: true,
      };

      const result = ProjectSchema.parse(project);
      expect(result.conflictStrategy).toBe("merge");
      expect(result.gitBranch).toBe("develop");
    });

    it("should apply defaults", () => {
      const project = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "123e4567-e89b-12d3-a456-426614174001",
        name: "Test Project",
        slug: "test-project",
      };

      const result = ProjectSchema.parse(project);
      expect(result.gitBranch).toBe("main");
      expect(result.conflictStrategy).toBe("lock");
      expect(result.isActive).toBe(true);
      expect(result.settings).toEqual({});
    });
  });

  describe("ProjectAgentSchema", () => {
    it("should validate a project agent binding", () => {
      const binding = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        agentId: "claude",
        role: "lead",
        customInstructions: "Focus on TypeScript files",
        allowedPaths: ["src/**/*.ts"],
        deniedPaths: ["node_modules/**"],
        tokenBudget: 500000,
      };

      const result = ProjectAgentSchema.parse(binding);
      expect(result.role).toBe("lead");
      expect(result.allowedPaths).toHaveLength(1);
    });

    it("should apply defaults", () => {
      const binding = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        agentId: "gemini",
      };

      const result = ProjectAgentSchema.parse(binding);
      expect(result.role).toBe("contributor");
      expect(result.isEnabled).toBe(true);
      expect(result.allowedPaths).toEqual([]);
      expect(result.deniedPaths).toEqual([]);
    });
  });

  describe("TaskSchema", () => {
    it("should validate a complete task", () => {
      const task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        title: "Fix authentication bug",
        description: "The login form is not validating email correctly",
        status: "in_progress",
        priority: "high",
        assignedTo: "claude",
        claimedAt: new Date(),
        startedAt: new Date(),
        dependencies: [],
        files: ["src/auth/login.ts", "src/auth/validate.ts"],
        tags: ["bug", "auth"],
        estimatedTokens: 50000,
      };

      const result = TaskSchema.parse(task);
      expect(result.status).toBe("in_progress");
      expect(result.priority).toBe("high");
      expect(result.files).toHaveLength(2);
    });

    it("should apply defaults", () => {
      const task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        title: "Simple task",
      };

      const result = TaskSchema.parse(task);
      expect(result.status).toBe("pending");
      expect(result.priority).toBe("medium");
      expect(result.dependencies).toEqual([]);
      expect(result.files).toEqual([]);
      expect(result.tags).toEqual([]);
    });

    it("should validate all task statuses", () => {
      const statuses = [
        "pending",
        "claimed",
        "in_progress",
        "completed",
        "failed",
        "blocked",
        "cancelled",
      ];

      for (const status of statuses) {
        const task = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          projectId: "123e4567-e89b-12d3-a456-426614174001",
          title: "Test",
          status,
        };
        const result = TaskSchema.parse(task);
        expect(result.status).toBe(status);
      }
    });

    it("should validate all priorities", () => {
      const priorities = ["critical", "high", "medium", "low"];

      for (const priority of priorities) {
        const task = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          projectId: "123e4567-e89b-12d3-a456-426614174001",
          title: "Test",
          priority,
        };
        const result = TaskSchema.parse(task);
        expect(result.priority).toBe(priority);
      }
    });

    it("should support subtasks via parentId", () => {
      const task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        parentId: "123e4567-e89b-12d3-a456-426614174002",
        title: "Subtask",
      };

      const result = TaskSchema.parse(task);
      expect(result.parentId).toBe("123e4567-e89b-12d3-a456-426614174002");
    });
  });

  describe("TaskActivitySchema", () => {
    it("should validate task activity", () => {
      const activity = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        taskId: "123e4567-e89b-12d3-a456-426614174001",
        agentId: "claude",
        action: "started",
        description: "Started working on the task",
        metadata: { attempt: 1 },
      };

      const result = TaskActivitySchema.parse(activity);
      expect(result.action).toBe("started");
    });

    it("should validate all action types", () => {
      const actions = [
        "created",
        "claimed",
        "started",
        "progress_update",
        "completed",
        "failed",
        "blocked",
        "unblocked",
        "reassigned",
        "cancelled",
        "commented",
      ];

      for (const action of actions) {
        const activity = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          taskId: "123e4567-e89b-12d3-a456-426614174001",
          action,
        };
        const result = TaskActivitySchema.parse(activity);
        expect(result.action).toBe(action);
      }
    });
  });

  describe("FileConflictSchema", () => {
    it("should validate a file conflict", () => {
      const conflict = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        filePath: "src/auth/login.ts",
        agents: ["claude", "gemini"],
        strategy: "merge",
      };

      const result = FileConflictSchema.parse(conflict);
      expect(result.agents).toHaveLength(2);
      expect(result.strategy).toBe("merge");
    });

    it("should validate all strategies", () => {
      const strategies = ["lock", "merge", "zone", "review"];

      for (const strategy of strategies) {
        const conflict = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          projectId: "123e4567-e89b-12d3-a456-426614174001",
          filePath: "file.ts",
          agents: ["a"],
          strategy,
        };
        const result = FileConflictSchema.parse(conflict);
        expect(result.strategy).toBe(strategy);
      }
    });

    it("should validate resolution states", () => {
      const conflict = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        filePath: "file.ts",
        agents: ["claude"],
        strategy: "review",
        resolution: "merged",
        resolvedAt: new Date(),
        resolvedBy: "user-123",
      };

      const result = FileConflictSchema.parse(conflict);
      expect(result.resolution).toBe("merged");
    });
  });

  describe("FileLockSchema", () => {
    it("should validate a file lock", () => {
      const lock = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        filePath: "src/main.ts",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        agentId: "claude",
        taskId: "123e4567-e89b-12d3-a456-426614174002",
        expiresAt: new Date(Date.now() + 3600000),
      };

      const result = FileLockSchema.parse(lock);
      expect(result.agentId).toBe("claude");
      expect(result.expiresAt).toBeDefined();
    });
  });

  describe("CostEventSchema", () => {
    it("should validate a cost event", () => {
      const event = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "123e4567-e89b-12d3-a456-426614174001",
        projectId: "123e4567-e89b-12d3-a456-426614174002",
        agentId: "claude",
        taskId: "123e4567-e89b-12d3-a456-426614174003",
        model: "claude-opus-4",
        tokensInput: 10000,
        tokensOutput: 5000,
        cost: 0.525,
      };

      const result = CostEventSchema.parse(event);
      expect(result.cost).toBe(0.525);
      expect(result.tokensInput).toBe(10000);
    });
  });

  describe("AgentInstanceSchema", () => {
    it("should validate an agent instance", () => {
      const instance = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        agentId: "claude",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        sessionId: "session-abc123",
        status: "working",
        currentTaskId: "123e4567-e89b-12d3-a456-426614174002",
        lastHeartbeat: new Date(),
      };

      const result = AgentInstanceSchema.parse(instance);
      expect(result.status).toBe("working");
      expect(result.sessionId).toBe("session-abc123");
    });
  });

  describe("ConnectorConfigSchema", () => {
    it("should validate a connector config", () => {
      const config = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "123e4567-e89b-12d3-a456-426614174001",
        type: "github",
        name: "Main GitHub",
        config: {
          token: "ghp_xxx",
          owner: "myorg",
          repo: "myrepo",
        },
        isEnabled: true,
      };

      const result = ConnectorConfigSchema.parse(config);
      expect(result.type).toBe("github");
    });

    it("should validate all connector types", () => {
      const types = ["github", "gitlab", "slack", "discord", "webhook"];

      for (const type of types) {
        const config = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          organizationId: "123e4567-e89b-12d3-a456-426614174001",
          type,
          name: "Test",
          config: {},
        };
        const result = ConnectorConfigSchema.parse(config);
        expect(result.type).toBe(type);
      }
    });
  });

  describe("AccessRequestSchema", () => {
    it("should validate an access request", () => {
      const request = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
        agentId: "claude-instance-1",
        agentName: "Claude Code",
        agentType: "claude",
        capabilities: ["typescript", "testing"],
        requestedRole: "contributor",
        status: "pending",
      };

      const result = AccessRequestSchema.parse(request);
      expect(result.status).toBe("pending");
      expect(result.agentType).toBe("claude");
    });

    it("should validate all statuses", () => {
      const statuses = ["pending", "approved", "denied", "expired"];

      for (const status of statuses) {
        const request = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          projectId: "123e4567-e89b-12d3-a456-426614174001",
          agentId: "agent-1",
          agentName: "Agent",
          agentType: "claude",
          status,
        };
        const result = AccessRequestSchema.parse(request);
        expect(result.status).toBe(status);
      }
    });
  });

  describe("ProjectContextSchema", () => {
    it("should validate a complete project context", () => {
      const context = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        projectName: "Test Project",
        currentFocus: "Authentication module",
        projectGoals: ["Implement OAuth", "Add tests"],
        agentInstructions: "Follow TypeScript best practices",
        styleGuide: "Use Prettier and ESLint",
        relevantPatterns: [
          { file: "src/auth.ts", description: "Auth pattern" },
        ],
        allowedPaths: ["src/**/*.ts"],
        deniedPaths: ["node_modules/**"],
        checkpointRules: ["Run tests before commit"],
        taskContext: {
          taskId: "task-1",
          taskTitle: "Fix auth bug",
          expectedFiles: ["src/auth.ts"],
        },
        isFirstTask: true,
      };

      const result = ProjectContextSchema.parse(context);
      expect(result.isFirstTask).toBe(true);
      expect(result.taskContext?.taskId).toBe("task-1");
    });

    it("should apply defaults", () => {
      const context = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        projectName: "Test",
      };

      const result = ProjectContextSchema.parse(context);
      expect(result.projectGoals).toEqual([]);
      expect(result.relevantPatterns).toEqual([]);
      expect(result.allowedPaths).toEqual([]);
      expect(result.deniedPaths).toEqual([]);
      expect(result.checkpointRules).toEqual([]);
      expect(result.isFirstTask).toBe(false);
    });
  });

  describe("ProjectOnboardingConfigSchema", () => {
    it("should validate onboarding config", () => {
      const config = {
        welcomeMessage: "Welcome to the project!",
        agentInstructionsFiles: {
          claude: "CLAUDE.md",
          gemini: "GEMINI.md",
        },
        currentFocus: "Performance optimization",
        goals: ["Reduce bundle size", "Improve load time"],
        styleGuide: "See CONTRIBUTING.md",
        checkpointRules: ["Run tests", "Update changelog"],
        checkpointEveryNTasks: 5,
        autoRefreshContext: false,
      };

      const result = ProjectOnboardingConfigSchema.parse(config);
      expect(result.checkpointEveryNTasks).toBe(5);
      expect(result.autoRefreshContext).toBe(false);
    });

    it("should apply defaults", () => {
      const config = {};

      const result = ProjectOnboardingConfigSchema.parse(config);
      expect(result.agentInstructionsFiles).toEqual({});
      expect(result.goals).toEqual([]);
      expect(result.checkpointRules).toEqual([]);
      expect(result.checkpointEveryNTasks).toBe(3);
      expect(result.autoRefreshContext).toBe(true);
    });
  });
});
