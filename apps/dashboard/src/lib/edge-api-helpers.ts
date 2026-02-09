/**
 * API Helpers for Conductor Dashboard
 * Supports both Edge (D1/Cloudflare) and Local (SQLite/Node.js) runtimes
 */

import { getEdgeApiContext, D1StateStore, isEdgeRuntime } from "./edge-db";
import { getStateStore, getProjectId } from "./db";
import type { SQLiteStateStore } from "@conductor/state";

// Union type for both store types
type StateStore = D1StateStore | SQLiteStateStore;

export interface ApiContext {
  store: StateStore;
  projectId: string;
  isEdge: boolean;
}

// Legacy alias for compatibility
export type EdgeApiContext = ApiContext;

/**
 * Get API context - automatically detects runtime environment
 * On Cloudflare: uses D1 database
 * On Node.js/local: uses SQLite database
 */
export function getApiContext(): ApiContext {
  if (isEdgeRuntime()) {
    const ctx = getEdgeApiContext();
    return { ...ctx, isEdge: true };
  }

  // Local/Node.js runtime - use SQLite
  return {
    store: getStateStore() as SQLiteStateStore,
    projectId: getProjectId(),
    isEdge: false,
  };
}

/**
 * Check if edge runtime is available
 */
export function isEdge(): boolean {
  return isEdgeRuntime();
}

/**
 * Helper for common project data fetching
 * Works with both sync (SQLite) and async (D1) stores
 */
export async function getProjectData(ctx: ApiContext) {
  if (ctx.isEdge) {
    // D1 is async
    const [project, tasks, agents, totalSpend] = await Promise.all([
      ctx.store.getProject(ctx.projectId),
      ctx.store.listTasks(ctx.projectId),
      ctx.store.listAgents(ctx.projectId),
      ctx.store.getProjectSpend(ctx.projectId),
    ]);
    return { project, tasks, agents, totalSpend };
  }

  // SQLite is sync
  const store = ctx.store as SQLiteStateStore;
  return {
    project: store.getProject(ctx.projectId),
    tasks: store.listTasks(ctx.projectId),
    agents: store.listAgents(ctx.projectId),
    totalSpend: store.getProjectSpend(ctx.projectId),
  };
}

/**
 * Helper for access request operations
 */
export async function getAccessRequests(
  ctx: ApiContext,
  filters?: { status?: "pending" | "approved" | "denied" | "expired" },
) {
  if (ctx.isEdge) {
    const d1Store = ctx.store as D1StateStore;
    const [requests, summary] = await Promise.all([
      d1Store.listAccessRequests(ctx.projectId, filters),
      d1Store.getAccessRequestSummary(ctx.projectId),
    ]);
    return { requests, summary };
  }

  const store = ctx.store as SQLiteStateStore;
  const requests = store.listAccessRequests(ctx.projectId, filters);
  const allRequests = store.listAccessRequests(ctx.projectId);

  // Compute summary manually since SQLiteStateStore doesn't have getAccessRequestSummary
  const summary = {
    total: allRequests.length,
    pending: allRequests.filter((r) => r.status === "pending").length,
    approved: allRequests.filter((r) => r.status === "approved").length,
    denied: allRequests.filter((r) => r.status === "denied").length,
    expired: allRequests.filter((r) => r.status === "expired").length,
  };

  return { requests, summary };
}

/**
 * Helper for onboarding config operations
 */
export async function getOnboardingConfig(ctx: ApiContext) {
  if (ctx.isEdge) {
    const [config, project] = await Promise.all([
      ctx.store.getOnboardingConfig(ctx.projectId),
      ctx.store.getProject(ctx.projectId),
    ]);
    return { config, project };
  }

  const store = ctx.store as SQLiteStateStore;
  return {
    config: store.getOnboardingConfig(ctx.projectId),
    project: store.getProject(ctx.projectId),
  };
}

export async function setOnboardingConfig(ctx: ApiContext, config: any) {
  if (ctx.isEdge) {
    await ctx.store.setOnboardingConfig(ctx.projectId, config);
  } else {
    (ctx.store as SQLiteStateStore).setOnboardingConfig(ctx.projectId, config);
  }
}

/**
 * Helper for approving access requests
 */
export async function approveAccessRequest(
  ctx: ApiContext,
  requestId: string,
  reviewedBy: string,
) {
  if (ctx.isEdge) {
    await ctx.store.approveAccessRequest(requestId, reviewedBy);
  } else {
    (ctx.store as SQLiteStateStore).approveAccessRequest(requestId, reviewedBy);
  }
  return { id: requestId, status: "approved" as const };
}

