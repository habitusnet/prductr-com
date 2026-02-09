import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsoleWatcher } from "./console-watcher.js";
import type { StreamingChunk } from "@conductor/e2b-runner";

describe("ConsoleWatcher", () => {
  let watcher: ConsoleWatcher;

  beforeEach(() => {
    watcher = new ConsoleWatcher({ bufferSize: 100 });
  });

  it("should track watched agents", () => {
    watcher.watch("sandbox-1", "agent-1");
    expect(watcher.isWatching("agent-1")).toBe(true);
    expect(watcher.isWatching("agent-2")).toBe(false);
  });

  it("should stop watching agents", () => {
    watcher.watch("sandbox-1", "agent-1");
    watcher.unwatch("sandbox-1");
    expect(watcher.isWatching("agent-1")).toBe(false);
  });

  it("should buffer console output", () => {
    watcher.watch("sandbox-1", "agent-1");
    watcher.processChunk("agent-1", {
      type: "stdout",
      data: "line 1\nline 2\n",
      timestamp: new Date(),
    });
    const output = watcher.getRecentOutput("agent-1", 10);
    expect(output).toContain("line 1");
    expect(output).toContain("line 2");
  });

  it("should update lastOutputAt timestamp", () => {
    watcher.watch("sandbox-1", "agent-1");
    const before = new Date();
    watcher.processChunk("agent-1", {
      type: "stdout",
      data: "test",
      timestamp: new Date(),
    });
    const state = watcher.getAgentState("agent-1");
    expect(state?.lastOutputAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
  });

  it("should emit output events", () => {
    const handler = vi.fn();
    watcher.on("output", handler);
    watcher.watch("sandbox-1", "agent-1");
    watcher.processChunk("agent-1", {
      type: "stdout",
      data: "test output",
      timestamp: new Date(),
    });
    expect(handler).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({ data: "test output" }),
    );
  });
});
