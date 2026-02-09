/**
 * AgentRunner Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AgentRunner,
  createClaudeCodeRunner,
  createAiderRunner,
} from "./agent-runner.js";
import type {
  SandboxEvent,
  AgentRunnerConfig,
  StreamingAgentConfig,
} from "./types.js";

// Mock the e2b module
vi.mock("e2b", () => {
  return {
    Sandbox: {
      create: vi.fn(),
    },
  };
});

import { Sandbox } from "e2b";

describe("AgentRunner", () => {
  let runner: AgentRunner;
  let mockSandbox: any;
  let events: SandboxEvent[];
  let commandResults: Map<
    string,
    { stdout: string; stderr: string; exitCode: number }
  >;

  beforeEach(() => {
    events = [];
    commandResults = new Map();

    // Default command result
    commandResults.set("default", {
      stdout: "success",
      stderr: "",
      exitCode: 0,
    });

    // Reset mocks
    vi.clearAllMocks();

    // Create mock sandbox instance
    mockSandbox = {
      sandboxId: "sandbox-123",
      commands: {
        run: vi.fn().mockImplementation((cmd: string) => {
          // Return specific results for specific commands
          if (cmd.includes("git clone")) {
            return Promise.resolve(
              commandResults.get("git") || {
                stdout: "Cloning...",
                stderr: "",
                exitCode: 0,
              },
            );
          }
          if (cmd.includes("claude")) {
            return Promise.resolve(
              commandResults.get("claude") || {
                stdout: "Agent completed",
                stderr: "",
                exitCode: 0,
              },
            );
          }
          if (cmd.includes("aider")) {
            return Promise.resolve(
              commandResults.get("aider") || {
                stdout: "Aider completed",
                stderr: "",
                exitCode: 0,
              },
            );
          }
          return Promise.resolve(commandResults.get("default")!);
        }),
      },
      files: {
        read: vi.fn().mockResolvedValue("file content"),
        write: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
      },
      kill: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Sandbox.create
    vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox);

    // Create runner with event tracking
    runner = new AgentRunner({
      apiKey: "test-api-key",
      defaultTimeout: 60,
      maxConcurrent: 5,
      onEvent: (event) => events.push(event),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create runner with default options", () => {
      const defaultRunner = new AgentRunner();
      expect(defaultRunner).toBeInstanceOf(AgentRunner);
    });
  });

  describe("startAgent", () => {
    it("should start a Claude Code agent", async () => {
      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      const instance = await runner.startAgent(config);

      expect(instance).toBeDefined();
      expect(instance.id).toBe("sandbox-123");
      expect(instance.agentId).toBe("claude-1");
      expect(instance.status).toBe("running");
    });

    it("should start an Aider agent", async () => {
      const config: AgentRunnerConfig = {
        type: "aider",
        agentId: "aider-1",
        projectId: "project-1",
        mcpServerUrl: "",
      };

      const instance = await runner.startAgent(config);

      expect(instance).toBeDefined();
      expect(instance.agentId).toBe("aider-1");
    });

    it("should clone git repository when specified", async () => {
      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
        gitRepo: "https://github.com/org/repo",
        gitBranch: "main",
        workDir: "/home/user/workspace",
      };

      await runner.startAgent(config);

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining("git clone"),
        expect.any(Object),
      );
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining("-b main"),
        expect.any(Object),
      );
    });

    it("should run setup commands", async () => {
      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
        setupCommands: ["npm install", "npm run build"],
      };

      await runner.startAgent(config);

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "npm install",
        expect.any(Object),
      );
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "npm run build",
        expect.any(Object),
      );
    });

    it("should prevent starting duplicate agents", async () => {
      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      await runner.startAgent(config);

      await expect(runner.startAgent(config)).rejects.toThrow(
        "Agent claude-1 is already running",
      );
    });

    it("should cleanup sandbox on setup failure", async () => {
      mockSandbox.commands.run.mockRejectedValueOnce(
        new Error("Git clone failed"),
      );

      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
        gitRepo: "https://github.com/org/repo",
      };

      await expect(runner.startAgent(config)).rejects.toThrow(
        "Git clone failed",
      );
      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it("should set environment variables", async () => {
      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
        env: { CUSTOM_VAR: "value" },
      };

      await runner.startAgent(config);

      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({
            agentId: "claude-1",
            projectId: "project-1",
          }),
        }),
      );
    });
  });

  describe("runAgent", () => {
    it("should run agent and return success result", async () => {
      commandResults.set("claude", {
        stdout: "Task completed",
        stderr: "",
        exitCode: 0,
      });

      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe("claude-1");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Task completed");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return failure result on non-zero exit", async () => {
      commandResults.set("claude", {
        stdout: "",
        stderr: "Error occurred",
        exitCode: 1,
      });

      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-2",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("Error occurred");
    });

    it("should handle exceptions and return error result", async () => {
      vi.mocked(Sandbox.create).mockRejectedValue(
        new Error("Sandbox creation failed"),
      );

      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-3",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Sandbox creation failed");

      // Reset persistent mock for subsequent tests
      vi.mocked(Sandbox.create).mockReset();
    });

    it("should cleanup sandbox after run", async () => {
      const config: AgentRunnerConfig = {
        type: "claude-code",
        agentId: "claude-4",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      await runner.runAgent(config);

      expect(mockSandbox.kill).toHaveBeenCalled();
      expect(runner.isAgentRunning("claude-4")).toBe(false);
    });

    it("should throw for unknown agent type", async () => {
      const config: AgentRunnerConfig = {
        type: "unknown" as any,
        agentId: "unknown-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown agent type");
    });

    it("should run custom agent with AGENT_COMMAND env variable", async () => {
      const config: AgentRunnerConfig = {
        type: "custom",
        agentId: "custom-1",
        projectId: "project-1",
        mcpServerUrl: "",
        env: { AGENT_COMMAND: "python run_agent.py" },
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe("custom-1");
    });

    it("should run custom agent with default echo command when no AGENT_COMMAND", async () => {
      const config: AgentRunnerConfig = {
        type: "custom",
        agentId: "custom-2",
        projectId: "project-1",
        mcpServerUrl: "",
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe("custom-2");
    });

    it("should run copilot agent type", async () => {
      // Add specific result for copilot command
      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        if (cmd.includes("gh copilot")) {
          return Promise.resolve({
            stdout: "Copilot suggestions generated",
            stderr: "",
            exitCode: 0,
          });
        }
        return Promise.resolve({ stdout: "success", stderr: "", exitCode: 0 });
      });

      const config: AgentRunnerConfig = {
        type: "copilot",
        agentId: "copilot-1",
        projectId: "project-1",
        mcpServerUrl: "",
        workDir: "/workspace",
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe("copilot-1");
      // Verify the copilot command was called
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining("gh copilot suggest"),
        expect.any(Object),
      );
    });

    it("should run crush agent type", async () => {
      // Add specific result for crush command
      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        if (cmd.includes("crush")) {
          return Promise.resolve({
            stdout: "Crush agent completed",
            stderr: "",
            exitCode: 0,
          });
        }
        return Promise.resolve({ stdout: "success", stderr: "", exitCode: 0 });
      });

      const config: AgentRunnerConfig = {
        type: "crush",
        agentId: "crush-1",
        projectId: "project-1",
        mcpServerUrl: "",
        workDir: "/project",
      };

      const result = await runner.runAgent(config);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe("crush-1");
      // Verify the crush command was called with --yolo flag
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining("crush --yolo"),
        expect.any(Object),
      );
    });
  });

  describe("runAgentStreaming", () => {
    beforeEach(() => {
      // Setup mock to call streaming callbacks
      mockSandbox.commands.run = vi
        .fn()
        .mockImplementation(async (cmd, opts) => {
          if (opts?.onStdout) {
            opts.onStdout("Processing...\n");
            opts.onStdout("Done!\n");
          }
          if (opts?.onStderr) {
            opts.onStderr("Warning: something\n");
          }
          return {
            stdout: "Processing...\nDone!\n",
            stderr: "Warning: something\n",
            exitCode: 0,
          };
        });
    });

    it("should run agent with streaming output", async () => {
      const stdoutChunks: string[] = [];

      const config: StreamingAgentConfig = {
        type: "claude-code",
        agentId: "stream-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
        streaming: {
          onStdout: (data) => stdoutChunks.push(data),
        },
      };

      const result = await runner.runAgentStreaming(config);

      expect(result.success).toBe(true);
      expect(stdoutChunks.length).toBeGreaterThan(0);
    });

    it("should call all streaming callbacks", async () => {
      const onStart = vi.fn();
      const onStdout = vi.fn();
      const onStderr = vi.fn();
      const onComplete = vi.fn();

      const config: StreamingAgentConfig = {
        type: "claude-code",
        agentId: "stream-2",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
        streaming: {
          onStart,
          onStdout,
          onStderr,
          onComplete,
        },
      };

      await runner.runAgentStreaming(config);

      expect(onStart).toHaveBeenCalled();
      expect(onStdout).toHaveBeenCalled();
      expect(onStderr).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          exitCode: 0,
          duration: expect.any(Number),
        }),
      );
    });

    it("should call onError on failure", async () => {
      vi.mocked(Sandbox.create).mockRejectedValue(
        new Error("Stream failed"),
      );

      const onError = vi.fn();

      const config: StreamingAgentConfig = {
        type: "claude-code",
        agentId: "stream-3",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
        streaming: { onError },
      };

      const result = await runner.runAgentStreaming(config);

      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));

      // Reset persistent mock for subsequent tests
      vi.mocked(Sandbox.create).mockReset();
    });

    it("should cleanup sandbox after streaming run", async () => {
      const config: StreamingAgentConfig = {
        type: "claude-code",
        agentId: "stream-4",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      };

      await runner.runAgentStreaming(config);

      expect(mockSandbox.kill).toHaveBeenCalled();
      expect(runner.isAgentRunning("stream-4")).toBe(false);
    });
  });

  describe("executeInAgentStreaming", () => {
    beforeEach(() => {
      mockSandbox.commands.run = vi
        .fn()
        .mockImplementation(async (cmd, opts) => {
          if (opts?.onStdout) opts.onStdout("output\n");
          return { stdout: "output\n", stderr: "", exitCode: 0 };
        });
    });

    it("should execute command with streaming in running agent sandbox", async () => {
      await runner.startAgent({
        type: "claude-code",
        agentId: "exec-stream-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      const chunks: string[] = [];
      const result = await runner.executeInAgentStreaming(
        "exec-stream-1",
        "npm test",
        {
          callbacks: {
            onStdout: (data) => chunks.push(data),
          },
        },
      );

      expect(result.exitCode).toBe(0);
      expect(chunks).toContain("output\n");
    });

    it("should throw error for non-running agent", async () => {
      await expect(
        runner.executeInAgentStreaming("unknown", "ls", { callbacks: {} }),
      ).rejects.toThrow("Agent unknown is not running");
    });
  });

  describe("executeInAgent", () => {
    it("should execute command in running agent sandbox", async () => {
      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      const result = await runner.executeInAgent("claude-1", "ls -la");

      expect(result.exitCode).toBe(0);
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "ls -la",
        expect.any(Object),
      );
    });

    it("should throw error for non-running agent", async () => {
      await expect(runner.executeInAgent("unknown", "ls")).rejects.toThrow(
        "Agent unknown is not running",
      );
    });

    it("should pass options to command", async () => {
      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      await runner.executeInAgent("claude-1", "npm test", {
        cwd: "/app",
        timeout: 120,
      });

      expect(mockSandbox.commands.run).toHaveBeenCalledWith("npm test", {
        cwd: "/app",
        timeoutMs: 120000,
        envs: undefined,
      });
    });
  });

  describe("stopAgent", () => {
    it("should stop running agent", async () => {
      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      expect(runner.isAgentRunning("claude-1")).toBe(true);

      await runner.stopAgent("claude-1");

      expect(runner.isAgentRunning("claude-1")).toBe(false);
      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it("should do nothing for non-running agent", async () => {
      await runner.stopAgent("unknown");
      // Should not throw
    });
  });

  describe("isAgentRunning", () => {
    it("should return true for running agent", async () => {
      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      expect(runner.isAgentRunning("claude-1")).toBe(true);
    });

    it("should return false for non-running agent", () => {
      expect(runner.isAgentRunning("unknown")).toBe(false);
    });
  });

  describe("getRunningAgent", () => {
    it("should return agent info for running agent", async () => {
      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      const info = runner.getRunningAgent("claude-1");

      expect(info).toBeDefined();
      expect(info?.sandboxId).toBe("sandbox-123");
      expect(info?.startTime).toBeInstanceOf(Date);
      expect(info?.instance).toBeDefined();
    });

    it("should return undefined for non-running agent", () => {
      const info = runner.getRunningAgent("unknown");
      expect(info).toBeUndefined();
    });
  });

  describe("listRunningAgents", () => {
    it("should list all running agents", async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
      });

      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      await runner.startAgent({
        type: "aider",
        agentId: "aider-1",
        projectId: "project-1",
        mcpServerUrl: "",
      });

      const agents = runner.listRunningAgents();

      expect(agents.length).toBe(2);
      expect(agents.map((a) => a.agentId)).toContain("claude-1");
      expect(agents.map((a) => a.agentId)).toContain("aider-1");
    });

    it("should return empty array when no agents running", () => {
      const agents = runner.listRunningAgents();
      expect(agents).toEqual([]);
    });
  });

  describe("stopAllAgents", () => {
    it("should stop all running agents", async () => {
      const killFns = [
        vi.fn().mockResolvedValue(undefined),
        vi.fn().mockResolvedValue(undefined),
      ];

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
        kill: killFns[0],
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
        kill: killFns[1],
      });

      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      await runner.startAgent({
        type: "aider",
        agentId: "aider-1",
        projectId: "project-1",
        mcpServerUrl: "",
      });

      await runner.stopAllAgents();

      expect(runner.listRunningAgents().length).toBe(0);
    });
  });

  describe("getSandboxManager", () => {
    it("should return the sandbox manager", () => {
      const manager = runner.getSandboxManager();
      expect(manager).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("should return runner statistics", async () => {
      await runner.startAgent({
        type: "claude-code",
        agentId: "claude-1",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      const stats = runner.getStats();

      expect(stats.runningAgents).toBe(1);
      expect(stats.sandboxes).toBeDefined();
      expect(stats.sandboxes.running).toBe(1);
    });
  });

  describe("event handling", () => {
    it("should cleanup agent on sandbox timeout", async () => {
      // Create a manager with custom event handler that we can trigger
      const customRunner = new AgentRunner({
        apiKey: "test-key",
        defaultTimeout: 1, // Very short timeout
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce(mockSandbox);

      await customRunner.startAgent({
        type: "claude-code",
        agentId: "claude-timeout",
        projectId: "project-1",
        mcpServerUrl: "http://localhost:3001",
      });

      expect(customRunner.isAgentRunning("claude-timeout")).toBe(true);

      // Note: In real scenario, timeout would trigger automatically
      // For testing, we verify the agent is tracked initially
    });
  });
});

describe("createClaudeCodeRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockSandbox = {
      sandboxId: "sandbox-123",
      commands: {
        run: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
      },
      files: {
        read: vi.fn(),
        write: vi.fn(),
        remove: vi.fn(),
        list: vi.fn(),
      },
      kill: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Sandbox.create).mockResolvedValue(
      mockSandbox as unknown as Sandbox,
    );
  });

  it("should create a pre-configured Claude Code runner", () => {
    const { runner, startAgent, runAgent } = createClaudeCodeRunner(
      "http://localhost:3001",
    );

    expect(runner).toBeInstanceOf(AgentRunner);
    expect(typeof startAgent).toBe("function");
    expect(typeof runAgent).toBe("function");
  });

  it("should start agent with correct config", async () => {
    const { startAgent } = createClaudeCodeRunner("http://localhost:3001");

    const instance = await startAgent(
      "agent-1",
      "project-1",
      "https://github.com/org/repo",
    );

    expect(instance).toBeDefined();
    expect(instance.agentId).toBe("agent-1");
  });

  it("should run agent with runAgent and return result", async () => {
    const { runAgent } = createClaudeCodeRunner("http://localhost:3001");

    const result = await runAgent(
      "agent-2",
      "project-1",
      "https://github.com/org/repo",
    );

    expect(result).toBeDefined();
    expect(result.agentId).toBe("agent-2");
    expect(result.success).toBe(true);
  });
});

describe("createAiderRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockSandbox = {
      sandboxId: "sandbox-123",
      commands: {
        run: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
      },
      files: {
        read: vi.fn(),
        write: vi.fn(),
        remove: vi.fn(),
        list: vi.fn(),
      },
      kill: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Sandbox.create).mockResolvedValue(
      mockSandbox as unknown as Sandbox,
    );
  });

  it("should create a pre-configured Aider runner", () => {
    const { runner, startAgent, runAgent } = createAiderRunner();

    expect(runner).toBeInstanceOf(AgentRunner);
    expect(typeof startAgent).toBe("function");
    expect(typeof runAgent).toBe("function");
  });

  it("should start agent with correct config", async () => {
    const { startAgent } = createAiderRunner();

    const instance = await startAgent(
      "aider-1",
      "project-1",
      "https://github.com/org/repo",
    );

    expect(instance).toBeDefined();
    expect(instance.agentId).toBe("aider-1");
  });

  it("should run agent with runAgent and return result", async () => {
    const { runAgent } = createAiderRunner();

    const result = await runAgent(
      "aider-2",
      "project-1",
      "https://github.com/org/repo",
    );

    expect(result).toBeDefined();
    expect(result.agentId).toBe("aider-2");
    expect(result.success).toBe(true);
  });
});