/**
 * Helper for denying access requests
 */
export async function denyAccessRequest(
  ctx: ApiContext,
  requestId: string,
  reviewedBy: string,
  reason?: string,
) {
  if (ctx.isEdge) {
    await ctx.store.denyAccessRequest(requestId, reviewedBy, reason);
  } else {
    (ctx.store as SQLiteStateStore).denyAccessRequest(
      requestId,
      reviewedBy,
      reason,
    );
  }
  return { id: requestId, status: "denied" as const };
}

/**
 * Helper for expiring old requests
 */
export async function expireOldRequests(
  ctx: ApiContext,
  olderThanHours: number,
) {
  if (ctx.isEdge) {
    // D1 doesn't have this method yet
    return 0;
  }
  return (ctx.store as SQLiteStateStore).expireOldRequests(
    ctx.projectId,
    olderThanHours,
  );
}

/**
 * Helper for task operations
 */
export async function listTasks(ctx: ApiContext, filters?: any) {
  if (ctx.isEdge) {
    return ctx.store.listTasks(ctx.projectId, filters);
  }
  return (ctx.store as SQLiteStateStore).listTasks(ctx.projectId, filters);
}

/**
 * Helper for agent operations
 */
export async function listAgents(ctx: ApiContext) {
  if (ctx.isEdge) {
    return ctx.store.listAgents(ctx.projectId);
  }
  return (ctx.store as SQLiteStateStore).listAgents(ctx.projectId);
}

/**
 * Helper for cost operations
 */
export async function getCostData(ctx: ApiContext) {
  if (ctx.isEdge) {
    const [totalSpend, events] = await Promise.all([
      ctx.store.getProjectSpend(ctx.projectId),
      ctx.store.getCostEvents(ctx.projectId),
    ]);
    return { totalSpend, events };
  }

  const store = ctx.store as SQLiteStateStore;
  return {
    totalSpend: store.getProjectSpend(ctx.projectId),
    events: store.getCostEvents(ctx.projectId),
  };
}

/**
 * Helper for getting pending actions (conflicts, locks, escalations)
 */
export async function getPendingActions(ctx: ApiContext) {
  if (ctx.isEdge) {
    const d1Store = ctx.store as D1StateStore;
    const [conflicts, locks, blockedTasks, agents] = await Promise.all([
      d1Store.getUnresolvedConflicts(ctx.projectId),
      d1Store.getActiveLocks(ctx.projectId),
      d1Store.listTasks(ctx.projectId, { status: "blocked" }),
      d1Store.listAgents(ctx.projectId),
    ]);
    return { conflicts, locks, blockedTasks, agents };
  }

  const store = ctx.store as SQLiteStateStore;
  // SQLite store may not have all these methods - return empty for now
  return {
    conflicts: [],
    locks: [],
    blockedTasks: store.listTasks(ctx.projectId, { status: ["blocked"] }),
    agents: store.listAgents(ctx.projectId),
  };
}

/**
 * Helper for resolving a conflict
 */
export async function resolveConflict(
  ctx: ApiContext,
  conflictId: string,
  resolution: string,
) {
  if (ctx.isEdge) {
    const d1Store = ctx.store as D1StateStore;
    await d1Store.resolveConflict(ctx.projectId, conflictId, resolution);
  }
  // SQLite doesn't have this method yet
}

/**
 * Helper for releasing a file lock
 */
export async function releaseLock(
  ctx: ApiContext,
  filePath: string,
  agentId: string,
) {
  if (ctx.isEdge) {
    const d1Store = ctx.store as D1StateStore;
    await d1Store.releaseLock(ctx.projectId, filePath, agentId);
  } else {
    (ctx.store as SQLiteStateStore).releaseLock(
      ctx.projectId,
      filePath,
      agentId,
    );
  }
}

/**
 * Helper for updating a task
 */
export async function updateTask(
  ctx: ApiContext,
  taskId: string,
  updates: any,
) {
  if (ctx.isEdge) {
    await ctx.store.updateTask(taskId, updates);
  } else {
    (ctx.store as SQLiteStateStore).updateTask(taskId, updates);
  }
}

/**
 * Helper for updating agent status
 */
export async function updateAgentStatus(
  ctx: ApiContext,
  agentId: string,
  status: "idle" | "working" | "blocked" | "offline",
) {
  if (ctx.isEdge) {
    await ctx.store.updateAgentStatus(agentId, status);
  } else {
    (ctx.store as SQLiteStateStore).updateAgentStatus(agentId, status);
  }
}
