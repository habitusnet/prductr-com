import { EventEmitter } from "events";
import type { SQLiteStateStore } from "@conductor/state";
import type { AgentProfile } from "@conductor/core";

export type HealthStatus = "healthy" | "warning" | "critical" | "offline";

export interface AgentHealth {
  agentId: string;
  status: HealthStatus;
  lastHeartbeat: Date | null;
  secondsSinceHeartbeat: number | null;
}

export interface HealthMonitorOptions {
  stateStore: SQLiteStateStore;
  projectId: string;
  /** Scan interval in milliseconds (default: 30000 = 30s) */
  scanIntervalMs?: number;
  /** Thresholds in seconds for status transitions */
  thresholds?: {
    warning: number; // seconds before warning (default: 120)
    critical: number; // seconds before critical (default: 300)
    offline: number; // seconds before offline (default: 600)
  };
  /** Webhook URL for alerts */
  webhookUrl?: string;
}

const DEFAULT_THRESHOLDS = {
  warning: 120, // 2 minutes
  critical: 300, // 5 minutes
  offline: 600, // 10 minutes
};

/**
 * Monitors agent health based on heartbeat freshness.
 * Emits events: 'status:healthy', 'status:warning', 'status:critical', 'status:offline'
 * Each event payload: { agentId, previousStatus, currentStatus, agent }
 */
export class HealthMonitor extends EventEmitter {
  private stateStore: SQLiteStateStore;
  private projectId: string;
  private scanIntervalMs: number;
  private thresholds: { warning: number; critical: number; offline: number };
  private webhookUrl?: string;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private agentStatuses: Map<string, HealthStatus> = new Map();

  constructor(options: HealthMonitorOptions) {
    super();
    this.stateStore = options.stateStore;
    this.projectId = options.projectId;
    this.scanIntervalMs = options.scanIntervalMs ?? 30000;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.webhookUrl = options.webhookUrl;
  }

  /**
   * Start periodic health scanning.
   */
  start(): void {
    if (this.intervalHandle) return; // Already running
    this.scan(); // Initial scan
    this.intervalHandle = setInterval(() => this.scan(), this.scanIntervalMs);
  }

  /**
   * Stop periodic health scanning.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Get current health status for all agents.
   */
  getHealthStatuses(): AgentHealth[] {
    const agents = this.stateStore.listAgents(this.projectId);
    const now = Date.now();

    return agents.map((agent) => {
      const secondsSince = agent.lastHeartbeat
        ? Math.floor((now - agent.lastHeartbeat.getTime()) / 1000)
        : null;
      const status = this.classifyHealth(secondsSince);

      return {
        agentId: agent.id,
        status,
        lastHeartbeat: agent.lastHeartbeat ?? null,
        secondsSinceHeartbeat: secondsSince,
      };
    });
  }

  /**
   * Perform a single health scan.
   */
  scan(): void {
    const agents = this.stateStore.listAgents(this.projectId);
    const now = Date.now();

    for (const agent of agents) {
      const secondsSince = agent.lastHeartbeat
        ? Math.floor((now - agent.lastHeartbeat.getTime()) / 1000)
        : null;

      const currentStatus = this.classifyHealth(secondsSince);
      const previousStatus = this.agentStatuses.get(agent.id);

      if (previousStatus !== currentStatus) {
        this.agentStatuses.set(agent.id, currentStatus);

        // Emit status change event
        this.emit(`status:${currentStatus}`, {
          agentId: agent.id,
          previousStatus: previousStatus ?? null,
          currentStatus,
          agent,
        });

        // Auto-mark agent as offline in the store
        if (currentStatus === "offline" && agent.status !== "offline") {
          this.stateStore.updateAgentStatus(agent.id, "offline");
        }

        // Send webhook alert for critical/offline
        if (
          this.webhookUrl &&
          (currentStatus === "critical" || currentStatus === "offline")
        ) {
          this.sendWebhookAlert(agent, currentStatus).catch(() => {
            // best-effort, don't crash on webhook failure
          });
        }
      }
    }
  }

  private classifyHealth(secondsSinceHeartbeat: number | null): HealthStatus {
    if (secondsSinceHeartbeat === null) return "offline";
    if (secondsSinceHeartbeat >= this.thresholds.offline) return "offline";
    if (secondsSinceHeartbeat >= this.thresholds.critical) return "critical";
    if (secondsSinceHeartbeat >= this.thresholds.warning) return "warning";
    return "healthy";
  }

  private async sendWebhookAlert(
    agent: AgentProfile,
    status: HealthStatus,
  ): Promise<void> {
    if (!this.webhookUrl) return;

    await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "agent_health_alert",
        agentId: agent.id,
        agentName: agent.name,
        status,
        projectId: this.projectId,
        timestamp: new Date().toISOString(),
      }),
    });
  }
}
