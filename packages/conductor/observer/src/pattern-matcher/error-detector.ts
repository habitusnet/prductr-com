import { BaseDetector } from "./detector.js";
import type { DetectionEvent, ErrorEvent } from "../types.js";

export class ErrorDetector extends BaseDetector {
  readonly name = "error";

  private readonly fatalPatterns = [
    /\bFATAL\b/i,
    /\bPANIC\b/i,
    /\bCRITICAL\b/i,
  ];

  private readonly errorPatterns = [
    /\bError:/i,
    /\bException:/i,
    /\b\w+Error:/,
    /\b\w+Exception:/,
    /\bfailed\b.*\berror\b/i,
    /\berror\b.*\bfailed\b/i,
  ];

  private readonly warningPatterns = [
    /\bWarning:/i,
    /\bWARN\b/i,
    /\bDeprecated\b/i,
  ];

  protected doProcess(
    agentId: string,
    sandboxId: string,
    line: string,
  ): DetectionEvent | null {
    // Check fatal first (highest priority)
    for (const pattern of this.fatalPatterns) {
      if (pattern.test(line)) {
        return this.createEvent(agentId, sandboxId, line, "fatal");
      }
    }

    // Check error patterns
    for (const pattern of this.errorPatterns) {
      if (pattern.test(line)) {
        return this.createEvent(agentId, sandboxId, line, "error");
      }
    }

    // Check warning patterns
    for (const pattern of this.warningPatterns) {
      if (pattern.test(line)) {
        return this.createEvent(agentId, sandboxId, line, "warning");
      }
    }

    return null;
  }

  private createEvent(
    agentId: string,
    sandboxId: string,
    message: string,
    severity: "warning" | "error" | "fatal",
  ): ErrorEvent {
    return {
      type: "error",
      agentId,
      sandboxId,
      timestamp: new Date(),
      message,
      severity,
    };
  }
}
