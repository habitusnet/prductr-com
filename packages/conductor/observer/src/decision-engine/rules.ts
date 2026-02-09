import {
  Decision,
  DetectionEvent,
  StuckEvent,
  CrashEvent,
  AuthRequiredEvent,
  TestFailureEvent,
  BuildFailureEvent,
  RateLimitedEvent,
  ErrorEvent,
  GitConflictEvent,
  HeartbeatTimeoutEvent,
  ContextExhaustionEvent,
} from "../types.js";
import { ThresholdConfig } from "../types.js";
import { AgentStateTracker } from "./agent-state.js";
import { AutonomyLevel, canActAutonomously } from "./autonomy.js";

/**
 * DecisionRules engine maps detection events to decisions
 *
 * Implements threshold-based decision logic for:
 * - Autonomous actions: prompt_agent, restart_agent, retry_task, pause_agent, etc.
 * - Escalations: critical, high, or normal priority
 *
 * Respects autonomy levels by converting autonomous actions to escalations
 * when the action is not permitted at the current level.
 */
export class DecisionRules {
  constructor(
    private thresholds: ThresholdConfig,
    private stateTracker: AgentStateTracker,
    private autonomyLevel: AutonomyLevel,
  ) {}

  /**
   * Make a decision based on a detection event
   *
   * Decision logic by event type:
   * - stuck: escalate after N attempts
   * - crash: auto-restart with cooldown checking
   * - auth_required: always escalate critical
   * - test_failure: auto-retry up to limit
   * - build_failure: prompt agent
   * - rate_limited: backoff if enabled
   * - error: escalate if fatal, otherwise prompt
   * - git_conflict: escalate normal
   * - heartbeat_timeout: ping or restart based on config
   *
   * After determining decision, autonomy level restrictions are applied.
   * If an autonomous action is not permitted at the current autonomy level,
   * it's converted to an escalation instead.
   */
  decide(event: DetectionEvent): Decision {
    let decision: Decision;

    switch (event.type) {
      case "stuck":
        decision = this.decideStuck(event);
        break;
      case "crash":
        decision = this.decideCrash(event);
        break;
      case "auth_required":
        decision = this.decideAuthRequired(event);
        break;
      case "test_failure":
        decision = this.decideTestFailure(event);
        break;
      case "build_failure":
        decision = this.decideBuildFailure(event);
        break;
      case "rate_limited":
        decision = this.decideRateLimited(event);
        break;
      case "error":
        decision = this.decideError(event);
        break;
      case "git_conflict":
        decision = this.decideGitConflict(event);
        break;
      case "heartbeat_timeout":
        decision = this.decideHeartbeatTimeout(event);
        break;
      case "context_exhaustion":
        decision = this.decideContextExhaustion(event);
        break;
      default:
        const _exhaustive: never = event;
        throw new Error(`Unknown event type: ${_exhaustive}`);
    }

    // Apply autonomy level restrictions
    if (
      decision.action === "autonomous" &&
      !canActAutonomously(this.autonomyLevel, decision.actionType)
    ) {
      return {
        action: "escalate",
        priority: "high",
        reason: `Action ${decision.actionType} not permitted at ${this.autonomyLevel} autonomy level`,
      };
    }

    return decision;
  }

  /**
   * Stuck event: agent appears to be inactive
   *
   * - Increment stuck attempts
   * - If attempts <= threshold: autonomous prompt
   * - Else: escalate high
   */
  private decideStuck(event: StuckEvent): Decision {
    const attempts = this.stateTracker.incrementStuckAttempts(event.agentId);

    if (attempts <= this.thresholds.stuck.escalateAfterAttempts) {
      return {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: `Agent stuck for ${event.silentDurationMs}ms (attempt ${attempts}/${this.thresholds.stuck.escalateAfterAttempts})`,
      };
    }

    return {
      action: "escalate",
      priority: "high",
      reason: `Agent stuck after ${attempts} prompt attempts`,
    };
  }

  /**
   * Crash event: agent process exited unexpectedly
   *
   * - Check if restart is allowed (cooldown passed and limit not exceeded)
   * - Record crash in state
   * - If allowed: autonomous restart
   * - Else: escalate high
   */
  private decideCrash(event: CrashEvent): Decision {
    const state = this.stateTracker.getState(event.agentId);

    // Check if we can restart BEFORE recording (so first crash always allows restart)
    const cooldownPassed = this.stateTracker.canRestartAfterCooldown(
      event.agentId,
      this.thresholds.agentCrash.cooldownMs,
    );
    const countAllows =
      state.crashRestartCount < this.thresholds.agentCrash.autoRestartMax;

    // Record the crash
    this.stateTracker.recordCrash(event.agentId);
    const updatedState = this.stateTracker.getState(event.agentId);

    if (cooldownPassed && countAllows) {
      return {
        action: "autonomous",
        actionType: "restart_agent",
        reason: `Agent crashed with exit code ${event.exitCode} (restart ${updatedState.crashRestartCount}/${this.thresholds.agentCrash.autoRestartMax})`,
      };
    }

    return {
      action: "escalate",
      priority: "high",
      reason: `Agent crash limit exceeded (${updatedState.crashRestartCount} restarts) or cooldown active`,
    };
  }

