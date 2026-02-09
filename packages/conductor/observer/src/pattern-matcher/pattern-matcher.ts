import { EventEmitter } from "eventemitter3";
import { ErrorDetector } from "./error-detector.js";
import { AuthDetector } from "./auth-detector.js";
import { TestDetector } from "./test-detector.js";
import { ContextExhaustionDetector } from "./context-exhaustion-detector.js";
import { BaseDetector } from "./detector.js";
import type { DetectionEvent } from "../types.js";

interface PatternMatcherEvents {
  detection: (event: DetectionEvent) => void;
}

export class PatternMatcher extends EventEmitter<PatternMatcherEvents> {
  private detectors: Map<string, BaseDetector> = new Map();

  constructor() {
    super();
    this.registerDefaultDetectors();
  }

  private registerDefaultDetectors(): void {
    const detectors = [
      new ErrorDetector(),
      new AuthDetector(),
      new TestDetector(),
      new ContextExhaustionDetector(),
    ];

    for (const detector of detectors) {
      this.detectors.set(detector.name, detector);
      detector.on("detection", (event) => {
        this.emit("detection", event);
      });
    }
  }

  processLine(agentId: string, sandboxId: string, line: string): void {
    for (const detector of this.detectors.values()) {
      if (detector.isEnabled()) {
        detector.process(agentId, sandboxId, line);
      }
    }
  }

  processOutput(agentId: string, sandboxId: string, output: string): void {
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.trim()) {
        this.processLine(agentId, sandboxId, line);
      }
    }
  }

  enableDetector(name: string): void {
    const detector = this.detectors.get(name);
    if (!detector) {
      throw new Error(`Detector '${name}' not found`);
    }
    detector.enable();
  }

  disableDetector(name: string): void {
    const detector = this.detectors.get(name);
    if (!detector) {
      throw new Error(`Detector '${name}' not found`);
    }
    detector.disable();
  }

  getDetector(name: string): BaseDetector | undefined {
    return this.detectors.get(name);
  }

  listDetectors(): string[] {
    return Array.from(this.detectors.keys());
  }

  dispose(): void {
    for (const detector of this.detectors.values()) {
      detector.removeAllListeners("detection");
    }
    this.removeAllListeners();
    this.detectors.clear();
  }
}
