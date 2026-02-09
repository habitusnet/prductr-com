import { EventEmitter } from "eventemitter3";
import { RingBuffer } from "./utils/ring-buffer.js";
import type { StreamingChunk } from "@conductor/e2b-runner";

export interface ConsoleWatcherConfig {
  bufferSize?: number;
}

export interface AgentConsoleState {
  sandboxId: string;
  agentId: string;
  buffer: RingBuffer<string>;
  lastOutputAt: Date;
  lastHeartbeatAt: Date;
}

interface ConsoleWatcherEvents {
  output: (agentId: string, chunk: StreamingChunk) => void;
  silence: (agentId: string, durationMs: number) => void;
}

export class ConsoleWatcher extends EventEmitter<ConsoleWatcherEvents> {
  private agents: Map<string, AgentConsoleState> = new Map();
  private sandboxToAgent: Map<string, string> = new Map();
  private readonly bufferSize: number;

  constructor(config: ConsoleWatcherConfig = {}) {
    super();
    this.bufferSize = config.bufferSize ?? 1000;
  }

  watch(sandboxId: string, agentId: string): void {
    const state: AgentConsoleState = {
      sandboxId,
      agentId,
      buffer: new RingBuffer<string>(this.bufferSize),
      lastOutputAt: new Date(),
      lastHeartbeatAt: new Date(),
    };
    this.agents.set(agentId, state);
    this.sandboxToAgent.set(sandboxId, agentId);
  }

  unwatch(sandboxId: string): void {
    const agentId = this.sandboxToAgent.get(sandboxId);
    if (agentId) {
      this.agents.delete(agentId);
      this.sandboxToAgent.delete(sandboxId);
    }
  }

  isWatching(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  getAgentState(agentId: string): AgentConsoleState | undefined {
    return this.agents.get(agentId);
  }

  processChunk(agentId: string, chunk: StreamingChunk): void {
    const state = this.agents.get(agentId);
    if (!state) return;

    // Split into lines and buffer
    const lines = chunk.data.split("\n");
    for (const line of lines) {
      if (line.length > 0) {
        state.buffer.push(line);
      }
    }

    state.lastOutputAt = new Date();
    this.emit("output", agentId, chunk);
  }

  updateHeartbeat(agentId: string): void {
    const state = this.agents.get(agentId);
    if (state) {
      state.lastHeartbeatAt = new Date();
    }
  }

  getRecentOutput(agentId: string, lines: number = 100): string {
    const state = this.agents.get(agentId);
    if (!state) return "";
    return state.buffer.getLast(lines).join("\n");
  }

  getWatchedAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  clear(): void {
    this.agents.clear();
    this.sandboxToAgent.clear();
  }
}
