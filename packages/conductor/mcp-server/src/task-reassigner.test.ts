import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskReassigner } from "./task-reassigner.js";
import { HealthMonitor } from "./health-monitor.js";
import { EventEmitter } from "events";
import type { AgentProfile, Task } from "@conductor/core";

function makeAgent(
  id: string,
  capabilities: string[],
  status: string = "idle",
): AgentProfile {
  return {
    id,
    name: `Agent ${id}`,
    provider: "anthropic",
    model: "claude-opus-4",
    capabilities,
    costPerToken: { input: 0.01, output: 0.03 },
    status: status as AgentProfile["status"],
    lastHeartbeat: new Date(),
    metadata: {},
  };
}

function makeTask(
  id: string,
  assignedTo: string,
  tags: string[] = [],
  metadata: Record<string, unknown> = {},
): Task {
  return {
    id,
    projectId: "proj-1",
    title: `Task ${id}`,
    status: "in_progress",
    priority: "medium",
    assignedTo,
    dependencies: [],
    files: [],
    tags,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockStore(options: {
  orphanedTasks?: Task[];
  agents?: AgentProfile[];
  reassignmentCounts?: Record<string, number>;
}) {
  return {
    getOrphanedTasks: vi.fn().mockReturnValue(options.orphanedTasks ?? []),
    listAgents: vi.fn().mockReturnValue(options.agents ?? []),
    getAgent: vi.fn().mockImplementation((id: string) => {
      return options.agents?.find((a) => a.id === id) ?? null;
    }),
    getTaskReassignmentCount: vi
      .fn()
      .mockImplementation(
        (taskId: string) => options.reassignmentCounts?.[taskId] ?? 0,
      ),
    reassignTask: vi.fn().mockImplementation((taskId: string, newAgent: string) => ({
      ...makeTask(taskId, newAgent),
      assignedTo: newAgent,
      metadata: { reassignmentCount: 1 },
    })),
    updateAgentStatus: vi.fn(),
  } as any;
}

function createMockHealthMonitor(): HealthMonitor {
  // Use a real EventEmitter so listeners work
  return new EventEmitter() as unknown as HealthMonitor;
}

describe("TaskReassigner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("grace period", () => {
    it("should wait grace period before reassigning", () => {
      const offlineAgent = makeAgent("agent-old", ["typescript"], "offline");
      const availableAgent = makeAgent("agent-new", ["typescript"], "idle");
      const task = makeTask("task-1", "agent-old");

      const store = createMockStore({
        orphanedTasks: [task],
        agents: [offlineAgent, availableAgent],
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 60000, // 1 minute
      });

      const reassignHandler = vi.fn();
      reassigner.on("reassignment", reassignHandler);
      reassigner.start();

      // Trigger offline event
      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      // Should not reassign immediately
      expect(reassignHandler).not.toHaveBeenCalled();

      // Advance time past grace period
      vi.advanceTimersByTime(60000);

      expect(store.reassignTask).toHaveBeenCalledWith(
        "task-1",
        "agent-new",
        "proj-1",
      );
      expect(reassignHandler).toHaveBeenCalledTimes(1);
      expect(reassignHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          fromAgent: "agent-old",
          toAgent: "agent-new",
        }),
      );

      reassigner.stop();
    });

    it("should not reassign if agent recovers during grace period", () => {
      const task = makeTask("task-1", "agent-old");

      // Start with offline agent
      const offlineAgent = makeAgent("agent-old", ["typescript"], "offline");
      const availableAgent = makeAgent("agent-new", ["typescript"], "idle");
      const store = createMockStore({
        orphanedTasks: [task],
        agents: [offlineAgent, availableAgent],
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 60000,
      });

      reassigner.start();

      // Trigger offline
      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      // Agent recovers before grace period ends
      const recoveredAgent = makeAgent("agent-old", ["typescript"], "idle");
      store.getAgent.mockImplementation((id: string) => {
        if (id === "agent-old") return recoveredAgent;
        return availableAgent;
      });

      // Advance past grace period
      vi.advanceTimersByTime(60000);

      // Should NOT have reassigned
      expect(store.reassignTask).not.toHaveBeenCalled();

      reassigner.stop();
    });
  });

  describe("max reassignments", () => {
    it("should cap reassignments at maxReassignments", () => {
      const task = makeTask("task-1", "agent-old");
      const offlineAgent = makeAgent("agent-old", ["typescript"], "offline");
      const availableAgent = makeAgent("agent-new", ["typescript"], "idle");

      const store = createMockStore({
        orphanedTasks: [task],
        agents: [offlineAgent, availableAgent],
        reassignmentCounts: { "task-1": 3 }, // Already at max
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 0,
        maxReassignments: 3,
      });

      const maxHandler = vi.fn();
      reassigner.on("reassignment:max-reached", maxHandler);
      reassigner.start();

      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      expect(maxHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          fromAgent: "agent-old",
          count: 3,
        }),
      );

      expect(store.reassignTask).not.toHaveBeenCalled();

      reassigner.stop();
    });
  });

  describe("no agent available", () => {
    it("should emit failed event when no agent can handle the task", () => {
      const task = makeTask("task-1", "agent-old", ["requires:python"]);
      const offlineAgent = makeAgent("agent-old", ["python"], "offline");
      // Only available agent doesn't have python
      const availableAgent = makeAgent("agent-new", ["typescript"], "idle");

      const store = createMockStore({
        orphanedTasks: [task],
        agents: [offlineAgent, availableAgent],
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 0,
      });

      const failedHandler = vi.fn();
      reassigner.on("reassignment:failed", failedHandler);
      reassigner.start();

      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      vi.advanceTimersByTime(0);

      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          fromAgent: "agent-old",
          reason: expect.stringContaining("No available agent"),
        }),
      );

      reassigner.stop();
    });
  });

  describe("multiple tasks", () => {
    it("should handle multiple tasks from same offline agent", () => {
      const tasks = [
        makeTask("task-1", "agent-old"),
        makeTask("task-2", "agent-old"),
      ];
      const offlineAgent = makeAgent("agent-old", ["typescript"], "offline");
      const availableAgent = makeAgent("agent-new", ["typescript"], "idle");

      const store = createMockStore({
        orphanedTasks: tasks,
        agents: [offlineAgent, availableAgent],
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 1000,
      });

      const reassignHandler = vi.fn();
      reassigner.on("reassignment", reassignHandler);
      reassigner.start();

      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      vi.advanceTimersByTime(1000);

      expect(store.reassignTask).toHaveBeenCalledTimes(2);
      expect(reassignHandler).toHaveBeenCalledTimes(2);

      reassigner.stop();
    });
  });

  describe("start/stop", () => {
    it("should not process events after stop", () => {
      const task = makeTask("task-1", "agent-old");
      const offlineAgent = makeAgent("agent-old", ["typescript"], "offline");
      const availableAgent = makeAgent("agent-new", ["typescript"], "idle");

      const store = createMockStore({
        orphanedTasks: [task],
        agents: [offlineAgent, availableAgent],
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 1000,
      });

      reassigner.start();
      reassigner.stop();

      // Emit after stop — should be ignored
      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      vi.advanceTimersByTime(2000);

      expect(store.reassignTask).not.toHaveBeenCalled();
    });

    it("should cancel pending timers on stop", () => {
      const task = makeTask("task-1", "agent-old");
      const offlineAgent = makeAgent("agent-old", ["typescript"], "offline");
      const availableAgent = makeAgent("agent-new", ["typescript"], "idle");

      const store = createMockStore({
        orphanedTasks: [task],
        agents: [offlineAgent, availableAgent],
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 60000,
      });

      reassigner.start();

      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      // Stop before grace period ends
      reassigner.stop();
      vi.advanceTimersByTime(60000);

      expect(store.reassignTask).not.toHaveBeenCalled();
    });
  });

  describe("capability matching for reassignment", () => {
    it("should prefer agent with better capability match", () => {
      const task = makeTask("task-1", "agent-old", [
        "requires:typescript",
        "requires:testing",
      ]);
      const offlineAgent = makeAgent("agent-old", ["typescript", "testing"], "offline");
      const partialMatch = makeAgent("agent-partial", ["typescript"], "idle");
      const fullMatch = makeAgent("agent-full", ["typescript", "testing"], "idle");

      const store = createMockStore({
        orphanedTasks: [task],
        agents: [offlineAgent, partialMatch, fullMatch],
      });

      const monitor = createMockHealthMonitor();
      const reassigner = new TaskReassigner({
        stateStore: store,
        projectId: "proj-1",
        healthMonitor: monitor,
        gracePeriodMs: 0,
      });

      reassigner.start();

      monitor.emit("status:offline", {
        agentId: "agent-old",
        previousStatus: "healthy",
        currentStatus: "offline",
      });

      vi.advanceTimersByTime(0);

      expect(store.reassignTask).toHaveBeenCalledWith(
        "task-1",
        "agent-full",
        "proj-1",
      );

      reassigner.stop();
    });
  });
});
