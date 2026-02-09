import { eq, and } from "drizzle-orm";
import { projects, projectAgents } from "../schema";
import type { Project, ProjectAgent } from "@conductor/core";

export function createProjectRepository(db: any) {
  return {
    async create(project: Omit<Project, "createdAt" | "updatedAt">) {
      const result = await db
        .insert(projects)
        .values({
          id: project.id,
          organizationId: project.organizationId,
          name: project.name,
          slug: project.slug,
          description: project.description,
          rootPath: project.rootPath,
          gitRemote: project.gitRemote,
          gitBranch: project.gitBranch || "main",
          conflictStrategy: project.conflictStrategy || "lock",
          budgetTotal: project.budget?.total,
          budgetSpent: project.budget?.spent || 0,
          budgetAlertThreshold: project.budget?.alertThreshold || 80,
          settings: JSON.stringify(project.settings || {}),
          isActive: project.isActive ?? true,
        })
        .returning();
      return result[0];
    },

    async findById(id: string) {
      const result = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));
      return result[0] || null;
    },

    async findByOrganization(organizationId: string) {
      return db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId));
    },

    async findBySlug(organizationId: string, slug: string) {
      const result = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            eq(projects.slug, slug),
          ),
        );
      return result[0] || null;
    },

    async update(id: string, data: Partial<Project>) {
      const updateData: any = { ...data, updatedAt: new Date().toISOString() };
      if (data.settings) updateData.settings = JSON.stringify(data.settings);
      if (data.budget) {
        updateData.budgetTotal = data.budget.total;
        updateData.budgetSpent = data.budget.spent;
        updateData.budgetAlertThreshold = data.budget.alertThreshold;
      }
      delete updateData.budget;

      const result = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();
      return result[0];
    },

    async delete(id: string) {
      await db.delete(projects).where(eq(projects.id, id));
    },

    // Project Agent bindings
    async addAgent(binding: Omit<ProjectAgent, "createdAt">) {
      const result = await db
        .insert(projectAgents)
        .values({
          id: binding.id,
          projectId: binding.projectId,
          agentId: binding.agentId,
          role: binding.role || "contributor",
          customInstructions: binding.customInstructions,
          instructionsFile: binding.instructionsFile,
          allowedPaths: JSON.stringify(binding.allowedPaths || []),
          deniedPaths: JSON.stringify(binding.deniedPaths || []),
          tokenBudget: binding.tokenBudget,
          isEnabled: binding.isEnabled ?? true,
        })
        .returning();
      return result[0];
    },

    async getAgents(projectId: string) {
      return db
        .select()
        .from(projectAgents)
        .where(eq(projectAgents.projectId, projectId));
    },

    async removeAgent(projectId: string, agentId: string) {
      await db
        .delete(projectAgents)
        .where(
          and(
            eq(projectAgents.projectId, projectId),
            eq(projectAgents.agentId, agentId),
          ),
        );
    },
  };
}
