/**
 * API Helpers for Conductor Dashboard
 * Provides unified interface for both local SQLite and Cloudflare D1
 */

import { getStateStore, getProjectId, isD1Store, D1StateStore } from "./db";
import { SQLiteStateStore } from "@conductor/state";

// Try to import Cloudflare's context helper (only available on Cloudflare)
let getRequestContext: (() => { env: { DB?: unknown } }) | null = null;
try {
  // Dynamic import to avoid issues in Node.js environment
  const cfModule = require("@cloudflare/next-on-pages");
  getRequestContext = cfModule.getRequestContext;
} catch {
  // Not on Cloudflare, use local SQLite
}

export interface ApiContext {
  store: SQLiteStateStore | D1StateStore;
  projectId: string;
  isD1: boolean;
}

/**
 * Get API context with appropriate store
 */
export function getApiContext(): ApiContext {
  let store: SQLiteStateStore | D1StateStore;
  let isD1 = false;

  // Try to get D1 from Cloudflare context
  if (getRequestContext) {
    try {
      const ctx = getRequestContext();
      if (ctx?.env?.DB) {
        store = getStateStore(ctx.env.DB as any);
        isD1 = true;
      } else {
        store = getStateStore();
      }
    } catch {
      store = getStateStore();
    }
  } else {
    store = getStateStore();
  }

  return {
    store,
    projectId: getProjectId(),
    isD1: isD1Store(store),
  };
}

/**
 * Type-safe wrapper for async/sync operations
 * D1 operations are async, SQLite operations are sync
 */
export async function withStore<T>(
  ctx: ApiContext,
  syncOp: (store: SQLiteStateStore) => T,
  asyncOp: (store: D1StateStore) => Promise<T>,
): Promise<T> {
  if (ctx.isD1) {
    return asyncOp(ctx.store as D1StateStore);
  }
  return syncOp(ctx.store as SQLiteStateStore);
}

/**
 * Helper for common project data fetching
 */
export async function getProjectData(ctx: ApiContext) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    const [project, tasks, agents, totalSpend] = await Promise.all([
      store.getProject(ctx.projectId),
      store.listTasks(ctx.projectId),
      store.listAgents(ctx.projectId),
      store.getProjectSpend(ctx.projectId),
    ]);
    return { project, tasks, agents, totalSpend };
  } else {
    const store = ctx.store as SQLiteStateStore;
    return {
      project: store.getProject(ctx.projectId),
      tasks: store.listTasks(ctx.projectId),
      agents: store.listAgents(ctx.projectId),
      totalSpend: store.getProjectSpend(ctx.projectId),
    };
  }
}

/**
 * Helper for access request operations
 */
export async function getAccessRequests(
  ctx: ApiContext,
  filters?: { status?: "pending" | "approved" | "denied" | "expired" },
) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    const [requests, summary] = await Promise.all([
      store.listAccessRequests(ctx.projectId, filters),
      store.getAccessRequestSummary(ctx.projectId),
    ]);
    return { requests, summary };
  } else {
    const store = ctx.store as SQLiteStateStore;
    const requests = store.listAccessRequests(ctx.projectId, filters);
    const allRequests = store.listAccessRequests(ctx.projectId);
    const summary = {
      total: allRequests.length,
      pending: allRequests.filter((r) => r.status === "pending").length,
      approved: allRequests.filter((r) => r.status === "approved").length,
      denied: allRequests.filter((r) => r.status === "denied").length,
      expired: allRequests.filter((r) => r.status === "expired").length,
    };
    return { requests, summary };
  }
}

/**
 * Helper for onboarding config operations
 */
export async function getOnboardingConfig(ctx: ApiContext) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    const [config, project] = await Promise.all([
      store.getOnboardingConfig(ctx.projectId),
      store.getProject(ctx.projectId),
    ]);
    return { config, project };
  } else {
    const store = ctx.store as SQLiteStateStore;
    return {
      config: store.getOnboardingConfig(ctx.projectId),
      project: store.getProject(ctx.projectId),
    };
  }
}

export async function setOnboardingConfig(ctx: ApiContext, config: any) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    await store.setOnboardingConfig(ctx.projectId, config);
  } else {
    const store = ctx.store as SQLiteStateStore;
    store.setOnboardingConfig(ctx.projectId, config);
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
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    await store.approveAccessRequest(requestId, reviewedBy);
    // Return a basic result for D1
    return { id: requestId, status: "approved" as const };
  } else {
    const store = ctx.store as SQLiteStateStore;
    return store.approveAccessRequest(requestId, reviewedBy);
  }
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
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    await store.denyAccessRequest(requestId, reviewedBy, reason);
    return { id: requestId, status: "denied" as const };
  } else {
    const store = ctx.store as SQLiteStateStore;
    return store.denyAccessRequest(requestId, reviewedBy, reason);
  }
}

