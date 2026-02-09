import { ThresholdConfig } from "../types.js";

/**
 * Default threshold configuration for the Decision Engine
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  stuck: {
    promptAfterMs: 5 * 60 * 1000, // 5 minutes
    escalateAfterAttempts: 2,
  },
  taskFailure: {
    autoRetryMax: 3,
  },
  agentCrash: {
    autoRestartMax: 2,
    cooldownMs: 60 * 1000, // 1 minute
  },
  heartbeat: {
    timeoutMs: 2 * 60 * 1000, // 2 minutes
    pingBeforeRestart: true,
  },
  rateLimit: {
    autoBackoff: true,
    maxBackoffMs: 5 * 60 * 1000, // 5 minutes
  },
};

/**
 * Merges partial threshold overrides with default thresholds
 * Performs a deep merge, preserving unspecified fields from defaults
 */
export function mergeThresholds(
  overrides?: Partial<ThresholdConfig>,
): ThresholdConfig {
  if (!overrides) {
    return { ...DEFAULT_THRESHOLDS };
  }

  return {
    stuck: {
      promptAfterMs:
        overrides.stuck?.promptAfterMs ??
        DEFAULT_THRESHOLDS.stuck.promptAfterMs,
      escalateAfterAttempts:
        overrides.stuck?.escalateAfterAttempts ??
        DEFAULT_THRESHOLDS.stuck.escalateAfterAttempts,
    },
    taskFailure: {
      autoRetryMax:
        overrides.taskFailure?.autoRetryMax ??
        DEFAULT_THRESHOLDS.taskFailure.autoRetryMax,
    },
    agentCrash: {
      autoRestartMax:
        overrides.agentCrash?.autoRestartMax ??
        DEFAULT_THRESHOLDS.agentCrash.autoRestartMax,
      cooldownMs:
        overrides.agentCrash?.cooldownMs ??
        DEFAULT_THRESHOLDS.agentCrash.cooldownMs,
    },
    heartbeat: {
      timeoutMs:
        overrides.heartbeat?.timeoutMs ??
        DEFAULT_THRESHOLDS.heartbeat.timeoutMs,
      pingBeforeRestart:
        overrides.heartbeat?.pingBeforeRestart ??
        DEFAULT_THRESHOLDS.heartbeat.pingBeforeRestart,
    },
    rateLimit: {
      autoBackoff:
        overrides.rateLimit?.autoBackoff ??
        DEFAULT_THRESHOLDS.rateLimit.autoBackoff,
      maxBackoffMs:
        overrides.rateLimit?.maxBackoffMs ??
        DEFAULT_THRESHOLDS.rateLimit.maxBackoffMs,
    },
  };
}
