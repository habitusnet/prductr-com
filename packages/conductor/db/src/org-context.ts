/**
 * Organization Context Helpers
 *
 * Utilities for enforcing organization-level data isolation in API routes.
 */

import { eq, and } from "drizzle-orm";
import { projects, tasks, agents } from "./schema.js";

export interface OrgContext {
  organizationId: string;
  userId?: string;
  role?: "owner" | "admin" | "member" | "viewer";
}

/**
 * Extract organization context from request headers or query params.
 * In production, this would integrate with your auth system.
 */
export function extractOrgContext(
  headers: Headers,
  searchParams?: URLSearchParams,
): OrgContext | null {
  // Try header first (preferred)
  const orgId = headers.get("x-organization-id");
  if (orgId) {
    return {
      organizationId: orgId,
      userId: headers.get("x-user-id") || undefined,
      role: (headers.get("x-user-role") as any) || undefined,
    };
  }

  // Fall back to query param (for dev/testing)
  if (searchParams) {
    const orgId = searchParams.get("organizationId");
    if (orgId) {
      return {
        organizationId: orgId,
        userId: searchParams.get("userId") || undefined,
      };
    }
  }

  return null;
}

/**
 * Require organization context or throw error.
 */
export function requireOrgContext(
  headers: Headers,
  searchParams?: URLSearchParams,
): OrgContext {
  const context = extractOrgContext(headers, searchParams);
  if (!context) {
    throw new Error("Organization context required");
  }
  return context;
}

/**
 * Check if user has required role for operation.
 */
export function hasRole(
  context: OrgContext,
  requiredRole: "owner" | "admin" | "member",
): boolean {
  if (!context.role) return false;

  const roleHierarchy = {
    owner: 3,
    admin: 2,
    member: 1,
    viewer: 0,
  };

  return roleHierarchy[context.role] >= roleHierarchy[requiredRole];
}

/**
 * Verify that a resource belongs to the organization context.
 */
export async function verifyResourceAccess(
  db: any,
  context: OrgContext,
  resourceType: "project" | "task" | "agent",
  resourceId: string,
): Promise<boolean> {
  switch (resourceType) {
    case "project": {
      const result = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, resourceId),
            eq(projects.organizationId, context.organizationId),
          ),
        );
      return result.length > 0;
    }

    case "task": {
      const result = await db
        .select({ id: tasks.id })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, resourceId),
            eq(projects.organizationId, context.organizationId),
          ),
        );
      return result.length > 0;
    }

    case "agent": {
      const result = await db
        .select({ id: agents.id })
        .from(agents)
        .where(
          and(
            eq(agents.id, resourceId),
            eq(agents.organizationId, context.organizationId),
          ),
        );
      return result.length > 0;
    }

    default:
      return false;
  }
}
