import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { tasks, taskActivities, projects } from "../schema";
import type { Task, TaskFilters, TaskActivity } from "@conductor/core";

export function createTaskRepository(db: any) {
  return {
    async create(task: Omit<Task, "createdAt" | "updatedAt">) {
      const result = await db
        .insert(tasks)
        .values({
          id: task.id,
          projectId: task.projectId,
          parentId: task.parentId,
          title: task.title,
          description: task.description,
          status: task.status || "pending",
          priority: task.priority || "medium",
          assignedTo: task.assignedTo,
          dueAt: task.dueAt?.toISOString(),
          dependencies: JSON.stringify(task.dependencies || []),
          estimatedTokens: task.estimatedTokens,
          files: JSON.stringify(task.files || []),
          tags: JSON.stringify(task.tags || []),
          metadata: JSON.stringify(task.metadata || {}),
          createdBy: task.createdBy,
        })
        .returning();

      // Log creation activity
      await this.logActivity({
        id: crypto.randomUUID(),
        taskId: task.id,
        action: "created",
        description: `Task created: ${task.title}`,
        metadata: {},
      });

      return result[0];
    },

    async findById(id: string) {
      const result = await db.select().from(tasks).where(eq(tasks.id, id));
      return result[0] || null;
    },

    async findByProject(projectId: string, filters?: TaskFilters) {
      let query = db.select().from(tasks).where(eq(tasks.projectId, projectId));

      if (filters?.status) {
        const statuses = Array.isArray(filters.status)
          ? filters.status
          : [filters.status];
        query = query.where(inArray(tasks.status, statuses));
      }

      if (filters?.priority) {
        const priorities = Array.isArray(filters.priority)
          ? filters.priority
          : [filters.priority];
        query = query.where(inArray(tasks.priority, priorities));
      }

      if (filters?.assignedTo) {
        query = query.where(eq(tasks.assignedTo, filters.assignedTo));
      }

      return query.orderBy(desc(tasks.priority), asc(tasks.createdAt));
    },

    async claim(id: string, agentId: string) {
      const now = new Date().toISOString();
      const result = await db
        .update(tasks)
        .set({
          status: "claimed",
          assignedTo: agentId,
          claimedAt: now,
          updatedAt: now,
        })
        .where(and(eq(tasks.id, id), eq(tasks.status, "pending")))
        .returning();

      if (result[0]) {
        await this.logActivity({
          id: crypto.randomUUID(),
          taskId: id,
          agentId,
          action: "claimed",
          description: `Task claimed by ${agentId}`,
          metadata: {},
        });
      }

      return result[0];
    },

    async start(id: string) {
      const now = new Date().toISOString();
      const result = await db
        .update(tasks)
        .set({
          status: "in_progress",
          startedAt: now,
          updatedAt: now,
        })
        .where(eq(tasks.id, id))
        .returning();

      if (result[0]) {
        await this.logActivity({
          id: crypto.randomUUID(),
          taskId: id,
          agentId: result[0].assignedTo,
          action: "started",
          metadata: {},
        });
      }

      return result[0];
    },

    async complete(id: string, result?: string, actualTokens?: number) {
      const now = new Date().toISOString();
      const updated = await db
        .update(tasks)
        .set({
          status: "completed",
          completedAt: now,
          result,
          actualTokens,
          updatedAt: now,
        })
        .where(eq(tasks.id, id))
        .returning();

      if (updated[0]) {
        await this.logActivity({
          id: crypto.randomUUID(),
          taskId: id,
          agentId: updated[0].assignedTo,
          action: "completed",
          description: result,
          metadata: {},
        });
      }

      return updated[0];
    },

    async fail(id: string, errorMessage: string) {
      const now = new Date().toISOString();
      const result = await db
        .update(tasks)
        .set({
          status: "failed",
          errorMessage,
          updatedAt: now,
        })
        .where(eq(tasks.id, id))
        .returning();

      if (result[0]) {
        await this.logActivity({
          id: crypto.randomUUID(),
          taskId: id,
          agentId: result[0].assignedTo,
          action: "failed",
          description: errorMessage,
          metadata: {},
        });
      }

      return result[0];
    },

    async updateProgress(
      id: string,
      description: string,
      metadata?: Record<string, unknown>,
    ) {
      await this.logActivity({
        id: crypto.randomUUID(),
        taskId: id,
        action: "progress_update",
        description,
        metadata: metadata || {},
      });
    },

    async logActivity(activity: Omit<TaskActivity, "createdAt">) {
      return db.insert(taskActivities).values({
        id: activity.id,
        taskId: activity.taskId,
        agentId: activity.agentId,
        action: activity.action,
        description: activity.description,
        metadata: JSON.stringify(activity.metadata || {}),
      });
    },

    async getActivities(taskId: string) {
      return db
        .select()
        .from(taskActivities)
        .where(eq(taskActivities.taskId, taskId))
        .orderBy(desc(taskActivities.createdAt));
    },

    async getPendingTasks(projectId: string) {
      return db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "pending")))
        .orderBy(desc(tasks.priority), asc(tasks.createdAt));
    },

    // Organization-scoped queries for multi-tenant isolation
    async findByOrganization(organizationId: string, filters?: TaskFilters) {
      let query = db
        .select({
          task: tasks,
          project: projects,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(projects.organizationId, organizationId));

      if (filters?.status) {
        const statuses = Array.isArray(filters.status)
          ? filters.status
          : [filters.status];
        query = query.where(inArray(tasks.status, statuses));
      }

      if (filters?.priority) {
        const priorities = Array.isArray(filters.priority)
          ? filters.priority
          : [filters.priority];
        query = query.where(inArray(tasks.priority, priorities));
      }

      if (filters?.assignedTo) {
        query = query.where(eq(tasks.assignedTo, filters.assignedTo));
      }

      const results = await query.orderBy(
        desc(tasks.priority),
        asc(tasks.createdAt),
      );
      return results.map((r: any) => r.task);
    },

    async verifyTaskAccess(taskId: string, organizationId: string) {
      const result = await db
        .select({
          taskId: tasks.id,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(eq(tasks.id, taskId), eq(projects.organizationId, organizationId)),
        );
      return result.length > 0;
    },
  };
}
