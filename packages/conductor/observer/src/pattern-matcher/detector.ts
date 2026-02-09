import { EventEmitter } from "eventemitter3";
import type { DetectionEvent } from "../types.js";

interface DetectorEvents {
  detection: (event: DetectionEvent) => void;
}

export abstract class BaseDetector extends EventEmitter<DetectorEvents> {
  abstract readonly name: string;
  private enabled: boolean = true;

  process(agentId: string, sandboxId: string, line: string): void {
    if (!this.enabled) return;

    const event = this.doProcess(agentId, sandboxId, line);
    if (event) {
      this.emit("detection", event);
    }
  }

  protected abstract doProcess(
    agentId: string,
    sandboxId: string,
    line: string,
  ): DetectionEvent | null;

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
