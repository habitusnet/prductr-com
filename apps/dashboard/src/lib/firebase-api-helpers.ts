/**
 * Firebase-compatible API Helpers for Conductor Dashboard
 * Uses Firestore for data storage
 *
 * @deprecated This module is legacy code from the pre-Neon Auth era.
 * The dashboard now uses edge-api-helpers.ts with SQLiteStateStore (local)
 * or D1StateStore (Cloudflare) as the primary data layer.
 * Neon Auth + @conductor/db (Drizzle) is the production path forward.
 * This file is retained only for backward compatibility during migration.
 * See: edge-api-helpers.ts for the active implementation.
 */

import {
  getFirestoreStateStore,
  getProjectId,
  FirestoreStateStore,
} from "./firebase-db";

export interface FirebaseApiContext {
  store: FirestoreStateStore;
  projectId: string;
}

/**
 * Get API context for Firebase runtime
 */
export function getApiContext(): FirebaseApiContext {
  return {
    store: getFirestoreStateStore(),
    projectId: getProjectId(),
  };
}

/**
 * Helper for common project data fetching
 */
export async function getProjectData(ctx: FirebaseApiContext) {
  const [project, tasks, agents, totalSpend] = await Promise.all([
    ctx.store.getProject(ctx.projectId),
    ctx.store.listTasks(ctx.projectId),
    ctx.store.listAgents(ctx.projectId),
    ctx.store.getProjectSpend(ctx.projectId),
  ]);
  return { project, tasks, agents, totalSpend };
}

/**
 * Helper for access request operations
 */
export async function getAccessRequests(
  ctx: FirebaseApiContext,
  filters?: { status?: "pending" | "approved" | "denied" | "expired" },
) {
  const [requests, summary] = await Promise.all([
    ctx.store.listAccessRequests(ctx.projectId, filters),
    ctx.store.getAccessRequestSummary(ctx.projectId),
  ]);
  return { requests, summary };
}

/**
 * Helper for onboarding config operations
 */
export async function getOnboardingConfig(ctx: FirebaseApiContext) {
  const [config, project] = await Promise.all([
    ctx.store.getOnboardingConfig(ctx.projectId),
    ctx.store.getProject(ctx.projectId),
  ]);
  return { config, project };
}

export async function setOnboardingConfig(
  ctx: FirebaseApiContext,
  config: any,
) {
  await ctx.store.setOnboardingConfig(ctx.projectId, config);
}

/**
 * Helper for approving access requests
 */
export async function approveAccessRequest(
  ctx: FirebaseApiContext,
  requestId: string,
  reviewedBy: string,
) {
  await ctx.store.approveAccessRequest(ctx.projectId, requestId, reviewedBy);
  return { id: requestId, status: "approved" as const };
}

/**
 * Helper for denying access requests
 */
export async function denyAccessRequest(
  ctx: FirebaseApiContext,
  requestId: string,
  reviewedBy: string,
  reason?: string,
) {
  await ctx.store.denyAccessRequest(
    ctx.projectId,
    requestId,
    reviewedBy,
    reason,
  );
  return { id: requestId, status: "denied" as const };
}

/**
 * Helper for expiring old requests
 * @deprecated Not implemented for Firestore. Use edge-api-helpers.ts which
 * delegates to SQLiteStateStore.expireOldRequests() for the active code path.
 */
export async function expireOldRequests(
  _ctx: FirebaseApiContext,
  _olderThanHours: number,
) {
  // Firestore implementation not needed — Neon Auth pivot makes this module legacy.
  // The SQLite path (edge-api-helpers → store.expireOldRequests) handles this.
  return 0;
}

/**
 * Helper for task operations
 */
export async function listTasks(ctx: FirebaseApiContext, filters?: any) {
  return ctx.store.listTasks(ctx.projectId, filters);
}

/**
 * Helper for agent operations
 */
export async function listAgents(ctx: FirebaseApiContext) {
  return ctx.store.listAgents(ctx.projectId);
}

/**
 * Helper for cost operations
 */
export async function getCostData(ctx: FirebaseApiContext) {
  const [totalSpend, events] = await Promise.all([
    ctx.store.getProjectSpend(ctx.projectId),
    ctx.store.getCostEvents(ctx.projectId),
  ]);
  return { totalSpend, events };
}

/**
 * Helper for getting pending actions (conflicts, locks, escalations)
 */
export async function getPendingActions(ctx: FirebaseApiContext) {
  const [conflicts, locks, blockedTasks, agents] = await Promise.all([
    ctx.store.getUnresolvedConflicts(ctx.projectId),
    ctx.store.getActiveLocks(ctx.projectId),
    ctx.store.listTasks(ctx.projectId, { status: "blocked" }),
    ctx.store.listAgents(ctx.projectId),
  ]);
  return { conflicts, locks, blockedTasks, agents };
}

/**
 * Helper for resolving a conflict
 */
export async function resolveConflict(
  ctx: FirebaseApiContext,
  conflictId: string,
  resolution: string,
) {
  await ctx.store.resolveConflict(ctx.projectId, conflictId, resolution);
}

/**
 * Helper for releasing a file lock
 */
export async function releaseLock(
  ctx: FirebaseApiContext,
  filePath: string,
  agentId: string,
) {
  await ctx.store.releaseLock(ctx.projectId, filePath, agentId);
}

/**
 * Helper for updating a task
 */
export async function updateTask(
  ctx: FirebaseApiContext,
  taskId: string,
  updates: any,
) {
  await ctx.store.updateTask(ctx.projectId, taskId, updates);
}

/**
 * Helper for updating agent status
 */
export async function updateAgentStatus(
  ctx: FirebaseApiContext,
  agentId: string,
  status: "idle" | "working" | "blocked" | "offline",
) {
  await ctx.store.updateAgentStatus(ctx.projectId, agentId, status);
}
