import { BaseDetector } from "./detector.js";
import type { DetectionEvent, ContextExhaustionEvent } from "../types.js";

/**
 * Detects context window exhaustion signals in agent console output.
 *
 * Patterns detected:
 * - Explicit "context limit" / "token budget" messages
 * - Context window capacity warnings
 * - Model-specific truncation signals
 */
export class ContextExhaustionDetector extends BaseDetector {
  readonly name = "context_exhaustion";

  private readonly exhaustionPatterns = [
    /context (?:window |limit |length )(?:reached|exceeded|full|exhausted)/i,
    /token (?:budget|limit|count) (?:reached|exceeded|exhausted)/i,
    /maximum context length/i,
    /context.*truncat/i,
    /running out of context/i,
    /context.*capacity/i,
    /token limit.*\d+/i,
    /\bcontext_length_exceeded\b/i,
    /max_tokens_exceeded/i,
    /conversation.*too long/i,
  ];

  protected doProcess(
    agentId: string,
    sandboxId: string,
    line: string,
  ): DetectionEvent | null {
    for (const pattern of this.exhaustionPatterns) {
      if (pattern.test(line)) {
        return this.createEvent(agentId, sandboxId, line);
      }
    }

    return null;
  }

  private createEvent(
    agentId: string,
    sandboxId: string,
    _message: string,
  ): ContextExhaustionEvent {
    return {
      type: "context_exhaustion",
      agentId,
      sandboxId,
      timestamp: new Date(),
      tokenCount: 0, // Will be enriched by decision engine from agent state
      tokenLimit: 0,
      usagePercent: 100, // Console pattern implies exhaustion
    };
  }
}
