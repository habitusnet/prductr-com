import { EventEmitter } from "events";
import type { SQLiteStateStore } from "@conductor/state";
import type { Task } from "@conductor/core";
import {
  findBestAgent,
  extractRequiredCapabilities,
} from "@conductor/core";
import type { HealthMonitor } from "./health-monitor.js";

export interface TaskReassignerOptions {
  stateStore: SQLiteStateStore;
  projectId: string;
  healthMonitor: HealthMonitor;
  /** Grace period in ms before reassignment (default: 300000 = 5 min) */
  gracePeriodMs?: number;
  /** Maximum reassignments per task (default: 3) */
  maxReassignments?: number;
}

interface PendingReassignment {
  taskId: string;
  offlineAgentId: string;
  detectedAt: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Automatically reassigns tasks from offline agents to available agents.
 * Listens to HealthMonitor 'status:offline' events, waits a grace period,
 * then finds the best available agent and reassigns.
 *
 * Emits events:
 *   'reassignment': { taskId, fromAgent, toAgent, task }
 *   'reassignment:failed': { taskId, fromAgent, reason }
 *   'reassignment:max-reached': { taskId, fromAgent, count }
 */
export class TaskReassigner extends EventEmitter {
  private stateStore: SQLiteStateStore;
  private projectId: string;
  private healthMonitor: HealthMonitor;
  private gracePeriodMs: number;
  private maxReassignments: number;
  private pendingReassignments: Map<string, PendingReassignment> = new Map();
  private offlineHandler: ((event: any) => void) | null = null;

  constructor(options: TaskReassignerOptions) {
    super();
    this.stateStore = options.stateStore;
    this.projectId = options.projectId;
    this.healthMonitor = options.healthMonitor;
    this.gracePeriodMs = options.gracePeriodMs ?? 300000; // 5 minutes
    this.maxReassignments = options.maxReassignments ?? 3;
  }

  /**
   * Start listening for offline events and scheduling reassignments.
   */
  start(): void {
    if (this.offlineHandler) return; // Already started

    this.offlineHandler = (event: {
      agentId: string;
      previousStatus: string | null;
      currentStatus: string;
    }) => {
      this.handleAgentOffline(event.agentId);
    };

    this.healthMonitor.on("status:offline", this.offlineHandler);
  }

  /**
   * Stop listening and cancel all pending reassignments.
   */
  stop(): void {
    if (this.offlineHandler) {
      this.healthMonitor.off("status:offline", this.offlineHandler);
      this.offlineHandler = null;
    }

    // Cancel all pending timers
    for (const pending of this.pendingReassignments.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingReassignments.clear();
  }

  private handleAgentOffline(agentId: string): void {
    // Find tasks assigned to this agent
    const orphanedTasks = this.stateStore.getOrphanedTasks(this.projectId);
    const agentTasks = orphanedTasks.filter((t) => t.assignedTo === agentId);

    for (const task of agentTasks) {
      // Skip if already pending reassignment
      if (this.pendingReassignments.has(task.id)) continue;

      // Check max reassignments
      const count = this.stateStore.getTaskReassignmentCount(task.id);
      if (count >= this.maxReassignments) {
        this.emit("reassignment:max-reached", {
          taskId: task.id,
          fromAgent: agentId,
          count,
        });
        continue;
      }

      // Schedule reassignment after grace period
      const timer = setTimeout(() => {
        this.executeReassignment(task, agentId);
        this.pendingReassignments.delete(task.id);
      }, this.gracePeriodMs);

      this.pendingReassignments.set(task.id, {
        taskId: task.id,
        offlineAgentId: agentId,
        detectedAt: Date.now(),
        timer,
      });
    }
  }

  private executeReassignment(task: Task, fromAgentId: string): void {
    // Re-check: agent might have come back online during grace period
    const agent = this.stateStore.getAgent(fromAgentId);
    if (agent && agent.status !== "offline") {
      this.pendingReassignments.delete(task.id);
      return; // Agent recovered
    }

    // Re-check max reassignment count
    const count = this.stateStore.getTaskReassignmentCount(task.id);
    if (count >= this.maxReassignments) {
      this.emit("reassignment:max-reached", {
        taskId: task.id,
        fromAgent: fromAgentId,
        count,
      });
      return;
    }

    // Extract required capabilities from task
    const requiredCaps = extractRequiredCapabilities(
      task.tags || [],
      task.metadata,
    );

    // Find best available agent
    const agents = this.stateStore.listAgents(this.projectId);
    const best = findBestAgent(agents, requiredCaps, {
      excludeAgentIds: [fromAgentId],
    });

    if (!best) {
      this.emit("reassignment:failed", {
        taskId: task.id,
        fromAgent: fromAgentId,
        reason: "No available agent found with matching capabilities",
      });
      return;
    }

    // Perform the reassignment
    try {
      const reassigned = this.stateStore.reassignTask(
        task.id,
        best.agent.id,
        this.projectId,
      );

      this.emit("reassignment", {
        taskId: task.id,
        fromAgent: fromAgentId,
        toAgent: best.agent.id,
        task: reassigned,
      });
    } catch (error) {
      this.emit("reassignment:failed", {
        taskId: task.id,
        fromAgent: fromAgentId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
