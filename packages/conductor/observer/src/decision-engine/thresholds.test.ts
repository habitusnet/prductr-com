import { describe, it, expect } from "vitest";
import { DEFAULT_THRESHOLDS, mergeThresholds } from "./thresholds";
import { ThresholdConfig } from "../types";

describe("thresholds", () => {
  describe("DEFAULT_THRESHOLDS", () => {
    it("should export default thresholds with correct stuck values", () => {
      expect(DEFAULT_THRESHOLDS.stuck.promptAfterMs).toBe(5 * 60 * 1000);
      expect(DEFAULT_THRESHOLDS.stuck.escalateAfterAttempts).toBe(2);
    });

    it("should export default thresholds with correct taskFailure values", () => {
      expect(DEFAULT_THRESHOLDS.taskFailure.autoRetryMax).toBe(3);
    });

    it("should export default thresholds with correct agentCrash values", () => {
      expect(DEFAULT_THRESHOLDS.agentCrash.autoRestartMax).toBe(2);
      expect(DEFAULT_THRESHOLDS.agentCrash.cooldownMs).toBe(60 * 1000);
    });

    it("should export default thresholds with correct heartbeat values", () => {
      expect(DEFAULT_THRESHOLDS.heartbeat.timeoutMs).toBe(2 * 60 * 1000);
      expect(DEFAULT_THRESHOLDS.heartbeat.pingBeforeRestart).toBe(true);
    });

    it("should export default thresholds with correct rateLimit values", () => {
      expect(DEFAULT_THRESHOLDS.rateLimit.autoBackoff).toBe(true);
      expect(DEFAULT_THRESHOLDS.rateLimit.maxBackoffMs).toBe(5 * 60 * 1000);
    });
  });

  describe("mergeThresholds", () => {
    it("should return defaults when no overrides provided", () => {
      const result = mergeThresholds();
      expect(result).toEqual(DEFAULT_THRESHOLDS);
    });

    it("should return defaults when undefined overrides provided", () => {
      const result = mergeThresholds(undefined);
      expect(result).toEqual(DEFAULT_THRESHOLDS);
    });

    it("should merge partial overrides with defaults for stuck", () => {
      const result = mergeThresholds({
        stuck: {
          promptAfterMs: 1000,
        },
      });
      expect(result.stuck.promptAfterMs).toBe(1000);
      expect(result.stuck.escalateAfterAttempts).toBe(
        DEFAULT_THRESHOLDS.stuck.escalateAfterAttempts,
      );
    });

    it("should merge partial overrides with defaults for taskFailure", () => {
      const result = mergeThresholds({
        taskFailure: {
          autoRetryMax: 5,
        },
      });
      expect(result.taskFailure.autoRetryMax).toBe(5);
    });

    it("should merge partial overrides with defaults for agentCrash", () => {
      const result = mergeThresholds({
        agentCrash: {
          autoRestartMax: 5,
        },
      });
      expect(result.agentCrash.autoRestartMax).toBe(5);
      expect(result.agentCrash.cooldownMs).toBe(
        DEFAULT_THRESHOLDS.agentCrash.cooldownMs,
      );
    });

    it("should merge partial overrides with defaults for heartbeat", () => {
      const result = mergeThresholds({
        heartbeat: {
          pingBeforeRestart: false,
        },
      });
      expect(result.heartbeat.pingBeforeRestart).toBe(false);
      expect(result.heartbeat.timeoutMs).toBe(
        DEFAULT_THRESHOLDS.heartbeat.timeoutMs,
      );
    });

    it("should merge partial overrides with defaults for rateLimit", () => {
      const result = mergeThresholds({
        rateLimit: {
          autoBackoff: false,
        },
      });
      expect(result.rateLimit.autoBackoff).toBe(false);
      expect(result.rateLimit.maxBackoffMs).toBe(
        DEFAULT_THRESHOLDS.rateLimit.maxBackoffMs,
      );
    });

    it("should deep merge multiple partial overrides", () => {
      const result = mergeThresholds({
        stuck: {
          promptAfterMs: 10000,
          escalateAfterAttempts: 5,
        },
        taskFailure: {
          autoRetryMax: 10,
        },
        heartbeat: {
          timeoutMs: 5000,
        },
      });

      expect(result.stuck.promptAfterMs).toBe(10000);
      expect(result.stuck.escalateAfterAttempts).toBe(5);
      expect(result.taskFailure.autoRetryMax).toBe(10);
      expect(result.heartbeat.timeoutMs).toBe(5000);
      expect(result.heartbeat.pingBeforeRestart).toBe(
        DEFAULT_THRESHOLDS.heartbeat.pingBeforeRestart,
      );
      expect(result.agentCrash).toEqual(DEFAULT_THRESHOLDS.agentCrash);
      expect(result.rateLimit).toEqual(DEFAULT_THRESHOLDS.rateLimit);
    });

    it("should return complete ThresholdConfig object", () => {
      const result = mergeThresholds({
        stuck: {
          promptAfterMs: 1000,
        },
      });

      // Verify structure matches ThresholdConfig
      expect(result).toHaveProperty("stuck");
      expect(result).toHaveProperty("taskFailure");
      expect(result).toHaveProperty("agentCrash");
      expect(result).toHaveProperty("heartbeat");
      expect(result).toHaveProperty("rateLimit");

      // Verify all nested properties exist
      expect(result.stuck).toHaveProperty("promptAfterMs");
      expect(result.stuck).toHaveProperty("escalateAfterAttempts");
      expect(result.taskFailure).toHaveProperty("autoRetryMax");
      expect(result.agentCrash).toHaveProperty("autoRestartMax");
      expect(result.agentCrash).toHaveProperty("cooldownMs");
      expect(result.heartbeat).toHaveProperty("timeoutMs");
      expect(result.heartbeat).toHaveProperty("pingBeforeRestart");
      expect(result.rateLimit).toHaveProperty("autoBackoff");
      expect(result.rateLimit).toHaveProperty("maxBackoffMs");
    });
  });
});
