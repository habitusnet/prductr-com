import { EventEmitter } from "eventemitter3";
import type { DetectionEvent, StuckEvent } from "../types.js";

interface StuckDetectorConfig {
  silenceThresholdMs?: number;
}

interface AgentState {
  sandboxId: string;
  lastActivityAt: Date;
}

interface StuckDetectorEvents {
  detection: (event: DetectionEvent) => void;
}

export class StuckDetector extends EventEmitter<StuckDetectorEvents> {
  readonly name = "stuck";
  private agents: Map<string, AgentState> = new Map();
  private readonly silenceThresholdMs: number;
  private enabled: boolean = true;

  constructor(config: StuckDetectorConfig = {}) {
    super();
    this.silenceThresholdMs = config.silenceThresholdMs ?? 5 * 60 * 1000; // 5 min default
  }

  trackAgent(agentId: string, sandboxId: string): void {
    this.agents.set(agentId, {
      sandboxId,
      lastActivityAt: new Date(),
    });
  }

  untrackAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  recordActivity(agentId: string): void {
    const state = this.agents.get(agentId);
    if (state) {
      state.lastActivityAt = new Date();
    }
  }

  check(): void {
    if (!this.enabled) return;

    const now = Date.now();

    for (const [agentId, state] of this.agents) {
      const silentDurationMs = now - state.lastActivityAt.getTime();

      if (silentDurationMs >= this.silenceThresholdMs) {
        const event: StuckEvent = {
          type: "stuck",
          agentId,
          sandboxId: state.sandboxId,
          timestamp: new Date(),
          silentDurationMs,
        };
        this.emit("detection", event);
      }
    }
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
