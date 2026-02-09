/**
 * SandboxManager Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SandboxManager } from "./sandbox-manager.js";
import type { SandboxEvent } from "./types.js";

// Mock the e2b module
vi.mock("e2b", () => {
  return {
    Sandbox: {
      create: vi.fn(),
    },
  };
});

import { Sandbox } from "e2b";

describe("SandboxManager", () => {
  let manager: SandboxManager;
  let mockSandbox: any;
  let events: SandboxEvent[];

  beforeEach(() => {
    events = [];

    // Reset mocks
    vi.clearAllMocks();

    // Create mock sandbox instance
    mockSandbox = {
      sandboxId: "sandbox-123",
      commands: {
        run: vi.fn().mockResolvedValue({
          stdout: "output",
          stderr: "",
          exitCode: 0,
        }),
      },
      files: {
        read: vi.fn().mockResolvedValue("file content"),
        write: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        list: vi
          .fn()
          .mockResolvedValue([{ name: "file1.txt" }, { name: "file2.txt" }]),
      },
      kill: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Sandbox.create
    vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox);

    // Create manager with event tracking
    manager = new SandboxManager({
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
    it("should create manager with default options", () => {
      const defaultManager = new SandboxManager();
      expect(defaultManager).toBeInstanceOf(SandboxManager);
    });

    it("should warn when API key is not provided", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      new SandboxManager({ apiKey: "" });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("E2B API key not provided"),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("createSandbox", () => {
    it("should create a sandbox successfully", async () => {
      const instance = await manager.createSandbox("agent-1", "project-1", {
        template: "base",
        timeout: 120,
      });

      expect(instance).toBeDefined();
      expect(instance.id).toBe("sandbox-123");
      expect(instance.agentId).toBe("agent-1");
      expect(instance.projectId).toBe("project-1");
      expect(instance.status).toBe("running");
      expect(instance.template).toBe("base");
    });

    it("should emit sandbox:created and sandbox:started events", async () => {
      await manager.createSandbox("agent-1", "project-1");

      expect(events.length).toBe(2);
      expect(events[0].type).toBe("sandbox:created");
      expect(events[1].type).toBe("sandbox:started");
      expect(events[1].sandboxId).toBe("sandbox-123");
    });

    it("should use default template when not specified", async () => {
      await manager.createSandbox("agent-1", "project-1");

      expect(Sandbox.create).toHaveBeenCalledWith(
        "base", // default template
        expect.any(Object),
      );
    });

    it("should use defaultTimeout when config.timeout is undefined", async () => {
      // Create manager with specific defaultTimeout
      const customManager = new SandboxManager({
        apiKey: "test-key",
        defaultTimeout: 120, // 2 minutes
        maxConcurrent: 5,
      });

      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      setTimeoutSpy.mockClear();

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "default-timeout-sandbox",
      });

      // Pass config WITHOUT timeout - should use defaultTimeout
      await customManager.createSandbox("agent-1", "project-1", {
        template: "base",
        // timeout is NOT provided, should use defaultTimeout of 120
      });

      // setTimeout should be called with the default timeout value
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 120000);

      setTimeoutSpy.mockRestore();
    });

    it("should enforce max concurrent sandboxes limit", async () => {
      // Create sandboxes up to the limit
      for (let i = 0; i < 5; i++) {
        vi.mocked(Sandbox.create).mockResolvedValueOnce({
          ...mockSandbox,
          sandboxId: `sandbox-${i}`,
        });
        await manager.createSandbox(`agent-${i}`, "project-1");
      }

      // Attempt to create one more
      await expect(
        manager.createSandbox("agent-extra", "project-1"),
      ).rejects.toThrow("Maximum concurrent sandboxes (5) reached");
    });

    it("should emit sandbox:failed event on error", async () => {
      vi.mocked(Sandbox.create).mockRejectedValue(new Error("API error"));

      await expect(
        manager.createSandbox("agent-1", "project-1"),
      ).rejects.toThrow("API error");

      // Reset mock for subsequent tests
      vi.mocked(Sandbox.create).mockReset();

      const failedEvent = events.find((e) => e.type === "sandbox:failed");
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.data?.["error"]).toContain("API error");
    });

    it("should not setup timeout handler when timeout is 0", async () => {
      // Create a fresh manager with defaultTimeout: 0
      const freshEvents: SandboxEvent[] = [];
      const freshManager = new SandboxManager({
        apiKey: "test-key",
        defaultTimeout: 0,
        maxConcurrent: 5,
        onEvent: (event) => freshEvents.push(event),
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "no-timeout-sandbox",
      });

      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      setTimeoutSpy.mockClear(); // Clear any previous calls

      await freshManager.createSandbox("agent-no-timeout", "project-1", {
        timeout: 0,
      });

      // setTimeout should not be called when timeout is 0
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });

    it("should setup timeout handler when timeout is positive", async () => {
      // Create a fresh manager for this test
      const freshEvents: SandboxEvent[] = [];
      const freshManager = new SandboxManager({
        apiKey: "test-key",
        maxConcurrent: 5,
        onEvent: (event) => freshEvents.push(event),
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "timeout-sandbox",
      });

      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      setTimeoutSpy.mockClear(); // Clear any previous calls

      await freshManager.createSandbox("agent-timeout", "project-1", {
        timeout: 60,
      });

      // setTimeout should be called with the timeout value
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

      setTimeoutSpy.mockRestore();
    });
  });

  describe("getSandbox", () => {
    it("should return sandbox by ID", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const sandbox = manager.getSandbox("sandbox-123");
      expect(sandbox).toBeDefined();
      expect(sandbox).toBe(mockSandbox);
    });

    it("should return undefined for unknown ID", () => {
      const sandbox = manager.getSandbox("unknown-id");
      expect(sandbox).toBeUndefined();
    });
  });

  describe("getInstance", () => {
    it("should return instance info by ID", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const instance = manager.getInstance("sandbox-123");
      expect(instance).toBeDefined();
      expect(instance?.agentId).toBe("agent-1");
      expect(instance?.projectId).toBe("project-1");
    });

    it("should return undefined for unknown ID", () => {
      const instance = manager.getInstance("unknown-id");
      expect(instance).toBeUndefined();
    });
  });

  describe("listInstances", () => {
    it("should list all instances", async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
      });

      await manager.createSandbox("agent-1", "project-1");
      await manager.createSandbox("agent-2", "project-1");

      const instances = manager.listInstances();
      expect(instances.length).toBe(2);
    });

    it("should filter by status", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const running = manager.listInstances({ status: "running" });
      expect(running.length).toBe(1);

      const stopped = manager.listInstances({ status: "stopped" });
      expect(stopped.length).toBe(0);
    });

    it("should filter by agentId", async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
      });

      await manager.createSandbox("agent-1", "project-1");
      await manager.createSandbox("agent-2", "project-1");

      const agent1Instances = manager.listInstances({ agentId: "agent-1" });
      expect(agent1Instances.length).toBe(1);
      expect(agent1Instances[0].agentId).toBe("agent-1");
    });

    it("should filter by projectId", async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
      });

      await manager.createSandbox("agent-1", "project-1");
      await manager.createSandbox("agent-2", "project-2");

      const project1Instances = manager.listInstances({
        projectId: "project-1",
      });
      expect(project1Instances.length).toBe(1);
      expect(project1Instances[0].projectId).toBe("project-1");
    });
  });

  describe("executeCommand", () => {
    it("should execute command in sandbox", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const result = await manager.executeCommand("sandbox-123", "ls -la");

      expect(result.stdout).toBe("output");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "ls -la",
        expect.any(Object),
      );
    });

    it("should pass options to command", async () => {
      await manager.createSandbox("agent-1", "project-1");

      await manager.executeCommand("sandbox-123", "npm test", {
        cwd: "/app",
        timeout: 30,
        env: { NODE_ENV: "test" },
      });

      expect(mockSandbox.commands.run).toHaveBeenCalledWith("npm test", {
        cwd: "/app",
        timeoutMs: 30000,
        envs: { NODE_ENV: "test" },
      });
    });

    it("should throw error for unknown sandbox", async () => {
      await expect(manager.executeCommand("unknown", "ls")).rejects.toThrow(
        "Sandbox unknown not found",
      );
    });

    it("should update lastActivityAt on command execution", async () => {
      await manager.createSandbox("agent-1", "project-1");
      const instanceBefore = manager.getInstance("sandbox-123");
      const timeBefore = instanceBefore?.lastActivityAt.getTime();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await manager.executeCommand("sandbox-123", "ls");
      const instanceAfter = manager.getInstance("sandbox-123");
      const timeAfter = instanceAfter?.lastActivityAt.getTime();

      expect(timeAfter).toBeGreaterThan(timeBefore!);
    });
  });

  describe("executeCommandStreaming", () => {
    beforeEach(async () => {
      // Setup mock to call streaming callbacks
      mockSandbox.commands.run = vi
        .fn()
        .mockImplementation(async (cmd, opts) => {
          // Simulate streaming output
          if (opts?.onStdout) {
            opts.onStdout("line 1\n");
            opts.onStdout("line 2\n");
          }
          if (opts?.onStderr) {
            opts.onStderr("warning\n");
          }
          return {
            stdout: "line 1\nline 2\n",
            stderr: "warning\n",
            exitCode: 0,
          };
        });
    });

    it("should execute command with streaming callbacks", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const result = await manager.executeCommandStreaming(
        "sandbox-123",
        "npm test",
        {
          callbacks: {
            onStdout: (data) => stdoutChunks.push(data),
            onStderr: (data) => stderrChunks.push(data),
          },
        },
      );

      expect(result.exitCode).toBe(0);
      expect(stdoutChunks).toEqual(["line 1\n", "line 2\n"]);
      expect(stderrChunks).toEqual(["warning\n"]);
    });

    it("should call onStart callback", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const onStart = vi.fn();

      await manager.executeCommandStreaming("sandbox-123", "ls", {
        callbacks: { onStart },
      });

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it("should call onComplete callback with exit code and duration", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const onComplete = vi.fn();

      await manager.executeCommandStreaming("sandbox-123", "ls", {
        callbacks: { onComplete },
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          exitCode: 0,
          duration: expect.any(Number),
        }),
      );
    });

    it("should call onOutput callback with StreamingChunk", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const chunks: Array<{ type: string; data: string }> = [];

      await manager.executeCommandStreaming("sandbox-123", "npm test", {
        callbacks: {
          onOutput: (chunk) =>
            chunks.push({ type: chunk.type, data: chunk.data }),
        },
      });

      expect(chunks).toContainEqual({ type: "stdout", data: "line 1\n" });
      expect(chunks).toContainEqual({ type: "stdout", data: "line 2\n" });
      expect(chunks).toContainEqual({ type: "stderr", data: "warning\n" });
    });

    it("should call onError callback on error", async () => {
      mockSandbox.commands.run = vi
        .fn()
        .mockRejectedValue(new Error("Command failed"));
      await manager.createSandbox("agent-1", "project-1");

      const onError = vi.fn();

      await expect(
        manager.executeCommandStreaming("sandbox-123", "bad-cmd", {
          callbacks: { onError },
        }),
      ).rejects.toThrow("Command failed");

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should throw error for unknown sandbox", async () => {
      await expect(
        manager.executeCommandStreaming("unknown", "ls", { callbacks: {} }),
      ).rejects.toThrow("Sandbox unknown not found");
    });

    it("should collect stdout and stderr in result", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const result = await manager.executeCommandStreaming(
        "sandbox-123",
        "npm test",
        {
          callbacks: {},
        },
      );

      expect(result.stdout).toBe("line 1\nline 2\n");
      expect(result.stderr).toBe("warning\n");
    });

    it("should pass options to command", async () => {
      await manager.createSandbox("agent-1", "project-1");

      await manager.executeCommandStreaming("sandbox-123", "npm test", {
        cwd: "/app",
        timeout: 30,
        env: { NODE_ENV: "test" },
        callbacks: {},
      });

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "npm test",
        expect.objectContaining({
          cwd: "/app",
          timeoutMs: 30000,
          envs: { NODE_ENV: "test" },
        }),
      );
    });
  });

  describe("fileOperation", () => {
    beforeEach(async () => {
      await manager.createSandbox("agent-1", "project-1");
    });

    it("should read file", async () => {
      const result = await manager.fileOperation("sandbox-123", {
        type: "read",
        path: "/app/file.txt",
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe("file content");
      expect(mockSandbox.files.read).toHaveBeenCalledWith("/app/file.txt");
    });

    it("should write file", async () => {
      const result = await manager.fileOperation("sandbox-123", {
        type: "write",
        path: "/app/file.txt",
        content: "new content",
      });

      expect(result.success).toBe(true);
      expect(mockSandbox.files.write).toHaveBeenCalledWith(
        "/app/file.txt",
        "new content",
      );
    });

    it("should write file with empty string when content is undefined", async () => {
      const result = await manager.fileOperation("sandbox-123", {
        type: "write",
        path: "/app/empty.txt",
        // content is undefined - should default to ''
      });

      expect(result.success).toBe(true);
      expect(mockSandbox.files.write).toHaveBeenCalledWith(
        "/app/empty.txt",
        "",
      );
    });

    it("should delete file", async () => {
      const result = await manager.fileOperation("sandbox-123", {
        type: "delete",
        path: "/app/file.txt",
      });

      expect(result.success).toBe(true);
      expect(mockSandbox.files.remove).toHaveBeenCalledWith("/app/file.txt");
    });

    it("should list files", async () => {
      const result = await manager.fileOperation("sandbox-123", {
        type: "list",
        path: "/app",
      });

      expect(result.success).toBe(true);
      expect(result.files).toEqual(["file1.txt", "file2.txt"]);
    });

    it("should check file exists", async () => {
      const result = await manager.fileOperation("sandbox-123", {
        type: "exists",
        path: "/app/file.txt",
      });

      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
    });

    it("should return exists=false when file not found", async () => {
      mockSandbox.files.read.mockRejectedValueOnce(new Error("Not found"));

      const result = await manager.fileOperation("sandbox-123", {
        type: "exists",
        path: "/app/missing.txt",
      });

      expect(result.success).toBe(true);
      expect(result.exists).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      mockSandbox.files.read.mockRejectedValueOnce(new Error("Read error"));

      const result = await manager.fileOperation("sandbox-123", {
        type: "read",
        path: "/app/file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Read error");
    });

    it("should throw error for unknown sandbox", async () => {
      await expect(
        manager.fileOperation("unknown", { type: "read", path: "/app" }),
      ).rejects.toThrow("Sandbox unknown not found");
    });

    it("should return error for unknown operation type", async () => {
      await manager.createSandbox("agent-1", "project-1");

      const result = await manager.fileOperation("sandbox-123", {
        type: "unknown" as any,
        path: "/app/file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown operation type");
    });
  });

  describe("stopSandbox", () => {
    it("should stop sandbox and emit event", async () => {
      await manager.createSandbox("agent-1", "project-1");

      await manager.stopSandbox("sandbox-123");

      expect(mockSandbox.kill).toHaveBeenCalled();

      const stoppedEvent = events.find((e) => e.type === "sandbox:stopped");
      expect(stoppedEvent).toBeDefined();
      expect(stoppedEvent?.sandboxId).toBe("sandbox-123");
    });

    it("should update instance status to stopped", async () => {
      // Disable auto-cleanup to check status
      const noCleanupManager = new SandboxManager({
        apiKey: "test-key",
        autoCleanup: false,
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce(mockSandbox);

      await noCleanupManager.createSandbox("agent-1", "project-1");
      await noCleanupManager.stopSandbox("sandbox-123");

      const instance = noCleanupManager.getInstance("sandbox-123");
      expect(instance?.status).toBe("stopped");
    });

    it("should handle errors gracefully", async () => {
      mockSandbox.kill.mockRejectedValueOnce(new Error("Kill error"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await manager.createSandbox("agent-1", "project-1");
      await manager.stopSandbox("sandbox-123");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should do nothing for unknown sandbox", async () => {
      await manager.stopSandbox("unknown");
      // Should not throw
    });
  });

  describe("stopAgentSandboxes", () => {
    it("should stop all sandboxes for an agent", async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await manager.createSandbox("agent-1", "project-1");
      await manager.createSandbox("agent-1", "project-2");

      await manager.stopAgentSandboxes("agent-1");

      const instances = manager.listInstances({ status: "running" });
      expect(instances.length).toBe(0);
    });
  });

  describe("stopProjectSandboxes", () => {
    it("should stop all sandboxes for a project", async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await manager.createSandbox("agent-1", "project-1");
      await manager.createSandbox("agent-2", "project-1");

      await manager.stopProjectSandboxes("project-1");

      const instances = manager.listInstances({ status: "running" });
      expect(instances.length).toBe(0);
    });
  });

  describe("stopAll", () => {
    it("should stop all running sandboxes", async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await manager.createSandbox("agent-1", "project-1");
      await manager.createSandbox("agent-2", "project-2");

      await manager.stopAll();

      const instances = manager.listInstances({ status: "running" });
      expect(instances.length).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("should remove stopped sandboxes from memory", async () => {
      const noCleanupManager = new SandboxManager({
        apiKey: "test-key",
        autoCleanup: false,
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce(mockSandbox);

      await noCleanupManager.createSandbox("agent-1", "project-1");
      await noCleanupManager.stopSandbox("sandbox-123");

      expect(noCleanupManager.listInstances().length).toBe(1);

      noCleanupManager.cleanup();

      expect(noCleanupManager.listInstances().length).toBe(0);
    });

    it("should NOT remove running sandboxes from memory", async () => {
      const noCleanupManager = new SandboxManager({
        apiKey: "test-key",
        autoCleanup: false,
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "running-sandbox",
      });

      await noCleanupManager.createSandbox("agent-1", "project-1");

      // Verify sandbox is running
      expect(noCleanupManager.getInstance("running-sandbox")?.status).toBe(
        "running",
      );
      expect(noCleanupManager.listInstances().length).toBe(1);

      // Call cleanup - running sandboxes should NOT be removed
      noCleanupManager.cleanup();

      // Running sandbox should still be present
      expect(noCleanupManager.listInstances().length).toBe(1);
      expect(noCleanupManager.getInstance("running-sandbox")?.status).toBe(
        "running",
      );
    });

    it("should only remove non-running sandboxes, keeping running ones", async () => {
      const noCleanupManager = new SandboxManager({
        apiKey: "test-key",
        autoCleanup: false,
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-running",
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-stopped",
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await noCleanupManager.createSandbox("agent-1", "project-1");
      await noCleanupManager.createSandbox("agent-2", "project-1");
      await noCleanupManager.stopSandbox("sandbox-stopped");

      expect(noCleanupManager.listInstances().length).toBe(2);

      noCleanupManager.cleanup();

      // Only the running sandbox should remain
      const remaining = noCleanupManager.listInstances();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("sandbox-running");
      expect(remaining[0].status).toBe("running");
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      const noCleanupManager = new SandboxManager({
        apiKey: "test-key",
        autoCleanup: false,
        onEvent: () => {},
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-1",
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "sandbox-2",
      });

      await noCleanupManager.createSandbox("agent-1", "project-1");
      await noCleanupManager.createSandbox("agent-2", "project-1");
      await noCleanupManager.stopSandbox("sandbox-1");

      const stats = noCleanupManager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.stopped).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.timeout).toBe(0);
    });
  });

  describe("event handling", () => {
    it("should handle errors in onEvent callback gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const throwingManager = new SandboxManager({
        apiKey: "test-key",
        onEvent: () => {
          throw new Error("Event handler error");
        },
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce(mockSandbox);

      // This should not throw even though onEvent throws
      await throwingManager.createSandbox("agent-1", "project-1");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error in event handler:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("timeout handling", () => {
    it("should handle sandbox timeout and update status", async () => {
      const timeoutEvents: SandboxEvent[] = [];
      const timeoutManager = new SandboxManager({
        apiKey: "test-key",
        autoCleanup: false,
        defaultTimeout: 1, // 1 second timeout
        onEvent: (event) => timeoutEvents.push(event),
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "timeout-sandbox",
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await timeoutManager.createSandbox("agent-1", "project-1");

      // Access the private method via type assertion to trigger timeout handling
      // This simulates what would happen when the sandbox times out
      const instance = timeoutManager.getInstance("timeout-sandbox");
      expect(instance).toBeDefined();
      expect(instance?.status).toBe("running");

      // Manually trigger timeout by calling the private method via prototype
      (timeoutManager as any).handleTimeout("timeout-sandbox");

      // Check that status was updated to timeout
      const updatedInstance = timeoutManager.getInstance("timeout-sandbox");
      expect(updatedInstance?.status).toBe("timeout");

      // Check that timeout event was emitted
      const timeoutEvent = timeoutEvents.find(
        (e) => e.type === "sandbox:timeout",
      );
      expect(timeoutEvent).toBeDefined();
      expect(timeoutEvent?.sandboxId).toBe("timeout-sandbox");
    });

    it("should not handle timeout for non-running sandbox", async () => {
      const timeoutEvents: SandboxEvent[] = [];
      const timeoutManager = new SandboxManager({
        apiKey: "test-key",
        autoCleanup: false,
        onEvent: (event) => timeoutEvents.push(event),
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "stopped-sandbox",
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await timeoutManager.createSandbox("agent-1", "project-1");
      await timeoutManager.stopSandbox("stopped-sandbox");

      // Clear events from creation/stop
      timeoutEvents.length = 0;

      // Try to trigger timeout on a stopped sandbox
      (timeoutManager as any).handleTimeout("stopped-sandbox");

      // No timeout event should be emitted
      const timeoutEvent = timeoutEvents.find(
        (e) => e.type === "sandbox:timeout",
      );
      expect(timeoutEvent).toBeUndefined();
    });

    it("should handle timeout for non-existent sandbox gracefully", () => {
      const timeoutManager = new SandboxManager({
        apiKey: "test-key",
        onEvent: () => {},
      });

      // Should not throw for non-existent sandbox
      (timeoutManager as any).handleTimeout("non-existent");
    });

    it("should execute setTimeout callback when timeout expires", async () => {
      vi.useFakeTimers();

      const timeoutEvents: SandboxEvent[] = [];
      const fakeTimerManager = new SandboxManager({
        apiKey: "test-key",
        defaultTimeout: 5, // 5 second timeout
        autoCleanup: false,
        onEvent: (event) => timeoutEvents.push(event),
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: "fake-timer-sandbox",
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await fakeTimerManager.createSandbox("agent-fake", "project-1", {
        timeout: 5,
      });

      // Verify sandbox is running
      expect(fakeTimerManager.getInstance("fake-timer-sandbox")?.status).toBe(
        "running",
      );

      // Advance time to trigger the setTimeout callback (line 109)
      vi.advanceTimersByTime(5000);

      // Verify the timeout handler was called via setTimeout callback
      const timeoutEvent = timeoutEvents.find(
        (e) => e.type === "sandbox:timeout",
      );
      expect(timeoutEvent).toBeDefined();
      expect(fakeTimerManager.getInstance("fake-timer-sandbox")?.status).toBe(
        "timeout",
      );

      vi.useRealTimers();
    });
  });
});
