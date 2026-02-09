/**
 * CLI Commands Tests
 * Tests for all conductor CLI commands
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import fs from "fs";
import path from "path";

// Hoist mocks for vitest v4+
const { mockStore, mockSandboxManager, mockAgentRunner, capturedOptions } =
  vi.hoisted(() => {
    const mockStore = {
      createProject: vi.fn(),
      getProject: vi.fn(),
      registerAgent: vi.fn(),
      listAgents: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn(),
      listTasks: vi.fn(),
      getProjectSpend: vi.fn(),
    };

    const mockSandboxManager = {
      createSandbox: vi.fn(),
      listInstances: vi.fn(),
      executeCommand: vi.fn(),
      stopSandbox: vi.fn(),
      stopAll: vi.fn(),
      getStats: vi.fn(),
    };

    const mockAgentRunner = {
      runAgent: vi.fn(),
      startAgent: vi.fn(),
      getRunningAgent: vi.fn(),
      listRunningAgents: vi.fn(),
      stopAgent: vi.fn(),
      stopAllAgents: vi.fn(),
      executeInAgent: vi.fn(),
    };

    // Object to capture options passed to constructors
    const capturedOptions = {
      agentRunner: null as any,
      sandboxManager: null as any,
    };

    return {
      mockStore,
      mockSandboxManager,
      mockAgentRunner,
      capturedOptions,
    };
  });

// Mock dependencies
vi.mock("fs");
vi.mock("@conductor/state", () => ({
  SQLiteStateStore: class MockSQLiteStateStore {
    createProject = mockStore.createProject;
    getProject = mockStore.getProject;
    registerAgent = mockStore.registerAgent;
    listAgents = mockStore.listAgents;
    createTask = mockStore.createTask;
    getTask = mockStore.getTask;
    listTasks = mockStore.listTasks;
    getProjectSpend = mockStore.getProjectSpend;
  },
}));

vi.mock("@conductor/e2b-runner", () => ({
  SandboxManager: class MockSandboxManager {
    constructor(options: any) {
      capturedOptions.sandboxManager = options;
    }
    createSandbox = mockSandboxManager.createSandbox;
    listInstances = mockSandboxManager.listInstances;
    executeCommand = mockSandboxManager.executeCommand;
    stopSandbox = mockSandboxManager.stopSandbox;
    stopAll = mockSandboxManager.stopAll;
    getStats = mockSandboxManager.getStats;
  },
  AgentRunner: class MockAgentRunner {
    constructor(options: any) {
      capturedOptions.agentRunner = options;
    }
    runAgent = mockAgentRunner.runAgent;
    startAgent = mockAgentRunner.startAgent;
    getRunningAgent = mockAgentRunner.getRunningAgent;
    listRunningAgents = mockAgentRunner.listRunningAgents;
    stopAgent = mockAgentRunner.stopAgent;
    stopAllAgents = mockAgentRunner.stopAllAgents;
    executeInAgent = mockAgentRunner.executeInAgent;
  },
}));

import { program } from "./index.js";

// Console spies
let consoleLogSpy: Mock;
let consoleErrorSpy: Mock;
let processExitSpy: Mock;
let processCwdSpy: Mock;

describe("CLI Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    processCwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/test/project");
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processCwdSpy.mockRestore();
  });

  describe("program", () => {
    it("should have correct name and description", () => {
      expect(program.name()).toBe("conductor");
      expect(program.description()).toContain("Multi-LLM orchestration");
    });

    it("should have version 0.1.0", () => {
      expect(program.version()).toBe("0.1.0");
    });
  });

  describe("init command", () => {
    it("should create project with default values", async () => {
      const mockProject = {
        id: "test-project-id",
        name: "project",
        conflictStrategy: "lock",
        budget: undefined,
      };
      mockStore.createProject.mockReturnValue(mockProject);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await program.parseAsync(["node", "test", "init"]);

      expect(mockStore.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "project",
          slug: "project",
          rootPath: "/test/project",
          conflictStrategy: "lock",
          isActive: true,
        }),
      );
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should create project with custom name", async () => {
      const mockProject = {
        id: "test-project-id",
        name: "my-app",
        conflictStrategy: "lock",
        budget: undefined,
      };
      mockStore.createProject.mockReturnValue(mockProject);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await program.parseAsync(["node", "test", "init", "--name", "my-app"]);

      expect(mockStore.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-app",
          slug: "my-app",
        }),
      );
    });

    it("should create project with merge strategy", async () => {
      const mockProject = {
        id: "test-project-id",
        name: "project",
        conflictStrategy: "merge",
        budget: undefined,
      };
      mockStore.createProject.mockReturnValue(mockProject);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await program.parseAsync(["node", "test", "init", "--strategy", "merge"]);

      expect(mockStore.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictStrategy: "merge",
        }),
      );
    });

    it("should create project with budget", async () => {
      const mockProject = {
        id: "test-project-id",
        name: "project",
        conflictStrategy: "lock",
        budget: { total: 100, spent: 0, currency: "USD", alertThreshold: 80 },
      };
      mockStore.createProject.mockReturnValue(mockProject);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await program.parseAsync(["node", "test", "init", "--budget", "100"]);

      expect(mockStore.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: { total: 100, spent: 0, currency: "USD", alertThreshold: 80 },
        }),
      );
    });

    it("should write config file with project ID", async () => {
      const mockProject = {
        id: "abc-123",
        name: "project",
        conflictStrategy: "lock",
        budget: undefined,
      };
      mockStore.createProject.mockReturnValue(mockProject);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await program.parseAsync(["node", "test", "init"]);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join("/test/project", ".conductor.json"),
        JSON.stringify({ projectId: "abc-123" }, null, 2),
      );
    });
  });

  describe("agent commands", () => {
    const setupProjectConfig = () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ projectId: "test-project-id" }),
      );
    };

    describe("agent register", () => {
      it("should register an agent", async () => {
        setupProjectConfig();

        await program.parseAsync([
          "node",
          "test",
          "agent",
          "register",
          "-i",
          "claude",
        ]);

        expect(mockStore.registerAgent).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            id: "claude",
          }),
        );
      });

      it("should register agent with custom name", async () => {
        setupProjectConfig();

        await program.parseAsync([
          "node",
          "test",
          "agent",
          "register",
          "-i",
          "claude",
          "-n",
          "My Claude",
        ]);

        expect(mockStore.registerAgent).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            id: "claude",
            name: "My Claude",
          }),
        );
      });

      it("should register agent with capabilities", async () => {
        setupProjectConfig();

        await program.parseAsync([
          "node",
          "test",
          "agent",
          "register",
          "-i",
          "custom",
          "-c",
          "typescript",
          "react",
        ]);

        expect(mockStore.registerAgent).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            id: "custom",
            capabilities: ["typescript", "react"],
          }),
        );
      });

      it("should exit if not in a project", async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await expect(
          program.parseAsync([
            "node",
            "test",
            "agent",
            "register",
            "-i",
            "claude",
          ]),
        ).rejects.toThrow("process.exit(1)");

        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe("agent list", () => {
      it("should list agents", async () => {
        setupProjectConfig();
        mockStore.listAgents.mockReturnValue([
          {
            id: "claude",
            name: "Claude Code",
            status: "idle",
            capabilities: ["typescript", "mcp"],
            lastHeartbeat: new Date(),
          },
          {
            id: "gemini",
            name: "Gemini",
            status: "working",
            capabilities: ["frontend"],
            lastHeartbeat: new Date(),
          },
        ]);

        await program.parseAsync(["node", "test", "agent", "list"]);

        expect(mockStore.listAgents).toHaveBeenCalledWith("test-project-id");
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should show message when no agents", async () => {
        setupProjectConfig();
        mockStore.listAgents.mockReturnValue([]);

        await program.parseAsync(["node", "test", "agent", "list"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should display blocked agent status correctly", async () => {
        setupProjectConfig();
        mockStore.listAgents.mockReturnValue([
          {
            id: "claude",
            name: "Claude",
            status: "blocked",
            capabilities: [],
          },
        ]);

        await program.parseAsync(["node", "test", "agent", "list"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should truncate long capability lists", async () => {
        setupProjectConfig();
        mockStore.listAgents.mockReturnValue([
          {
            id: "claude",
            name: "Claude",
            status: "idle",
            capabilities: [
              "cap1",
              "cap2",
              "cap3",
              "cap4",
              "cap5",
              "cap6",
              "cap7",
            ],
          },
        ]);

        await program.parseAsync(["node", "test", "agent", "list"]);

        // Verify output was called (capabilities get truncated to 5)
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should fail when not in a project", async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await expect(
          program.parseAsync(["node", "test", "agent", "list"]),
        ).rejects.toThrow("process.exit(1)");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Not in a Conductor project"),
        );
      });
    });

    describe("agent profiles", () => {
      it("should list available agent profiles", async () => {
        await program.parseAsync(["node", "test", "agent", "profiles"]);

        expect(consoleLogSpy).toHaveBeenCalled();
        // Profiles are from DEFAULT_AGENT_PROFILES
      });
    });
  });

  describe("task commands", () => {
    const setupProjectConfig = () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ projectId: "test-project-id" }),
      );
    };

    describe("task add", () => {
      it("should create a task with title", async () => {
        setupProjectConfig();
        const mockTask = {
          id: "task-123",
          title: "Test task",
          priority: "medium",
          files: [],
        };
        mockStore.createTask.mockReturnValue(mockTask);

        await program.parseAsync([
          "node",
          "test",
          "task",
          "add",
          "-t",
          "Test task",
        ]);

        expect(mockStore.createTask).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            title: "Test task",
            priority: "medium",
            status: "pending",
          }),
        );
      });

      it("should create task with all options", async () => {
        setupProjectConfig();
        const mockTask = {
          id: "task-123",
          title: "Full task",
          priority: "high",
          files: ["src/index.ts", "src/lib.ts"],
        };
        mockStore.createTask.mockReturnValue(mockTask);

        await program.parseAsync([
          "node",
          "test",
          "task",
          "add",
          "-t",
          "Full task",
          "-d",
          "Description here",
          "-p",
          "high",
          "--deps",
          "task-a",
          "task-b",
          "--files",
          "src/index.ts",
          "src/lib.ts",
          "--tags",
          "requires:typescript",
          "frontend",
        ]);

        expect(mockStore.createTask).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            title: "Full task",
            description: "Description here",
            priority: "high",
            dependencies: ["task-a", "task-b"],
            files: ["src/index.ts", "src/lib.ts"],
            tags: ["requires:typescript", "frontend"],
          }),
        );
      });

      it("should exit if not in a project", async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await expect(
          program.parseAsync(["node", "test", "task", "add", "-t", "Test"]),
        ).rejects.toThrow("process.exit(1)");
      });
    });

    describe("task list", () => {
      it("should list tasks", async () => {
        setupProjectConfig();
        mockStore.listTasks.mockReturnValue([
          {
            id: "task-1",
            title: "Task 1",
            status: "pending",
            priority: "medium",
          },
          {
            id: "task-2",
            title: "Task 2",
            status: "completed",
            priority: "high",
          },
        ]);

        await program.parseAsync(["node", "test", "task", "list"]);

        expect(mockStore.listTasks).toHaveBeenCalledWith("test-project-id", {
          status: undefined,
          priority: undefined,
          assignedTo: undefined,
        });
      });

      it("should filter tasks by status", async () => {
        setupProjectConfig();
        mockStore.listTasks.mockReturnValue([]);

        await program.parseAsync([
          "node",
          "test",
          "task",
          "list",
          "-s",
          "pending",
        ]);

        expect(mockStore.listTasks).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            status: "pending",
          }),
        );
      });

      it("should filter tasks by priority", async () => {
        setupProjectConfig();
        mockStore.listTasks.mockReturnValue([]);

        await program.parseAsync([
          "node",
          "test",
          "task",
          "list",
          "-p",
          "critical",
        ]);

        expect(mockStore.listTasks).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            priority: "critical",
          }),
        );
      });

      it("should filter tasks by assigned agent", async () => {
        setupProjectConfig();
        mockStore.listTasks.mockReturnValue([]);

        await program.parseAsync([
          "node",
          "test",
          "task",
          "list",
          "-a",
          "claude",
        ]);

        expect(mockStore.listTasks).toHaveBeenCalledWith(
          "test-project-id",
          expect.objectContaining({
            assignedTo: "claude",
          }),
        );
      });

      it("should display tasks with different statuses", async () => {
        setupProjectConfig();
        mockStore.listTasks.mockReturnValue([
          { id: "t1", title: "Pending", status: "pending", priority: "low" },
          {
            id: "t2",
            title: "In Progress",
            status: "in_progress",
            priority: "medium",
          },
          {
            id: "t3",
            title: "Completed",
            status: "completed",
            priority: "high",
          },
          { id: "t4", title: "Failed", status: "failed", priority: "critical" },
          {
            id: "t5",
            title: "Blocked",
            status: "blocked",
            priority: "medium",
            assignedTo: "claude",
          },
        ]);

        await program.parseAsync(["node", "test", "task", "list"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should show message when no tasks found", async () => {
        setupProjectConfig();
        mockStore.listTasks.mockReturnValue([]);

        await program.parseAsync(["node", "test", "task", "list"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should fail when not in a project", async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await expect(
          program.parseAsync(["node", "test", "task", "list"]),
        ).rejects.toThrow("process.exit(1)");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Not in a Conductor project"),
        );
      });
    });

    describe("task show", () => {
      it("should show task details", async () => {
        const mockTask = {
          id: "task-123",
          title: "Test Task",
          status: "in_progress",
          priority: "high",
          description: "A test task",
          assignedTo: "claude",
          files: ["src/index.ts"],
          tags: ["typescript"],
          dependencies: ["task-0"],
          createdAt: new Date("2024-01-01"),
          startedAt: new Date("2024-01-02"),
          completedAt: null,
        };
        mockStore.getTask.mockReturnValue(mockTask);

        await program.parseAsync(["node", "test", "task", "show", "task-123"]);

        expect(mockStore.getTask).toHaveBeenCalledWith("task-123");
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should show completed task details", async () => {
        const mockTask = {
          id: "task-123",
          title: "Test Task",
          status: "completed",
          priority: "medium",
          files: [],
          tags: [],
          dependencies: [],
          createdAt: new Date("2024-01-01"),
          startedAt: new Date("2024-01-02"),
          completedAt: new Date("2024-01-03"),
        };
        mockStore.getTask.mockReturnValue(mockTask);

        await program.parseAsync(["node", "test", "task", "show", "task-123"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should exit if task not found", async () => {
        mockStore.getTask.mockReturnValue(null);

        await expect(
          program.parseAsync(["node", "test", "task", "show", "nonexistent"]),
        ).rejects.toThrow("process.exit(1)");
      });
    });
  });

  describe("status command", () => {
    const setupProjectConfig = () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ projectId: "test-project-id" }),
      );
    };

    it("should show project status", async () => {
      setupProjectConfig();
      mockStore.getProject.mockReturnValue({
        id: "test-project-id",
        name: "Test Project",
        budget: { total: 100, spent: 0, currency: "USD", alertThreshold: 80 },
      });
      mockStore.listTasks.mockReturnValue([
        { status: "pending" },
        { status: "pending" },
        { status: "in_progress" },
        { status: "completed" },
        { status: "blocked" },
      ]);
      mockStore.listAgents.mockReturnValue([
        { name: "Claude", status: "working" },
        { name: "Gemini", status: "idle" },
      ]);
      mockStore.getProjectSpend.mockReturnValue(25.5);

      await program.parseAsync(["node", "test", "status"]);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should show status without budget", async () => {
      setupProjectConfig();
      mockStore.getProject.mockReturnValue({
        id: "test-project-id",
        name: "Test Project",
      });
      mockStore.listTasks.mockReturnValue([]);
      mockStore.listAgents.mockReturnValue([]);
      mockStore.getProjectSpend.mockReturnValue(5.0);

      await program.parseAsync(["node", "test", "status"]);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should show high budget usage warning", async () => {
      setupProjectConfig();
      mockStore.getProject.mockReturnValue({
        id: "test-project-id",
        name: "Test Project",
        budget: { total: 100, spent: 0, currency: "USD", alertThreshold: 80 },
      });
      mockStore.listTasks.mockReturnValue([]);
      mockStore.listAgents.mockReturnValue([]);
      mockStore.getProjectSpend.mockReturnValue(85.0); // 85% usage

      await program.parseAsync(["node", "test", "status"]);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should exit if project not found", async () => {
      setupProjectConfig();
      mockStore.getProject.mockReturnValue(null);

      await expect(
        program.parseAsync(["node", "test", "status"]),
      ).rejects.toThrow("process.exit(1)");
    });

    it("should show blocked agent status", async () => {
      setupProjectConfig();
      mockStore.getProject.mockReturnValue({
        id: "test-project-id",
        name: "Test Project",
      });
      mockStore.listTasks.mockReturnValue([]);
      mockStore.listAgents.mockReturnValue([
        { name: "Claude", status: "blocked" },
      ]);
      mockStore.getProjectSpend.mockReturnValue(0);

      await program.parseAsync(["node", "test", "status"]);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should exit if not in a project", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        program.parseAsync(["node", "test", "status"]),
      ).rejects.toThrow("process.exit(1)");
    });
  });

  describe("serve command", () => {
    const setupProjectConfig = () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ projectId: "test-project-id" }),
      );
    };

    it("should show MCP server instructions", async () => {
      setupProjectConfig();

      await program.parseAsync(["node", "test", "serve"]);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should exit if not in a project", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        program.parseAsync(["node", "test", "serve"]),
      ).rejects.toThrow("process.exit(1)");
    });
  });

  describe("sandbox commands", () => {
    const setupProjectConfig = () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ projectId: "test-project-id" }),
      );
    };

    describe("sandbox create", () => {
      it("should create a sandbox", async () => {
        setupProjectConfig();
        mockSandboxManager.createSandbox.mockResolvedValue({
          id: "sandbox-123",
          agentId: "claude",
          template: "base",
          status: "running",
        });

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "create",
          "-a",
          "claude",
        ]);

        expect(mockSandboxManager.createSandbox).toHaveBeenCalledWith(
          "claude",
          "test-project-id",
          expect.objectContaining({
            template: "base",
            timeout: 300,
          }),
        );
      });

      it("should create sandbox with custom options", async () => {
        setupProjectConfig();
        mockSandboxManager.createSandbox.mockResolvedValue({
          id: "sandbox-123",
          agentId: "gemini",
          template: "python",
          status: "running",
        });

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "create",
          "-a",
          "gemini",
          "-t",
          "python",
          "--timeout",
          "600",
        ]);

        expect(mockSandboxManager.createSandbox).toHaveBeenCalledWith(
          "gemini",
          "test-project-id",
          expect.objectContaining({
            template: "python",
            timeout: 600,
          }),
        );
      });

      it("should handle sandbox creation failure", async () => {
        setupProjectConfig();
        mockSandboxManager.createSandbox.mockRejectedValue(
          new Error("API error"),
        );

        await expect(
          program.parseAsync([
            "node",
            "test",
            "sandbox",
            "create",
            "-a",
            "claude",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });

      it("should fail when not in a project", async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await expect(
          program.parseAsync([
            "node",
            "test",
            "sandbox",
            "create",
            "-a",
            "claude",
          ]),
        ).rejects.toThrow("process.exit(1)");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Not in a Conductor project"),
        );
      });

      it("should log events via onEvent callback", () => {
        // The onEvent callback is captured when SandboxManager is instantiated
        expect(capturedOptions.sandboxManager).toBeDefined();
        expect(capturedOptions.sandboxManager.onEvent).toBeDefined();

        // Test all event types
        const events = [
          { type: "sandbox:created", timestamp: new Date(), sandboxId: "sb-1" },
          { type: "sandbox:started", timestamp: new Date(), sandboxId: "sb-1" },
          { type: "sandbox:stopped", timestamp: new Date(), sandboxId: "sb-1" },
          {
            type: "sandbox:failed",
            timestamp: new Date(),
            sandboxId: "sb-1",
            data: { error: "test error" },
          },
          { type: "sandbox:timeout", timestamp: new Date(), sandboxId: "sb-1" },
        ];

        for (const event of events) {
          capturedOptions.sandboxManager.onEvent(event);
        }

        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe("sandbox list", () => {
      it("should list sandboxes", async () => {
        mockSandboxManager.listInstances.mockReturnValue([
          {
            id: "sandbox-1",
            agentId: "claude",
            status: "running",
            template: "base",
            startedAt: new Date(),
            lastActivityAt: new Date(),
          },
          {
            id: "sandbox-2",
            agentId: "gemini",
            status: "stopped",
            template: "python",
            startedAt: new Date(),
            lastActivityAt: new Date(),
          },
        ]);

        await program.parseAsync(["node", "test", "sandbox", "list"]);

        expect(mockSandboxManager.listInstances).toHaveBeenCalledWith({
          status: undefined,
          agentId: undefined,
        });
      });

      it("should filter by status", async () => {
        mockSandboxManager.listInstances.mockReturnValue([]);

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "list",
          "-s",
          "running",
        ]);

        expect(mockSandboxManager.listInstances).toHaveBeenCalledWith({
          status: "running",
          agentId: undefined,
        });
      });

      it("should filter by agent", async () => {
        mockSandboxManager.listInstances.mockReturnValue([]);

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "list",
          "-a",
          "claude",
        ]);

        // Check that listInstances was called with the correct agentId
        // Note: Commander caches option values, so we check specific values we care about
        expect(mockSandboxManager.listInstances).toHaveBeenCalled();
        const callArgs = mockSandboxManager.listInstances.mock.calls[0][0];
        expect(callArgs.agentId).toBe("claude");
      });

      it("should show failed sandbox status", async () => {
        mockSandboxManager.listInstances.mockReturnValue([
          {
            id: "sandbox-1",
            agentId: "claude",
            status: "failed",
            template: "base",
            startedAt: new Date(),
            lastActivityAt: new Date(),
          },
        ]);

        await program.parseAsync(["node", "test", "sandbox", "list"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should show message when no sandboxes", async () => {
        mockSandboxManager.listInstances.mockReturnValue([]);

        await program.parseAsync(["node", "test", "sandbox", "list"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe("sandbox exec", () => {
      it("should execute command in sandbox", async () => {
        mockSandboxManager.executeCommand.mockResolvedValue({
          stdout: "output here",
          stderr: "",
          exitCode: 0,
        });

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "exec",
          "sandbox-123",
          "ls -la",
        ]);

        expect(mockSandboxManager.executeCommand).toHaveBeenCalledWith(
          "sandbox-123",
          "ls -la",
          expect.objectContaining({
            cwd: undefined,
            timeout: 60,
          }),
        );
      });

      it("should execute with options", async () => {
        mockSandboxManager.executeCommand.mockResolvedValue({
          stdout: "",
          stderr: "",
          exitCode: 0,
        });

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "exec",
          "sandbox-123",
          "npm test",
          "--cwd",
          "/app",
          "--timeout",
          "120",
        ]);

        expect(mockSandboxManager.executeCommand).toHaveBeenCalledWith(
          "sandbox-123",
          "npm test",
          expect.objectContaining({
            cwd: "/app",
            timeout: 120,
          }),
        );
      });

      it("should show stderr output", async () => {
        mockSandboxManager.executeCommand.mockResolvedValue({
          stdout: "",
          stderr: "warning message",
          exitCode: 0,
        });

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "exec",
          "sandbox-123",
          "cmd",
        ]);

        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should exit with non-zero code on failure", async () => {
        mockSandboxManager.executeCommand.mockResolvedValue({
          stdout: "",
          stderr: "error",
          exitCode: 1,
        });

        await expect(
          program.parseAsync([
            "node",
            "test",
            "sandbox",
            "exec",
            "sandbox-123",
            "cmd",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });

      it("should handle execution error", async () => {
        mockSandboxManager.executeCommand.mockRejectedValue(
          new Error("Sandbox not found"),
        );

        await expect(
          program.parseAsync([
            "node",
            "test",
            "sandbox",
            "exec",
            "sandbox-123",
            "cmd",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });
    });

    describe("sandbox stop", () => {
      it("should stop a sandbox", async () => {
        mockSandboxManager.stopSandbox.mockResolvedValue(undefined);

        await program.parseAsync([
          "node",
          "test",
          "sandbox",
          "stop",
          "sandbox-123",
        ]);

        expect(mockSandboxManager.stopSandbox).toHaveBeenCalledWith(
          "sandbox-123",
        );
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should handle stop failure", async () => {
        mockSandboxManager.stopSandbox.mockRejectedValue(
          new Error("Not found"),
        );

        await expect(
          program.parseAsync([
            "node",
            "test",
            "sandbox",
            "stop",
            "sandbox-123",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });
    });

    describe("sandbox stop-all", () => {
      it("should stop all sandboxes", async () => {
        mockSandboxManager.listInstances.mockReturnValue([
          { id: "sb-1", status: "running" },
          { id: "sb-2", status: "running" },
        ]);
        mockSandboxManager.stopAll.mockResolvedValue(undefined);

        await program.parseAsync(["node", "test", "sandbox", "stop-all"]);

        expect(mockSandboxManager.stopAll).toHaveBeenCalled();
      });

      it("should show message when no running sandboxes", async () => {
        mockSandboxManager.listInstances.mockReturnValue([]);

        await program.parseAsync(["node", "test", "sandbox", "stop-all"]);

        expect(mockSandboxManager.stopAll).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe("sandbox stats", () => {
      it("should show sandbox statistics", async () => {
        mockSandboxManager.getStats.mockReturnValue({
          total: 10,
          running: 3,
          stopped: 5,
          failed: 1,
          timeout: 1,
        });

        await program.parseAsync(["node", "test", "sandbox", "stats"]);

        expect(mockSandboxManager.getStats).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });
  });

  describe("spawn commands", () => {
    const setupProjectConfig = () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ projectId: "test-project-id" }),
      );
    };

    describe("spawn agent", () => {
      it("should spawn agent without waiting", async () => {
        setupProjectConfig();
        mockAgentRunner.startAgent.mockResolvedValue({
          id: "sandbox-123",
          status: "running",
        });

        await program.parseAsync([
          "node",
          "test",
          "spawn",
          "agent",
          "-i",
          "claude",
          "-t",
          "claude-code",
        ]);

        expect(mockAgentRunner.startAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "claude-code",
            agentId: "claude",
            projectId: "test-project-id",
          }),
        );
      });

      it("should spawn agent with all options", async () => {
        setupProjectConfig();
        mockAgentRunner.startAgent.mockResolvedValue({
          id: "sandbox-123",
          status: "running",
        });

        await program.parseAsync([
          "node",
          "test",
          "spawn",
          "agent",
          "-i",
          "my-agent",
          "-t",
          "aider",
          "-r",
          "https://github.com/user/repo",
          "-b",
          "feature-branch",
          "-m",
          "http://mcp.local:3001",
          "-w",
          "/workspace",
          "--timeout",
          "600",
        ]);

        expect(mockAgentRunner.startAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "aider",
            agentId: "my-agent",
            projectId: "test-project-id",
            gitRepo: "https://github.com/user/repo",
            gitBranch: "feature-branch",
            mcpServerUrl: "http://mcp.local:3001",
            workDir: "/workspace",
            sandbox: { timeout: 600 },
          }),
        );
      });

      it("should run agent and wait for completion", async () => {
        setupProjectConfig();
        mockAgentRunner.runAgent.mockResolvedValue({
          success: true,
          duration: 5000,
          stdout: "Task completed",
        });

        await program.parseAsync([
          "node",
          "test",
          "spawn",
          "agent",
          "-i",
          "claude",
          "-t",
          "claude-code",
          "--run",
        ]);

        expect(mockAgentRunner.runAgent).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should handle failed agent run", async () => {
        setupProjectConfig();
        mockAgentRunner.runAgent.mockResolvedValue({
          success: false,
          exitCode: 1,
          error: "Task failed",
          stderr: "Error details",
          duration: 1000,
        });

        await expect(
          program.parseAsync([
            "node",
            "test",
            "spawn",
            "agent",
            "-i",
            "claude",
            "-t",
            "claude-code",
            "--run",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });

      it("should reject invalid agent type", async () => {
        setupProjectConfig();

        await expect(
          program.parseAsync([
            "node",
            "test",
            "spawn",
            "agent",
            "-i",
            "claude",
            "-t",
            "invalid-type",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });

      it("should handle spawn failure", async () => {
        setupProjectConfig();
        mockAgentRunner.startAgent.mockRejectedValue(
          new Error("E2B API error"),
        );

        await expect(
          program.parseAsync([
            "node",
            "test",
            "spawn",
            "agent",
            "-i",
            "claude",
            "-t",
            "claude-code",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });

      it("should fail when not in a project", async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await expect(
          program.parseAsync([
            "node",
            "test",
            "spawn",
            "agent",
            "-i",
            "claude",
            "-t",
            "claude-code",
          ]),
        ).rejects.toThrow("process.exit(1)");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Not in a Conductor project"),
        );
      });

      it("should log events via onEvent callback", async () => {
        // The onEvent callback is captured when AgentRunner is instantiated
        // We can test it was set up correctly by checking the captured options
        // from any previous test that initialized the agent runner
        expect(capturedOptions.agentRunner).toBeDefined();
        expect(capturedOptions.agentRunner.onEvent).toBeDefined();

        const testEvent = {
          timestamp: new Date("2024-01-01T12:00:00Z"),
          type: "sandbox_started",
          sandboxId: "sandbox-123",
        };

        capturedOptions.agentRunner.onEvent(testEvent);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("sandbox_started"),
        );
      });
    });

    describe("spawn status", () => {
      it("should show status of specific agent", async () => {
        mockAgentRunner.getRunningAgent.mockReturnValue({
          sandboxId: "sandbox-123",
          startTime: new Date(),
          instance: {
            status: "running",
            lastActivityAt: new Date(),
          },
        });

        await program.parseAsync(["node", "test", "spawn", "status", "claude"]);

        expect(mockAgentRunner.getRunningAgent).toHaveBeenCalledWith("claude");
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should show message when agent not running", async () => {
        mockAgentRunner.getRunningAgent.mockReturnValue(null);

        await program.parseAsync(["node", "test", "spawn", "status", "claude"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should list all running agents", async () => {
        mockAgentRunner.listRunningAgents.mockReturnValue([
          { agentId: "claude", sandboxId: "sb-1", startTime: new Date() },
          { agentId: "gemini", sandboxId: "sb-2", startTime: new Date() },
        ]);

        await program.parseAsync(["node", "test", "spawn", "status"]);

        expect(mockAgentRunner.listRunningAgents).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should show message when no agents running", async () => {
        mockAgentRunner.listRunningAgents.mockReturnValue([]);

        await program.parseAsync(["node", "test", "spawn", "status"]);

        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe("spawn stop", () => {
      it("should stop a running agent", async () => {
        mockAgentRunner.stopAgent.mockResolvedValue(undefined);

        await program.parseAsync(["node", "test", "spawn", "stop", "claude"]);

        expect(mockAgentRunner.stopAgent).toHaveBeenCalledWith("claude");
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("should handle stop failure", async () => {
        mockAgentRunner.stopAgent.mockRejectedValue(
          new Error("Agent not found"),
        );

        await expect(
          program.parseAsync(["node", "test", "spawn", "stop", "claude"]),
        ).rejects.toThrow("process.exit(1)");
      });
    });

    describe("spawn stop-all", () => {
      it("should stop all agents", async () => {
        mockAgentRunner.listRunningAgents.mockReturnValue([
          { agentId: "claude" },
          { agentId: "gemini" },
        ]);
        mockAgentRunner.stopAllAgents.mockResolvedValue(undefined);

        await program.parseAsync(["node", "test", "spawn", "stop-all"]);

        expect(mockAgentRunner.stopAllAgents).toHaveBeenCalled();
      });

      it("should show message when no running agents", async () => {
        mockAgentRunner.listRunningAgents.mockReturnValue([]);

        await program.parseAsync(["node", "test", "spawn", "stop-all"]);

        expect(mockAgentRunner.stopAllAgents).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe("spawn exec", () => {
      it("should execute command in agent sandbox", async () => {
        mockAgentRunner.executeInAgent.mockResolvedValue({
          stdout: "output",
          stderr: "",
          exitCode: 0,
        });

        await program.parseAsync([
          "node",
          "test",
          "spawn",
          "exec",
          "claude",
          "npm test",
        ]);

        expect(mockAgentRunner.executeInAgent).toHaveBeenCalledWith(
          "claude",
          "npm test",
          expect.objectContaining({
            timeout: 60,
          }),
        );
      });

      it("should execute with custom options", async () => {
        mockAgentRunner.executeInAgent.mockResolvedValue({
          stdout: "",
          stderr: "",
          exitCode: 0,
        });

        await program.parseAsync([
          "node",
          "test",
          "spawn",
          "exec",
          "claude",
          "npm test",
          "--cwd",
          "/app",
          "--timeout",
          "120",
        ]);

        expect(mockAgentRunner.executeInAgent).toHaveBeenCalledWith(
          "claude",
          "npm test",
          expect.objectContaining({
            cwd: "/app",
            timeout: 120,
          }),
        );
      });

      it("should exit with non-zero code on failure", async () => {
        mockAgentRunner.executeInAgent.mockResolvedValue({
          stdout: "",
          stderr: "error",
          exitCode: 1,
        });

        await expect(
          program.parseAsync([
            "node",
            "test",
            "spawn",
            "exec",
            "claude",
            "cmd",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });

      it("should handle execution error", async () => {
        mockAgentRunner.executeInAgent.mockRejectedValue(
          new Error("Agent not running"),
        );

        await expect(
          program.parseAsync([
            "node",
            "test",
            "spawn",
            "exec",
            "claude",
            "cmd",
          ]),
        ).rejects.toThrow("process.exit(1)");
      });
    });
  });
});
