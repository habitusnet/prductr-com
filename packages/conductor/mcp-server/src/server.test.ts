/**
 * MCP Server Tests
 * Tests for the Conductor MCP server and its tools
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createConductorServer,
  type ConductorServerOptions,
} from "./server.js";

// Store registered tools and resources for testing
const registeredTools: Map<
  string,
  { description: string; schema: any; handler: Function }
> = new Map();
const registeredResources: Map<
  string,
  { description: string; handler: Function }
> = new Map();

// Mock functions for MCP Server (vitest v4+)
const mockTool = vi.fn(
  (name: string, description: string, schema: any, handler: Function) => {
    registeredTools.set(name, { description, schema, handler });
  },
);
const mockResource = vi.fn(
  (uri: string, description: string, handler: Function) => {
    registeredResources.set(uri, { description, handler });
  },
);
const mockConnect = vi.fn();

// Mock the MCP SDK
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  return {
    McpServer: class MockMcpServer {
      tool = mockTool;
      resource = mockResource;
      connect = mockConnect;
    },
  };
});

// Mock state store
const mockStateStore = {
  // Task methods
  listTasks: vi.fn(),
  getTask: vi.fn(),
  claimTask: vi.fn(),
  updateTask: vi.fn(),
  recordTaskClaim: vi.fn(),

  // Lock methods
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  checkLock: vi.fn(),

  // Agent methods
  getAgent: vi.fn(),
  listAgents: vi.fn(),
  heartbeat: vi.fn(),
  updateAgentStatus: vi.fn(),

  // Project methods
  getProject: vi.fn(),
  getProjectSpend: vi.fn(),

  // Cost methods
  recordCost: vi.fn(),

  // Access request methods
  hasApprovedAccess: vi.fn(),
  createAccessRequest: vi.fn(),
  listAccessRequests: vi.fn(),
  getPendingAccessCount: vi.fn(),

  // Context methods
  generateContextBundle: vi.fn(),
  generateContextRefresh: vi.fn(),
  shouldRefreshContext: vi.fn(),
  getOnboardingConfig: vi.fn(),

  // Zone methods
  getProjectZoneConfig: vi.fn().mockReturnValue(null),

  // Reassignment methods
  getOrphanedTasks: vi.fn().mockReturnValue([]),
  getTaskReassignmentCount: vi.fn().mockReturnValue(0),
  reassignTask: vi.fn(),
};

const projectId = "test-project-123";

describe("MCP Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.clear();
    registeredResources.clear();
    // Default mock return values needed by HealthMonitor.start()
    mockStateStore.listAgents.mockReturnValue([]);
    mockStateStore.getProjectZoneConfig.mockReturnValue(null);
    mockStateStore.getOrphanedTasks.mockReturnValue([]);
  });

  describe("createConductorServer", () => {
    it("should create server with correct name and version", () => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });

      expect(mockTool).toHaveBeenCalled();
    });

    it("should register all expected tools", () => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });

      const expectedTools = [
        "conductor_list_tasks",
        "conductor_get_task",
        "conductor_claim_task",
        "conductor_update_task",
        "conductor_lock_file",
        "conductor_unlock_file",
        "conductor_check_locks",
        "conductor_report_usage",
        "conductor_get_budget",
        "conductor_heartbeat",
        "conductor_list_agents",
        "conductor_request_access",
        "conductor_check_access",
        "conductor_refresh_context",
        "conductor_get_onboarding_config",
        "conductor_get_zones",
        "conductor_health_status",
      ];

      expectedTools.forEach((tool) => {
        expect(registeredTools.has(tool)).toBe(true);
      });
    });

    it("should register project status resource", () => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });

      expect(
        registeredResources.has(`conductor://project/${projectId}/status`),
      ).toBe(true);
    });
  });

  describe("Task Tools", () => {
    beforeEach(() => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });
    });

    describe("conductor_list_tasks", () => {
      it("should list tasks with filters", async () => {
        const mockTasks = [
          {
            id: "task-1",
            title: "Test Task 1",
            status: "pending",
            priority: "high",
            assignedTo: null,
            files: ["src/index.ts"],
            tags: ["typescript"],
          },
          {
            id: "task-2",
            title: "Test Task 2",
            status: "in_progress",
            priority: "medium",
            assignedTo: "claude",
            files: [],
            tags: [],
          },
        ];
        mockStateStore.listTasks.mockReturnValue(mockTasks);

        const tool = registeredTools.get("conductor_list_tasks")!;
        const result = await tool.handler({
          status: "pending",
          priority: "high",
        });

        expect(mockStateStore.listTasks).toHaveBeenCalledWith(projectId, {
          status: "pending",
          priority: "high",
          assignedTo: undefined,
        });
        expect(result.content[0].type).toBe("text");
        expect(JSON.parse(result.content[0].text)).toHaveLength(2);
      });

      it("should list tasks without filters", async () => {
        mockStateStore.listTasks.mockReturnValue([]);

        const tool = registeredTools.get("conductor_list_tasks")!;
        const result = await tool.handler({});

        expect(mockStateStore.listTasks).toHaveBeenCalledWith(projectId, {
          status: undefined,
          priority: undefined,
          assignedTo: undefined,
        });
        expect(JSON.parse(result.content[0].text)).toEqual([]);
      });
    });

    describe("conductor_get_task", () => {
      it("should return task details", async () => {
        const mockTask = {
          id: "task-1",
          title: "Test Task",
          status: "pending",
          priority: "high",
        };
        mockStateStore.getTask.mockReturnValue(mockTask);

        const tool = registeredTools.get("conductor_get_task")!;
        const result = await tool.handler({ taskId: "task-1" });

        expect(mockStateStore.getTask).toHaveBeenCalledWith("task-1");
        expect(result.content[0].type).toBe("text");
        expect(JSON.parse(result.content[0].text)).toEqual(mockTask);
      });

      it("should return error for non-existent task", async () => {
        mockStateStore.getTask.mockReturnValue(null);

        const tool = registeredTools.get("conductor_get_task")!;
        const result = await tool.handler({ taskId: "nonexistent" });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Task not found");
      });
    });

    describe("conductor_claim_task", () => {
      it("should claim task successfully", async () => {
        const mockTask = {
          id: "task-1",
          title: "Test Task",
          description: "Test description",
          priority: "high",
          files: ["src/index.ts"],
        };
        const mockContext = {
          projectName: "Test Project",
          isFirstTask: true,
          currentFocus: "Testing",
          projectGoals: ["Goal 1", "Goal 2"],
          agentInstructions: "Do good work",
          checkpointRules: ["Rule 1"],
          allowedPaths: ["src/"],
          taskContext: { relatedTasks: ["task-2"] },
        };

        mockStateStore.claimTask.mockReturnValue(true);
        mockStateStore.getTask.mockReturnValue(mockTask);
        mockStateStore.generateContextBundle.mockReturnValue(mockContext);
        mockStateStore.shouldRefreshContext.mockReturnValue(false);

        const tool = registeredTools.get("conductor_claim_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          agentId: "claude-123",
          agentType: "claude",
        });

        expect(mockStateStore.claimTask).toHaveBeenCalledWith(
          "task-1",
          "claude-123",
        );
        expect(mockStateStore.recordTaskClaim).toHaveBeenCalledWith(
          projectId,
          "claude-123",
          "task-1",
        );
        expect(result.content[0].text).toContain("Task Claimed Successfully");
        expect(result.content[0].text).toContain("Test Task");
        expect(result.content[0].text).toContain("Welcome!");
      });

      it("should show checkpoint message when needed", async () => {
        const mockTask = { id: "task-1", title: "Test", priority: "medium" };
        const mockContext = { projectName: "Test", isFirstTask: false };

        mockStateStore.claimTask.mockReturnValue(true);
        mockStateStore.getTask.mockReturnValue(mockTask);
        mockStateStore.generateContextBundle.mockReturnValue(mockContext);
        mockStateStore.shouldRefreshContext.mockReturnValue(true);

        const tool = registeredTools.get("conductor_claim_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          agentId: "claude-123",
          agentType: "claude",
        });

        expect(result.content[0].text).toContain("Checkpoint");
      });

      it("should return error when claim fails", async () => {
        mockStateStore.claimTask.mockReturnValue(false);

        const tool = registeredTools.get("conductor_claim_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          agentId: "claude-123",
          agentType: "claude",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Failed to claim task");
      });

      it("should return error when task not found after claim", async () => {
        mockStateStore.claimTask.mockReturnValue(true);
        mockStateStore.getTask.mockReturnValue(null);

        const tool = registeredTools.get("conductor_claim_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          agentId: "claude-123",
          agentType: "claude",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("not found after claiming");
      });
    });

    describe("conductor_update_task", () => {
      it("should update task status", async () => {
        const mockTask = { id: "task-1", status: "completed" };
        mockStateStore.updateTask.mockReturnValue(mockTask);

        const tool = registeredTools.get("conductor_update_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          status: "completed",
        });

        expect(mockStateStore.updateTask).toHaveBeenCalledWith("task-1", {
          status: "completed",
        });
        expect(result.content[0].text).toContain("updated successfully");
        expect(result.content[0].text).toContain("completed");
      });

      it("should update task with notes", async () => {
        const currentTask = { id: "task-1", metadata: { existing: true } };
        mockStateStore.getTask.mockReturnValue(currentTask);
        mockStateStore.updateTask.mockReturnValue({
          ...currentTask,
          status: "in_progress",
        });

        const tool = registeredTools.get("conductor_update_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          status: "in_progress",
          notes: "Making progress",
        });

        expect(mockStateStore.updateTask).toHaveBeenCalledWith(
          "task-1",
          expect.objectContaining({
            status: "in_progress",
            metadata: expect.objectContaining({
              existing: true,
              notes: "Making progress",
            }),
          }),
        );
        expect(result.content[0].text).toContain("Making progress");
      });

      it("should update task with tokens and blocked info", async () => {
        mockStateStore.updateTask.mockReturnValue({
          id: "task-1",
          status: "blocked",
        });

        const tool = registeredTools.get("conductor_update_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          status: "blocked",
          tokensUsed: 5000,
          blockedBy: ["task-0"],
        });

        expect(mockStateStore.updateTask).toHaveBeenCalledWith("task-1", {
          status: "blocked",
          actualTokens: 5000,
          blockedBy: ["task-0"],
        });
      });

      it("should return error on update failure", async () => {
        mockStateStore.updateTask.mockImplementation(() => {
          throw new Error("Database error");
        });

        const tool = registeredTools.get("conductor_update_task")!;
        const result = await tool.handler({
          taskId: "task-1",
          status: "completed",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Failed to update task");
        expect(result.content[0].text).toContain("Database error");
      });
    });
  });

  describe("File Lock Tools", () => {
    beforeEach(() => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });
    });

    describe("conductor_lock_file", () => {
      it("should acquire lock successfully", async () => {
        mockStateStore.acquireLock.mockReturnValue(true);

        const tool = registeredTools.get("conductor_lock_file")!;
        const result = await tool.handler({
          filePath: "src/index.ts",
          agentId: "claude-123",
          ttlSeconds: 300,
        });

        expect(mockStateStore.acquireLock).toHaveBeenCalledWith(
          projectId,
          "src/index.ts",
          "claude-123",
          300,
        );
        expect(result.content[0].text).toContain("Lock acquired");
        expect(result.content[0].text).toContain("300 seconds");
      });

      it("should return error when lock fails", async () => {
        mockStateStore.acquireLock.mockReturnValue(false);
        mockStateStore.checkLock.mockReturnValue({
          locked: true,
          holder: "other-agent",
          expiresAt: new Date("2024-01-01T12:00:00Z"),
        });

        const tool = registeredTools.get("conductor_lock_file")!;
        const result = await tool.handler({
          filePath: "src/index.ts",
          agentId: "claude-123",
          ttlSeconds: 300,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Failed to acquire lock");
        expect(result.content[0].text).toContain("other-agent");
      });
    });

    describe("conductor_unlock_file", () => {
      it("should release lock", async () => {
        const tool = registeredTools.get("conductor_unlock_file")!;
        const result = await tool.handler({
          filePath: "src/index.ts",
          agentId: "claude-123",
        });

        expect(mockStateStore.releaseLock).toHaveBeenCalledWith(
          projectId,
          "src/index.ts",
          "claude-123",
        );
        expect(result.content[0].text).toContain("Lock released");
      });
    });

    describe("conductor_check_locks", () => {
      it("should check multiple files", async () => {
        mockStateStore.checkLock
          .mockReturnValueOnce({ locked: false, holder: null, expiresAt: null })
          .mockReturnValueOnce({
            locked: true,
            holder: "claude-456",
            expiresAt: new Date("2024-01-01T12:00:00Z"),
          });

        const tool = registeredTools.get("conductor_check_locks")!;
        const result = await tool.handler({
          filePaths: ["src/a.ts", "src/b.ts"],
        });

        expect(mockStateStore.checkLock).toHaveBeenCalledTimes(2);
        expect(result.content[0].text).toContain("1 file(s) are locked");
        expect(result.content[0].text).toContain("src/b.ts");
      });

      it("should report all files available", async () => {
        mockStateStore.checkLock.mockReturnValue({
          locked: false,
          holder: null,
          expiresAt: null,
        });

        const tool = registeredTools.get("conductor_check_locks")!;
        const result = await tool.handler({
          filePaths: ["src/a.ts", "src/b.ts"],
        });

        expect(result.content[0].text).toContain("All files are available");
      });
    });
  });

  describe("Cost/Usage Tools", () => {
    beforeEach(() => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });
    });

    describe("conductor_report_usage", () => {
      it("should record usage and return cost", async () => {
        const mockAgent = {
          id: "claude-123",
          model: "claude-opus-4",
          costPerToken: { input: 0.000015, output: 0.000075 },
        };
        const mockProject = {
          id: projectId,
          organizationId: "org-123",
          budget: { total: 100 },
        };
        mockStateStore.getAgent.mockReturnValue(mockAgent);
        mockStateStore.getProject.mockReturnValue(mockProject);
        mockStateStore.getProjectSpend.mockReturnValue(10.5);

        const tool = registeredTools.get("conductor_report_usage")!;
        const result = await tool.handler({
          agentId: "claude-123",
          tokensInput: 1000,
          tokensOutput: 500,
          taskId: "task-1",
        });

        expect(mockStateStore.recordCost).toHaveBeenCalledWith({
          organizationId: "org-123",
          projectId,
          agentId: "claude-123",
          model: "claude-opus-4",
          taskId: "task-1",
          tokensInput: 1000,
          tokensOutput: 500,
          cost: expect.any(Number),
        });
        expect(result.content[0].text).toContain("Usage recorded");
        expect(result.content[0].text).toContain("Budget");
      });

      it("should report usage without budget", async () => {
        const mockAgent = {
          id: "claude-123",
          model: "claude-opus-4",
          costPerToken: { input: 0.00001, output: 0.00003 },
        };
        const mockProject = { id: projectId, organizationId: "org-123" };
        mockStateStore.getAgent.mockReturnValue(mockAgent);
        mockStateStore.getProject.mockReturnValue(mockProject);
        mockStateStore.getProjectSpend.mockReturnValue(5.0);

        const tool = registeredTools.get("conductor_report_usage")!;
        const result = await tool.handler({
          agentId: "claude-123",
          tokensInput: 100,
          tokensOutput: 50,
        });

        expect(result.content[0].text).toContain("Usage recorded");
        expect(result.content[0].text).not.toContain("Budget");
      });

      it("should return error for unknown agent", async () => {
        mockStateStore.getAgent.mockReturnValue(null);

        const tool = registeredTools.get("conductor_report_usage")!;
        const result = await tool.handler({
          agentId: "unknown",
          tokensInput: 100,
          tokensOutput: 50,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Agent not found");
      });
    });

    describe("conductor_get_budget", () => {
      it("should return budget status", async () => {
        const mockProject = {
          id: projectId,
          budget: { total: 100, alertThreshold: 80 },
        };
        mockStateStore.getProject.mockReturnValue(mockProject);
        mockStateStore.getProjectSpend.mockReturnValue(45.5);

        const tool = registeredTools.get("conductor_get_budget")!;
        const result = await tool.handler({});

        expect(result.content[0].text).toContain("Budget Status");
        expect(result.content[0].text).toContain("45.5");
        expect(result.content[0].text).toContain("100");
        expect(result.content[0].text).toContain("45.5%");
      });

      it("should return spend without budget", async () => {
        const mockProject = { id: projectId };
        mockStateStore.getProject.mockReturnValue(mockProject);
        mockStateStore.getProjectSpend.mockReturnValue(25.0);

        const tool = registeredTools.get("conductor_get_budget")!;
        const result = await tool.handler({});

        expect(result.content[0].text).toContain("No budget set");
        expect(result.content[0].text).toContain("25.0");
      });

      it("should return error for missing project", async () => {
        mockStateStore.getProject.mockReturnValue(null);

        const tool = registeredTools.get("conductor_get_budget")!;
        const result = await tool.handler({});

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Project not found");
      });
    });
  });

  describe("Agent Tools", () => {
    beforeEach(() => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });
    });

    describe("conductor_heartbeat", () => {
      it("should record heartbeat", async () => {
        const tool = registeredTools.get("conductor_heartbeat")!;
        const result = await tool.handler({ agentId: "claude-123" });

        expect(mockStateStore.heartbeat).toHaveBeenCalledWith("claude-123");
        expect(result.content[0].text).toContain("Heartbeat recorded");
      });

      it("should update status with heartbeat", async () => {
        const tool = registeredTools.get("conductor_heartbeat")!;
        const result = await tool.handler({
          agentId: "claude-123",
          status: "working",
        });

        expect(mockStateStore.heartbeat).toHaveBeenCalledWith("claude-123");
        expect(mockStateStore.updateAgentStatus).toHaveBeenCalledWith(
          "claude-123",
          "working",
        );
        expect(result.content[0].text).toContain("working");
      });
    });

    describe("conductor_list_agents", () => {
      it("should list all agents", async () => {
        const mockAgents = [
          {
            id: "claude-123",
            name: "Claude",
            status: "working",
            capabilities: ["typescript"],
            lastHeartbeat: new Date("2024-01-01T12:00:00Z"),
          },
          {
            id: "gemini-456",
            name: "Gemini",
            status: "idle",
            capabilities: ["python"],
            lastHeartbeat: null,
          },
        ];
        mockStateStore.listAgents.mockReturnValue(mockAgents);

        const tool = registeredTools.get("conductor_list_agents")!;
        const result = await tool.handler({});

        expect(mockStateStore.listAgents).toHaveBeenCalledWith(projectId);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].id).toBe("claude-123");
        expect(parsed[1].id).toBe("gemini-456");
      });
    });
  });

  describe("Access Request Tools", () => {
    beforeEach(() => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });
    });

    describe("conductor_request_access", () => {
      it("should return early if already approved", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(true);

        const tool = registeredTools.get("conductor_request_access")!;
        const result = await tool.handler({
          agentId: "claude-123",
          agentName: "Claude",
          agentType: "claude",
          capabilities: ["typescript"],
          requestedRole: "contributor",
        });

        expect(mockStateStore.createAccessRequest).not.toHaveBeenCalled();
        expect(result.content[0].text).toContain("Access already approved");
      });

      it("should create access request when auto-approved", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(false);
        mockStateStore.createAccessRequest.mockReturnValue({
          id: "req-123",
          status: "approved",
          requestedRole: "contributor",
          capabilities: ["typescript"],
        });

        const tool = registeredTools.get("conductor_request_access")!;
        const result = await tool.handler({
          agentId: "claude-123",
          agentName: "Claude",
          agentType: "claude",
          capabilities: ["typescript"],
          requestedRole: "contributor",
        });

        expect(mockStateStore.createAccessRequest).toHaveBeenCalledWith(
          projectId,
          {
            agentId: "claude-123",
            agentName: "Claude",
            agentType: "claude",
            capabilities: ["typescript"],
            requestedRole: "contributor",
          },
        );
        expect(result.content[0].text).toContain("Access approved");
      });

      it("should create pending access request", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(false);
        mockStateStore.createAccessRequest.mockReturnValue({
          id: "req-123",
          status: "pending",
          requestedRole: "contributor",
        });
        mockStateStore.getPendingAccessCount.mockReturnValue(3);

        const tool = registeredTools.get("conductor_request_access")!;
        const result = await tool.handler({
          agentId: "claude-123",
          agentName: "Claude",
          agentType: "claude",
          capabilities: [],
          requestedRole: "contributor",
        });

        expect(result.content[0].text).toContain("pending approval");
        expect(result.content[0].text).toContain("Queue position: 3");
      });
    });

    describe("conductor_check_access", () => {
      it("should return approved status", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(true);
        mockStateStore.listAccessRequests.mockReturnValue([
          {
            agentId: "claude-123",
            requestedRole: "contributor",
            expiresAt: new Date("2024-12-31"),
          },
        ]);

        const tool = registeredTools.get("conductor_check_access")!;
        const result = await tool.handler({ agentId: "claude-123" });

        expect(result.content[0].text).toContain("Access APPROVED");
        expect(result.content[0].text).toContain("contributor");
      });

      it("should return pending status", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(false);
        mockStateStore.listAccessRequests.mockReturnValue([
          {
            id: "req-123",
            agentId: "claude-123",
            status: "pending",
            requestedAt: new Date("2024-01-01"),
          },
        ]);
        mockStateStore.getPendingAccessCount.mockReturnValue(2);

        const tool = registeredTools.get("conductor_check_access")!;
        const result = await tool.handler({ agentId: "claude-123" });

        expect(result.content[0].text).toContain("Access request PENDING");
        expect(result.content[0].text).toContain("Queue position: 2");
      });

      it("should return denied status", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(false);
        mockStateStore.listAccessRequests.mockReturnValue([
          {
            agentId: "claude-123",
            status: "denied",
            denialReason: "Not authorized",
            reviewedBy: "admin",
          },
        ]);

        const tool = registeredTools.get("conductor_check_access")!;
        const result = await tool.handler({ agentId: "claude-123" });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Access DENIED");
        expect(result.content[0].text).toContain("Not authorized");
      });

      it("should return expired status", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(false);
        mockStateStore.listAccessRequests.mockReturnValue([
          { agentId: "claude-123", status: "expired" },
        ]);

        const tool = registeredTools.get("conductor_check_access")!;
        const result = await tool.handler({ agentId: "claude-123" });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Access request EXPIRED");
      });

      it("should return error when no request found", async () => {
        mockStateStore.hasApprovedAccess.mockReturnValue(false);
        mockStateStore.listAccessRequests.mockReturnValue([]);

        const tool = registeredTools.get("conductor_check_access")!;
        const result = await tool.handler({ agentId: "unknown" });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("No access request found");
      });
    });
  });

  describe("Context Management Tools", () => {
    beforeEach(() => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });
    });

    describe("conductor_refresh_context", () => {
      it("should return full context refresh", async () => {
        const mockContext = {
          projectName: "Test Project",
          currentFocus: "Feature development",
          projectGoals: ["Goal 1", "Goal 2"],
          agentInstructions: "Follow best practices",
          styleGuide: "Use TypeScript",
          checkpointRules: ["Rule 1", "Rule 2"],
          allowedPaths: ["src/", "tests/"],
          deniedPaths: ["secrets/"],
          relevantPatterns: [
            {
              file: "src/utils.ts",
              lineRange: "10-20",
              description: "Helper functions",
            },
          ],
        };
        mockStateStore.generateContextRefresh.mockReturnValue(mockContext);

        const tool = registeredTools.get("conductor_refresh_context")!;
        const result = await tool.handler({
          agentId: "claude-123",
          agentType: "claude",
        });

        expect(mockStateStore.generateContextRefresh).toHaveBeenCalledWith(
          projectId,
          "claude-123",
          "claude",
        );
        expect(result.content[0].text).toContain("Context Refresh");
        expect(result.content[0].text).toContain("Test Project");
        expect(result.content[0].text).toContain("Feature development");
        expect(result.content[0].text).toContain("Goal 1");
        expect(result.content[0].text).toContain("TypeScript");
        expect(result.content[0].text).toContain("src/utils.ts");
      });

      it("should handle minimal context", async () => {
        mockStateStore.generateContextRefresh.mockReturnValue({
          projectName: "Minimal Project",
        });

        const tool = registeredTools.get("conductor_refresh_context")!;
        const result = await tool.handler({
          agentId: "claude-123",
          agentType: "custom",
        });

        expect(result.content[0].text).toContain("Minimal Project");
      });
    });

    describe("conductor_get_onboarding_config", () => {
      it("should return full onboarding config", async () => {
        const mockConfig = {
          welcomeMessage: "Welcome to the project!",
          currentFocus: "Testing",
          goals: ["Goal A", "Goal B"],
          checkpointRules: ["Rule X", "Rule Y"],
          checkpointEveryNTasks: 5,
          autoRefreshContext: true,
        };
        const mockProject = { name: "Test Project" };
        mockStateStore.getOnboardingConfig.mockReturnValue(mockConfig);
        mockStateStore.getProject.mockReturnValue(mockProject);

        const tool = registeredTools.get("conductor_get_onboarding_config")!;
        const result = await tool.handler({});

        expect(result.content[0].text).toContain("Onboarding Configuration");
        expect(result.content[0].text).toContain("Welcome to the project!");
        expect(result.content[0].text).toContain("Goal A");
        expect(result.content[0].text).toContain("Every 5 tasks");
        expect(result.content[0].text).toContain("Enabled");
      });

      it("should return message when no config found", async () => {
        mockStateStore.getOnboardingConfig.mockReturnValue(null);
        mockStateStore.getProject.mockReturnValue(null);

        const tool = registeredTools.get("conductor_get_onboarding_config")!;
        const result = await tool.handler({});

        expect(result.content[0].text).toContain(
          "No onboarding configuration found",
        );
      });

      it("should use default checkpoint value", async () => {
        mockStateStore.getOnboardingConfig.mockReturnValue({});
        mockStateStore.getProject.mockReturnValue({ name: "Test" });

        const tool = registeredTools.get("conductor_get_onboarding_config")!;
        const result = await tool.handler({});

        expect(result.content[0].text).toContain("Every 3 tasks");
        expect(result.content[0].text).toContain("Disabled");
      });
    });
  });

  describe("Resources", () => {
    beforeEach(() => {
      createConductorServer({
        stateStore: mockStateStore as any,
        projectId,
      });
    });

    describe("project status resource", () => {
      it("should return project status", async () => {
        const mockProject = {
          id: projectId,
          name: "Test Project",
          conflictStrategy: "lock",
          budget: { total: 100 },
        };
        const mockTasks = [
          { status: "pending" },
          { status: "pending" },
          { status: "in_progress" },
          { status: "completed" },
          { status: "completed" },
          { status: "failed" },
          { status: "blocked" },
        ];
        const mockAgents = [
          { id: "claude", status: "working", lastHeartbeat: new Date() },
          { id: "gemini", status: "idle", lastHeartbeat: null },
        ];
        mockStateStore.getProject.mockReturnValue(mockProject);
        mockStateStore.listTasks.mockReturnValue(mockTasks);
        mockStateStore.listAgents.mockReturnValue(mockAgents);
        mockStateStore.getProjectSpend.mockReturnValue(25.5);

        const resource = registeredResources.get(
          `conductor://project/${projectId}/status`,
        )!;
        const result = await resource.handler();

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].mimeType).toBe("application/json");

        const parsed = JSON.parse(result.contents[0].text);
        expect(parsed.project.name).toBe("Test Project");
        expect(parsed.tasks.total).toBe(7);
        expect(parsed.tasks.pending).toBe(2);
        expect(parsed.tasks.completed).toBe(2);
        expect(parsed.agents).toHaveLength(2);
        expect(parsed.budget.spent).toBe(25.5);
        expect(parsed.budget.total).toBe(100);
        expect(parsed.budget.remaining).toBe(74.5);
      });

      it("should handle project without budget", async () => {
        mockStateStore.getProject.mockReturnValue({
          id: projectId,
          name: "Test",
        });
        mockStateStore.listTasks.mockReturnValue([]);
        mockStateStore.listAgents.mockReturnValue([]);
        mockStateStore.getProjectSpend.mockReturnValue(0);

        const resource = registeredResources.get(
          `conductor://project/${projectId}/status`,
        )!;
        const result = await resource.handler();

        const parsed = JSON.parse(result.contents[0].text);
        expect(parsed.budget).toBeNull();
      });
    });
  });
});
