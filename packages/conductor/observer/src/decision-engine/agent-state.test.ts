import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AgentStateTracker, AgentState } from "./agent-state";

describe("AgentStateTracker", () => {
  let tracker: AgentStateTracker;

  beforeEach(() => {
    tracker = new AgentStateTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getState", () => {
    it("should return initial state for new agent", () => {
      const state = tracker.getState("agent-1");

      expect(state).toEqual({
        stuckPromptAttempts: 0,
        taskRetryCount: 0,
        taskRetryCounts: new Map(),
        crashRestartCount: 0,
        lastCrashAt: undefined,
      });
    });

    it("should return same state instance on subsequent calls", () => {
      const state1 = tracker.getState("agent-1");
      const state2 = tracker.getState("agent-1");

      expect(state1).toBe(state2);
    });

    it("should return different state for different agents", () => {
      const state1 = tracker.getState("agent-1");
      const state2 = tracker.getState("agent-2");

      expect(state1).not.toBe(state2);
    });
  });

  describe("incrementStuckAttempts", () => {
    it("should increment stuck attempts from 0 to 1", () => {
      const count = tracker.incrementStuckAttempts("agent-1");

      expect(count).toBe(1);
      expect(tracker.getState("agent-1").stuckPromptAttempts).toBe(1);
    });

    it("should increment stuck attempts multiple times", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-1");
      const count = tracker.incrementStuckAttempts("agent-1");

      expect(count).toBe(3);
      expect(tracker.getState("agent-1").stuckPromptAttempts).toBe(3);
    });

    it("should return new count each time", () => {
      const count1 = tracker.incrementStuckAttempts("agent-1");
      const count2 = tracker.incrementStuckAttempts("agent-1");
      const count3 = tracker.incrementStuckAttempts("agent-1");

      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
    });

    it("should track separate counts for different agents", () => {
      const count1 = tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-1");
      const count2 = tracker.incrementStuckAttempts("agent-2");

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(tracker.getState("agent-1").stuckPromptAttempts).toBe(2);
      expect(tracker.getState("agent-2").stuckPromptAttempts).toBe(1);
    });
  });

  describe("resetStuckAttempts", () => {
    it("should reset stuck attempts to zero", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-1");
      tracker.resetStuckAttempts("agent-1");

      expect(tracker.getState("agent-1").stuckPromptAttempts).toBe(0);
    });

    it("should reset only the specified agent", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-2");

      tracker.resetStuckAttempts("agent-1");

      expect(tracker.getState("agent-1").stuckPromptAttempts).toBe(0);
      expect(tracker.getState("agent-2").stuckPromptAttempts).toBe(1);
    });

    it("should be safe to reset non-existent agent", () => {
      tracker.resetStuckAttempts("agent-1");

      expect(tracker.getState("agent-1").stuckPromptAttempts).toBe(0);
    });
  });

  describe("incrementTaskRetry", () => {
    it("should increment task retry count for specific task", () => {
      const count = tracker.incrementTaskRetry("agent-1", "task-1");

      expect(count).toBe(1);
      expect(tracker.getState("agent-1").taskRetryCounts.get("task-1")).toBe(1);
    });

    it("should increment different task retries independently", () => {
      const count1 = tracker.incrementTaskRetry("agent-1", "task-1");
      const count2 = tracker.incrementTaskRetry("agent-1", "task-2");
      const count3 = tracker.incrementTaskRetry("agent-1", "task-1");

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(2);
      expect(tracker.getState("agent-1").taskRetryCounts.get("task-1")).toBe(2);
      expect(tracker.getState("agent-1").taskRetryCounts.get("task-2")).toBe(1);
    });

    it("should track retries per agent and task", () => {
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-2", "task-1");

      expect(tracker.getState("agent-1").taskRetryCounts.get("task-1")).toBe(2);
      expect(tracker.getState("agent-2").taskRetryCounts.get("task-1")).toBe(1);
    });
  });

  describe("resetTaskRetry", () => {
    it("should reset specific task retry count to zero", () => {
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.resetTaskRetry("agent-1", "task-1");

      expect(tracker.getState("agent-1").taskRetryCounts.get("task-1")).toBe(0);
    });

    it("should reset only the specified task", () => {
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-1", "task-2");

      tracker.resetTaskRetry("agent-1", "task-1");

      expect(tracker.getState("agent-1").taskRetryCounts.get("task-1")).toBe(0);
      expect(tracker.getState("agent-1").taskRetryCounts.get("task-2")).toBe(1);
    });

    it("should reset only the specified agent and task", () => {
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-2", "task-1");

      tracker.resetTaskRetry("agent-1", "task-1");

      expect(tracker.getState("agent-1").taskRetryCounts.get("task-1")).toBe(0);
      expect(tracker.getState("agent-2").taskRetryCounts.get("task-1")).toBe(1);
    });

    it("should be safe to reset non-existent task", () => {
      tracker.resetTaskRetry("agent-1", "task-1");

      expect(tracker.getState("agent-1").taskRetryCounts.get("task-1")).toBe(0);
    });
  });

  describe("recordCrash", () => {
    it("should increment crash count and record timestamp", () => {
      vi.useFakeTimers();
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      tracker.recordCrash("agent-1");

      const state = tracker.getState("agent-1");
      expect(state.crashRestartCount).toBe(1);
      expect(state.lastCrashAt).toEqual(now);

      vi.useRealTimers();
    });

    it("should increment crash count on multiple crashes", () => {
      vi.useFakeTimers();
      const time1 = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(time1);
      tracker.recordCrash("agent-1");

      const time2 = new Date("2024-01-01T12:01:00Z");
      vi.setSystemTime(time2);
      tracker.recordCrash("agent-1");

      const state = tracker.getState("agent-1");
      expect(state.crashRestartCount).toBe(2);
      expect(state.lastCrashAt).toEqual(time2);

      vi.useRealTimers();
    });

    it("should track crashes per agent independently", () => {
      vi.useFakeTimers();
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      tracker.recordCrash("agent-1");
      tracker.recordCrash("agent-2");
      tracker.recordCrash("agent-1");

      expect(tracker.getState("agent-1").crashRestartCount).toBe(2);
      expect(tracker.getState("agent-2").crashRestartCount).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("canRestartAfterCooldown", () => {
    it("should return true when no crash recorded", () => {
      const canRestart = tracker.canRestartAfterCooldown("agent-1", 1000);

      expect(canRestart).toBe(true);
    });

    it("should return false when cooldown not elapsed", () => {
      vi.useFakeTimers();
      const time1 = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(time1);

      tracker.recordCrash("agent-1");

      const time2 = new Date("2024-01-01T12:00:00.500Z");
      vi.setSystemTime(time2);

      const canRestart = tracker.canRestartAfterCooldown("agent-1", 1000);
      expect(canRestart).toBe(false);

      vi.useRealTimers();
    });

    it("should return true when cooldown elapsed", () => {
      vi.useFakeTimers();
      const time1 = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(time1);

      tracker.recordCrash("agent-1");

      const time2 = new Date("2024-01-01T12:00:01Z");
      vi.setSystemTime(time2);

      const canRestart = tracker.canRestartAfterCooldown("agent-1", 1000);
      expect(canRestart).toBe(true);

      vi.useRealTimers();
    });

    it("should check at exact cooldown boundary", () => {
      vi.useFakeTimers();
      const time1 = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(time1);

      tracker.recordCrash("agent-1");

      const time2 = new Date("2024-01-01T12:00:01Z");
      vi.setSystemTime(time2);

      const canRestart = tracker.canRestartAfterCooldown("agent-1", 1000);
      expect(canRestart).toBe(true);

      vi.useRealTimers();
    });

    it("should track cooldowns per agent independently", () => {
      vi.useFakeTimers();
      const time1 = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(time1);

      tracker.recordCrash("agent-1");
      tracker.recordCrash("agent-2");

      const time2 = new Date("2024-01-01T12:00:00.500Z");
      vi.setSystemTime(time2);

      tracker.recordCrash("agent-1");

      const time3 = new Date("2024-01-01T12:00:01.500Z");
      vi.setSystemTime(time3);

      expect(tracker.canRestartAfterCooldown("agent-1", 1000)).toBe(true);
      expect(tracker.canRestartAfterCooldown("agent-2", 1000)).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("resetCrashCount", () => {
    it("should reset crash count and timestamp", () => {
      vi.useFakeTimers();
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      tracker.recordCrash("agent-1");
      tracker.resetCrashCount("agent-1");

      const state = tracker.getState("agent-1");
      expect(state.crashRestartCount).toBe(0);
      expect(state.lastCrashAt).toBeUndefined();

      vi.useRealTimers();
    });

    it("should reset only specified agent", () => {
      vi.useFakeTimers();
      const now = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(now);

      tracker.recordCrash("agent-1");
      tracker.recordCrash("agent-2");
      tracker.resetCrashCount("agent-1");

      expect(tracker.getState("agent-1").crashRestartCount).toBe(0);
      expect(tracker.getState("agent-1").lastCrashAt).toBeUndefined();
      expect(tracker.getState("agent-2").crashRestartCount).toBe(1);
      expect(tracker.getState("agent-2").lastCrashAt).toEqual(now);

      vi.useRealTimers();
    });

    it("should be safe to reset agent with no crashes", () => {
      tracker.resetCrashCount("agent-1");

      const state = tracker.getState("agent-1");
      expect(state.crashRestartCount).toBe(0);
      expect(state.lastCrashAt).toBeUndefined();
    });
  });

  describe("clearAgent", () => {
    it("should remove all state for agent", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.recordCrash("agent-1");

      tracker.clearAgent("agent-1");

      const state = tracker.getState("agent-1");
      expect(state).toEqual({
        stuckPromptAttempts: 0,
        taskRetryCount: 0,
        taskRetryCounts: new Map(),
        crashRestartCount: 0,
        lastCrashAt: undefined,
      });
    });

    it("should not affect other agents", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-2");
      tracker.incrementStuckAttempts("agent-2");

      tracker.clearAgent("agent-1");

      expect(tracker.getState("agent-1").stuckPromptAttempts).toBe(0);
      expect(tracker.getState("agent-2").stuckPromptAttempts).toBe(2);
    });

    it("should be safe to clear agent with minimal state", () => {
      tracker.clearAgent("agent-1");

      const state = tracker.getState("agent-1");
      expect(state).toEqual({
        stuckPromptAttempts: 0,
        taskRetryCount: 0,
        taskRetryCounts: new Map(),
        crashRestartCount: 0,
        lastCrashAt: undefined,
      });
    });
  });

  describe("integration scenarios", () => {
    it("should track multiple failure modes per agent", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.recordCrash("agent-1");

      const state = tracker.getState("agent-1");
      expect(state.stuckPromptAttempts).toBe(2);
      expect(state.taskRetryCounts.get("task-1")).toBe(2);
      expect(state.crashRestartCount).toBe(1);
    });

    it("should handle partial reset of agent state", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.recordCrash("agent-1");

      tracker.resetStuckAttempts("agent-1");

      const state = tracker.getState("agent-1");
      expect(state.stuckPromptAttempts).toBe(0);
      expect(state.taskRetryCounts.get("task-1")).toBe(1);
      expect(state.crashRestartCount).toBe(1);
    });

    it("should reset entire agent state effectively", () => {
      tracker.incrementStuckAttempts("agent-1");
      tracker.incrementTaskRetry("agent-1", "task-1");
      tracker.incrementTaskRetry("agent-1", "task-2");
      tracker.recordCrash("agent-1");

      tracker.clearAgent("agent-1");
      const state = tracker.getState("agent-1");

      expect(state.stuckPromptAttempts).toBe(0);
      expect(state.taskRetryCounts.size).toBe(0);
      expect(state.crashRestartCount).toBe(0);
      expect(state.lastCrashAt).toBeUndefined();
    });
  });
});