  /**
   * Auth required event: OAuth or authentication needed
   *
   * ALWAYS escalate critical - humans must handle OAuth
   */
  private decideAuthRequired(event: AuthRequiredEvent): Decision {
    return {
      action: "escalate",
      priority: "critical",
      reason: `Authentication required for ${event.provider}. Humans must handle OAuth.`,
    };
  }

  /**
   * Test failure event: tests failed during execution
   *
   * - Increment task retry
   * - If retries <= limit: autonomous retry
   * - Else: escalate normal
   */
  private decideTestFailure(event: TestFailureEvent): Decision {
    // Use a consistent task ID per agent for test failures
    const taskId = `test-task-${event.agentId}`;
    const retries = this.stateTracker.incrementTaskRetry(event.agentId, taskId);

    if (retries <= this.thresholds.taskFailure.autoRetryMax) {
      return {
        action: "autonomous",
        actionType: "retry_task",
        reason: `Test failure with ${event.failedTests} failed tests (retry ${retries}/${this.thresholds.taskFailure.autoRetryMax})`,
      };
    }

    return {
      action: "escalate",
      priority: "normal",
      reason: `Test failures exceed retry limit (${retries} retries)`,
    };
  }

  /**
   * Build failure event: build process failed
   *
   * Return autonomous prompt - let agent attempt recovery
   */
  private decideBuildFailure(event: BuildFailureEvent): Decision {
    return {
      action: "autonomous",
      actionType: "prompt_agent",
      reason: `Build failure detected. Prompting agent to investigate.`,
    };
  }

  /**
   * Rate limit event: API rate limit hit
   *
   * - If autoBackoff enabled: autonomous pause
   * - Else: escalate normal
   */
  private decideRateLimited(event: RateLimitedEvent): Decision {
    if (this.thresholds.rateLimit.autoBackoff) {
      return {
        action: "autonomous",
        actionType: "pause_agent",
        reason: `Rate limit hit on ${event.provider}. Pausing agent for backoff.`,
      };
    }

    return {
      action: "escalate",
      priority: "normal",
      reason: `Rate limit hit on ${event.provider}`,
    };
  }

  /**
   * Error event: runtime error occurred
   *
   * - If severity === 'fatal': escalate critical
   * - Else: autonomous prompt
   */
  private decideError(event: ErrorEvent): Decision {
    const severity = event.severity;

    if (severity === "fatal") {
      return {
        action: "escalate",
        priority: "critical",
        reason: `Fatal error: ${event.message}`,
      };
    }

    return {
      action: "autonomous",
      actionType: "prompt_agent",
      reason: `${severity === "warning" ? "Warning" : "Error"}: ${event.message}`,
    };
  }

  /**
   * Git conflict event: merge conflict detected
   *
   * ALWAYS escalate normal - humans must resolve conflicts
   */
  private decideGitConflict(event: GitConflictEvent): Decision {
    return {
      action: "escalate",
      priority: "normal",
      reason: `Git conflict in files: ${event.files.join(", ")}`,
    };
  }

  /**
   * Heartbeat timeout event: agent missed heartbeat
   *
   * - If pingBeforeRestart: autonomous prompt
   * - Else: autonomous restart
   */
  private decideHeartbeatTimeout(event: HeartbeatTimeoutEvent): Decision {
    if (this.thresholds.heartbeat.pingBeforeRestart) {
      return {
        action: "autonomous",
        actionType: "prompt_agent",
        reason: `Heartbeat timeout. Pinging agent before restart.`,
      };
    }

    return {
      action: "autonomous",
      actionType: "restart_agent",
      reason: `Heartbeat timeout. Restarting agent.`,
    };
  }

  /**
   * Context exhaustion event: agent approaching or at context limit
   *
   * - At >90% usage: autonomous save_checkpoint_and_pause
   * - This preserves work state and allows a new session to resume
   */
  private decideContextExhaustion(event: ContextExhaustionEvent): Decision {
    return {
      action: "autonomous",
      actionType: "save_checkpoint_and_pause",
      reason: `Context exhaustion at ${event.usagePercent.toFixed(1)}% (${event.tokenCount}/${event.tokenLimit} tokens). Saving checkpoint and pausing.`,
    };
  }
}
