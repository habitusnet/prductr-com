import { eq, and, isNull, lt } from "drizzle-orm";
import { agents, agentInstances, fileLocks } from "../schema";
import type { AgentProfile, AgentInstance, FileLock } from "@conductor/core";

export function createAgentRepository(db: any) {
  return {
    async create(agent: Omit<AgentProfile, "status" | "lastHeartbeat">) {
      const result = await db
        .insert(agents)
        .values({
          id: agent.id,
          organizationId: agent.organizationId,
          name: agent.name,
          provider: agent.provider,
          model: agent.model,
          capabilities: JSON.stringify(agent.capabilities || []),
          costPerTokenInput: agent.costPerToken?.input || 0,
          costPerTokenOutput: agent.costPerToken?.output || 0,
          quotaLimit: agent.quotaLimit,
          quotaUsed: agent.quotaUsed || 0,
          quotaResetAt: agent.quotaResetAt?.toISOString(),
          metadata: JSON.stringify(agent.metadata || {}),
        })
        .returning();
      return result[0];
    },

    async findById(id: string) {
      const result = await db.select().from(agents).where(eq(agents.id, id));
      return result[0] || null;
    },

    async findGlobal() {
      return db.select().from(agents).where(isNull(agents.organizationId));
    },

    async findByOrganization(organizationId: string) {
      return db
        .select()
        .from(agents)
        .where(eq(agents.organizationId, organizationId));
    },

    async updateStatus(id: string, status: AgentProfile["status"]) {
      const now = new Date().toISOString();
      return db
        .update(agents)
        .set({
          status,
          lastHeartbeat: now,
        })
        .where(eq(agents.id, id));
    },

    async heartbeat(id: string) {
      const now = new Date().toISOString();
      return db
        .update(agents)
        .set({ lastHeartbeat: now })
        .where(eq(agents.id, id));
    },

    // Agent Instances (runtime sessions)
    async registerInstance(instance: Omit<AgentInstance, "startedAt">) {
      const result = await db
        .insert(agentInstances)
        .values({
          id: instance.id,
          agentId: instance.agentId,
          projectId: instance.projectId,
          sessionId: instance.sessionId,
          status: instance.status || "idle",
          currentTaskId: instance.currentTaskId,
          lastHeartbeat: instance.lastHeartbeat.toISOString(),
          metadata: JSON.stringify(instance.metadata || {}),
        })
        .returning();
      return result[0];
    },

    async updateInstance(sessionId: string, data: Partial<AgentInstance>) {
      const updateData: any = { ...data };
      if (data.lastHeartbeat)
        updateData.lastHeartbeat = data.lastHeartbeat.toISOString();
      if (data.metadata) updateData.metadata = JSON.stringify(data.metadata);

      return db
        .update(agentInstances)
        .set(updateData)
        .where(eq(agentInstances.sessionId, sessionId));
    },

    async getActiveInstances(projectId: string) {
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min
      return db
        .select()
        .from(agentInstances)
        .where(
          and(
            eq(agentInstances.projectId, projectId),
            // Only instances with recent heartbeats
          ),
        );
    },

    async removeInstance(sessionId: string) {
      await db
        .delete(agentInstances)
        .where(eq(agentInstances.sessionId, sessionId));
    },

    // File Locks
    async acquireLock(lock: Omit<FileLock, "id" | "lockedAt">) {
      // Check for existing lock
      const existing = await db
        .select()
        .from(fileLocks)
        .where(
          and(
            eq(fileLocks.projectId, lock.projectId),
            eq(fileLocks.filePath, lock.filePath),
          ),
        );

      if (existing.length > 0) {
        // Check if lock is expired
        const existingLock = existing[0];
        if (
          existingLock.expiresAt &&
          new Date(existingLock.expiresAt) < new Date()
        ) {
          // Lock expired, delete and allow new lock
          await db.delete(fileLocks).where(eq(fileLocks.id, existingLock.id));
        } else {
          return null; // Lock already held
        }
      }

      const result = await db
        .insert(fileLocks)
        .values({
          id: crypto.randomUUID(),
          projectId: lock.projectId,
          filePath: lock.filePath,
          agentId: lock.agentId,
          taskId: lock.taskId,
          expiresAt: lock.expiresAt?.toISOString(),
        })
        .returning();

      return result[0];
    },

    async releaseLock(projectId: string, filePath: string, agentId: string) {
      await db
        .delete(fileLocks)
        .where(
          and(
            eq(fileLocks.projectId, projectId),
            eq(fileLocks.filePath, filePath),
            eq(fileLocks.agentId, agentId),
          ),
        );
    },

    async getLocksForProject(projectId: string) {
      return db
        .select()
        .from(fileLocks)
        .where(eq(fileLocks.projectId, projectId));
    },

    async cleanupExpiredLocks() {
      const now = new Date();
      await db.delete(fileLocks).where(lt(fileLocks.expiresAt, now));
    },
  };
}
