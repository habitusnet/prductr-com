/**
 * Agent State Tracker for Decision Engine
 *
 * Maintains per-agent state for decision-making:
 * - Stuck prompt attempts (for escalation decisions)
 * - Task retry counts (per-task tracking)
 * - Crash restart counts and cooldown timestamps (for restart throttling)
 */

/**
 * Represents the state of a single agent
 */
export interface AgentState {
  /**
   * Number of stuck prompt attempts in current window
   */
  stuckPromptAttempts: number;

  /**
   * Legacy field for backward compatibility (always equals max of taskRetryCounts)
   */
  taskRetryCount: number;

  /**
   * Per-task retry counts, keyed by task ID
   */
  taskRetryCounts: Map<string, number>;

  /**
   * Number of crash restarts for this agent
   */
  crashRestartCount: number;

  /**
   * Timestamp of the last crash, used for cooldown checking
   */
  lastCrashAt?: Date;
}

/**
 * AgentStateTracker manages state for multiple agents
 *
 * Provides methods to:
 * - Track stuck prompt attempts
 * - Track task retries per agent and task
 * - Track agent crashes and cooldown periods
 * - Clear and reset agent state
 */
export class AgentStateTracker {
  private agents: Map<string, AgentState> = new Map();

  /**
   * Get or create state for an agent
   */
  getState(agentId: string): AgentState {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, this.createInitialState());
    }
    return this.agents.get(agentId)!;
  }

  /**
   * Increment stuck prompt attempts and return new count
   */
  incrementStuckAttempts(agentId: string): number {
    const state = this.getState(agentId);
    state.stuckPromptAttempts++;
    return state.stuckPromptAttempts;
  }

  /**
   * Reset stuck prompt attempts to zero
   */
  resetStuckAttempts(agentId: string): void {
    const state = this.getState(agentId);
    state.stuckPromptAttempts = 0;
  }

  /**
   * Increment retry count for a specific task and return new count
   */
  incrementTaskRetry(agentId: string, taskId: string): number {
    const state = this.getState(agentId);
    const current = state.taskRetryCounts.get(taskId) ?? 0;
    const newCount = current + 1;
    state.taskRetryCounts.set(taskId, newCount);
    return newCount;
  }

  /**
   * Reset retry count for a specific task to zero
   */
  resetTaskRetry(agentId: string, taskId: string): void {
    const state = this.getState(agentId);
    state.taskRetryCounts.set(taskId, 0);
  }

  /**
   * Record a crash event: increment count and record timestamp
   */
  recordCrash(agentId: string): void {
    const state = this.getState(agentId);
    state.crashRestartCount++;
    state.lastCrashAt = new Date();
  }

  /**
   * Check if cooldown has elapsed since last crash
   *
   * Returns true if:
   * - No crash has been recorded
   * - Cooldown period has elapsed since last crash
   */
  canRestartAfterCooldown(agentId: string, cooldownMs: number): boolean {
    const state = this.getState(agentId);

    if (!state.lastCrashAt) {
      return true;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - state.lastCrashAt.getTime();
    return elapsedMs >= cooldownMs;
  }

  /**
   * Reset crash count and timestamp
   */
  resetCrashCount(agentId: string): void {
    const state = this.getState(agentId);
    state.crashRestartCount = 0;
    state.lastCrashAt = undefined;
  }

  /**
   * Clear all state for an agent, effectively removing it
   */
  clearAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Create initial state for a new agent
   */
  private createInitialState(): AgentState {
    return {
      stuckPromptAttempts: 0,
      taskRetryCount: 0,
      taskRetryCounts: new Map(),
      crashRestartCount: 0,
      lastCrashAt: undefined,
    };
  }
}
