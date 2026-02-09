import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handlePromptAgent,
  handleRestartAgent,
  handleReassignTask,
  handleRetryTask,
  handlePauseAgent,
  handleReleaseLock,
  handleUpdateTaskStatus,
} from "./handlers";
import { ObserverMcpClient } from "./mcp-client";
import type {
  PromptAgentAction,
  RestartAgentAction,
  ReassignTaskAction,
  RetryTaskAction,
  PauseAgentAction,
  ReleaseLockAction,
  UpdateTaskStatusAction,
} from "../types";

interface SandboxManagerLike {
  restartSandbox(agentId: string): Promise<void>;
}

describe("Action Handlers", () => {
  let mockMcpClient: ObserverMcpClient;

  beforeEach(() => {
    mockMcpClient = new ObserverMcpClient({
      serverUrl: "http://localhost:5000",
      observerId: "observer-1",
    });

    // Mock the protected call method
    vi.spyOn(mockMcpClient as any, "call").mockResolvedValue({
      content: [{ type: "text" }],
    });
  });

  describe("handlePromptAgent", () => {
    it("should send heartbeat with working status", async () => {
      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Please check your current progress",
      };

      // Connect client first
      await mockMcpClient.connect();

      const sendHeartbeatSpy = vi.spyOn(mockMcpClient, "sendHeartbeat");

      const result = await handlePromptAgent(action, mockMcpClient);

      expect(result.success).toBe(true);
      expect(sendHeartbeatSpy).toHaveBeenCalledWith("agent-1", "working");
    });

    it("should return success for valid action", async () => {
      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Status check",
      };

      await mockMcpClient.connect();

      const result = await handlePromptAgent(action, mockMcpClient);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle heartbeat errors gracefully", async () => {
      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Status check",
      };

      await mockMcpClient.connect();

      const error = new Error("Heartbeat failed");
      vi.spyOn(mockMcpClient, "sendHeartbeat").mockRejectedValue(error);

      const result = await handlePromptAgent(action, mockMcpClient);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Heartbeat failed");
    });
  });

  describe("handleRestartAgent", () => {
    it("should call sandboxManager.restartSandbox with correct agentId", async () => {
      const action: RestartAgentAction = {
        type: "restart_agent",
        agentId: "agent-1",
      };

      const mockSandboxManager: SandboxManagerLike = {
        restartSandbox: vi.fn().mockResolvedValue(undefined),
      };

      const result = await handleRestartAgent(
        action,
        mockMcpClient,
        mockSandboxManager
      );

      expect(result.success).toBe(true);
      expect(mockSandboxManager.restartSandbox).toHaveBeenCalledWith("agent-1");
    });

    it("should return error when sandboxManager is null", async () => {
      const action: RestartAgentAction = {
        type: "restart_agent",
        agentId: "agent-1",
      };

      const result = await handleRestartAgent(action, mockMcpClient, null);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No sandbox manager");
    });

    it("should handle restart errors gracefully", async () => {
      const action: RestartAgentAction = {
        type: "restart_agent",
        agentId: "agent-1",
      };

      const mockSandboxManager: SandboxManagerLike = {
        restartSandbox: vi.fn().mockRejectedValue(new Error("Restart failed")),
      };

      const result = await handleRestartAgent(
        action,
        mockMcpClient,
        mockSandboxManager
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Restart failed");
    });
  });

  describe("handleReassignTask", () => {
    it("should update task with pending status when reassigning", async () => {
      const action: ReassignTaskAction = {
        type: "reassign_task",
        taskId: "task-1",
        fromAgent: "agent-1",
        toAgent: "agent-2",
      };

      await mockMcpClient.connect();

      const updateTaskSpy = vi.spyOn(mockMcpClient, "updateTask");

      const result = await handleReassignTask(action, mockMcpClient);

      expect(result.success).toBe(true);
      // Note: No status update since MCP doesn't support "pending"
      expect(updateTaskSpy).toHaveBeenCalledWith("task-1", {
        notes: "Reassigned from agent-1 to agent-2",
      });
    });

    it("should handle reassignment without toAgent", async () => {
      const action: ReassignTaskAction = {
        type: "reassign_task",
        taskId: "task-1",
        fromAgent: "agent-1",
      };

      await mockMcpClient.connect();

      const updateTaskSpy = vi.spyOn(mockMcpClient, "updateTask");

      const result = await handleReassignTask(action, mockMcpClient);

      expect(result.success).toBe(true);
      // Note: No status update since MCP doesn't support "pending"
      expect(updateTaskSpy).toHaveBeenCalledWith("task-1", {
        notes: "Reassigned from agent-1",
      });
    });

    it("should handle update errors gracefully", async () => {
      const action: ReassignTaskAction = {
        type: "reassign_task",
        taskId: "task-1",
        fromAgent: "agent-1",
        toAgent: "agent-2",
      };

      await mockMcpClient.connect();

      const error = new Error("Update failed");
      vi.spyOn(mockMcpClient, "updateTask").mockRejectedValue(error);

      const result = await handleReassignTask(action, mockMcpClient);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });
  });

  describe("handleRetryTask", () => {
    it("should update task with in_progress status and retry note", async () => {
      const action: RetryTaskAction = {
        type: "retry_task",
        taskId: "task-1",
      };

      await mockMcpClient.connect();

      const updateTaskSpy = vi.spyOn(mockMcpClient, "updateTask");

      const result = await handleRetryTask(action, mockMcpClient);

      expect(result.success).toBe(true);
      // Uses "in_progress" since MCP doesn't support "pending"
      expect(updateTaskSpy).toHaveBeenCalledWith("task-1", {
        status: "in_progress",
        notes: "Retrying task after previous failure",
      });
    });

    it("should handle update errors gracefully", async () => {
      const action: RetryTaskAction = {
        type: "retry_task",
        taskId: "task-1",
      };

      await mockMcpClient.connect();

      const error = new Error("Retry update failed");
      vi.spyOn(mockMcpClient, "updateTask").mockRejectedValue(error);

      const result = await handleRetryTask(action, mockMcpClient);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Retry update failed");
    });
  });

  describe("handlePauseAgent", () => {
    it("should send heartbeat with blocked status", async () => {
      const action: PauseAgentAction = {
        type: "pause_agent",
        agentId: "agent-1",
        reason: "Waiting for user input",
      };

      await mockMcpClient.connect();

      const sendHeartbeatSpy = vi.spyOn(mockMcpClient, "sendHeartbeat");

      const result = await handlePauseAgent(action, mockMcpClient);

      expect(result.success).toBe(true);
      expect(sendHeartbeatSpy).toHaveBeenCalledWith("agent-1", "blocked");
    });

    it("should handle heartbeat errors gracefully", async () => {
      const action: PauseAgentAction = {
        type: "pause_agent",
        agentId: "agent-1",
        reason: "Waiting for user input",
      };

      await mockMcpClient.connect();

      const error = new Error("Pause failed");
      vi.spyOn(mockMcpClient, "sendHeartbeat").mockRejectedValue(error);

      const result = await handlePauseAgent(action, mockMcpClient);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Pause failed");
    });
  });

  describe("handleReleaseLock", () => {
    it("should unlock file with correct parameters", async () => {
      const action: ReleaseLockAction = {
        type: "release_lock",
        filePath: "src/index.ts",
        agentId: "agent-1",
      };

      await mockMcpClient.connect();

      const unlockFileSpy = vi.spyOn(mockMcpClient, "unlockFile");

      const result = await handleReleaseLock(action, mockMcpClient);

      expect(result.success).toBe(true);
      expect(unlockFileSpy).toHaveBeenCalledWith("src/index.ts", "agent-1");
    });

    it("should handle unlock errors gracefully", async () => {
      const action: ReleaseLockAction = {
        type: "release_lock",
        filePath: "src/index.ts",
        agentId: "agent-1",
      };

      await mockMcpClient.connect();

      const error = new Error("Unlock failed");
      vi.spyOn(mockMcpClient, "unlockFile").mockRejectedValue(error);

      const result = await handleReleaseLock(action, mockMcpClient);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unlock failed");
    });
  });

  describe("handleUpdateTaskStatus", () => {
    it("should update task with provided status and notes", async () => {
      const action: UpdateTaskStatusAction = {
        type: "update_task_status",
        taskId: "task-1",
        status: "completed",
        notes: "Task completed successfully",
      };

      await mockMcpClient.connect();

      const updateTaskSpy = vi.spyOn(mockMcpClient, "updateTask");

      const result = await handleUpdateTaskStatus(action, mockMcpClient);

      expect(result.success).toBe(true);
      expect(updateTaskSpy).toHaveBeenCalledWith("task-1", {
        status: "completed",
        notes: "Task completed successfully",
      });
    });

    it("should handle different status values", async () => {
      const statuses = ["in_progress", "failed", "blocked"];

      for (const status of statuses) {
        const action: UpdateTaskStatusAction = {
          type: "update_task_status",
          taskId: "task-1",
          status,
          notes: `Status: ${status}`,
        };

        await mockMcpClient.connect();

        const updateTaskSpy = vi.spyOn(mockMcpClient, "updateTask");

        const result = await handleUpdateTaskStatus(action, mockMcpClient);

        expect(result.success).toBe(true);
        expect(updateTaskSpy).toHaveBeenCalledWith("task-1", {
          status,
          notes: `Status: ${status}`,
        });
      }
    });

    it("should handle update errors gracefully", async () => {
      const action: UpdateTaskStatusAction = {
        type: "update_task_status",
        taskId: "task-1",
        status: "failed",
        notes: "Task failed",
      };

      await mockMcpClient.connect();

      const error = new Error("Status update failed");
      vi.spyOn(mockMcpClient, "updateTask").mockRejectedValue(error);

      const result = await handleUpdateTaskStatus(action, mockMcpClient);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Status update failed");
    });
  });

  describe("error handling across all handlers", () => {
    it("should return error object with success=false on failure", async () => {
      const action: PromptAgentAction = {
        type: "prompt_agent",
        agentId: "agent-1",
        message: "Test",
      };

      await mockMcpClient.connect();

      vi.spyOn(mockMcpClient, "sendHeartbeat").mockRejectedValue(
        new Error("Test error")
      );

      const result = await handlePromptAgent(action, mockMcpClient);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("error");
      expect(result.success).toBe(false);
    });
  });
});
