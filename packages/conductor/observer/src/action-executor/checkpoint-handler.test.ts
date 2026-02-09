import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleSaveCheckpointAndPause } from "./checkpoint-handler";
import { ObserverMcpClient } from "./mcp-client";
import type { SaveCheckpointAndPauseAction } from "../types";

describe("handleSaveCheckpointAndPause", () => {
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

  it("should successfully save checkpoint and pause agent", async () => {
    const action: SaveCheckpointAndPauseAction = {
      type: "save_checkpoint_and_pause",
      agentId: "agent-1",
      taskId: "task-1",
      tokenCount: 180000,
      tokenLimit: 200000,
      stage: "implementation",
    };

    await mockMcpClient.connect();

    const saveCheckpointSpy = vi.spyOn(mockMcpClient, "saveCheckpoint");
    const sendHeartbeatSpy = vi.spyOn(mockMcpClient, "sendHeartbeat");

    const result = await handleSaveCheckpointAndPause(action, mockMcpClient);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(saveCheckpointSpy).toHaveBeenCalledWith(
      "agent-1",
      "task-1",
      "implementation",
      180000,
    );
    expect(sendHeartbeatSpy).toHaveBeenCalledWith("agent-1", "blocked");
  });

  it("should update task status when taskId is provided", async () => {
    const action: SaveCheckpointAndPauseAction = {
      type: "save_checkpoint_and_pause",
      agentId: "agent-1",
      taskId: "task-1",
      tokenCount: 180000,
      tokenLimit: 200000,
      stage: "implementation",
    };

    await mockMcpClient.connect();

    const updateTaskSpy = vi.spyOn(mockMcpClient, "updateTask");

    const result = await handleSaveCheckpointAndPause(action, mockMcpClient);

    expect(result.success).toBe(true);
    expect(updateTaskSpy).toHaveBeenCalledWith("task-1", {
      status: "blocked",
      notes: "Context exhausted at 180000/200000 tokens. Checkpoint saved. Needs new session to continue.",
    });
  });

  it("should skip task update when no taskId is provided", async () => {
    const action: SaveCheckpointAndPauseAction = {
      type: "save_checkpoint_and_pause",
      agentId: "agent-1",
      tokenCount: 180000,
      tokenLimit: 200000,
      stage: "implementation",
    };

    await mockMcpClient.connect();

    const updateTaskSpy = vi.spyOn(mockMcpClient, "updateTask");

    const result = await handleSaveCheckpointAndPause(action, mockMcpClient);

    expect(result.success).toBe(true);
    expect(updateTaskSpy).not.toHaveBeenCalled();
  });

  it("should return failure when saveCheckpoint throws", async () => {
    const action: SaveCheckpointAndPauseAction = {
      type: "save_checkpoint_and_pause",
      agentId: "agent-1",
      taskId: "task-1",
      tokenCount: 180000,
      tokenLimit: 200000,
      stage: "implementation",
    };

    await mockMcpClient.connect();

    const error = new Error("Checkpoint save failed");
    vi.spyOn(mockMcpClient, "saveCheckpoint").mockRejectedValue(error);

    const result = await handleSaveCheckpointAndPause(action, mockMcpClient);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Checkpoint save failed");
  });

  it("should return failure when sendHeartbeat throws", async () => {
    const action: SaveCheckpointAndPauseAction = {
      type: "save_checkpoint_and_pause",
      agentId: "agent-1",
      taskId: "task-1",
      tokenCount: 180000,
      tokenLimit: 200000,
      stage: "implementation",
    };

    await mockMcpClient.connect();

    const error = new Error("Heartbeat failed");
    vi.spyOn(mockMcpClient, "sendHeartbeat").mockRejectedValue(error);

    const result = await handleSaveCheckpointAndPause(action, mockMcpClient);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Heartbeat failed");
  });
});