/**
 * Helper for expiring old requests
 */
export async function expireOldRequests(
  ctx: ApiContext,
  olderThanHours: number,
) {
  if (ctx.isD1) {
    // D1 doesn't have this method yet, return 0
    return 0;
  } else {
    const store = ctx.store as SQLiteStateStore;
    return store.expireOldRequests(ctx.projectId, olderThanHours);
  }
}

/**
 * Helper for task operations
 */
export async function listTasks(ctx: ApiContext, filters?: any) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    return store.listTasks(ctx.projectId, filters);
  } else {
    const store = ctx.store as SQLiteStateStore;
    return store.listTasks(ctx.projectId, filters);
  }
}

/**
 * Helper for agent operations
 */
export async function listAgents(ctx: ApiContext) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    return store.listAgents(ctx.projectId);
  } else {
    const store = ctx.store as SQLiteStateStore;
    return store.listAgents(ctx.projectId);
  }
}

/**
 * Helper for cost operations
 */
export async function getCostData(ctx: ApiContext) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    const [totalSpend, events] = await Promise.all([
      store.getProjectSpend(ctx.projectId),
      store.getCostEvents(ctx.projectId),
    ]);
    return { totalSpend, events };
  } else {
    const store = ctx.store as SQLiteStateStore;
    return {
      totalSpend: store.getProjectSpend(ctx.projectId),
      events: store.getCostEvents(ctx.projectId),
    };
  }
}

/**
 * Helper for getting pending actions (conflicts, locks, escalations)
 */
export async function getPendingActions(ctx: ApiContext) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    const [conflicts, locks, blockedTasks, agents] = await Promise.all([
      store.getUnresolvedConflicts(ctx.projectId),
      store.getActiveLocks(ctx.projectId),
      store.listTasks(ctx.projectId, { status: "blocked" }),
      store.listAgents(ctx.projectId),
    ]);
    return { conflicts, locks, blockedTasks, agents };
  } else {
    const store = ctx.store as SQLiteStateStore;
    const db = (store as any).db;

    // Get unresolved conflicts
    const conflictRows = db
      .prepare(
        "SELECT * FROM conflicts WHERE project_id = ? AND resolved_at IS NULL ORDER BY created_at DESC",
      )
      .all(ctx.projectId) as Record<string, unknown>[];

    const conflicts = conflictRows.map((row) => ({
      id: row["id"] as string,
      filePath: row["file_path"] as string,
      agents: JSON.parse((row["agents"] as string) || "[]"),
      strategy: row["strategy"] as string,
      createdAt: row["created_at"] as string,
    }));

    // Get active file locks
    const lockRows = db
      .prepare(
        "SELECT * FROM file_locks WHERE project_id = ? AND expires_at > datetime('now') ORDER BY locked_at DESC",
      )
      .all(ctx.projectId) as Record<string, unknown>[];

    const locks = lockRows.map((row) => ({
      filePath: row["file_path"] as string,
      agentId: row["agent_id"] as string,
      lockedAt: row["locked_at"] as string,
      expiresAt: row["expires_at"] as string,
    }));

    const blockedTasks = store.listTasks(ctx.projectId, { status: "blocked" });
    const agents = store.listAgents(ctx.projectId);

    return { conflicts, locks, blockedTasks, agents };
  }
}

/**
 * Helper for resolving a conflict
 */
export async function resolveConflict(
  ctx: ApiContext,
  conflictId: string,
  resolution: string,
) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    await store.resolveConflict(ctx.projectId, conflictId, resolution);
  } else {
    const store = ctx.store as SQLiteStateStore;
    const db = (store as any).db;
    db.prepare(
      'UPDATE conflicts SET resolved_at = datetime("now"), resolution = ? WHERE id = ? AND project_id = ?',
    ).run(resolution, conflictId, ctx.projectId);
  }
}

/**
 * Helper for releasing a file lock
 */
export async function releaseLock(
  ctx: ApiContext,
  filePath: string,
  agentId: string,
) {
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    await store.releaseLock(ctx.projectId, filePath, agentId);
  } else {
    const store = ctx.store as SQLiteStateStore;
    const db = (store as any).db;
    db.prepare(
      "DELETE FROM file_locks WHERE project_id = ? AND file_path = ? AND agent_id = ?",
    ).run(ctx.projectId, filePath, agentId);
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
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    await store.updateTask(taskId, updates);
  } else {
    const store = ctx.store as SQLiteStateStore;
    store.updateTask(taskId, updates);
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
  if (ctx.isD1) {
    const store = ctx.store as D1StateStore;
    await store.updateAgentStatus(agentId, status);
  } else {
    const store = ctx.store as SQLiteStateStore;
    store.updateAgentStatus(agentId, status as any);
  }
}
