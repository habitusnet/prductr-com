import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ObserverMcpClient } from "./mcp-client";

describe("ObserverMcpClient", () => {
  let client: ObserverMcpClient;
  const config = {
    serverUrl: "http://localhost:5000",
    observerId: "observer-agent-1",
  };

  beforeEach(() => {
    client = new ObserverMcpClient(config);
  });

  afterEach(() => {
    if (client.isConnected()) {
      client.disconnect();
    }
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a client with provided config", () => {
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });

    it("should extend EventEmitter", () => {
      expect(client.on).toBeDefined();
      expect(client.emit).toBeDefined();
      expect(client.off).toBeDefined();
    });
  });

  describe("connect", () => {
    it("should set connected status to true", async () => {
      // Mock the call method
      const mockCall = vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(mockCall).toHaveBeenCalledWith("conductor_request_access", {
        agentId: config.observerId,
        agentName: "Observer Agent",
        agentType: "claude",
        requestedRole: "lead",
        capabilities: ["oversight", "task-management", "agent-control"],
      });
    });

    it("should emit connected event on successful connection", async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      const connectedHandler = vi.fn();
      client.on("connected", connectedHandler);

      await client.connect();

      expect(connectedHandler).toHaveBeenCalled();
    });

    it("should emit error event on connection failure", async () => {
      const error = new Error("Connection failed");
      vi.spyOn(client as any, "call").mockRejectedValue(error);

      const errorHandler = vi.fn();
      client.on("error", errorHandler);

      await expect(client.connect()).rejects.toThrow("Connection failed");
      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it("should request access with correct capabilities", async () => {
      const mockCall = vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      await client.connect();

      const callArgs = mockCall.mock.calls[0];
      expect(callArgs[0]).toBe("conductor_request_access");
      expect(callArgs[1].capabilities).toContain("oversight");
      expect(callArgs[1].capabilities).toContain("task-management");
      expect(callArgs[1].capabilities).toContain("agent-control");
      expect(callArgs[1].requestedRole).toBe("lead");
    });
  });

  describe("disconnect", () => {
    it("should set connected status to false", async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it("should emit disconnected event", async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      await client.connect();

      const disconnectedHandler = vi.fn();
      client.on("disconnected", disconnectedHandler);

      client.disconnect();

      expect(disconnectedHandler).toHaveBeenCalled();
    });
  });

  describe("isConnected", () => {
    it("should return false when not connected", () => {
      expect(client.isConnected()).toBe(false);
    });

    it("should return true when connected", async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe("updateTask", () => {
    beforeEach(async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });
      await client.connect();
    });

    it("should call conductor_update_task with correct params", async () => {
      const mockCall = vi.spyOn(client as any, "call");

      const update = {
        status: "in_progress" as const,
        notes: "Working on this task",
      };

      await client.updateTask("task-123", update);

      expect(mockCall).toHaveBeenCalledWith("conductor_update_task", {
        taskId: "task-123",
        status: "in_progress",
        notes: "Working on this task",
      });
    });

    it("should handle partial updates", async () => {
      const mockCall = vi.spyOn(client as any, "call");

      await client.updateTask("task-123", {
        status: "completed",
      });

      const callArgs = mockCall.mock.calls.find(
        (call) => call[0] === "conductor_update_task"
      );
      expect(callArgs?.[1].taskId).toBe("task-123");
      expect(callArgs?.[1].status).toBe("completed");
    });

    it("should throw if not connected", async () => {
      client.disconnect();

      await expect(
        client.updateTask("task-123", { status: "completed" })
      ).rejects.toThrow("Not connected to MCP server");
    });
  });

  describe("unlockFile", () => {
    beforeEach(async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });
      await client.connect();
    });

    it("should call conductor_unlock_file with correct params", async () => {
      const mockCall = vi.spyOn(client as any, "call");

      await client.unlockFile("src/index.ts", "agent-1");

      expect(mockCall).toHaveBeenCalledWith("conductor_unlock_file", {
        filePath: "src/index.ts",
        agentId: "agent-1",
      });
    });

    it("should throw if not connected", async () => {
      client.disconnect();

      await expect(client.unlockFile("src/index.ts", "agent-1")).rejects.toThrow(
        "Not connected to MCP server"
      );
    });
  });

  describe("listAgents", () => {
    beforeEach(async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { id: "agent-1", name: "Agent 1", status: "active" },
            ]),
          },
        ],
      });
      await client.connect();
    });

    it("should call conductor_list_agents", async () => {
      const mockCall = vi.spyOn(client as any, "call");

      await client.listAgents();

      expect(mockCall).toHaveBeenCalledWith("conductor_list_agents", {});
    });

    it("should parse and return agents list", async () => {
      const agents = [
        { id: "agent-1", name: "Agent 1", status: "active" },
        { id: "agent-2", name: "Agent 2", status: "idle" },
      ];

      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(agents),
          },
        ],
      });

      const result = await client.listAgents();

      expect(result).toEqual(agents);
    });

    it("should throw if not connected", async () => {
      client.disconnect();

      await expect(client.listAgents()).rejects.toThrow(
        "Not connected to MCP server"
      );
    });
  });

  describe("sendHeartbeat", () => {
    beforeEach(async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });
      await client.connect();
    });

    it("should call conductor_heartbeat with correct params", async () => {
      const mockCall = vi.spyOn(client as any, "call");

      await client.sendHeartbeat("agent-1", "working");

      expect(mockCall).toHaveBeenCalledWith("conductor_heartbeat", {
        agentId: "agent-1",
        status: "working",
      });
    });

    it("should support different status values", async () => {
      const mockCall = vi.spyOn(client as any, "call");

      await client.sendHeartbeat("agent-1", "idle");
      await client.sendHeartbeat("agent-1", "blocked");

      expect(mockCall).toHaveBeenNthCalledWith(
        1,
        "conductor_heartbeat",
        expect.objectContaining({ status: "idle" })
      );
      expect(mockCall).toHaveBeenNthCalledWith(
        2,
        "conductor_heartbeat",
        expect.objectContaining({ status: "blocked" })
      );
    });

    it("should throw if not connected", async () => {
      client.disconnect();

      await expect(client.sendHeartbeat("agent-1", "idle")).rejects.toThrow(
        "Not connected to MCP server"
      );
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });
      await client.connect();
    });

    it("should emit error event on tool call failure", async () => {
      const error = new Error("Tool execution failed");
      vi.spyOn(client as any, "call").mockRejectedValue(error);

      const errorHandler = vi.fn();
      client.on("error", errorHandler);

      await expect(client.updateTask("task-1", { status: "completed" })).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(error);
    });
  });

  describe("event emission", () => {
    it("should allow listening to connected event", async () => {
      const handler = vi.fn();
      client.on("connected", handler);

      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      await client.connect();

      expect(handler).toHaveBeenCalled();
    });

    it("should allow removing event listeners", async () => {
      const handler = vi.fn();
      client.on("connected", handler);
      client.off("connected", handler);

      vi.spyOn(client as any, "call").mockResolvedValue({
        content: [{ type: "text" }],
      });

      await client.connect();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
