import { EventEmitter } from "eventemitter3";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActionExecutor } from "./action-executor";
import { ObserverMcpClient } from "./mcp-client";
import { ActionLogger } from "../escalation-queue/action-logger";
import type {
  PromptAgentAction,
  RestartAgentAction,
  ReassignTaskAction,
  RetryTaskAction,
  PauseAgentAction,
  ReleaseLockAction,
  UpdateTaskStatusAction,
  ErrorEvent,
  ActionResult,
} from "../types";
import { SandboxManagerLike } from "./handlers";

describe("ActionExecutor", () => {
  let mcpClient: ObserverMcpClient;
  let actionLogger: ActionLogger;
  let sandboxManager: SandboxManagerLike;
  let executor: ActionExecutor;

  const mockErrorEvent: ErrorEvent = {
    type: "error",
    agentId: "agent-1",
    sandboxId: "sandbox-1",
    timestamp: new Date(),
    message: "Test error",
    severity: "error",
  };

  beforeEach(() => {
    // Mock MCP client
    mcpClient = {
      isConnected: vi.fn().mockReturnValue(true),
      sendHeartbeat: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      unlockFile: vi.fn().mockResolvedValue(undefined),
      listAgents: vi.fn().mockResolvedValue([]),
    } as unknown as ObserverMcpClient;

    // Mock sandbox manager
    sandboxManager = {
      restartSandbox: vi.fn().mockResolvedValue(undefined),
    };

    // Mock action logger
    actionLogger = {
      logAction: vi.fn().mockReturnValue({
        id: "act-123",
        projectId: "project-1",
        observerId: "observer-1",
        action: {},
        triggerEvent: mockErrorEvent,
        outcome: "pending",
        createdAt: new Date(),
      }),
      updateOutcome: vi.fn(),
    } as unknown as ActionLogger;

    executor = new ActionExecutor({
      projectId: "project-1",
      observerId: "observer-1",
      mcpClient,
      actionLogger,
      sandboxManager,
    });
  });

  afterEach(() => {
    executor.dispose();
  });

  describe("constructor", () => {
    it("should initialize with config", () => {
      expect(executor).toBeDefined();
      expect(executor instanceof EventEmitter).toBe(true);
    });

    it("should work without sandbox manager", () => {
      const executorWithoutSandbox = new ActionExecutor({
        projectId: "project-1",
        observerId: "observer-1",
        mcpClient,
        actionLogger,
      });

      expect(executorWithoutSandbox).toBeDefined();
      executorWithoutSandbox.dispose();
    });
  });

  describe("execute", () => {
    it("should execute prompt_agent action and emit event", async () => {
      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Continue working",
      };

      const actionListener = vi.fn();
      executor.on("action", actionListener);

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(true);
      expect(actionLogger.logAction).toHaveBeenCalledWith({
        projectId: "project-1",
        observerId: "observer-1",
        action,
        triggerEvent: mockErrorEvent,
      });
      expect(mcpClient.sendHeartbeat).toHaveBeenCalledWith("agent-1", "working");
      expect(actionLogger.updateOutcome).toHaveBeenCalledWith("act-123", "success");
      expect(actionListener).toHaveBeenCalledWith(action, result);
    });

    it("should execute restart_agent action with sandbox manager", async () => {
      const action: RestartAgentAction = {
        type: "restart_agent",
        agentId: "agent-1",
      };

      const actionListener = vi.fn();
      executor.on("action", actionListener);

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(true);
      expect(sandboxManager.restartSandbox).toHaveBeenCalledWith("agent-1");
      expect(actionLogger.updateOutcome).toHaveBeenCalledWith("act-123", "success");
      expect(actionListener).toHaveBeenCalledWith(action, result);
    });

    it("should handle restart_agent action failure when no sandbox manager", async () => {
      const executorWithoutSandbox = new ActionExecutor({
        projectId: "project-1",
        observerId: "observer-1",
        mcpClient,
        actionLogger,
      });

      const action: RestartAgentAction = {
        type: "restart_agent",
        agentId: "agent-1",
      };

      const result = await executorWithoutSandbox.execute(action, mockErrorEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("sandbox manager");
      expect(actionLogger.updateOutcome).toHaveBeenCalledWith(
        "act-123",
        "failure",
        expect.stringContaining("sandbox manager")
      );

      executorWithoutSandbox.dispose();
    });

    it("should execute reassign_task action", async () => {
      const action: ReassignTaskAction = {
        type: "reassign_task",
        taskId: "task-1",
        fromAgent: "agent-1",
        toAgent: "agent-2",
      };

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(true);
      // No status update since MCP doesn't support "pending"
      expect(mcpClient.updateTask).toHaveBeenCalledWith("task-1", {
        notes: "Reassigned from agent-1 to agent-2",
      });
    });

    it("should execute retry_task action", async () => {
      const action: RetryTaskAction = {
        type: "retry_task",
        taskId: "task-1",
      };

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(true);
      // Uses "in_progress" since MCP doesn't support "pending"
      expect(mcpClient.updateTask).toHaveBeenCalledWith("task-1", {
        status: "in_progress",
        notes: "Retrying task after previous failure",
      });
    });

    it("should execute pause_agent action", async () => {
      const action: PauseAgentAction = {
        type: "pause_agent",
        agentId: "agent-1",
        reason: "Rate limited",
      };

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(true);
      expect(mcpClient.sendHeartbeat).toHaveBeenCalledWith("agent-1", "blocked");
    });

    it("should execute release_lock action", async () => {
      const action: ReleaseLockAction = {
        type: "release_lock",
        filePath: "src/file.ts",
        agentId: "agent-1",
      };

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(true);
      expect(mcpClient.unlockFile).toHaveBeenCalledWith("src/file.ts", "agent-1");
    });

    it("should execute update_task_status action", async () => {
      const action: UpdateTaskStatusAction = {
        type: "update_task_status",
        taskId: "task-1",
        status: "blocked",
        notes: "Blocked by dependency",
      };

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(true);
      expect(mcpClient.updateTask).toHaveBeenCalledWith("task-1", {
        status: "blocked",
        notes: "Blocked by dependency",
      });
    });

    it("should handle action execution failure", async () => {
      const error = new Error("MCP client error");
      (mcpClient.sendHeartbeat as any).mockRejectedValueOnce(error);

      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Continue working",
      };

      const result = await executor.execute(action, mockErrorEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MCP client error");
      expect(actionLogger.updateOutcome).toHaveBeenCalledWith(
        "act-123",
        "failure",
        "MCP client error"
      );
    });

    it("should emit action event on execution", async () => {
      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Continue working",
      };

      const actionListener = vi.fn();
      executor.on("action", actionListener);

      const result = await executor.execute(action, mockErrorEvent);

      expect(actionListener).toHaveBeenCalledTimes(1);
      expect(actionListener).toHaveBeenCalledWith(action, result);
    });
  });

  describe("executeAll", () => {
    it("should execute multiple actions in sequence", async () => {
      const actions = [
        {
          type: "prompt_agent" as const,
          agentId: "agent-1",
          message: "Continue working",
        },
        {
          type: "retry_task" as const,
          taskId: "task-1",
        },
        {
          type: "pause_agent" as const,
          agentId: "agent-2",
          reason: "Rate limited",
        },
      ];

      const results = await executor.executeAll(actions, mockErrorEvent);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(actionLogger.logAction).toHaveBeenCalledTimes(3);
      expect(mcpClient.sendHeartbeat).toHaveBeenCalledTimes(2); // prompt and pause
      expect(mcpClient.updateTask).toHaveBeenCalledTimes(1); // retry
    });

    it("should continue executing actions even if one fails", async () => {
      (mcpClient.sendHeartbeat as any).mockRejectedValueOnce(
        new Error("Heartbeat failed")
      );

      const actions = [
        {
          type: "prompt_agent" as const,
          agentId: "agent-1",
          message: "Continue working",
        },
        {
          type: "retry_task" as const,
          taskId: "task-1",
        },
      ];

      const results = await executor.executeAll(actions, mockErrorEvent);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it("should emit action event for each executed action", async () => {
      const actions = [
        {
          type: "prompt_agent" as const,
          agentId: "agent-1",
          message: "Continue working",
        },
        {
          type: "retry_task" as const,
          taskId: "task-1",
        },
      ];

      const actionListener = vi.fn();
      executor.on("action", actionListener);

      await executor.executeAll(actions, mockErrorEvent);

      expect(actionListener).toHaveBeenCalledTimes(2);
    });

    it("should return empty array for empty actions", async () => {
      const results = await executor.executeAll([], mockErrorEvent);

      expect(results).toEqual([]);
      expect(actionLogger.logAction).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should remove all event listeners", () => {
      const listener = vi.fn();
      executor.on("action", listener);

      executor.dispose();

      expect(executor.listenerCount("action")).toBe(0);
    });

    it("should be callable multiple times without error", () => {
      expect(() => {
        executor.dispose();
        executor.dispose();
      }).not.toThrow();
    });
  });

  describe("EventEmitter integration", () => {
    it("should emit multiple events", async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      executor.on("action", listener1);
      executor.on("action", listener2);

      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Continue working",
      };

      await executor.execute(action, mockErrorEvent);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should handle listener removal", async () => {
      const listener = vi.fn();
      executor.on("action", listener);
      executor.off("action", listener);

      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Continue working",
      };

      await executor.execute(action, mockErrorEvent);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
