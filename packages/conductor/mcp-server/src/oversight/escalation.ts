/**
 * Escalation Queue
 *
 * Prioritized queue for issues requiring human judgment.
 */

export type EscalationType =
  | "oauth_required"
  | "merge_conflict"
  | "task_review"
  | "agent_error"
  | "budget_exceeded"
  | "manual_intervention";

export type EscalationPriority = "critical" | "high" | "normal" | "low";

export type EscalationStatus = "pending" | "snoozed" | "resolved" | "escalated";

export interface Escalation {
  id: string;
  projectId: string;
  type: EscalationType;
  priority: EscalationPriority;
  status: EscalationStatus;
  title: string;
  description?: string;
  context: Record<string, unknown>; // taskId, agentId, errorCode, etc.
  assignedTo?: string; // userId
  resolvedBy?: string; // userId
  resolution?: string;
  snoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface CreateEscalationInput {
  projectId: string;
  type: EscalationType;
  title: string;
  description?: string;
  context?: Record<string, unknown>;
  assignedTo?: string;
}

export interface EscalationFilters {
  status?: EscalationStatus | EscalationStatus[];
  priority?: EscalationPriority | EscalationPriority[];
  type?: EscalationType | EscalationType[];
  projectId?: string;
  assignedTo?: string;
}

/**
 * Determine priority based on escalation type.
 */
export function getPriorityForType(type: EscalationType): EscalationPriority {
  switch (type) {
    case "oauth_required":
      return "critical"; // Always critical - blocks all agent work

    case "merge_conflict":
      return "high"; // High priority - can block multiple tasks

    case "budget_exceeded":
      return "high"; // High priority - financial concern

    case "agent_error":
      return "normal"; // Normal - can usually retry

    case "task_review":
      return "normal"; // Normal - review completed work

    case "manual_intervention":
      return "normal"; // Normal unless explicitly raised

    default:
      return "normal";
  }
}

/**
 * Create escalation with automatic priority assignment.
 */
export function createEscalation(
  input: CreateEscalationInput,
): Omit<Escalation, "createdAt" | "updatedAt"> {
  const priority = getPriorityForType(input.type);

  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    type: input.type,
    priority,
    status: "pending",
    title: input.title,
    description: input.description,
    context: input.context || {},
    assignedTo: input.assignedTo,
  };
}

/**
 * Check if escalation type should send immediate notification.
 */
export function shouldNotify(escalation: Escalation): boolean {
  // Always notify on critical
  if (escalation.priority === "critical") {
    return true;
  }

  // Notify on high if assigned
  if (escalation.priority === "high" && escalation.assignedTo) {
    return true;
  }

  return false;
}

/**
 * Get display color for priority level.
 */
export function getPriorityColor(priority: EscalationPriority): string {
  switch (priority) {
    case "critical":
      return "red";
    case "high":
      return "orange";
    case "normal":
      return "blue";
    case "low":
      return "gray";
  }
}

/**
 * Get display icon for escalation type.
 */
export function getTypeIcon(type: EscalationType): string {
  switch (type) {
    case "oauth_required":
      return "🔐";
    case "merge_conflict":
      return "⚠️";
    case "task_review":
      return "📋";
    case "agent_error":
      return "🔴";
    case "budget_exceeded":
      return "💰";
    case "manual_intervention":
      return "✋";
  }
}

/**
 * Get human-readable description of escalation type.
 */
export function getTypeDescription(type: EscalationType): string {
  switch (type) {
    case "oauth_required":
      return "Agent requires re-authentication";
    case "merge_conflict":
      return "Complex merge conflict requires resolution";
    case "task_review":
      return "Completed task awaiting review";
    case "agent_error":
      return "Agent encountered an error";
    case "budget_exceeded":
      return "Project budget threshold exceeded";
    case "manual_intervention":
      return "Manual intervention required";
  }
}

/**
 * Sort escalations by priority then age (oldest first).
 */
export function sortEscalations(escalations: Escalation[]): Escalation[] {
  const priorityOrder: Record<EscalationPriority, number> = {
    critical: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  return [...escalations].sort((a, b) => {
    // First sort by priority (descending)
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by age (oldest first)
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * Check if escalation is due (not snoozed or past snooze time).
 */
export function isDue(escalation: Escalation): boolean {
  if (escalation.status !== "snoozed") {
    return true;
  }

  if (!escalation.snoozedUntil) {
    return true;
  }

  return new Date() >= escalation.snoozedUntil;
}

/**
 * Get escalations that are due and need attention.
 */
export function getDueEscalations(escalations: Escalation[]): Escalation[] {
  return escalations.filter((e) => e.status === "pending" && isDue(e));
}

/**
 * Escalation Queue Manager for in-memory queue operations.
 */
export class EscalationQueue {
  private escalations: Map<string, Escalation> = new Map();

  add(escalation: Escalation): void {
    this.escalations.set(escalation.id, escalation);
  }

  get(id: string): Escalation | undefined {
    return this.escalations.get(id);
  }

  update(id: string, updates: Partial<Escalation>): Escalation | undefined {
    const escalation = this.escalations.get(id);
    if (!escalation) return undefined;

    const updated = {
      ...escalation,
      ...updates,
      updatedAt: new Date(),
    };

    this.escalations.set(id, updated);
    return updated;
  }

  resolve(id: string, resolvedBy: string, resolution: string): Escalation | undefined {
    return this.update(id, {
      status: "resolved",
      resolvedBy,
      resolution,
      resolvedAt: new Date(),
    });
  }

  snooze(id: string, until: Date): Escalation | undefined {
    return this.update(id, {
      status: "snoozed",
      snoozedUntil: until,
    });
  }

  escalateExternal(id: string, resolvedBy: string): Escalation | undefined {
    return this.update(id, {
      status: "escalated",
      resolvedBy,
      resolvedAt: new Date(),
    });
  }

  list(filters?: EscalationFilters): Escalation[] {
    let results = Array.from(this.escalations.values());

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      results = results.filter((e) => statuses.includes(e.status));
    }

    if (filters?.priority) {
      const priorities = Array.isArray(filters.priority)
        ? filters.priority
        : [filters.priority];
      results = results.filter((e) => priorities.includes(e.priority));
    }

    if (filters?.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      results = results.filter((e) => types.includes(e.type));
    }

    if (filters?.projectId) {
      results = results.filter((e) => e.projectId === filters.projectId);
    }

    if (filters?.assignedTo) {
      results = results.filter((e) => e.assignedTo === filters.assignedTo);
    }

    return sortEscalations(results);
  }

  getPending(projectId?: string): Escalation[] {
    return this.list({ status: "pending", projectId });
  }

  getDue(projectId?: string): Escalation[] {
    const pending = this.getPending(projectId);
    return getDueEscalations(pending);
  }

  getCritical(projectId?: string): Escalation[] {
    return this.list({ status: "pending", priority: "critical", projectId });
  }
}
