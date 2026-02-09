import { EventEmitter } from 'eventemitter3';
import { EscalationStore } from './store.js';
import type {
  Escalation,
  DetectionEvent,
  Decision,
  EscalateDecision,
  ActionLog,
} from '../types.js';

/**
 * Event types emitted by EscalationQueue
 */
export interface EscalationQueueEvents {
  escalation: (escalation: Escalation) => void;
}

/**
 * Configuration for EscalationQueue
 */
export interface EscalationQueueConfig {
  projectId: string;
  dbPath: string;
  observerId: string;
}

/**
 * EscalationQueue - Wraps EscalationStore and emits events for SSE streaming
 */
export class EscalationQueue extends EventEmitter<EscalationQueueEvents> {
  private store: EscalationStore;
  private config: EscalationQueueConfig;

  constructor(config: EscalationQueueConfig) {
    super();
    this.config = config;
    this.store = new EscalationStore(config.dbPath);
  }

  /**
   * Initialize the database schema
   */
  initialize(): void {
    this.store.initialize();
  }

  /**
   * Create an escalation from a detection event and decision
   * Generates title and suggested action based on event type
   * Emits 'escalation' event for SSE streaming
   */
  createEscalation(
    event: DetectionEvent,
    decision: Decision,
    consoleOutput: string,
    attemptedActions: ActionLog[] = []
  ): Escalation {
    if (decision.action !== 'escalate') {
      throw new Error('Cannot create escalation from non-escalate decision');
    }
    const escalateDecision = decision as EscalateDecision;

    const title = this.generateTitle(event);
    const suggestedAction = this.generateSuggestedAction(event);

    const escalation = this.store.createEscalation({
      projectId: this.config.projectId,
      priority: escalateDecision.priority,
      type: event.type,
      title,
      agentId: event.agentId,
      detectionEvent: event,
      consoleOutput,
      attemptedActions,
      suggestedAction,
    });

    // Emit event for SSE streaming
    this.emit('escalation', escalation);

    return escalation;
  }

  /**
   * Get a single escalation by ID
   */
  getEscalation(id: string): Escalation | undefined {
    return this.store.getEscalation(id);
  }

  /**
   * Get all pending escalations
   */
  getPending(): Escalation[] {
    return this.store.listEscalations(this.config.projectId, {
      status: 'pending',
    });
  }

  /**
   * Get all escalations for this project
   */
  getAll(): Escalation[] {
    return this.store.listEscalations(this.config.projectId);
  }

  /**
   * Update escalation status to 'acknowledged'
   */
  acknowledge(id: string): void {
    this.store.updateEscalation(id, { status: 'acknowledged' });
  }

  /**
   * Update escalation status to 'resolved' with resolution details
   */
  resolve(id: string, resolvedBy: string, resolution: string): void {
    const now = new Date();
    this.store.updateEscalation(id, {
      status: 'resolved',
      resolvedBy,
      resolvedAt: now,
      resolution,
    });
  }

  /**
   * Update escalation status to 'dismissed'
   */
  dismiss(id: string): void {
    this.store.updateEscalation(id, { status: 'dismissed' });
  }

  /**
   * Get counts of escalations by status
   */
  getCounts() {
    return this.store.countByStatus(this.config.projectId);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.store.close();
    this.removeAllListeners();
  }

  /**
   * Generate human-readable title based on event type
   */
  private generateTitle(event: DetectionEvent): string {
    switch (event.type) {
      case 'auth_required':
        return `Authentication required for ${event.provider}`;
      case 'stuck':
        return `Agent ${event.agentId} appears stuck`;
      case 'crash':
        return `Agent ${event.agentId} crashed`;
      case 'error':
        return `Error in agent ${event.agentId}: ${event.message}`;
      case 'test_failure':
        return `Test failures in agent ${event.agentId}`;
      case 'build_failure':
        return `Build failed for agent ${event.agentId}`;
      case 'rate_limited':
        return `Agent ${event.agentId} rate limited by ${event.provider}`;
      case 'git_conflict':
        return `Git conflict in agent ${event.agentId}`;
      case 'heartbeat_timeout':
        return `Heartbeat timeout for agent ${event.agentId}`;
      case 'context_exhaustion':
        return `Context exhaustion for agent ${event.agentId}: ${event.usagePercent.toFixed(1)}% tokens used (${event.tokenCount}/${event.tokenLimit})`;
      default:
        const _exhaustive: never = event;
        return _exhaustive;
    }
  }

  /**
   * Generate suggested action based on event type
   */
  private generateSuggestedAction(event: DetectionEvent): string | undefined {
    switch (event.type) {
      case 'auth_required':
        return 'Complete OAuth flow in browser';
      case 'stuck':
        return 'Check agent logs and restart if needed';
      case 'crash':
        return 'Review crash logs and restart agent';
      case 'git_conflict':
        return 'Manually resolve git conflicts';
      case 'context_exhaustion':
        return 'Save checkpoint and start new session with fresh context';
      default:
        return undefined;
    }
  }
}
