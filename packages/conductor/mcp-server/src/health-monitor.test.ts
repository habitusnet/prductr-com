import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HealthMonitor } from "./health-monitor.js";
import type { AgentProfile } from "@conductor/core";

function createMockStore(agents: AgentProfile[]) {
  return {
    listAgents: vi.fn().mockReturnValue(agents),
    updateAgentStatus: vi.fn(),
    // Other methods not used by HealthMonitor
  } as any;
}

function makeAgent(
  id: string,
  lastHeartbeat: Date | undefined,
  status: string = "idle",
): AgentProfile {
  return {
    id,
    name: `Agent ${id}`,
    provider: "anthropic",
    model: "claude-opus-4",
    capabilities: ["typescript"],
    costPerToken: { input: 0.01, output: 0.03 },
    status: status as AgentProfile["status"],
    lastHeartbeat,
    metadata: {},
  };
}

describe("HealthMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("health classification", () => {
    it("should classify agents as healthy within threshold", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 30000))]; // 30s ago
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const statuses = monitor.getHealthStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].status).toBe("healthy");
      expect(statuses[0].agentId).toBe("agent-1");
    });

    it("should classify agents as warning after 2 minutes", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 150000))]; // 2.5min
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const statuses = monitor.getHealthStatuses();
      expect(statuses[0].status).toBe("warning");
    });

    it("should classify agents as critical after 5 minutes", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 360000))]; // 6min
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const statuses = monitor.getHealthStatuses();
      expect(statuses[0].status).toBe("critical");
    });

    it("should classify agents as offline after 10 minutes", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 660000))]; // 11min
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const statuses = monitor.getHealthStatuses();
      expect(statuses[0].status).toBe("offline");
    });

    it("should classify agents with no heartbeat as offline", () => {
      const agents = [makeAgent("agent-1", undefined)];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const statuses = monitor.getHealthStatuses();
      expect(statuses[0].status).toBe("offline");
      expect(statuses[0].secondsSinceHeartbeat).toBeNull();
    });

    it("should support custom thresholds", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 60000))]; // 1min
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
        thresholds: { warning: 30, critical: 60, offline: 120 },
      });

      const statuses = monitor.getHealthStatuses();
      expect(statuses[0].status).toBe("critical"); // 60s >= 60s critical
    });
  });

  describe("event emission", () => {
    it("should emit status events on transitions", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 30000))];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const healthyHandler = vi.fn();
      monitor.on("status:healthy", healthyHandler);

      monitor.scan();

      expect(healthyHandler).toHaveBeenCalledTimes(1);
      expect(healthyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "agent-1",
          previousStatus: null,
          currentStatus: "healthy",
        }),
      );
    });

    it("should emit status:offline when transitioning to offline", () => {
      const now = new Date();
      // Start healthy
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 30000))];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const offlineHandler = vi.fn();
      monitor.on("status:offline", offlineHandler);

      // First scan: healthy
      monitor.scan();

      // Now make agent appear offline
      const offlineAgent = makeAgent(
        "agent-1",
        new Date(now.getTime() - 660000),
      );
      store.listAgents.mockReturnValue([offlineAgent]);

      // Second scan: offline
      monitor.scan();

      expect(offlineHandler).toHaveBeenCalledTimes(1);
      expect(offlineHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "agent-1",
          previousStatus: "healthy",
          currentStatus: "offline",
        }),
      );
    });

    it("should not emit event when status unchanged", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 30000))];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const healthyHandler = vi.fn();
      monitor.on("status:healthy", healthyHandler);

      monitor.scan();
      monitor.scan();

      // Only called once on initial transition
      expect(healthyHandler).toHaveBeenCalledTimes(1);
    });

    it("should auto-mark agent as offline in the store", () => {
      const now = new Date();
      const agents = [
        makeAgent("agent-1", new Date(now.getTime() - 660000), "idle"),
      ];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      monitor.scan();

      expect(store.updateAgentStatus).toHaveBeenCalledWith(
        "agent-1",
        "offline",
      );
    });

    it("should not re-mark agent offline if already offline", () => {
      const now = new Date();
      const agents = [
        makeAgent("agent-1", new Date(now.getTime() - 660000), "offline"),
      ];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      monitor.scan();

      // updateAgentStatus should NOT be called since status is already offline
      expect(store.updateAgentStatus).not.toHaveBeenCalled();
    });
  });

  describe("start/stop", () => {
    it("should start periodic scanning", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 30000))];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
        scanIntervalMs: 5000,
      });

      monitor.start();

      // Initial scan happened
      expect(store.listAgents).toHaveBeenCalledTimes(1);

      // Advance timer
      vi.advanceTimersByTime(5000);
      expect(store.listAgents).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(5000);
      expect(store.listAgents).toHaveBeenCalledTimes(3);

      monitor.stop();

      // No more calls after stop
      vi.advanceTimersByTime(5000);
      expect(store.listAgents).toHaveBeenCalledTimes(3);
    });

    it("should not start twice", () => {
      const now = new Date();
      const agents = [makeAgent("agent-1", new Date(now.getTime() - 30000))];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
        scanIntervalMs: 5000,
      });

      monitor.start();
      monitor.start(); // Second call should be no-op

      vi.advanceTimersByTime(5000);
      // Only 2 calls: initial + 1 interval (not 4 from double start)
      expect(store.listAgents).toHaveBeenCalledTimes(2);

      monitor.stop();
    });
  });

  describe("webhook alerts", () => {
    it("should send webhook on critical status", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock;

      const now = new Date();
      const agents = [
        makeAgent("agent-1", new Date(now.getTime() - 360000)),
      ]; // 6min = critical
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
        webhookUrl: "https://hooks.example.com/alert",
      });

      monitor.scan();

      // Wait for async webhook
      await vi.runAllTimersAsync();

      expect(fetchMock).toHaveBeenCalledWith(
        "https://hooks.example.com/alert",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe("agent_health_alert");
      expect(body.agentId).toBe("agent-1");
      expect(body.status).toBe("critical");
    });

    it("should not send webhook without webhookUrl", () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const now = new Date();
      const agents = [
        makeAgent("agent-1", new Date(now.getTime() - 360000)),
      ];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
        // no webhookUrl
      });

      monitor.scan();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("multiple agents", () => {
    it("should track health for multiple agents independently", () => {
      const now = new Date();
      const agents = [
        makeAgent("agent-1", new Date(now.getTime() - 30000)), // healthy
        makeAgent("agent-2", new Date(now.getTime() - 150000)), // warning
        makeAgent("agent-3", new Date(now.getTime() - 360000)), // critical
        makeAgent("agent-4", new Date(now.getTime() - 660000)), // offline
        makeAgent("agent-5", undefined), // offline (no heartbeat)
      ];
      const store = createMockStore(agents);

      const monitor = new HealthMonitor({
        stateStore: store,
        projectId: "proj-1",
      });

      const statuses = monitor.getHealthStatuses();
      expect(statuses).toHaveLength(5);
      expect(statuses.find((s) => s.agentId === "agent-1")!.status).toBe(
        "healthy",
      );
      expect(statuses.find((s) => s.agentId === "agent-2")!.status).toBe(
        "warning",
      );
      expect(statuses.find((s) => s.agentId === "agent-3")!.status).toBe(
        "critical",
      );
      expect(statuses.find((s) => s.agentId === "agent-4")!.status).toBe(
        "offline",
      );
      expect(statuses.find((s) => s.agentId === "agent-5")!.status).toBe(
        "offline",
      );
    });
  });
});
