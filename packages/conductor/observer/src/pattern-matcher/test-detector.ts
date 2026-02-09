import { BaseDetector } from "./detector.js";
import type { DetectionEvent, TestFailureEvent } from "../types.js";

export class TestDetector extends BaseDetector {
  readonly name = "test";

  private readonly failurePatterns: Array<{
    pattern: RegExp;
    extractCount?: (match: RegExpMatchArray) => number;
  }> = [
    // Vitest/Jest FAIL marker
    { pattern: /^\s*FAIL\s+/i },
    // Jest summary: "Tests: 3 failed, 10 passed"
    {
      pattern: /Tests:\s*(\d+)\s*failed/i,
      extractCount: (m) => parseInt(m[1]!, 10),
    },
    // Pytest: "=== 2 failed, 5 passed ==="
    {
      pattern: /===?\s*(\d+)\s*failed/i,
      extractCount: (m) => parseInt(m[1]!, 10),
    },
    // Generic X test(s) failed
    {
      pattern: /(\d+)\s*tests?\s*failed/i,
      extractCount: (m) => parseInt(m[1]!, 10),
    },
    // Vitest ✗ marker
    { pattern: /^\s*[✗×]\s+/ },
  ];

  protected doProcess(
    agentId: string,
    sandboxId: string,
    line: string,
  ): DetectionEvent | null {
    for (const { pattern, extractCount } of this.failurePatterns) {
      const match = line.match(pattern);
      if (match) {
        const failedTests = extractCount ? extractCount(match) : 1;

        const event: TestFailureEvent = {
          type: "test_failure",
          agentId,
          sandboxId,
          timestamp: new Date(),
          failedTests,
          output: line,
        };
        return event;
      }
    }

    return null;
  }
}
